"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const AV = __importStar(require("leanengine"));
const lodash_1 = __importDefault(require("lodash"));
const config_json_1 = __importDefault(require("./config.json"));
const child_process_1 = require("child_process");
const platforms = config_json_1.default.platforms;
exports.platforms = platforms;
function CheckPlatform(platform) {
    if (platforms[platform]) {
        return platform;
    }
    throw new Error('不存在平台 ' + platform + ' 更改 lcc-config.json 后请执行 lcc-config 更新平台配置');
}
exports.CheckPlatform = CheckPlatform;
function GetModuleMap(platform) {
    return platforms[platform].module || {};
}
exports.GetModuleMap = GetModuleMap;
// export enum Platform {
//   web_user = "web_user",
//   web_admin  = "web_admin",
//   weapp = "weapp",
//   app_dart = "app_dart"
// }
function getRoleNames(avUser) {
    return avUser.getRoles()
        .then(roles => {
        return Promise.resolve(roles.map(e => e.getName()));
    });
}
/**
 * 输入一个用户，和权限的名字，测试这个用户是否具有该权限
 * @function isRole
 * @param  {AV.User} avUser 输入一个LC的用户
 * @param  {string} roleName 输入一个LC的用户
 * @return {Promise<boolean>} 返回这个用户是否具有该权限
 */
async function isRole(avUser, roleName) {
    try {
        var names = await getRoleNames(avUser);
        if (names.indexOf(roleName) !== -1)
            return Promise.resolve(true);
        else
            return Promise.resolve(false);
    }
    catch (error) {
        console.error(error);
        return Promise.resolve(false);
    }
}
exports.isRole = isRole;
function isRoles(avUser, roleArray) {
    return getRoleNames(avUser)
        .then(roleNames => {
        let diffArray = lodash_1.default.difference(roleArray, roleNames);
        let isContained = diffArray.length === 0;
        return Promise.resolve(isContained);
    });
}
exports.isRoles = isRoles;
function getQueryValueForCache(value) {
    switch (typeof value) {
        case 'string':
            return encodeURIComponent(value);
        case 'number':
        case 'boolean':
            return '' + value;
        case 'object': {
            if (value instanceof AV.Object) {
                return value.get('objectId');
            }
            if (value instanceof Date) {
                return value.getTime().toString();
            }
            throw new Error('unsupported query cache value object ' + JSON.stringify(value));
        }
        case 'undefined':
            return '';
        default: {
            throw new Error('unsupported query cache value type ' + typeof value);
        }
    }
}
function getCacheKey(equalToConditions, cacheKey = '', symbol = '=') {
    let keys = Object.keys(equalToConditions);
    keys.sort((x, y) => x.localeCompare(y));
    for (let i = 0; i < keys.length; ++i) {
        let key = keys[i];
        let value = key + symbol + getQueryValueForCache(equalToConditions[key]);
        if (cacheKey)
            cacheKey += '&';
        cacheKey += value;
    }
    return cacheKey;
}
exports.getCacheKey = getCacheKey;
function promiseExec(command) {
    return new Promise((resolve, reject) => {
        child_process_1.exec(command, { maxBuffer: 1024 * 800 }, (err, stdout, stderr) => {
            if (stdout)
                console.log(stdout);
            if (stderr)
                console.error(stderr);
            if (err) {
                console.log(command);
                console.error(err);
                reject(err);
                return;
            }
            // resolve()
        }).on('close', (code, signal) => resolve(code));
    });
}
exports.promiseExec = promiseExec;
//# sourceMappingURL=base.js.map