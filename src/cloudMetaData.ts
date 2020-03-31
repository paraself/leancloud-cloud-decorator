import { string } from "joi";

// import doc = require('../doc/type.json')

export type DataType = 'number' | 'string' | 'boolean' | 'null' | 'undefined'

export interface IMetaDataParams {
  /**
   * 参数名称，例如 GetPracParams
   */
  name?: string
  /**
   * 参数说明
   */
  comment?: string
  /**
   * 如果该参数是基本类型之一，返回基本类型
   */
  type?: DataType
  /**
   * literal类型
   */
  literal?: string | number
  /**
   * 如果该参数为联合类型,返回类型数组
   */
  types?: IMetaDataParams[]
  /**
   * 参数是否是数组
   */
  isArray?: boolean
  /**
   * 参数是否是索引对象
   */
  indexSignature?: {
    key: 'string' | 'number'
    value: IMetaDataParams
  }
  /**
   * 成员说明
   */
  memberComments?: string[]
  /**
   * 如果参数是一个对象，则返回其成员
   */
  members?: IMetaDataParams[]
}

export interface IMetaData {
  /**
   * 云函数模块名称
   */
  class:string
  /**
   * 云函数名称
   */
  name: string
  /**
   * 云函数说明
   */
  comment?: string
  /**
   * 返回值说明
   */
  valueComment?: string
  /**
   * 参数描述
   */
  params?: IMetaDataParams
  /**
   * 返回值类型
   */
  value?: IMetaDataParams
  /**
   * 如果是一个可以被缓存的接口，则返回可缓存的key的组合
   */
  cache?: Array<Array<string>>
  /**
   * 该云函数在哪个平台上可用
   */
  platforms?: Array<'weapp' | 'web-user' | 'web-admin' | 'ios' | 'android'>
}

interface Decorator {
  name: string,
  type: {
    type: string,
    name: string,
    id: number,
  }
  arguments: {
    params?: string
  }
}

interface TypedocData {
  id: number,
  name: string,
  kind: number,
  kindString: string,
  flags: { [key: string]: boolean },
  originalName: string,
  children: TypedocData[],
  decorators?: Decorator[],
  comment?: Comment,
  indexSignature?: IndexSignature[]
  defaultValue?:string
}
interface TypeData {
  type: string
  value: string|number
  types: TypeData[]
  name: string
  id?: number
  elementType?: TypeData
  typeArguments: TypeData[]
  declaration?:TypedocData
}
interface ArrayTypeData {
  type: 'array'
  elementType: TypeData
}
interface CommentTag{
  tag:'deprecated',
  text:string,
}
interface Comment {
  shortText?: string
  returns?: string
  tags?:CommentTag[]
}
interface Signature extends TypedocData {
  kindString: 'Call signature'
  type: TypeData
  parameters: ParameterData[]
}

interface IndexSignature extends TypedocData{
  kindString: "Index signature",
  type: TypeData
  parameters: ParameterData[]
}

interface MethodData extends TypedocData {
  kindString: 'Method'
  signatures: Signature[]
}
interface ClassData extends TypedocData {
  kindString: 'Class'
}
interface InterfaceData extends TypedocData {
  kindString: 'Interface'
}
interface PropertyData extends TypedocData {
  kindString: 'Property',
  type: TypeData,
  inheritedFrom: TypeData,
}

interface ParameterData extends TypedocData {
  kindString: 'Parameter'
  type: TypeData
}

interface EnumerationData extends TypedocData {
  kindString: 'Enumeration'
}

interface TypeAliasData extends TypedocData {
  kindString: 'Type alias'
  type?:TypeData
}

function GetTypeData(file: { [key: number]: IMetaDataParams }, name: string|undefined, data: TypeData): IMetaDataParams {
  let out: IMetaDataParams
  if (data.type == 'union') {
    out = {
      // name: name,
      types: data.types.map(e => GetTypeData(file, undefined, e)),
      // comment: comment && comment.shortText,
    }
    if (name) {
      out.name = name
    }
  }
  else if (data.name == 'Promise' || data.name == 'Bluebird') {
    out = {
      members: [GetTypeData(file, name, data.typeArguments[0])],
      isArray: true
    } 
  }
  else if (data.elementType) {
    out = {
      members: [GetTypeData(file, name, data.elementType)],
      isArray:true
    } 
  }
  else if (data.type == 'reference' && data.name == 'Array') {
    out = {
      members: [GetTypeData(file, name, data.typeArguments![0])],
      isArray: true
    } 
  }
  else if (data.type == 'reflection' && data.declaration) {
    out = CreateInterfaceMetaData(file,data.declaration as InterfaceData&EnumerationData&TypeAliasData)
    if (out && name) {
      out.name = name
    }
  }
  else if (data.type == 'stringLiteral' || data.type == 'numberLiteral') {
    out = {
      literal: data.value
    }
  }
  else if (data.id) {
    out = file[data.id!]
    if (out && name) {
      out.name = name
    }
  }
  else {
    out = {
      name: name,
      type: data.name as DataType,
    }
  }
  // if (comment) {
  //   if (comment.shortText == "旧版的关键词选项（key choices）") {
  //     console.log(out)
  //     console.log(data)
  //     console.log(file[data.id!])
  //   }
  //   return Object.assign({
  //     comment: comment.shortText,
  //   }, out)
  // }
  return out
}

function CreateParamsMetaDatas(file: { [key: number]: IMetaDataParams }, data: ParameterData): IMetaDataParams | undefined {
  if (data) {
    return file[data.type.id!]
  }
}
function CreateReturnMetaDatas(file: { [key: number]: IMetaDataParams }, data: TypeData): IMetaDataParams | undefined {
  if (data.typeArguments) {
    return GetTypeData(file, 'return', data)
  }
}

export function PlatformString(text: string) :string|null {
  let value = GetJsonValueString(text, 'platforms')
  if (!value) {
    return null
  }
  // for (let i = 0; i < Platform.count; ++i) {
  //   let s = Platform[i]
  //   value = value.replace('Platform.' + s, '"' + s.replace('_', '-') + '"')
  // }
  return value
}
export function GetJsonValueString(text: string, key: string) {
  text = text.replace(/(\/\*([\s\S]*?)\*\/)|(\/\/(.*)$)/gm, '');//移除注释
  let start = text.indexOf(key)
  if (start < 0) return null

  let braceTokenCount = 0
  let squareTokenCount = 0
  let valueStart = text.indexOf(':', start) + 1
  let index = valueStart
  let end = text.length
  while (index <= end) {
    let token = text[index]
    if (token == '[') {
      squareTokenCount += 1
      // console.log(index + ' [ ' + tokenCount)
    } else if (token == ']') {
      squareTokenCount -= 1
      // console.log(index + ' ] ' + tokenCount)
    }
    if (token == '{') {
      braceTokenCount += 1
    } else if (token == '}') {
      braceTokenCount -= 1
    }
    if (braceTokenCount == -1) {
      // index -= 1
      break
    }
    if (token == ',' && braceTokenCount == 0 && squareTokenCount == 0) {
      // index -= 1
      break
    }
    index+=1
  }
  let text1 = text.substring(valueStart, index)
  return text1
    .replace(/'/g, '"')//将单引号换成双引号
    .replace(/(['"])?([a-z0-9A-Z_]+)(['"])?:/g, '"$2": ') //给key加双引号
}
// export function JsonString(text: string,key:string) {
//   text = text.replace(/(\/\*([\s\S]*?)\*\/)|(\/\/(.*)$)/gm, '');//移除注释
//   let start = text.indexOf(key)
//   if (start < 0) return '{}'
//   let end = text.indexOf(']', start)
//   // let count1 = text1.match(/\[/g) || [].length
//   let tokenCount = 0
//   let index = start
//   while (index <= end || tokenCount != 0) {
//     if (text[index] == '[') {
//       tokenCount += 1
//       // console.log(index + ' [ ' + tokenCount)
//     } else if (text[index] == ']') {
//       tokenCount -= 1
//       // console.log(index + ' ] ' + tokenCount)
//     }
//     index += 1
//   }
//   let text1 = text.substring(start, index)
//   // console.log(start + ' ' + index)
//   // console.log("text "+text)
//   // console.log("text1 " +text1)
//   text = '{' + text1 + '}'
//   for (let i = 0; i < Platform.count; ++i) {
//     let s = Platform[i]
//     text = text.replace('Platform.' + s, '"' + s.replace('_', '-') + '"')
//   }
//   return text
//     .replace(/'/g, '"')//将单引号换成双引号
//     .replace(/(['"])?([a-z0-9A-Z_]+)(['"])?:/g, '"$2": ') //给key加双引号
// }
function CreateDecoratorMetaData(datas: Decorator[]): {
  cache?: Array<Array<string>>
  platforms?: Array<'weapp' | 'web-user' | 'web-admin' | 'ios' | 'android'>
}|null {
  let data = datas.find(e => e.name == 'Cloud')
  if (data) {
    if (data.arguments.params) {
      let paramsText = data.arguments.params

      let internalText = GetJsonValueString(paramsText, 'internal')
      let internal = internalText && JSON.parse(internalText)
      if(internal) return null

      let platformsText = PlatformString(paramsText)
      // console.log(paramsText1)
      let platforms = platformsText && JSON.parse(platformsText)
      // console.log(params)
      let paramsText2 = GetJsonValueString(GetJsonValueString(paramsText, 'cache')||'', 'params')
      // console.log(paramsText2)
      let params2 = paramsText2 && JSON.parse(paramsText2)
      return {
        platforms: platforms,
        cache: params2
      }
    }
    return {}
  }
  return null
}
function CreateMethodMetaData(file: { [key: number]: IMetaDataParams }, className: string, data: MethodData): IMetaData|null {
  let signatures = data.signatures[0]
  let config = CreateDecoratorMetaData(data.decorators || [])
  return config && Object.assign(config, {
    name: data.name,
    class: className,
    /**
     * 参数描述
     */
    params: signatures.parameters && CreateParamsMetaDatas(file, signatures.parameters[0]),
    /**
     * 返回值类型
     */
    value: CreateReturnMetaDatas(file, signatures.type),//,
    comment: signatures.comment && (signatures.comment.shortText && [signatures.comment.shortText] ||[])
      .concat(
        (signatures.comment.tags && (signatures.comment.tags.map(e=>e.tag+': '+e.text)))
        ||[]).join('\n'),
    valueComment: signatures.comment && signatures.comment.returns,
    //   /**
    //    * 如果是一个可以被缓存的接口，则返回可缓存的key的组合
    //    */
    //   cache: Array<Array<string>>
    //   /**
    //    * 该云函数在哪个平台上可用
    //    */
    //   platforms: Array<'weapp' | 'web-user' | 'web-admin' | 'ios' | 'android'>
  })
}

function CreateClassMetaData(file: { [key: number]: IMetaDataParams }, data: ClassData): IMetaData[] {
  let result =  data.children
    .filter(e => e.kindString == 'Method')
    .map(e => CreateMethodMetaData(file, data.name, e as MethodData))
  //@ts-ignore
  return result.filter(e=> e!=null)
}

function CreateIndexSignatureMeta(file: { [key: number]: IMetaDataParams }, data: IndexSignature):IMetaDataParams {
  let type = data.type
  return {
    indexSignature: {
      key: data.parameters[0].type.name as 'string'|'number',
      value: GetTypeData(file, undefined, type)
    }
  }
}

function GetEnumerationMeta(data: EnumerationData) {
  return { types: data.children.map(e => { return { literal: e.defaultValue } }) };
}

function CreateInterfaceMetaData(file: { [key: number]: IMetaDataParams }, data: InterfaceData&EnumerationData&TypeAliasData) {
  if(!file[data.id]){
    file[data.id] = {}
  }
  if (data.indexSignature) {
    Object.assign(file[data.id], Object.assign({ name: data.name }, CreateIndexSignatureMeta(file, data.indexSignature[0])))
  } else if (data.type) {
    Object.assign(file[data.id], GetTypeData(file, undefined, data.type))
  } else if (data.kindString === 'Enumeration') {
    Object.assign(file[data.id], GetEnumerationMeta(data))
   } else {
    let memberInfos = (data.children||[])
      .filter(e => !(e as PropertyData).inheritedFrom)
    let members = memberInfos.map(e =>
      GetTypeData(file, e.name, (e as PropertyData).type)
    )
    let memberComments = memberInfos.map(e => e.comment && e.comment.shortText)
    Object.assign(file[data.id], {
      comment: data.comment && data.comment.shortText,
      /**
       * 参数名称，例如 GetPracParams
       */
      name: data.name,
      /**
       * 如果该参数是基本类型之一，返回基本类型
       */
      // type?: 'number' | 'string' | 'boolean' | 'null' | 'undefined'
      /**
       * 参数是否是数组
       */
      // isArray?: boolean
      /**
       * 如果参数是一个对象，则返回其成员
       */
      members,
      memberComments
    })
  }
  return file[data.id]
}
const ExcludeFile = [
  'cloud/base',
  'cloud/cloud',
  'base',
  'cloud'
]
export function CreateCloudMetaData(datas: TypedocData[]): IMetaData[] {
  let functionList: IMetaData[] = []
  let file: { [key: number]: IMetaDataParams } = {};
  for (let i = 0; i < datas.length; ++i) {
    let data = datas[i]
    if (data.children && !ExcludeFile.includes(data.name.replace(/"/g, ''))) {
      let allInterface = data.children.filter(e => e.kindString == 'Interface' || e.kindString=='Type alias' || e.kindString=='Enumeration')
      allInterface.map(e => file[e.id] = {})
      allInterface.map(e => CreateInterfaceMetaData(file, e as (InterfaceData&EnumerationData&TypeAliasData) ))
    }
  }
  for (let i = 0; i < datas.length; ++i) {
    let data = datas[i]
    if (data.children && !ExcludeFile.includes(data.name.replace(/"/g, ''))) {
      let results = data.children
        .filter(e => e.kindString == 'Class')
        .map(e => {
          functionList = functionList.concat(CreateClassMetaData(file, e as ClassData))
        })
    }
  }
  return functionList
}

//@ts-ignore
// let result = CreateCloudMetaData(doc.children);
// export { result as doc}