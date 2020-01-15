#!/usr/bin/env node
import { CloudIdConfig } from './buildIDCommon';
export declare type CloudFunctionInfos = {
    name: string;
    functions: string[];
}[];
export declare function GetClouds(dirroot: string): CloudFunctionInfos;
export declare function CombinID(clouds: CloudFunctionInfos, config: CloudIdConfig): CloudIdConfig;
export declare function BuildCloudId(dirroot: string): void;
