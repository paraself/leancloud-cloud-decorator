"use strict";
function __export(m) {
    for (var p in m) if (!exports.hasOwnProperty(p)) exports[p] = m[p];
}
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var package_json = require('./../package.json');
console.log(package_json.name + " " + package_json.version);
__export(require("./leancloud-cloud-decorator"));
__export(require("./base"));
__export(require("./cloudMetaData"));
__export(require("./cloudHandler"));
__export(require("./cloudStats"));
__export(require("./errorMsg"));
__export(require("./verify"));
const leancloud_cloud_decorator_1 = require("./leancloud-cloud-decorator");
const cloudHandler_1 = require("./cloudHandler");
const ioredis_1 = __importDefault(require("ioredis"));
const verify_1 = require("./verify");
function init(params) {
    leancloud_cloud_decorator_1.SetCache({
        cache: new ioredis_1.default(params.redisUrl, { maxRetriesPerRequest: null }),
        cachePrefix: params.redisPrefix
    });
    leancloud_cloud_decorator_1.SetInvokeCallback(params);
    params.errorCallback && cloudHandler_1.SetCloudErrorCallback(params.errorCallback);
    params.cloudInvokeCallback && cloudHandler_1.SetCloudInvokeCallback(params.cloudInvokeCallback);
    leancloud_cloud_decorator_1.SetListener(params);
    let verify = params.verify;
    if (verify) {
        // verify.cachePrefix = verify.cachePrefix || (params.redisPrefix+':verify')
        verify_1.InitVerify(Object.assign({ cachePrefix: (params.redisPrefix + ':verify') }, verify));
    }
}
exports.init = init;
//# sourceMappingURL=index.js.map