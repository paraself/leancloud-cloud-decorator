export declare type CloudFunctionInfos = {
    name: string;
    functions: string[];
}[];
export declare function GetClouds(dirroot: string): CloudFunctionInfos;
export declare type CloudIdConfig = {
    [key: string]: {
        name: string;
        functions: {
            [key: string]: string;
        };
    };
};
export declare type CloudIdInfo = ({
    id: number;
    name: string;
    functions: {
        id: number;
        name: string;
    }[];
})[];
export declare function GetCloudInfo(config: CloudIdConfig): CloudIdInfo;
export declare function CombinID(clouds: CloudFunctionInfos, config: CloudIdConfig): CloudIdConfig;
export declare function BuildCloudId(dirroot: string): void;
