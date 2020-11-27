import AV from 'leanengine';
export interface SDKVersion {
    platform: string;
    apiVersion: string;
    clientVersion: string;
}
/**
 * 设备信息
 */
export interface DeviceInfo {
    /**
     * 设备名,比如 iPad iPhone Android web
     */
    name: string;
    /**
     * 设备id, web版可使用设备指纹
     */
    id: string;
    /**
     * 设备的具体型号, 比如 iPhone6 , xiaomi9 , web版为浏览器名
     */
    model: string;
    /**
     * 设备品牌
     */
    BRAND: string;
    /**
     * 系统或者浏览器版本号
     */
    version: string;
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
     * 出错时前端请求的用户ip
     */
    ip?: string;
    /**
     * 出错的云函数名
     */
    function: string;
    /**
     * 出错的(钩子函数)模块(class名)
     */
    module: string;
    /**
     * 用户所运行的平台,需要结合前端sdk获取
     */
    platform?: string;
    /**
     * 用户所运行的api版本,需要结合前端sdk获取
     */
    api?: string;
    /**
     * 用户所运行的客户端版本,需要结合前端sdk获取
     */
    version?: string;
    /**
     * 出错的(钩子函数)行为(function名)
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
    /**
     * 缓存的运行环境, 即生成缓存的进程中  process.env.NODE_ENV  环境变量的值, NODE_ENV为空时 为 'dev' 环境
     * 默认为 process.env.NODE_ENV ,只清除当前环境所生成的缓存
     */
    env?: string | string[];
    function: string;
    params?: {
        [key: string]: any;
    };
}
export declare function DeleteCloudCache(params: DeleteCacheParams): Promise<{
    'day': number;
    'hour': number;
    'minute': number;
    'second': number;
    'month': number;
} | undefined>;
export {};
