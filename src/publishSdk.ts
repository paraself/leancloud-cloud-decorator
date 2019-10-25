#!/usr/bin/env node

import { Platform,CheckPlatform,promiseExec } from './base'

const _dirroot = ''
var targetPlatform = CheckPlatform(process.argv[2])
let sdkPath = _dirroot + 'release/api/' + targetPlatform
promiseExec(`npm publish ${sdkPath}`)