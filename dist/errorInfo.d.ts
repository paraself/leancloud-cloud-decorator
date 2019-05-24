/**
 * 创建带错误码的错误信息,使用例子
 * throw CreateError(new Error(), ErrorInfo.INVALID_USER)
 */
export declare function CreateError(originalError: any, ikkMessage: any): {
    originalError: any;
    ikkMessage: any;
};
export interface IErrorInfo {
    code: number;
    cn?: string;
    en?: string;
}
export declare const ErrorInfo: {
    [key: string]: IErrorInfo;
};
