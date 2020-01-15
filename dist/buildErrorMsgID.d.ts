#!/usr/bin/env node
import AV from 'leancloud-storage';
import { EnumLocale } from './buildIDCommon';
export declare type MsgIdConfig = {
    [key: string]: {
        [key in EnumLocale]?: string;
    } & {
        en: string;
    };
};
export declare let currentUser: AV.User | undefined;
