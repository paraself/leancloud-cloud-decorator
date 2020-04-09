#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const base_1 = require("./base");
const fs_1 = require("fs");
const yaml_1 = __importDefault(require("yaml"));
const _dirroot = '';
var targetPlatform = base_1.CheckPlatform(process.argv[2]);
let sdkPath = _dirroot + 'release/api/' + targetPlatform;
function getSdkPackagePath(platform) {
    return _dirroot + 'release/api/' + platform + '/pubspec.yaml';
}
console.log('publish');
if (base_1.platforms[targetPlatform].type == 'dart') {
    let packageJson = yaml_1.default.parse(fs_1.readFileSync(getSdkPackagePath(targetPlatform), 'utf-8'));
    let version = packageJson.version;
    let command = `cd ${sdkPath} && git add -A && git commit -m "auto release" && git tag -a v${version} -m "${version}" && git push --follow-tags`;
    console.log(command);
    base_1.promiseExec(command);
}
else {
    base_1.promiseExec(`npm publish ${sdkPath}`);
}
//# sourceMappingURL=publishSdk.js.map