#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const yaml_1 = __importDefault(require("yaml"));
const semver_1 = __importDefault(require("semver"));
// let paths = Object.keys(config)
// let paths = ['weapp', 'web-admin', 'web-user']
// function getSdkFolderName(platform: Platform) {
//     return platform.replace('_', '-');
//   }
function getSdkInfoPath(platform) {
    return _dirroot + 'release/api/' + platform + '/lib/info.dart';
}
function getSdkPackagePath(platform) {
    return _dirroot + 'release/api/' + platform + '/pubspec.yaml';
}
// function getPlatform(targetPlatform: string): Platform {
//   return targetPlatform.replace('-','_') as Platform
// }
function createSdkInfo(platform, dir, infoDir) {
    let packageJson = yaml_1.default.parse(fs_1.readFileSync(dir, 'utf-8'));
    // 版本号加一
    let version = semver_1.default.parse(packageJson.version);
    if (!version) {
        throw new Error('Error version ' + packageJson.version);
    }
    version.patch += 1;
    console.log('write ' + version.format());
    console.log('write ' + dir);
    fs_1.writeFileSync(dir, yaml_1.default.stringify(packageJson));
    console.log('write ' + infoDir);
    fs_1.writeFileSync(infoDir, `
var platform = ${platform};
var apiVersion = ${version.format()};
    `);
}
async function compileAndPush() {
    let sdkPath = _dirroot + 'release/api/' + targetPlatform;
    let platform = targetPlatform;
    let packageJsonPath = getSdkPackagePath(platform);
    let infoJsonPath = getSdkInfoPath(platform);
    createSdkInfo(platform, packageJsonPath, infoJsonPath);
}
var targetPlatform = 'dart';
// const _dirroot = __dirname+'/../../../'
const _dirroot = '';
function releaseDartSdk(params) {
    targetPlatform = params.platform;
    compileAndPush();
}
exports.releaseDartSdk = releaseDartSdk;
//# sourceMappingURL=releaseDartSdk.js.map