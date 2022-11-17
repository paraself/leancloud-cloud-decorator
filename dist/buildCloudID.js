#!/usr/bin/env node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BuildCloudId = exports.CombinID = exports.GetClouds = void 0;
const fs = __importStar(require("fs"));
const ts = __importStar(require("typescript"));
const path = __importStar(require("path"));
const buildIDCommon_1 = require("./buildIDCommon");
class CloudClass {
    constructor(params) {
        this.classNode = params.classNode;
    }
    get className() {
        return this.classNode.name.getText();
    }
    cloudFunctions() {
        return this.classNode.members.filter(e => { var _a; return ts.isMethodDeclaration(e) && ((_a = e.decorators) === null || _a === void 0 ? void 0 : _a.find(d => d.getText().substring(0, 6) == '@Cloud')); })
            .map(e => { var _a; return (_a = e.name) === null || _a === void 0 ? void 0 : _a.getText(); });
    }
}
function IsExportDisabled(node) {
    return node.getFullText().includes('@lcc-export-disabled');
}
//https://github.com/Microsoft/TypeScript/wiki/Using-the-Compiler-API
//在线查看代码ast的工具 https://ts-ast-viewer.com/
function createSdkFile(sourceFile) {
    let cloudClasses = [];
    function scanNode(node) {
        switch (node.kind) {
            case ts.SyntaxKind.ClassDeclaration:
                {
                    if (IsExportDisabled(node)) {
                        break;
                    }
                    let classNode = node;
                    let cloudClass = new CloudClass({ classNode });
                    cloudClasses.push(cloudClass);
                }
                break;
        }
    }
    ts.forEachChild(sourceFile, scanNode);
    return cloudClasses;
}
function GetClouds(dirroot) {
    let cloudClasses = [];
    let dir = fs.readdirSync(path.join(dirroot, 'src/cloud/'));
    for (let d = 0; d < dir.length; ++d) {
        let file = dir[d];
        if (path.extname(file) == '.ts') {
            let text = fs.readFileSync(path.join(dirroot, 'src/cloud/', file)).toString();
            if (!text.includes('@lcc-ignore-file')) {
                let sourceFile = ts.createSourceFile(file, text, ts.ScriptTarget.ES2015, 
                /*setParentNodes */ true);
                //   console.log(printNode(sourceFile))
                cloudClasses.push(...createSdkFile(sourceFile));
            }
        }
    }
    return cloudClasses.map(e => ({ name: e.className, functions: e.cloudFunctions() })).filter(e => e.functions.length);
}
exports.GetClouds = GetClouds;
// console.log(JSON.stringify(GetClouds('/Users/zhilongchen/home/muyue/pteai-node-ts2/'), null, 2))
function CombinID(clouds, config) {
    let cloudConfigs = (0, buildIDCommon_1.GetCloudInfo)(config);
    // 获取模块起始id
    let moduleId = 20;
    cloudConfigs.forEach(e => {
        let id = e.id;
        if (id >= moduleId) {
            moduleId = id + 1;
        }
    });
    clouds.forEach(e => {
        let cloudConfig = cloudConfigs.find(c => c.name == e.name);
        if (!cloudConfig) {
            cloudConfig = { name: e.name, id: moduleId++, functions: [] };
            cloudConfigs.push(cloudConfig);
        }
        // 获取云函数起始id
        let functionId = 10;
        cloudConfig.functions.forEach(f => {
            let id = f.id;
            if (id >= functionId) {
                functionId = id + 1;
            }
        });
        if (functionId > 99) {
            console.error('functionId>99:' + functionId + ' in ' + e.name);
        }
        e.functions.forEach(f => {
            let functionCloud = cloudConfig.functions.find(c => c.name == f);
            if (!functionCloud) {
                cloudConfig.functions.push({ name: f, id: functionId++ });
            }
        });
    });
    if (moduleId > 99) {
        console.error('moduleId>99:' + moduleId);
    }
    cloudConfigs.reduce((obj, item) => {
        obj[item.id] = item;
        return obj;
    }, {});
    return cloudConfigs.reduce((obj, e) => (obj[e.id.toString()] = {
        name: e.name, functions: e.functions.reduce((obj, f) => (obj[f.id.toString()] = f.name) && obj, {})
    }) && obj, {});
    // e.id.toString(),{name:e.name,functions:new Map(e.functions.map(f=>[f.id.toString(),f.name]))}
}
exports.CombinID = CombinID;
function BuildCloudId(dirroot) {
    let cloudFunctionIDFile = path.join(dirroot, 'cloudFunctionID.json');
    let result = CombinID(GetClouds(dirroot), fs.existsSync(cloudFunctionIDFile) && JSON.parse(fs.readFileSync(cloudFunctionIDFile, 'utf8')) || {});
    fs.writeFileSync(cloudFunctionIDFile, JSON.stringify(result, null, 2));
    console.log('BuildCloudId finish ==>' + cloudFunctionIDFile);
}
exports.BuildCloudId = BuildCloudId;
// BuildCloudId('/Users/zhilongchen/home/muyue/pteai-node-ts2/')
BuildCloudId('');
//# sourceMappingURL=buildCloudID.js.map