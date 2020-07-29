# leancloud cloud decorator
通过装饰器自动加函数加入到leancloud的云函数定义中, 并加入缓存, 权限验证, 参数验证, 自动生成前端接口sdk等功能。

**注意：装饰器必须在TS环境中使用, 如果你不知道如何在LC中配置TS环境，请看[LC云引擎TS示例项目](https://github.com/paraself/leancloud-node-ts)**

## 安装方法
```shell
$ npm install leancloud-cloud-decorator
```

## 初始化
```typescript
import { init } from 'leancloud-cloud-decorator'
init({
   // redis地址
  redisUrl: 'your redis url',
   // redis保存前缀
  redisPrefix: 'prefax',
  //错误回调,可选参数,用于搜集错误
  errorCallback:errorInfo => {
    console.error(errorInfo)
    return errorInfo.error
  },
  //云函数被调用回调,可选参数,用于搜集云函数调用信息
  cloudInvokeCallback:(name, request) => {
    console.log(request.expressReq)
  }
})
```

## 定义云函数

这里我们约定，所有的云函数文件，必须放在``src/cloud/xxxx.ts``里。一般一个ts文件，是一个云函数命名空间。例如``user.ts``, ``payment.ts``等。
在每个云函数文件中，需要导出一个云函数模块的实例，写法如下：

```typescript
// 云引擎部分：src/cloud/user.ts 将用户相关的云函数定义写在这个文件里
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
let user = new User()
export default user

// 项目入口：src/app.ts 在这里记得导入一次上面的模块, 即可加载上面的定义为实际的云函数
import './cloud/user.ts'

```
这样实际上是定义了一个名字叫做 ``User.GetUserInfo``的云函数。直接在客户端可以用LC的``AC.Cloud.run``方法来直接调用云函数。除了LC的这种方法之外，我们也可以从后端自动发布前端的接口api模块给前端用。这样做的好处是，接口参数，类型等信息，直接集成在api模块里了。这个我们后面会讲到。
```typescript
//客户端部分
// 1. LC的云函数调用方法
AV.Cloud.run('User.GetUserInfo').then(r=>console.log(r))
// 2. 如果使用了本装饰器的云函数前端api发布功能，则可以在前端这么使用
let user = await User.GetUserInfo(xxxx)
```

## 云函数参数
通过TS里的interface，我们可以在前后端统一参数的类型。后端定义接口的参数类型，这个类型能够随着api发布，发布到前端进行静态的类型检查，避免前后端经常对于接口参数不明确的问题。
```typescript
// 云引擎部分
import { Cloud, CloudParams } from 'leancloud-cloud-decorator'
import Joi from 'joi'

// 云函数参数接口必须继承CloudParams
interface GetUserInfoByIdParams extends CloudParams{
  userId: string
  isAnonymous?: boolean // 可选参数
}

class User {
    /**
    * 获取指定用户信息
    */
    @Cloud<GetUserInfoByIdParams>({
        schema: {
          //userId 只能为长度为24位的字符串,且为必填,不符合条件的参数会进程reject处理
          userId: Joi.string().length(24).required(),
          isAnonymous: Joi.boolean().optional()
        }
    })
    async GetUserInfoById(params:GetUserInfoByIdParams) : Promise<any>{
        // 直接返回内置字段 currentUser。默认所有的云函数都必须检验用户的信息，并拿到currentUser。如果你不需要currentUser的话，则可以设置：``noUser: true`` 进行关闭。
        return params.currentUser
    }
}
```

## 缓存设置
云函数设置里，加上cache字段，将会缓存云函数的返回内容，缓存期间请求云函数，不会真正执行云函数，会直接返回之前的缓存内容，直到缓存过期之后，请求云函数才会再次执行一次。

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
            //参数有id字段,或者为'id','name' 字段组合时,才会使用缓存，只有name的话，不会开启缓存
            params: [['id'],['id','name']],
            //按小时缓存
            timeUnit: 'hour'
            //如果加上此设置,将会为每个用户单独创建一份缓存,适用于每个用户返回的内容不一样的场景
            currentUser:true,
            // 过期时间基于时间单位还是请求时间. 默认request. timeUnit为某个时间单位的整点开始即时,request为请求的时候开始计时
            expireBy: 'request'
        }
    })
    async GetTime() : Promise<string>{
        return new Date().toString()
    }
}

let user = new User()
export default user
// 也可以后端代码的其他位置，直接import这个模块，调用里面的云函数
user.GetTime()
```
## 函数防抖
debounce字段为函数防抖动配置,配置内容为参数列表条件的数组.当用户参数满足云函数配置中的其中一个数组的条件时启用函数防抖
同一个用户，同样的函数名，如果参数相同的话，前一个请求如果没有结束完，下一个请求就会被debounce
```typescript
class Test{
  @Cloud<TestDebounceParams>({
    schema:{
      expId:Joi.string().optional(),
      id:Joi.string().optional(),
    },
    debounce:[["expId"]]
  })
  async TestDebounce(params:TestDebounceParams){
    await new Promise((resolve)=>{
      setTimeout(resolve, 3000);
    })
    console.log({
      expId:params.expId,
      id:params.id
    })
  }
}
```

## 限流
有时需要限制每个用户调用某个接口的频率, 以防止非正常的用户请求。

```typescript
//云引擎部分
import { Cloud, CloudParams } from 'leancloud-cloud-decorator'

class User {
    @Cloud<>({
        schema:{}
        // 限流配置数组里的每一个条件，必须同时满足
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

## 验证
可给云函数添加需要验证才能调用的条件。比如，Post一个表单，新建一个专辑，申请一个工单等。对于这种Post类型的接口，如果不验证调用接口是否是真人的话，很容易被坏人用脚本工具，创建大量脏数据，同时浪费服务器资源。因此，我们把行为验证功能，集成进入云函数设置中。如果设置中开启了verify选项，则必须经过行为验证，才能调用。目前仅支持[极验Geetest](https://www.geetest.com/)验证。未来可以增加更多种类的验证方式，例如短信验证，地理位置验证，声纹验证，App验证，自定义验证等方式。

```typescript
//云引擎部分
import { Cloud, CloudParams, init, VerifyError, MissingVerify } from 'leancloud-cloud-decorator'

// 验证所需key添加在init中
init({
  verify: {
    geetest: {
      geetest_id:{YOUR GEETEST_ID},
      geetest_key: {YOUR GEETEST_KEY}
    }
  }
  errorCallback:errorInfo => {
    // 回调中捕获验证错误,返回自定义的错误码给前端识别
    if (errorInfo.error instanceof VerifyError) {
      return {code:411,message:'verify error'}
    }else if (errorInfo.error instanceof MissingVerify) {
      return {code:410,message:'missing verify'}
    }
    return errorInfo
  }
})

class User {
    @Cloud<>({
        schema:{}
        // 在{timeUnit}单位时间内,被用户调用{count}需要进行{type}类型的验证,目前type类型仅支持geetest
        verify: {
          type: 'geetest',
          count: 2,
          timeUnit:'day'
        }
    })
    async GetTime() : Promise<string>{
        return new Date().toString()
    }
}

```

1. 前端可通过云函数 Cloud.GetVerifyParams 获取验证所需的参数, 该云函数的返回值类型为：
```typescript
interface VerifyParams{
    /**
     * 验证类型
     */
    type:VerifyType
    /**
     * 验证的sessionId
     */
    sessionId:string
    /**
     * 前端调用第三方验证时的参数
     */
    data:any
}
type VerifyType = 'geetest'
```
2. 在客户端中，集成geetest的sdk，并将Cloud.GetVerifyParams返回的数据，传入geetest的sdk中。具体如下：
``` ts
// geetest前端执行例子
var verifyParams = await API.Cloud.GetVerifyParams({type:'geetest'})
let geetestResult
function TestGeetest(data)
{
    // 调用 initGeetest 初始化参数
    // 参数1：配置参数
    // 参数2：回调，回调的第一个参数验证码对象，之后可以使用它调用相应的接口
    initGeetest({
     gt: data.gt,
     challenge: data.challenge,
     /* eslint-disable-next-line */
     new_captcha: data.new_captcha, // 用于宕机时表示是新验证码的宕机
     offline: !data.success, // 表示用户后台检测极验服务器是否宕机，一般不需要关注
     product: 'bind', // 产品形式，包括：float，popup
     width: '300px',
     https: true
     // 更多配置参数请参见：http://www.geetest.com/install/sections/idx-client-sdk.html#config
   }, (captchaObj: any) => {
     // 当验证实例准备就绪的时候，调用验证方法
     captchaObj.onReady((e: any) => {
       captchaObj.verify()
     })
     // 当验证成功之后，拿到验证参数继续传递给云函数
     captchaObj.onSuccess(() => {
       const geetestResult = captchaObj.getValidate()
       // 拿到验证参数之后，调用云函数
       API.User.GetTime({
         cloudVerify:{ sessionId:verifyParams.sessionId, data:geetestResult }
       })
     })
     captchaObj.onError((e: any) => {
       console.log('gt onError', e)
     })
   })
}
TestGeetest(verifyParams.data)
```

3. 客户端将geetest的sdk返回的数据，传入需要验证的云函数。如果客户端的sdk是自动生成的话，则对于需要验证的云函数，可以看到参数类型上有cloudVerify这个键。

```typescript
{
  cloudVerify?:{
    sessionId:string,
    data:{  
      geetest_challenge:string
      geetest_seccode:string
      geetest_validate:string
    }
  }
}
```
后端可单独调用验证接口给其他云函数使用. GetVerifyParams 获取验证参数, 通过 SetVerify 校验前端返回的验证结果
```typescript
// 后端例子
import { GetVerifyParams, SetVerify, CloudParams, Cloud } from 'leancloud-cloud-decorator'
interface RiskVerifyGeetestParams extends CloudParams {
  sessionId:string
  data:{
    geetest_challenge:string
    geetest_seccode:string
    geetest_validate: string
  }
}
class Auth {
    /**
     * 获取验证参数
     */
    @Cloud({
        schema:{}
    })
    async GetVerifyParams() {
        return GetVerifyParams({type:'geetest'})
    }
    /**
     * 验证有效性
     */
    @Cloud<RiskVerifyGeetestParams>({
      schema: {
        sessionId: Joi.string().required(),
        data: Joi.object({
          geetest_challenge: Joi.string().required(),
          geetest_seccode: Joi.string().required(),
          geetest_validate: Joi.string().required(),
        })
      }
    })
    async Verify(params:RiskVerifyGeetestParams) {
        // @ts-ignore
        await SetVerify(Object.assign({type:'geetest'},params))
    }
}
```

4. 对于设置了行为验证限流的云函数，并不是每一次调用都需要设置cloudVerify。客户端可以在正常调用抛出行为验证限流错误的时候，再进行验证。流程如下：
``` ts
// 前端调用例子
try{
    await API.User.GetTime({})
}catch(error){
    // 后端在errorCallback回调中捕获验证错误,返回特定的错误码
    if(error.code == 410){
        API.User.GetTime({
            cloudVerify:{ sessionId:verifyParams.sessionId, data:geetestResult }
        })
    }
}
```

## 自动生成前端SDK
通过项目根目录下的 lcc-config.json 配置文件, 配置需要生成的前端SDK平台。目前暂时不支持配置registry。模块都会发布到npm官方的registry下。如需要私有模块的话，考虑先使用npm的付费版。
```json
{
    "platforms": {
        "web_user": {
            "package": "@namespace/web-user" // 配置web_user平台对应的npm包名称
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
也可手动通过 lcc-config 应用配置.

当lcc-config.json 的设置改变时候,必须手工执行 lcc-config 以应用配置
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
