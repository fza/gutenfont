'use strict';

var fs = require('fs');
var thr = require('format-throw');
var utils = require('../utils');
var Promise = utils.Promise;

function fromStream(stream) {
  return new Promise(function (resolve, reject) {
    var buffers = [];
    var removeListeners;

    function onData(buf) {
      buffers.push(buf);
    }

    function onEnd() {
      removeListeners();
      var buf = Buffer.concat(buffers);

      if (!buf.length) {
        return reject(thr.make('No input data'));
      }

      resolve((new Uint8Array(buf)).buffer);
    }

    function onError(err) {
      removeListeners();
      reject(err);
    }

    removeListeners = function () {
      stream.removeListener('data', onData);
      stream.removeListener('end', onEnd);
      stream.removeListener('error', onError);
    };

    stream.on('data', onData);
    stream.once('end', onEnd);
    stream.once('error', onError);
  });
}

module.exports = function (src) {
  return new Promise(function (resolve) {
    if (src instanceof ArrayBuffer) {
      return resolve(src);
    }

    if (src instanceof Buffer) {
      return resolve((new Uint8Array(src)).buffer);
    }

    if (src.read && src.on) {
      return resolve(fromStream(src));
    }

    if (typeof src === 'string') {
      return resolve(fromStream(fs.createReadStream(src)));
    }

    thr('Unrecognized data source');
  });
};
