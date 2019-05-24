

import {Redis} from 'ioredis'

export let redis: Redis
export let cachePrefix = 'pteppp'
let lockPrefix = `${cachePrefix}:lock:`

export function SetCache(params: {cache: Redis,cachePrefix?:string}) {
    redis = params.cache
    cachePrefix = params.cachePrefix||'pteppp'
    lockPrefix = `${cachePrefix}:lock:`
    cacheUpdateCallbackList.forEach(e=>e(params))
  }
type CacheUpdateCallback = (params:{cache: Redis,cachePrefix?:string}) => void

let cacheUpdateCallbackList:CacheUpdateCallback[] =[]

export function AddCacheUpdateCallback(callback:CacheUpdateCallback){
  cacheUpdateCallbackList.push(callback)
}

/**
 * 
 * @param {string} key
 * @return {Promise<number>} - 1成功加锁,0已被其他地方加锁
 */
export function tryLock(key) {
    key = lockPrefix + key;
    return redis.setnx(key, 1)
  }
  
  
  /**
   * 
   * @param {string} key
   */
  export function unlock(key) {
    key = lockPrefix + key
    return redis.del(key)
  
  }
  
  export class Lock {
      prefix:string
      lockList:string[]
    constructor(prefix) {
      this.prefix = prefix
      this.lockList = []
    }
    async tryLock(key) {
      key = this.prefix + key
      try {
        if (await tryLock(key)) {
          this.lockList.push(key)
          return true
        }
        else {
        //   IkkError.BearyErrorLog('tryLock fail', new Error(key).stack)
          return false
        }
      } catch (error) {
        console.error(error)
        return true
      }
    }
    unlock(key) {
      key = this.prefix + key
      this.lockList.splice(0, this.lockList.indexOf(key))
      try {
        unlock(key)
      } catch (error) {
        console.error(error)
      }
    }
    clearLock() {
      try {
        for (var i = 0; i < this.lockList.length; ++i) {
          unlock(this.lockList[i])
        }
      } catch (error) {
        console.error(error)
      }
    }
  }
  