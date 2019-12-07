import AV from 'leanengine';
export interface SDKVersion {
    platform: string;
    apiVersion: string;
    clientVersion: string;
}
/**
 *  @deprecated please use init
 */
export declare function SetCloudInvokeCallback(callback: (name: string, request: AV.Cloud.CloudFunctionRequest) => void): void;
export interface CloudFunctionError {
    /**
     * 出错时前端请求的用户
     */
    user?: AV.User;
    /**
     * 出错的模块(class名)
     */
    module: string;
    /**
     * 出错的行为(function名)
     */
    action: string;
    /**
     * 出错时客户端的请求参数
     */
    params: any;
    /**
     * 出错时操作的目标数据
     */
    target: AV.Object;
    /**
     * 出错时抛出的Error
     */
    error: Error | any;
    /**
     * 记录抛出的错误中ikkMessage字段,用于存储额外信息
     */
    errorInfo?: any;
}
/**
 * @deprecated please use init
 */
export declare function SetCloudErrorCallback(callback: (error: CloudFunctionError) => any): void;
interface DeleteCacheParams {
    userId?: string;
    module: string;
    function: string;
    params?: {
        [key: string]: any;
    };
}
export declare function DeleteCloudCache(params: DeleteCacheParams): Promise<{}>;
export {};
