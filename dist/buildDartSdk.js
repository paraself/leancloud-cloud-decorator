"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const fs = __importStar(require("fs"));
const ts = __importStar(require("typescript"));
const path = __importStar(require("path"));
const base_1 = require("./base");
const cloudMetaData_1 = require("./cloudMetaData");
class DartArrayDeclaration {
    constructor(params) {
        this.elementType = params.elementType;
    }
    encoding(variable) {
        if (this.elementType instanceof DartPrimitive) {
            return variable;
        }
        return `${variable}.map((a)=> ${this.elementType.encoding('a')} ).toList()`;
    }
    decoding(variable) {
        if (this.elementType instanceof DartPrimitive) {
            return variable;
        }
        return `(${variable} as List<dynamic>).map((a) => ${this.elementType.decoding('a')} ).toList()`;
    }
    get name() {
        return "List<" + this.elementType.name + ">";
    }
}
class DartPromiseDeclaration {
    constructor(params) {
        this.elementType = params.elementType;
    }
    encoding(variable) {
        return this.elementType.encoding(variable);
    }
    decoding(variable) {
        return this.elementType.decoding(variable);
    }
    get name() {
        return "Future<" + this.elementType.name + ">";
    }
}
class DartMapDeclaration {
    constructor(params) {
        this.keyType = params.keyType;
        this.valueType = params.valueType;
    }
    encoding(variable) {
        if (this.valueType instanceof DartPrimitive) {
            return variable;
        }
        return `${variable}.map((a, b) => MapEntry(a, ${this.valueType.encoding('b')} ))`;
    }
    decoding(variable) {
        if (this.valueType instanceof DartPrimitive) {
            return variable;
        }
        return `${variable}.map((a, b) => MapEntry(a, ${this.valueType.decoding('b')} ))`;
    }
    get name() {
        return "Map<" + this.keyType.name + "," + this.valueType.name + ">";
    }
}
class DartDeclaration {
    constructor(params) {
        // this.name = params.name
        this.node = params.node;
        this.file = params.file;
    }
}
class DartPrimitive {
    constructor(name) {
        this.name = name;
    }
    encoding(variable) {
        return variable;
    }
    decoding(variable) {
        return variable;
    }
}
//todo:
class DartDate {
    constructor() {
        this.name = 'DateTime';
    }
    encoding(variable) {
        return `${variable}.toIso8601String()`;
    }
    decoding(variable) {
        return `${variable} is Map ? DateTime.parse(${variable}["iso"]): DateTime.parse(${variable})`;
    }
}
class DartInterface extends DartDeclaration {
    constructor(params) {
        super(params);
        this.name = params.name;
    }
    encoding(variable) {
        return variable + '.toMap()';
    }
    decoding(variable) {
        return `${this.name}.fromMap(${variable})`;
    }
    DeepScanMemebers() {
        var _a;
        (_a = this.node.members) === null || _a === void 0 ? void 0 : _a.forEach(e => this.ScanElement(e));
    }
    ScanElement(element) {
        let typeNode = element.type;
        // if(this.name=='GetWebPayQRParams'){
        //     console.log('pause')
        // }
        if (typeNode) {
            if (element.name) {
                this.file.ScanType(this.name + '_' + getMemberName(element.name.getText()), typeNode);
            }
            else {
                this.file.ScanType(this.name, typeNode);
            }
        }
    }
    toString() {
        const indent = '\n    ';
        const indent2 = indent + indent.substr(1);
        let members = this.node.members;
        let dartTypeManager = this.file.manager;
        let constructorText = '';
        if (members.length > 0) {
            constructorText =
                indent + this.name + '({'
                    + members.map(e => indent2 + (e.questionToken ? '' : '@required ') + 'this.' + getMemberName(e.name.getText())).join(',')
                    + indent + '});';
        }
        return `${GetComment(this.node)}class ${this.name}`
            + '\n{\n'
            + constructorText
            + members.map(e => GetComment(e) + indent + dartTypeManager.GetPropertyType(e).name + ' ' + getMemberName(e.name.getText()) + ';').join('\n')
            + '\n' + indent + this.name + '.fromMap(Map<String, dynamic> data){\n'
            + members.map(e => indent2 + `if(data["${getJsonKey(e.name.getText())}"]!=null) this.${getMemberName(e.name.getText())}=${dartTypeManager.GetPropertyType(e).decoding('data["' + getJsonKey(e.name.getText()) + '"]')};`).join('\n')
            + indent + '}'
            + indent + 'Map<String, dynamic> toMap(){'
            + indent2 + 'var __return_value = {'
            + members.map(e => indent2 + `"${getJsonKey(e.name.getText())}":${dartTypeManager.GetPropertyType(e).encoding(getMemberName(e.name.getText()))}`).join(',\n')
            + indent2 + '};'
            + indent2 + '__return_value.removeWhere((k,v)=>v==null);'
            + indent2 + 'return __return_value;'
            + indent + '}'
            + '\n}';
    }
}
function getJsonKey(name) {
    if (name.startsWith("'") || name.startsWith('"')) {
        name = name.substr(1, name.length - 2);
    }
    return name;
}
function getMemberName(name) {
    if (name == 'class') {
        return 'className';
    }
    if (name.startsWith("'") || name.startsWith('"')) {
        name = name.substr(1, name.length - 2);
    }
    if (name.includes('-')) {
        return name.replace('-', "_");
    }
    if (!isNaN(parseInt(name))) {
        return 'num' + name;
    }
    return name;
}
class DartEnum extends DartDeclaration {
    constructor(params) {
        super(params);
        this.name = params.name;
    }
    encoding(variable) {
        return `${this.name}_encoding(${variable})`;
    }
    decoding(variable) {
        return `${this.name}_decoding(${variable})`;
    }
    toString() {
        const indent = '\n    ';
        let members = this.node.members;
        let dartTypeManager = this.file.manager;
        return GetComment(this.node)
            + `enum ${this.name}{`
            + members.map(e => GetComment(e) + indent + e.name.getText()).join(',\n')
            + '\n}'
            + `\n${this.name} ${this.name}_decoding(dynamic value){`
            + indent + `var text = dynamic.toString();`
            + members.map(e => indent + `if(text==${e.initializer.getText()}) return ${this.name}.${e.name.getText()};`).join('\n')
            + indent + 'return null;'
            + '\n}'
            + `\ndynamic ${this.name}_encoding(${this.name} value){`
            + members.map(e => indent + `if(value==${this.name}.${e.name.getText()}) return ${e.initializer.getText()}`).map(e => e + ';').join('\n')
            + indent + 'return null;'
            + '\n}';
    }
}
class DartClassFunction {
    constructor(params) {
        this.classFunction = params.classFunction;
        this.file = params.file;
    }
    DeepScan() {
        if (this.classFunction.type) {
            this.file.ScanType(this.file.className + '_' + this.name + '_Return', this.classFunction.type);
        }
    }
    get name() {
        return this.classFunction.name.getText();
    }
    toString() {
        let dartTypeManager = this.file.manager;
        let returnType = 'Future<dynamic>';
        let dartReturnType = dartTypeManager.defaultType;
        if (this.classFunction.type) {
            dartReturnType = dartTypeManager.GetPropertyType(this.classFunction);
            returnType = dartReturnType.name;
        }
        let parameterType = '';
        if (this.classFunction.parameters.length > 0) {
            parameterType = dartTypeManager.GetPropertyType(this.classFunction.parameters[0]).name;
        }
        let parameter = (parameterType && `${parameterType} params`) || '';
        let parameterEncoding = (parameter && ', params.toMap()') || ', {}';
        // const indent = '\n    '
        // const indent2 = indent+indent.substr(1)
        let result = dartReturnType.decoding(`(await Cloud.run("${this.file.className}.${this.name}"${parameterEncoding}))`);
        return `
    ${GetComment(this.classFunction)}${returnType} ${this.name}(${parameter}) async {
        return ${result};
    }`;
    }
}
class DartFile {
    constructor(params) {
        // nodePath:string
        // dartPath:string
        this.imports = [
            'leancloud_dart/cloudfunction.dart',
            'meta/meta.dart'
        ];
        this.localImports = [];
        this.interfaces = [];
        this.literals = [];
        this.enums = [];
        this.classFunctions = [];
        this.manager = params.manager;
        this.node = params.node;
    }
    DeepScanMemebers() {
        this.interfaces.forEach(e => e.DeepScanMemebers());
        this.classFunctions.forEach(e => e.DeepScan());
    }
    AddInterfaceDeclaration(typeNode) {
        let declaration = new DartInterface({
            name: typeNode.name.getText(),
            node: typeNode,
            file: this
        });
        this.interfaces.push(declaration);
        this.manager.AddType(declaration);
        // declaration.DeepScanMemebers()
        return declaration;
    }
    AddLiteralDeclaration(name, typeNode) {
        let declaration = new DartInterface({
            name: name,
            node: typeNode,
            file: this
        });
        this.literals.push(declaration);
        this.manager.AddNodeType(typeNode, declaration);
        declaration.DeepScanMemebers();
        return declaration;
    }
    AddEnumDeclaration(typeNode) {
        let declaration = new DartEnum({
            name: typeNode.name.getText(),
            node: typeNode,
            file: this
        });
        this.enums.push(declaration);
        this.manager.AddType(declaration);
        return declaration;
    }
    AddClassFunction(classFunction) {
        this.classFunctions.push(new DartClassFunction({
            file: this,
            classFunction
        }));
    }
    AddLocalImport(file) {
        this.localImports.push(file + '.dart');
    }
    ClearUnavailableImport() {
        this.localImports.filter(e => this.manager.files.find(f => f.className == e));
    }
    ScanPromiseType(node, name, elementType) {
        let dartTypeManager = this.manager;
        let dartElementType = dartTypeManager.GetType(elementType);
        if (!dartElementType) {
            dartElementType = this.ScanType(name, elementType);
        }
        if (!dartElementType) {
            dartElementType = dartTypeManager.defaultType;
        }
        let dartArray = new DartPromiseDeclaration({ elementType: dartElementType });
        dartTypeManager.AddNodeType(node, dartArray);
        return dartArray;
    }
    ScanArrayType(node, name, elementType) {
        let dartTypeManager = this.manager;
        let dartElementType = dartTypeManager.GetType(elementType);
        if (!dartElementType) {
            dartElementType = this.ScanType(name, elementType);
        }
        if (!dartElementType) {
            dartElementType = dartTypeManager.defaultType;
        }
        let dartArray = new DartArrayDeclaration({ elementType: dartElementType });
        dartTypeManager.AddNodeType(node, dartArray);
        return dartArray;
    }
    //处理语法 words: {[key: string]: string }
    ScanMapType(node, name, indexSignature) {
        let dartTypeManager = this.manager;
        let valueType = indexSignature.type;
        let dartValueType = dartTypeManager.GetType(valueType);
        if (!dartValueType) {
            dartValueType = this.ScanType(name, dartValueType);
        }
        if (!dartValueType) {
            dartValueType = dartTypeManager.defaultType;
        }
        let dartType = new DartMapDeclaration({ valueType: dartValueType, keyType: dartTypeManager.GetType(indexSignature.parameters[0].type) });
        dartTypeManager.AddNodeType(node, dartType);
        return dartType;
    }
    //处理语法 objectId: {[key in ICheckType]?: number}
    ScanMapTypeNode(node, name, mappedTypeNode) {
        let dartTypeManager = this.manager;
        let valueType = mappedTypeNode.type;
        let dartValueType = dartTypeManager.GetType(valueType);
        if (!dartValueType) {
            dartValueType = this.ScanType(name, dartValueType);
        }
        if (!dartValueType) {
            dartValueType = dartTypeManager.defaultType;
        }
        let dartType = new DartMapDeclaration({ valueType: dartValueType, keyType: dartTypeManager.GetTypeByName('String') });
        dartTypeManager.AddNodeType(node, dartType);
        return dartType;
    }
    ScanType(name, typeNode) {
        switch (typeNode.kind) {
            case ts.SyntaxKind.ArrayType:
                {
                    return this.ScanArrayType(typeNode, name, typeNode.elementType);
                }
                break;
            case ts.SyntaxKind.TypeReference:
                let typeReferenceNode = typeNode;
                switch (typeReferenceNode.typeName.getText()) {
                    case 'Array': return this.ScanArrayType(typeReferenceNode, name, typeReferenceNode.typeArguments[0]);
                    case 'Promise': return this.ScanPromiseType(typeReferenceNode, name, typeReferenceNode.typeArguments[0]);
                }
                break;
            case ts.SyntaxKind.TypeLiteral: {
                let typeLiteralNode = typeNode;
                if (typeLiteralNode.members.length == 1 && typeLiteralNode.members[0].kind == ts.SyntaxKind.IndexSignature) {
                    return this.ScanMapType(typeLiteralNode, name, typeLiteralNode.members[0]);
                }
                return this.AddLiteralDeclaration(name, typeLiteralNode);
            }
            case ts.SyntaxKind.MappedType: {
                if (ts.isMappedTypeNode(typeNode)) {
                    return this.ScanMapTypeNode(typeNode, name, typeNode);
                }
            }
        }
        return this.manager.GetType(typeNode);
    }
    get fileName() {
        return path.basename(this.node.fileName, '.ts') + '.dart';
    }
    get className() {
        let name = path.basename(this.node.fileName, '.ts');
        name = name.replace('-', '_');
        return name[0].toUpperCase() + name.substr(1);
    }
    cloudToString() {
        if (this.classFunctions.length == 0) {
            return '';
        }
        return 'class ' + this.className + '{'
            + this.classFunctions.map(e => e.toString()).join('\n')
            + '\n}';
    }
    toString() {
        let packageName = this.manager.packageName;
        return this.imports.map(e => `import 'package:${e}';`).join('\n') +
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
            + this.cloudToString();
    }
}
class DartTypeManager {
    constructor(params) {
        this.types = {};
        this.defaultType = new DartPrimitive('dynamic');
        this.codeToType = {};
        this.files = [];
        this.packageName = params.packageName;
        this.AddTypes([
            new DartDate(),
            new DartPrimitive('num'),
            new DartPrimitive('String'),
            new DartPrimitive('bool'),
            this.defaultType
        ]);
    }
    AddFile(node) {
        let file = new DartFile({
            manager: this,
            node
        });
        this.files.push(file);
        return file;
    }
    RemoveUnusedFiles() {
        this.files = this.files.filter(e => e.classFunctions.length > 0);
        this.files.forEach(f => f.ClearUnavailableImport());
    }
    GetMapTypeDartText(prefix, typeNode) {
        return 'Map<' + this.GetTypeName(prefix, typeNode.parameters[0].type), +this.GetTypeName(prefix, typeNode.type) + '>';
    }
    GetArrayTypeDartText(prefix, typeNode) {
        return 'List<' + this.GetTypeName(prefix, typeNode.elementType) + '>';
    }
    GetReferenceTypeDartText(prefix, typeNode) {
        let typeText = typeNode.typeName.getText();
        switch (typeText) {
            case 'Date': return 'DateTime';
            case 'Array': return 'List<' + this.GetTypeName(prefix, typeNode.typeArguments[0]) + '>';
            case 'Promise': return 'Future<' + this.GetTypeName(prefix, typeNode.typeArguments[0]) + '>';
        }
        let dartType = this.GetTypeByName(typeText);
        if (dartType instanceof DartPrimitive) {
            return dartType.name;
        }
        return typeText;
        // console.error('Error ReferenceType To Dart '+typeText)
        // return 'dynamic'
    }
    GetTypeName(prefix, typeNode) {
        if (!typeNode) {
            return 'dynamic';
        }
        switch (typeNode.kind) {
            case ts.SyntaxKind.StringKeyword: return 'String';
            case ts.SyntaxKind.NumberKeyword: return 'num';
            case ts.SyntaxKind.BooleanKeyword: return 'bool';
            case ts.SyntaxKind.AnyKeyword: return 'dynamic';
            case ts.SyntaxKind.ObjectKeyword: return 'dynamic';
            case ts.SyntaxKind.ArrayType: return this.GetArrayTypeDartText(prefix, typeNode);
            case ts.SyntaxKind.TypeReference: return this.GetReferenceTypeDartText(prefix, typeNode);
            case ts.SyntaxKind.TypeLiteral: {
                let typeLiteralNode = typeNode;
                if (typeLiteralNode.members.length == 1 && typeLiteralNode.members[0].kind == ts.SyntaxKind.IndexSignature) {
                    return this.GetMapTypeDartText(prefix, typeLiteralNode.members[0]);
                }
                return prefix;
            }
            case ts.SyntaxKind.UnionType:
                if (ts.isUnionTypeNode(typeNode)) {
                    return GetUnionDartType(typeNode);
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
                    return 'Map<String,' + this.GetTypeName(prefix, typeNode.type) + '>';
                }
            }
        }
        console.error('Error Type To Dart ,kind ' + typeNode.kind + ' ' + typeNode.getSourceFile().fileName + ' ' + typeNode.pos + ' ' + typeNode.getText());
        return 'dynamic';
    }
    AddType(dartType, name) {
        this.types[name || dartType.name] = dartType;
    }
    AddNodeType(node, dartType) {
        this.types[dartType.name] = dartType;
        this.codeToType[node.getSourceFile().fileName + node.pos] = dartType;
    }
    AddTypes(dartTypes) {
        dartTypes.forEach(e => this.types[e.name] = e);
    }
    GetPropertyType(node) {
        // if(node.getText()=='type?: ActivityType')
        // if(node.getSourceFile().fileName=='check.ts'&&node.pos==1805)
        // {
        //     console.log('pause')
        // }
        let dartType = null;
        if (node.type) {
            dartType = this.codeToType[node.getSourceFile().fileName + node.type.pos];
        }
        if (!dartType) {
            dartType = this.GetType(node.type);
        }
        if (dartType) {
            return dartType;
        }
        console.error('Error Type To Dart GetEncoding  ' + node.getSourceFile().fileName + ' ' + node.pos + ' ' + node.getText());
        return this.defaultType;
    }
    GetType(node) {
        return this.types[this.GetTypeName('', node)];
    }
    GetTypeByName(type) {
        return this.types[type];
    }
    IndexFileBody() {
        return this.files.map(e => `import "package:${this.packageName}/lib/${e.fileName}" as _${e.className};`).join('\n')
            + '\n\n'
            + this.files.map(e => `final ${e.className} = new _${e.className}.${e.className}();`).join('\n');
    }
}
function GetUnionDartType(unionType) {
    if (unionType.types.every(e => {
        if (ts.isLiteralTypeNode(e)) {
            return e.literal.kind == ts.SyntaxKind.StringLiteral;
        }
    })) {
        return 'String';
    }
    else if (unionType.types.every(e => {
        if (ts.isLiteralTypeNode(e)) {
            return e.literal.kind == ts.SyntaxKind.NumericLiteral;
        }
    })) {
        return 'num';
    }
    else if (unionType.types.every(e => {
        if (ts.isLiteralTypeNode(e)) {
            let kind = e.literal.kind;
            return kind == ts.SyntaxKind.FalseKeyword || kind == ts.SyntaxKind.TrueKeyword || kind == ts.SyntaxKind.BooleanKeyword;
        }
    })) {
        return 'bool';
    }
    return 'dynamic';
}
function GetComment(node) {
    let sourceText = node.getSourceFile().getText();
    let range = ts.getLeadingCommentRanges(sourceText, node.getFullStart());
    if (!range) {
        return '';
    }
    let out = '\n' + range.map(e => sourceText.substring(e.pos, e.end)).join('\n');
    if (out && out[out.length - 1] != '\n') {
        out += '\n';
    }
    return out;
}
function IsExportDisabled(node) {
    return node.getFullText().includes('@lcc-export-disabled');
}
//https://github.com/Microsoft/TypeScript/wiki/Using-the-Compiler-API
//在线查看代码ast的工具 https://ts-ast-viewer.com/
function createSdkFile(file) {
    let sourceFile = file.node;
    let manager = file.manager;
    function scanNode(node) {
        switch (node.kind) {
            case ts.SyntaxKind.FunctionDeclaration:
                break;
            case ts.SyntaxKind.ExpressionStatement:
            case ts.SyntaxKind.IfStatement:
            case ts.SyntaxKind.ExportAssignment:
                break;
            case ts.SyntaxKind.TypeAliasDeclaration: {
                let typeAliasDeclaration = node;
                if (ts.isUnionTypeNode(typeAliasDeclaration.type)) {
                    manager.AddType(manager.GetTypeByName(GetUnionDartType(typeAliasDeclaration.type)), typeAliasDeclaration.name.getText());
                }
            }
            case ts.SyntaxKind.VariableStatement:
                break;
            case ts.SyntaxKind.ImportDeclaration:
                {
                    if (IsExportDisabled(node)) {
                        break;
                    }
                    const skipModuleNames = [
                        './cloud', './index', './base', 'bluebird', 'leancloud-cloud-decorator'
                    ];
                    let importDeclaration = node;
                    let moduleName = importDeclaration.moduleSpecifier.getText();
                    // console.log(moduleName.substring(1, moduleName.length - 1))
                    moduleName = moduleName.substring(1, moduleName.length - 1);
                    if (!moduleName.includes('..')
                        && !moduleName.includes('.json')
                        && !skipModuleNames.includes(moduleName)) {
                        if (moduleName.startsWith('./')) {
                            file.AddLocalImport(moduleName.substr(2));
                        }
                    }
                }
                break;
            case ts.SyntaxKind.ImportEqualsDeclaration:
                {
                    if (IsExportDisabled(node)) {
                        break;
                    }
                    let importEqualsDeclaration = node;
                    if (importEqualsDeclaration.moduleReference.kind == ts.SyntaxKind.QualifiedName) {
                    }
                    else {
                    }
                }
                break;
            case ts.SyntaxKind.EnumDeclaration:
                {
                    let enumNode = node;
                    file.AddEnumDeclaration(enumNode);
                }
                break;
            case ts.SyntaxKind.InterfaceDeclaration:
                {
                    if (IsExportDisabled(node)) {
                        break;
                    }
                    let interfaceNode = node;
                    file.AddInterfaceDeclaration(interfaceNode);
                }
                break;
            case ts.SyntaxKind.ClassDeclaration:
                {
                    if (IsExportDisabled(node)) {
                        break;
                    }
                    let classNode = node;
                    let needExport = true;
                    if (classNode.modifiers) {
                        if (classNode.modifiers.find(x => x.kind == ts.SyntaxKind.ExportKeyword)) {
                            needExport = false;
                        }
                    }
                    ts.forEachChild(node, scanNode);
                    if (classNode.name) {
                        let className = classNode.name.getText();
                        let instance = className[0].toLowerCase() + className.substr(1);
                        // exportText = `\nlet ${instance} = new ${className}()\nexport default ${instance}`
                    }
                }
                break;
            case ts.SyntaxKind.MethodDeclaration:
                {
                    if (IsExportDisabled(node)) {
                        break;
                    }
                    let methodNode = node;
                    let decorators = methodNode.decorators;
                    if (decorators) {
                        let needSkip = true;
                        for (let i = 0; i < decorators.length; ++i) {
                            // console.log(JSON.stringify(decorator))
                            let decorator = decorators[i].getText();
                            if (decorator.substring(0, 6) == '@Cloud') {
                                let platformText = cloudMetaData_1.PlatformString(decorator);
                                // console.log(paramsText)
                                let platforms = platformText && JSON.parse(platformText);
                                let rpcText = cloudMetaData_1.GetJsonValueString(decorator, 'rpc');
                                let rpc = rpcText && JSON.parse(rpcText);
                                let internalText = cloudMetaData_1.GetJsonValueString(decorator, 'internal');
                                let internal = internalText && JSON.parse(internalText);
                                needSkip = false;
                                if (!internal && (!platforms || platforms.length == 0)) {
                                    file.AddClassFunction(methodNode);
                                }
                                break;
                            }
                        }
                    }
                }
                break;
        }
    }
    ts.forEachChild(sourceFile, scanNode);
    return file;
}
function deleteFolderRecursive(path) {
    if (fs.existsSync(path)) {
        fs.readdirSync(path).forEach(function (file, index) {
            var curPath = path + "/" + file;
            if (fs.lstatSync(curPath).isDirectory()) { // recurse
                deleteFolderRecursive(curPath);
            }
            else { // delete file
                fs.unlinkSync(curPath);
            }
        });
        fs.rmdirSync(path);
    }
}
;
function createSdk(dir, exclude) {
    {
        let libPath = getSdkLibPath(targetPlatform);
        if (fs.existsSync(libPath)) {
            console.log('remove old files ' + libPath);
            deleteFolderRecursive(libPath);
        }
        fs.mkdirSync(libPath);
        fs.mkdirSync(libPath + '/lib');
    }
    // }
    let packageName = base_1.platforms[targetPlatform].package;
    let manager = new DartTypeManager({
        packageName
    });
    let indexFileText = '';
    // let dartFiles:DartFile[] = []
    for (let d = 0; d < dir.length; ++d) {
        let file = dir[d];
        if (path.extname(file) == '.ts' && exclude.indexOf(file) < 0) {
            console.log('read ' + file);
            let name = path.basename(file, '.ts');
            let sourceFile = ts.createSourceFile(file, fs_1.readFileSync(_dirroot + 'src/cloud/' + file).toString(), ts.ScriptTarget.ES2015, 
            /*setParentNodes */ true);
            //   console.log(printNode(sourceFile))
            createSdkFile(manager.AddFile(sourceFile));
        }
    }
    manager.RemoveUnusedFiles();
    manager.files.forEach(e => e.DeepScanMemebers());
    manager.files.forEach(e => {
        let libPath = getSdkLibPath(targetPlatform) + '/lib/' + e.fileName;
        console.log('write ' + libPath);
        fs.writeFileSync(libPath, e.toString());
    });
    let indexPath = getSdkLibPath(targetPlatform) + '/index.dart';
    console.log('write ' + 'index.dart');
    fs.writeFileSync(indexPath, `import "package:${packageName}/info.dart" as sdkInfo;
import "package:leancloud_dart/cloudfunction.dart";
`
        + manager.IndexFileBody()
        + `  
void Init({String clientVersion}){
    Cloud.SetAPIInfo(sdkInfo.platform, sdkInfo.apiVersion, clientVersion);
}
`);
}
// let targetPlatform = CheckPlatform( process.argv[2] )
let _dirroot = '/Users/zhilongchen/home/muyue/pteai-node-ts2/';
function getSdkLibPath(platform) {
    return _dirroot + 'release/api/' + platform + '/lib';
}
let targetPlatform = 'dart';
let moduleMap = {}; //GetModuleMap(targetPlatform)
moduleMap['leanengine'] = moduleMap['leanengine'] || moduleMap['leancloud-storage'] || 'leancloud-storage';
const exclude = ['cloud.ts', 'index.ts', 'base.ts'];
function CreatDartSdk(params) {
    targetPlatform = params.platform;
    _dirroot = params.dirroot;
    console.log('build typescript sdk....');
    let dir = fs.readdirSync(_dirroot + 'src/cloud/');
    createSdk(dir, exclude);
}
exports.CreatDartSdk = CreatDartSdk;
//# sourceMappingURL=buildDartSdk.js.map