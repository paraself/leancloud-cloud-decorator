/// <reference types="node" />
import AV from 'leanengine';
import Joi from 'joi';
import { SDKVersion } from './cloudHandler';
import { Platform, getCacheKey } from './base';
export { Platform, getCacheKey };
import { SetCache } from './redis';
export { SetCache };
import { VerifyType, SetVerifyParams, VerifyParams } from './verify';
export interface CloudInvokeParams<T> {
    functionName: string;
    request: AV.Cloud.CloudFunctionRequest & {
        noUser?: true;
        internal?: true;
    } & {
        internalData?: T;
    } & {
        params: {
            _api?: SDKVersion;
        };
    };
    data?: any;
    cloudOptions?: CloudOptions<any>;
}
export declare type CloudInvoke<T> = (params: CloudInvokeParams<T>) => Promise<any>;
export declare type SemverCloudInvoke<T> = {
    /**
     * 平台
     */
    platform: Platform;
    /**
     * 可执行的版本
     */
    semver: string;
    /**
     * 符合条件时的回调
     */
    callback: CloudInvoke<T>;
};
export declare type CloudInvokeBefore<T> = CloudInvoke<T>;
export declare function SetInvokeCallback<T>(params: {
    beforeInvoke?: CloudInvokeBefore<T>;
    afterInvoke?: CloudInvoke<T>;
}): void;
export declare function SetAfterVerify(params: {
    afterVerify: (params: VerifyParams & {
        user?: AV.User;
    }) => Promise<void>;
}): void;
declare type Environment = 'production' | 'staging' | string;
interface CacheOptions<T> {
    /**
     * 需要缓存的参数条件,请求参数完全符合其中某个数组中的参数组合时,才调用缓存. _开头为内部参数,不会被判断
     */
    params: Array<Array<keyof T>>;
    /**
     * 存储的时间长度单位
     */
    timeUnit?: 'day' | 'hour' | 'minute' | 'month' | 'second';
    /**
     * 缓存时长,单位为timeUnit,默认为1
     */
    count?: number;
    /**
     * 是否每个用户分别使用一个缓存
     */
    currentUser?: boolean;
    /**
     * 过期时间基于时间单位还是请求时间. 默认request. timeUnit为某个时间单位的整点开始即时,request为请求的时候开始计时
     */
    expireBy?: 'timeUnit' | 'request';
    /**
     * redis 地址, 不填则使用默认redis
     */
    redisUrl?: string;
}
interface RateLimitOptions {
    /**
     * 时间数量
     */
    limit: number;
    /**
     * 时间单位
     */
    timeUnit: 'day' | 'hour' | 'minute' | 'second' | 'month';
}
export interface VerifyOptions {
    /**
     * 验证类型
     */
    type: VerifyType;
    /**
     * 多少次调用需要走一次验证
     */
    count?: number;
    /**
     * 时间单位
     */
    timeUnit: 'day' | 'hour' | 'minute' | 'second' | 'month';
    /**
     * 过期时间,单位为秒. 默认为30天
     */
    expire?: number;
}
declare type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;
declare type TypedSchemaLike<T> = T extends string ? Joi.StringSchema : T extends Array<infer U> ? Joi.ArraySchema : T extends number ? Joi.NumberSchema : T extends Date ? Joi.DateSchema : T extends boolean ? Joi.BooleanSchema : T extends Buffer ? Joi.BinarySchema : T extends Object ? Joi.ObjectSchema : Joi.AnySchema;
/**
 * T为云函数的参数类型
 */
interface CloudOptions<T extends CloudParams, A = any> {
    /**
     * 自动生成SDK的平台
     */
    platforms?: Array<Platform>;
    /**
     * 是否为RPC调用
     */
    rpc?: boolean;
    /**
     * 运行环境,生产环境还是预备环境
     */
    environment?: Environment | Environment[];
    /**
     * 缓存配置
     */
    cache?: CacheOptions<T>;
    /**
     * 防抖配置
     */
    debounce?: boolean | Array<Array<keyof T>>;
    /**
     * 备选名,用于让新的云函数,兼容旧的云函数调用
     */
    optionalName?: string;
    /**
     * 参数的schema, 必填参数记得加上 .required() . _开头为内部参数,不会被判断
     */
    schema: {
        [key in keyof Omit<T, keyof CloudParams>]-?: TypedSchemaLike<T[key]>;
    };
    /**
     * schema的回调,提供更多配置选项用
     */
    schemaCb?: (schema: Joi.ObjectSchema) => Joi.ObjectSchema;
    /**
     * 可以无用户调用此云函数
     */
    noUser?: true;
    /**
     * 调用此云函数需要的权限
     */
    roles?: string[][];
    /**
     * 每个用户调用此云函数的频率设置, 没有用户情况下, 使用ip限流
     */
    rateLimit?: RateLimitOptions[];
    /**
     * 内部函数,不注册云函数,但是会应用缓存的功能,以供内部调用
     */
    internal?: true;
    /**
     * noUser为true的时, 默认不fetch User数据, 加上此设置,强制fetch User数据
     */
    fetchUser?: true;
    /**
     * 云函数调用前的回调, 可用于修改数据. 在全局beforeInvoke之后执行
     */
    beforeInvoke?: CloudInvoke<A>;
    /**
     * @deprecated
     * 云函数调用后的回调, 可用于修改数据, 在全局afterInvoke之前执行
     */
    afterInvoke?: CloudInvoke<A>;
    /**
     * 云函数调用后的回调, 可用于修改数据, 在全局afterInvoke之前执行
     */
    afterInvokes?: SemverCloudInvoke<A>[];
    /**
     * 额外自定义配置信息
     */
    customOptions?: any;
    /**
     * 模块id,可以自动生成,也可以指定
     */
    moduleId?: number;
    /**
     * 云函数id,可以自动生成,也可以指定
     */
    functionId?: number;
    /**
     * 是否需要验证后才能执行
     */
    verify?: VerifyOptions;
    /**
     * 服务端 标记哪些云函数可以进行客户端缓存，并把该标记发布到sdk
     */
    clientCache?: {
        /**
         * 配置存储的key, 以及符合配置条件的请求才会被缓存
         */
        keyPath: (keyof T)[][];
    };
    /**
     * 版本标记。当前端升级api模块之后，调用接口时生成的clientCacheVersion也不同。会把返回的version加入到缓存的key path里。
     */
    clientCacheVersionParams?: (params: any) => string;
}
export interface Listener<A> {
    /**
     * 限流被触发的回调
     */
    onRateLimited?: CloudInvoke<A>;
}
export declare function SetListener(p: Listener<any>): void;
export declare class SchemaError extends Error {
    validationError: Joi.ValidationError;
    constructor(error: Joi.ValidationError);
}
export declare class DebounceError extends Error {
    constructor(message?: string);
}
export declare class MissingVerify extends Error {
    constructor(message?: string);
}
export declare class VerifyError extends Error {
    constructor(message?: string);
}
export declare class RateLimitError extends AV.Cloud.Error {
    functionName: string;
    user: string;
    count: number;
    limit: number;
    timeUnit: string;
    code: number;
    constructor(params: {
        functionName: string;
        user: string;
        count: number;
        limit: number;
        timeUnit: string;
        code: number;
    });
}
/**
 * 将函数加入云函数中,云函数名为 ``类名.函数名``
 */
export declare function Cloud<T extends CloudParams, A = any>(params?: CloudOptions<T, A>): (target: any, propertyKey: string, descriptor: PropertyDescriptor) => void;
export interface Lock {
    /**
     * 尝试锁住某个key,成功返回true,失败返回false, 会在云函数结束后自动解锁
     */
    tryLock(key: string): Promise<boolean>;
    /**
     * 主动解锁某个key
     */
    unlock(key: string): Promise<void>;
}
/**
 * 云函数参数的内置字段
 */
export interface CloudParams {
    /**
     * 当前用户
     */
    currentUser?: AV.User;
    /**
     * 操作锁,用于避免不同请求中,同时对某个数据进行操作
     */
    lock?: Lock;
    /**
     * 原始的leancloud 的request内容
     */
    request?: AV.Cloud.CloudFunctionRequest;
    /**
     * 此请求强制不使用缓存
     */
    noCache?: boolean;
    /**
     * 调用云函数的管理员id,用于特殊操作,比如noCache操作
     */
    adminId?: string;
    /**
     * 调用云函数的sdk信息
     */
    _api?: SDKVersion;
    /**
     * 验证参数
     */
    cloudVerify?: SetVerifyParams;
}
