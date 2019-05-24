import AV, { request } from 'leanengine'
import Joi from 'joi'
import moment from 'moment'
import {isRole,isRoles} from './base'

import { Platform,getCacheKey } from './base'
export { Platform,getCacheKey }

import * as redisSetting  from './redis'
import {SetCache} from './redis'

export {SetCache}

let redis = redisSetting.redis
let prefix = redisSetting.cachePrefix

redisSetting.AddCacheUpdateCallback((params)=>{
  redis = redisSetting.redis
  prefix = redisSetting.cachePrefix
})

type Environment = 'production' | 'staging' | string

interface CacheOptions<T> {
  params: Array<Array<keyof T>>
  timeUnit?: 'day' | 'hour' | 'minute' | 'month'
  /**
   * 缓存时长,单位为timeUnit,默认为1
   */
  count?:number
  // time:number
  currentUser?: boolean
  //过期时间基于时间单位还是请求时间. 默认request
  expireBy?: 'timeUnit' | 'request' 
}

interface RateLimitOptions {
  limit: number,
  timeUnit: 'day' | 'hour' | 'minute' | 'second' | 'month' 
}

//https://stackoverflow.com/questions/48215950/exclude-property-from-type
type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>

// unwrap up to one level
type Unarray<T> = T extends Array<infer U> ? U : T;

// interface TypedObjectSchema<T> extends Joi.ObjectSchema {}
// given a <T> we can use typescript 2.8 conditional types to map different
// primative types to Joi schemas
type TypedSchemaLike<T> = T extends string ? Joi.StringSchema :
                                  T extends Array<infer U> ? Joi.ArraySchema :
                                  T extends number ? Joi.NumberSchema :
                                  T extends Date ? Joi.DateSchema :
                                  T extends boolean ? Joi.BooleanSchema :
                                  // T extends Object ? TypedObjectSchema<T> :
                                  T extends Buffer ? Joi.BinarySchema :
                                  T extends Object ? Joi.ObjectSchema :
                                  // T extends number[] ? Joi.NumberSchema :
                                  Joi.AnySchema;

type TypedObjectSchema<T> = { [key in keyof T]-?: TypedSchemaLike<T[key]> }

/**
 * T为云函数的参数类型
 */
interface CloudOptions<T extends CloudParams> {
  platforms?: Array<Platform>
  rpc?: boolean
  environment?: Environment | Environment[]
  cache?: CacheOptions<T>
  optionalName?: string,
  schema: { [key in keyof Omit<T, keyof CloudParams>]-?: TypedSchemaLike<T[key]> },
  schemaCb?: (schema: Joi.ObjectSchema) => Joi.ObjectSchema,
  noUser?: true,
  roles?: string[][]
  rateLimit?: RateLimitOptions[]
  internal?:true
}
const NODE_ENV = process.env.NODE_ENV as string

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

async function RateLimitCheck(functionName: string, objectId: string, rateLimit: RateLimitOptions[]) {
  if(rateLimit.length==0) return
  let pipeline = redis.pipeline()
  for (let i = 0; i < rateLimit.length; ++i){
    let limit = rateLimit[i]
    let timeUnit = limit.timeUnit
    let { startTimestamp, expires } = getCacheTime(limit.timeUnit)
    let date = startTimestamp.valueOf()
    let cacheKey = `${prefix}:rate:${timeUnit}-${date}:${functionName}:${objectId}`
    pipeline.incr(cacheKey).expire(cacheKey, expires)
  }
  let result = await pipeline.exec()
  
  for (let i = 0; i < rateLimit.length; ++i) {
    let limit = rateLimit[i]
    let count = result[i*2+0][1]
    if (count > limit.limit) {
      throw new AV.Cloud.Error(functionName + ' userId ' + objectId + ' run ' + count + ' over limit ' + limit.limit + ' in ' + limit.timeUnit, { code: 401 })
    }
  }
}

function getTimeLength(timeUnit?: 'day' | 'hour' | 'minute' | 'month',count=1) {
  return moment.duration(count,timeUnit||'minute').asSeconds()
}

function getCacheTime(timeUnit?: 'day' | 'hour' | 'minute' | 'second' | 'month',count=1) {

  let startTimestamp = moment().startOf('day')
  let expires = 60 * 60 * 24
  if (timeUnit) {
    startTimestamp = moment().startOf(timeUnit)
    // cacheKeyConfig['cacheTime'] = startTimestamp.toDate()
    let expireTimestamp = startTimestamp
      .clone()
      .add(count, timeUnit)
      .add(1, (timeUnit === 'second') ? 'second':'minute')
    expires =
      Math.floor((expireTimestamp.valueOf() - moment().valueOf()) / 1000)
  }
  return { startTimestamp, expires }
}

type CloudHandler = (params: CloudParams) => Promise<any>

async function CloudImplement(cloudImplementOptions: {
  functionName: string
  request: AV.Cloud.CloudFunctionRequest
  handle: CloudHandler
  cloudOptions: CloudOptions<any> | null
  schema: Joi.ObjectSchema | null
  rateLimit: RateLimitOptions[] | null
  roles:string[][]|null
}) {
  let { functionName, request, handle, cloudOptions, schema, rateLimit,roles } = cloudImplementOptions
  //@ts-ignore
  let params: CloudParams = request.params || {}

  //是否执行非缓存的调试版本
  if (params.noCache) {
    if (
      params.adminId &&
      (await isRole(
        AV.Object.createWithoutData('_User', params.adminId) as AV.User,
        'Dev'
      ))
    ) {
    } else {
      throw new AV.Cloud.Error('non-administrators in noCache', { code: 400 })
    }
  }
  await CheckPermission(request.currentUser,cloudOptions&&cloudOptions.noUser,roles)
  if (schema) {
    CheckSchema(schema, params)
  }
  if (rateLimit && request.currentUser) {
    await RateLimitCheck(functionName, request.currentUser.get('objectId'), rateLimit)
  }

  params.currentUser = request.currentUser
  //@ts-ignore
  params.lock = request.lock
  return handle(params)
}

async function CheckPermission(currentUser?:AV.User, noUser?:true|null,roles?:string[][]|null) {
  if (!currentUser && !noUser) {
    throw new AV.Cloud.Error('missing user', { code: 400 })
  }
  if(currentUser&&currentUser.get('marked')){
    throw new AV.Cloud.Error('Banned user', { code: 400 })
  }
  if (roles) {
    let havePermission = false
    for (let i = 0; i < roles.length; ++i) {
      let role = roles[i]
      if (await isRoles(currentUser!, role)) {
        havePermission = true
        break
      }
    }
    if (!havePermission) {
      throw new AV.Cloud.Error('non-permission', { code: 400 })
    }
  }
}

function CheckSchema(schema: Joi.ObjectSchema, params: CloudParams) {
  // console.log(params)
  // console.log('schema')
  const { error, value } = Joi.validate(ClearInternalParams(params), schema)
  // console.log(error)
  // console.log(value)
  if (error) {
    throw new AV.Cloud.Error('schema error:' + error, { code: 400 })
  }
}

/**
 * 用于检测schema和判断是否需要缓存
 * @param params 
 */
function ClearInternalParams(params){
  let params2 = Object.assign({}, params)
  delete params2.noCache
  delete params2.adminId
  //@ts-ignore
  delete params2.api
  //@ts-ignore
  delete params2.platform
  //@ts-ignore
  delete params2.version
  return params2
}

function CreateCloudCacheFunction<T>(info: {
  cache: CacheOptions<T>
  handle: CloudHandler
  functionName: string,
  cloudOptions: CloudOptions<any>,
  schema?: Joi.ObjectSchema
}) {
  return async (request: AV.Cloud.CloudFunctionRequest) => {

    let { cache, handle, cloudOptions, functionName } = info
    let schema = info.schema || null
    let rateLimit = cloudOptions.rateLimit || null
    // console.log(functionName)
    //@ts-ignore
    let params: CloudParams = request.params || {}
    let roles = cloudOptions.roles || null
    await CheckPermission(request.currentUser, cloudOptions.noUser, roles)
    roles = null

    if (schema) {
      CheckSchema(schema, params)
      schema = null
    }
    if (rateLimit && request.currentUser) {
      await RateLimitCheck(functionName, request.currentUser.get('objectId'), rateLimit)
      rateLimit = null
    }
    let cacheKeyConfig = {}
    const cacheParamsList = cache.params
    if (cacheParamsList) {
      //判断是否符合缓存条件
      let cacheParams: string[] | null = null
      let paramsKeys = Object.keys(ClearInternalParams(params))
      for (let i = 0; i < cacheParamsList.length; ++i) {
        let _cacheParams = cacheParamsList[i]
        if (
          _cacheParams.length == paramsKeys.length &&
          //@ts-ignore
          paramsKeys.every(u => _cacheParams.indexOf(u) >= 0)
        ) {
          //@ts-ignore
          cacheParams = _cacheParams
        }
      }
      if (cacheParams) {
        //符合缓存条件,记录所使用的查询keys
        for (let i = 0; i < cacheParams.length; ++i) {
          let key = cacheParams[i]
          cacheKeyConfig[key] = params[key]
        }
      } else {
        //不符合缓存条件,直接执行云函数
        // console.log(functionName+' CloudImplement(request, descriptor)')
        return CloudImplement({ functionName, request, handle, cloudOptions, schema, rateLimit,roles })
      }
    }
    let cloudParams: CloudParams = params
    //是否执行非缓存的调试版本
    if (cloudParams.noCache) {
      let { startTimestamp, expires } = getCacheTime(cache.timeUnit)
      let results = await CloudImplement({ functionName, request, handle, cloudOptions, schema, rateLimit,roles })
      if (typeof results === 'object') {
        results.timestamp = startTimestamp.valueOf()
      }
      console.log(functionName + ' CloudImplement no cache')
      return Promise.resolve(results)
    }

    if (cache.currentUser) {
      cacheKeyConfig['currentUser'] = request.currentUser
    }
    cacheKeyConfig['timeUnit'] = cache.timeUnit
    let cacheKey = `${redisSetting.cachePrefix}:cloud:${functionName}:` + getCacheKey(cacheKeyConfig)

    // console.log(functionName + ' CloudImplement Cache')
    //尝试获取缓存
    let textResult = await redis.get(cacheKey)
    if (textResult) {
      try {
        return JSON.parse(textResult)
      } catch (error) {
        return textResult
      }
    }
    //获取缓存失败,执行原始云函数
    let results = await CloudImplement({ functionName, request, handle, cloudOptions, schema, rateLimit,roles })
    let expireBy = cache.expireBy || 'request'
    let startTimestamp: moment.Moment
    let expires: number
  
    if (expireBy === 'timeUnit') {
      let result = getCacheTime(cache.timeUnit,cache.count)
      startTimestamp = result.startTimestamp
      expires = result.expires
    } else if (expireBy === 'request') {
      startTimestamp = moment()
      expires = getTimeLength(cache.timeUnit,cache.count)
    } else {
      console.error('error expireBy ' + expireBy)
      startTimestamp = moment()
      expires = getTimeLength(cache.timeUnit,cache.count)
    }
    
    if (typeof results === 'object') {
      results.timestamp = startTimestamp.valueOf()
    }
    let cacheValue: string
    if (typeof results === 'string') {
      cacheValue = results
    } else {
      cacheValue = JSON.stringify(results)
    }
    redis.setex(cacheKey, expires, cacheValue)
    return Promise.resolve(results)
  }
}

export function Cloud<T extends CloudParams>(params?: CloudOptions<T>) {
  return function(target, propertyKey: string, descriptor: PropertyDescriptor) {
    const handle:CloudHandler = descriptor.value
    let functionName =
      (target.name || target.constructor.name) + '.' + propertyKey
    // console.log(target.constructor.name)
    let fitEnvironment = true
    //判断是否符合运行环境
    if (params && params.environment) {
      if (Array.isArray(params.environment)) {
        if (params.environment.indexOf(NODE_ENV) < 0) {
          fitEnvironment = false
        } else if (typeof params.environment === 'string') {
          let environment = params.environment as string
          if (environment != NODE_ENV) fitEnvironment = false
        } else {
          console.error(
            'error environment type ' +
              params.environment +
              ' in function ' +
              functionName
          )
        }
      }
    }

    //符合运行环境
    if (fitEnvironment) {
      let cloudFunction
      let schema = params && params.schema && Joi.object().keys(params.schema as Joi.SchemaMap)
      if (schema && (params && params.schemaCb)) {
        schema = params.schemaCb(schema)
      }
      let rateLimit = params && params.rateLimit || null
      let roles = params && params.roles|| null
      // console.log(params)
      if (params && params.cache) {
        //缓存版本
        const cache = params.cache
        console.log(functionName+' cache cloud function')
        cloudFunction = CreateCloudCacheFunction({
          cache,
          handle,
          functionName,
          cloudOptions: params,
          schema
        })
      } else {
        // console.log(functionName + ' normal cloud function')
        //无缓存版本
        cloudFunction = (request) => CloudImplement({ functionName, request, handle, cloudOptions: params as CloudOptions<any>, schema: schema || null, rateLimit,roles })
      }
      if (params && params.internal) {
        console.log('internal function '+functionName)
      } else {
        AV.Cloud.define(functionName, cloudFunction)
        //创建别名函数
        if (params && params.optionalName) {
          AV.Cloud.define(params.optionalName, cloudFunction)
        }
      }
      descriptor.value = (params: CloudParams) => {
        let currentUser = params.currentUser
        let params2 = Object.assign({}, params)
        delete params2.lock
        delete params2.currentUser
        delete params2.request
        return cloudFunction({ currentUser: params.currentUser, params:params2 })
      }
    }

    // console.log(target.name)
    // console.log(propertyKey)
    // console.log(descriptor)
    // target: 对于静态成员来说是类的构造函数，对于实例成员是类的原型对象
    // propertyKey: 成员的名字
    // descriptor: 成员的属性描述符 {value: any, writable: boolean, enumerable: boolean, configurable: boolean}
  }
}

export interface Lock {
  tryLock(key: string): boolean
}
export interface CloudParams {
  currentUser?: AV.User
  lock: Lock
  request: AV.Cloud.CloudFunctionRequest,
  noCache?: boolean,
  adminId?: string
}