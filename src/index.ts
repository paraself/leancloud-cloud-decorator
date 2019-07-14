var package_json = require('./../package.json');
console.log(package_json.name+" "+package_json.version);

export * from './leancloud-cloud-decorator'
export * from './base'
export * from './cloudMetaData'
export * from './cloudHandler'
export * from './cloudStats'
export * from './errorInfo'

import {SetCache} from './leancloud-cloud-decorator'
import {SetCloudErrorCallback,SetCloudInvokeCallback} from './cloudHandler'
import AV from 'leanengine'
import Redis from 'ioredis'

interface InitParams{
    /**
     * redis连接地址
     */
    redisUrl:string,
    /**
     * redis 缓存前缀
     */
    redisPrefix:string,
    /**
     * 云函数错误回调
     */
    errorCallback?: (error: any) => any,
    /**
     * 云函数被调用回调
     */
    cloudInvokeCallback?:(name: string, request: AV.Cloud.CloudFunctionRequest)=>void
}
export function init(params:InitParams){
    SetCache({
        cache: new Redis(params.redisUrl, {maxRetriesPerRequest: null}),
        cachePrefix:params.redisPrefix
    })
    params.errorCallback && SetCloudErrorCallback(params.errorCallback)
    params.cloudInvokeCallback && SetCloudInvokeCallback(params.cloudInvokeCallback)
}