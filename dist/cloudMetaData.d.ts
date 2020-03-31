export declare type DataType = 'number' | 'string' | 'boolean' | 'null' | 'undefined';
export interface IMetaDataParams {
    /**
     * 参数名称，例如 GetPracParams
     */
    name?: string;
    /**
     * 参数说明
     */
    comment?: string;
    /**
     * 如果该参数是基本类型之一，返回基本类型
     */
    type?: DataType;
    /**
     * literal类型
     */
    literal?: string | number;
    /**
     * 如果该参数为联合类型,返回类型数组
     */
    types?: IMetaDataParams[];
    /**
     * 参数是否是数组
     */
    isArray?: boolean;
    /**
     * 参数是否是索引对象
     */
    indexSignature?: {
        key: 'string' | 'number';
        value: IMetaDataParams;
    };
    /**
     * 成员说明
     */
    memberComments?: string[];
    /**
     * 如果参数是一个对象，则返回其成员
     */
    members?: IMetaDataParams[];
}
export interface IMetaData {
    /**
     * 云函数模块名称
     */
    class: string;
    /**
     * 云函数名称
     */
    name: string;
    /**
     * 云函数说明
     */
    comment?: string;
    /**
     * 返回值说明
     */
    valueComment?: string;
    /**
     * 参数描述
     */
    params?: IMetaDataParams;
    /**
     * 返回值类型
     */
    value?: IMetaDataParams;
    /**
     * 如果是一个可以被缓存的接口，则返回可缓存的key的组合
     */
    cache?: Array<Array<string>>;
    /**
     * 该云函数在哪个平台上可用
     */
    platforms?: Array<'weapp' | 'web-user' | 'web-admin' | 'ios' | 'android'>;
}
interface Decorator {
    name: string;
    type: {
        type: string;
        name: string;
        id: number;
    };
    arguments: {
        params?: string;
    };
}
interface TypedocData {
    id: number;
    name: string;
    kind: number;
    kindString: string;
    flags: {
        [key: string]: boolean;
    };
    originalName: string;
    children: TypedocData[];
    decorators?: Decorator[];
    comment?: Comment;
    indexSignature?: IndexSignature[];
    defaultValue?: string;
}
interface TypeData {
    type: string;
    value: string | number;
    types: TypeData[];
    name: string;
    id?: number;
    elementType?: TypeData;
    typeArguments: TypeData[];
    declaration?: TypedocData;
}
interface CommentTag {
    tag: 'deprecated';
    text: string;
}
interface Comment {
    shortText?: string;
    returns?: string;
    tags?: CommentTag[];
}
interface IndexSignature extends TypedocData {
    kindString: "Index signature";
    type: TypeData;
    parameters: ParameterData[];
}
interface ParameterData extends TypedocData {
    kindString: 'Parameter';
    type: TypeData;
}
export declare function PlatformString(text: string): string | null;
export declare function GetJsonValueString(text: string, key: string): string | null;
export declare function CreateCloudMetaData(datas: TypedocData[]): IMetaData[];
export {};
