#!/usr/bin/env node
import AV from 'leanengine';
import { EnumLocale } from './buildIDCommon';
export type MsgIdConfig = {
    [key: string]: {
        [key in EnumLocale]?: string;
    } & {
        en: string;
    };
};
export declare let currentUser: AV.User | undefined;
