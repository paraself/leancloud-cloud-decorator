export * from './leancloud-cloud-decorator';
export * from './base';
export * from './cloudMetaData';
export * from './cloudHandler';
export * from './cloudStats';
export * from './errorMsg';
export * from './verify';
import { CloudInvoke, CloudInvokeBefore, Listener } from './leancloud-cloud-decorator';
import { CloudFunctionError } from './cloudHandler';
import AV from 'leanengine';
import { InitVerifyParams } from './verify';
interface InitParams<T> extends Listener<T> {
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
    errorCallback?: (error: CloudFunctionError) => any;
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
    verify?: InitVerifyParams;
}
export declare function init<T = undefined>(params: InitParams<T>): void;
