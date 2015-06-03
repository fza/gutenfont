'use strict';

Error.stackTraceLimit = 30;

require('./lib/setup');

var thr = require('format-throw');
var formats = require('./lib/formats');
var srcToDataStream = require('./lib/src-to-datastream');

function detectFormat(src) {
  return srcToDataStream(src).then(function (dataStream) {
    var detectedFormat = formats.detect(dataStream);
    if (detectedFormat) {
      return detectedFormat.name;
    }
  });
}

function decode(src, options) {
  return srcToDataStream(src).then(function (dataStream) {
    return detectFormat(dataStream).then(function (formatName) {
      if (!formatName) {
        thr('Unrecognized source file type');
      }

      return formats[formatName].decode(dataStream, options);
    });
  });
}

function encode(font, destFormat, options) {
  var format = formats[destFormat];

  if (!format) {
    thr('Cannot encode unknown file type %s', format);
  }

  return format.encode(font, options);
}

function convert(src, destFormat, options) {
  return decode(src, options).then(function (font) {
    return encode(font, destFormat, options);
  });
}

module.exports = exports = convert;
exports.decode = decode;
exports.encode = encode;
exports.detectFormat = detectFormat;
exports.convert = convert;
