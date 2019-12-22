#!/usr/bin/env node

import { Platform,CheckPlatform,promiseExec } from './base'
import { readFileSync,writeFileSync } from 'fs'
import YAML from 'yaml'
import { resolve } from 'path';

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
    let version = packageJson.version as string
    let versions = version.split('.')
    versions[2] = (parseInt(versions[2]) + 1).toString()
    version = versions.join('.')
    writeFileSync(dir,YAML.stringify(packageJson))
    let infoJson = {
      platform,
      apiVersion: version,
      clientVersion: "0.0.0"
    }
    writeFileSync(infoDir, `
var platform = ${platform};
var apiVersion = ${version};
    ` )

}

async function compileAndPush () {
    let sdkPath = _dirroot + 'release/api/' + targetPlatform

    let platform = targetPlatform
    let packageJsonPath = getSdkPackagePath(platform)
    let infoJsonPath = getSdkInfoPath(platform)
    console.log('write ' + infoJsonPath)
    createSdkInfo(platform,packageJsonPath,infoJsonPath)

    await promiseExec(`npx tsc -p ${sdkPath} && npx lcc-dep ${targetPlatform}`)
}


var targetPlatform = 'dart'

// const _dirroot = __dirname+'/../../../'
const _dirroot = ''

export function releaseDartSdk(params: {platform:string}){
    targetPlatform = params.platform
    compileAndPush()
}

