import { Redis } from 'ioredis';
export declare let redis: Redis;
export declare let cachePrefix: string;
/**
 * 设置redis缓存
 * @deprecated please use init
 */
export declare function SetCache(params: {
    /**
     * redis连接实例
     */
    cache: Redis;
    /**
     * 缓存前缀
     */
    cachePrefix?: string;
}): void;
type CacheUpdateCallback = (params: {
    cache: Redis;
    cachePrefix?: string;
}) => void;
export declare function AddCacheUpdateCallback(callback: CacheUpdateCallback): void;
/**
 *
 * @param {string} key
 * @return {Promise<number>} - 1成功加锁,0已被其他地方加锁
 */
export declare function tryLock(key: any): any;
/**
 *
 * @param {string} key
 */
export declare function unlock(key: any): Promise<number>;
export declare class Lock {
    prefix: string;
    lockList: string[];
    constructor(prefix: any);
    tryLock(key: any): Promise<boolean>;
    unlock(key: any): void;
    clearLock(): void;
}
export {};
