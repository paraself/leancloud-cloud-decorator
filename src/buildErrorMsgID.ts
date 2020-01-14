import ts from "typescript"


function GetStringFromTemplateSpan(node:ts.TemplateSpan):string {
    if(ts.isPropertyAccessExpression(node.expression)){
        return node.expression.name.text + node.literal.text
    }
    console.error('Error StringTemplateSpan '+node.getText())
    return node.literal.text
}
function GetStringFromTemplate(node:ts.TemplateExpression):string {
    return node.head.text+node.templateSpans.map(e=>GetStringFromTemplateSpan(e))
}
function GetStringFromBinaryExpression(node:ts.BinaryExpression):string {
    return GetString(node.left) + GetString(node.right)
}
function GetString(node:ts.Node):string {
    if(ts.isBinaryExpression(node)){
        return GetStringFromBinaryExpression(node)
    }else if(ts.isTemplateExpression(node)){
        return GetStringFromTemplate(node)
    }else if(ts.isStringLiteral(node)){
        return node.text
    }else if(ts.isPropertyAccessExpression(node)){
        return node.name.getText()
    } else{
        console.error('error expression :'+node.getText())
    }
    return ''
}

function GetMsgFromErrorNode(node:ts.Node) {
    let msg = ''
    function scanNode(_node: ts.Node) {
        if(ts.isPropertyAssignment(_node)&&_node.name.getText()=='en'){
            msg = GetString(_node)
        }else{
            _node.forEachChild(scanNode)
        }
    }
    node.forEachChild(scanNode)
}