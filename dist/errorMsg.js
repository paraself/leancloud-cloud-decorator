"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class ErrorMsg extends Error {
    constructor(params) {
        super(params.msg(params.params).en);
        this.params = params.params;
        this.msg = params.msg;
        this.error = this.error;
    }
    getStringTemplate() {
        let params = Object.assign({}, this.params);
        Object.keys(params).forEach(e => params[e] = `{${e}}`);
        return this.msg(params);
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