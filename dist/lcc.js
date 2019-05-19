#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const child_process_1 = require("child_process");
var targetPlatform = process.argv[2];
const command = `npx lcc-build ${targetPlatform} && lcc-release ${targetPlatform}`;
child_process_1.exec(command, { maxBuffer: 1024 * 800 }, (err, stdout, stderr) => {
    console.log(stdout);
    if (err) {
        console.error(err);
        console.error(stderr);
        return;
    }
}).on('close', (code, signal) => console.log(code + ' ' + signal));
//# sourceMappingURL=lcc.js.map