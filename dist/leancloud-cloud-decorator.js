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
const leancloud_storage_1 = __importDefault(require("leancloud-storage"));
const joi_1 = __importDefault(require("joi"));
const moment_1 = __importDefault(require("moment"));
const base_1 = require("./base");
const cloudStats_1 = require("./cloudStats");
const semver_1 = __importDefault(require("semver"));
const fs_1 = __importDefault(require("fs"));
const base_2 = require("./base");
exports.getCacheKey = base_2.getCacheKey;
const redisSetting = __importStar(require("./redis"));
const redis_1 = require("./redis");
exports.SetCache = redis_1.SetCache;
const buildIDCommon_1 = require("./buildIDCommon");
const ioredis_1 = __importDefault(require("ioredis"));
const verify_1 = require("./verify");
const cloudFunctionIDFile = 'cloudFunctionID.json';
const cloudIdInfoMap = (fs_1.default.existsSync(cloudFunctionIDFile) && buildIDCommon_1.GetCloudInfoMap(JSON.parse(fs_1.default.readFileSync(cloudFunctionIDFile, 'utf8')))) || {};
let redis = redisSetting.redis;
let prefix = redisSetting.cachePrefix;
redisSetting.AddCacheUpdateCallback((params) => {
    redis = redisSetting.redis;
    prefix = redisSetting.cachePrefix;
});
let beforeInvoke;
let afterInvoke;
function SetInvokeCallback(params) {
    beforeInvoke = params.beforeInvoke;
    afterInvoke = params.afterInvoke;
}
exports.SetInvokeCallback = SetInvokeCallback;
let afterVerify;
function SetAfterVerify(params) {
    afterVerify = params.afterVerify;
}
exports.SetAfterVerify = SetAfterVerify;
let listener = {};
function SetListener(p) {
    listener = p || {};
}
exports.SetListener = SetListener;
const NODE_ENV = process.env.NODE_ENV || 'dev';
// // Schema 测试
// interface IKeyChoices {
//   [key: string]: string[]
// }
// interface Test extends CloudParams {
//   s:string
//   n:number
//   c?:boolean
//   a:number[]
//   o:{a:string,b:string[]}
//   i:IKeyChoices
// }
// let test:CloudOptions<Test> = {
//   schema:{
//     s:Joi.boolean(),
//     n:Joi.number(),
//     c:Joi.boolean(),
//     a: Joi.array(),
//     o:Joi.object(),
//     i:Joi.object()
//   }
// }
async function RateLimitCheck(params) {
    let { functionName, objectId, ip, rateLimit, cloudInvokeData } = params;
    if (rateLimit.length == 0)
        return;
    let pipeline = redis.pipeline();
    for (let i = 0; i < rateLimit.length; ++i) {
        let limit = rateLimit[i];
        let timeUnit = limit.timeUnit;
        let user = objectId || ip;
        let { startTimestamp, expires } = getCacheTime(limit.timeUnit);
        let date = startTimestamp.valueOf();
        let cacheKey = `${prefix}:rate:${timeUnit}-${date}:${functionName}:${user}`;
        pipeline.incr(cacheKey).expire(cacheKey, expires);
    }
    let result = await pipeline.exec();
    for (let i = 0; i < rateLimit.length; ++i) {
        let limit = rateLimit[i];
        let user = objectId || ip;
        let count = result[i * 2 + 0][1];
        if (count > limit.limit) {
            if (listener.onRateLimited) {
                listener.onRateLimited(cloudInvokeData);
            }
            throw new RateLimitError({
                functionName, user, count, limit: limit.limit, timeUnit: limit.timeUnit, code: 401
            });
        }
    }
}
function getTimeLength(timeUnit, count = 1) {
    return moment_1.default.duration(count, timeUnit || 'minute').asSeconds();
}
function getCacheTime(timeUnit, count = 1) {
    let startTimestamp = moment_1.default().startOf('day');
    let expires = 60 * 60 * 24;
    if (timeUnit) {
        startTimestamp = moment_1.default().startOf(timeUnit);
        // cacheKeyConfig['cacheTime'] = startTimestamp.toDate()
        let expireTimestamp = startTimestamp
            .clone()
            .add(count, timeUnit)
            .add(1, (timeUnit === 'second') ? 'second' : 'minute');
        expires =
            Math.floor((expireTimestamp.valueOf() - moment_1.default().valueOf()) / 1000);
    }
    return { startTimestamp, expires };
}
async function CloudImplementBefore(cloudImplementOptions) {
    let { functionName, request, cloudOptions, schema, rateLimit, roles, debounce, verify } = cloudImplementOptions;
    let cloudOptions2 = cloudOptions;
    beforeInvoke && await beforeInvoke({
        functionName,
        cloudOptions: cloudOptions2,
        request
    });
    cloudOptions && cloudOptions.beforeInvoke && await cloudOptions.beforeInvoke({
        functionName,
        cloudOptions: cloudOptions2,
        request
    });
    //内部调用, 跳过检测
    if (request.internal)
        return;
    //@ts-ignore
    let params = request.params || {};
    if (!request.noUser) {
        await CheckPermission(request.currentUser, cloudOptions && cloudOptions.noUser, roles);
    }
    if (schema) {
        CheckSchema(schema, params);
    }
    if (rateLimit) {
        await RateLimitCheck({ functionName,
            objectId: request.currentUser && request.currentUser.get('objectId'),
            ip: request.meta.remoteAddress,
            rateLimit,
            cloudInvokeData: {
                functionName,
                cloudOptions: cloudOptions2,
                request
            } });
    }
    if (verify) {
        await CheckVerify({ functionName,
            objectId: request.currentUser && request.currentUser.get('objectId'),
            ip: request.meta.remoteAddress, verify, params, user: request.currentUser });
    }
    if (debounce && request.currentUser) {
        await CheckDebounce(debounce, params, request.currentUser, 
        //@ts-ignore
        request.lock);
    }
}
async function CloudImplementAfter(cloudImplementOptions) {
    let { functionName, request, cloudOptions, data } = cloudImplementOptions;
    let cloudOptions2 = cloudOptions;
    if (cloudOptions && cloudOptions.afterInvoke) {
        data = await cloudOptions.afterInvoke({
            functionName,
            cloudOptions: cloudOptions2,
            request,
            data
        }) || data;
    }
    if (cloudOptions && cloudOptions.afterInvokes) {
        //@ts-ignore
        let version = request.params && request.params._api;
        if (version) {
            let fit = cloudOptions.afterInvokes.find(x => semver_1.default.valid(version.clientVersion) && semver_1.default.satisfies(version.clientVersion, x.semver));
            if (fit) {
                data = await fit.callback({
                    functionName,
                    cloudOptions: cloudOptions2,
                    request,
                    data
                }) || data;
            }
        }
    }
    if (afterInvoke) {
        data = await afterInvoke({
            functionName,
            cloudOptions: cloudOptions2,
            request,
            data
        }) || data;
    }
    return data;
}
async function CloudImplement(cloudImplementOptions) {
    let { functionName, request, handle, cloudOptions, schema, rateLimit, roles, disableCheck, debounce, verify } = cloudImplementOptions;
    if (!disableCheck) {
        await CloudImplementBefore(cloudImplementOptions);
    }
    let data = await handle(Object.assign({
        request,
        currentUser: request.currentUser,
        //@ts-ignore
        lock: request.lock
    }, request.params));
    if (!disableCheck) {
        data = await CloudImplementAfter({
            functionName,
            request,
            data,
            cloudOptions
        });
    }
    return data;
}
async function CheckPermission(currentUser, noUser, roles) {
    if (!currentUser && !noUser) {
        throw new leanengine_1.default.Cloud.Error('missing user', { code: 400 });
    }
    if (roles) {
        let havePermission = false;
        for (let i = 0; i < roles.length; ++i) {
            let role = roles[i];
            if (await base_1.isRoles(currentUser, role)) {
                havePermission = true;
                break;
            }
        }
        if (!havePermission) {
            throw new leanengine_1.default.Cloud.Error('non-permission', { code: 400 });
        }
    }
}
/**
 * 客户端版本错误
 */
class ClientApiVersionError extends Error {
    constructor(message = '') {
        super(message);
        this.name = 'ClientApiVersionError';
    }
}
exports.ClientApiVersionError = ClientApiVersionError;
class SchemaError extends Error {
    constructor(error) {
        super(error.message);
        this.validationError = error;
        this.name = 'SchemaError';
    }
}
exports.SchemaError = SchemaError;
class DebounceError extends Error {
    constructor(message = '') {
        super(message);
        this.name = 'DebounceError';
    }
}
exports.DebounceError = DebounceError;
class MissingVerify extends Error {
    constructor(message = '') {
        super(message);
        this.name = 'MissingVerify';
    }
}
exports.MissingVerify = MissingVerify;
class VerifyError extends Error {
    constructor(message = '') {
        super(message);
        this.name = 'VerifyError';
    }
}
exports.VerifyError = VerifyError;
class RateLimitError extends leanengine_1.default.Cloud.Error {
    constructor(params) {
        super(params.functionName + ' user ' + params.user + ' run ' + params.count + ' over limit ' + params.limit + ' in ' + params.timeUnit, { code: params.code });
        this.functionName = params.functionName;
        this.user = params.user;
        this.count = params.count;
        this.limit = params.limit;
        this.timeUnit = params.timeUnit;
        this.code = params.code;
    }
}
exports.RateLimitError = RateLimitError;
async function _CheckVerify(verify, params, user) {
    if (verify) {
        if (!params.cloudVerify) {
            throw new MissingVerify();
        }
        let verifyData;
        try {
            verifyData = await verify_1.SetVerify(Object.assign({ type: verify.type }, params.cloudVerify));
        }
        catch (error) {
            if (error instanceof Error) {
                throw new VerifyError(error.message);
            }
            else {
                throw new VerifyError(error);
            }
        }
        if (afterVerify) {
            await afterVerify(Object.assign({ user }, verifyData));
        }
    }
}
async function CheckVerify(params) {
    let { functionName, objectId, ip, verify } = params;
    if (!verify)
        return;
    let user = objectId || ip;
    let lockKey = `${prefix}:verify_lock:${functionName}:${user}`;
    let verified = false;
    if (await redis.get(lockKey)) {
        await _CheckVerify(verify, params.params, params.user);
        await redis.del(lockKey);
        verified = true;
    }
    // for (let i = 0; i < rateLimit.length; ++i)
    {
        // let limit = rateLimit[i]
        let timeUnit = verify.timeUnit;
        let { startTimestamp, expires } = getCacheTime(timeUnit);
        let date = startTimestamp.valueOf();
        let cacheKey = `${prefix}:verify_count:${timeUnit}-${date}:${functionName}:${user}`;
        let result = await redis.pipeline().incr(cacheKey).expire(cacheKey, expires).exec();
        const i = 0;
        let count = result[i * 2 + 0][1];
        if (count >= (verify.count || 1)) {
            let pipeline = redis.pipeline();
            pipeline.setex(cacheKey, expires, 0);
            if (verified) {
                await pipeline.exec();
            }
            else {
                await pipeline.setex(lockKey, verify.expire || 3600 * 24 * 30, 1).exec();
                await _CheckVerify(verify, params.params, params.user);
                await redis.del(lockKey);
            }
        }
        // pipeline.incr(cacheKey).expire(cacheKey, expires)
    }
}
async function CheckDebounce(debounce, params, currentUser, lock) {
    if (debounce) {
        if (debounce == true) {
            let key = currentUser.get('objectId');
            //符合缓存条件,记录所使用的查询keys
            if (!await lock.tryLock(key)) {
                throw new DebounceError('debounce error');
            }
        }
        else if (Array.isArray(debounce)) {
            //判断是否符合防抖条件
            let cacheParams = null;
            let paramsKeys = Object.keys(ClearInternalParams(params));
            for (let i = 0; i < debounce.length; ++i) {
                let _cacheParams = debounce[i];
                if (_cacheParams.length == paramsKeys.length &&
                    //@ts-ignore
                    paramsKeys.every(u => _cacheParams.indexOf(u) >= 0)) {
                    //@ts-ignore
                    cacheParams = _cacheParams;
                }
            }
            if (cacheParams) {
                let cacheKeyConfig = {};
                //符合缓存条件,记录所使用的查询keys
                for (let i = 0; i < cacheParams.length; ++i) {
                    let key = cacheParams[i];
                    cacheKeyConfig[key] = params[key];
                }
                cacheKeyConfig['currentUser'] = currentUser.get('objectId');
                let key = base_2.getCacheKey(cacheKeyConfig);
                //符合缓存条件,记录所使用的查询keys
                if (!await lock.tryLock(key)) {
                    throw new DebounceError('debounce error');
                }
            }
        }
    }
}
function CheckSchema(schema, params) {
    // console.log(params)
    // console.log('schema')
    const { error, value } = joi_1.default.validate(ClearInternalParams(params), schema);
    // console.log(error)
    // console.log(value)
    if (error) {
        throw new SchemaError(error);
        //new AV.Cloud.Error('schema error', { code: 400 })
    }
}
/**
 * 用于检测schema和判断是否需要缓存
 * @param params
 */
function ClearInternalParams(params) {
    let params2 = Object.assign({}, params);
    delete params2.noCache;
    delete params2.adminId;
    //@ts-ignore
    delete params2.api;
    //@ts-ignore
    delete params2.platform;
    //@ts-ignore
    delete params2.version;
    delete params2.cloudVerify;
    Object.keys(params2).forEach(e => { if (e.startsWith('_'))
        delete params2[e]; });
    // delete params2._api
    return params2;
}
function CreateCloudCacheFunction(info) {
    let { cache, handle, cloudOptions, functionName, rpc } = info;
    let _redis = cache.redisUrl && new ioredis_1.default(cache.redisUrl, { maxRetriesPerRequest: null });
    return async (request) => {
        let schema = info.schema || null;
        let debounce = info.debounce || null;
        let verify = info.verify || null;
        let rateLimit = cloudOptions.rateLimit || null;
        // console.log(functionName)
        //@ts-ignore
        let params = request.params || {};
        let roles = cloudOptions.roles || null;
        let cacheKeyConfig = {};
        const cacheParamsList = cache.params;
        if (cacheParamsList) {
            //判断是否符合缓存条件
            let cacheParams = null;
            let paramsKeys = Object.keys(ClearInternalParams(params));
            for (let i = 0; i < cacheParamsList.length; ++i) {
                let _cacheParams = cacheParamsList[i];
                if (_cacheParams.length == paramsKeys.length &&
                    //@ts-ignore
                    paramsKeys.every(u => _cacheParams.indexOf(u) >= 0)) {
                    //@ts-ignore
                    cacheParams = _cacheParams;
                }
            }
            if (cacheParams) {
                //符合缓存条件,记录所使用的查询keys
                for (let i = 0; i < cacheParams.length; ++i) {
                    let key = cacheParams[i];
                    cacheKeyConfig[key] = params[key];
                }
            }
            else {
                //不符合缓存条件,直接执行云函数
                // console.log(functionName+' CloudImplement(request, descriptor)')
                return CloudImplement({ functionName, request, handle, cloudOptions, schema, rateLimit, roles, debounce, verify });
            }
        }
        let cloudParams = params;
        //是否执行非缓存的调试版本
        if (cloudParams.noCache) {
            if (params.adminId &&
                (await base_1.isRole(leanengine_1.default.Object.createWithoutData('_User', params.adminId), 'Dev'))) {
            }
            else {
                throw new leanengine_1.default.Cloud.Error('non-administrators in noCache', { code: 400 });
            }
            let { startTimestamp, expires } = getCacheTime(cache.timeUnit);
            let results = await CloudImplement({ functionName, request, handle, cloudOptions, schema, rateLimit, roles, debounce, verify });
            if (typeof results === 'object') {
                results.__timestamp = startTimestamp.valueOf();
            }
            console.log(functionName + ' CloudImplement no cache');
            return Promise.resolve(results);
        }
        await CloudImplementBefore({ functionName, request, cloudOptions, schema, rateLimit, roles, debounce, verify });
        if (cache.currentUser) {
            cacheKeyConfig['currentUser'] = request.currentUser;
        }
        cacheKeyConfig['timeUnit'] = cache.timeUnit;
        let cacheKey = `${redisSetting.cachePrefix}:cloud:${NODE_ENV}:${functionName}:` + base_2.getCacheKey(cacheKeyConfig);
        // console.log(functionName + ' CloudImplement Cache')
        //尝试获取缓存
        let redis2 = _redis || redis;
        let cacheResults = await redis2.pipeline().get(cacheKey).get(cacheKey + ':timestamp').exec();
        let textResult = cacheResults[0][1];
        // let textResult = await redis2.get(cacheKey)
        if (textResult) {
            let timestamp = cacheResults[1][1] && parseInt(cacheResults[1][1]);
            try {
                cloudStats_1.IncrCache({
                    function: functionName,
                    //@ts-ignore
                    platform: params.platform,
                    //@ts-ignore
                    api: params.api,
                    //@ts-ignore
                    version: params.version,
                });
                // if(rpc){
                //   return AV.parseJSON(JSON.parse( textResult ) )
                // }
                let data = leancloud_storage_1.default.parse(textResult);
                if (typeof data === 'object') {
                    data.__timestamp = timestamp;
                }
                //@ts-ignore
                return await CloudImplementAfter({
                    functionName,
                    request,
                    data,
                    cloudOptions
                });
            }
            catch (error) {
                return textResult;
            }
        }
        //获取缓存失败,执行原始云函数
        let results = await CloudImplement({ functionName, request, handle, cloudOptions, schema, rateLimit, roles, disableCheck: true, debounce, verify });
        let expireBy = cache.expireBy || 'request';
        let startTimestamp;
        let expires;
        if (expireBy === 'timeUnit') {
            let result = getCacheTime(cache.timeUnit, cache.count);
            startTimestamp = result.startTimestamp;
            expires = result.expires;
        }
        else if (expireBy === 'request') {
            startTimestamp = moment_1.default();
            expires = getTimeLength(cache.timeUnit, cache.count);
        }
        else {
            console.error('error expireBy ' + expireBy);
            startTimestamp = moment_1.default();
            expires = getTimeLength(cache.timeUnit, cache.count);
        }
        let timestamp = startTimestamp.valueOf();
        // if (typeof results === 'object') {
        //   results.__timestamp = startTimestamp.valueOf()
        //   if(rpc) {
        //     // if(results instanceof AV.Object){
        //     //   results = results.toFullJSON()
        //     // }else if(Array.isArray(results)){
        //     //   results = results.map(e=> (e instanceof AV.Object&&e.toFullJSON())|| e)
        //     // }
        //   }
        // }
        let cacheValue;
        if (typeof results === 'string') {
            cacheValue = results;
        }
        else {
            // cacheValue = JSON.stringify(results)
            //@ts-ignore
            cacheValue = leancloud_storage_1.default.stringify(results);
            if (typeof results === 'object') {
                results.__timestamp = timestamp;
            }
        }
        redis2.multi().setex(cacheKey, expires, cacheValue).setex(cacheKey + ':timestamp', expires, timestamp).exec();
        return await CloudImplementAfter({
            functionName,
            request,
            data: results,
            cloudOptions
        });
        // return Promise.resolve(results)
    };
}
/**
 * 将函数加入云函数中,云函数名为 ``类名.函数名``
 */
function Cloud(params) {
    return function (target, propertyKey, descriptor) {
        var _a, _b, _c, _d, _e;
        const handle = descriptor.value;
        let functionName = (target.name || target.constructor.name) + '.' + propertyKey;
        // console.log(target.constructor.name)
        if (params) {
            params.moduleId = ((_a = params) === null || _a === void 0 ? void 0 : _a.moduleId) || ((_b = cloudIdInfoMap[(target.name || target.constructor.name)]) === null || _b === void 0 ? void 0 : _b.id);
            params.functionId = (_e = (_d = (_c = cloudIdInfoMap[(target.name || target.constructor.name)]) === null || _c === void 0 ? void 0 : _c.functions) === null || _d === void 0 ? void 0 : _d[propertyKey]) === null || _e === void 0 ? void 0 : _e.id;
        }
        let fitEnvironment = true;
        //判断是否符合运行环境
        if (params && params.environment) {
            if (Array.isArray(params.environment)) {
                if (params.environment.indexOf(NODE_ENV) < 0) {
                    fitEnvironment = false;
                }
                else if (typeof params.environment === 'string') {
                    let environment = params.environment;
                    if (environment != NODE_ENV)
                        fitEnvironment = false;
                }
                else {
                    console.error('error environment type ' +
                        params.environment +
                        ' in function ' +
                        functionName);
                }
            }
        }
        //符合运行环境
        if (fitEnvironment) {
            let cloudFunction;
            let schema = params && params.schema && joi_1.default.object().keys(params.schema);
            if (schema && (params && params.schemaCb)) {
                schema = params.schemaCb(schema);
            }
            let rateLimit = params && params.rateLimit || null;
            let roles = params && params.roles || null;
            let debounce = params && params.debounce || null;
            let verify = params && params.verify;
            // console.log(params)
            if (params && params.cache) {
                //缓存版本
                const cache = params.cache;
                console.log(functionName + ' cache cloud function');
                const rpc = params.rpc;
                cloudFunction = CreateCloudCacheFunction({
                    cache,
                    handle,
                    functionName,
                    cloudOptions: params,
                    schema,
                    rpc,
                    verify
                });
            }
            else {
                // console.log(functionName + ' normal cloud function')
                //无缓存版本
                cloudFunction = (request) => CloudImplement({ functionName, request, handle, cloudOptions: params, schema: schema || null, rateLimit, roles, debounce, verify: verify || null });
            }
            let afterInvokes = params && params.afterInvokes;
            if (afterInvokes) {
                let errorRange = afterInvokes.filter(e => !semver_1.default.validRange(e.semver));
                //检查合法性
                if (errorRange.length > 0) {
                    console.error(functionName + ': Error afterInvokes semver: ' + errorRange.map(e => e.semver).join(', '));
                }
                //检测是否存在范围相交
                let errorIntersects = afterInvokes.filter((e, i) => afterInvokes.find((e2, i2) => i != i2 && semver_1.default.intersects(e.semver, e2.semver)));
                if (errorIntersects.length > 0) {
                    console.error(functionName + ': Error afterInvokes semver: ' + errorIntersects.map(e => e.semver).join(', '));
                }
            }
            if (params && params.internal) {
                console.log('internal function ' + base_1.cloudPrefix + functionName);
                leanengine_1.default.Cloud.define(base_1.cloudPrefix + functionName, { internal: true }, (request) => {
                    let currentUser = request && request.currentUser;
                    let params2 = request && request.params;
                    return cloudFunction({ currentUser, params: params2, noUser: true, internal: true });
                }, 
                //@ts-ignore
                params);
                //创建别名函数
                if (params && params.optionalName) {
                    leanengine_1.default.Cloud.define(params.optionalName, { internal: true }, cloudFunction, 
                    //@ts-ignore
                    params);
                }
            }
            else {
                let options = {};
                if (params && params.noUser && !params.fetchUser) {
                    options.fetchUser = false;
                }
                leanengine_1.default.Cloud.define(base_1.cloudPrefix + functionName, options, cloudFunction, 
                //@ts-ignore
                params);
                //创建别名函数
                if (params && params.optionalName) {
                    leanengine_1.default.Cloud.define(params.optionalName, options, cloudFunction, 
                    //@ts-ignore
                    params);
                }
            }
            descriptor.value = (params) => {
                let currentUser = params && params.currentUser;
                let params2 = Object.assign({}, params);
                delete params2.lock;
                delete params2.currentUser;
                delete params2.request;
                return cloudFunction({ currentUser, params: params2, noUser: true, internal: true });
            };
        }
        // console.log(target.name)
        // console.log(propertyKey)
        // console.log(descriptor)
        // target: 对于静态成员来说是类的构造函数，对于实例成员是类的原型对象
        // propertyKey: 成员的名字
        // descriptor: 成员的属性描述符 {value: any, writable: boolean, enumerable: boolean, configurable: boolean}
    };
}
exports.Cloud = Cloud;
//# sourceMappingURL=leancloud-cloud-decorator.js.map