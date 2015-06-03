'use strict';

var thr = require('format-throw');

/**
 * Simple Bitmap
 * @param {number|Uint8Array} byteArr Either a byteArray (Bitmap starts off with data), or the
 *   number of bits/states the Bitmap should be able to store. In the latter case, the length of
 *   the underlying byte array will be Math.ceil(bitLength / 8) and all bits will be set to zero.
 *   The byteLength property of a Bitmap instance is always a multiple of 8. Note that when
 *   getting/setting/unsetting bits there are no additional checks on whether the Bitmap is large
 *   enough to hold the bit at the given index. Getting a bit at an index beyond the bit size will
 *   always yield zero. Likewise when setting such a bit, information will be lost.
 * @constructor
 */
function Bitmap(byteArr) {
  var byteLength;
  if (typeof byteArr === 'number' && byteArr >= 0) {
    byteLength = Math.ceil(byteArr / 8);
    byteArr = new Uint8Array(byteLength);
  } else if (
    (byteArr instanceof Uint8Array) ||
    Uint8ClampedArray && (byteArr instanceof Uint8ClampedArray)
  ) {
    byteLength = byteArr.byteLength;
  } else {
    thr('byteArray must be a Uint8Array or an integer greater than or equal zero');
  }

  Object.defineProperties(this, {
    byteArray: {
      enumerable: true,
      value: byteArr
    },

    byteLength: {
      enumerable: true,
      value: byteLength
    },

    length: {
      enumerable: true,
      value: byteLength
    },

    bitLength: {
      enumerable: true,
      value: byteLength * 8
    }
  });
}

Bitmap.TO_STRING_MAX_BYTES = 4;

Bitmap.prototype = {
  get: function (idx) {
    return this.byteArray[idx >> 3] & (0x80 >> (idx & 7)) ? 1 : 0;
  },

  set: function (idx) {
    this.byteArray[idx >> 3] |= (0x80 >> (idx & 7));
    return this;
  },

  unset: function (idx) {
    this.byteArray[idx >> 3] &= ~(0x80 >> (idx & 7));
    return this;
  },

  toString: function (byteLength) {
    byteLength = Math.min(
      this.byteLength,
      (byteLength > 0) ? byteLength : Bitmap.TO_STRING_MAX_BYTES
    );

    var str = '', byteStr, byteStrLength;
    for (var i = 0; i < byteLength; ++i) {
      byteStr = this.byteArray[i].toString(2);
      // Don't rely on String.prototype.repeat (ES6 feature)
      byteStrLength = byteStr.length;
      for (var j = 0; j < 8 - byteStrLength; ++j) {
        byteStr = '0' + byteStr;
      }
      str += ' ' + byteStr.substr(0, 4) + ' ' + byteStr.substr(4);
    }

    return '[Bitmap' + str + ']';
  }
};

module.exports = Bitmap;
