import AV, { request } from 'leanengine'
import AV2 from 'leancloud-storage'
import Joi, { any, object } from 'joi'
import moment from 'moment'
import {isRole,isRoles,cloudPrefix} from './base'
import { IncrCache } from './cloudStats'
import {SDKVersion} from './cloudHandler'
import semver from 'semver'
import fs from 'fs'

import { Platform,getCacheKey } from './base'
export { Platform,getCacheKey }

import * as redisSetting  from './redis'
import {SetCache} from './redis'
import {CloudIdConfig,CloudIdInfo,GetCloudInfo,GetCloudInfoMap,CloudIdInfoMap} from './buildIDCommon'

export {SetCache}
import Redis from 'ioredis'
import { VerifyType, SetVerifyParams, SetVerify, VerifyParams } from './verify'

const cloudFunctionIDFile = 'cloudFunctionID.json'
const cloudIdInfoMap : CloudIdInfoMap = (fs.existsSync(cloudFunctionIDFile) && GetCloudInfoMap(JSON.parse( fs.readFileSync(cloudFunctionIDFile,'utf8'))))||{}

let redis = redisSetting.redis
let prefix = redisSetting.cachePrefix

redisSetting.AddCacheUpdateCallback((params)=>{
  redis = redisSetting.redis
  prefix = redisSetting.cachePrefix
})

export interface CloudInvokeParams<T>{
  functionName:string
  request:AV.Cloud.CloudFunctionRequest & {noUser?:true, internal?:true} &{internalData?:T} & {params:{_api?:SDKVersion}}
  data?:any
  cloudOptions?:CloudOptions<any>
}

export type CloudInvoke<T> = (params:CloudInvokeParams<T>)=>Promise<any>

export type SemverCloudInvoke<T> = {
  /**
   * 平台
   */
  platform:Platform,
  /**
   * 可执行的版本
   */
  semver:string,
  /**
   * 符合条件时的回调
   */
  callback:CloudInvoke<T>
}

// export type CloudInvoke<T> = (params:{
//   functionName:string
//   request:AV.Cloud.CloudFunctionRequest & {noUser?:true, internal?:true} &{internalData?:T}
//   data?:any
//   cloudOptions?:CloudOptions<any>
// })=>Promise<any>
export type CloudInvokeBefore<T> = CloudInvoke<T>

let beforeInvoke:CloudInvoke<any>|undefined
let afterInvoke:CloudInvoke<any>|undefined

export function SetInvokeCallback<T>(params:{
  beforeInvoke?:CloudInvokeBefore<T>,
  afterInvoke?:CloudInvoke<T>
}){
  beforeInvoke = params.beforeInvoke
  afterInvoke = params.afterInvoke
}

let afterVerify:((params:VerifyParams&{user?:AV.User})=>Promise<void>)|undefined
export function SetAfterVerify(params:{afterVerify:(params:VerifyParams&{user?:AV.User})=>Promise<void>}){
  afterVerify = params.afterVerify
}

type Environment = 'production' | 'staging' | string

interface CacheOptions<T> {
  /**
   * 需要缓存的参数条件,请求参数完全符合其中某个数组中的参数组合时,才调用缓存. _开头为内部参数,不会被判断
   */
  params: Array<Array<keyof T>>
  /**
   * 存储的时间长度单位
   */
  timeUnit?: 'day' | 'hour' | 'minute' | 'month' | 'second'
  /**
   * 缓存时长,单位为timeUnit,默认为1
   */
  count?:number
  // time:number
  /**
   * 是否每个用户分别使用一个缓存
   */
  currentUser?: boolean
  /**
   * 过期时间基于时间单位还是请求时间. 默认request. timeUnit为某个时间单位的整点开始即时,request为请求的时候开始计时
   */
  expireBy?: 'timeUnit' | 'request' 
  /**
   * redis 地址, 不填则使用默认redis
   */
  redisUrl?:string
}

interface RateLimitOptions {
  /**
   * 时间数量
   */
  limit: number,
  /**
   * 时间单位
   */
  timeUnit: 'day' | 'hour' | 'minute' | 'second' | 'month' 
}

export interface VerifyOptions{
  /**
   * 验证类型
   */
  type:VerifyType
  /**
   * 多少次调用需要走一次验证
   */
  count?:number
  /**
   * 时间单位
   */
  timeUnit: 'day' | 'hour' | 'minute' | 'second' | 'month' 
  /**
   * 过期时间,单位为秒. 默认为30天
   */
  expire?:number
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
interface CloudOptions<T extends CloudParams,A=any> {
  /**
   * 自动生成SDK的平台
   */
  platforms?: Array<Platform>
  /**
   * 是否为RPC调用
   */
  rpc?: boolean
  /**
   * 运行环境,生产环境还是预备环境
   */
  environment?: Environment | Environment[]
  /**
   * 缓存配置
   */
  cache?: CacheOptions<T>
  /**
   * 防抖配置
   */
  debounce?:boolean | Array<Array<keyof T>>
  /**
   * 备选名,用于让新的云函数,兼容旧的云函数调用
   */
  optionalName?: string,
  /**
   * 参数的schema, 必填参数记得加上 .required() . _开头为内部参数,不会被判断
   */
  schema: { [key in keyof Omit<T, keyof CloudParams>]-?: TypedSchemaLike<T[key]> },
  /**
   * schema的回调,提供更多配置选项用
   */
  schemaCb?: (schema: Joi.ObjectSchema) => Joi.ObjectSchema,
  /**
   * 可以无用户调用此云函数
   */
  noUser?: true,
  /**
   * 调用此云函数需要的权限
   */
  roles?: string[][]
  /**
   * 每个用户调用此云函数的频率设置, 没有用户情况下, 使用ip限流
   */
  rateLimit?: RateLimitOptions[]
  /**
   * 内部函数,不注册云函数,但是会应用缓存的功能,以供内部调用
   */
  internal?:true
  /**
   * noUser为true的时, 默认不fetch User数据, 加上此设置,强制fetch User数据
   */
  fetchUser?:true
  /**
   * 云函数调用前的回调, 可用于修改数据. 在全局beforeInvoke之后执行
   */
  beforeInvoke?:CloudInvoke<A>,
  /**
   * @deprecated
   * 云函数调用后的回调, 可用于修改数据, 在全局afterInvoke之前执行
   */
  afterInvoke?:CloudInvoke<A>,
  /**
   * 云函数调用后的回调, 可用于修改数据, 在全局afterInvoke之前执行
   */
  afterInvokes?:SemverCloudInvoke<A>[],
  /**
   * 额外自定义配置信息
   */
  customOptions?:any
  /**
   * 模块id,可以自动生成,也可以指定
   */
  moduleId?:number
  /**
   * 云函数id,可以自动生成,也可以指定
   */
  functionId?:number
  /**
   * 是否需要验证后才能执行
   */
  verify?:VerifyOptions

  /**
   * 服务端 标记哪些云函数可以进行客户端缓存，并把该标记发布到sdk 
   */
  clientCache?:{
    /**
     * 配置存储的key, 以及符合配置条件的请求才会被缓存
     */
    keyPath:(keyof T)[][],
  
    /**
     * 版本标记。当前端升级api模块之后，调用接口时生成的clientCacheVersion也不同。会把返回的version加入到缓存的key path里。
     */
    versionCb?:(params:any)=>number|string

    /**
     * 是否开启延迟访问数据，并更新本地缓存，默认关闭 
     */
    revalidate?: boolean
  }
}

export interface Listener<A>{
  /**
   * 限流被触发的回调
   */
  onRateLimited?:CloudInvoke<A>
}

let listener : Listener<any> = {}

export function SetListener(p:Listener<any>){
  listener = p || {}
}

const NODE_ENV = process.env.NODE_ENV as string || 'dev'

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


async function RateLimitCheck(params: {functionName: string, objectId: string, ip:string, rateLimit: RateLimitOptions[], cloudInvokeData: CloudInvokeParams<any>}) {

  let {functionName, objectId, ip, rateLimit, cloudInvokeData} = params
  if(rateLimit.length==0) return
  let pipeline = redis.pipeline()
  for (let i = 0; i < rateLimit.length; ++i){
    let limit = rateLimit[i]
    let timeUnit = limit.timeUnit
    let user = objectId||ip
    let { startTimestamp, expires } = getCacheTime(limit.timeUnit)
    let date = startTimestamp.valueOf()
    let cacheKey = `${prefix}:rate:${timeUnit}-${date}:${functionName}:${user}`
    pipeline.incr(cacheKey).expire(cacheKey, expires)
  }
  let result = await pipeline.exec()
  
  for (let i = 0; i < rateLimit.length; ++i) {
    let limit = rateLimit[i]
    let user =  objectId||ip
    let count = result[i*2+0][1]
    if (count > limit.limit) {
      if(listener.onRateLimited){
        listener.onRateLimited(cloudInvokeData)
      }
      throw new RateLimitError({
        functionName,user,count,limit:limit.limit,timeUnit:limit.timeUnit,code:401
      })
    }
  }
}

function getTimeLength(timeUnit?: 'day' | 'hour' | 'minute' | 'month'| 'second',count=1) {
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

async function CloudImplementBefore<T extends CloudParams>(cloudImplementOptions: {
  functionName: string
  request: AV.Cloud.CloudFunctionRequest & {noUser?:true, internal?:true}
  cloudOptions: CloudOptions<T> | undefined
  schema: Joi.ObjectSchema | null
  rateLimit: RateLimitOptions[] | null
  roles:string[][]|null
  debounce:boolean | Array<Array<keyof T>> | null
  verify:VerifyOptions|null
}){
  let { functionName, request, cloudOptions, schema, rateLimit,roles,debounce,verify } = cloudImplementOptions

  let cloudOptions2 = cloudOptions as (CloudOptions<any> | undefined)

  beforeInvoke && await beforeInvoke({
    functionName,
    cloudOptions: cloudOptions2,
    request
  })
  
  cloudOptions && cloudOptions.beforeInvoke && await cloudOptions.beforeInvoke({
    functionName,
    cloudOptions: cloudOptions2,
    request
  })

  //内部调用, 跳过检测
  if(request.internal) return
  //@ts-ignore
  let params: CloudParams = request.params || {}
  if(!request.noUser){
    await CheckPermission(request.currentUser,cloudOptions&&cloudOptions.noUser,roles)
  }
  if (schema) {
    CheckSchema(schema, params)
  }
  if (rateLimit) {
    await RateLimitCheck({functionName, 
      objectId: request.currentUser && request.currentUser.get('objectId'),
      ip:request.meta.remoteAddress, 
      rateLimit,
      cloudInvokeData: {
        functionName,
        cloudOptions: cloudOptions2,
        request
      }})
  }
  if(verify){
    await CheckVerify({functionName, 
      objectId: request.currentUser && request.currentUser.get('objectId'),
      ip:request.meta.remoteAddress,verify,params,user:request.currentUser})
  }
  if(debounce && request.currentUser){
    await CheckDebounce(debounce as string[][],params,request.currentUser,
      //@ts-ignore
      request.lock as Lock)
  }
}
async function CloudImplementAfter<T extends CloudParams>(cloudImplementOptions: {
  functionName: string
  request: AV.Cloud.CloudFunctionRequest & {noUser?:true, internal?:true}
  cloudOptions: CloudOptions<T> | undefined
  data?:any,
}){
  let { functionName, request, cloudOptions,data } = cloudImplementOptions

  let cloudOptions2 = cloudOptions as (CloudOptions<any> | undefined)
  if(cloudOptions && cloudOptions.afterInvoke){
    data = await cloudOptions.afterInvoke({
      functionName,
      cloudOptions: cloudOptions2,
      request,
      data
    }) || data
  }

  if(cloudOptions && cloudOptions.afterInvokes){
    //@ts-ignore
    let version = request.params && request.params._api as SDKVersion
    if(version){ 
      let fit = cloudOptions.afterInvokes.find(x=> semver.valid(version.clientVersion) && semver.satisfies(version.clientVersion,x.semver))
      if(fit){
        data = await fit.callback({
          functionName,
          cloudOptions: cloudOptions2,
          request,
          data
        }) || data
      }
    }
  }

  if(afterInvoke){
    data = await afterInvoke({
      functionName,
      cloudOptions: cloudOptions2,
      request,
      data
    }) || data
  }
  return data
}

async function CloudImplement<T extends CloudParams>(cloudImplementOptions: {
  functionName: string
  request: AV.Cloud.CloudFunctionRequest & {noUser?:true,internal?:true}
  handle: CloudHandler
  cloudOptions: CloudOptions<T> | undefined
  schema: Joi.ObjectSchema | null
  rateLimit: RateLimitOptions[] | null
  roles:string[][]|null,
  disableCheck?:true
  debounce:boolean | Array<Array<keyof T>> | null
  verify:VerifyOptions|null
}) {
  let { functionName, request, handle, cloudOptions, schema, rateLimit,roles,disableCheck,debounce,verify } = cloudImplementOptions
  if(!disableCheck){
    await CloudImplementBefore(cloudImplementOptions)
  }

  let data = await handle( Object.assign({
    request,
    currentUser:request.currentUser,
    //@ts-ignore
    lock:request.lock
  },request.params) )

  if(!disableCheck){
    data = await CloudImplementAfter({
      functionName,
      request,
      data,
      cloudOptions
    })
  }
  return data
}

async function CheckPermission(currentUser?:AV.User, noUser?:true|null,roles?:string[][]|null) {
  if (!currentUser && !noUser) {
    throw new AV.Cloud.Error('missing user', { code: 400 })
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

/**
 * 客户端版本错误
 */
export class ClientApiVersionError extends Error{
  constructor(message = ''){
    super(message)
    this.name = 'ClientApiVersionError'
  }
}
export class SchemaError extends Error{
  validationError: Joi.ValidationError
  constructor(error: Joi.ValidationError){
    super(error.message)
    this.validationError = error
    this.name = 'SchemaError'
  }
}

export class DebounceError extends Error{
  constructor(message = ''){
    super(message)
    this.name = 'DebounceError'
  }
}

export class MissingVerify  extends Error{
  constructor(message = ''){
    super(message)
    this.name = 'MissingVerify'
  }
}
export class VerifyError  extends Error{
  constructor(message = ''){
    super(message)
    this.name = 'VerifyError'
  }
}

export class RateLimitError extends AV.Cloud.Error{
  
  functionName:string
  user:string
  count:number
  limit:number
  timeUnit:string
  code:number

  constructor(params:{
    functionName:string,
    user:string,
    count:number,
    limit:number,
    timeUnit:string,
    code:number
  }){
    super(params.functionName + ' user ' + params.user + ' run ' + params.count + ' over limit ' + params.limit + ' in ' + params.timeUnit, { code: params.code })
    this.functionName = params.functionName
    this.user = params.user
    this.count = params.count
    this.limit = params.limit
    this.timeUnit = params.timeUnit
    this.code = params.code
  }
}


async function _CheckVerify(verify:VerifyOptions|null,params: CloudParams,user?:AV.User){
  if(verify){
    if(!params.cloudVerify){
      throw new MissingVerify()
    }
    let verifyData:VerifyParams
    try {
      verifyData = await SetVerify(Object.assign({type:verify.type},params.cloudVerify) )
    } catch (error) {
      if( error instanceof Error){
        throw new VerifyError(error.message)
      }else{
        throw new VerifyError(error)
      }
    }
    if(afterVerify){
      await afterVerify(Object.assign({user},verifyData))
    }
  }
}

async function CheckVerify(params: {verify:VerifyOptions,functionName: string, objectId: string, ip:string, params: CloudParams,user?:AV.User}){
  

  let {functionName, objectId, ip, verify} = params
  if(!verify) return

  let user = objectId||ip
  let lockKey = `${prefix}:verify_lock:${functionName}:${user}`
  let verified = false
  if(await redis.get(lockKey)){
    await _CheckVerify(verify,params.params,params.user)
    await redis.del(lockKey)
    verified = true
  }
  // for (let i = 0; i < rateLimit.length; ++i)
  {
    // let limit = rateLimit[i]
    let timeUnit = verify.timeUnit
    let { startTimestamp, expires } = getCacheTime(timeUnit)
    let date = startTimestamp.valueOf()
    let cacheKey = `${prefix}:verify_count:${timeUnit}-${date}:${functionName}:${user}`
    let result = await redis.pipeline().incr(cacheKey).expire(cacheKey, expires).exec()
    const i=0
    let count = result[i*2+0][1]
    if(count>=(verify.count||1)){
      let pipeline = redis.pipeline()
      pipeline.setex(cacheKey,expires,0)
      if(verified){
        await pipeline.exec()
      }else{
        await pipeline.setex(lockKey,verify.expire||3600*24*30,1).exec()
        await _CheckVerify(verify,params.params,params.user)
        await redis.del(lockKey)
      }
    }
    // pipeline.incr(cacheKey).expire(cacheKey, expires)
  }
}

async function CheckDebounce(debounce:boolean | string[][], params: CloudParams,currentUser:AV.User,lock:Lock){

  if (debounce) {
    if(debounce==true){
      let key = currentUser.get('objectId')
      //符合缓存条件,记录所使用的查询keys
      if(! await lock.tryLock(key)){
        throw new DebounceError('debounce error')
      }
    }else if(Array.isArray(debounce)){
      //判断是否符合防抖条件
      let cacheParams: string[] | null = null
      let paramsKeys = Object.keys(ClearInternalParams(params))
      for (let i = 0; i < debounce.length; ++i) {
        let _cacheParams = debounce[i]
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
        let cacheKeyConfig = {}
        //符合缓存条件,记录所使用的查询keys
        for (let i = 0; i < cacheParams.length; ++i) {
          let key = cacheParams[i]
          cacheKeyConfig[key] = params[key]
        }
        cacheKeyConfig['currentUser'] = currentUser.get('objectId')
        let key = getCacheKey(cacheKeyConfig)
        //符合缓存条件,记录所使用的查询keys
        if(! await lock.tryLock(key)){
          throw new DebounceError('debounce error')
        }
      }
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
    throw new SchemaError(error) 
    //new AV.Cloud.Error('schema error', { code: 400 })
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
  delete params2.cloudVerify
  Object.keys(params2).forEach(e=>{if(e.startsWith('_'))delete params2[e]})
  // delete params2._api
  return params2
}

function CreateCloudCacheFunction<T extends CloudParams>(info: {
  cache: CacheOptions<T>
  handle: CloudHandler
  functionName: string,
  cloudOptions: CloudOptions<T>,
  schema?: Joi.ObjectSchema,
  rpc?:boolean
  debounce?:boolean
  verify?:VerifyOptions
}) {
  let { cache, handle, cloudOptions, functionName, rpc } = info
  let _redis = cache.redisUrl && new Redis(cache.redisUrl, {maxRetriesPerRequest: null})
  return async (request: AV.Cloud.CloudFunctionRequest & {noUser?:true, internal?:true}) => {

    let schema = info.schema || null
    let debounce = info.debounce || null
    let verify = info.verify || null
    let rateLimit = cloudOptions.rateLimit || null
    // console.log(functionName)
    //@ts-ignore
    let params: CloudParams = request.params || {}
    let roles = cloudOptions.roles || null
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
        return CloudImplement({ functionName, request, handle, cloudOptions, schema, rateLimit,roles,debounce,verify })
      }
    }
    let cloudParams: CloudParams = params
    //是否执行非缓存的调试版本
    if (cloudParams.noCache) {
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

      let { startTimestamp, expires } = getCacheTime(cache.timeUnit)
      let results = await CloudImplement({ functionName, request, handle, cloudOptions, schema, rateLimit,roles,debounce,verify })
      if (typeof results === 'object') {
        results.__timestamp = startTimestamp.valueOf()
      }
      console.log(functionName + ' CloudImplement no cache')
      return Promise.resolve(results)
    }
    await CloudImplementBefore({ functionName, request, cloudOptions, schema, rateLimit,roles,debounce,verify })

    if (cache.currentUser) {
      cacheKeyConfig['currentUser'] = request.currentUser
    }
    cacheKeyConfig['timeUnit'] = cache.timeUnit
    let cacheKey = `${redisSetting.cachePrefix}:cloud:${NODE_ENV}:${functionName}:` + getCacheKey(cacheKeyConfig)

    // console.log(functionName + ' CloudImplement Cache')
    //尝试获取缓存
    let redis2 = _redis || redis
    let cacheResults =  await redis2.pipeline().get(cacheKey).get(cacheKey+':timestamp').exec()
    let textResult = cacheResults[0][1]
    // let textResult = await redis2.get(cacheKey)
    if (textResult) {
      let timestamp =  cacheResults[1][1] && parseInt(cacheResults[1][1])
      try {
        IncrCache({
          function:functionName,
          //@ts-ignore
          platform: params.platform ,
          //@ts-ignore
          api: params.api ,
          //@ts-ignore
          version: params.version ,
        })
        // if(rpc){
        //   return AV.parseJSON(JSON.parse( textResult ) )
        // }
        let data = AV2.parse(textResult)
        if(typeof data === 'object'){
          data.__timestamp = timestamp
        }
        //@ts-ignore
        return await CloudImplementAfter({
          functionName,
          request,
          data,
          cloudOptions
        }) 
      } catch (error) {
        return textResult
      }
    }
    //获取缓存失败,执行原始云函数
    let results = await CloudImplement({ functionName, request, handle, cloudOptions, schema, rateLimit,roles,disableCheck:true,debounce,verify })
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
    
    let timestamp = startTimestamp.valueOf()
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
    let cacheValue: string
    if (typeof results === 'string') {
      cacheValue = results
    } else {
      // cacheValue = JSON.stringify(results)
      //@ts-ignore
      cacheValue = AV2.stringify(results)
      if(typeof results === 'object'){
        results.__timestamp = timestamp
      }
    }
    redis2.multi().setex(cacheKey, expires, cacheValue).setex(cacheKey+':timestamp', expires, timestamp).exec()

    return await CloudImplementAfter({
      functionName,
      request,
      data:results,
      cloudOptions
    }) 
    // return Promise.resolve(results)
  }
}

/**
 * 将函数加入云函数中,云函数名为 ``类名.函数名``
 */
export function Cloud<T extends CloudParams,A = any>(params?: CloudOptions<T,A>) {
  return function(target, propertyKey: string, descriptor: PropertyDescriptor) {
    const handle:CloudHandler = descriptor.value
    let functionName =
      (target.name || target.constructor.name) + '.' + propertyKey
    // console.log(target.constructor.name)
    if(params){
      params.moduleId = params?.moduleId || cloudIdInfoMap[(target.name || target.constructor.name)]?.id
      params.functionId = cloudIdInfoMap[(target.name || target.constructor.name)]?.functions?.[propertyKey]?.id
    }
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
      let debounce = params && params.debounce|| null
      let verify = params && params.verify
      // console.log(params)
      if (params && params.cache) {
        //缓存版本
        const cache = params.cache
        console.log(functionName+' cache cloud function')
        const rpc = params.rpc
        cloudFunction = CreateCloudCacheFunction({
          cache,
          handle,
          functionName,
          cloudOptions: params,
          schema,
          rpc,
          verify
        })
      } else {
        // console.log(functionName + ' normal cloud function')
        //无缓存版本
        cloudFunction = (request) => CloudImplement({ functionName, request, handle, cloudOptions: params! , schema: schema || null, rateLimit,roles,debounce,verify:verify||null })
      }

      let afterInvokes =params &&  params.afterInvokes
      if (afterInvokes) {
        let errorRange = afterInvokes.filter(e=>!semver.validRange(e.semver))
        //检查合法性
        if(errorRange.length>0){
          console.error(functionName+': Error afterInvokes semver: '+errorRange.map(e=>e.semver).join(', '))
        }
        //检测是否存在范围相交
        let errorIntersects = afterInvokes.filter((e,i)=>afterInvokes!.find((e2,i2)=>i!=i2&&semver.intersects(e.semver,e2.semver)))
        if(errorIntersects.length>0){
          console.error(functionName+': Error afterInvokes semver: '+errorIntersects.map(e=>e.semver).join(', '))
        }
      }
      if (params && params.internal) {
        console.log('internal function '+cloudPrefix+functionName)
        AV.Cloud.define(cloudPrefix+functionName,{internal:true}, (request) =>{
          let currentUser = request && request.currentUser
          let params2 = request && request.params
          return cloudFunction({ currentUser, params:params2, noUser:true,internal:true })
        },
        //@ts-ignore
        params)
        //创建别名函数
        if (params && params.optionalName) {
          AV.Cloud.define(params.optionalName,{internal:true}, cloudFunction,
            //@ts-ignore
            params)
        }
      } else {
        let options:AV.Cloud.DefineOptions = {}
        if(params && params.noUser && !params.fetchUser){
          options.fetchUser = false
        }
        AV.Cloud.define(cloudPrefix+functionName,options, cloudFunction,
          //@ts-ignore
          params)
        //创建别名函数
        if (params && params.optionalName) {
          AV.Cloud.define(params.optionalName,options, cloudFunction,
            //@ts-ignore
            params)
        }
      }
      descriptor.value = (params: CloudParams | undefined) => {
        let currentUser = params && params.currentUser
        let params2 = Object.assign({}, params)
        delete params2.lock
        delete params2.currentUser
        delete params2.request
        return cloudFunction({ currentUser, params:params2, noUser:true,internal:true })
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
  /**
   * 尝试锁住某个key,成功返回true,失败返回false, 会在云函数结束后自动解锁
   */
  tryLock(key: string): Promise< boolean >
  /**
   * 主动解锁某个key
   */
  unlock(key: string): Promise<void>
}

/**
 * 云函数参数的内置字段
 */
export interface CloudParams {
  /**
   * 当前用户
   */
  currentUser?: AV.User
  /**
   * 操作锁,用于避免不同请求中,同时对某个数据进行操作
   */
  lock?: Lock
  /**
   * 原始的leancloud 的request内容
   */
  request?: AV.Cloud.CloudFunctionRequest,
  /**
   * 此请求强制不使用缓存
   */
  noCache?: boolean,
  /**
   * 调用云函数的管理员id,用于特殊操作,比如noCache操作
   */
  adminId?: string
  /**
   * 调用云函数的sdk信息
   */
  _api?:SDKVersion
  /**
   * 验证参数
   */
  cloudVerify?:SetVerifyParams
}