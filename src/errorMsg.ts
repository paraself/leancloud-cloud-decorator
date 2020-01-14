
export class ErrorMsg<T extends {[key:string]:string|number|boolean} > extends Error{

    constructor(params:{
        msg:(f:T)=>{[key:string]:string} & {en:string},
        params?:T,
        code?:number
        error?:Error
    }){
        super(params.msg(params.params!).en)
        this.params = params.params
        this.msg = params.msg
        this.error = this.error
    }
    code?:number
    params?: T
    msg:(f:T)=>{[key:string]:string} & {en:string}
    error?:Error
}


new ErrorMsg({
    msg: params => ({
        en: `The error is ${params.is}`,
        cn: `错误是${params.is}`,
    }),
     params: {
      is: 'hahaha'
     },
    code:10001
})