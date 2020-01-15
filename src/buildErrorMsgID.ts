#!/usr/bin/env node

import ts from "typescript"
import fs from 'fs'
import path from 'path'
import AV from 'leancloud-storage'
import retry from 'async-retry'
import {EnumLocale} from './buildIDCommon'
require('dotenv').config()

function GetStringFromTemplateSpan(node:ts.TemplateSpan):string {
    if(ts.isPropertyAccessExpression(node.expression)){
        return '{'+node.expression.name.text +'}' + node.literal.text
    }
    console.error('Error StringTemplateSpan '+node.getText())
    return node.literal.text
}
function GetStringFromTemplate(node:ts.TemplateExpression):string {
    return node.head.text+node.templateSpans.map(e=>GetStringFromTemplateSpan(e))
}
function GetStringFromBinaryExpression(node:ts.BinaryExpression):string {
    return GetString(node.left) + GetString(node.right)
}
function GetString(node:ts.Node):string {
    if(ts.isBinaryExpression(node)){
        return GetStringFromBinaryExpression(node)
    }else if(ts.isTemplateExpression(node)){
        return GetStringFromTemplate(node)
    }else if(ts.isStringLiteral(node)){
        return node.text
    }else if(ts.isPropertyAccessExpression(node)){
        return '{'+node.name.getText()+'}'
    } else{
        console.error('error expression :'+node.getText())
    }
    return ''
}
type ErrorMsgLang = {en:string,cn?:string} 
function GetMsgFromErrorNode(node:ts.Node):ErrorMsgLang{
    let msg:ErrorMsgLang = {
        en:''
    }
    function scanNode(_node: ts.Node) {

        if(ts.isPropertyAssignment(_node)&&_node.name.getText()=='en'){
            msg.en = GetString(_node.initializer)
        }else if(ts.isPropertyAssignment(_node)&&_node.name.getText()=='cn'){
            msg.cn = GetString(_node.initializer)
        }else{
            _node.forEachChild(scanNode)
        }
    }
    node.forEachChild(scanNode)
    return msg
}

function GetErrorMsgNodeFromNode(node:ts.SourceFile) {
    let messages:ErrorMsgLang[] = []
    function scanNode(_node: ts.Node) {
        if(ts.isNewExpression(_node) && _node.expression.getText()=='ErrorMsg'){
            messages.push(GetMsgFromErrorNode(_node.arguments![0]))
        }else{
            _node.forEachChild(scanNode)
        }
    }
    
    node.forEachChild(scanNode)
    return messages
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


function GetDirErrorMsg(dirroot:string){
    let messages:ErrorMsgLang[] = []
    let dir = fs.readdirSync(dirroot)

    for(let d=0;d<dir.length;++d){
        let file = dir[d]
        if( path.extname(file)=='.ts' || path.extname(file)=='.js'){
            let content = fs.readFileSync(path.join(dirroot,file),'utf8')
            let sourceFile = ts.createSourceFile(
                file,
                content,
                ts.ScriptTarget.ES2015,
                /*setParentNodes */ true
            );
            messages.push(...GetErrorMsgNodeFromNode(sourceFile))
        }
        else if(fs.lstatSync(path.join(dirroot,file)).isDirectory()){
            messages.push(...GetDirErrorMsg(path.join(dirroot,file)))
        }
    }
    return messages
}

function GetProjectErrorMsg(dirroot:string):ErrorMsgLang[]{

    let messages = GetDirErrorMsg(path.join(dirroot , 'src/cloud/') )
    messages.push(...GetDirErrorMsg(path.join(dirroot , 'src/plugins/') )) 
    messages = messages.filter(x=>x.en)

    return Object.values(messages.reduce((obj, item) => {
        obj[item.en] = item
        return obj
      }, {})) 
}

async function BuildErrorMsgId(dirroot:string) {
    let errorMsgIDFile = path.join(dirroot,'errorMsg.json')

    let result = CombinMsgConfig( GetProjectErrorMsg(dirroot), fs.existsSync(errorMsgIDFile) && JSON.parse( fs.readFileSync(errorMsgIDFile,'utf8')) || {} )
    await translateAll(result)
    fs.writeFileSync(errorMsgIDFile,JSON.stringify(result,null,2))
    console.log('BuildErrorMsgId finish==>'+errorMsgIDFile)
}

export type MsgIdConfig = {[key:string]:{[key in EnumLocale]?:string}&{en:string}}

function CombinMsgConfig(msgs:ErrorMsgLang[],config:MsgIdConfig):MsgIdConfig{
    let oldEnToId:{[key:string]:number} = {}
    let msgId = 100
    Object.keys( config ).forEach(
        e=>{
            let id =  parseInt(e)
            oldEnToId[config[e].en] =id
            if(id>=msgId){
                msgId = id+1
            }
        }
    )
    let newConfig:MsgIdConfig = {}
    msgs.forEach(e=>{
        let id = oldEnToId[e.en]
        newConfig[ (id||(msgId++)).toString() ] = (id && Object.assign(config[id.toString()]||{},e))||e
    })
    return newConfig
}

async function translateAll(config:MsgIdConfig){
    let targets = Object.keys(EnumLocale).filter(e=>e!=EnumLocale.en) as EnumLocale[]
    for(let i=0;i<targets.length;++i){
        await translate(config,targets[i])
    }
    console.log('translateAll finish')
}

async function translate(config:MsgIdConfig, target : EnumLocale) {
    let msgs = Object.values(config).filter(e=>!e[target])
    let msgs2 = [...msgs]
    let count = +msgs.length
    console.log('translate to '+target+', count '+count)
    let results:string[] = []
    while(msgs.length>0){
        results.push( ...await translateRequest(msgs.splice(0,100).map(e=>e.en),target) )
        console.log((count-msgs.length)+'/'+count)
    }
    results.forEach((v,i)=>{
        msgs2[i][target] = v
    })
}

AV.init({
    appId: process.env.LC_APP_ID!,
    appKey: process.env.LC_APP_KEY!,
    production: false,
    serverURLs: 'https://api.pte-ai.com'
  })
  AV.setProduction(false)

export let currentUser: AV.User | undefined = undefined
async function getUser(): Promise<AV.User> {
  if (currentUser) return currentUser;
  else {
    let user = await AV.User.logIn(process.env.LC_EMAIL!, process.env.LC_PASSWORD!)
    currentUser = user
    return currentUser
  }
}

let LocaleToGoogleMap:{[key in EnumLocale]?:string} = {
    cn:'zh-CN',
    tn:'zh-TW'
}

/**
 * 将原始模板字符串中的参数,转换为var1,var2 形式, 并返回映射列表
 */
function GetTranslationSafeTemplateString(text:string):[string,{[key:string]:string}] {
    let index = 1
    let varToName:{[key:string]:string} = {}
    let nameToVar:{[key:string]:string} = {}
    return [text.replace(/\{.*?\}/g,(e)=>{
        if(nameToVar[e]) return nameToVar[e]
        let varName = '{var'+ (index++)+'}'
        varToName[varName] = e
        nameToVar[e] = varName
        return varName
    }),varToName]
}

/**
 * 从安全返回的翻译字符串中,获取模板字符串
 */
function GetTranslationTemplateString(text:string,map: {[key:string]:string}) {
    Object.keys(map).forEach(e=>{
        text = text.split(e).join(map[e])
    })
    return text
}
function ProcessHtmlCode(text:string) {
    return text.split('&#39;').join("'")
}

async function translateRequest(text:string[],target : EnumLocale):Promise<string[]>{

    let user = await getUser()
    let safeTemplateString = text.map(e=>GetTranslationSafeTemplateString(e))
    let _params = {
      target: LocaleToGoogleMap[target] || target as string,
      source: EnumLocale.en,
      text: safeTemplateString.map(e=>e[0])
    }
      
    //   console.log(JSON.stringify(_params,null,2) )

    let count = 0
    let res:string[] = await retry(async (bail, _count) => {
        count = _count
        return await AV.Cloud.run('Util.GetTranslate', _params, { user })
      }, {onRetry: error => {
        console.log('----------------------------------');
        // console.error(`${text.join('\n')}: 
        console.error(`翻译出错，正在进行第${count}次重试！`)
        console.log(error.message)
      }})
      res = res.map(e=>ProcessHtmlCode(e))
      return res.map((e,i)=>GetTranslationTemplateString(e,safeTemplateString[i][1]))
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
BuildErrorMsgId('')