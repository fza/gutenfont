'use strict';

var constants = require('../../constants');

module.exports = function (dataStream) {
  var signature = dataStream.peek.from(0).uint32();
  return signature === constants.SIGNATURE_WOFF;
};
