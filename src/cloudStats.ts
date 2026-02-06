import * as redisSetting from './redis'
import moment from 'moment'

const LEANCLOUD_APP_GROUP = process.env.LEANCLOUD_APP_GROUP || 'local'
const NODE_ENV = process.env.NODE_ENV || 'dev'
const STATS_VERSION = 'v1'
let _prefix = `${redisSetting.cachePrefix}:stats:` + STATS_VERSION + ':'
let prefix = `${_prefix}${LEANCLOUD_APP_GROUP}:${NODE_ENV}`
let expire = 60 * 60 * 24 * 30
let redis = redisSetting.redis

redisSetting.AddCacheUpdateCallback((params) => {
  redis = redisSetting.redis
  _prefix = `${redisSetting.cachePrefix}:stats:` + STATS_VERSION + ':'
  prefix = `${_prefix}${LEANCLOUD_APP_GROUP}:${NODE_ENV}`
})

interface cloudInfo {
  function?: string
  module?: string
  action?: string
  /**
   * 平台名
   */
  platform?: string
  /**
   * api版本号
   */
  api?: string
  /**
   * 客户端版本号
   */
  version?: string
}
function checkKeyParams(key: string) {
  return /:|\?|\=/.test(key)
}
function getKey(info: cloudInfo) {
  let func = (info.function || (info.module + '#' + info.action))
  let time = moment(new Date()).format('YYYY-MM-DD')
  // let api = `${info.platform}@${info.api}`
  let { api, platform, version } = info
  let params: string[] = []
  if (version) {
    if (checkKeyParams(version)) {
      throw new Error('error cloud log params')
    }
    params.push('version=' + version)
  }
  if (platform) {
    if (checkKeyParams(platform)) {
      throw new Error('error cloud log params')
    }
    params.push('platform=' + platform)
  }
  if (api) {
    if (checkKeyParams(api)) {
      throw new Error('error cloud log params')
    }
    params.push('api=' + api)
  }
  let key = `${prefix}:${func}:${time}`
  if (params.length > 0) {
    return key + ':' + params.join('&')
  }
  return key
  // return `${prefix}:${func}:${time}:version=${version}&platform=${platform}&api=${api}`
}

/**
 * 云函数缓存调用统计加1
 */
export function IncrCall(info: cloudInfo) {
  // console.log(info)
  let key = getKey(info)
  return redis.pipeline().hincrby(key, 'call', 1).expire(key, expire).exec()
}

/**
 * 云函数缓存调用统计加1
 */
export function IncrCache(info: cloudInfo) {
  // console.log(info)
  let key = getKey(info)
  return redis.pipeline().hincrby(key, 'cache', 1).expire(key, expire).exec()
}

/**
 * 云函数错误统计加1
 */
export function IncrError(info: cloudInfo) {
  let key: string
  try {
    key = getKey(info)
  } catch (error) {
    // 有错误的情况,在IncrCall中已处理
    return
  }
  return redis.pipeline().hincrby(key, 'error', 1).expire(key, expire).exec()
}

export interface GetStatsReturn {
  /**
   * 云函数名称
   */
  function?: string
  /**
   * 数据表名称
   */
  module?: string
  /**
   * 钩子函数名
   */
  action?: string
  /**
   * 服务器分组
   */
  group: string
  /**
   * 环境名称
   */
  env: string
  /**
   * 平台名
   */
  platform?: string
  /**
   * api版本号
   */
  api?: string
  /**
   * 客户端版本号
   */
  version?: string
  /**
   * 字符串日期, 例如2019-09-20
   */
  date: string
  /**
   * 该接口被调用的次数
   */
  callCount: number
  /**
   * 出错的次数
   */
  errorCount: number
  /**
   * 使用缓存的次数
   */
  cacheCount: number
}

type StatsInfo = Omit<GetStatsReturn, 'callCount' | 'errorCount' | 'cacheCount'>

function decodeParams(paramsString: string) {
  let params: { [key: string]: string } = {}
  let paramsStringList = paramsString.split('&')
  for (let i = 0; i < paramsStringList.length; ++i) {
    let condition = paramsStringList[i]
    let index = condition.indexOf('=');

    if (index >= 0) {
      let key = condition.substring(0, index);
      let value = condition.substr(index + 1);
      params[key] = value
    }
  }
  return params
}

const hookNames = {
  beforeDelete: true,
  beforeSave: true,
  beforeUpdate: true,

  afterDelete: true,
  afterSave: true,
  afterUpdate: true,
}

function getInfoFromKey(key: string): StatsInfo | null {
  let infos = key.substring(_prefix.length).split(':')
  if (infos.length == 5 || infos.length == 4) {
    let group = infos[0]
    let env = infos[1]
    let func = infos[2]
    let date = infos[3]

    let info: StatsInfo = {
      group,
      env,
      date
    }
    if (infos.length == 5) {
      let params = decodeParams(infos[4])
      info = Object.assign(info, params)
    }
    let funcInfo = func.split('.')
    if (funcInfo.length < 2) {
      funcInfo = func.split('#')
    }
    if (funcInfo.length > 1) {
      let action = funcInfo[1]
      if (hookNames[action]) {
        info.module = funcInfo[0]
        info.action = action
      } else {
        info.function = func
      }
    } else {
      info.function = func
    }
    return info
  } else {
    console.log('Error cloud stats key:' + key)
    return null
    // throw new Error('Error stats key '+key)
  }
}

function getCountValue(value: unknown): number {
  if (typeof value === 'number') {
    return value
  }
  if (typeof value === 'string') {
    let parsed = Number.parseInt(value, 10)
    if (!Number.isNaN(parsed)) {
      return parsed
    }
  }
  return 0
}

export async function GetStats(): Promise<GetStatsReturn[]> {
  let stats: GetStatsReturn[] = []
  let keys = await redis.keys(_prefix + '*')
  let pipeline = redis.pipeline()
  for (let i = 0; i < keys.length; ++i) {
    pipeline.hgetall(keys[i])
  }
  let results = await pipeline.exec();
  if (!results) {
    return stats
  }
  for (let i = 0; i < keys.length; ++i) {
    let result = results[i]?.[1]
    if (result && typeof result === 'object') {
      try {
        let info = getInfoFromKey(keys[i])
        if (info) {
          let row = result as { [key: string]: unknown }
          stats.push({
            ...info,
            callCount: getCountValue(row.call),
            errorCount: getCountValue(row.error),
            cacheCount: getCountValue(row.cache),
          })
        }
      } catch (error) {
        console.error('error in GetStats key:' + keys[i] + ' ' + JSON.stringify(error))
      }
    }
  }
  return stats
}
