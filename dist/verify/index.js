"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
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
async function GetVerifyParams(params) {
    let sessionId = await token();
    let data;
    if (params.type == 'geetest') {
        if (!geetest) {
            throw new Error('Missing geetest when GetVerifyParams type==geetest');
        }
        data = (await geetest.GetVerification(params.geetest || {})).data;
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
// async function SetVerify(params:SetVerifyGeetestParams):Promise<{}>
async function SetVerify(params) {
    let { sessionId, data } = params;
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
        if (!params.data.geetest_challenge.startsWith(verifyParams.data.challenge)) {
            throw new Error('Different geetest_challenge when SetVerify');
        }
        return geetest.SetVerification(params.data);
    }
}
exports.SetVerify = SetVerify;
//# sourceMappingURL=index.js.map