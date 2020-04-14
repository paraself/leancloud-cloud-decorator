#!/usr/bin/env node

import * as fs from "fs";
import * as ts from "typescript";
import * as path from 'path'
import {CloudIdConfig,GetCloudInfo} from './buildIDCommon'

class CloudClass {
    classNode:ts.ClassDeclaration
    constructor(params:{classNode:ts.ClassDeclaration}) {
        this.classNode = params.classNode
    }
    get className():string{
        return this.classNode.name!.getText()
    }
    
    cloudFunctions():string[]{
        return this.classNode.members.filter(e=>ts.isMethodDeclaration(e) && e.decorators?.find(d=>d.getText().substring(0,6)=='@Cloud') )
            .map(e=>e.name?.getText()!)
    }
}


function IsExportDisabled(node:ts.Node){
    return node.getFullText().includes('@lcc-export-disabled')
}

//https://github.com/Microsoft/TypeScript/wiki/Using-the-Compiler-API
//在线查看代码ast的工具 https://ts-ast-viewer.com/
function createSdkFile(sourceFile:ts.SourceFile):CloudClass[]{
    let cloudClasses:CloudClass[] = []
    function scanNode(node: ts.Node) {
        switch (node.kind){
            case ts.SyntaxKind.ClassDeclaration:
            {
                if(IsExportDisabled(node)){
                    break
                }
                let classNode = <ts.ClassDeclaration>node
                let cloudClass = new CloudClass({classNode})
                cloudClasses.push(cloudClass)
            }
            break
        }
    }
    ts.forEachChild(sourceFile, scanNode);
    return cloudClasses
}

// let _dirroot = '/Users/zhilongchen/home/muyue/pteai-node-ts2/'
export type CloudFunctionInfos = {name:string,functions:string[]}[]

export function GetClouds(dirroot:string):CloudFunctionInfos {
    let cloudClasses:CloudClass[] = []
    let dir = fs.readdirSync(path.join(dirroot , 'src/cloud/') )
    for(let d=0;d<dir.length;++d){
        let file = dir[d]
        if( path.extname(file)=='.ts'){
            let text = fs.readFileSync(path.join(dirroot , 'src/cloud/',file)).toString()
            if(!text.includes('@lcc-ignore-file')){
                let sourceFile = ts.createSourceFile(
                    file,
                    text,
                    ts.ScriptTarget.ES2015,
                    /*setParentNodes */ true
                );
                //   console.log(printNode(sourceFile))
                cloudClasses.push( ...createSdkFile(sourceFile) )
            }
    
        }
    }
    return cloudClasses.map(e=>({name:e.className,functions:e.cloudFunctions()})).filter(e=>e.functions.length)
}

// console.log(JSON.stringify(GetClouds('/Users/zhilongchen/home/muyue/pteai-node-ts2/'), null, 2))



export function CombinID(clouds:CloudFunctionInfos,config:CloudIdConfig ):CloudIdConfig {
    let cloudConfigs = GetCloudInfo(config)
    // 获取模块起始id
    let moduleId = 20
    cloudConfigs.forEach(e=>{
        let id = e.id
        if(id>=moduleId){
            moduleId = id+1
        }
    })
    clouds.forEach(e=>{
        let cloudConfig = cloudConfigs.find(c=>c.name==e.name)
        if(!cloudConfig){
            cloudConfig = {name:e.name,id:moduleId++,functions:[] as {
                id: number;
                name: string;
            }[]} 
            cloudConfigs.push(cloudConfig)
        }
        // 获取云函数起始id
        let functionId = 10
        cloudConfig.functions.forEach(f=>{
            let id = f.id
            if(id>=functionId){
                functionId = id+1
            }
        })
        if(functionId>99){
            console.error('functionId>99:'+functionId+' in '+e.name)
        }
        e.functions.forEach(f=>{
            let functionCloud = cloudConfig!.functions.find(c=>c.name==f) 
            if(!functionCloud){
                cloudConfig!.functions.push({name:f,id:functionId++})
            }
        })
    })
    if(moduleId>99){
        console.error('moduleId>99:'+moduleId)
    }
    cloudConfigs.reduce((obj, item) => {
        obj[item.id] = item
        return obj
      }, {})
    return cloudConfigs.reduce((obj, e) => (obj[e.id.toString()] = {
        name:e.name,functions:e.functions.reduce((obj,f)=>
            (obj[f.id.toString()]=f.name)&&obj,{})
    })&&obj ,{}) 
    // e.id.toString(),{name:e.name,functions:new Map(e.functions.map(f=>[f.id.toString(),f.name]))}

}

export function BuildCloudId(dirroot:string) {
    let cloudFunctionIDFile = path.join(dirroot,'cloudFunctionID.json')
    let result = CombinID( GetClouds(dirroot), fs.existsSync(cloudFunctionIDFile) && JSON.parse( fs.readFileSync(cloudFunctionIDFile,'utf8')) || {} )
    fs.writeFileSync(cloudFunctionIDFile,JSON.stringify(result,null,2))
    console.log('BuildCloudId finish ==>'+cloudFunctionIDFile)
}
// BuildCloudId('/Users/zhilongchen/home/muyue/pteai-node-ts2/')
BuildCloudId('')