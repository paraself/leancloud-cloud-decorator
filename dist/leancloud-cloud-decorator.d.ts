import AV from 'leanengine';
import Joi from 'joi';
import { Platform } from './base';
export { Platform };
import { Redis } from 'ioredis';
export declare function SetCache(cache: Redis): void;
declare type EqualToConditionsType = {
    [key: string]: string | number | AV.Object | boolean | Date;
};
export declare function getCacheKey(equalToConditions: EqualToConditionsType, cacheKey?: string, symbol?: string): string;
declare type Environment = 'production' | 'staging' | string;
interface CacheOptions<T> {
    params: Array<Array<keyof T>>;
    timeUnit?: 'day' | 'hour' | 'minute' | 'month';
    /**
     * 缓存时长,单位为timeUnit,默认为1
     */
    count?: number;
    currentUser?: boolean;
    expireBy?: 'timeUnit' | 'request';
}
interface RateLimitOptions {
    limit: number;
    timeUnit: 'day' | 'hour' | 'minute' | 'second' | 'month';
}
declare type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;
/**
 * T为云函数的参数类型
 */
interface CloudOptions<T extends CloudParams> {
    platforms?: Array<Platform>;
    rpc?: boolean;
    environment?: Environment | Environment[];
    cache?: CacheOptions<T>;
    optionalName?: string;
    schema: {
        [key in keyof Omit<T, keyof CloudParams>]-?: Joi.Schema;
    };
    schemaCb?: (schema: Joi.ObjectSchema) => Joi.ObjectSchema;
    noUser?: true;
    roles?: string[][];
    rateLimit?: RateLimitOptions[];
    internal?: true;
}
export declare function Cloud<T extends CloudParams>(params?: CloudOptions<T>): (target: any, propertyKey: string, descriptor: PropertyDescriptor) => void;
export interface Lock {
    tryLock(key: string): boolean;
}
export interface CloudParams {
    currentUser?: AV.User;
    lock: Lock;
    request: AV.Cloud.CloudFunctionRequest;
    noCache?: boolean;
    adminId?: string;
}
