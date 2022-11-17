"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GetStats = exports.IncrError = exports.IncrCache = exports.IncrCall = void 0;
const redisSetting = __importStar(require("./redis"));
const moment_1 = __importDefault(require("moment"));
const LEANCLOUD_APP_GROUP = process.env.LEANCLOUD_APP_GROUP || 'local';
const NODE_ENV = process.env.NODE_ENV || 'dev';
const STATS_VERSION = 'v1';
let _prefix = `${redisSetting.cachePrefix}:stats:` + STATS_VERSION + ':';
let prefix = `${_prefix}${LEANCLOUD_APP_GROUP}:${NODE_ENV}`;
let expire = 60 * 60 * 24 * 30;
let redis = redisSetting.redis;
redisSetting.AddCacheUpdateCallback((params) => {
    redis = redisSetting.redis;
    _prefix = `${redisSetting.cachePrefix}:stats:` + STATS_VERSION + ':';
    prefix = `${_prefix}${LEANCLOUD_APP_GROUP}:${NODE_ENV}`;
});
function checkKeyParams(key) {
    return /:|\?|\=/.test(key);
}
function getKey(info) {
    let func = (info.function || (info.module + '#' + info.action));
    let time = (0, moment_1.default)(new Date()).format('YYYY-MM-DD');
    // let api = `${info.platform}@${info.api}`
    let { api, platform, version } = info;
    let params = [];
    if (version) {
        if (checkKeyParams(version)) {
            throw new Error('error cloud log params');
        }
        params.push('version=' + version);
    }
    if (platform) {
        if (checkKeyParams(platform)) {
            throw new Error('error cloud log params');
        }
        params.push('platform=' + platform);
    }
    if (api) {
        if (checkKeyParams(api)) {
            throw new Error('error cloud log params');
        }
        params.push('api=' + api);
    }
    let key = `${prefix}:${func}:${time}`;
    if (params.length > 0) {
        return key + ':' + params.join('&');
    }
    return key;
    // return `${prefix}:${func}:${time}:version=${version}&platform=${platform}&api=${api}`
}
/**
 * 云函数缓存调用统计加1
 */
function IncrCall(info) {
    // console.log(info)
    let key = getKey(info);
    return redis.pipeline().hincrby(key, 'call', 1).expire(key, expire).exec();
}
exports.IncrCall = IncrCall;
/**
 * 云函数缓存调用统计加1
 */
function IncrCache(info) {
    // console.log(info)
    let key = getKey(info);
    return redis.pipeline().hincrby(key, 'cache', 1).expire(key, expire).exec();
}
exports.IncrCache = IncrCache;
/**
 * 云函数错误统计加1
 */
function IncrError(info) {
    let key;
    try {
        key = getKey(info);
    }
    catch (error) {
        // 有错误的情况,在IncrCall中已处理
        return;
    }
    return redis.pipeline().hincrby(key, 'error', 1).expire(key, expire).exec();
}
exports.IncrError = IncrError;
function decodeParams(paramsString) {
    let params = {};
    let paramsStringList = paramsString.split('&');
    for (let i = 0; i < paramsStringList.length; ++i) {
        let condition = paramsStringList[i];
        let index = condition.indexOf('=');
        if (index >= 0) {
            let key = condition.substring(0, index);
            let value = condition.substr(index + 1);
            params[key] = value;
        }
    }
    return params;
}
const hookNames = {
    beforeDelete: true,
    beforeSave: true,
    beforeUpdate: true,
    afterDelete: true,
    afterSave: true,
    afterUpdate: true,
};
function getInfoFromKey(key) {
    let infos = key.substring(_prefix.length).split(':');
    if (infos.length == 5 || infos.length == 4) {
        let group = infos[0];
        let env = infos[1];
        let func = infos[2];
        let date = infos[3];
        let info = {
            group,
            env,
            date
        };
        if (infos.length == 5) {
            let params = decodeParams(infos[4]);
            info = Object.assign(info, params);
        }
        let funcInfo = func.split('.');
        if (funcInfo.length < 2) {
            funcInfo = func.split('#');
        }
        if (funcInfo.length > 1) {
            let action = funcInfo[1];
            if (hookNames[action]) {
                info.module = funcInfo[0];
                info.action = action;
            }
            else {
                info.function = func;
            }
        }
        else {
            info.function = func;
        }
        return info;
    }
    else {
        console.log('Error cloud stats key:' + key);
        return null;
        // throw new Error('Error stats key '+key)
    }
}
async function GetStats() {
    let stats = [];
    let keys = await redis.keys(_prefix + '*');
    let pipeline = redis.pipeline();
    for (let i = 0; i < keys.length; ++i) {
        pipeline.hgetall(keys[i]);
    }
    let results = await pipeline.exec();
    for (let i = 0; i < keys.length; ++i) {
        let result = results[i][1];
        if (result) {
            try {
                let info = getInfoFromKey(keys[i]);
                if (info) {
                    if (result.call) {
                        result.callCount = parseInt(result.call);
                        delete result.call;
                    }
                    if (result.error) {
                        result.errorCount = parseInt(result.error);
                        delete result.error;
                    }
                    if (result.cache) {
                        result.cacheCount = parseInt(result.cache);
                        delete result.cache;
                    }
                    stats.push(Object.assign(info, result));
                }
            }
            catch (error) {
                console.error('error in GetStats key:' + keys[i] + ' ' + JSON.stringify(error));
            }
        }
    }
    return stats;
}
exports.GetStats = GetStats;
//# sourceMappingURL=cloudStats.js.map