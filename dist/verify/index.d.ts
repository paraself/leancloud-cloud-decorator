import { GeetestRegisterReturn, GetGeetestVerificationParams, SetGeetestVerificationParams } from './geetest';
export interface InitVerifyParams {
    cachePrefix?: string;
    geetest?: {
        geetest_id: string;
        geetest_key: string;
        fallbackCachePrefix: string;
    };
}
export declare type VerifyType = 'geetest';
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
    data: any;
}
export interface VerifyGeetestParams {
    type: 'geetest';
    sessionId: string;
    data: GeetestRegisterReturn;
}
export declare function GetVerifyParams(params: {
    type: 'geetest';
    geetest?: GetGeetestVerificationParams;
}): Promise<VerifyGeetestParams>;
export interface SetVerifyParams {
    sessionId: string;
    /**
     * 第三方验证所返回的内容
     */
    data: SetGeetestVerificationParams;
}
export declare function SetVerify(params: {
    type: VerifyType;
} & SetVerifyParams): Promise<void>;
