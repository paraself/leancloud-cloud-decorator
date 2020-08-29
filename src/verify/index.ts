import AV from 'leanengine'
import AV2 from 'leancloud-storage'
import { redis } from '../redis'
import {GeetestVerify,GeetestRegisterReturn,GetGeetestVerificationParams,SetGeetestVerificationParams} from './geetest'
import { randomBytes } from 'crypto'

let geetest:GeetestVerify

let cachePrefix = 'pteppp:verify:'

export interface InitVerifyParams{
    cachePrefix?:string
    geetest?:{
        geetest_id:string, 
        geetest_key:string,
        fallbackCachePrefix:string
    }
}

export type VerifyType = 'geetest'|'sms'


/**
 * 产生一个随机的32位的字符串
 */
function token(): Promise<string> {
    return new Promise((resolve, reject) => {
      randomBytes(16, function(err, buffer) {
        if (err) {
          reject(err)
        } else {
          resolve(buffer.toString('hex'))
        }
      })
    })
  }

export function InitVerify(params:InitVerifyParams){
    cachePrefix = params.cachePrefix!
    if(params.geetest){
        geetest = new GeetestVerify( Object.assign({fallbackCachePrefix:params.cachePrefix+'_fallback'},params.geetest) )
    }
}
export interface VerifyParams{
    /**
     * 验证类型
     */
    type:VerifyType
    /**
     * 验证的sessionId
     */
    sessionId:string
    /**
     * 前端调用第三方验证时的参数
     */
    data:{ mobilePhoneNumber }|GeetestRegisterReturn
}

export interface VerifyGeetestParams{
    type:'geetest'
    sessionId:string
    data:GeetestRegisterReturn
}

export interface VerifySmsParams{
    type:'sms'
    sessionId:string
    data:{ mobilePhoneNumber : string}
}

export class VerifyParamsMobileNumberUsedError extends Error{
    constructor(){
        super('MobilePhoneNumberUsedError')
        this.name = 'MobilePhoneNumberUsedError'
    }
}

export class VerifyParamsMissingUserOrMobilePhoneNumberError extends Error{
    constructor(){
        super('VerifyParamsMissingUserOrMobilePhoneNumber')
        this.name = 'VerifyParamsMissingUserOrMobilePhoneNumber'
    }
}

export async function GetVerifyParams(params:{type:'sms',user?:AV.User,sms:{mobilePhoneNumber?:string}}):Promise<VerifySmsParams>
export async function GetVerifyParams(params:{type:'geetest',user?:AV.User,geetest:GetGeetestVerificationParams}):Promise<VerifyGeetestParams>
export async function GetVerifyParams(params:{type:VerifyType,user?:AV.User,geetest?:GetGeetestVerificationParams,sms?:{mobilePhoneNumber?:string}}):Promise<VerifyParams>{
    let sessionId = await token()
    let data:any
    const {user} = params
    if(params.type == 'geetest'){
        if(!geetest){
            throw new Error('Missing geetest when GetVerifyParams type==geetest')
        }
        data = (await geetest.GetVerification(params.geetest||{})).data
    }else if(params.type == 'sms'){
        if('sms' in params){
            const {mobilePhoneNumber} = params.sms!
            if(!user && mobilePhoneNumber){
                await AV2.Cloud.requestSmsCode(mobilePhoneNumber)
            }else if(user && mobilePhoneNumber){
                let phoneUser = await new AV.Query<AV.User>('_User').equalTo('mobilePhoneNumber', mobilePhoneNumber).first()
                if (phoneUser && phoneUser.get('objectId')!=user.get('objectId')) {
                    throw new VerifyParamsMobileNumberUsedError()
                }
                await AV2.Cloud.requestSmsCode(mobilePhoneNumber)
            }else if(user && user.getMobilePhoneNumber()){
                await AV2.Cloud.requestSmsCode(user.getMobilePhoneNumber())
            }else{
                throw new VerifyParamsMissingUserOrMobilePhoneNumberError()
            }
            data = {mobilePhoneNumber}
        }else{
            throw new Error('Missing sms when GetVerifyParams type==sms')
        }
    }else{
        throw new Error('Missing GetVerifyParams type '+params.type)
    }
    let result = {data,sessionId,type:params.type}
    let key = cachePrefix+':'+sessionId
    await redis.setex(key, 60 * 10, JSON.stringify(result))
    return result
}

export interface SetVerifyParams{
    // type:VerifyType
    sessionId:string
    /**
     * 第三方验证所返回的内容
     */
    data:SetGeetestVerificationParams | {mobilePhoneNumber:string,smsCode:string}
}

// export interface SetVerifyGeetestParams{
//     type:'geetest'
//     sessionId:string
//     data:SetGeetestVerificationParams
// }

export async function SetVerify(params:{type:VerifyType}&SetVerifyParams):Promise<VerifyParams>{
    let {sessionId} = params
    let key = cachePrefix+':'+params.sessionId
    let cache = await redis.get(key)
    if(!cache){
        throw new Error('Missing verify session. id '+sessionId)
    }
    let verifyParams = JSON.parse(cache) as VerifyParams
    if(verifyParams.type!=params.type){
        throw new Error('Error SetVerify type '+verifyParams.type+' != '+params.type)
    }
    if(verifyParams.type=='geetest'){
        let data = params.data as SetGeetestVerificationParams
        if(!data.geetest_challenge.startsWith((verifyParams as VerifyGeetestParams).data.challenge)){
            throw new Error('Different geetest_challenge when SetVerify')
        }
        await geetest.SetVerification(data)
    }else if(verifyParams.type=='sms'){
        let data = params.data as {mobilePhoneNumber:string,smsCode:string}
        //验证手机号
        await AV2.Cloud.verifySmsCode(data.smsCode, (verifyParams as VerifySmsParams).data.mobilePhoneNumber)
    }
    return verifyParams
}