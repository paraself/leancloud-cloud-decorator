"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cachePrefix = 'pteppp';
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
let lockPrefix = `${exports.cachePrefix}:lock:`;
/**
 * 设置redis缓存
 * @deprecated please use init
 */
function SetCache(params) {
    exports.redis = params.cache;
    exports.cachePrefix = params.cachePrefix || 'pteppp';
    lockPrefix = `${exports.cachePrefix}:lock:`;
    cacheUpdateCallbackList.forEach(e => e(params));
    exports.redis.defineCommand('setnxex', {
        numberOfKeys: 3,
        lua: fs_1.default.readFileSync(path_1.default.resolve(__dirname, 'setnxex.lua')).toString()
    });
}
exports.SetCache = SetCache;
let cacheUpdateCallbackList = [];
function AddCacheUpdateCallback(callback) {
    cacheUpdateCallbackList.push(callback);
}
exports.AddCacheUpdateCallback = AddCacheUpdateCallback;
/**
 *
 * @param {string} key
 * @return {Promise<number>} - 1成功加锁,0已被其他地方加锁
 */
function tryLock(key) {
    key = lockPrefix + key;
    //@ts-ignore
    return exports.redis.setnxex(key, 15, 1);
}
exports.tryLock = tryLock;
/**
 *
 * @param {string} key
 */
function unlock(key) {
    key = lockPrefix + key;
    return exports.redis.del(key);
}
exports.unlock = unlock;
class Lock {
    constructor(prefix) {
        this.prefix = prefix;
        this.lockList = [];
    }
    async tryLock(key) {
        key = this.prefix + key;
        try {
            if (await tryLock(key)) {
                this.lockList.push(key);
                return true;
            }
            else {
                //   IkkError.BearyErrorLog('tryLock fail', new Error(key).stack)
                return false;
            }
        }
        catch (error) {
            console.error(error);
            return true;
        }
    }
    unlock(key) {
        key = this.prefix + key;
        this.lockList.splice(0, this.lockList.indexOf(key));
        try {
            unlock(key);
        }
        catch (error) {
            console.error(error);
        }
    }
    clearLock() {
        try {
            for (var i = 0; i < this.lockList.length; ++i) {
                unlock(this.lockList[i]);
            }
        }
        catch (error) {
            console.error(error);
        }
    }
}
exports.Lock = Lock;
//# sourceMappingURL=redis.js.map