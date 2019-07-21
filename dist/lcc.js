#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const child_process_1 = require("child_process");
const base_1 = require("./base");
var targetPlatform = base_1.CheckPlatform(process.argv[2]);
const command = `npx lcc-build ${targetPlatform} && lcc-release ${targetPlatform}`;
child_process_1.exec(command, { maxBuffer: 1024 * 800 }, (err, stdout, stderr) => {
    if (err) {
        console.log(command);
        console.log('\x1b[31m');
        console.log(stdout);
        console.log(err);
        console.log(stderr);
        console.log('\x1b[0m');
        return;
    }
    console.log(stdout);
}).on('close', (code, signal) => console.log(code + ' ' + signal));
//# sourceMappingURL=lcc.js.map