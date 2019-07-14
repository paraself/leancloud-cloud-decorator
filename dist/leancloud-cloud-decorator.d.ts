/// <reference types="node" />
import AV from 'leanengine';
import Joi from 'joi';
import { Platform, getCacheKey } from './base';
export { Platform, getCacheKey };
import { SetCache } from './redis';
export { SetCache };
declare type Environment = 'production' | 'staging' | string;
interface CacheOptions<T> {
    /**
     * 需要缓存的参数条件,请求参数完全符合其中某个数组中的参数组合时,才调用缓存
     */
    params: Array<Array<keyof T>>;
    /**
     * 存储的时间长度单位
     */
    timeUnit?: 'day' | 'hour' | 'minute' | 'month';
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
declare type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;
declare type TypedSchemaLike<T> = T extends string ? Joi.StringSchema : T extends Array<infer U> ? Joi.ArraySchema : T extends number ? Joi.NumberSchema : T extends Date ? Joi.DateSchema : T extends boolean ? Joi.BooleanSchema : T extends Buffer ? Joi.BinarySchema : T extends Object ? Joi.ObjectSchema : Joi.AnySchema;
/**
 * T为云函数的参数类型
 */
interface CloudOptions<T extends CloudParams> {
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
     * 备选名,用于让新的云函数,兼容旧的云函数调用
     */
    optionalName?: string;
    /**
     * 参数的schema, 必填参数记得加上 .required()
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
     * 每个用户调用此云函数的频率设置
     */
    rateLimit?: RateLimitOptions[];
    /**
     * 内部函数,不注册云函数,但是会应用缓存的功能,以供内部调用
     */
    internal?: true;
}
/**
 * 将函数加入云函数中,云函数名为 ``类名.函数名``
 */
export declare function Cloud<T extends CloudParams>(params?: CloudOptions<T>): (target: any, propertyKey: string, descriptor: PropertyDescriptor) => void;
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
    lock: Lock;
    /**
     * 原始的leancloud 的request内容
     */
    request: AV.Cloud.CloudFunctionRequest;
    /**
     * 此请求强制不使用缓存
     */
    noCache?: boolean;
    /**
     * 调用云函数的管理员id,用于特殊操作,比如noCache操作
     */
    adminId?: string;
}
