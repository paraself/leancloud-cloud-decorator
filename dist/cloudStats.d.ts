interface cloudInfo {
    function?: string;
    module?: string;
    action?: string;
    /**
     * 平台名
     */
    platform?: string;
    /**
     * api版本号
     */
    api?: string;
    /**
     * 客户端版本号
     */
    version?: string;
}
export declare function IncrCall(info: cloudInfo): Promise<any>;
export declare function IncrError(info: cloudInfo): Promise<any> | undefined;
export interface GetStatsReturn {
    /**
     * 云函数名称
     */
    function?: string;
    /**
     * 数据表名称
     */
    module?: string;
    /**
     * 钩子函数名
     */
    action?: string;
    /**
     * 服务器分组
     */
    group: string;
    /**
     * 环境名称
     */
    env: string;
    /**
     * 平台名
     */
    platform?: string;
    /**
     * api版本号
     */
    api?: string;
    /**
     * 客户端版本号
     */
    version?: string;
    /**
     * 字符串日期, 例如2019-09-20
     */
    date: string;
    /**
     * 该接口被调用的次数
     */
    callCount: number;
    /**
     * 出错的次数
     */
    errorCount: number;
}
export declare function GetStats(): Promise<GetStatsReturn[]>;
export {};
