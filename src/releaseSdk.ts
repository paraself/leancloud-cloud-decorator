#!/usr/bin/env node

import { exec,spawn} from 'child_process'
import { Platform } from './base'
import { readFileSync,writeFileSync } from 'fs'
import { resolve } from 'path';

// let paths = Object.keys(config)
let paths = ['weapp', 'web-admin', 'web-user']

var targetPlatform = process.argv[2]

// const _dirroot = __dirname+'/../../../'
const _dirroot = ''

function getSdkFolderName(platform: Platform) {
    return Platform[platform].replace('_', '-');
  }

function getSdkInfoPath(platform: Platform) {
    return _dirroot + 'release/api/' + getSdkFolderName(platform) + '/src/info.ts'
  }

function getSdkPackagePath(platform: Platform) {
    return _dirroot + 'release/api/' + getSdkFolderName(platform) + '/package.json'
}

  function getPlatform(targetPlatform: string): Platform {
    for (let i in Platform) {
      if (targetPlatform == getSdkFolderName(i as Platform)) {
        return i as Platform
      }
    }
    throw new Error('Error targetPlatform ' + targetPlatform)
  }


function createSdkInfo(dir:string,infoDir:string){
    let packageJson = JSON.parse(readFileSync(dir, 'utf-8'))
  try {
    let infoText = readFileSync(infoDir, 'utf-8')
    let infoJson = JSON.parse(infoText.substr(infoText.indexOf('{')))
    infoJson.api = packageJson.version
    writeFileSync(infoDir, 'export default '+JSON.stringify(infoJson, null, 2), 'utf-8')
    // writeFileSync(infoDistDir, JSON.stringify(infoJson, null, 2), 'utf-8')
  } catch (error) {
    
  }
}

function promiseExec(command:string){
    return new Promise((resolve,reject)=>{
        exec(command, { maxBuffer: 1024 * 800 }, (err, stdout, stderr) => {
            if(stdout) console.log(stdout)
            if(stderr) console.error(stderr)
            if (err) {
                console.error(err)
                reject(err)
                return
            }
            // resolve()
        }).on('close', (code, signal) => resolve(code))
    })
}

async function compileAndPush () {
    let sdkPath = _dirroot + 'release/api/' + targetPlatform
    await promiseExec(`cd ${sdkPath} && npm version minor -f`)

    let platform = getPlatform(targetPlatform)
    let packageJsonPath = getSdkPackagePath(platform)
    let infoJsonPath = getSdkInfoPath(platform)
    console.log('write ' + infoJsonPath)
    createSdkInfo(packageJsonPath,infoJsonPath)

    await promiseExec(`npx tsc -p ${sdkPath} && npx lcc-dep ${targetPlatform} && npm publish ${sdkPath}`)
}

compileAndPush()
