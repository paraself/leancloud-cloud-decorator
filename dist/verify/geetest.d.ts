import Geetest from 'gt3-sdk';
export declare class GeetestVerify {
    fallbackCachePrefix: string;
    geetest: Geetest;
    constructor(params: {
        geetest_id: string;
        geetest_key: string;
        fallbackCachePrefix: string;
    });
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
    GetVerification(params: GetGeetestVerificationParams): Promise<{
        data: GeetestRegisterReturn;
    }>;
    /**
     * 验证登入,第二步骤,传入从geetest获取的信息. 验证错误抛出异常, 验证通过返回{}
     */
    SetVerification(params: SetGeetestVerificationParams): Promise<void>;
    private verify;
    private register;
}
export interface GeetestRegisterReturn {
    gt: string;
    /**
     * 正常时长度为32位,fallback时长度为34位.存储时, 统一只存32位长度
     */
    challenge: string;
    new_captcha: boolean;
    success: number;
}
export interface GetGeetestVerificationParams {
    /**
     * 客户端类型，web（pc浏览器），h5（手机浏览器，包括webview），native（原生app），unknown（未知）
     */
    client_type?: 'web' | 'h5' | 'native' | 'unknown';
}
/**
 * geetest返回的数据
 */
export interface SetGeetestVerificationParams {
    geetest_challenge: string;
    geetest_seccode: string;
    geetest_validate: string;
}
