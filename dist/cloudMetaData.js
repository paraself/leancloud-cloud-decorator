"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function GetTypeData(file, name, data) {
    let out;
    if (data.type == 'union') {
        out = {
            // name: name,
            types: data.types.map(e => GetTypeData(file, undefined, e)),
        };
        if (name) {
            out.name = name;
        }
    }
    else if (data.name == 'Promise' || data.name == 'Bluebird') {
        out = {
            members: [GetTypeData(file, name, data.typeArguments[0])],
            isArray: true
        };
    }
    else if (data.elementType) {
        out = {
            members: [GetTypeData(file, name, data.elementType)],
            isArray: true
        };
    }
    else if (data.type == 'reference' && data.name == 'Array') {
        out = {
            members: [GetTypeData(file, name, data.typeArguments[0])],
            isArray: true
        };
    }
    else if (data.type == 'reference' && data.declaration) {
        out = CreateInterfaceMetaData(file, data.declaration);
        if (out && name) {
            out.name = name;
        }
    }
    else if (data.type == 'stringLiteral' || data.type == 'numberLiteral') {
        out = {
            literal: data.value
        };
    }
    else if (data.id) {
        out = file[data.id];
        if (out && name) {
            out.name = name;
        }
    }
    else {
        out = {
            name: name,
            type: data.name,
        };
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
    return out;
}
function CreateParamsMetaDatas(file, data) {
    if (data) {
        return file[data.type.id];
    }
}
function CreateReturnMetaDatas(file, data) {
    if (data.typeArguments) {
        return GetTypeData(file, 'return', data);
    }
}
function PlatformString(text) {
    let value = GetJsonValueString(text, 'platforms');
    if (!value) {
        return null;
    }
    // for (let i = 0; i < Platform.count; ++i) {
    //   let s = Platform[i]
    //   value = value.replace('Platform.' + s, '"' + s.replace('_', '-') + '"')
    // }
    return value;
}
exports.PlatformString = PlatformString;
function GetJsonValueString(text, key) {
    text = text.replace(/(\/\*([\s\S]*?)\*\/)|(\/\/(.*)$)/gm, ''); //移除注释
    let start = text.indexOf(key);
    if (start < 0)
        return null;
    let braceTokenCount = 0;
    let squareTokenCount = 0;
    let valueStart = text.indexOf(':', start) + 1;
    let index = valueStart;
    let end = text.length;
    while (index <= end) {
        let token = text[index];
        if (token == '[') {
            squareTokenCount += 1;
            // console.log(index + ' [ ' + tokenCount)
        }
        else if (token == ']') {
            squareTokenCount -= 1;
            // console.log(index + ' ] ' + tokenCount)
        }
        if (token == '{') {
            braceTokenCount += 1;
        }
        else if (token == '}') {
            braceTokenCount -= 1;
        }
        if (braceTokenCount == -1) {
            // index -= 1
            break;
        }
        if (token == ',' && braceTokenCount == 0 && squareTokenCount == 0) {
            // index -= 1
            break;
        }
        index += 1;
    }
    let text1 = text.substring(valueStart, index);
    return text1
        .replace(/'/g, '"') //将单引号换成双引号
        .replace(/(['"])?([a-z0-9A-Z_]+)(['"])?:/g, '"$2": '); //给key加双引号
}
exports.GetJsonValueString = GetJsonValueString;
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
function CreateDecoratorMetaData(datas) {
    let data = datas.find(e => e.name == 'Cloud');
    if (data) {
        if (data.arguments.params) {
            let paramsText = data.arguments.params;
            let internalText = GetJsonValueString(paramsText, 'internal');
            let internal = internalText && JSON.parse(internalText);
            if (internal)
                return null;
            let platformsText = PlatformString(paramsText);
            // console.log(paramsText1)
            let platforms = platformsText && JSON.parse(platformsText);
            // console.log(params)
            let paramsText2 = GetJsonValueString(GetJsonValueString(paramsText, 'cache') || '', 'params');
            // console.log(paramsText2)
            let params2 = paramsText2 && JSON.parse(paramsText2);
            return {
                platforms: platforms,
                cache: params2
            };
        }
        return {};
    }
    return null;
}
function CreateMethodMetaData(file, className, data) {
    let signatures = data.signatures[0];
    let config = CreateDecoratorMetaData(data.decorators || []);
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
        value: CreateReturnMetaDatas(file, signatures.type),
        comment: signatures.comment && (signatures.comment.shortText && [signatures.comment.shortText] || [])
            .concat((signatures.comment.tags && (signatures.comment.tags.map(e => e.tag + ': ' + e.text)))
            || []).join('\n'),
        valueComment: signatures.comment && signatures.comment.returns,
    });
}
function CreateClassMetaData(file, data) {
    let result = data.children
        .filter(e => e.kindString == 'Method')
        .map(e => CreateMethodMetaData(file, data.name, e));
    //@ts-ignore
    return result.filter(e => e != null);
}
function CreateIndexSignatureMeta(file, data) {
    let type = data.type;
    return {
        indexSignature: {
            key: data.parameters[0].type.name,
            value: GetTypeData(file, undefined, type)
        }
    };
}
function GetEnumerationMeta(data) {
    return { types: data.children.map(e => { return { literal: e.defaultValue }; }) };
}
function CreateInterfaceMetaData(file, data) {
    if (data.indexSignature) {
        Object.assign(file[data.id], Object.assign({ name: data.name }, CreateIndexSignatureMeta(file, data.indexSignature[0])));
    }
    else if (data.type) {
        Object.assign(file[data.id], GetTypeData(file, undefined, data.type));
    }
    else if (data.kindString === 'Enumeration') {
        Object.assign(file[data.id], GetEnumerationMeta(data));
    }
    else {
        let memberInfos = (data.children || [])
            .filter(e => !e.inheritedFrom);
        let members = memberInfos.map(e => GetTypeData(file, e.name, e.type));
        let memberComments = memberInfos.map(e => e.comment && e.comment.shortText);
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
        });
    }
    return file[data.id];
}
const ExcludeFile = [
    'cloud/base',
    'cloud/cloud',
    'base',
    'cloud'
];
function CreateCloudMetaData(datas) {
    let functionList = [];
    let file = {};
    for (let i = 0; i < datas.length; ++i) {
        let data = datas[i];
        if (data.children && !ExcludeFile.includes(data.name.replace(/"/g, ''))) {
            let allInterface = data.children.filter(e => e.kindString == 'Interface' || e.kindString == 'Type alias' || e.kindString == 'Enumeration');
            allInterface.map(e => file[e.id] = {});
            allInterface.map(e => CreateInterfaceMetaData(file, e));
        }
    }
    for (let i = 0; i < datas.length; ++i) {
        let data = datas[i];
        if (data.children && !ExcludeFile.includes(data.name.replace(/"/g, ''))) {
            let results = data.children
                .filter(e => e.kindString == 'Class')
                .map(e => {
                functionList = functionList.concat(CreateClassMetaData(file, e));
            });
        }
    }
    return functionList;
}
exports.CreateCloudMetaData = CreateCloudMetaData;
//@ts-ignore
// let result = CreateCloudMetaData(doc.children);
// export { result as doc}
//# sourceMappingURL=cloudMetaData.js.map