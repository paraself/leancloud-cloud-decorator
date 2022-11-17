"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.init = void 0;
var package_json = require("./../package.json");
console.log(package_json.name + " " + package_json.version);
__exportStar(require("./leancloud-cloud-decorator"), exports);
__exportStar(require("./base"), exports);
__exportStar(require("./cloudMetaData"), exports);
__exportStar(require("./cloudHandler"), exports);
__exportStar(require("./cloudStats"), exports);
__exportStar(require("./errorMsg"), exports);
__exportStar(require("./verify"), exports);
const leancloud_cloud_decorator_1 = require("./leancloud-cloud-decorator");
const cloudHandler_1 = require("./cloudHandler");
const ioredis_1 = __importDefault(require("ioredis"));
const verify_1 = require("./verify");
function init(params) {
    (0, leancloud_cloud_decorator_1.SetCache)({
        cache: new ioredis_1.default(params.redisUrl, { maxRetriesPerRequest: null }),
        cachePrefix: params.redisPrefix,
    });
    (0, leancloud_cloud_decorator_1.SetInvokeCallback)(params);
    params.errorCallback && (0, cloudHandler_1.SetCloudErrorCallback)(params.errorCallback);
    params.cloudInvokeCallback &&
        (0, cloudHandler_1.SetCloudInvokeCallback)(params.cloudInvokeCallback);
    params.afterVerify && (0, leancloud_cloud_decorator_1.SetAfterVerify)({ afterVerify: params.afterVerify });
    (0, leancloud_cloud_decorator_1.SetListener)(params);
    let verify = params.verify;
    if (verify) {
        // verify.cachePrefix = verify.cachePrefix || (params.redisPrefix+':verify')
        (0, verify_1.InitVerify)(Object.assign({ cachePrefix: params.redisPrefix + ":verify" }, verify));
    }
}
exports.init = init;
//# sourceMappingURL=index.js.map