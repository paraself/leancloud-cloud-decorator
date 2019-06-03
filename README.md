# leancloud cloud decorator
通过装饰器自动加函数加入到leancloud的云函数定义中, 并加入缓存, 权限验证, 参数验证等功能

## 安装方法
```shell
$ npm install leancloud-cloud-decorator
```

## 定义云函数

```typescript
//云引擎部分
import { Cloud, CloudParams } from 'leancloud-cloud-decorator'

class User {
    
    /**
    * 获取用户自身信息, 会自动注册名字为User.GetUserInfo 的云函数
    */
    @Cloud()
    async GetUserInfo(params:CloudParams) : Promise<any>{
        // 直接返回内置字段 currentUser ,当前用户信息. 默认只有登入的用户才能调用此云函数
        return params.currentUser
    }

}
```

```typescript
//客户端部分
    AV.Cloud.run('User.GetUserInfo').then(r=>console.log(r))
```

## 云函数参数
```typescript
//云引擎部分
import { Cloud, CloudParams } from 'leancloud-cloud-decorator'
import Joi from 'joi'

//云函数参数接口必须继承CloudParams
interface GetUserInfoByIdParams extends CloudParams{
  userId: string
}

class User {
    /**
    * 获取指定用户信息
    */
    @Cloud<GetUserInfoByIdParams>({
        schema: {
          //userId 只能为长度为24位的字符串,且为必填,不符合条件的参数会进程reject处理
          userId: Joi.string().length(24).required(),
        },
        // 只有 admin 权限的用户,才能调用此函数
        roles:[['admin']]
    })
    async GetUserInfoById(params:GetUserInfoByIdParams) : Promise<any>{
        // 直接返回内置字段 currentUser ,当前用户信息. 默认只有登入的用户才能调用此云函数
        return params.currentUser
    }
}
```

## 缓存设置
加上cache字段,将会缓存云函数的返回内容,缓存期间请求云函数,不会真正执行云函数,会直接返回之前的缓存内容,直到缓存过期之后,请求云函数才会再次执行一次

```typescript
//云引擎部分
import { Cloud, CloudParams } from 'leancloud-cloud-decorator'

//云函数参数接口必须继承CloudParams
interface GetTimeParams extends CloudParams{
  name?: string
  id?: string
}
class User {
    //定义一个,每过一小时,刷新一次时间信息的云函数
    @Cloud<>({
        schema:{
          //两个参数都为可选参数
          name: Joi.string().optional(),
          id: Joi.string().optional(),
        }
        cache: {
            //参数有id字段,或者为'id','name' 字段组合时,才会使用缓存
            params: [['id'],['id','name']],
            //按小时缓存
            timeUnit: 'hour'
            //如果加上此设置,将会为每个用户单独创建一份缓存,每个用户将会返回不一样的时间信息
            //currentUser:true
        },
        //如果加上internal ,则不会注册leancloud云函数,只能在云引擎内部,通过代码引用方式调用此带缓存的函数
        //internal:true
    })
    async GetTime() : Promise<string>{
        return new Date().toString()
    }
}

let user = new User()
// 可以在其他地方,直接调用带缓存的函数
user.GetTime()
```

## 限流
有时需要限制每个用户调用某个接口的频率, 以防止非正常的用户请求
```typescript
//云引擎部分
import { Cloud, CloudParams } from 'leancloud-cloud-decorator'

class User {
    //定义一个,每过一小时,刷新一次时间信息的云函数
    @Cloud<>({
        schema:{}
        rateLimit: [
            {
                //每个用户每秒最多只能请求2次此云函数
                limit: 2,
                timeUnit: 'second'
            },
            {
                //每个用户每分钟最多只能请求30次此云函数
                limit: 30,
                timeUnit: 'minute'
            }
        ]
    })
    async GetTime() : Promise<string>{
        return new Date().toString()
    }
}

```

## 自动生成前端SDK
通过项目根目录下的 lcc-config.json 配置文件, 配置需要生成的前端SDK平台
```json
{
    "platforms": {
        "web_user": {
            "package": "@namespace/web-user"
        },
        "weapp": {
            "package": "@namespace/weapp"
        }
    }
}
```
安装模块时会通过 lcc-config.json 中的platforms字段生成模块中的平台的语法提示
```typescript
//云引擎部分
import { Cloud, CloudParams,Platform } from 'leancloud-cloud-decorator'

class User {
    //定义一个,每过一小时,刷新一次时间信息的云函数
    @Cloud<>({
        schema:{}
        //只生成 web_user 平台的API
        platforms: ['web_user']
    })
    async GetTime() : Promise<string>{
        return new Date().toString()
    }
}

```
也可手动通过 lcc-config 应用配置
```shell
$ npx lcc-config
```
生成SDK的命令为
```shell
$ npx lcc 平台名
```
平台必须存在于 lcc-config.json 配置文件中, platforms字段中

```shell
$ npx lcc web_user
```
会在 

release/api/web_user/src/lib

生成sdk代码
目前需要预先设置好项目,ts环境和index.ts代码

index.ts代码为
```typescript
// release/api/web_user/src/index.ts
import AV from 'leancloud-storage'
import sdkInfo from './info'

type CloudFunc = (name: string, data?: any, options?: AV.AuthOptions) => Promise<any>;
let __run: CloudFunc
let __rpc: CloudFunc

export function run(name: string, data?: any, options?: AV.AuthOptions): Promise<any> {
  return __run(name, Object.assign(data || {},sdkInfo) , options)
}
export function rpc(name: string, data?: any, options?: AV.AuthOptions): Promise<any> {
  return __rpc(name, Object.assign(data || {},sdkInfo) , options)
}

/**
 * 
 * @param av - AV空间对象, 调用sdk.init(AV) 即可
 */
export function init(av: {
  /**
   * 程序版,用于记录日志
   */
  version:string,
  Cloud: {
    run: CloudFunc,
    rpc: CloudFunc
  }
}) {
  let { Cloud } = av
  __run = Cloud.run
  __rpc = Cloud.rpc
  sdkInfo.version = av.version
}

export * from './lib';  
```