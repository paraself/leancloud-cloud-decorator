#!/usr/bin/env node

import fs from 'fs'
import path from 'path'
import { promiseExec } from './base'

const _dirroot = __dirname + '/../../../'

const configFilePath = _dirroot + '/lcc-config.json'
// console.log(fs.readdirSync('./'))
if (fs.existsSync(configFilePath)) {
    let sourceConfigPath = __dirname + '/../src/config.json'
    let distConfigPath = __dirname + '/../dist/config.json'
    console.log(sourceConfigPath)
    fs.copyFileSync(configFilePath, sourceConfigPath)
    fs.copyFileSync(configFilePath, distConfigPath)
    let rootPath = __dirname + '/../'
    promiseExec(`cd ${rootPath} && npx tsc -p .`)
} else {
    console.log(configFilePath + ' does\'t exist')
}