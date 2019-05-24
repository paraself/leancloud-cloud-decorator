import * as AV from 'leanengine';
export declare enum Platform {
    web_user = "web_user",
    web_admin = "web_admin",
    weapp = "weapp",
    app_dart = "app_dart"
}
/**
 * 输入一个用户，和权限的名字，测试这个用户是否具有该权限
 * @function isRole
 * @param  {AV.User} avUser 输入一个LC的用户
 * @param  {string} roleName 输入一个LC的用户
 * @return {Promise<boolean>} 返回这个用户是否具有该权限
 */
export declare function isRole(avUser: AV.User, roleName: string): Promise<boolean>;
export declare function isRoles(avUser: AV.User, roleArray: string[]): Promise<boolean>;
declare type EqualToConditionsType = {
    [key: string]: string | number | AV.Object | boolean | Date;
};
export declare function getCacheKey(equalToConditions: EqualToConditionsType, cacheKey?: string, symbol?: string): string;
export {};
