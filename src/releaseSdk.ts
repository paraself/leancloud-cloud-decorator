#!/usr/bin/env node

import { Platform,CheckPlatform,promiseExec } from './base'
import { readFileSync,writeFileSync } from 'fs'
import { resolve } from 'path';

// let paths = Object.keys(config)
// let paths = ['weapp', 'web-admin', 'web-user']

var targetPlatform = CheckPlatform(process.argv[2])

// const _dirroot = __dirname+'/../../../'
const _dirroot = ''

// function getSdkFolderName(platform: Platform) {
//     return platform.replace('_', '-');
//   }

function getSdkInfoPath(platform: Platform) {
    return _dirroot + 'release/api/' + platform + '/src/info.ts'
  }

function getSdkPackagePath(platform: Platform) {
    return _dirroot + 'release/api/' + platform + '/package.json'
}

// function getPlatform(targetPlatform: string): Platform {
//   return targetPlatform.replace('-','_') as Platform
// }


function createSdkInfo(platform: Platform,dir:string,infoDir:string){
    let packageJson = JSON.parse(readFileSync(dir, 'utf-8'))
  try {
    // let infoText = readFileSync(infoDir, 'utf-8')
    // let infoJson = JSON.parse(infoText.substr(infoText.indexOf('{')))
    // infoJson.api = packageJson.version
    let infoJson = {
      platform,
      apiVersion:packageJson.version,
      clientVersion: "0.0.0"
    }
    writeFileSync(infoDir, 'export default '+JSON.stringify(infoJson, null, 2), 'utf-8')
    // writeFileSync(infoDistDir, JSON.stringify(infoJson, null, 2), 'utf-8')
  } catch (error) {
    
  }
}

async function compileAndPush () {
    let sdkPath = _dirroot + 'release/api/' + targetPlatform
    await promiseExec(`cd ${sdkPath} && npm version minor -f`)

    let platform = targetPlatform
    let packageJsonPath = getSdkPackagePath(platform)
    let infoJsonPath = getSdkInfoPath(platform)
    console.log('write ' + infoJsonPath)
    createSdkInfo(platform,packageJsonPath,infoJsonPath)

    await promiseExec(`npx tsc -p ${sdkPath} && npx lcc-dep ${targetPlatform}`)
}

compileAndPush()
