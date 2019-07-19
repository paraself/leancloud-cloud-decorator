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
    if (typeof error === 'string') {
        return error;
    }
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
        {
            while (error.ikkMessage) {
                errorInfo.errorInfo = error.ikkMessage;
                error = error.originalError;
            }
            errorInfo = Object.assign(errorInfo, error);
            errorInfo.error = error;
            // ikkError = new IkkError(errorInfo)
        }
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
const UNKNOW_STATS = process.env.NODE_ENV ? 'unknow' : 'local';
/**
 * @function define - 更改原始函数,增加日志记录功能. 必须在云函数定义被require之前定义
 * @param {string} name
 * @param {*} optionsOrHandler
 * @param {*} handler
 */
leanengine_1.default.Cloud.define = function (name, optionsOrHandler, handler = null) {
    //@ts-ignore
    var callback = handler;
    //@ts-ignore
    if (!callback)
        callback = optionsOrHandler;
    /**
     *
     * @param {CloudFunction} request
     */
    var CloudHandler = function (request) {
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
        params.platform = params.platform || UNKNOW_STATS;
        params.api = params.api || UNKNOW_STATS;
        params.version = params.version || UNKNOW_STATS;
        try {
            //@ts-ignore
            request.lock = lock;
            cloudStats_1.IncrCall({
                function: name,
                platform: params.platform,
                api: params.api,
                version: params.version,
            });
            if (request.currentUser && request.currentUser.get('marked')) {
                throw new leanengine_1.default.Cloud.Error('Banned user', { code: 400 });
            }
            var result = callback(request);
            if (!result) {
                lock.clearLock();
                return;
            }
            if (result.catch && result.then) {
                return result
                    .then(e => {
                    lock.clearLock();
                    return e;
                })
                    .catch(info => {
                    lock.clearLock();
                    // let ikkError
                    var errorInfo = {
                        user: request.currentUser,
                        function: name,
                        params: request.params,
                        ip,
                        platform: params.platform,
                        api: params.api,
                        version: params.version,
                    };
                    // if (info instanceof IkkError) {
                    //   ikkError = info
                    //   ikkError.setData(errorInfo)
                    // } else
                    if (info) {
                        if (typeof info === 'string') {
                            errorInfo.message = info;
                            errorInfo.description = info;
                        }
                        else if (typeof info === 'object') {
                            while (info.ikkMessage) {
                                errorInfo.errorInfo = info.ikkMessage;
                                info = info.originalError;
                            }
                            errorInfo = Object.assign(errorInfo, info);
                            if (info.message && info.stack) {
                                errorInfo.error = info;
                            }
                        }
                        // 创建一个ikkError并记录
                        // ikkError = new IkkError(errorInfo)
                    }
                    // ikkError.send()
                    // if (typeof info === 'string') {
                    //   return Promise.reject(info)
                    // }
                    // return Promise.reject(ikkError.toClient())
                    return Promise.reject(cloudErrorCallback(errorInfo));
                });
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
            var errorInfo = {
                user: request.currentUser,
                function: name,
                params: request.params,
                ip,
                platform: params.platform,
                api: params.api,
                version: params.version,
            };
            {
                while (error.ikkMessage) {
                    errorInfo.errorInfo = error.ikkMessage;
                    error = error.originalError;
                }
                errorInfo = Object.assign(errorInfo, error);
                errorInfo.error = error;
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
//@ts-ignore
leanengine_1.default.Cloud.define('Cloud.DeleteCache', async (request) => {
    if (request.currentUser && (await base_1.isRole(request.currentUser, 'Dev'))) {
        //@ts-ignore
        let params = request.params;
        let cacheKeyConfig = params.params;
        if (params.userId) {
            cacheKeyConfig['currentUser'] = params.userId;
        }
        let functionName = params.module + '.' + params.function;
        let timeUnitList = ['day', 'hour', 'minute', 'second', 'month'];
        let pipeline = redis.pipeline();
        for (let i = 0; i < timeUnitList.length; ++i) {
            cacheKeyConfig['timeUnit'] = timeUnitList[i];
            let cacheKey = `${prefix}:cloud:${functionName}:` + base_1.getCacheKey(cacheKeyConfig);
            pipeline.del(cacheKey);
        }
        return pipeline.exec();
    }
    else {
        throw new leanengine_1.default.Cloud.Error('non-administrators', { code: 400 });
    }
});
//# sourceMappingURL=cloudHandler.js.map