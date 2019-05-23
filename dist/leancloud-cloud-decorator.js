"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const leanengine_1 = __importDefault(require("leanengine"));
const joi_1 = __importDefault(require("joi"));
const moment_1 = __importDefault(require("moment"));
const lodash_1 = __importDefault(require("lodash"));
const base_1 = require("./base");
exports.Platform = base_1.Platform;
let redis;
let cachePrefix = 'pteppp';
function SetCache(params) {
    redis = params.cache;
    cachePrefix = params.cachePrefix || 'pteppp';
}
exports.SetCache = SetCache;
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
function isRoles(avUser, roleArray) {
    return getRoleNames(avUser)
        .then(roleNames => {
        let diffArray = lodash_1.default.difference(roleArray, roleNames);
        let isContained = diffArray.length === 0;
        return Promise.resolve(isContained);
    });
}
function getQueryValueForCache(value) {
    switch (typeof value) {
        case 'string':
            return encodeURIComponent(value);
        case 'number':
        case 'boolean':
            return '' + value;
        case 'object': {
            if (value instanceof leanengine_1.default.Object) {
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
const NODE_ENV = process.env.NODE_ENV;
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
async function RateLimitCheck(functionName, objectId, rateLimit) {
    if (rateLimit.length == 0)
        return;
    let pipeline = redis.pipeline();
    for (let i = 0; i < rateLimit.length; ++i) {
        let limit = rateLimit[i];
        let timeUnit = limit.timeUnit;
        let { startTimestamp, expires } = getCacheTime(limit.timeUnit);
        let date = startTimestamp.valueOf();
        let cacheKey = `pteppp:rate:${timeUnit}-${date}:${functionName}:${objectId}`;
        pipeline.incr(cacheKey).expire(cacheKey, expires);
    }
    let result = await pipeline.exec();
    for (let i = 0; i < rateLimit.length; ++i) {
        let limit = rateLimit[i];
        let count = result[i * 2 + 0][1];
        if (count > limit.limit) {
            throw new leanengine_1.default.Cloud.Error(functionName + ' userId ' + objectId + ' run ' + count + ' over limit ' + limit.limit + ' in ' + limit.timeUnit, { code: 401 });
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
async function CloudImplement(cloudImplementOptions) {
    let { functionName, request, handle, cloudOptions, schema, rateLimit, roles } = cloudImplementOptions;
    //@ts-ignore
    let params = request.params || {};
    //是否执行非缓存的调试版本
    if (params.noCache) {
        if (params.adminId &&
            (await isRole(leanengine_1.default.Object.createWithoutData('_User', params.adminId), 'Dev'))) {
        }
        else {
            throw new leanengine_1.default.Cloud.Error('non-administrators in noCache', { code: 400 });
        }
    }
    await CheckPermission(request.currentUser, cloudOptions && cloudOptions.noUser, roles);
    if (schema) {
        CheckSchema(schema, params);
    }
    if (rateLimit && request.currentUser) {
        await RateLimitCheck(functionName, request.currentUser.get('objectId'), rateLimit);
    }
    params.currentUser = request.currentUser;
    //@ts-ignore
    params.lock = request.lock;
    return handle(params);
}
async function CheckPermission(currentUser, noUser, roles) {
    if (!currentUser && !noUser) {
        throw new leanengine_1.default.Cloud.Error('missing user', { code: 400 });
    }
    if (currentUser && currentUser.get('marked')) {
        throw new leanengine_1.default.Cloud.Error('Banned user', { code: 400 });
    }
    if (roles) {
        let havePermission = false;
        for (let i = 0; i < roles.length; ++i) {
            let role = roles[i];
            if (await isRoles(currentUser, role)) {
                havePermission = true;
                break;
            }
        }
        if (!havePermission) {
            throw new leanengine_1.default.Cloud.Error('non-permission', { code: 400 });
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
        throw new leanengine_1.default.Cloud.Error('schema error:' + error, { code: 400 });
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
    return params2;
}
function CreateCloudCacheFunction(info) {
    return async (request) => {
        let { cache, handle, cloudOptions, functionName } = info;
        let schema = info.schema || null;
        let rateLimit = cloudOptions.rateLimit || null;
        // console.log(functionName)
        //@ts-ignore
        let params = request.params || {};
        let roles = cloudOptions.roles || null;
        await CheckPermission(request.currentUser, cloudOptions.noUser, roles);
        roles = null;
        if (schema) {
            CheckSchema(schema, params);
            schema = null;
        }
        if (rateLimit && request.currentUser) {
            await RateLimitCheck(functionName, request.currentUser.get('objectId'), rateLimit);
            rateLimit = null;
        }
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
                return CloudImplement({ functionName, request, handle, cloudOptions, schema, rateLimit, roles });
            }
        }
        let cloudParams = params;
        //是否执行非缓存的调试版本
        if (cloudParams.noCache) {
            let { startTimestamp, expires } = getCacheTime(cache.timeUnit);
            let results = await CloudImplement({ functionName, request, handle, cloudOptions, schema, rateLimit, roles });
            if (typeof results === 'object') {
                results.timestamp = startTimestamp.valueOf();
            }
            console.log(functionName + ' CloudImplement no cache');
            return Promise.resolve(results);
        }
        if (cache.currentUser) {
            cacheKeyConfig['currentUser'] = request.currentUser;
        }
        cacheKeyConfig['timeUnit'] = cache.timeUnit;
        let cacheKey = `${cachePrefix}:cloud:${functionName}:` + getCacheKey(cacheKeyConfig);
        // console.log(functionName + ' CloudImplement Cache')
        //尝试获取缓存
        let textResult = await redis.get(cacheKey);
        if (textResult) {
            try {
                return JSON.parse(textResult);
            }
            catch (error) {
                return textResult;
            }
        }
        //获取缓存失败,执行原始云函数
        let results = await CloudImplement({ functionName, request, handle, cloudOptions, schema, rateLimit, roles });
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
        if (typeof results === 'object') {
            results.timestamp = startTimestamp.valueOf();
        }
        let cacheValue;
        if (typeof results === 'string') {
            cacheValue = results;
        }
        else {
            cacheValue = JSON.stringify(results);
        }
        redis.setex(cacheKey, expires, cacheValue);
        return Promise.resolve(results);
    };
}
function Cloud(params) {
    return function (target, propertyKey, descriptor) {
        const handle = descriptor.value;
        let functionName = (target.name || target.constructor.name) + '.' + propertyKey;
        // console.log(target.constructor.name)
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
            // console.log(params)
            if (params && params.cache) {
                //缓存版本
                const cache = params.cache;
                console.log(functionName + ' cache cloud function');
                cloudFunction = CreateCloudCacheFunction({
                    cache,
                    handle,
                    functionName,
                    cloudOptions: params,
                    schema
                });
            }
            else {
                // console.log(functionName + ' normal cloud function')
                //无缓存版本
                cloudFunction = (request) => CloudImplement({ functionName, request, handle, cloudOptions: params, schema: schema || null, rateLimit, roles });
            }
            if (params && params.internal) {
                console.log('internal function ' + functionName);
            }
            else {
                leanengine_1.default.Cloud.define(functionName, cloudFunction);
                //创建别名函数
                if (params && params.optionalName) {
                    leanengine_1.default.Cloud.define(params.optionalName, cloudFunction);
                }
            }
            descriptor.value = (params) => {
                let currentUser = params.currentUser;
                let params2 = Object.assign({}, params);
                delete params2.lock;
                delete params2.currentUser;
                delete params2.request;
                return cloudFunction({ currentUser: params.currentUser, params: params2 });
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