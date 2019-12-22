#!/usr/bin/env node

import { Platform,CheckPlatform,promiseExec } from './base'
import { readFileSync,writeFileSync } from 'fs'
import YAML from 'yaml'
import semver from 'semver'

// let paths = Object.keys(config)
// let paths = ['weapp', 'web-admin', 'web-user']

// function getSdkFolderName(platform: Platform) {
//     return platform.replace('_', '-');
//   }

function getSdkInfoPath(platform: Platform) {
    return _dirroot + 'release/api/' + platform + '/lib/info.dart'
  }

function getSdkPackagePath(platform: Platform) {
    return _dirroot + 'release/api/' + platform + '/pubspec.yaml'
}

// function getPlatform(targetPlatform: string): Platform {
//   return targetPlatform.replace('-','_') as Platform
// }


function createSdkInfo(platform: Platform,dir:string,infoDir:string){
    let packageJson = YAML.parse(readFileSync(dir, 'utf-8'))
    // 版本号加一
    let version = semver.parse(packageJson.version as string) 
    if(!version){
        throw new Error('Error version '+packageJson.version )
    }
    version.patch += 1
    console.log('write '+ version!.format())
    console.log('write '+ dir)
    writeFileSync(dir,YAML.stringify(packageJson))

    console.log('write '+ infoDir)
    writeFileSync(infoDir, `
var platform = ${platform};
var apiVersion = ${version!.format()};
    ` )

}

async function compileAndPush () {
    let sdkPath = _dirroot + 'release/api/' + targetPlatform

    let platform = targetPlatform
    let packageJsonPath = getSdkPackagePath(platform)
    let infoJsonPath = getSdkInfoPath(platform)
    createSdkInfo(platform,packageJsonPath,infoJsonPath)
}


var targetPlatform = 'dart'

// const _dirroot = __dirname+'/../../../'
const _dirroot = ''

export function releaseDartSdk(params: {platform:string}){
    targetPlatform = params.platform
    compileAndPush()
}

