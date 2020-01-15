import AV from 'leanengine'
import * as redisSetting from './redis'
import {isRole,isRoles,getCacheKey} from './base'

import { IncrCall, IncrError, GetStats } from './cloudStats'
import _ from 'lodash'
import { Lock } from './redis'
import {MsgIdInfoMap,GetMsgInfoMap} from './buildIDCommon'
import * as fs from 'fs'
import {ErrorMsg} from './errorMsg'

const errorMsgFile = 'errorMsg.json'
const errorMsgInfoMap:MsgIdInfoMap = (fs.existsSync(errorMsgFile) && GetMsgInfoMap(JSON.parse( fs.readFileSync(errorMsgFile,'utf8'))))||{}

export interface SDKVersion{
  platform: string ,
  apiVersion: string,
  clientVersion: string,
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
   * 出错的模块(class名)
   */
  module: string,
  /**
   * 出错的行为(function名)
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
      errorInfo = Object.assign(errorInfo, error)
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
  var CloudHandler = function(request:AV.Cloud.CloudFunctionRequest & {params:{_api?:SDKVersion}}) {
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
    let apiVersion = params._api
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
        return result
          .then(e => {
            lock.clearLock()
            return e
          })
          .catch(info => {
            lock.clearLock()
            let msg = (info instanceof ErrorMsg)&&errorMsgInfoMap[info.getStringTemplate().en]
            // let ikkError
            let params = request.params || {}
            let api = params._api
            var errorInfo: any = {
              user: request.currentUser,
              function: name,
              params: request.params,
              ip,
              //@ts-ignore
              platform: (api && api.platform)|| params.platform,
              //@ts-ignore
              api: (api && api.apiVersion)||params.api,
              //@ts-ignore
              version: (api && api.clientVersion)||params.version,
              errorMsg:{
                code:{
                  moduleId:cloudOptions?.moduleId,
                  functionId:cloudOptions?.functionId,
                  msgId: msg&&msg.id
                },
                messageTemplate:msg,
                params:(info instanceof ErrorMsg)&&info.params
              }
            }
            // if (info instanceof IkkError) {
            //   ikkError = info
            //   ikkError.setData(errorInfo)
            // } else
              if (info) {
              if (typeof info === 'string') {
                errorInfo.message = info
                errorInfo.description = info
              } else if (typeof info === 'object') {
                while (info.ikkMessage) {
                  errorInfo.errorInfo = info.ikkMessage
                  info = info.originalError
                }
                errorInfo = Object.assign(errorInfo, info)
                if (info.message && info.stack) {
                  errorInfo.error = info
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
            return Promise.reject(cloudErrorCallback(errorInfo))
          })
      } else {
        lock.clearLock()
        return result
      }
    } catch (error) {
      lock.clearLock()
      // console.error(error)
      // let ikkError
      let msg = (error instanceof ErrorMsg)&&errorMsgInfoMap[error.getStringTemplate().en]
      var errorInfo: any = {
        user: request.currentUser,
        function: name,
        params: request.params,
        ip,
        platform: apiVersion.platform,
        api: apiVersion.apiVersion,
        version: apiVersion.clientVersion,
        errorMsg:{
          code:{
            moduleId:cloudOptions?.moduleId,
            functionId:cloudOptions?.functionId,
            msgId: msg&&msg.id
          },
          messageTemplate:msg,
          params:(error instanceof ErrorMsg)&&error.params
        }
      }
    
      {
        while (error.ikkMessage) {
          errorInfo.errorInfo = error.ikkMessage
          error = error.originalError
        }
        errorInfo = Object.assign(errorInfo, error)
        errorInfo.error = error
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
  function:string,
  params?: {[key:string]:any}
}

export async function DeleteCloudCache(params:DeleteCacheParams){
  let cacheKeyConfig = params.params
  if (cacheKeyConfig && params.userId) {
    cacheKeyConfig['currentUser'] = params.userId
  }
  let functionName = params.module+'.'+params.function
  if(cacheKeyConfig){
    let timeUnitList = ['day', 'hour', 'minute', 'second', 'month']
    let pipeline = redis.pipeline()
    for (let i = 0; i < timeUnitList.length; ++i){
      cacheKeyConfig['timeUnit'] = timeUnitList[i]
      let cacheKey = `${prefix}:cloud:${functionName}:` + getCacheKey(cacheKeyConfig)
      pipeline.del(cacheKey)
    }
    let result : [null,number][] = await pipeline.exec()
    return {
      'day':result[0][1], 
      'hour':result[1][1], 
      'minute':result[2][1], 
      'second':result[3][1], 
      'month':result[4][1]
    }
  }else{
    var keys = await redis.keys(`${prefix}:cloud:${functionName}:*`)
    let pipeline = redis.pipeline()
    keys.forEach(e=>{
      pipeline.del(e)
    })
    let result : [null,number][] = await  pipeline.exec()
    let out = {}
    keys.forEach((e,i)=>{
      out[e] = result[i][1]
    })
    return out
  }
}
//@ts-ignore
AV.Cloud.define('Cloud.DeleteCache', async request => {
  if (request.currentUser && (await isRole(request.currentUser, 'Dev'))) {
    //@ts-ignore
    let params = request.params as DeleteCacheParams
    return DeleteCloudCache(params)
  } else {
    throw new AV.Cloud.Error('non-administrators', { code: 400 })
  }
})