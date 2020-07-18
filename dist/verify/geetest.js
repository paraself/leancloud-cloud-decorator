"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// import {ErrorMsg} from 'leancloud-cloud-decorator'
// import { Cloud, CloudParams } from './cloud'
const gt3_sdk_1 = __importDefault(require("gt3-sdk"));
// import Joi from 'joi'
// import IkkErrorInfo from '../plugins/IkkErrorInfo'
const redis_1 = require("../redis");
// import {token} from '@pte.ai/utils'
// let prefix = 'pteppp:verify:'
class GeetestVerify {
    constructor(params) {
        this.geetest = new gt3_sdk_1.default(params);
        // prefix = params.prefix
        this.fallbackCachePrefix = params.fallbackCachePrefix;
    }
    /**
     * 验证用户,当用户行为异常时需调用此函数验证,获取geetest的验证内容
     * 整体过程
     * 1.调用云函数 GetUserVerification
     * 2.将返回值中的data字段,前端传入geetest验证接口. web端事例如下
     * ``` js
     *    initGeetest({
     *         gt: data.gt,
     *         challenge: data.challenge,
     *         new_captcha: data.new_captcha, // 用于宕机时表示是新验证码的宕机
     *         offline: !data.success, // 表示用户后台检测极验服务器是否宕机，一般不需要关注
     *         product: "float", // 产品形式，包括：float，popup
     *         width: "100%"
     *
     *         // 更多配置参数请参见：http://www.geetest.com/install/sections/idx-client-sdk.html#config
     *     }, captchaObj=> console.log(captchaObj))
     * ```
     *   3.将geetest返回的 captchaObj.getValidate()数据, 传入云函数 SetUserVerification , 云函数不报错则通过验证
     */
    async GetVerification(params) {
        var client_type = params.client_type || 'web';
        let data = await this.register({ client_type });
        return { data };
    }
    /**
     * 验证登入,第二步骤,传入从geetest获取的信息. 验证错误抛出异常, 验证通过返回{}
     */
    async SetVerification(params) {
        return this.verify(params);
    }
    async verify(params) {
        return new Promise(async (resolve, reject) => {
            let key = this.fallbackCachePrefix + getChallengeForSession(params.geetest_challenge);
            let fallback = await redis_1.redis.get(key) == '1';
            let validateParams = {
                geetest_challenge: params.geetest_challenge,
                geetest_seccode: params.geetest_seccode,
                geetest_validate: params.geetest_validate
            };
            // 对ajax提供的验证凭证进行二次验证
            this.geetest.validate(fallback, validateParams, function (err, success) {
                if (err) {
                    // 网络错误
                    var errInfo = 'error in geetest.validate ' + JSON.stringify(err);
                    console.error(errInfo);
                    // throw IkkErrorInfo.create(err,IkkErrorInfo.INTERNAL_ERROR) 
                    reject(err);
                }
                else if (!success) {
                    reject(new Error('User geetest verification fail'));
                }
                else {
                    resolve();
                }
            });
        });
    }
    register(params) {
        return new Promise((resolve, reject) => {
            this.geetest.register(params, (err, data) => {
                if (err) {
                    var errInfo = JSON.stringify(err);
                    // console.error(errInfo)
                    reject(err);
                    return;
                }
                if (!data.success) {
                    var dataInfo = JSON.stringify(data);
                    console.error('geetest.register return !data.success ' + dataInfo);
                    // console.error(dataInfo)
                    // reject(new ErrorMsg({msg:params => ({en:''})}))
                    // reject(IkkErrorInfo.create(new Error(dataInfo),IkkErrorInfo.INTERNAL_ERROR))
                    let key = this.fallbackCachePrefix + getChallengeForSession(data.challenge);
                    redis_1.redis.setex(key, 60 * 10, '1').then(() => {
                        resolve(data);
                    });
                    // // 进入 failback，如果一直进入此模式，请检查服务器到极验服务器是否可访问
                    // apirefer
                    // // 为以防万一，你可以选择以下两种方式之一：
                    // // 1. 继续使用极验提供的failback备用方案
                    // req.session.fallback = true;
                    // res.send(data);
                    // 2. 使用自己提供的备用方案
                    // todo
                }
                else {
                    // 正常模式
                    // req.session.fallback = false;
                    // res.send(data);
                    resolve(data);
                }
            });
        });
    }
}
exports.GeetestVerify = GeetestVerify;
// let fallbackCachePrefix = 'pteppp:verify_fallback:'
// let geetest : Geetest
// export function initGeetest(params:{ geetest_id:string, geetest_key:string,prefix:string,fallbackCachePrefix:string }){
//     geetest = new Geetest(params)
//     // prefix = params.prefix
//     fallbackCachePrefix = params.fallbackCachePrefix
// }
/**
 * @param challenge challenge的长度有时为32位,有些操作中为34为,为了统一存储和对比,一律只取前32为
 */
function getChallengeForSession(challenge) {
    return challenge.substr(0, 32);
}
//# sourceMappingURL=geetest.js.map