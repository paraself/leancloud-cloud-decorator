
export class ErrorMsg<T extends {[key:string]:string|number|boolean} >{

    constructor(params:{
        msg:(f:T)=>{[key:string]:string} & {en:string},
        params?:T,
        code?:number
    }){
        this.params = params.params
        this.msg = params.msg
    }
    code?:number
    params?: T
    msg:(f:T)=>{[key:string]:string} & {en:string}
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