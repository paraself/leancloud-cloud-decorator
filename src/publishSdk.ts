#!/usr/bin/env node

import { Platform,platforms,CheckPlatform,promiseExec } from './base'
import { readFileSync,writeFileSync } from 'fs'
import YAML from 'yaml'

const _dirroot = ''
var targetPlatform = CheckPlatform(process.argv[2])
let sdkPath = _dirroot + 'release/api/' + targetPlatform

function getSdkPackagePath(platform: Platform) {
    return _dirroot + 'release/api/' + platform + '/pubspec.yaml'
}

console.log('publish')
if(platforms[targetPlatform].type=='dart'){
    let packageJson = YAML.parse(readFileSync(getSdkPackagePath(targetPlatform), 'utf-8'))
    let version = packageJson.version as string
    let command = `cd ${sdkPath} && git add -A && git commit -m "auto release" && git tag -a v${version}-m "${version}" && git push`
    console.log(command)
    promiseExec(command)
  }else{
    promiseExec(`npm publish ${sdkPath}`)
  }