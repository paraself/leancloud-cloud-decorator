
import { exec,spawn} from 'child_process'
var targetPlatform = process.argv[2]

const command = `npx lcc-build ${targetPlatform} && lcc-release ${targetPlatform}`
exec(command, { maxBuffer: 1024 * 800 }, (err, stdout, stderr) => {
    console.log(stdout)
    if (err) {
      console.error(err)
      console.error(stderr)
              return;
    }
}).on('close', (code, signal) => console.log(code + ' ' + signal))