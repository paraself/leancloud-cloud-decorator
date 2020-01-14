export declare class ErrorMsg<T extends {
    [key: string]: string | number | boolean;
}> {
    constructor(params: {
        msg: (f: T) => {
            [key: string]: string;
        } & {
            en: string;
        };
        params?: T;
        code?: number;
    });
    code?: number;
    params?: T;
    msg: (f: T) => {
        [key: string]: string;
    } & {
        en: string;
    };
}
