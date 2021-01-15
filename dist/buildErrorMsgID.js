#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const typescript_1 = __importDefault(require("typescript"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const leanengine_1 = __importDefault(require("leanengine"));
const async_retry_1 = __importDefault(require("async-retry"));
const buildIDCommon_1 = require("./buildIDCommon");
const config_json_1 = __importDefault(require("./config.json"));
require('dotenv').config();
function GetStringFromTemplateSpan(node) {
    if (typescript_1.default.isPropertyAccessExpression(node.expression)) {
        return '{' + node.expression.name.text + '}' + node.literal.text;
    }
    console.error('Error StringTemplateSpan ' + node.getText());
    return node.literal.text;
}
function GetStringFromTemplate(node) {
    return node.head.text + node.templateSpans.map(e => GetStringFromTemplateSpan(e)).join('');
}
function GetStringFromBinaryExpression(node) {
    return GetString(node.left) + GetString(node.right);
}
function GetString(node) {
    if (typescript_1.default.isBinaryExpression(node)) {
        return GetStringFromBinaryExpression(node);
    }
    else if (typescript_1.default.isTemplateExpression(node)) {
        return GetStringFromTemplate(node);
    }
    else if (typescript_1.default.isStringLiteral(node)) {
        return node.text;
    }
    else if (typescript_1.default.isPropertyAccessExpression(node)) {
        return '{' + node.name.getText() + '}';
    }
    else {
        console.error('error expression :' + node.getText());
    }
    return '';
}
function GetMsgFromErrorNode(node) {
    let msg = {
        en: ''
    };
    function scanNode(_node) {
        if (typescript_1.default.isPropertyAssignment(_node) && _node.name.getText() == 'en') {
            msg.en = GetString(_node.initializer);
        }
        else if (typescript_1.default.isPropertyAssignment(_node) && _node.name.getText() == 'cn') {
            msg.cn = GetString(_node.initializer);
        }
        else {
            _node.forEachChild(scanNode);
        }
    }
    node.forEachChild(scanNode);
    return msg;
}
function GetErrorMsgNodeFromNode(node) {
    let messages = [];
    function scanNode(_node) {
        if (typescript_1.default.isNewExpression(_node) && _node.expression.getText() == 'ErrorMsg') {
            messages.push(GetMsgFromErrorNode(_node.arguments[0]));
        }
        else {
            _node.forEachChild(scanNode);
        }
    }
    node.forEachChild(scanNode);
    return messages;
}
// function FindFuncEndIndex(text:string,start:number) {
//     let left = 1
//     let index = start+1
//     while(left>0){
//         if(text[index]=='(') left+=1
//         if(text[index]==')') left-=1
//     }
// }
// function GetAllErrorMsgArgs(content:string) {
//     let args:string[] = []
//     let index = content.indexOf('ErrorMsg',0)
//     while(index<content.length || index==-1){
//     }
// }
// function ProcessContent(content:string){
//     let messages:string[] = []
//     content.match(/\bErrorMsg\(([^()]*)\)/g)?.
//         forEach(e=>messages.push(GetMsgFromErrorNode(ts.createSourceFile(
//         't.ts',
//         e,
//         ts.ScriptTarget.ES2015,
//     ))))
//     return messages
// }
function GetDirErrorMsg(dirroot) {
    let messages = [];
    let dir = fs_1.default.readdirSync(dirroot);
    for (let d = 0; d < dir.length; ++d) {
        let file = dir[d];
        if (path_1.default.extname(file) == '.ts' || path_1.default.extname(file) == '.js') {
            let content = fs_1.default.readFileSync(path_1.default.join(dirroot, file), 'utf8');
            let sourceFile = typescript_1.default.createSourceFile(file, content, typescript_1.default.ScriptTarget.ES2015, 
            /*setParentNodes */ true);
            messages.push(...GetErrorMsgNodeFromNode(sourceFile));
        }
        else if (fs_1.default.lstatSync(path_1.default.join(dirroot, file)).isDirectory()) {
            messages.push(...GetDirErrorMsg(path_1.default.join(dirroot, file)));
        }
    }
    return messages;
}
function GetProjectErrorMsg(dirroot) {
    let messages = GetDirErrorMsg(path_1.default.join(dirroot, 'src/cloud/'));
    messages.push(...GetDirErrorMsg(path_1.default.join(dirroot, 'src/plugins/')));
    messages = messages.filter(x => x.en);
    return Object.values(messages.reduce((obj, item) => {
        obj[item.en] = item;
        return obj;
    }, {}));
}
async function BuildErrorMsgId(dirroot) {
    let errorMsgIDFile = path_1.default.join(dirroot, 'errorMsg.json');
    let result = CombinMsgConfig(GetProjectErrorMsg(dirroot), fs_1.default.existsSync(errorMsgIDFile) && JSON.parse(fs_1.default.readFileSync(errorMsgIDFile, 'utf8')) || {});
    await translateAll(result);
    fs_1.default.writeFileSync(errorMsgIDFile, JSON.stringify(result, null, 2));
    console.log('BuildErrorMsgId finish==>' + errorMsgIDFile);
}
function CombinMsgConfig(msgs, config) {
    let oldEnToId = {};
    let msgId = 100;
    Object.keys(config).forEach(e => {
        let id = parseInt(e);
        oldEnToId[config[e].en] = id;
        if (id >= msgId) {
            msgId = id + 1;
        }
    });
    let newConfig = {};
    msgs.forEach(e => {
        let id = oldEnToId[e.en];
        newConfig[(id || (msgId++)).toString()] = (id && Object.assign(config[id.toString()] || {}, e)) || e;
    });
    return newConfig;
}
async function translateAll(config) {
    let targets = Object.keys(buildIDCommon_1.EnumLocale).filter(e => e != buildIDCommon_1.EnumLocale.en);
    for (let i = 0; i < targets.length; ++i) {
        await translate(config, targets[i]);
    }
    console.log('translateAll finish');
}
async function translate(config, target) {
    let msgs = Object.values(config).filter(e => !e[target]);
    let msgs2 = [...msgs];
    let count = +msgs.length;
    console.log('translate to ' + target + ', count ' + count);
    let results = [];
    while (msgs.length > 0) {
        results.push(...await translateRequest(msgs.splice(0, 100).map(e => e.en), target));
        console.log((count - msgs.length) + '/' + count);
    }
    results.forEach((v, i) => {
        msgs2[i][target] = v;
    });
}
leanengine_1.default.setServerURLs(process.env.LC_SERVER_URL);
leanengine_1.default.init({
    appId: process.env.LC_APP_ID,
    appKey: process.env.LC_APP_KEY,
    masterKey: process.env.LC_APP_MASTER_KEY,
});
leanengine_1.default.setProduction(false);
exports.currentUser = undefined;
async function getUser() {
    if (exports.currentUser)
        return exports.currentUser;
    else {
        let user = await leanengine_1.default.User.logIn(process.env.LC_EMAIL, process.env.LC_PASSWORD);
        exports.currentUser = user;
        return exports.currentUser;
    }
}
let LocaleToGoogleMap = {
    cn: 'zh-CN',
    tn: 'zh-TW'
};
/**
 * 将原始模板字符串中的参数,转换为var1,var2 形式, 并返回映射列表
 */
function GetTranslationSafeTemplateString(text) {
    let index = 1;
    let varToName = {};
    let nameToVar = {};
    return [text.replace(/\{.*?\}/g, (e) => {
            if (nameToVar[e])
                return nameToVar[e];
            let varName = '{var' + (index++) + '}';
            varToName[varName] = e;
            nameToVar[e] = varName;
            return varName;
        }), varToName];
}
/**
 * 从安全返回的翻译字符串中,获取模板字符串
 */
function GetTranslationTemplateString(text, map) {
    Object.keys(map).forEach(e => {
        text = text.split(e).join(map[e]);
    });
    return text;
}
function ProcessHtmlCode(text) {
    return text.split('&#39;').join("'");
}
async function translateRequest(text, target) {
    let user = await getUser();
    let safeTemplateString = text.map(e => GetTranslationSafeTemplateString(e));
    let _params = {
        target: LocaleToGoogleMap[target] || target,
        source: buildIDCommon_1.EnumLocale.en,
        text: safeTemplateString.map(e => e[0])
    };
    //   console.log(JSON.stringify(_params,null,2) )
    let count = 0;
    let res = await async_retry_1.default(async (bail, _count) => {
        count = _count;
        return await leanengine_1.default.Cloud.run(config_json_1.default.translate || ((config_json_1.default.cloudPrefix || '') + 'Util.GetTranslate'), _params, { user, remote: true });
    }, { onRetry: error => {
            console.log('----------------------------------');
            // console.error(`${text.join('\n')}: 
            console.error(`翻译出错，正在进行第${count}次重试！`);
            console.log(error.message);
        } });
    res = res.map(e => ProcessHtmlCode(e));
    return res.map((e, i) => GetTranslationTemplateString(e, safeTemplateString[i][1]));
}
// let result = GetProjectErrorMsg('/Users/zhilongchen/home/muyue/pteai-node-ts2/')
// console.log(
//     JSON.stringify(
//         result,
//         null,
//         2
//     )
// )
// console.log(result.length)
// BuildErrorMsgId('/Users/zhilongchen/home/muyue/pteai-node-ts2/')
BuildErrorMsgId('');
//# sourceMappingURL=buildErrorMsgID.js.map