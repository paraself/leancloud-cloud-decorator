export * from './leancloud-cloud-decorator';
export * from './base';
export * from './cloudMetaData';
export * from './cloudHandler';
export * from './cloudStats';
export * from './errorInfo';
import { CloudInvoke, CloudInvokeBefore } from './leancloud-cloud-decorator';
import AV from 'leanengine';
interface InitParams<T> {
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
    /**
     * 云函数调用前的回调, 可用于修改数据
     */
    beforeInvoke?: CloudInvokeBefore<T>;
    /**
     * 云函数调用后的回调, 可用于修改数据
     */
    afterInvoke?: CloudInvoke<T>;
}
export declare function init<T = undefined>(params: InitParams<T>): void;
