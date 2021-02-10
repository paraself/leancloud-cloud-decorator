import * as AV from 'leanengine';
export declare let Config: {
    "cloudPrefix"?: string | undefined;
    "translate"?: string | undefined;
    "platforms"?: {
        [key: string]: {
            package: string;
            type?: string | undefined;
            module?: {
                [key: string]: string;
            } | undefined;
            devDependencies?: {
                [key: string]: string;
            } | undefined;
        };
    } | undefined;
};
declare const platforms: {
    [key: string]: {
        package: string;
        type?: string;
        module?: {
            [key: string]: string;
        };
        devDependencies?: {
            [key: string]: string;
        };
    };
};
declare const cloudPrefix: string;
export { platforms, cloudPrefix };
export declare type Platform = keyof typeof platforms;
export declare function CheckPlatform(platform: string): Platform;
export declare function GetModuleMap(platform: Platform): {
    [key: string]: string;
};
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
export declare function promiseExec(command: string): Promise<unknown>;
