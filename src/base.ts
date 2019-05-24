import * as AV from 'leanengine'
import _ from 'lodash'


export enum Platform {
  web_user = "web_user",
  web_admin  = "web_admin",
  weapp = "weapp",
  app_dart = "app_dart"
}


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



function getQueryValueForCache(
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