import AV from 'leanengine';
/**
 *  @deprecated please use init
 */
export declare function SetCloudInvokeCallback(callback: (name: string, request: AV.Cloud.CloudFunctionRequest) => void): void;
/**
 * @deprecated please use init
 */
export declare function SetCloudErrorCallback(callback: (error: any) => any): void;
interface DeleteCacheParams {
    userId?: string;
    module: string;
    function: string;
    params: {
        [key: string]: any;
    };
}
export declare function DeleteCloudCache(params: DeleteCacheParams): Promise<any>;
export {};
