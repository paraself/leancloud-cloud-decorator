import AV from 'leanengine'
import * as redisSetting from './redis'
import {isRole,isRoles,getCacheKey} from './base'

import { IncrCall, IncrError, GetStats } from './cloudStats'
import _ from 'lodash'
import { Lock } from './redis'
import {MsgIdInfoMap,GetMsgInfoMap} from './buildIDCommon'
import * as fs from 'fs'
import {ErrorMsg} from './errorMsg'
import * as Verify from './verify'

const errorMsgFile = 'errorMsg.json'
const errorMsgInfoMap:MsgIdInfoMap = (fs.existsSync(errorMsgFile) && GetMsgInfoMap(JSON.parse( fs.readFileSync(errorMsgFile,'utf8'))))||{}

export interface SDKVersion{
  platform: string ,
  apiVersion: string,
  clientVersion: string,
}

/**
 * 设备信息
 */
export interface DeviceInfo{
  /**
   * 设备名,比如 iPad iPhone Android web
   */
  name:string
  /**
   * 设备id, web版可使用设备指纹
   */
  id:string
  /**
   * 设备的具体型号, 比如 iPhone6 , xiaomi9 , web版为浏览器名
   */
  model:string
  /**
   * 设备品牌
   */
  BRAND:string
  /**
   * 系统或者浏览器版本号
   */
  version:string
}

const _define = AV.Cloud.define
const _beforeDelete = AV.Cloud.beforeDelete
const _beforeSave = AV.Cloud.beforeSave
const _beforeUpdate = AV.Cloud.beforeUpdate
const _afterDelete = AV.Cloud.afterDelete
const _afterSave = AV.Cloud.afterSave
const _afterUpdate = AV.Cloud.afterUpdate

const LOG_CLOUD_FILTER =
  (process.env.LOG_CLOUD_FILTER && JSON.parse(process.env.LOG_CLOUD_FILTER)) ||
  []


let redis = redisSetting.redis
let prefix = redisSetting.cachePrefix

redisSetting.AddCacheUpdateCallback((params)=>{
  redis = redisSetting.redis
  prefix = redisSetting.cachePrefix
})

let cloudInvokeCallback: (name: string, request: AV.Cloud.CloudFunctionRequest) => any
let cloudErrorCallback = (error: CloudFunctionError) => {
  // if (typeof error === 'string'){
  //   return error
  // }
  return error.error
}

/**
 *  @deprecated please use init
 */
export function SetCloudInvokeCallback(callback: (name: string, request: AV.Cloud.CloudFunctionRequest)=>void) {
  cloudInvokeCallback = callback
}


export interface CloudFunctionError{

  /**
   * 出错时前端请求的用户
   */
  user?: AV.User,

  /**
   * 出错时前端请求的用户ip
   */
  ip?: string,
  /**
   * 出错的云函数名
   */
  function: string,
  /**
   * 出错的(钩子函数)模块(class名)
   */
  module: string,
  /**
   * 用户所运行的平台,需要结合前端sdk获取
   */
  platform?: string
  /**
   * 用户所运行的api版本,需要结合前端sdk获取
   */
  api?: string
  /**
   * 用户所运行的客户端版本,需要结合前端sdk获取
   */
  version?: string,
  /**
   * 出错的(钩子函数)行为(function名)
   */
  action: string
  /**
   * 出错时客户端的请求参数
   */
  params: any
  /**
   * 出错时操作的目标数据
   */
  target: AV.Object
  /**
   * 出错时抛出的Error
   */
  error:Error|any
  /**
   * 记录抛出的错误中ikkMessage字段,用于存储额外信息
   */
  errorInfo?:any
  // /**
  //  * 请求的request
  //  */
  // request: AV.Cloud.ClassHookRequest | AV.Cloud.CloudFunctionRequest
}

/**
 * @deprecated please use init
 */
export function SetCloudErrorCallback(callback: (error: CloudFunctionError) => any) {
  cloudErrorCallback = callback
}

async function CloudHookHandler(request: AV.Cloud.ClassHookRequest, handler: AV.Cloud.ClassHookFunction, className: string, actionName:string): Promise<any> {

  try {
    IncrCall({
      module: className,
      action:actionName
    })
    return await handler(request)
  } catch (error) {
    // console.error(error)
    // let ikkError
    //@ts-ignore
    var errorInfo: CloudFunctionError = {
      user: request.currentUser,
      module: className,
      action: actionName,
      params: request.object && request.object.updatedKeys && _.pick(request.object.toJSON(), request.object.updatedKeys),
      target: request.object
    }
    // if (error instanceof IkkError) {
    //   ikkError = error
    //   ikkError.setData(errorInfo)
    // } else
    // {
      while (error.ikkMessage) {
        errorInfo.errorInfo = error.ikkMessage
        error = error.originalError
      }
      // errorInfo = Object.assign(errorInfo, error)
      errorInfo.error = error
      // ikkError = new IkkError(errorInfo)
    // }
    // console.error(ikkError)
    // ikkError.send()
    // return Promise.reject(ikkError.toClient())
    return Promise.reject(cloudErrorCallback(errorInfo))
  }
}
function CreateHookFunction(name: string, hook = _beforeUpdate) {
  return (className: string, handler: AV.Cloud.ClassHookFunction)=> {
    hook(className, request => CloudHookHandler(request, handler,className ,name))
  }
}
AV.Cloud.beforeDelete = CreateHookFunction('beforeDelete', _beforeDelete)
AV.Cloud.beforeSave = CreateHookFunction('beforeSave', _beforeSave)
AV.Cloud.beforeUpdate = CreateHookFunction('beforeUpdate', _beforeUpdate)

AV.Cloud.afterDelete = CreateHookFunction('afterDelete', _afterDelete)
AV.Cloud.afterSave = CreateHookFunction('afterSave', _afterSave)
AV.Cloud.afterUpdate = CreateHookFunction('afterUpdate', _afterUpdate)

const UNKNOW_STATS = process.env.NODE_ENV ? 'unknown' : 'local'
/**
 * @function define - 更改原始函数,增加日志记录功能. 必须在云函数定义被require之前定义
 * @param {string} name
 * @param {*} optionsOrHandler
 * @param {*} handler
 */
AV.Cloud.define = function(
  name: string,
  optionsOrHandler: AV.Cloud.DefineOptions | AV.Cloud.CloudFunction,
  handler: AV.Cloud.CloudFunction | null = null,
  cloudOptions?:{  /**
    * 模块id,可以自动生成,也可以指定
    */
   moduleId?:number
   /**
    * 云函数id,可以自动生成,也可以指定
    */
   functionId?:number}
): any {
  //@ts-ignore
  var callback: AV.Cloud.CloudFunction = handler
  //@ts-ignore
  if (!callback) callback = optionsOrHandler
  /**
   *
   * @param {CloudFunction} request
   */
  var CloudHandler = async function(request:AV.Cloud.CloudFunctionRequest & {params:{_api?:SDKVersion}}) {
    let ip
    try {
      // var userAgent =
      //   request.expressReq && request.expressReq.headers['user-agent']
      ip = request.meta.remoteAddress
      // LogInfo(request.currentUser, ip, userAgent, name)
      if(cloudInvokeCallback){
        cloudInvokeCallback(name,request)
      }
    } catch (error) {
      console.error(error)
    }
    // return callback(request)

    var lock = new Lock(name + ':')
    let params = request.params || {}
    let apiVersion = params._api!
    apiVersion = {
      platform: (apiVersion&&apiVersion.platform)||UNKNOW_STATS,
      apiVersion: (apiVersion&&(apiVersion.apiVersion||apiVersion['api']))||UNKNOW_STATS,
      clientVersion: (apiVersion&&(apiVersion.clientVersion||apiVersion['version']))||UNKNOW_STATS,
    }
    try {
      //@ts-ignore
      request.lock = lock
      IncrCall({
        function: name,
        platform: apiVersion.platform ,
        api: apiVersion.apiVersion ,
        version: apiVersion.clientVersion ,
      })
      var result = callback(request)
      if (!result) {
        lock.clearLock()
        return
      }
      if (result.catch && result.then) {
        result = await result
        lock.clearLock()
        return result
      } else {
        lock.clearLock()
        return result
      }
    } catch (error) {
      lock.clearLock()
      // console.error(error)
      // let ikkError
      let msg = (error instanceof ErrorMsg)&&errorMsgInfoMap[error.getStringTemplate().en]
      var errorInfo: CloudFunctionError = {
        user: request.currentUser,
        function: name,
        params: params,
        ip,
        platform: apiVersion.platform,
        api: apiVersion.apiVersion,
        version: apiVersion.clientVersion,
        //@ts-ignore
        errorMsg: msg&&{
          code:{
            moduleId:cloudOptions?.moduleId,
            functionId:cloudOptions?.functionId,
            msgId: msg&&msg.id
          },
          messageTemplate:msg,
          params:(error instanceof ErrorMsg)&&error.params
        }
      }
    
      let info = error
      if (info) 
      {
          // errorInfo.error = info
        if (typeof info === 'string') {
          //@ts-ignore
          errorInfo.message = info
          //@ts-ignore
          errorInfo.description = info
        } else if (typeof info === 'object') {
          if(info.error && info.target){
            errorInfo = Object.assign(info,errorInfo)
          }else{
            
            while (info.ikkMessage) {
              errorInfo.errorInfo = info.ikkMessage
              info = info.originalError
            }
            // errorInfo = Object.assign(errorInfo, info)
            // if (info.message && info.stack) 
            {
              errorInfo.error = info
            }

        //@ts-ignore
            if(info.description && !errorInfo.errorMsg){
              //@ts-ignore
              errorInfo.description = info.description
            }
            info.target && (errorInfo.target = info.target)
          }
        }
        // 创建一个ikkError并记录
        // ikkError = new IkkError(errorInfo)
      }
      // console.error(ikkError)
      // ikkError.send()
      return Promise.reject(cloudErrorCallback(errorInfo))
    }
  }
  // 判断是否被过滤
  if (LOG_CLOUD_FILTER.includes(name)) {
    CloudHandler = callback
  }
  if (handler) {
    //@ts-ignore
    _define(name, optionsOrHandler, CloudHandler)
  } else {
    //@ts-ignore
    _define(name, CloudHandler)
  }
}
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
AV.Cloud.define('Cloud.GetStats', async request => {
  if (request.currentUser && (await isRole(request.currentUser, 'Dev'))) {
    return GetStats()
  } else {
    throw new AV.Cloud.Error('non-administrators', { code: 400 })
  }
})

interface DeleteCacheParams {
  userId?:string
  module: string,
  /**
   * 缓存的运行环境, 即生成缓存的进程中  process.env.NODE_ENV  环境变量的值, NODE_ENV为空时 为 'dev' 环境
   * 默认为 process.env.NODE_ENV ,只清除当前环境所生成的缓存
   */
  env?:string|string[],
  function:string,
  params?: {[key:string]:any}
}

export async function DeleteCloudCache(params:DeleteCacheParams){
  let cacheKeyConfig = params.params
  let env = params.env || (  process.env.NODE_ENV as string || 'dev' )
  if (cacheKeyConfig && params.userId) {
    cacheKeyConfig['currentUser'] = params.userId
  }
  let functionName = params.module+'.'+params.function
  if(cacheKeyConfig){
    let timeUnitList = ['day', 'hour', 'minute', 'second', 'month']
    let pipeline = redis.pipeline()
    for (let i = 0; i < timeUnitList.length; ++i){
      cacheKeyConfig['timeUnit'] = timeUnitList[i]
      if(Array.isArray(env)){
        env.forEach(e=>{
          let cacheKey = `${prefix}:cloud:${e}:${functionName}:` + getCacheKey(cacheKeyConfig!)
          if(process.env.DEBUG_CACHE){
            console.log('del '+cacheKey)
          }
          pipeline.del(cacheKey)
        })
      }else{
        let cacheKey = `${prefix}:cloud:${env}:${functionName}:` + getCacheKey(cacheKeyConfig)
        if(process.env.DEBUG_CACHE){
          console.log('del '+cacheKey)
        }
        pipeline.del(cacheKey)
      }
    }
    let result : [null|Error,number][] = await pipeline.exec()
    return {
      'day':result[0][1], 
      'hour':result[1][1], 
      'minute':result[2][1], 
      'second':result[3][1], 
      'month':result[4][1]
    }
  }else{
    let matches:string[] = []
    if(Array.isArray(env)){
      for(let e = 0;e<env.length;++e){
        matches.push( ...await redis.keys(`${prefix}:cloud:${env[e]}:${functionName}:*`) )
      }
    }else{
      matches.push( ...await redis.keys(`${prefix}:cloud:${env}:${functionName}:*`) )
    }
    for(let i=0;i<matches.length;++i){
      await new Promise((resolve,reject)=>{
        let stream = redis.scanStream({
          match:matches[i]
        })
        stream.on('data',async function (keys) {
          // `keys` is an array of strings representing key names
          if (keys.length) {
            var pipeline = redis.pipeline();
            keys.forEach(function (key) {
              if(process.env.DEBUG_CACHE){
                console.log('del '+key)
              }
              pipeline.del(key);
            });
            await pipeline.exec();
          }
        });
        stream.on('end', function () {
          resolve()
        });
        stream.on('error', function (err) {
          reject(err)
        });
      })
    }
    return 
  }
}

AV.Cloud.define('Cloud.DeleteCache', async request => {
  if (request.currentUser && (await isRole(request.currentUser, 'Dev'))) {
    //@ts-ignore
    let params = request.params as DeleteCacheParams
    return DeleteCloudCache(params)
  } else {
    throw new AV.Cloud.Error('non-administrators', { code: 400 })
  }
})

AV.Cloud.define('Cloud.GetVerifyParams', async request => {
  //@ts-ignore
  return Verify.GetVerifyParams(Object.assign({user:request.currentUser},request.params||{}) )
})