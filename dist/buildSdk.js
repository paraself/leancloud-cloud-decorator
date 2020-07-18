#!/usr/bin/env node
"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
require('source-map-support').install();
const fs_1 = require("fs");
const fs = __importStar(require("fs"));
const ts = __importStar(require("typescript"));
const path = __importStar(require("path"));
const base_1 = require("./base");
const cloudMetaData_1 = require("./cloudMetaData");
const buildDartSdk_1 = require("./buildDartSdk");
// import * as vm from 'vm'
// require('./cloud/index')
function printNode(sourceFile) {
    let resultText = '';
    var deep = 0;
    function scanNode(node) {
        var space = '';
        for (var i = 0; i < deep; ++i)
            space += ' ';
        console.log(space + deep + '.' + ts.SyntaxKind[node.kind]);
        console.log(space + node.getText());
        console.log();
        deep += 1;
        ts.forEachChild(node, scanNode);
        deep -= 1;
    }
    ts.forEachChild(sourceFile, scanNode);
    return resultText;
}
function getFunctionName(node) {
    let classNode = node.parent;
    if (!classNode.name || !node.name)
        throw new Error('missing classNode.name or node.name');
    let functionName = classNode.name.getText() + '.' + node.name.getText();
    return functionName;
}
function createCloudRunText(node, method = 'run') {
    let functionName = getFunctionName(node);
    if (node.parameters.length > 0) {
        let parameterName = node.parameters[0].name.getText();
        return `{return API.${method}('${functionName}',${parameterName}) }`;
    }
    return `{return  API.${method}('${functionName}') }`;
}
// function ExpressionToJson(expression:ts.Node):any{
//     switch(expression.kind){
//         case ts.SyntaxKind.ObjectLiteralExpression:return ObjectLiteralExpressionToJson(expression)
//         case ts.SyntaxKind.ArrayLiteralExpression:return ArrayLiteralExpressionToJson(expression)
//         case ts.SyntaxKind.StringLiteral:return expression.getText()
//         case ts.SyntaxKind.NumericLiteral:return parseFloat( expression.getText() )
//         case ts.SyntaxKind.TrueKeyword:return true
//         case ts.SyntaxKind.FalseKeyword:return false
//         case ts.SyntaxKind.NullKeyword:return null
//         case ts.SyntaxKind.PropertyAccessExpression: expression.getText()
//         default:
//             throw new Error('unknow expression '+ts.SyntaxKind[expression.kind])
//     }
// }
// function ArrayLiteralExpressionToJson(expression:ts.Node){
//     let array:any[] = []
//     let arrayLiteralExpression = expression as ts.ArrayLiteralExpression;
//     for(var i=0;i<arrayLiteralExpression.elements.length;++i){
//         array.push( ExpressionToJson(arrayLiteralExpression.elements[i]) )
//     }
//     return array
// }
// function ObjectLiteralExpressionToJson(expression:ts.Node){
//     let json = {}
//     let nodes:ts.Node[] = []
//     ts.forEachChild(expression,(n)=>nodes.push(n))
//     for(let i=0;i<nodes.length;++i){
//         let propertyAssignment = nodes[i] as ts.PropertyAssignment
//         let key = propertyAssignment.getChildAt(0).getText()
//         json[key] = ExpressionToJson(propertyAssignment.getChildAt(2))
//     }
//     return json
// }
// function DecoratorToJson(decorator:ts.Decorator){
//     // console.log(decorator.expression)
//     // console.log(ts.SyntaxKind[ decorator.kind ])
//     let callExpression = decorator.expression as ts.CallExpression
//     let name = callExpression.getChildAt(0).getText()
//     let parameters:any[] = []
//     for(let i=0;i<callExpression.arguments.length;++i){
//         parameters.push(ExpressionToJson(callExpression.arguments[i]))
//     }
//     // console.log(callExpression.arguments[0].getText())
//     // let nodes:ts.Node[] = []
//     // ts.forEachChild(callExpression,(n)=>nodes.push(n))
//     // // console.log(nodes)
//     // let name = nodes[0].getText()
//     // for(let i=1;i<nodes.length;++i){
//     //     parameters.push(ExpressionToJson(nodes[i]))
//     // }
//     return {name,parameters}
// }
function IsInternalName(node) {
    return node.name && node.name.escapedText.toString().startsWith('_');
}
function GetImportName(importSpecifier) {
    return ((importSpecifier.propertyName && (importSpecifier.propertyName.escapedText.toString() + ' as ')) || '')
        + importSpecifier.name.escapedText.toString();
}
function IsExportDisabled(node) {
    return node.getFullText().includes('@lcc-export-disabled');
}
exports.IsExportDisabled = IsExportDisabled;
//https://github.com/Microsoft/TypeScript/wiki/Using-the-Compiler-API
//在线查看代码ast的工具 https://ts-ast-viewer.com/
function createSdkFile(sourceFile) {
    let results = [];
    let lastPositions = [];
    let exportText = '';
    // for(let i=0;i<Object.keys(Platform).length;++i){
    results.push("import * as API from '..'\n"
        + "export interface CloudParams{ noCache?: boolean; \n adminId ?: string; }\n");
    lastPositions.push(0);
    // }
    // let resultText = ''
    let sourceText = sourceFile.text;
    function skipNode(nodeStart, nodeEnd, platform) {
        skipText(nodeStart.getFullStart(), (nodeEnd || nodeStart).getEnd(), platform);
    }
    function skipAllNode(nodeStart, nodeEnd) {
        skipAllText(nodeStart.getFullStart(), (nodeEnd || nodeStart).getEnd());
        // skipText(nodeStart.getFullStart(), (nodeEnd||nodeStart).getEnd())
    }
    function skipAllText(start, end) {
        let i = 0;
        // for(let i=0;i<Object.keys(Platform).length;++i){
        skipText(start, end, i);
        // }
    }
    function skipText(start, end, platform) {
        let text = sourceText.substring(lastPositions[platform], start);
        // console.log(Platform[platform])
        // console.log(lastPositions[platform]+"-" +start+"->" + text+'=>'+start)
        results[platform] += text;
        lastPositions[platform] = end;
        // console.log('results:')
        // console.log(results[platform])
    }
    function appendText(text, platform) {
        results[platform] += text;
    }
    function scanNode(node) {
        switch (node.kind) {
            case ts.SyntaxKind.FunctionDeclaration:
                {
                    if (IsExportDisabled(node)) {
                        skipAllNode(node);
                        break;
                    }
                    let functionDeclaration = node;
                    if (!IsInternalName(functionDeclaration) && functionDeclaration.modifiers && functionDeclaration.modifiers.find(e => e.kind == ts.SyntaxKind.ExportKeyword)) {
                    }
                    else {
                        skipAllNode(node);
                    }
                }
                break;
            case ts.SyntaxKind.ExpressionStatement:
            case ts.SyntaxKind.IfStatement:
            case ts.SyntaxKind.ExportAssignment:
                skipAllNode(node);
                break;
            case ts.SyntaxKind.TypeAliasDeclaration:
            case ts.SyntaxKind.VariableStatement:
                {
                    if (IsExportDisabled(node)) {
                        skipAllNode(node);
                        break;
                    }
                    let declaration = node;
                    if (declaration.modifiers && declaration.modifiers.find(e => e.kind == ts.SyntaxKind.ExportKeyword)) {
                    }
                    else {
                        skipAllNode(node);
                    }
                }
                break;
            case ts.SyntaxKind.ImportDeclaration:
                {
                    if (IsExportDisabled(node)) {
                        skipAllNode(node);
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
                        let importClause = importDeclaration.importClause;
                        if (importClause) {
                            let text = '';
                            if (!node.getText().includes('_')) {
                                text = node.getText();
                                if (moduleMap[moduleName]) {
                                    text = text.replace(moduleName, moduleMap[moduleName]);
                                }
                            }
                            else {
                                //去除_开头的引用项目
                                if (importClause.name && !IsInternalName(importClause)) {
                                    text += importClause.name.escapedText.toString();
                                }
                                let namedImports = importClause.namedBindings;
                                if (namedImports && namedImports.elements) {
                                    let names = namedImports.elements.filter(e => !IsInternalName(e)).map(e => GetImportName(e));
                                    if (names.length > 0) {
                                        text += ((text && ', ') || '') + `{ ${names.join(', ')} }`;
                                    }
                                }
                                if (text) {
                                    let moduleName2 = moduleMap[moduleName] || moduleName;
                                    text = `import ${text} from '${moduleName2}'`;
                                }
                            }
                            // for (let i = 0; i < Object.keys(Platform).length; ++i) 
                            {
                                let i = 0;
                                appendText(text + '\n', i);
                            }
                        }
                    }
                    skipAllNode(node);
                }
                break;
            case ts.SyntaxKind.ImportEqualsDeclaration:
                {
                    if (IsExportDisabled(node)) {
                        skipAllNode(node);
                        break;
                    }
                    let importEqualsDeclaration = node;
                    if (importEqualsDeclaration.moduleReference.kind == ts.SyntaxKind.QualifiedName) {
                    }
                    else {
                        skipAllNode(node);
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
                break;
            case ts.SyntaxKind.InterfaceDeclaration:
                {
                    if (IsExportDisabled(node)) {
                        skipAllNode(node);
                        break;
                    }
                    let interfaceNode = node;
                    //是否需要增加 export
                    let needExport = true;
                    if (interfaceNode.modifiers) {
                        if (interfaceNode.modifiers.find(x => x.kind == ts.SyntaxKind.ExportKeyword)) {
                            needExport = false;
                        }
                    }
                    if (needExport) {
                        // for(let i=0;i<Object.keys(Platform).length;++i)
                        {
                            let i = 0;
                            skipText(interfaceNode.getStart(), interfaceNode.getStart(), i);
                            //增加 export 标示
                            appendText('export ', i);
                        }
                    }
                }
                break;
            case ts.SyntaxKind.ClassDeclaration:
                {
                    if (IsExportDisabled(node)) {
                        skipAllNode(node);
                        break;
                    }
                    let classNode = node;
                    let needExport = true;
                    if (classNode.modifiers) {
                        if (classNode.modifiers.find(x => x.kind == ts.SyntaxKind.ExportKeyword)) {
                            needExport = false;
                        }
                    }
                    if (needExport) {
                        // for(let i=0;i<Object.keys(Platform).length;++i)
                        {
                            let i = 0;
                            skipText(classNode.getStart(), classNode.getStart(), i);
                            appendText('export ', i);
                        }
                    }
                    ts.forEachChild(node, scanNode);
                    if (classNode.name) {
                        let className = classNode.name.getText();
                        let instance = className[0].toLowerCase() + className.substr(1);
                        exportText = `\nlet ${instance} = new ${className}()\nexport default ${instance}`;
                    }
                }
                break;
            case ts.SyntaxKind.MethodDeclaration:
                {
                    if (IsExportDisabled(node)) {
                        skipAllNode(node);
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
                                let platformText = cloudMetaData_1.PlatformString(decorator);
                                // console.log(paramsText)
                                let platforms = platformText && JSON.parse(platformText);
                                let rpcText = cloudMetaData_1.GetJsonValueString(decorator, 'rpc');
                                let rpc = rpcText && JSON.parse(rpcText);
                                let internalText = cloudMetaData_1.GetJsonValueString(decorator, 'internal');
                                let internal = internalText && JSON.parse(internalText);
                                let verifyText = cloudMetaData_1.GetJsonValueString(decorator, 'verify');
                                let verify = verifyText && JSON.parse(verifyText);
                                needSkip = false;
                                // let parameters = sandbox.result || {}
                                // let platforms:string[] = parameters.platforms
                                // let keys = Object.keys(Platform)
                                // for (let i = 0; i < keys.length; ++i) 
                                {
                                    // let s = keys[i].replace('_', '-')
                                    // let s = targetPlatform.replace('_', '-')
                                    if (internal || (platforms && !platforms.includes(targetPlatform))) {
                                        skipNode(node, node, i);
                                    }
                                    else if (methodNode.body) {
                                        skipText(decorators[0].getStart(), decorators[decorators.length - 1].getEnd(), i);
                                        skipNode(methodNode.body, methodNode.body, i);
                                        if (verify) {
                                            const VerifyParamsText = `& { cloudVerify :{sessionId:string,data:{  
                                            geetest_challenge:string
                                            geetest_seccode:string
                                            geetest_validate:string
                                          }} }`;
                                            let text = results[i];
                                            let lastIndex = text.lastIndexOf(')');
                                            if (verify.type == 'geetest') {
                                                results[i] = text.substring(0, lastIndex) + VerifyParamsText + text.substring(lastIndex);
                                            }
                                        }
                                        appendText(createCloudRunText(methodNode, rpc ? 'rpc' : 'run'), i);
                                    }
                                }
                                break;
                            }
                        }
                        if (needSkip)
                            skipAllNode(node);
                    }
                    else
                        skipAllNode(node);
                }
                break;
        }
    }
    ts.forEachChild(sourceFile, scanNode);
    if (!exportText)
        return null;
    // for(let i=0;i<Object.keys(Platform).length;++i){
    let i = 0;
    appendText(exportText, i);
    results[i] += sourceText.substring(lastPositions[i], sourceFile.getEnd());
    // }
    return results;
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
const _dirroot = __dirname + '/../../../';
function getSdkLibPath(platform) {
    return _dirroot + 'release/api/' + platform + '/src/lib';
}
function getSdkPath(platform) {
    return _dirroot + 'release/api/' + platform;
}
// function clearOldBuild() {
//     for (let i = 0; i < Platform.count; ++i) {
//         if (!targetPlatform || targetPlatform == getSdkFolderName(i)) {
//             let path = getSdkLibPath(i)
//             deleteFolderRecursive(path)
//             fs.mkdirSync(path)
//         }
//     }
// }
function createSdk(dir, exclude) {
    // for(let i=0;i<Platform.count;++i){
    //     if(!fs.existsSync(getSdkLibPath(i))){
    //         fs.mkdirSync(getSdkLibPath(i))
    //     }
    // }
    // for (let i = 0; i < Platform.count; ++i) {
    // for(let i in Platform){
    let i = 0;
    // if (!targetPlatform || targetPlatform == getSdkFolderName(targetPlatform)) 
    {
        let libPath = getSdkLibPath(targetPlatform);
        if (fs.existsSync(libPath)) {
            console.log('remove old files ' + libPath);
            deleteFolderRecursive(libPath);
        }
        fs.mkdirSync(libPath);
    }
    // }
    let indexFileText = '';
    for (let d = 0; d < dir.length; ++d) {
        let file = dir[d];
        if (path.extname(file) == '.ts' && exclude.indexOf(file) < 0) {
            console.log('read ' + file);
            let name = path.basename(file, '.ts');
            let text = fs_1.readFileSync(_dirroot + 'src/cloud/' + file).toString();
            if (text.includes('@lcc-ignore-file')) {
                continue;
            }
            let sourceFile = ts.createSourceFile(file, text, ts.ScriptTarget.ES2015, 
            /*setParentNodes */ true);
            //   console.log(printNode(sourceFile))
            var sdks = createSdkFile(sourceFile);
            if (sdks) {
                // for (let i = 0; i < Platform.count; ++i) {
                // let keys = Object.keys(Platform)
                // for(let i in Platform){
                // for (let i = 0; i < keys.length; ++i) 
                {
                    let i = 0;
                    // if (!targetPlatform || targetPlatform == getSdkFolderName(keys[i] as Platform)) 
                    {
                        if (fs.existsSync(getSdkLibPath(targetPlatform))) {
                            let libPath = getSdkLibPath(targetPlatform) + '/' + file;
                            console.log('write ' + libPath);
                            fs.writeFileSync(libPath, sdks[i]);
                        }
                    }
                }
                let moduleName = name.charAt(0).toUpperCase() + name.slice(1);
                indexFileText += `import ${name} from './${name}'\n`;
                indexFileText += `export { ${name} as ${moduleName} }\n`;
                indexFileText += `import * as ${moduleName}__ from './${name}'\n`;
                indexFileText += `export { ${moduleName}__  }\n`;
            }
        }
    }
    // for (let i = 0; i < Platform.count; ++i) {
    // for(let i in Platform)
    {
        // if (!targetPlatform || targetPlatform == getSdkFolderName(targetPlatform)) 
        {
            if (fs.existsSync(getSdkLibPath(targetPlatform))) {
                let libPath = getSdkLibPath(targetPlatform) + '/index.ts';
                console.log('write ' + libPath);
                fs.writeFileSync(libPath, indexFileText);
            }
        }
    }
}
function compile(fileNames, options) {
    let program = ts.createProgram(fileNames, options);
    let emitResult = program.emit();
    let allDiagnostics = ts
        .getPreEmitDiagnostics(program)
        .concat(emitResult.diagnostics);
    allDiagnostics.forEach(diagnostic => {
        if (diagnostic.file) {
            let { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
            let message = ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");
            console.log(`${diagnostic.file.fileName} (${line + 1},${character + 1}): ${message}`);
        }
        else {
            console.log(`${ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")}`);
        }
    });
    let exitCode = emitResult.emitSkipped ? 1 : 0;
    console.log(`Process exiting with code '${exitCode}'.`);
}
let targetPlatform = base_1.CheckPlatform(process.argv[2]);
let moduleMap = base_1.GetModuleMap(targetPlatform);
moduleMap['leanengine'] = moduleMap['leanengine'] || moduleMap['leancloud-storage'] || 'leancloud-storage';
// console.log('clear last build....')
// clearOldBuild()
if (base_1.platforms[targetPlatform].type == 'dart') {
    buildDartSdk_1.CreatDartSdk({ platform: targetPlatform, dirroot: _dirroot });
}
else {
    const exclude = ['cloud.ts', 'index.ts', 'base.ts'];
    let dir = fs.readdirSync(_dirroot + 'src/cloud/');
    console.log('build typescript sdk....');
    createSdk(dir, exclude);
}
// console.log('compile....')
// compileAndPush()
// let sourceFile = ts.createSourceFile(
//     'story.ts',
//     readFileSync(__dirname + '/../src/cloud/story.ts').toString(),
//     ts.ScriptTarget.ES2015,
//     /*setParentNodes */ true
//   );
//   console.log(printNode(sourceFile))
// let sourceFile = ts.createSourceFile(
//     'story.ts',
//     readFileSync(__dirname + '/../src/cloud/story.ts').toString(),
//     ts.ScriptTarget.ES2015,
//     /*setParentNodes */ true
//   );
// //   console.log(printNode(sourceFile))
// var sdks = createSdk(sourceFile)
// for(let i=0;i<sdks.length;++i)
// {
//     console.log(Platform[i]+':')
//     console.log(sdks[i])
// }
//# sourceMappingURL=buildSdk.js.map