import AV from 'leanengine';
import { GeetestRegisterReturn, GetGeetestVerificationParams, SetGeetestVerificationParams } from './geetest';
export interface InitVerifyParams {
    cachePrefix?: string;
    geetest?: {
        geetest_id: string;
        geetest_key: string;
        fallbackCachePrefix: string;
    };
}
export declare type VerifyType = 'geetest' | 'sms';
export declare function InitVerify(params: InitVerifyParams): void;
export interface VerifyParams {
    /**
     * 验证类型
     */
    type: VerifyType;
    /**
     * 验证的sessionId
     */
    sessionId: string;
    /**
     * 前端调用第三方验证时的参数
     */
    data: {
        mobilePhoneNumber: any;
    } | GeetestRegisterReturn;
}
export interface VerifyGeetestParams {
    type: 'geetest';
    sessionId: string;
    data: GeetestRegisterReturn;
}
export interface VerifySmsParams {
    type: 'sms';
    sessionId: string;
    data: {
        mobilePhoneNumber: string;
    };
}
export declare function GetVerifyParams(params: {
    type: 'sms';
    user?: AV.User;
    sms: {
        mobilePhoneNumber?: string;
    };
}): Promise<VerifySmsParams>;
export declare function GetVerifyParams(params: {
    type: 'geetest';
    user?: AV.User;
    geetest: GetGeetestVerificationParams;
}): Promise<VerifyGeetestParams>;
export interface SetVerifyParams {
    sessionId: string;
    /**
     * 第三方验证所返回的内容
     */
    data: SetGeetestVerificationParams | {
        mobilePhoneNumber: string;
        smsCode: string;
    };
}
export declare function SetVerify(params: {
    type: VerifyType;
} & SetVerifyParams): Promise<VerifyParams>;
