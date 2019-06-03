#!/usr/bin/env node
require('source-map-support').install()
import { readFileSync,writeFileSync } from 'fs'
import * as fs from 'fs'
import * as ts from 'typescript'
import { Platform,CheckPlatform } from './base'
import { PlatformString } from './cloudMetaData'
import * as path from 'path'
// import { devDependencies, dependencies} from '../package.json'

var targetPlatform = CheckPlatform(process.argv[2])

// function getPlatform(targetPlatform: string): Platform {
//   return targetPlatform.replace('-','_') as Platform
// }
const _dirroot = __dirname+'/../../../'
// function getSdkFolderName(platform: Platform) {
//   return platform.replace('_', '-');
// }
function getSdkLibPath(platform: Platform) {
  return _dirroot + 'release/api/' + platform + '/dist/lib'
}
function getSdkPackagePath(platform: Platform) {
  return _dirroot + 'release/api/' + platform + '/package.json'
}
// function getSdkInfoDistPath(platform: Platform) {
//   return _dirroot + 'release/api/' + getSdkFolderName(platform) + '/dist/info.js'
// }

function getImport(sourceFile: ts.SourceFile) {

  let importList:string[] = []
  function scanNode(node: ts.Node) {
    switch (node.kind) {
      case ts.SyntaxKind.ImportDeclaration: {
        let importDeclaration = <ts.ImportDeclaration>node
        let moduleName = importDeclaration.moduleSpecifier.getText()
        if (moduleName[1] != '.') {
          importList.push(moduleName.substring(1, moduleName.length - 1) )
        }
      }
    }
  }
  ts.forEachChild(sourceFile, scanNode);
  return importList
}

function getImports(dir: string[],parentDir:string){

  let devDependencies = [
    "@types/node",
    "leancloud-storage",
    "typescript"
  ]
  console.log('add devDependencies:')
  for (let d = 0; d < dir.length; ++d) {
    let file = dir[d]
    // console.log(path.extname(file))
    if (path.extname(file) == '.ts') {

      let sourceFile = ts.createSourceFile(
        file,
        readFileSync(parentDir+'/'+file).toString(),
        ts.ScriptTarget.ES2015,
        /*setParentNodes */ true
      )
      getImport(sourceFile).map(e => {
        if (devDependencies.indexOf(e) < 0) {
          console.log(e)
          devDependencies.push(e)
        }
      })
    }
  }
  return devDependencies
}

function createDevDependencies(imports:string[]) {
  let map = {}
  let { devDependencies, dependencies } = JSON.parse(readFileSync('package.json', 'utf-8') )
    imports.map(e => {
    map[e] = devDependencies[e] || dependencies[e]
  })
  return map
}

function setDevDependencies(devDependencies: any,dir:string) {
  let packageJson = JSON.parse(readFileSync(dir, 'utf-8'))
  packageJson.devDependencies = devDependencies
  writeFileSync(dir, JSON.stringify(packageJson, null, 2), 'utf-8')
}

// let platform = getPlatform(targetPlatform)
let libPath = getSdkLibPath(targetPlatform)
let dir = fs.readdirSync(libPath)
console.log('build devDependencies....')
let imports = getImports(dir, libPath)
let devDependencies = createDevDependencies(imports)
// console.log(devDependencies)
let packageJsonPath = getSdkPackagePath(targetPlatform)
// let infoJsonDistPath = getSdkInfoDistPath(platform)
console.log('write ' + packageJsonPath)
setDevDependencies(devDependencies, packageJsonPath)