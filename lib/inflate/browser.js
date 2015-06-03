'use strict';

var inflate = require('pako/lib/inflate').inflate;
var Promise = require('../utils').Promise;

module.exports = function (byteArray) {
  return Promise.resolve(inflate(byteArray));
};
