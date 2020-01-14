"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const typescript_1 = __importDefault(require("typescript"));
function GetStringFromTemplateSpan(node) {
    if (typescript_1.default.isPropertyAccessExpression(node.expression)) {
        return node.expression.name.text + node.literal.text;
    }
    console.error('Error StringTemplateSpan ' + node.getText());
    return node.literal.text;
}
function GetStringFromTemplate(node) {
    return node.head.text + node.templateSpans.map(e => GetStringFromTemplateSpan(e));
}
function GetStringFromBinaryExpression(node) {
    return GetString(node.left) + GetString(node.right);
}
function GetString(node) {
    if (typescript_1.default.isBinaryExpression(node)) {
        return GetStringFromBinaryExpression(node);
    }
    else if (typescript_1.default.isTemplateExpression(node)) {
        return GetStringFromTemplate(node);
    }
    else if (typescript_1.default.isStringLiteral(node)) {
        return node.text;
    }
    else if (typescript_1.default.isPropertyAccessExpression(node)) {
        return node.name.getText();
    }
    else {
        console.error('error expression :' + node.getText());
    }
    return '';
}
function GetMsgFromErrorNode(node) {
    let msg = '';
    function scanNode(_node) {
        if (typescript_1.default.isPropertyAssignment(_node) && _node.name.getText() == 'en') {
            msg = GetString(_node);
        }
        else {
            _node.forEachChild(scanNode);
        }
    }
    node.forEachChild(scanNode);
}
//# sourceMappingURL=buildErrorMsgID.js.map