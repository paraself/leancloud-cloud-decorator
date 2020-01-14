"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class ErrorMsg {
    constructor(params) {
        this.params = params.params;
        this.msg = params.msg;
    }
}
exports.ErrorMsg = ErrorMsg;
new ErrorMsg({
    msg: params => ({
        en: `The error is ${params.is}`,
        cn: `错误是${params.is}`,
    }),
    params: {
        is: 'hahaha'
    },
    code: 10001
});
//# sourceMappingURL=errorMsg.js.map