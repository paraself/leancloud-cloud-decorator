import * as AV from 'leanengine'
import _ from 'lodash'
import fs from 'fs'
import _Config from './config.json'
export let Config = _Config as unknown as {
  "cloudPrefix"?:string,
  "translate"?:string,
  "platforms"?: {[key:string]:{
    package: string,
    type?:string,
    module?:{[key:string]:string},
    devDependencies?:{[key:string]:string},
}}
}
import { exec,spawn} from 'child_process'

const _dirroot = __dirname+'/../../../'

const configFilePath = _dirroot+'/lcc-config.json'
// console.log(fs.readdirSync('./'))
if(fs.existsSync(configFilePath)){
    // @ts-ignore
    Config = JSON.parse(fs.readFileSync(configFilePath,'utf8')) 
}else{
    console.log(configFilePath+' does\'t exist')
}

const platforms :{[key:string]:
  {
    package:string,
    type?:string,
    module?:{[key:string]:string},
    devDependencies?:{[key:string]:string},
  }
}= Config.platforms || {}
const cloudPrefix = Config.cloudPrefix || ''
process.env.LCC_CLOUD_PREFIX = cloudPrefix
export {platforms,cloudPrefix}

export type Platform = keyof typeof platforms

export function CheckPlatform(platform:string):Platform{
  if(platforms[platform]){
    return platform as Platform
  }
  throw new Error('不存在平台 '+platform+' 更改 lcc-config.json 后请执行 lcc-config 更新平台配置')
}

export function GetModuleMap(platform:Platform):{[key : string]:string}{
  return platforms[platform].module || {}
}

// export enum Platform {
//   web_user = "web_user",
//   web_admin  = "web_admin",
//   weapp = "weapp",
//   app_dart = "app_dart"
// }


function getRoleNames (avUser:AV.User) {
  return avUser.getRoles()
    .then(roles => {
      return Promise.resolve(roles.map(e => e.getName()))
    })
}
/**
 * 输入一个用户，和权限的名字，测试这个用户是否具有该权限
 * @function isRole
 * @param  {AV.User} avUser 输入一个LC的用户
 * @param  {string} roleName 输入一个LC的用户
 * @return {Promise<boolean>} 返回这个用户是否具有该权限
 */
export async function isRole(avUser: AV.User, roleName:string) {
  try {
    var names = await getRoleNames(avUser)
    if (names.indexOf(roleName) !== -1) return Promise.resolve(true)
    else return Promise.resolve(false)
  } catch (error) {
    console.error(error)
    return Promise.resolve(false)
  }
}

export function isRoles (avUser: AV.User, roleArray:string[]) {
  return getRoleNames(avUser)
    .then(roleNames => {
      let diffArray = _.difference(roleArray, roleNames)
      let isContained = diffArray.length === 0
      return Promise.resolve(isContained)
    })
}


function _getQueryValueForCache(
  value: string | number | AV.Object | boolean | Date
): string {
  switch (typeof value) {
    case 'string':
      return encodeURIComponent(value)
    case 'number':
    case 'boolean':
      return '' + value
    case 'object': {
      if (value instanceof AV.Object) {
        return value.get('objectId')
      }
      if (value instanceof Date) {
        return value.getTime().toString()
      }
      throw new Error(
        'unsupported query cache value object ' + JSON.stringify(value)
      )
    }
    case 'undefined':
      return ''
    default: {
      throw new Error('unsupported query cache value type ' + typeof value)
    }
  }
}

function getQueryValueForCache(
  value: string | number | AV.Object | boolean | Date | any[]
): string {
  if(Array.isArray(value)){
    return value.map(e=>_getQueryValueForCache(e)).join('|')
  }
  switch (typeof value) {
    case 'string':
      return encodeURIComponent(value)
    case 'number':
    case 'boolean':
      return '' + value
    case 'object': {
      if (value instanceof AV.Object) {
        return value.get('objectId')
      }
      if (value instanceof Date) {
        return value.getTime().toString()
      }
      throw new Error(
        'unsupported query cache value object ' + JSON.stringify(value)
      )
    }
    case 'undefined':
      return ''
    default: {
      throw new Error('unsupported query cache value type ' + typeof value)
    }
  }
}

type EqualToConditionsType = {
  [key: string]: string | number | AV.Object | boolean | Date
}

export function getCacheKey(
  equalToConditions: EqualToConditionsType,
  cacheKey = '',
  symbol = '='
) {
  let keys = Object.keys(equalToConditions)
  keys.sort((x, y) => x.localeCompare(y))
  for (let i = 0; i < keys.length; ++i) {
    let key = keys[i]
    let value = key + symbol + getQueryValueForCache(equalToConditions[key])
    if (cacheKey) cacheKey += '&'
    cacheKey += value
  }
  return cacheKey
}



export function promiseExec(command:string){
  return new Promise<void>((resolve,reject)=>{
    let _err:any
      exec(command, { maxBuffer: 1024 * 800 }, (err, stdout, stderr) => {
          if (err) {
              _err = err
              console.log(command)
              console.log('\x1b[31m')
              if(stdout) console.log(stdout)
              if(stderr) console.log(stderr)
              console.log(err)
              console.log('\x1b[0m')
              reject(err)
              return
          }
          if(stdout) console.log(stdout)
          // resolve()
      }).on('close', (code, signal) =>  { if (code === 0 && !_err) { resolve() } else {process.exit(code || 0)} })
  })
}