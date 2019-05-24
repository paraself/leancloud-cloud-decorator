import AV from 'leanengine';
export declare function SetCloudInvokeCallback(callback: (name: string, request: AV.Cloud.ClassHookRequest) => void): void;
export declare function SetCloudErrorCallback(callback: (error: any) => any): void;
