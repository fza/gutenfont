'use strict';

var Promise = require('promise/lib/es6-extensions');
require('promise/lib/finally');
var constants = require('./constants');

var slice = [].slice;

var utils = exports;

utils.Promise = Promise;

utils.identity = function (val) {
  return function () {
    return val;
  };
};

utils.processUnitOfWork = function (unitOfWork, handlers) {
  return handlers.reduce(function (sequence, handler) {
    return sequence.then(function () { // faster than handler.bind()
      return handler(unitOfWork);
    });
  }, Promise.resolve());
};

utils.iterateSeries = function (src, iterator) {
  var series = Promise.resolve();
  var iteratorArgs = [null, null, src].concat(slice.call(arguments, 2));
  var wrappedIterator;
  var length;

  if (Array.isArray(src)) {
    length = src.length;
    wrappedIterator = function (idx) {
      iteratorArgs[0] = src[idx];
      iteratorArgs[1] = idx;
      return iterator.apply(null, iteratorArgs);
    };
  } else if (typeof src === 'number') {
    if (src <= 0) {
      return Promise.resolve();
    }

    iteratorArgs.shift();
    length = src;
    wrappedIterator = function (idx) {
      iteratorArgs[0] = idx;
      return iterator.apply(null, iteratorArgs);
    };
  }

  for (var i = 0; i < length; ++i) {
    series = series.then(wrappedIterator.bind(null, i));
  }

  return series;
};

utils.iterateParallel = function (src, iterator) {
  var iteratorArgs = [null, null, src].concat(slice.call(arguments, 2));

  return new Promise(function (resolve, reject) {
    var aborted = false;
    var wrappedIterator;
    var length, completed = 0;

    if (Array.isArray(src)) {
      length = src.length;
      wrappedIterator = function (idx) {
        iteratorArgs[0] = src[idx];
        iteratorArgs[1] = idx;
        return iterator.apply(null, iteratorArgs);
      };
    } else if (typeof src === 'number') {
      if (src <= 0) {
        return resolve();
      }

      iteratorArgs.shift();
      length = src;
      wrappedIterator = function (idx) {
        iteratorArgs[0] = idx;
        return iterator.apply(null, iteratorArgs);
      };
    }

    for (var i = 0; i < length; ++i) {
      Promise.resolve()
        .then((function (idx) {
          if (!aborted) {
            return wrappedIterator(idx);
          }
        }).bind(null, i))
        .then(function () {
          if (++completed >= length) {
            resolve();
          }
        }, function (err) {
          aborted = true;
          reject(err);
        });
    }
  });
};

utils.round4 = function (val) {
  var modulo = (val % 4);
  return val + (modulo > 0 ? 4 - modulo : 0);
};

// Works for strings and Number[]-alikes (Uint8Array etc)
utils.removeUTF8BOM = function (src) {
  var isString = typeof src === 'string';
  var UTF8_BOM = constants.BOM_UTF8;
  if (src.length > 2) {
    for (var i = 0; i < 3; ++i) {
      if (
        (isString && src.charCodeAt(i) !== UTF8_BOM[i]) ||
        (!isString && src[i] !== UTF8_BOM[i])
      ) {
        return src;
      }
    }

    return src.slice(3);
  }

  return src;
};

utils.detectFontOutlineType = function (sfntVersion, tablesByTag) {
  var hasCFF = !!tablesByTag[constants.TABLE_TAG_CFF];
  var hasGlyf = !!tablesByTag[constants.TABLE_TAG_GLYF];
  var hasLoca = !!tablesByTag[constants.TABLE_TAG_LOCA];

  if (sfntVersion === constants.FLAVOR_TRUETYPE && hasGlyf && hasLoca) {
    return constants.OUTLINE_TYPE_TRUETYPE;
  } else if (sfntVersion === constants.FLAVOR_POSTSCRIPT && hasCFF) {
    return constants.OUTLINE_TYPE_POSTSCRIPT;
  }

  return null;
};

utils.calcChecksum = function (dataStream) {
  var checksum = 0;
  var peek = dataStream.peek.seek(0).read;
  for (var i = peek.byteLength; i > 0; i -= 4) {
    if (i < 4) {
      for (var j = 0, k = 3; j < i; ++j, --k) {
        checksum += peek.uint8() << (8 * k);
      }
      break;
    }

    checksum += peek.uint32();
  }

  return checksum % 0x100000000;
};

utils.allOrNone = function () {
  var args = slice.call(arguments);
  var argsLength = args.length;

  if (argsLength < 2) {
    return true;
  }

  for (var i = 1, state = !!args[0]; i < argsLength; state = !!args[i], ++i) {
    if (state !== !!args[i]) {
      return false;
    }
  }

  return true;
};

utils.xor = function (a, b) {
  return ((a ? 1 : 0) ^ (b ? 1 : 0));
};

// @see https://jsperf.com/array-unshift-vs-prepend
utils.prepend = function (arr) {
  var args = slice.call(arguments, 1);
  var argsLength = args.length;

  if (!argsLength) {
    return arr;
  }

  var arrLength = arr.length;
  for (var i = 0; i < arrLength; ++i) {
    args.push(arr[i]);
  }

  return args;
};
