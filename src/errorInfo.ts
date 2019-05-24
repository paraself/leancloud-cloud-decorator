/**
 * 创建带错误码的错误信息,使用例子
 * throw CreateError(new Error(), ErrorInfo.INVALID_USER)
 */  
export function CreateError (originalError, ikkMessage) {
  if (typeof originalError === 'string') originalError = new Error(originalError)
  // return Object.assign(originalError, { ikkMessage })
  return { originalError, ikkMessage }
}

export interface IErrorInfo{
  code: number
  cn?: string
  en?:string
}

export const ErrorInfo :{[key:string]:IErrorInfo} = {
  // 10 - User模块
  INVALID_USER: {
    code: 10001,
    cn: '无效用户',
    en: 'Invalid user'
  },

  USER_INFO_LOCKED: {
    code: 10002,
    cn: '用户信息锁定中，无法修改',
    en: 'Invalid user info update, info is locked'
  },

  USER_ERROR_CACHING_AVATAR: {
    code: 10003,
    cn: '缓存用户头像出错',
    en: 'Error when caching user avatar'
  },
  USER_Banned: {
    code: 10004,
    cn: 'User is banned',
    en: 'User is banned'
  },
  USER_VERIFY_FAIL: {
    code: 10005,
    cn: '用户验证失败',
    en: 'User verification fail'
  },
  USER_NEED_LOGIN: {
    code: 10200,
    cn: '用户需要登入',
    en: 'User need login'
  },
  USER_NEED_VERIFY_BEHAVIOUR: {
    code: 10101,
    cn: '用户需要行为验证',
    en: 'User need verify behaviour'
  },
  USER_NEED_VERIFY_LOCATION: {
    code: 10102,
    cn: '用户需要地理位置验证',
    en: 'User need verify location'
  },
  USER_NEED_VERIFY_MAIL: {
    code: 10103,
    cn: '用户需要邮箱验证',
    en: 'User need verify mail'
  },
  USER_NEED_VERIFY_PHONE: {
    code: 10104,
    cn: '用户需要手机验证',
    en: 'User need verify phone'
  },
  USER_NEED_VERIFY_BIOMETRIC: {
    code: 10105,
    cn: '用户需要生物验证',
    en: 'User need verify biometric'
  }
}