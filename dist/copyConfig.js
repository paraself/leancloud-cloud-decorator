#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const base_1 = require("./base");
const _dirroot = __dirname + '/../../../';
const configFilePath = _dirroot + '/lcc-config.json';
// console.log(fs.readdirSync('./'))
if (fs_1.default.existsSync(configFilePath)) {
    let sourceConfigPath = __dirname + '/../src/config.json';
    let distConfigPath = __dirname + '/../dist/config.json';
    console.log(sourceConfigPath);
    fs_1.default.copyFileSync(configFilePath, sourceConfigPath);
    fs_1.default.copyFileSync(configFilePath, distConfigPath);
    let rootPath = __dirname + '/../';
    (0, base_1.promiseExec)(`cd ${rootPath} && npx tsc -p .`);
}
else {
    console.log(configFilePath + ' does\'t exist');
}
//# sourceMappingURL=copyConfig.js.map