export * from './leancloud-cloud-decorator';
export * from './base';
export * from './cloudMetaData';
export * from './cloudHandler';
export * from './cloudStats';
export * from './errorInfo';
import AV from 'leanengine';
interface InitParams {
    /**
     * redis连接地址
     */
    redisUrl: string;
    /**
     * redis 缓存前缀
     */
    redisPrefix: string;
    /**
     * 云函数错误回调
     */
    errorCallback?: (error: any) => any;
    /**
     * 云函数被调用回调
     */
    cloudInvokeCallback?: (name: string, request: AV.Cloud.CloudFunctionRequest) => void;
}
export declare function init(params: InitParams): void;
