"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
require('source-map-support').install();
const fs_1 = require("fs");
const fs = __importStar(require("fs"));
const ts = __importStar(require("typescript"));
const base_1 = require("./base");
const path = __importStar(require("path"));
// import { devDependencies, dependencies} from '../package.json'
var targetPlatform = process.argv[2];
function getPlatform(targetPlatform) {
    for (let i in base_1.Platform) {
        if (targetPlatform == getSdkFolderName(i)) {
            return i;
        }
    }
    throw new Error('Error targetPlatform ' + targetPlatform);
}
function getSdkFolderName(platform) {
    return base_1.Platform[platform].replace('_', '-');
}
function getSdkLibPath(platform) {
    return __dirname + '/../release/api/' + getSdkFolderName(platform) + '/dist/lib';
}
function getSdkPackagePath(platform) {
    return __dirname + '/../release/api/' + getSdkFolderName(platform) + '/package.json';
}
function getSdkInfoPath(platform) {
    return __dirname + '/../release/api/' + getSdkFolderName(platform) + '/src/info.json';
}
function getSdkInfoDistPath(platform) {
    return __dirname + '/../release/api/' + getSdkFolderName(platform) + '/dist/info.json';
}
function getImport(sourceFile) {
    let importList = [];
    function scanNode(node) {
        switch (node.kind) {
            case ts.SyntaxKind.ImportDeclaration: {
                let importDeclaration = node;
                let moduleName = importDeclaration.moduleSpecifier.getText();
                if (moduleName[1] != '.') {
                    importList.push(moduleName.substring(1, moduleName.length - 1));
                }
            }
        }
    }
    ts.forEachChild(sourceFile, scanNode);
    return importList;
}
function getImports(dir, parentDir) {
    let devDependencies = [
        "@types/node",
        "leancloud-storage",
        "typescript"
    ];
    console.log('add devDependencies:');
    for (let d = 0; d < dir.length; ++d) {
        let file = dir[d];
        // console.log(path.extname(file))
        if (path.extname(file) == '.ts') {
            let sourceFile = ts.createSourceFile(file, fs_1.readFileSync(parentDir + '/' + file).toString(), ts.ScriptTarget.ES2015, 
            /*setParentNodes */ true);
            getImport(sourceFile).map(e => {
                if (devDependencies.indexOf(e) < 0) {
                    console.log(e);
                    devDependencies.push(e);
                }
            });
        }
    }
    return devDependencies;
}
function createDevDependencies(imports) {
    let map = {};
    let { devDependencies, dependencies } = JSON.parse(fs_1.readFileSync('package.json', 'utf-8'));
    imports.map(e => {
        map[e] = devDependencies[e] || dependencies[e];
    });
    return map;
}
function setDevDependencies(devDependencies, dir, infoDir, infoDistDir) {
    let packageJson = JSON.parse(fs_1.readFileSync(dir, 'utf-8'));
    packageJson.devDependencies = devDependencies;
    fs_1.writeFileSync(dir, JSON.stringify(packageJson, null, 2), 'utf-8');
    try {
        let infoJson = JSON.parse(fs_1.readFileSync(infoDir, 'utf-8'));
        infoJson.api = packageJson.version;
        fs_1.writeFileSync(infoDir, JSON.stringify(infoJson, null, 2), 'utf-8');
        fs_1.writeFileSync(infoDistDir, JSON.stringify(infoJson, null, 2), 'utf-8');
    }
    catch (error) {
    }
}
let platform = getPlatform(targetPlatform);
let libPath = getSdkLibPath(platform);
let dir = fs.readdirSync(libPath);
console.log('build devDependencies....');
let imports = getImports(dir, libPath);
let devDependencies = createDevDependencies(imports);
// console.log(devDependencies)
let packageJsonPath = getSdkPackagePath(platform);
let infoJsonPath = getSdkInfoPath(platform);
let infoJsonDistPath = getSdkInfoDistPath(platform);
console.log('write ' + packageJsonPath);
console.log('write ' + infoJsonPath);
setDevDependencies(devDependencies, packageJsonPath, infoJsonPath, infoJsonDistPath);
//# sourceMappingURL=buildDevDependencies.js.map