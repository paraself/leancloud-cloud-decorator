#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const child_process_1 = require("child_process");
// let paths = Object.keys(config)
let paths = ['weapp', 'web-admin', 'web-user'];
var targetPlatform = process.argv[2];
const _dirroot = __dirname + '/../../../';
function compileAndPush() {
    let command = '';
    let sdkPath = '';
    for (let i = 0; i < paths.length; ++i) {
        if (!targetPlatform || targetPlatform == paths[i]) {
            sdkPath = _dirroot + 'release/api/' + paths[i];
            // let currentCommand = `npm version minor --prefix ${sdkPath} --no-git-tag-version && npx tsc -p ` + sdkPath
            let currentCommand = `npx tsc -p ${sdkPath} && npx lcc-dep ${targetPlatform} && cd ${sdkPath} && npm version minor -f`;
            if (command != '') {
                command += ' && ' + currentCommand;
            }
            else {
                command = currentCommand;
            }
        }
    }
    console.log(command);
    child_process_1.exec(command, { maxBuffer: 1024 * 800 }, (err, stdout, stderr) => {
        console.log(stdout);
        if (err) {
            console.error(err);
            console.error(stderr);
            return;
        }
        command = `npm publish ${sdkPath}`;
        console.log(command);
        child_process_1.exec(command, { maxBuffer: 1024 * 800 }, (err, stdout, stderr) => {
            console.log(stdout);
            if (err) {
                console.error(err);
                console.error(stderr);
                return;
            }
        }).on('close', (code, signal) => console.log(code + ' ' + signal));
    }).on('close', (code, signal) => console.log(code + ' ' + signal));
}
compileAndPush();
//# sourceMappingURL=releaseSdk.js.map