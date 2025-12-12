import { readFileSync } from "fs";
import * as fs from "fs";
import * as ts from "typescript";
import * as path from 'path'
import { Platform, CheckPlatform, GetModuleMap, platforms } from './base'
import { PlatformString, GetJsonValueString } from './cloudMetaData'
import CommentParser from 'comment-parser';

interface DartType {
  encoding(variable: string): string
  decoding(variable: string): string
  readonly name: string
}
class DartArrayDeclaration implements DartType {
  encoding(variable: string): string {
    if (this.elementType instanceof DartPrimitive) {
      return variable
    }
    return `${variable}?.map((a)=> ${this.elementType.encoding('a')} )?.toList()`
  }
  decoding(variable: string): string {
    // if(this.elementType instanceof DartPrimitive){
    //     return variable
    // }
    return `(${variable} as List<dynamic>)?.map<${this.elementType.name}>((a) => ((a!=null) ? (${this.elementType.decoding('a')}) : null ))?.toList()`
  }
  get name(): string {
    return "List<" + this.elementType.name + ">"
  }
  constructor(params: { elementType: DartType }) {
    this.elementType = params.elementType
  }
  elementType: DartType
}
class DartCloudParams implements DartType {
  encoding(variable: string): string {
    return ''
  }
  decoding(variable: string): string {
    return ''
  }
  get name(): string {
    return ''
  }
}
class DartPromiseDeclaration implements DartType {
  encoding(variable: string): string {
    return this.elementType.encoding(variable)
  }
  decoding(variable: string): string {
    return this.elementType.decoding(variable)
  }
  get name(): string {
    return "Future<" + this.elementType.name + ">"
  }
  constructor(params: { elementType: DartType }) {
    this.elementType = params.elementType
  }
  elementType: DartType
}
class DartMapDeclaration implements DartType {
  encoding(variable: string): string {
    if (this.valueType instanceof DartPrimitive) {
      return variable
    }
    return `${variable}?.map((a, b) => MapEntry(a, ${this.valueType.encoding('b')} ))`
  }
  decoding(variable: string): string {
    // if(this.valueType instanceof DartPrimitive){
    //     return variable
    // }
    return `(${variable} as Map<dynamic, dynamic>)?.map<${this.keyType.name},${this.valueType.name}>((a, b) => MapEntry(a, ${this.valueType.decoding('b')} ))`
  }
  get name(): string {
    return "Map<" + this.keyType.name + "," + this.valueType.name + ">"
  }
  constructor(params: { keyType: DartType, valueType: DartType }) {
    this.keyType = params.keyType
    this.valueType = params.valueType
  }
  keyType: DartType
  valueType: DartType
}
abstract class DartDeclaration implements DartType {
  abstract encoding(variable: string): string
  abstract decoding(variable: string): string
  constructor(params: {
    // name:string,
    node: ts.InterfaceDeclaration | ts.TypeLiteralNode | ts.EnumDeclaration,
    file: DartFile
  }) {
    // this.name = params.name
    this.node = params.node
    this.file = params.file
  }
  readonly abstract name: string
  file: DartFile
  node: ts.InterfaceDeclaration | ts.TypeLiteralNode | ts.EnumDeclaration
}
class DartPrimitive implements DartType {
  constructor(name: string) {
    this.name = name
  }
  encoding(variable: string): string {
    return variable;
  }
  readonly name: string
  decoding(variable: string): string {
    return variable
  }
}

class DartDate implements DartType {
  encoding(variable: string): string {
    return `${variable}?.toIso8601String()`;
  }
  readonly name = 'DateTime'
  decoding(variable: string): string {
    return `(${variable}!=null?(${variable} is Map ? DateTime.parse(${variable}["iso"]): DateTime.parse(${variable})):null)`
  }
}
class DartInterface extends DartDeclaration {
  constructor(params: {
    name: string,
    node: ts.InterfaceDeclaration | ts.TypeLiteralNode,
    file: DartFile
  }) {
    super(params)
    this.name = params.name
  }
  readonly name: string
  encoding(variable: string): string {
    return variable + '?.toMap()'
  }
  decoding(variable: string): string {
    return `${this.name}.fromMap(${variable})`
  }
  DeepScanMemebers() {
    this.node.members?.forEach(e => this.ScanElement(e))
  }

  private ScanElement(element: ts.PropertySignature | ts.IndexSignatureDeclaration) {
    let typeNode = element.type
    // if(this.name=='GetWebPayQRParams'){
    //     console.log('pause')
    // }
    if (typeNode) {
      if (element.name) {
        this.file.ScanType(this.name + '_' + getMemberName(element.name.getText()), typeNode)
      } else {
        this.file.ScanType(this.name, typeNode)
      }
    }
  }

  getMembers(): ts.PropertySignature[] {
    let manager = this.file.manager
    let members = (this.node.members as ts.NodeArray<ts.PropertySignature>).map(e => e)
    if ('heritageClauses' in this.node && this.node.heritageClauses && this.node.heritageClauses.length > 0) {
      for (let i = 0; i < this.node.heritageClauses.length; ++i) {
        let types = this.node.heritageClauses![i].types;
        for (let t = 0; t < types.length; ++t) {
          let name = types[t].expression.getText()
          let dartType = manager.GetTypeByName(name)
          if (dartType instanceof DartInterface) {
            let superMembers = dartType.getMembers()
            //去掉已经在 members 里的字段
            superMembers = superMembers.filter(s => !members.find(e => e.name.getText() == s.name.getText()))
            members.push(...superMembers)
          }
        }
      }
    }
    return members
  }

  toString(): string {
    const indent = '\n    '
    const indent2 = indent + indent.substr(1)
    let members = this.getMembers()
    let dartTypeManager = this.file.manager
    let constructorText = ''
    if (members.length > 0) {
      constructorText =
        indent + this.name + '({'
        + members.map(e => indent2 + (e.questionToken ? '' : '@required ') + 'this.' + getMemberName(e.name.getText())).join(',')
        + indent + '});'
    } else {
      constructorText = indent + this.name + '();'
    }
    return `${GetComment(this.node)}
class ${this.name}`
      + '\n{\n'
      + constructorText
      + members.map(e => GetComment(e) + indent + dartTypeManager.GetPropertyType(e).name + ' ' + getMemberName(e.name.getText()) + ';').join('\n')
      + '\n' + indent + this.name + '.fromMap(Map<dynamic, dynamic> data){\n'
      + members.map(e => indent2 + `if(data["${getJsonKey(e.name.getText())}"]!=null) this.${getMemberName(e.name.getText())}=${dartTypeManager.GetPropertyType(e).decoding('data["' + getJsonKey(e.name.getText()) + '"]')};`).join('\n')
      + indent + '}'
      + indent + 'Map<String, dynamic> toMap(){'
      + indent2 + 'Map<String, dynamic> __return_value = {'
      + members.map(e => indent2 + `"${getJsonKey(e.name.getText())}":${dartTypeManager.GetPropertyType(e).encoding(getMemberName(e.name.getText()))}`).join(',\n')
      + indent2 + '};'
      + indent2 + '__return_value.removeWhere((k,v)=>v==null);'
      + indent2 + 'return __return_value;'
      + indent + '}'
      + '\n}'
  }
}

function getJsonKey(name: string) {
  if (name.startsWith("'") || name.startsWith('"')) {
    name = name.substr(1, name.length - 2)
  }
  return name
}

function getMemberName(name: string) {
  if (name == 'class') {
    return 'className'
  }
  if (name.startsWith("'") || name.startsWith('"')) {
    name = name.substr(1, name.length - 2)
  }
  if (name.includes('-')) {
    return name.replace('-', "_")
  }
  if (!isNaN(parseInt(name))) {
    return 'num' + name
  }
  return name
}
class DartEnum extends DartDeclaration {
  constructor(params: {
    name: string,
    node: ts.EnumDeclaration,
    file: DartFile
  }) {
    super(params)
    this.name = params.name
  }
  readonly name: string
  encoding(variable: string): string {
    return `${this.name}_encoding(${variable})`
  }
  decoding(variable: string): string {
    return `${this.name}_decoding(${variable})`
  }

  toString(): string {
    const indent = '\n    '
    let members = this.node.members as ts.NodeArray<ts.EnumMember>
    let dartTypeManager = this.file.manager
    return GetComment(this.node) + '\n'
      + `enum ${this.name}{`
      + members.map(e => GetComment(e) + indent + e.name.getText()).join(',\n')
      + '\n}'
      + `\n${this.name} ${this.name}_decoding(dynamic value){`
      + members.map(e => indent + `if(value==${e.initializer!.getText()}) return ${this.name}.${e.name.getText()};`).join('\n')
      + indent + 'return null;'
      + '\n}'
      + `\ndynamic ${this.name}_encoding(${this.name} value){`
      + members.map(e => indent + `if(value==${this.name}.${e.name.getText()}) return ${e.initializer!.getText()}`).map(e => e + ';').join('\n')
      + indent + 'return null;'
      + '\n}'
  }
}
class DartClassFunction {
  classFunction: ts.MethodDeclaration
  file: DartFile
  constructor(params: {
    classFunction: ts.MethodDeclaration,
    file: DartFile
  }) {
    this.classFunction = params.classFunction
    this.file = params.file
  }
  DeepScan() {
    if (this.classFunction.type) {
      this.file.ScanType(this.file.className + '_' + this.name + '_Return', this.classFunction.type)
    }
  }
  get name() {
    return this.classFunction.name.getText()
  }
  toString(): string {
    let dartTypeManager = this.file.manager
    let returnType = 'Future<dynamic>'
    let dartReturnType = dartTypeManager.defaultType
    if (this.classFunction.type) {
      dartReturnType = dartTypeManager.GetPropertyType(this.classFunction)
      returnType = dartReturnType.name
    }
    let parameterType = ''
    if (this.classFunction.parameters.length > 0) {
      parameterType = dartTypeManager.GetPropertyType(this.classFunction.parameters[0]).name
    }
    let parameter = (parameterType && `${parameterType} params`) || ''
    let parameterEncoding = (parameter && ', params?.toMap()') || ', {}'
    // const indent = '\n    '
    // const indent2 = indent+indent.substr(1)
    let result = dartReturnType.decoding(`(await Cloud.run("${this.file.className}.${this.name}"${parameterEncoding}))`)
    return `
    ${GetComment(this.classFunction)}
${returnType} ${this.name}(${parameter}) async {
        return ${result};
    }`
  }
}

class DartFile {
  manager: DartTypeManager
  node: ts.SourceFile
  // nodePath:string
  // dartPath:string
  imports: string[] = [
    // 'leancloud_dart/cloudfunction.dart',
    'meta/meta.dart'
  ]
  localImports: string[] = []
  interfaces: DartInterface[] = []
  literals: DartInterface[] = []
  enums: DartEnum[] = []
  classFunctions: DartClassFunction[] = []
  constructor(params: {
    manager: DartTypeManager
    node: ts.SourceFile
  }) {
    this.manager = params.manager
    this.node = params.node
  }

  DeepScanMemebers() {
    this.interfaces.forEach(e => e.DeepScanMemebers())
    this.classFunctions.forEach(e => e.DeepScan())
  }
  AddInterfaceDeclaration(typeNode: ts.InterfaceDeclaration) {

    const interfaceName = typeNode.name.getText()

    let members0 = typeNode.members[0]
    if (typeNode.members.length == 1 && ts.isIndexSignatureDeclaration(members0)) {
      let indexSignature = members0
      let dartTypeManager = this.manager
      let valueType = indexSignature.type
      let dartValueType = dartTypeManager.GetType(valueType)
      if (!dartValueType) {
        dartValueType = this.ScanType(interfaceName, valueType!)
      }
      if (!dartValueType) {
        dartValueType = dartTypeManager.defaultType
      }
      let dartType = new DartMapDeclaration({ valueType: dartValueType, keyType: dartTypeManager.GetType(indexSignature.parameters[0].type) })
      dartTypeManager.AddNodeType(typeNode, dartType, interfaceName)
      return dartType
    }
    else {
      let declaration = new DartInterface({
        name: typeNode.name.getText(),
        node: typeNode,
        file: this
      })
      this.interfaces.push(declaration)
      this.manager.AddType(declaration)
      // declaration.DeepScanMemebers()
      return declaration
    }
  }
  AddLiteralDeclaration(name: string, typeNode: ts.TypeLiteralNode) {
    let declaration = new DartInterface({
      name: name,
      node: typeNode,
      file: this
    })
    this.literals.push(declaration)
    this.manager.AddNodeType(typeNode, declaration)
    declaration.DeepScanMemebers()
    return declaration
  }
  AddEnumDeclaration(typeNode: ts.EnumDeclaration) {
    let declaration = new DartEnum({
      name: typeNode.name.getText(),
      node: typeNode,
      file: this
    })
    this.enums.push(declaration)
    this.manager.AddType(declaration)
    return declaration
  }

  AddClassFunction(classFunction: ts.MethodDeclaration) {
    this.classFunctions.push(new DartClassFunction({
      file: this,
      classFunction
    }))
  }

  AddLocalImport(file: string) {
    this.localImports.push(file + '.dart')
  }

  ClearUnavailableImport() {
    this.localImports.filter(e => this.manager.files.find(f => f.className == e))
  }

  private ScanPromiseType(node: ts.TypeReferenceNode, name: string, elementType: ts.TypeNode) {
    let dartTypeManager = this.manager
    let dartElementType = dartTypeManager.GetType(elementType)
    if (!dartElementType) {
      dartElementType = this.ScanType(name, elementType)
    }
    if (!dartElementType) {
      dartElementType = dartTypeManager.defaultType
    }
    let dartArray = new DartPromiseDeclaration({ elementType: dartElementType })
    dartTypeManager.AddNodeType(node, dartArray)
    return dartArray
  }
  private ScanArrayType(node: ts.TypeReferenceNode | ts.ArrayTypeNode, name: string, elementType: ts.TypeNode) {
    let dartTypeManager = this.manager
    let dartElementType = dartTypeManager.GetType(elementType)
    if (!dartElementType) {
      dartElementType = this.ScanType(name, elementType)
    }
    if (!dartElementType) {
      dartElementType = dartTypeManager.defaultType
    }
    let dartArray = new DartArrayDeclaration({ elementType: dartElementType })
    dartTypeManager.AddNodeType(node, dartArray)
    return dartArray
  }
  //处理语法 words: {[key: string]: string }
  private ScanMapType(node: ts.TypeLiteralNode, name: string, indexSignature: ts.IndexSignatureDeclaration) {
    let dartTypeManager = this.manager
    let valueType = indexSignature.type
    let dartValueType = dartTypeManager.GetType(valueType)
    if (!dartValueType) {
      dartValueType = this.ScanType(name, valueType!)
    }
    if (!dartValueType) {
      dartValueType = dartTypeManager.defaultType
    }
    let dartType = new DartMapDeclaration({ valueType: dartValueType, keyType: dartTypeManager.GetType(indexSignature.parameters[0].type) })
    dartTypeManager.AddNodeType(node, dartType, name)
    return dartType
  }
  //处理语法 objectId: {[key in ICheckType]?: number}
  private ScanMapTypeNode(node: ts.MappedTypeNode, name: string, mappedTypeNode: ts.MappedTypeNode) {
    let dartTypeManager = this.manager
    let valueType = mappedTypeNode.type
    let dartValueType = dartTypeManager.GetType(valueType)
    if (!dartValueType) {
      dartValueType = this.ScanType(name, valueType!)
    }
    if (!dartValueType) {
      dartValueType = dartTypeManager.defaultType
    }
    let dartType = new DartMapDeclaration({ valueType: dartValueType, keyType: dartTypeManager.GetTypeByName('String') })
    dartTypeManager.AddNodeType(node, dartType, name)
    return dartType
  }
  ScanType(name: string, typeNode: ts.TypeNode): DartType {
    switch (typeNode.kind) {
      case ts.SyntaxKind.ArrayType: {
        return this.ScanArrayType(typeNode as ts.ArrayTypeNode, name, (typeNode as ts.ArrayTypeNode).elementType)
      }
        break
      case ts.SyntaxKind.TypeReference:
        let typeReferenceNode = (typeNode as ts.TypeReferenceNode)
        switch (typeReferenceNode.typeName.getText()) {
          case 'Array': return this.ScanArrayType(typeReferenceNode, name, typeReferenceNode.typeArguments![0])
          case 'Promise': return this.ScanPromiseType(typeReferenceNode, name, typeReferenceNode.typeArguments![0])
        }
        break
      case ts.SyntaxKind.TypeLiteral: {
        let typeLiteralNode = typeNode as ts.TypeLiteralNode
        if (typeLiteralNode.members.length == 1 && typeLiteralNode.members[0].kind == ts.SyntaxKind.IndexSignature) {
          return this.ScanMapType(typeLiteralNode, name, typeLiteralNode.members[0] as ts.IndexSignatureDeclaration)
        }
        return this.AddLiteralDeclaration(name, typeLiteralNode)
      }
      case ts.SyntaxKind.MappedType: {
        if (ts.isMappedTypeNode(typeNode)) {
          return this.ScanMapTypeNode(typeNode, name, typeNode)
        }
      }
    }
    return this.manager.GetType(typeNode)
  }

  get fileName() {
    return path.basename(this.node.fileName, '.ts') + '.dart'
  }

  get className() {
    let name = path.basename(this.node.fileName, '.ts')
    name = name.replace('-', '_')
    return name[0].toUpperCase() + name.substr(1)
  }

  cloudToString(): string {
    if (this.classFunctions.length == 0) {
      return ''
    }
    return 'class ' + this.className + '{'
      + this.classFunctions.map(e => e.toString()).join('\n')
      + '\n}'
  }

  toString(): string {
    let packageName = this.manager.packageName
    return this.imports.map(e => `import 'package:${e}';`).join('\n') + '\n' +
      `import 'package:${packageName}/cloud.dart' as Cloud;` +
      '\n' + this.localImports.map(e => `import 'package:${packageName}/lib/${e}';`).join('\n') +
      `
/**
 * automatic generated from typescript TypeLiteral
 */
`
      + this.literals.map(e => e.toString()).join('\n') +
      `
/**
 * automatic generated from typescript interface
 */
`
      + this.interfaces.map(e => e.toString()).join('\n') +
      `
/**
 * automatic generated from typescript enum
 */
`
      + this.enums.map(e => e.toString()).join('\n') +
      `
/**
 * automatic generated from cloud function class
 */
`
      + this.cloudToString()
  }
}

class DartTypeManager {
  types: { [key: string]: DartType } = {}
  defaultType = new DartPrimitive('dynamic')
  codeToType: { [key: string]: DartType } = {}
  packageName: string
  files: DartFile[] = []
  constructor(params: { packageName: string }) {
    this.packageName = params.packageName
    this.AddTypes([
      new DartDate(),
      new DartPrimitive('num'),
      new DartPrimitive('String'),
      new DartPrimitive('bool'),
      this.defaultType
    ])
    this.AddType(new DartCloudParams, 'CloudParams')
  }

  AddFile(node: ts.SourceFile) {
    let file = new DartFile({
      manager: this,
      node
    })
    this.files.push(file)
    return file
  }
  RemoveUnusedFiles() {
    this.files = this.files.filter(e => e.classFunctions.length > 0)
    this.files.forEach(f => f.ClearUnavailableImport())
  }
  private GetMapTypeDartText(prefix: string, typeNode: ts.IndexSignatureDeclaration): string {
    return 'Map<' + this.GetTypeName(prefix, typeNode.parameters[0].type), +this.GetTypeName(prefix, typeNode.type) + '>'
  }

  private GetArrayTypeDartText(prefix: string, typeNode: ts.ArrayTypeNode): string {
    return 'List<' + this.GetTypeName(prefix, typeNode.elementType) + '>'
  }

  private GetReferenceTypeDartText(prefix: string, typeNode: ts.TypeReferenceNode): string {
    let typeText = typeNode.typeName.getText()
    switch (typeText) {
      case 'Date': return 'DateTime';
      case 'Array': return 'List<' + this.GetTypeName(prefix, typeNode.typeArguments![0]) + '>'
      case 'Promise': return 'Future<' + this.GetTypeName(prefix, typeNode.typeArguments![0]) + '>'
    }
    if (typeText.includes('.')) {
      typeText = typeText.substring(0, typeText.indexOf('.'))
    }
    let dartType = this.GetTypeByName(typeText)
    if (dartType instanceof DartPrimitive) {
      return dartType.name
    }
    return typeText
    // console.error('Error ReferenceType To Dart '+typeText)
    // return 'dynamic'
  }


  GetUnionDartType(prefix: string, unionType: ts.UnionTypeNode) {
    var types = unionType.types.filter(e => e.kind != ts.SyntaxKind.UndefinedKeyword && e.kind != ts.SyntaxKind.NullKeyword)
    if (types.length == 1) {
      return this.GetTypeName(prefix, types[0])
    }
    if (unionType.types.every(e => {
      if (ts.isLiteralTypeNode(e)) {
        return e.literal.kind == ts.SyntaxKind.StringLiteral
      }
    })) {
      return 'String'
    } else if (unionType.types.every(e => {
      if (ts.isLiteralTypeNode(e)) {
        return e.literal.kind == ts.SyntaxKind.NumericLiteral
      }
    })) {
      return 'num'
    } else if (unionType.types.every(e => {
      if (ts.isLiteralTypeNode(e)) {
        let kind = e.literal.kind
        return kind == ts.SyntaxKind.FalseKeyword || kind == ts.SyntaxKind.TrueKeyword || kind == ts.SyntaxKind.BooleanKeyword
      }
    })) {
      return 'bool'
    }
    return 'dynamic'
  }

  GetTypeName(prefix: string, typeNode?: ts.TypeNode) {
    if (!typeNode) {
      return 'dynamic'
    }
    switch (typeNode.kind) {
      case ts.SyntaxKind.StringKeyword: return 'String';
      case ts.SyntaxKind.NumberKeyword: return 'num';
      case ts.SyntaxKind.BooleanKeyword: return 'bool';
      case ts.SyntaxKind.AnyKeyword: return 'dynamic';
      case ts.SyntaxKind.ObjectKeyword: return 'dynamic';
      case ts.SyntaxKind.ArrayType: return this.GetArrayTypeDartText(prefix, typeNode as ts.ArrayTypeNode);
      case ts.SyntaxKind.TypeReference: return this.GetReferenceTypeDartText(prefix, typeNode as ts.TypeReferenceNode);
      case ts.SyntaxKind.TypeLiteral: {
        let typeLiteralNode = typeNode as ts.TypeLiteralNode
        if (typeLiteralNode.members.length == 1 && typeLiteralNode.members[0].kind == ts.SyntaxKind.IndexSignature) {
          return this.GetMapTypeDartText(prefix, typeLiteralNode.members[0] as ts.IndexSignatureDeclaration)
        }
        return prefix
      }
      case ts.SyntaxKind.UnionType:
        if (ts.isUnionTypeNode(typeNode)) {
          return this.GetUnionDartType(prefix, typeNode)
        }
      case ts.SyntaxKind.LiteralType: {
        if (ts.isLiteralTypeNode(typeNode)) {
          switch (typeNode.literal.kind) {
            case ts.SyntaxKind.StringLiteral: return 'String';
            case ts.SyntaxKind.NumericLiteral: return 'num';
            case ts.SyntaxKind.FalseKeyword:
            case ts.SyntaxKind.TrueKeyword:
              return 'num';
          }
        }
      }
      case ts.SyntaxKind.MappedType: {
        if (ts.isMappedTypeNode(typeNode)) {
          return 'Map<String,' + this.GetTypeName(prefix, typeNode.type) + '>'
        }
      }
    }
    console.error('Error Type To Dart ,kind ' + typeNode.kind + ' ' + typeNode.getSourceFile().fileName + ' ' + typeNode.pos + ' ' + typeNode.getText())
    return 'dynamic'
  }

  AddType(dartType: DartType, name?: string) {
    this.types[name || dartType.name] = dartType
  }
  AddNodeType(node: ts.TypeLiteralNode | ts.TypeReferenceNode | ts.ArrayTypeNode | ts.MappedTypeNode | ts.InterfaceDeclaration, dartType: DartType, name2?: string) {
    this.types[dartType.name] = dartType
    if (name2) {
      this.types[name2] = dartType
    }
    this.codeToType[node.getSourceFile().fileName + node.pos] = dartType
  }

  AddTypes(dartTypes: DartType[]) {
    dartTypes.forEach(e => this.types[e.name] = e)
  }

  GetPropertyType(node: ts.PropertySignature | ts.MethodDeclaration | ts.ParameterDeclaration) {
    // if(node.getText()=='type?: ActivityType')
    // if(node.getSourceFile().fileName=='check.ts'&&node.pos==1805)
    // {
    //     console.log('pause')
    // }
    let dartType: DartType | null = null
    if (node.type) {
      dartType = this.codeToType[node.getSourceFile().fileName + node.type.pos]
    }
    if (!dartType) {
      dartType = this.GetType(node.type)
    }
    if (dartType) {
      return dartType
    }
    console.error('Error Type To Dart GetEncoding  ' + node.getSourceFile().fileName + ' ' + node.pos + ' ' + node.getText())
    return this.defaultType
  }
  GetType(node?: ts.TypeNode) {
    return this.types[this.GetTypeName('', node)]
  }
  GetTypeByName(type: string) {
    return this.types[type]
  }
  IndexFileBody() {
    return this.files.map(e => `import "package:${this.packageName}/lib/${e.fileName}" as _${e.className};`).join('\n')
      + '\n\n'
      + this.files.map(e => `final ${e.className} = new _${e.className}.${e.className}();`).join('\n')
  }
}


function GetComment(node: ts.Node) {
  let sourceText = node.getSourceFile().getText()
  let range = ts.getLeadingCommentRanges(sourceText, node.getFullStart())
  if (!range) {
    return ''
  }
  let out = range.map(e =>
    CommentParser(sourceText.substring(e.pos, e.end))
      .map(c => c.source.split('\n').map(l => '///' + l).join('\n'))
      .join('\n')
  )
    .join('\n')
  return '\n' + out
}

function IsExportDisabled(node: ts.Node) {
  return node.getFullText().includes('@lcc-export-disabled')
}

//https://github.com/Microsoft/TypeScript/wiki/Using-the-Compiler-API
//在线查看代码ast的工具 https://ts-ast-viewer.com/
function createSdkFile(file: DartFile) {

  let sourceFile = file.node
  let manager = file.manager
  function scanNode(node: ts.Node) {
    switch (node.kind) {
      case ts.SyntaxKind.FunctionDeclaration:
        break;
      case ts.SyntaxKind.ExpressionStatement:
      case ts.SyntaxKind.IfStatement:
      case ts.SyntaxKind.ExportAssignment:
        break
      case ts.SyntaxKind.TypeAliasDeclaration: {
        let typeAliasDeclaration = node as ts.TypeAliasDeclaration
        if (ts.isUnionTypeNode(typeAliasDeclaration.type)) {
          manager.AddType(manager.GetTypeByName(manager.GetUnionDartType(typeAliasDeclaration.name.getText(), typeAliasDeclaration.type)), typeAliasDeclaration.name.getText())
        } else {
          file.ScanType(typeAliasDeclaration.name.getText(), typeAliasDeclaration.type)
        }
      }
      case ts.SyntaxKind.VariableStatement:

        break
      case ts.SyntaxKind.ImportDeclaration:
        {
          if (IsExportDisabled(node)) {
            break
          }
          const skipModuleNames = [
            './cloud', './index', './base', 'bluebird', 'leancloud-cloud-decorator'
          ]
          let importDeclaration = <ts.ImportDeclaration>node
          let moduleName = importDeclaration.moduleSpecifier.getText()
          // console.log(moduleName.substring(1, moduleName.length - 1))
          moduleName = moduleName.substring(1, moduleName.length - 1)
          if (!moduleName.includes('..')
            && !moduleName.includes('.json')
            && !skipModuleNames.includes(moduleName)) {

            if (moduleName.startsWith('./')) {
              file.AddLocalImport(moduleName.substr(2))
            }
          }
        }
        break
      case ts.SyntaxKind.ImportEqualsDeclaration:
        {
          if (IsExportDisabled(node)) {
            break
          }
          let importEqualsDeclaration = <ts.ImportEqualsDeclaration>node
          if (importEqualsDeclaration.moduleReference.kind == ts.SyntaxKind.QualifiedName) {

          } else {
          }
        }
        break
      case ts.SyntaxKind.EnumDeclaration: {
        let enumNode = <ts.EnumDeclaration>node
        file.AddEnumDeclaration(enumNode)
      }
        break
      case ts.SyntaxKind.InterfaceDeclaration:
        {
          if (IsExportDisabled(node)) {
            break
          }
          let interfaceNode = <ts.InterfaceDeclaration>node
          if (interfaceNode.members.length == 1 && interfaceNode.members[0].kind == ts.SyntaxKind.IndexSignature) {

          } else {
            file.AddInterfaceDeclaration(interfaceNode)
          }

        }
        break
      case ts.SyntaxKind.ClassDeclaration:
        {
          if (IsExportDisabled(node)) {
            break
          }
          let classNode = <ts.ClassDeclaration>node
          let needExport = true
          if (classNode.modifiers) {
            if (classNode.modifiers.find(x => x.kind == ts.SyntaxKind.ExportKeyword)) {
              needExport = false
            }
          }
          ts.forEachChild(node, scanNode)
          if (classNode.name) {
            let className: string = classNode.name.getText()
            let instance = className[0].toLowerCase() + className.substr(1)
            // exportText = `\nlet ${instance} = new ${className}()\nexport default ${instance}`
          }
        }
        break
      case ts.SyntaxKind.MethodDeclaration:
        {
          if (IsExportDisabled(node)) {
            break
          }
          let methodNode = <ts.MethodDeclaration>node
          let decorators = ts.canHaveDecorators(methodNode) ? ts.getDecorators(methodNode) : undefined
          if (decorators) {
            let needSkip = true;
            for (let i = 0; i < decorators.length; ++i) {
              // console.log(JSON.stringify(decorator))
              let decorator = decorators[i].getText()
              if (decorator.substring(0, 6) == '@Cloud') {

                let platformText = PlatformString(decorator)
                // console.log(paramsText)
                let platforms = platformText && JSON.parse(platformText)
                let rpcText = GetJsonValueString(decorator, 'rpc')
                let rpc = rpcText && JSON.parse(rpcText)
                let internalText = GetJsonValueString(decorator, 'internal')
                let internal = internalText && JSON.parse(internalText)

                needSkip = false;
                if (!internal && (!platforms || platforms.length == 0)) {
                  file.AddClassFunction(methodNode)
                }
                break
              }
            }
          }
        }
        break
    }
  }
  ts.forEachChild(sourceFile, scanNode);
  return file
}

function deleteFolderRecursive(path: string) {
  if (fs.existsSync(path)) {
    fs.readdirSync(path).forEach(function (file, index) {
      var curPath = path + "/" + file;
      if (fs.lstatSync(curPath).isDirectory()) { // recurse
        deleteFolderRecursive(curPath);
      } else { // delete file
        fs.unlinkSync(curPath);
      }
    });
    fs.rmdirSync(path);
  }
};



function createSdk(dir: string[], exclude: string[], packageName: string) {

  {
    let libPath = getSdkLibPath(targetPlatform)
    if (fs.existsSync(libPath)) {
      console.log('remove old files ' + libPath)
      deleteFolderRecursive(libPath)
    }
    fs.mkdirSync(libPath)
    fs.mkdirSync(libPath + '/lib')
  }
  // }

  let manager = new DartTypeManager({
    packageName
  })
  let indexFileText = ''
  // let dartFiles:DartFile[] = []
  for (let d = 0; d < dir.length; ++d) {
    let file = dir[d]
    if (path.extname(file) == '.ts' && exclude.indexOf(file) < 0) {
      console.log('read ' + file)
      let name = path.basename(file, '.ts')
      let text = readFileSync(_dirroot + 'src/cloud/' + file).toString()
      if (!text.includes('@lcc-ignore-file')) {
        let sourceFile = ts.createSourceFile(
          file,
          text,
          ts.ScriptTarget.ES2015,
                    /*setParentNodes */ true
        );
        //   console.log(printNode(sourceFile))
        createSdkFile(manager.AddFile(sourceFile))
      }

    }
  }
  manager.RemoveUnusedFiles()
  manager.files.forEach(e => e.DeepScanMemebers())
  manager.files.forEach(e => {
    let libPath = getSdkLibPath(targetPlatform) + '/lib/' + e.fileName
    console.log('write ' + libPath)
    fs.writeFileSync(libPath, e.toString())
  })
  let indexPath = getSdkLibPath(targetPlatform) + '/index.dart'
  console.log('write ' + 'index.dart')
  fs.writeFileSync(indexPath,
    `import "package:${packageName}/info.dart" as sdkInfo;
import 'package:${packageName}/cloud.dart' as Cloud;
import 'package:meta/meta.dart';
import 'dart:typed_data';
`
    + manager.IndexFileBody()
    + `  
void Init({@required String clientVersion,@required Uint8List key}){
    Cloud.SetAPIInfo(sdkInfo.platform, sdkInfo.apiVersion, clientVersion,key);
}
`)
  fs.writeFileSync(getSdkLibPath(targetPlatform) + '/cloud.dart',
    `import 'package:leancloud_storage/leancloud.dart';
import 'package:encrypt/encrypt.dart' as Encrypt;
import 'dart:convert';
import 'dart:typed_data';


String _platform = "dart";
String _apiVersion = "0.0.0";
String _clientVersion = "0.0.0";

void SetAPIInfo(String platform,String apiVersion,String clientVersion,Uint8List key){
  _platform = platform;
  _apiVersion = apiVersion;
  _clientVersion = clientVersion;
  _key = new Encrypt.Key(key);
}


Encrypt.Key _key = new Encrypt.Key(Uint8List.fromList( [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]));

dynamic _decrypt(dynamic result){

    if(result is Map){
      var encryptedData = result["_encryptedData"];
      if(encryptedData!=null){
        var buffer = base64Decode(encryptedData);
        var encrypted = new Encrypt.Encrypted(buffer.sublist(16));
        var iv = new Encrypt.IV(buffer.sublist(0,16));
        var encrypter = new Encrypt.Encrypter(new Encrypt.AES(_key,mode: Encrypt.AESMode.cbc ));
        var decrypted = encrypter.decryptBytes(encrypted, iv: iv);
        var decryptedString = utf8.decode(decrypted);
        return json.decode(decryptedString);
      }
    }
    return result;
}


Future run(String name, Map<String, dynamic> params) async {
  params.removeWhere((k,v)=>v==null);
  params["_api"] = {
    "platform": _platform,
    "apiVersion": _apiVersion,
    "clientVersion": _clientVersion
  };
  var _result = await LCCloud.run(name, params:params);
  return _decrypt(_result['result']);
}
`
  )
}

// let targetPlatform = CheckPlatform( process.argv[2] )

let _dirroot = '/Users/zhilongchen/home/muyue/pteai-node-ts2/'
function getSdkLibPath(platform: Platform) {
  return _dirroot + 'release/api/' + platform + '/lib'
}
let targetPlatform = 'dart'
let moduleMap = {}//GetModuleMap(targetPlatform)
moduleMap['leanengine'] = moduleMap['leanengine'] || moduleMap['leancloud-storage'] || 'leancloud-storage'


const exclude = ['cloud.ts', 'index.ts', 'base.ts']

export function CreatDartSdk(params: { platform: string, dirroot: string, packageName?: string }) {
  targetPlatform = params.platform
  _dirroot = params.dirroot
  console.log('build typescript sdk....')
  let dir = fs.readdirSync(_dirroot + 'src/cloud/')
  createSdk(dir, exclude, params.packageName || platforms[targetPlatform].package)
}


// CreatDartSdk({
//     platform:'dart',
//     dirroot:'/Users/zhilongchen/home/muyue/pteai-node-ts2/',
//     packageName:'pteapp_app'
// })