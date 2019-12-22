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

if(platforms[targetPlatform].type=='dart'){
    let packageJson = YAML.parse(readFileSync(getSdkPackagePath(targetPlatform), 'utf-8'))
    let version = packageJson.version as string
    promiseExec(`cd ${sdkPath} && git add -A && git tag -a v${version} -m "${version}" && git push`)
  }else{
    promiseExec(`npm publish ${sdkPath}`)
  }