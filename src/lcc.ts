#!/usr/bin/env node

import { exec,spawn} from 'child_process'
import {CheckPlatform} from './base'
var targetPlatform = CheckPlatform(process.argv[2])

const command = `npx lcc-build ${targetPlatform} && lcc-release ${targetPlatform}`
exec(command, { maxBuffer: 1024 * 800 }, (err, stdout, stderr) => {
    if (err) {
      console.log(command)
      console.log('\x1b[31m')
      console.log(stdout)
      console.log( err)
      console.log(stderr)
      console.log('\x1b[0m')
      return;
    }
    console.log(stdout)
}).on('close', (code, signal) => console.log(code + ' ' + signal))