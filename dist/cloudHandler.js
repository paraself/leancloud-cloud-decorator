"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const leanengine_1 = __importDefault(require("leanengine"));
const redisSetting = __importStar(require("./redis"));
const base_1 = require("./base");
const cloudStats_1 = require("./cloudStats");
const lodash_1 = __importDefault(require("lodash"));
const redis_1 = require("./redis");
const buildIDCommon_1 = require("./buildIDCommon");
const fs = __importStar(require("fs"));
const errorMsg_1 = require("./errorMsg");
const errorMsgFile = 'errorMsg.json';
const errorMsgInfoMap = (fs.existsSync(errorMsgFile) && buildIDCommon_1.GetMsgInfoMap(JSON.parse(fs.readFileSync(errorMsgFile, 'utf8')))) || {};
const _define = leanengine_1.default.Cloud.define;
const _beforeDelete = leanengine_1.default.Cloud.beforeDelete;
const _beforeSave = leanengine_1.default.Cloud.beforeSave;
const _beforeUpdate = leanengine_1.default.Cloud.beforeUpdate;
const _afterDelete = leanengine_1.default.Cloud.afterDelete;
const _afterSave = leanengine_1.default.Cloud.afterSave;
const _afterUpdate = leanengine_1.default.Cloud.afterUpdate;
const LOG_CLOUD_FILTER = (process.env.LOG_CLOUD_FILTER && JSON.parse(process.env.LOG_CLOUD_FILTER)) ||
    [];
let redis = redisSetting.redis;
let prefix = redisSetting.cachePrefix;
redisSetting.AddCacheUpdateCallback((params) => {
    redis = redisSetting.redis;
    prefix = redisSetting.cachePrefix;
});
let cloudInvokeCallback;
let cloudErrorCallback = (error) => {
    // if (typeof error === 'string'){
    //   return error
    // }
    return error.error;
};
/**
 *  @deprecated please use init
 */
function SetCloudInvokeCallback(callback) {
    cloudInvokeCallback = callback;
}
exports.SetCloudInvokeCallback = SetCloudInvokeCallback;
/**
 * @deprecated please use init
 */
function SetCloudErrorCallback(callback) {
    cloudErrorCallback = callback;
}
exports.SetCloudErrorCallback = SetCloudErrorCallback;
async function CloudHookHandler(request, handler, className, actionName) {
    try {
        cloudStats_1.IncrCall({
            module: className,
            action: actionName
        });
        return await handler(request);
    }
    catch (error) {
        // console.error(error)
        // let ikkError
        //@ts-ignore
        var errorInfo = {
            user: request.currentUser,
            module: className,
            action: actionName,
            params: request.object && request.object.updatedKeys && lodash_1.default.pick(request.object.toJSON(), request.object.updatedKeys),
            target: request.object
        };
        // if (error instanceof IkkError) {
        //   ikkError = error
        //   ikkError.setData(errorInfo)
        // } else
        // {
        while (error.ikkMessage) {
            errorInfo.errorInfo = error.ikkMessage;
            error = error.originalError;
        }
        // errorInfo = Object.assign(errorInfo, error)
        errorInfo.error = error;
        // ikkError = new IkkError(errorInfo)
        // }
        // console.error(ikkError)
        // ikkError.send()
        // return Promise.reject(ikkError.toClient())
        return Promise.reject(cloudErrorCallback(errorInfo));
    }
}
function CreateHookFunction(name, hook = _beforeUpdate) {
    return (className, handler) => {
        hook(className, request => CloudHookHandler(request, handler, className, name));
    };
}
leanengine_1.default.Cloud.beforeDelete = CreateHookFunction('beforeDelete', _beforeDelete);
leanengine_1.default.Cloud.beforeSave = CreateHookFunction('beforeSave', _beforeSave);
leanengine_1.default.Cloud.beforeUpdate = CreateHookFunction('beforeUpdate', _beforeUpdate);
leanengine_1.default.Cloud.afterDelete = CreateHookFunction('afterDelete', _afterDelete);
leanengine_1.default.Cloud.afterSave = CreateHookFunction('afterSave', _afterSave);
leanengine_1.default.Cloud.afterUpdate = CreateHookFunction('afterUpdate', _afterUpdate);
const UNKNOW_STATS = process.env.NODE_ENV ? 'unknown' : 'local';
/**
 * @function define - 更改原始函数,增加日志记录功能. 必须在云函数定义被require之前定义
 * @param {string} name
 * @param {*} optionsOrHandler
 * @param {*} handler
 */
leanengine_1.default.Cloud.define = function (name, optionsOrHandler, handler = null, cloudOptions) {
    //@ts-ignore
    var callback = handler;
    //@ts-ignore
    if (!callback)
        callback = optionsOrHandler;
    /**
     *
     * @param {CloudFunction} request
     */
    var CloudHandler = async function (request) {
        var _a, _b;
        let ip;
        try {
            // var userAgent =
            //   request.expressReq && request.expressReq.headers['user-agent']
            ip = request.meta.remoteAddress;
            // LogInfo(request.currentUser, ip, userAgent, name)
            if (cloudInvokeCallback) {
                cloudInvokeCallback(name, request);
            }
        }
        catch (error) {
            console.error(error);
        }
        // return callback(request)
        var lock = new redis_1.Lock(name + ':');
        let params = request.params || {};
        let apiVersion = params._api;
        apiVersion = {
            platform: (apiVersion && apiVersion.platform) || UNKNOW_STATS,
            apiVersion: (apiVersion && (apiVersion.apiVersion || apiVersion['api'])) || UNKNOW_STATS,
            clientVersion: (apiVersion && (apiVersion.clientVersion || apiVersion['version'])) || UNKNOW_STATS,
        };
        try {
            //@ts-ignore
            request.lock = lock;
            cloudStats_1.IncrCall({
                function: name,
                platform: apiVersion.platform,
                api: apiVersion.apiVersion,
                version: apiVersion.clientVersion,
            });
            var result = callback(request);
            if (!result) {
                lock.clearLock();
                return;
            }
            if (result.catch && result.then) {
                result = await result;
                lock.clearLock();
                return result;
            }
            else {
                lock.clearLock();
                return result;
            }
        }
        catch (error) {
            lock.clearLock();
            // console.error(error)
            // let ikkError
            let msg = (error instanceof errorMsg_1.ErrorMsg) && errorMsgInfoMap[error.getStringTemplate().en];
            var errorInfo = {
                user: request.currentUser,
                function: name,
                params: params,
                ip,
                platform: apiVersion.platform,
                api: apiVersion.apiVersion,
                version: apiVersion.clientVersion,
                errorMsg: msg && {
                    code: {
                        moduleId: (_a = cloudOptions) === null || _a === void 0 ? void 0 : _a.moduleId,
                        functionId: (_b = cloudOptions) === null || _b === void 0 ? void 0 : _b.functionId,
                        msgId: msg && msg.id
                    },
                    messageTemplate: msg,
                    params: (error instanceof errorMsg_1.ErrorMsg) && error.params
                }
            };
            let info = error;
            if (info) {
                // errorInfo.error = info
                if (typeof info === 'string') {
                    errorInfo.message = info;
                    errorInfo.description = info;
                }
                else if (typeof info === 'object') {
                    if (info.error && info.target) {
                        errorInfo = Object.assign(info, errorInfo);
                    }
                    else {
                        while (info.ikkMessage) {
                            errorInfo.errorInfo = info.ikkMessage;
                            info = info.originalError;
                        }
                        // errorInfo = Object.assign(errorInfo, info)
                        // if (info.message && info.stack) 
                        {
                            errorInfo.error = info;
                        }
                        if (info.description && !errorInfo.errorMsg) {
                            errorInfo.description = info.description;
                        }
                        info.target && (errorInfo.target = info.target);
                    }
                }
                // 创建一个ikkError并记录
                // ikkError = new IkkError(errorInfo)
            }
            // console.error(ikkError)
            // ikkError.send()
            return Promise.reject(cloudErrorCallback(errorInfo));
        }
    };
    // 判断是否被过滤
    if (LOG_CLOUD_FILTER.includes(name)) {
        CloudHandler = callback;
    }
    if (handler) {
        //@ts-ignore
        _define(name, optionsOrHandler, CloudHandler);
    }
    else {
        //@ts-ignore
        _define(name, CloudHandler);
    }
};
// }
// //@ts-ignore
// AV.Cloud.define('Cloud.GetMetaData', async request => {
//   if (request.currentUser && await LC.isRole(request.currentUser, 'Dev')) {
//     return new Promise((resolve, reject) => {
//       fs.readFile(path.resolve(__dirname, '../../src/doc/type.json'), 'utf-8', function (err, data) {
//         if (err) {
//           console.error(err)
//           reject(err)
//         } else {
//           let _doc = JSON.parse(data)
//           //@ts-ignore
//           const doc = CreateCloudMetaData(_doc.children)
//           resolve( doc )
//         }
//       })
//     })
//   } else {
//     throw new AV.Cloud.Error('non-administrators', { code: 400 })
//   }
// })
// //@ts-ignore
// AV.Cloud.define('Cloud.GetTypes', async request => {
//   if (request.currentUser && await LC.isRole(request.currentUser, 'Dev')) {
//     return new Promise((resolve, reject) => {
//       fs.readFile(path.resolve(__dirname, '../../src/doc/type.json'), 'utf-8', function (err, data) {
//         resolve({data})
//       })
//     })
//   } else {
//     throw new AV.Cloud.Error('non-administrators', { code: 400 })
//   }
// })
//@ts-ignore
leanengine_1.default.Cloud.define('Cloud.GetStats', async (request) => {
    if (request.currentUser && (await base_1.isRole(request.currentUser, 'Dev'))) {
        return cloudStats_1.GetStats();
    }
    else {
        throw new leanengine_1.default.Cloud.Error('non-administrators', { code: 400 });
    }
});
async function DeleteCloudCache(params) {
    let cacheKeyConfig = params.params;
    let env = params.env || (process.env.NODE_ENV || 'dev');
    if (cacheKeyConfig && params.userId) {
        cacheKeyConfig['currentUser'] = params.userId;
    }
    let functionName = params.module + '.' + params.function;
    if (cacheKeyConfig) {
        let timeUnitList = ['day', 'hour', 'minute', 'second', 'month'];
        let pipeline = redis.pipeline();
        for (let i = 0; i < timeUnitList.length; ++i) {
            cacheKeyConfig['timeUnit'] = timeUnitList[i];
            if (Array.isArray(env)) {
                env.forEach(e => {
                    let cacheKey = `${prefix}:cloud:${e}:${functionName}:` + base_1.getCacheKey(cacheKeyConfig);
                    pipeline.del(cacheKey);
                });
            }
            else {
                let cacheKey = `${prefix}:cloud:${env}:${functionName}:` + base_1.getCacheKey(cacheKeyConfig);
                pipeline.del(cacheKey);
            }
        }
        let result = await pipeline.exec();
        return {
            'day': result[0][1],
            'hour': result[1][1],
            'minute': result[2][1],
            'second': result[3][1],
            'month': result[4][1]
        };
    }
    else {
        let pipeline = redis.pipeline();
        let keys = [];
        if (Array.isArray(env)) {
            for (let e = 0; e < env.length; ++e) {
                keys.push(...await redis.keys(`${prefix}:cloud:${env[e]}:${functionName}:*`));
            }
        }
        else {
            keys.push(...await redis.keys(`${prefix}:cloud:${env}:${functionName}:*`));
        }
        keys.forEach(e => {
            pipeline.del(e);
        });
        let result = await pipeline.exec();
        let out = {};
        keys.forEach((e, i) => {
            out[e] = result[i][1];
        });
        return out;
    }
}
exports.DeleteCloudCache = DeleteCloudCache;
//@ts-ignore
leanengine_1.default.Cloud.define('Cloud.DeleteCache', async (request) => {
    if (request.currentUser && (await base_1.isRole(request.currentUser, 'Dev'))) {
        //@ts-ignore
        let params = request.params;
        return DeleteCloudCache(params);
    }
    else {
        throw new leanengine_1.default.Cloud.Error('non-administrators', { code: 400 });
    }
});
//# sourceMappingURL=cloudHandler.js.map