import { readFileSync } from "fs";
import * as fs from "fs";
import * as ts from "typescript";
import * as path from 'path'
import { Platform,CheckPlatform, GetModuleMap } from './base'
import { PlatformString,GetJsonValueString } from './cloudMetaData'

interface DartType{
    encoding(variable:string):string
    decoding(variable:string):string
    readonly name:string
}
class DartArrayDeclaration implements DartType{
    encoding(variable: string): string {
        if(this.elementType instanceof DartPrimitive){
            return variable
        }
        return `${variable}.map((a)=> ${this.elementType.encoding('a')} )`
    }
    decoding(variable: string): string {
        if(this.elementType instanceof DartPrimitive){
            return variable
        }
        return `${variable}.map((a) => ${this.elementType.decoding('b')} )`
    }
    get name():string{
        return "List<"+this.elementType.name+">"
    }
    constructor(params:{elementType:DartType}){
        this.elementType = params.elementType
    }
    elementType:DartType
}
class DartMapDeclaration implements DartType{
    encoding(variable: string): string {
        if(this.valueType instanceof DartPrimitive){
            return variable
        }
        return `${variable}.map((a, b) => MapEntry(a, ${this.valueType.encoding('b')} ))`
    }
    decoding(variable: string): string {
        if(this.valueType instanceof DartPrimitive){
            return variable
        }
        return `${variable}.map((a, b) => MapEntry(a, ${this.valueType.decoding('b')} ))`
    }
    get name():string{
        return "Map<"+this.keyType.name+","+this.valueType.name+">"
    }
    constructor(params:{keyType:DartType,valueType:DartType}){
        this.keyType = params.keyType
        this.valueType = params.valueType
    }
    keyType:DartType
    valueType:DartType
}
abstract class DartDeclaration implements DartType{
    abstract encoding(variable: string): string 
    abstract decoding(variable: string): string 
    constructor(params:{
        // name:string,
        node:ts.InterfaceDeclaration|ts.TypeLiteralNode|ts.EnumDeclaration,
        file:DartFile}){
        // this.name = params.name
        this.node = params.node
        this.file = params.file
    }
    readonly abstract name:string
    file:DartFile
    node:ts.InterfaceDeclaration|ts.TypeLiteralNode|ts.EnumDeclaration
}
class DartPrimitive implements DartType {
    constructor(name:string){
        this.name = name
    }
    encoding(variable: string): string {
        return variable;
    }
    readonly name:string
    decoding(variable: string): string {
        return variable
    }
}

//todo:
class DartDate implements DartType {
    encoding(variable: string): string {
        return variable;
    }
    readonly name = 'DateTime'
    decoding(variable: string): string {
        return variable
    }
}
class DartInterface extends DartDeclaration{
    constructor(params:{
        name:string,
        node:ts.InterfaceDeclaration|ts.TypeLiteralNode,
        file:DartFile}){
            super(params)
            this.name = params.name
        }
    readonly name:string
    encoding(variable: string): string {
        return variable+'.toMap()'
    }
    decoding(variable: string): string {
        return `${this.name}.fromMap(${variable})`
    }
    DeepScanMemebers(){
        this.node.members?.forEach(e=>this.ScanElement(e))
    }

    private ScanElement(element:ts.PropertySignature | ts.IndexSignatureDeclaration){
        let typeNode = element.type
        if(this.name=='GetWebPayQRParams'){
            console.log('pause')
        }
        if(typeNode){
            if(element.name){
                this.ScanType(this.name+'_'+getMemberName(element.name.getText()),typeNode)
            }else{
                this.ScanType(this.name,typeNode)
            }
        }
    }
    private ScanArrayType(node:ts.TypeReferenceNode|ts.ArrayTypeNode,name:string,elementType:ts.TypeNode){
        let dartTypeManager = this.file.manager
        let dartElementType = dartTypeManager.GetType(elementType)
        if(!dartElementType){
            dartElementType = this.ScanType(name,elementType)
        }
        if(!dartElementType){
            dartElementType = dartTypeManager.defaultType
        }
        let dartArray = new DartArrayDeclaration({elementType:dartElementType})
        dartTypeManager.AddNodeType(node,dartArray)
        return dartArray
    }
    private ScanMapType(node:ts.TypeLiteralNode, name:string,indexSignature:ts.IndexSignatureDeclaration){
        let dartTypeManager = this.file.manager
        let valueType = indexSignature.type
        let dartValueType = dartTypeManager.GetType(valueType)
        if(!dartValueType){
            dartValueType = this.ScanType(name,dartValueType)
        }
        if(!dartValueType){
            dartValueType = dartTypeManager.defaultType
        }
        let dartType = new DartMapDeclaration({valueType:dartValueType,keyType:dartTypeManager.GetType(indexSignature.parameters[0].type)})
        dartTypeManager.AddNodeType(node,dartType)
        return dartType
    }
    private ScanMapTypeNode(node:ts.MappedTypeNode, name:string,mappedTypeNode:ts.MappedTypeNode){
        let dartTypeManager = this.file.manager
        let valueType = mappedTypeNode.type
        let dartValueType = dartTypeManager.GetType(valueType)
        if(!dartValueType){
            dartValueType = this.ScanType(name,dartValueType)
        }
        if(!dartValueType){
            dartValueType = dartTypeManager.defaultType
        }
        let dartType = new DartMapDeclaration({valueType:dartValueType,keyType:dartTypeManager.GetTypeByName('String')})
        dartTypeManager.AddNodeType(node,dartType)
        return dartType
    }
    private ScanType(name:string,typeNode:ts.TypeNode):DartType{
        switch(typeNode.kind){
            case ts.SyntaxKind.ArrayType: {
                return this.ScanArrayType(typeNode as ts.ArrayTypeNode, name, (typeNode as ts.ArrayTypeNode).elementType )
            }
            break
            case ts.SyntaxKind.TypeReference:
                let typeReferenceNode =(typeNode as ts.TypeReferenceNode)
                if(typeReferenceNode.typeName.getText()=='Array'){
                    return this.ScanArrayType(typeReferenceNode, name, typeReferenceNode.typeArguments![0] )
                }
                break
            case ts.SyntaxKind.TypeLiteral: {
                let typeLiteralNode = typeNode as ts.TypeLiteralNode
                if(typeLiteralNode.members.length==1&&typeLiteralNode.members[0].kind==ts.SyntaxKind.IndexSignature){
                    return this.ScanMapType(typeLiteralNode, name,typeLiteralNode.members[0] as ts.IndexSignatureDeclaration)
                }
                return this.file.AddLiteralDeclaration(name,typeLiteralNode)
            }
            case ts.SyntaxKind.MappedType:{
                if(ts.isMappedTypeNode(typeNode)){
                    return this.ScanMapTypeNode(typeNode, name,typeNode)
                }
            }
        }
        return  this.file.manager.GetType(typeNode)
    }

    toString():string{
        const indent = '\n    '
        const indent2 = indent+indent.substr(1)
        let members = this.node.members as ts.NodeArray<ts.PropertySignature>
        let dartTypeManager = this.file.manager
        return `class ${this.name}`
        + '\n{\n'
        + members.map(e=>indent+dartTypeManager.GetPropertyType(e).name+' '+ getMemberName(e.name.getText())+';').join('\n')
        + indent+this.name+'.fromMap(Map<String, dynamic> data){\n'
        + members.map(e=>indent2 + `if(data["${getJsonKey(e.name.getText())}"!=null]) this.${getMemberName(e.name.getText())}=${dartTypeManager.GetPropertyType(e).encoding('data["'+getJsonKey(e.name.getText())+'"]')};`).join('\n')
        + indent+'}'
        + indent+'Map<String, dynamic> toMap(){'
        + indent2 + 'return{'
        + members.map(e=>indent2 + `"${getJsonKey(e.name.getText())}":${dartTypeManager.GetPropertyType(e).encoding(getMemberName(e.name.getText()))}`).join(',\n')
        + indent2 + '};'
        + indent+'}'
        +'\n}'
    }
}

function getJsonKey(name:string){
    if(name.startsWith("'") || name.startsWith('"')){
        name = name.substr(1,name.length-2)
    }
    return name
}

function getMemberName(name:string){
    if(name=='class'){
        return 'className'
    }
    if(name.startsWith("'") || name.startsWith('"')){
        name = name.substr(1,name.length-2)
    }
    if(name.includes('-')){
        return name.replace('-',"_")
    }
    if(parseInt(name)!=NaN){
        return 'num'+name
    }
    return name
}
class DartEnum extends DartDeclaration {
    constructor(params:{
        name:string,
        node:ts.EnumDeclaration,
        file:DartFile}){
            super(params)
            this.name = params.name
        }
    readonly name:string
    encoding(variable: string): string {
        return `${this.name}_encoding(${variable})`
    }
    decoding(variable: string): string {
        return `${this.name}_decoding(${variable})`
    }

    toString():string{
        const indent = '\n    '
        let members = this.node.members as ts.NodeArray<ts.EnumMember>
        let dartTypeManager = this.file.manager
        return `enum ${this.name}{`
        + members.map(e=>indent+e.name.getText()).join(',\n')
        +'\n}'
        + `\n${this.name} ${this.name}_decoding(dynamic value){`
        + indent+`var text = dynamic.toString();`
        + members.map(e=>indent+`if(text=="${e.initializer!.getText()}") return ${this.name}.${e.name.getText()};`).join('\n')
        + indent+'return null;'
        + '\n}'
        + `\ndynamic ${this.name}_encoding(${this.name} value){`
        + members.map(e=>indent+`if(value==${this.name}.${e.name.getText()}) return ${
            e.initializer!.kind==ts.SyntaxKind.StringLiteral?
            ('"'+e.initializer!.getText()+'"'):
            e.initializer!.getText()
        }`).map(e=>e+';').join('\n')
        + indent+'return null;'
        + '\n}'
    }
}

class DartTypeManager{
    types:{[key:string]:DartType} = {}
    defaultType = new DartPrimitive('dynamic')
    codeToType:{[key:string]:DartType} = {}
    packageName:string
    constructor(params:{packageName:string}){
        this.packageName = params.packageName
        this.AddTypes([
            new DartDate(),
            new DartPrimitive('num'),
            new DartPrimitive('String'),
            new DartPrimitive('bool'),
            this.defaultType
        ])
    }
    
    private GetMapTypeDartText(prefix:string,typeNode:ts.IndexSignatureDeclaration):string{
        return 'Map<'+this.GetTypeName(prefix,typeNode.parameters[0].type),+this.GetTypeName(prefix,typeNode.type)+'>'
    }
    
    private GetArrayTypeDartText(prefix:string,typeNode:ts.ArrayTypeNode):string{
        return 'List<'+this.GetTypeName(prefix,typeNode.elementType)+'>'
    }

    private GetReferenceTypeDartText(prefix:string,typeNode:ts.TypeReferenceNode):string{
        let typeText = typeNode.typeName.getText()
        switch(typeText){
            case 'Date': return 'DateTime';
            case 'Array': return 'List<'+this.GetTypeName(prefix,typeNode.typeArguments![0])+'>'
        }
        let dartType = this.GetTypeByName(typeText)
        if(dartType instanceof DartPrimitive){
            return dartType.name
        }
        return typeText
        // console.error('Error ReferenceType To Dart '+typeText)
        // return 'dynamic'
    }

    GetTypeName(prefix:string,typeNode?:ts.TypeNode){
        if(!typeNode){
            return 'dynamic'
        }
        switch(typeNode.kind){
            case ts.SyntaxKind.StringKeyword: return 'String';
            case ts.SyntaxKind.NumberKeyword: return 'num';
            case ts.SyntaxKind.BooleanKeyword: return 'bool';
            case ts.SyntaxKind.AnyKeyword: return 'dynamic';
            case ts.SyntaxKind.ObjectKeyword: return 'dynamic';
            case ts.SyntaxKind.ArrayType: return this.GetArrayTypeDartText(prefix,typeNode as ts.ArrayTypeNode);
            case ts.SyntaxKind.TypeReference: return this.GetReferenceTypeDartText(prefix,typeNode as ts.TypeReferenceNode);
            case ts.SyntaxKind.TypeLiteral: {
                let typeLiteralNode = typeNode as ts.TypeLiteralNode
                if(typeLiteralNode.members.length==1&&typeLiteralNode.members[0].kind==ts.SyntaxKind.IndexSignature){
                    return this.GetMapTypeDartText(prefix, typeLiteralNode.members[0] as ts.IndexSignatureDeclaration)
                }
                return prefix
            }
            case ts.SyntaxKind.UnionType:
                if(ts.isUnionTypeNode(typeNode)){
                    return GetUnionDartType(typeNode)
                }
            case ts.SyntaxKind.LiteralType:{
                if(ts.isLiteralTypeNode(typeNode)){
                    switch(typeNode.literal.kind){
                        case ts.SyntaxKind.StringLiteral: return 'String';
                        case ts.SyntaxKind.NumericLiteral: return 'num';
                        case ts.SyntaxKind.FalseKeyword: 
                        case ts.SyntaxKind.TrueKeyword: 
                        return 'num';
                    }
                }
            }
            case ts.SyntaxKind.MappedType:{
                if(ts.isMappedTypeNode(typeNode)){
                    return 'Map<String,'+this.GetTypeName(prefix,typeNode.type)+'>'
                }
            }
        }
        console.error('Error Type To Dart ,kind '+typeNode.kind + ' ' + typeNode.getSourceFile().fileName+' '+typeNode.pos +' '+typeNode.getText())
        return 'dynamic'
    }

    AddType(dartType:DartType,name?:string){
        this.types[name||dartType.name] = dartType
    }
    AddNodeType(node :ts.TypeLiteralNode|ts.TypeReferenceNode|ts.ArrayTypeNode|ts.MappedTypeNode, dartType:DartType){
        this.types[dartType.name] = dartType
        this.codeToType[ node.getSourceFile().fileName+node.pos ] = dartType
    }

    AddTypes(dartTypes:DartType[]){
        dartTypes.forEach(e=>this.types[e.name]=e)
    }

    GetPropertyType(node:ts.PropertySignature){
        // if(node.getText()=='type?: ActivityType')
        if(node.getSourceFile().fileName=='check.ts'&&node.pos==1805)
        {
            console.log('pause')
        }
        let dartType:DartType | null = null
        if(node.type){
            dartType = this.codeToType[ node.getSourceFile().fileName+node.type.pos ]
        }
        if(!dartType){
            dartType = this.GetType(node.type)
        }
        if(dartType){
            return dartType
        }
        console.error('Error Type To Dart GetEncoding  ' + node.getSourceFile().fileName+' '+node.pos+' '+node.getText())
        return this.defaultType
    }
    GetType(node?:ts.TypeNode){
        return this.types[ this.GetTypeName('',node) ]
    }
    GetTypeByName(type:string){
        return this.types[ type]
    }
    // GetEncoding(type:ts.PropertySignature, variable:string):string{
    //     let dartType = this.types[type]
    //     if(dartType){
    //         return dartType.encoding(variable)
    //     }
    //     console.error('Error Type To Dart GetEncoding  '+type)
    //     return variable
    // }
    // GetDecoding(type:ts.PropertySignature, variable:string):string{
    //     let dartType = this.types[type]
    //     if(dartType){
    //         return dartType.decoding(variable)
    //     }
    //     console.error('Error Type To Dart GetEncoding  '+type)
    //     return variable
    // }
}

class DartFile{
    manager:DartTypeManager
    node:ts.SourceFile
    // nodePath:string
    // dartPath:string
    imports:string[] = []
    interfaces:DartInterface[] = []
    literals:DartInterface[] = []
    enums:DartEnum[] = []
    constructor(params:{
        manager:DartTypeManager
        node:ts.SourceFile}){
            this.manager = params.manager
            this.node = params.node
        }

    DeepScanMemebers(){
        this.interfaces.forEach(e=>e.DeepScanMemebers())
    }
    AddInterfaceDeclaration(typeNode:ts.InterfaceDeclaration){
        let declaration = new DartInterface({
            name:typeNode.name.getText(),
            node:typeNode,
            file:this
        })
        this.interfaces.push(declaration)
        this.manager.AddType(declaration)
        // declaration.DeepScanMemebers()
        return declaration
    }
    AddLiteralDeclaration(name:string,typeNode:ts.TypeLiteralNode){
        let declaration = new DartInterface({
            name:name,
            node:typeNode,
            file:this
        })
        this.literals.push(declaration)
        this.manager.AddNodeType(typeNode,declaration)
        declaration.DeepScanMemebers()
        return declaration
    }
    AddEnumDeclaration(typeNode:ts.EnumDeclaration){
        let declaration = new DartEnum({
            name:typeNode.name.getText(),
            node:typeNode,
            file:this
        })
        this.enums.push(declaration)
        this.manager.AddType(declaration)
        return declaration
    }
    AddImport(){

    }

    get fileName(){
        return path.basename(this.node.fileName,'.ts')+'.dart'
    }

    toString():string{
        return `
/**
 * automatic generated from typescript TypeLiteral
 */
`
        +this.literals.map(e=>e.toString()).join('\n') +
`
/**
 * automatic generated from typescript interface
 */
`
        +this.interfaces.map(e=>e.toString()).join('\n') +
`
/**
 * automatic generated from typescript enum
 */
`
    +this.enums.map(e=>e.toString()).join('\n') 
    }
}

function GetUnionDartType(unionType:ts.UnionTypeNode) {
    if(unionType.types.every(e=>{
        if(ts.isLiteralTypeNode(e)){
            return e.literal.kind == ts.SyntaxKind.StringLiteral
        }
    })) {
        return 'String'
    }else if(unionType.types.every(e=>{
        if(ts.isLiteralTypeNode(e)){
            return e.literal.kind == ts.SyntaxKind.NumericLiteral
        }
    })){
        return 'num'
    }else if(unionType.types.every(e=>{
        if(ts.isLiteralTypeNode(e)){
            let kind = e.literal.kind
            return  kind== ts.SyntaxKind.FalseKeyword || kind == ts.SyntaxKind.TrueKeyword || kind == ts.SyntaxKind.BooleanKeyword 
        }
    })){
        return 'bool'
    }
    return 'dynamic'
}

function getFunctionName(node:ts.MethodDeclaration){

    let classNode = <ts.ClassLikeDeclaration>node.parent
    if(!classNode.name || ! node.name)
        throw new Error('missing classNode.name or node.name')
    let functionName = classNode.name.getText() +'.'+ node.name.getText()
    return functionName
}

function createCloudRunText(node:ts.MethodDeclaration,method = 'run'){
    let functionName = getFunctionName(node)
    if(node.parameters.length>0){
        let parameterName = node.parameters[0].name.getText()
        return `{return API.${method}('${functionName}',${parameterName}) }`
    }
    return `{return  API.${method}('${functionName}') }`
}

function IsInternalName(node:{name?:ts.Identifier}){
    return node.name && node.name.escapedText.toString().startsWith('_')
}

function GetImportName(importSpecifier:ts.ImportSpecifier){
    return ((importSpecifier.propertyName && (importSpecifier.propertyName.escapedText.toString()+' as '))||'')
        + importSpecifier.name.escapedText.toString()
}

function IsExportDisabled(node:ts.Node){
    return node.getFullText().includes('@lcc-export-disabled')
}

//https://github.com/Microsoft/TypeScript/wiki/Using-the-Compiler-API
//在线查看代码ast的工具 https://ts-ast-viewer.com/
function createSdkFile(sourceFile: ts.SourceFile,manager:DartTypeManager){

    let file = new DartFile({
        manager,
        node:sourceFile
    })
    let results:string[] = []
    let lastPositions:number[] = [];
    let exportText = ''
    // for(let i=0;i<Object.keys(Platform).length;++i){
        results.push(
            "import * as API from '..'\n"
            + "export interface CloudParams{ noCache?: boolean; \n adminId ?: string; }\n"
        )
        lastPositions.push(0)
    // }
    // let resultText = ''
    let sourceText = sourceFile.text
    function skipNode(nodeStart: ts.Node,nodeEnd: ts.Node,platform:number){
        skipText(nodeStart.getFullStart(), (nodeEnd||nodeStart).getEnd(),platform)
    }

    function skipAllNode(nodeStart: ts.Node,nodeEnd?: ts.Node){
        skipAllText(nodeStart.getFullStart(), (nodeEnd||nodeStart).getEnd())
        // skipText(nodeStart.getFullStart(), (nodeEnd||nodeStart).getEnd())
    }
    function skipAllText(start:number,end:number){
        let i = 0
        // for(let i=0;i<Object.keys(Platform).length;++i){
            skipText(start,end,i)
        // }
    }
    function skipText(start:number,end:number,platform:number){
        let text = sourceText.substring(lastPositions[platform], start)
        // console.log(Platform[platform])
        // console.log(lastPositions[platform]+"-" +start+"->" + text+'=>'+start)
        results[platform] += text
        lastPositions[platform] = end;
        // console.log('results:')
        // console.log(results[platform])
    }
    function appendText(text:string,platform:number){
        results[platform]+=text
    }
    function scanNode(node: ts.Node) {
        switch (node.kind){
            case ts.SyntaxKind.FunctionDeclaration:
                {
                    if(IsExportDisabled(node)){
                        skipAllNode(node)
                        break
                    }
                    let functionDeclaration = <ts.FunctionDeclaration>node
                    if(!IsInternalName(functionDeclaration) && functionDeclaration.modifiers && functionDeclaration.modifiers.find(e=>e.kind == ts.SyntaxKind.ExportKeyword)){

                    }else{
                        skipAllNode(node)
                    }
                }
                break;
            case ts.SyntaxKind.ExpressionStatement:
            case ts.SyntaxKind.IfStatement:
            case ts.SyntaxKind.ExportAssignment:
                skipAllNode(node)
            break
            case ts.SyntaxKind.TypeAliasDeclaration:{
                let typeAliasDeclaration = node as ts.TypeAliasDeclaration
                if(ts.isUnionTypeNode(typeAliasDeclaration.type)){
                    manager.AddType( manager.GetTypeByName(GetUnionDartType(typeAliasDeclaration.type)),typeAliasDeclaration.name.getText()) 
                }
            }
            case ts.SyntaxKind.VariableStatement:
                {
                    if(IsExportDisabled(node)){
                        skipAllNode(node)
                        break
                    }
                    let declaration = <ts.Node>node
                    if(declaration.modifiers && declaration.modifiers.find(e=>e.kind == ts.SyntaxKind.ExportKeyword)){

                    }else{
                        skipAllNode(node)
                    }
                }
            break
            case ts.SyntaxKind.ImportDeclaration:
                {
                    if(IsExportDisabled(node)){
                        skipAllNode(node)
                        break
                    }
                    const skipModuleNames = [
                        './cloud', './index','./base','bluebird' ,'leancloud-cloud-decorator'
                    ]
                    let importDeclaration = <ts.ImportDeclaration>node
                    let moduleName = importDeclaration.moduleSpecifier.getText()
                    // console.log(moduleName.substring(1, moduleName.length - 1))
                    moduleName = moduleName.substring(1, moduleName.length - 1)
                    if (!moduleName.includes('..')
                    && !moduleName.includes('.json') 
                    && !skipModuleNames.includes(moduleName)) {
                        let importClause = importDeclaration.importClause
                        if(importClause){
                            let text = ''

                            if(!node.getText().includes('_')){
                                text = node.getText()
                                if(moduleMap[moduleName]) {
                                    text = text.replace(moduleName,moduleMap[moduleName])
                                }
                            }
                            else{
                                //去除_开头的引用项目
                                if(importClause.name&&!IsInternalName(importClause)){
                                    text+=importClause.name.escapedText.toString()
                                }
                                let namedImports = <ts.NamedImports>importClause.namedBindings
                                if(namedImports&&namedImports.elements){
                                    let names = namedImports.elements.filter(e=>!IsInternalName(e)).map(e=>GetImportName( e ))
                                    if(names.length>0){
                                        text+=((text&&', ')||'')+`{ ${names.join(', ')} }`
                                    }
                                }
                                if(text){
                                    let moduleName2 = moduleMap[moduleName] || moduleName
                                    text=`import ${text} from '${moduleName2}'`
                                }
                            }

                            // for (let i = 0; i < Object.keys(Platform).length; ++i) 
                            {
                                let i = 0
                                appendText(text + '\n', i)
                            }
                        }
                    }
                    skipAllNode(node)
                }
            break
            case ts.SyntaxKind.ImportEqualsDeclaration:
                {
                    if(IsExportDisabled(node)){
                        skipAllNode(node)
                        break
                    }
                    let importEqualsDeclaration = <ts.ImportEqualsDeclaration>node
                    if(importEqualsDeclaration.moduleReference.kind==ts.SyntaxKind.QualifiedName){

                    }else{
                        skipAllNode(node)
                    }
                    // let moduleName = (<ts.ExternalModuleReference>importEqualsDeclaration.moduleReference).expression.getText()
                    // let importName = importEqualsDeclaration.name.getText()
                    // // console.log(moduleName)
                    // if (moduleName[1] != '.') {
                    //     let importText = `import * as ${importName} from ${moduleName}`
                    //     for (let i = 0; i < Platform.count; ++i) {
                    //         // appendText(node.getText() + '\n', i)
                    //         appendText(importText + '\n', i)
                    //     }
                    // }
                }
            break
            case ts.SyntaxKind.EnumDeclaration:{
                let enumNode = <ts.EnumDeclaration>node
                file.AddEnumDeclaration(enumNode)
            }
            break
            case ts.SyntaxKind.InterfaceDeclaration:
            {
                if(IsExportDisabled(node)){
                    skipAllNode(node)
                    break
                }
                let interfaceNode = <ts.InterfaceDeclaration>node
                //是否需要增加 export
                let needExport = true
                // if(interfaceNode.modifiers){
                //     if(interfaceNode.modifiers.find(x=>x.kind==ts.SyntaxKind.ExportKeyword)){
                //         needExport = false
                //     }
                // }
                if(needExport){
                    file.AddInterfaceDeclaration(interfaceNode)
                    // for(let i=0;i<Object.keys(Platform).length;++i)
                    {
                        let i = 0
                        skipText(interfaceNode.getStart(),interfaceNode.getStart(),i)
                        //增加 export 标示
                        appendText('export ',i)
                    }
                }

            }
            break
            case ts.SyntaxKind.ClassDeclaration:
            {
                if(IsExportDisabled(node)){
                    skipAllNode(node)
                    break
                }
                let classNode = <ts.ClassDeclaration>node
                let needExport = true
                if(classNode.modifiers){
                    if(classNode.modifiers.find(x=>x.kind==ts.SyntaxKind.ExportKeyword)){
                        needExport = false
                    }
                }
                if(needExport){
                    // for(let i=0;i<Object.keys(Platform).length;++i)
                    {
                        let i=0
                        skipText(classNode.getStart(),classNode.getStart(),i)
                        appendText('export ',i)
                    }
                }
                ts.forEachChild(node, scanNode)
                if(classNode.name){
                    let className:string = classNode.name.getText()
                    let instance = className[0].toLowerCase()+className.substr(1)
                    exportText = `\nlet ${instance} = new ${className}()\nexport default ${instance}`
                }
            }
            break
            case ts.SyntaxKind.MethodDeclaration:
            {
                if(IsExportDisabled(node)){
                    skipAllNode(node)
                    break
                }
                let methodNode = <ts.MethodDeclaration>node
                let decorators= methodNode.decorators
                if(decorators)
                {
                    let needSkip = true;
                    for(let i=0;i<decorators.length;++i){
                        // console.log(JSON.stringify(decorator))
                        let decorator = decorators[i].getText()
                        if(decorator.substring(0,6)=='@Cloud')
                        {
                            // let sandbox = {
                            //     result :{platforms:[],rpc:false},
                            //     Platform:Platform
                            // }
                            // vm.createContext(sandbox); // Contextify the sandbox.
                            // let cloudFunction = decorator.substring(1)
                            // let genericIndex = cloudFunction.indexOf('Cloud<')
                            // if (genericIndex >= 0) {
                            //     cloudFunction = 'Cloud' + cloudFunction.substring(cloudFunction.indexOf('>')+1)
                            // }
                            // let code = 'function Cloud(p){result = p} '+ cloudFunction
                            // vm.runInContext(code, sandbox);

                            let platformText = PlatformString(decorator)
                            // console.log(paramsText)
                            let platforms = platformText && JSON.parse(platformText)
                            let rpcText = GetJsonValueString(decorator, 'rpc')
                            let rpc = rpcText && JSON.parse(rpcText)
                            let internalText = GetJsonValueString(decorator, 'internal')
                            let internal = internalText && JSON.parse(internalText)

                            needSkip = false;
                            // let parameters = sandbox.result || {}
                            // let platforms:string[] = parameters.platforms
                            // let keys = Object.keys(Platform)
                            // for (let i = 0; i < keys.length; ++i) 
                            {
                                // let s = keys[i].replace('_', '-')
                                // let s = targetPlatform.replace('_', '-')
                                if (internal || (platforms && !platforms.includes(targetPlatform))){
                                    skipNode(node,node,i)
                                }else if(methodNode.body){
                                    skipText(decorators[0].getStart(),decorators[decorators.length-1].getEnd(),i)
                                    skipNode(methodNode.body,methodNode.body,i)
                                    appendText(createCloudRunText(methodNode,rpc?'rpc':'run'),i)
                                }
                            }
                            break
                        }
                    }
                    if(needSkip)
                        skipAllNode(node)
                }
                else
                    skipAllNode(node)
            }
            break
        }
    }
    ts.forEachChild(sourceFile, scanNode);
    return file
    // if(!exportText)
    //     return null
    // // for(let i=0;i<Object.keys(Platform).length;++i){
    //     let i=0
    //     appendText(exportText,i)
    //     results[i] += sourceText.substring(lastPositions[i], sourceFile.getEnd())
    // // }
    // return results;
}

function deleteFolderRecursive(path:string) {
    if (fs.existsSync(path)) {
      fs.readdirSync(path).forEach(function(file, index){
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

// const _dirroot = __dirname+'/../../../'
const _dirroot = '/Users/zhilongchen/home/muyue/pteai-node-ts2/'
function getSdkLibPath(platform:Platform){
    return _dirroot + 'release/api/'+platform+'/lib'
}



function createSdk(dir:string[],exclude:string[]){

    // for(let i=0;i<Platform.count;++i){
    //     if(!fs.existsSync(getSdkLibPath(i))){
    //         fs.mkdirSync(getSdkLibPath(i))
    //     }
    // }

    // for (let i = 0; i < Platform.count; ++i) {
    // for(let i in Platform){
        let i=0
        // if (!targetPlatform || targetPlatform == getSdkFolderName(targetPlatform)) 
        {
            let libPath = getSdkLibPath(targetPlatform)
            if (fs.existsSync(libPath)) {
                console.log('remove old files ' + libPath)
                deleteFolderRecursive(libPath)
            }
            fs.mkdirSync(libPath)
        }
    // }

    let manager = new DartTypeManager({
        packageName:'package:pteapp_app'
    })
    let indexFileText = ''
    let dartFiles:DartFile[] = []
    for(let d=0;d<dir.length;++d){
        let file = dir[d]
        if( path.extname(file)=='.ts' && exclude.indexOf(file)<0){
            console.log('read '+file)
            let name = path.basename(file,'.ts')
            let sourceFile = ts.createSourceFile(
                file,
                readFileSync(_dirroot + 'src/cloud/'+file).toString(),
                ts.ScriptTarget.ES2015,
                /*setParentNodes */ true
            );
            //   console.log(printNode(sourceFile))
            var dartFile = createSdkFile(sourceFile,manager)
            dartFiles.push(dartFile)
            // if(sdks){
            //     // for (let i = 0; i < Platform.count; ++i) {
            //     // let keys = Object.keys(Platform)
            //     // for(let i in Platform){
            //     // for (let i = 0; i < keys.length; ++i) 
            //     {
            //         let i=0
            //         // if (!targetPlatform || targetPlatform == getSdkFolderName(keys[i] as Platform)) 
            //         {
            //             if (fs.existsSync(getSdkLibPath(targetPlatform))) {
            //                 let libPath = getSdkLibPath(targetPlatform) + '/' + file
            //                 console.log('write ' + libPath)
            //                 fs.writeFileSync(libPath, sdks[i])
            //             }
            //         }
            //     }
            //     let moduleName = name.charAt(0).toUpperCase() + name.slice(1)
            //     indexFileText += `import ${name} from './${name}'\n`
            //     indexFileText += `export { ${name} as ${moduleName} }\n`
            //     indexFileText += `import * as ${moduleName}__ from './${name}'\n`
            //     indexFileText += `export { ${moduleName}__  }\n`
            // }
    
        }
    }
    dartFiles.forEach(e=>e.DeepScanMemebers())
    dartFiles.forEach(e=>{
        let libPath = getSdkLibPath(targetPlatform) + '/' + e.fileName
        console.log('write ' + libPath)
        fs.writeFileSync(libPath, e.toString())
    })
    // for (let i = 0; i < Platform.count; ++i) {
    // for(let i in Platform)
    // {
    //     // if (!targetPlatform || targetPlatform == getSdkFolderName(targetPlatform)) 
    //     {
    //         if (fs.existsSync(getSdkLibPath(targetPlatform))) {
    //             let libPath = getSdkLibPath(targetPlatform) + '/index.ts'
    //             console.log('write ' + libPath)
    //             fs.writeFileSync(libPath, indexFileText)
    //         }
    //     }
    // }
}

// let targetPlatform = CheckPlatform( process.argv[2] )
let targetPlatform = 'dart'
let moduleMap = {}//GetModuleMap(targetPlatform)
moduleMap['leanengine'] = moduleMap['leanengine'] || moduleMap['leancloud-storage'] || 'leancloud-storage'
import { exec ,spawn} from 'child_process';
import e = require("express");
import { string } from "joi";
// console.log('clear last build....')
// clearOldBuild()
const exclude = ['cloud.ts', 'index.ts','base.ts']
let dir = fs.readdirSync(_dirroot + 'src/cloud/')
console.log('build typescript sdk....')
createSdk(dir,exclude)
