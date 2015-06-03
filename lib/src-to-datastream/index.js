'use strict';

var Monster = require('frankenstein');
var srcToArrayBuffer = require('./node');
var Promise = require('../utils').Promise;

module.exports = function (src) {
  if (src instanceof Monster) {
    return Promise.resolve(src);
  }

  return srcToArrayBuffer(src).then(function (arrayBuf) {
    return new Monster(arrayBuf);
  });
};
