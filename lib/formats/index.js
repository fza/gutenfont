'use strict';

var Monster = require('frankenstein');

var formats = [
  {
    name: 'opentype',
    detect: require('./opentype/detect'),
    //decode: require('./opentype/decode'),
    encode: require('./opentype/encode')
  },
  {
    name: 'woff',
    detect: require('./woff/detect'),
    decode: require('./woff/decode')
    //encode: require('./woff/encode')
  },
  {
    name: 'woff2',
    detect: require('./woff2/detect')
    //decode: require('./woff2/decode'),
    //encode: require('./woff2/encode')
  }
];

formats.forEach(function (format) {
  exports[format.name] = format;
});

exports.detect = function (src) {
  var dataStream = new Monster(src);
  var detectedFormat;
  formats.some(function (format) {
    if (format.detect(dataStream.seek(0))) {
      detectedFormat = format;
      return true;
    }
  });

  return detectedFormat;
};
