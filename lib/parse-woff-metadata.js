'use strict';

var thr = require('format-throw');
var DOMParser = require('xmldom').DOMParser;

var hasOwnProperty = {}.hasOwnProperty;

var errorCb = function (level, msg) {
  thr('Error parsing metadata: %s', msg ? msg : 'Unknown error');
};
var errorHandlers = {
  warning: function () {},
  error: errorCb,
  fatalError: errorCb
};

function invalidDocument(msg) {
  thr('Invalid metadata XML document%s', msg ? ': ' + msg : '');
}

function invalidNode(node, msg) {
  invalidDocument('Invalid <' + node.tagName + '> element' + (msg ? ' (' + msg + ')' : ''));
}

function forEachChildNode(node, iterator) {
  var childNodes = node.childNodes;
  var childNodeLength = childNodes.length;
  for (var i = 0; i < childNodeLength; ++i) {
    iterator(childNodes[i], i, childNodes, node);
  }
}

function forEachAttribute(node, iterator) {
  var attributes = node.attributes;
  var attributesLength = attributes.length;
  for (var i = 0; i < attributesLength; ++i) {
    iterator(attributes[i].name, attributes[i].value, i, attributes, node);
  }
}

function findAttributes(node, attribNames) {
  attribNames = (attribNames || []).concat(['xml:lang', 'lang']);

  var attributes = {};
  forEachAttribute(node, function (name, value) {
    if (attribNames.indexOf(name) === -1) {
      invalidNode(node, 'Unknown attribute "' + name + '"');
    } else if (!hasOwnProperty.call(attributes, name)) {
      attributes[name] = value;
    }
  });

  if (attributes.dir && ['ltr', 'rtl'].indexOf(attributes.dir) === -1) {
    invalidNode(node, 'Invalid "dir" attribute value');
  }

  return attributes;
}

function requireAttributes(node, attributes, requiredAttribNames) {
  requiredAttribNames.forEach(function (name) {
    if (!hasOwnProperty.call(attributes, name)) {
      invalidNode(node, 'Missing "' + name + '" attribute');
    }
  });
}

function elementWithAttributes(node, attributes) {
  var obj = findAttributes(node, attributes);
  obj.tagName = node.tagName;

  return obj;
}

function extractText(node) {
  return ('' + node).replace(/(^\s*|\s*$)/g, '');
}

function isDataNode(node) {
  return node.constructor.name === 'Text';
}

function isEmptyDataNode(dataNode) {
  return ('' + dataNode).replace(/\s*/g, '') === '';
}

function isSkippable(node) {
  if (isDataNode(node)) {
    if (!isEmptyDataNode(node)) {
      invalidDocument('Found invalid data');
    }

    return true;
  }

  return false;
}

function assertEmptyNode(node) {
  if (node.childNodes.length) {
    invalidNode(node, 'Node has child elements');
  }
}

function parseDivSpanNodes(node) {
  var isDiv = node.tagName === 'div';
  var isSpan = node.tagName === 'span';

  if (!isDiv && !isSpan) {
    invalidNode(node);
  }

  var element = findAttributes(node, ['dir', 'class']);
  element.tagName = node.tagName;
  element.children = [];

  forEachChildNode(node, function (childNode) {
    if (isDataNode(childNode)) {
      if (!isEmptyDataNode(childNode)) {
        element.children.push(extractText(childNode));
      }

      return;
    } else if (isSpan && childNode.tagName === 'div') {
      invalidNode(childNode, 'Found invalid <div> node');
    }

    element.children.push(parseDivSpanNodes(childNode));
  });

  return element;
}

function parseTextNodes(node, maybeEmpty) {
  var textElements = [];
  forEachChildNode(node, function (childNode) {
    if (isSkippable(childNode)) {
      return;
    }

    if (childNode.tagName !== 'text') {
      invalidNode(childNode);
    }

    var textElement = findAttributes(childNode, ['dir', 'class']);
    textElement.tagName = 'text';
    textElement.children = [];
    forEachChildNode(childNode, function (textChildNode) {
      if (isDataNode(textChildNode)) {
        if (!isEmptyDataNode(textChildNode)) {
          textElement.children.push(extractText(textChildNode));
        }
      } else {
        textElement.children.push(parseDivSpanNodes(textChildNode));
      }
    });
    textElements.push(textElement);
  });

  if (!maybeEmpty && textElements.length === 0) {
    invalidDocument('<' + node.tagName + '> element does not contain text');
  }

  return textElements;
}

function parseNameValueNode(node) {
  var nameValue = findAttributes(node, ['dir', 'class']);
  nameValue.children = [];

  forEachChildNode(node, function (childNode) {
    if (isDataNode(childNode)) {
      if (!isEmptyDataNode(childNode)) {
        nameValue.children.push(extractText(childNode));
      }

      return;
    }

    invalidNode(childNode);
  });

  if (!nameValue.children.length) {
    invalidNode(node, 'Invalid empty node');
  }

  return nameValue;
}

function parseItemNode(node) {
  var item = findAttributes(node, ['id']);
  item.names = [];
  item.values = [];

  forEachChildNode(node, function (childNode) {
    if (isSkippable(childNode)) {
      return;
    }

    var isName = childNode.tagName === 'name';
    var isValue = childNode.tagName === 'value';

    if (!isName && !isValue) {
      invalidNode(childNode);
    }

    if (isName) {
      item.names.push(parseNameValueNode(childNode));
    } else {
      item.values.push(parseNameValueNode(childNode));
    }
  });

  if (!item.names.length || !item.values.length) {
    invalidNode(node, '<item> node without <name> and <value> nodes');
  }

  return item;
}

function parseExtensionNode(node) {
  var extension = elementWithAttributes(node, ['id']);
  extension.names = [];
  extension.items = [];

  forEachChildNode(node, function (childNode) {
    if (isSkippable(childNode)) {
      return;
    }

    var isName = childNode.tagName === 'name';
    var isItem = childNode.tagName === 'item';

    if (!isName && !isItem) {
      invalidNode(childNode);
    }

    if (isName) {
      extension.names.push(parseNameValueNode(childNode));
    } else {
      extension.items.push(parseItemNode(childNode));
    }
  });

  if (!extension.items.length) {
    invalidNode(node, 'Found <extension> node without any <item> node');
  }

  return extension;
}

module.exports = function (xmlStr) {
  var doc = (new DOMParser({
    errorHandler: errorHandlers
  })).parseFromString(xmlStr, 'application/xml');

  var rootNode;
  if (!doc.documentElement || doc.documentElement.nextSibling) {
    forEachChildNode(doc, function (node) {
      if (node.tagName === 'metadata') {
        if (node) {
          invalidDocument('The <metadata> element is not unique');
        }

        rootNode = node;
      }

      isSkippable(node);
    });
  } else {
    rootNode = doc.documentElement;
  }

  if (rootNode.tagName !== 'metadata' || findAttributes(rootNode, ['version']).version !== '1.0') {
    invalidDocument();
  }

  var result = {};
  var obj, text;
  forEachChildNode(rootNode, function (node) {
    if (isSkippable(node)) {
      return;
    }

    var tagName = node.tagName;

    if (tagName === 'extension') {
      result.extension = (result.extension || []);
      result.extension.push(parseExtensionNode(node));
      return;
    }

    // All following elements are unique
    if (hasOwnProperty.call(result, tagName)) {
      invalidDocument('Found more than one <' + tagName + '> element');
    }

    switch (tagName) {
      case 'uniqueid':
        assertEmptyNode(node);
        obj = elementWithAttributes(node, ['id']);
        requireAttributes(node, obj, ['id']);
        result[tagName] = obj;
        break;

      case 'vendor':
        assertEmptyNode(node);
        obj = elementWithAttributes(node, ['name', 'url', 'dir', 'class']);
        requireAttributes(node, obj, ['name']);
        result[tagName] = obj;
        break;

      case 'credits':
        result[tagName] = elementWithAttributes(node);
        result[tagName].children = [];
        forEachChildNode(node, function (childNode) {
          if (childNode.tagName === 'credit') {
            assertEmptyNode(childNode);
            var creditObj = elementWithAttributes(childNode, ['name', 'url', 'role', 'dir', 'class']);
            requireAttributes(childNode, creditObj, ['name']);
            result[tagName].children.push(creditObj);
          } else if (!isDataNode(childNode) || !isEmptyDataNode(childNode)) {
            invalidNode(childNode);
          }
        });
        if (!result[tagName].children.length) {
          invalidNode(node, 'Empty element');
        }
        break;

      case 'description':
        result[tagName] = elementWithAttributes(node, ['url']);
        result[tagName].children = parseTextNodes(node);
        break;

      case 'license':
        result[tagName] = elementWithAttributes(node, ['url', 'id']);
        text = parseTextNodes(node, true);
        if (text) {
          result[tagName].children = text;
        }
        break;

      case 'copyright':
      case 'trademark':
        result[tagName] = elementWithAttributes(node);
        result[tagName].children = parseTextNodes(node);
        break;

      case 'licensee':
        obj = elementWithAttributes(node, ['name', 'dir', 'class']);
        requireAttributes(node, obj, ['name']);
        result[tagName] = obj;
        result[tagName].children = parseTextNodes(node, true);
        break;

      default:
        invalidNode(node);
    }
  });

  return result;
};
