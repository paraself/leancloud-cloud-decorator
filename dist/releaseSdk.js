#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const base_1 = require("./base");
const fs_1 = require("fs");
// let paths = Object.keys(config)
// let paths = ['weapp', 'web-admin', 'web-user']
var targetPlatform = base_1.CheckPlatform(process.argv[2]);
// const _dirroot = __dirname+'/../../../'
const _dirroot = '';
// function getSdkFolderName(platform: Platform) {
//     return platform.replace('_', '-');
//   }
function getSdkInfoPath(platform) {
    return _dirroot + 'release/api/' + platform + '/src/info.ts';
}
function getSdkPackagePath(platform) {
    return _dirroot + 'release/api/' + platform + '/package.json';
}
// function getPlatform(targetPlatform: string): Platform {
//   return targetPlatform.replace('-','_') as Platform
// }
function createSdkInfo(platform, dir, infoDir) {
    let packageJson = JSON.parse(fs_1.readFileSync(dir, 'utf-8'));
    try {
        // let infoText = readFileSync(infoDir, 'utf-8')
        // let infoJson = JSON.parse(infoText.substr(infoText.indexOf('{')))
        // infoJson.api = packageJson.version
        let infoJson = {
            platform,
            apiVersion: packageJson.version,
            clientVersion: "0.0.0"
        };
        fs_1.writeFileSync(infoDir, 'export default ' + JSON.stringify(infoJson, null, 2), 'utf-8');
        // writeFileSync(infoDistDir, JSON.stringify(infoJson, null, 2), 'utf-8')
    }
    catch (error) {
    }
}
async function compileAndPush() {
    let sdkPath = _dirroot + 'release/api/' + targetPlatform;
    await base_1.promiseExec(`cd ${sdkPath} && npm version minor -f`);
    let platform = targetPlatform;
    let packageJsonPath = getSdkPackagePath(platform);
    let infoJsonPath = getSdkInfoPath(platform);
    console.log('write ' + infoJsonPath);
    createSdkInfo(platform, packageJsonPath, infoJsonPath);
    await base_1.promiseExec(`npx tsc -p ${sdkPath} && npx lcc-dep ${targetPlatform}`);
}
compileAndPush();
//# sourceMappingURL=releaseSdk.js.map