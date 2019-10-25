#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const base_1 = require("./base");
const _dirroot = '';
var targetPlatform = base_1.CheckPlatform(process.argv[2]);
let sdkPath = _dirroot + 'release/api/' + targetPlatform;
base_1.promiseExec(`npm publish ${sdkPath}`);
//# sourceMappingURL=publishSdk.js.map