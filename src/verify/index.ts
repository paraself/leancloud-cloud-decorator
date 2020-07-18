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

export type VerifyType = 'geetest'


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
    type:VerifyType
    sessionId:string
    data:any
}

export interface VerifyGeetestParams{
    type:'geetest'
    sessionId:string
    data:GeetestRegisterReturn
}

export async function GetVerifyParams(params:{type:'geetest',geetest?:GetGeetestVerificationParams}):Promise<VerifyGeetestParams>
export async function GetVerifyParams(params:{type:VerifyType,geetest?:GetGeetestVerificationParams}):Promise<VerifyParams>{
    let sessionId = await token()
    let data:any
    if(params.type == 'geetest'){
        if(!geetest){
            throw new Error('Missing geetest when GetVerifyParams type==geetest')
        }
        data = geetest.GetVerification(params.geetest||{})
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
    data:SetGeetestVerificationParams
}

// export interface SetVerifyGeetestParams{
//     type:'geetest'
//     sessionId:string
//     data:SetGeetestVerificationParams
// }

// async function SetVerify(params:SetVerifyGeetestParams):Promise<{}>
export async function SetVerify(params:{type:VerifyType}&SetVerifyParams):Promise<void>{
    let {sessionId,data} = params
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
        if(params.data.geetest_challenge!=(verifyParams as VerifyGeetestParams).data.challenge){
            throw new Error('Different geetest_challenge when SetVerify')
        }
        return geetest.SetVerification(params.data)
    }
}