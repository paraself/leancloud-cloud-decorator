export declare class ErrorMsg<T extends {
    [key: string]: string | number | boolean;
}> extends Error {
    constructor(params: {
        msg: (f: T) => {
            [key: string]: string;
        } & {
            en: string;
        };
        params?: T;
        code?: number;
        error?: Error;
    });
    code?: number;
    params?: T;
    msg: (f: T) => {
        [key: string]: string;
    } & {
        en: string;
    };
    error?: Error;
}
