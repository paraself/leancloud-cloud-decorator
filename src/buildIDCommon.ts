export type CloudIdConfig = {[key:string]:{name:string,functions:{[key:string]:string}}}

export type CloudIdInfo = ({
    id: number;
    name: string;
    functions: {
        id: number;
        name: string;
    }[];
})[]

export type CloudIdInfoMap = {[key:string]:{
    id: number;
    name: string;
    functions: {[key:string]:{
        id: number;
        name: string;
    }};
}}

export function GetCloudInfo(config:CloudIdConfig):CloudIdInfo{
    return Object.keys(config).map(e=>Object.assign({id:parseInt(e)},
    Object.assign({},config[e],{functions: Object.keys(config[e].functions).map(f=>({id:parseInt(f),name:config[e].functions[f]})) }
    )))
}

export function GetCloudInfoMap(config:CloudIdConfig):CloudIdInfoMap{
    return Object.keys(config).map(e=>Object.assign({id:parseInt(e)},
    Object.assign({},config[e],{
        functions: Object.keys(config[e].functions).map(f=>({id:parseInt(f),name:config[e].functions[f]})).reduce((obj, item) => {
            obj[item.name] = item
            return obj
          }, {})
    }
    ))).reduce((obj, item) => {
        obj[item.name] = item
        return obj
      }, {})
}



/** 需要支持的语言的id */
export enum EnumLocale {
    /** 英语 */
    en = 'en',
    /** 简体中文 */
    cn = 'cn',
    /** 繁体中文 */
    tn = 'tn',
    /** 日语 */
    ja = 'ja',
    /** 韩语 */
    ko = 'ko',
    /** 意大利语 */
    it = 'it',
    /** 法语 */
    fr = 'fr',
    /** 西班牙语 */
    es = 'es',
    /** 越南语 */
    vi = 'vi',
    /** 土耳其语 */
    tr = 'tr',
    /** 德语 */
    de = 'de',
    /** 葡萄牙语 */
    pt = 'pt',
    /** 俄语 */
    ru = 'ru'
  }


export type MsgIdInfoMap = {[key:string]:{[key in EnumLocale]:string}&{id:number}}

export function GetMsgInfoMap(config:{[key:string]:{[key in EnumLocale]:string}}) {
    return Object.keys(config).map(e=>Object.assign({id:parseInt(e)},config[e]))
        .reduce((obj, item) => {
                obj[item.en] = item
                return obj
            }, {})
}