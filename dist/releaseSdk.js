#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const child_process_1 = require("child_process");
const base_1 = require("./base");
const fs_1 = require("fs");
// let paths = Object.keys(config)
let paths = ['weapp', 'web-admin', 'web-user'];
var targetPlatform = process.argv[2];
// const _dirroot = __dirname+'/../../../'
const _dirroot = '';
function getSdkFolderName(platform) {
    return base_1.Platform[platform].replace('_', '-');
}
function getSdkInfoPath(platform) {
    return _dirroot + 'release/api/' + getSdkFolderName(platform) + '/src/info.ts';
}
function getSdkPackagePath(platform) {
    return _dirroot + 'release/api/' + getSdkFolderName(platform) + '/package.json';
}
function getPlatform(targetPlatform) {
    for (let i in base_1.Platform) {
        if (targetPlatform == getSdkFolderName(i)) {
            return i;
        }
    }
    throw new Error('Error targetPlatform ' + targetPlatform);
}
function createSdkInfo(dir, infoDir) {
    let packageJson = JSON.parse(fs_1.readFileSync(dir, 'utf-8'));
    try {
        let infoText = fs_1.readFileSync(infoDir, 'utf-8');
        let infoJson = JSON.parse(infoText.substr(infoText.indexOf('{')));
        infoJson.api = packageJson.version;
        fs_1.writeFileSync(infoDir, 'export default ' + JSON.stringify(infoJson, null, 2), 'utf-8');
        // writeFileSync(infoDistDir, JSON.stringify(infoJson, null, 2), 'utf-8')
    }
    catch (error) {
    }
}
function promiseExec(command) {
    return new Promise((resolve, reject) => {
        child_process_1.exec(command, { maxBuffer: 1024 * 800 }, (err, stdout, stderr) => {
            if (stdout)
                console.log(stdout);
            if (stderr)
                console.error(stderr);
            if (err) {
                console.error(err);
                reject(err);
                return;
            }
            // resolve()
        }).on('close', (code, signal) => resolve(code));
    });
}
async function compileAndPush() {
    let sdkPath = _dirroot + 'release/api/' + targetPlatform;
    await promiseExec(`cd ${sdkPath} && npm version minor -f`);
    let platform = getPlatform(targetPlatform);
    let packageJsonPath = getSdkPackagePath(platform);
    let infoJsonPath = getSdkInfoPath(platform);
    console.log('write ' + infoJsonPath);
    createSdkInfo(packageJsonPath, infoJsonPath);
    await promiseExec(`npx tsc -p ${sdkPath} && npx lcc-dep ${targetPlatform} && npm publish ${sdkPath}`);
}
compileAndPush();
//# sourceMappingURL=releaseSdk.js.map