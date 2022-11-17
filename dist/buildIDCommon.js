"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GetMsgInfoMap = exports.EnumLocale = exports.GetCloudInfoMap = exports.GetCloudInfo = void 0;
function GetCloudInfo(config) {
    return Object.keys(config).map(e => Object.assign({ id: parseInt(e) }, Object.assign({}, config[e], { functions: Object.keys(config[e].functions).map(f => ({ id: parseInt(f), name: config[e].functions[f] })) })));
}
exports.GetCloudInfo = GetCloudInfo;
function GetCloudInfoMap(config) {
    return Object.keys(config).map(e => Object.assign({ id: parseInt(e) }, Object.assign({}, config[e], {
        functions: Object.keys(config[e].functions).map(f => ({ id: parseInt(f), name: config[e].functions[f] })).reduce((obj, item) => {
            obj[item.name] = item;
            return obj;
        }, {})
    }))).reduce((obj, item) => {
        obj[item.name] = item;
        return obj;
    }, {});
}
exports.GetCloudInfoMap = GetCloudInfoMap;
/** 需要支持的语言的id */
var EnumLocale;
(function (EnumLocale) {
    /** 英语 */
    EnumLocale["en"] = "en";
    /** 简体中文 */
    EnumLocale["cn"] = "cn";
    /** 繁体中文 */
    EnumLocale["tn"] = "tn";
    /** 日语 */
    EnumLocale["ja"] = "ja";
    /** 韩语 */
    EnumLocale["ko"] = "ko";
    /** 意大利语 */
    EnumLocale["it"] = "it";
    /** 法语 */
    EnumLocale["fr"] = "fr";
    /** 西班牙语 */
    EnumLocale["es"] = "es";
    /** 越南语 */
    EnumLocale["vi"] = "vi";
    /** 土耳其语 */
    EnumLocale["tr"] = "tr";
    /** 德语 */
    EnumLocale["de"] = "de";
    /** 葡萄牙语 */
    EnumLocale["pt"] = "pt";
    /** 俄语 */
    EnumLocale["ru"] = "ru";
})(EnumLocale = exports.EnumLocale || (exports.EnumLocale = {}));
function GetMsgInfoMap(config) {
    return Object.keys(config).map(e => Object.assign({ id: parseInt(e) }, config[e]))
        .reduce((obj, item) => {
        obj[item.en] = item;
        return obj;
    }, {});
}
exports.GetMsgInfoMap = GetMsgInfoMap;
//# sourceMappingURL=buildIDCommon.js.map