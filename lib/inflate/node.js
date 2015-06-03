'use strict';

var zlib = require('zlib');
var Promise = require('../utils').Promise;

module.exports = function (byteArray) {
  return new Promise(function (resolve, reject) {
    zlib.inflate(new Buffer(byteArray), function (err, buf) {
      if (err) {
        reject(err);
      } else {
        resolve(new Uint8Array(buf));
      }
    });
  });
};
