"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const leanengine_1 = __importDefault(require("leanengine"));
const leancloud_storage_1 = __importDefault(require("leancloud-storage"));
const redis_1 = require("../redis");
const geetest_1 = require("./geetest");
const crypto_1 = require("crypto");
let geetest;
let cachePrefix = 'pteppp:verify:';
/**
 * 产生一个随机的32位的字符串
 */
function token() {
    return new Promise((resolve, reject) => {
        crypto_1.randomBytes(16, function (err, buffer) {
            if (err) {
                reject(err);
            }
            else {
                resolve(buffer.toString('hex'));
            }
        });
    });
}
function InitVerify(params) {
    cachePrefix = params.cachePrefix;
    if (params.geetest) {
        geetest = new geetest_1.GeetestVerify(Object.assign({ fallbackCachePrefix: params.cachePrefix + '_fallback' }, params.geetest));
    }
}
exports.InitVerify = InitVerify;
class VerifyParamsMobileNumberUsedError extends Error {
    constructor() {
        super('MobilePhoneNumberUsedError');
        this.name = 'MobilePhoneNumberUsedError';
    }
}
class VerifyParamsMissingUserOrMobilePhoneNumber extends Error {
    constructor() {
        super('VerifyParamsMissingUserOrMobilePhoneNumber');
        this.name = 'VerifyParamsMissingUserOrMobilePhoneNumber';
    }
}
async function GetVerifyParams(params) {
    let sessionId = await token();
    let data;
    const { user } = params;
    if (params.type == 'geetest') {
        if (!geetest) {
            throw new Error('Missing geetest when GetVerifyParams type==geetest');
        }
        data = (await geetest.GetVerification(params.geetest || {})).data;
    }
    else if (params.type == 'sms') {
        if ('sms' in params) {
            const { mobilePhoneNumber } = params.sms;
            if (!user && mobilePhoneNumber) {
                await leancloud_storage_1.default.Cloud.requestSmsCode(mobilePhoneNumber);
            }
            else if (user && mobilePhoneNumber) {
                let phoneUser = await new leanengine_1.default.Query('_User').equalTo('mobilePhoneNumber', mobilePhoneNumber).first();
                if (phoneUser && phoneUser.get('objectId') != user.get('objectId')) {
                    throw new VerifyParamsMobileNumberUsedError();
                }
                await leancloud_storage_1.default.Cloud.requestSmsCode(mobilePhoneNumber);
            }
            else if (user && user.getMobilePhoneNumber()) {
                await leancloud_storage_1.default.Cloud.requestSmsCode(user.getMobilePhoneNumber());
            }
            else {
                throw new VerifyParamsMissingUserOrMobilePhoneNumber();
            }
            data = { mobilePhoneNumber };
        }
        else {
            throw new Error('Missing sms when GetVerifyParams type==sms');
        }
    }
    else {
        throw new Error('Missing GetVerifyParams type ' + params.type);
    }
    let result = { data, sessionId, type: params.type };
    let key = cachePrefix + ':' + sessionId;
    await redis_1.redis.setex(key, 60 * 10, JSON.stringify(result));
    return result;
}
exports.GetVerifyParams = GetVerifyParams;
// export interface SetVerifyGeetestParams{
//     type:'geetest'
//     sessionId:string
//     data:SetGeetestVerificationParams
// }
async function SetVerify(params) {
    let { sessionId } = params;
    let key = cachePrefix + ':' + params.sessionId;
    let cache = await redis_1.redis.get(key);
    if (!cache) {
        throw new Error('Missing verify session. id ' + sessionId);
    }
    let verifyParams = JSON.parse(cache);
    if (verifyParams.type != params.type) {
        throw new Error('Error SetVerify type ' + verifyParams.type + ' != ' + params.type);
    }
    if (verifyParams.type == 'geetest') {
        let data = params.data;
        if (!data.geetest_challenge.startsWith(verifyParams.data.challenge)) {
            throw new Error('Different geetest_challenge when SetVerify');
        }
        await geetest.SetVerification(data);
    }
    else if (verifyParams.type == 'sms') {
        let data = params.data;
        //验证手机号
        await leancloud_storage_1.default.Cloud.verifySmsCode(data.smsCode, verifyParams.data.mobilePhoneNumber);
    }
    return verifyParams;
}
exports.SetVerify = SetVerify;
//# sourceMappingURL=index.js.map