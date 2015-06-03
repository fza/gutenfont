'use strict';

var thr = require('format-throw');
var Bitmap = require('./bitmap');
var Monster = require('frankenstein');

// These are all big endian!
var extraTypes = {
  uint24: {
    size: 3,
    get: function (stream, offset) {
      var bytes = stream.bytes;
      return (bytes[offset++] << 16) + (bytes[offset++] << 8) + bytes[offset];
    },
    set: function (stream, offset, val) {
      var bytes = stream.bytes;
      bytes[offset++] = (val >> 16) & 0xff;
      bytes[offset++] = (val >> 8) & 0xff;
      bytes[offset] = val & 0xff;
    }
  },

  fixed: {
    size: 4,
    get: function (stream, offset) {
      return stream.view.getInt32(offset) / 65536;
    },
    set: function (stream, offset, val) {
      stream.view.setInt32(offset, val * 65536);
    }
  },

  f2dot14: {
    size: 2,
    get: function (stream, offset) {
      var val = stream.view.getInt16(offset);
      return (val >> 14) + (val & 0x3fff) / 16384;
    },
    set: function (stream, offset, val) {
      var exp = Math.floor(val);
      stream.view.setInt16(offset, (exp << 14) | ((val - exp) * 16384));
    }
  },

  uintBase128: {
    get: function (stream, offset) {
      var val = 0, byteVal = 0;
      for (var i = 0; i < 5; ++i) {
        byteVal = stream.uint8();

        if ((val === 0 && byteVal === 0x80) || val & 0xfe000000) {
          thr('Invalid data encoding');
        }

        val = (val * 128) | (byteVal & 0x7f);

        if ((byteVal & 0x80) === 0) {
          return val;
        }
      }

      thr('Invalid data encoding');
    },
    set: function (stream, offset, val) {
      val = Math.abs(val | 0); // In JS, any bitwise operator converts the operand to 32 bit.
      var byteVal;
      while (val) {
        byteVal = val & 0x7f;
        val >>= 7;
        stream.uint8(byteVal | (val ? 0x80 : 0));
      }
    }
  },

  b255Uint8: {
    get: function (stream, offset) {
      var byteVal = stream.uint8();
      if (byteVal < 253) {
        return byteVal;
      } else if (byteVal === 253) {
        return stream.uint16();
      } else if (byteVal === 254) {
        return stream.uint8() + 506;
      }

      return stream.uint8() + 253;
    },
    set: function (stream, offset, val) {
      if (val < 253) {
        stream.uint8(val);
      } else if (val < 506) {
        stream.uint8(255);
        stream.uint8(val - 253);
      } else if (val < 762) {
        stream.uint8(254);
        stream.uint8(val - 506);
      } else {
        stream.uint8(253);
        stream.uint16(val);
      }
    }
  },

  tag: {
    get: function (stream, offset) {
      return stream.string(4);
    },
    set: function (stream, offset, tag) {
      stream.string(tag.substr(0, 4));
    }
  },

  datetime: {
    get: function (stream, offset) {
      return stream.uint32(), stream.uint32();
    },
    set: function (stream, offset, val) {
      stream.uint32(0);
      stream.uint32(val);
    }
  },

  bitmap: {
    get: function (stream, offset, byteLength) {
      return new Bitmap(stream.byteArray(byteLength));
    },
    set: function (stream, offset, bitmap) {
      stream.byteArray(bitmap.byteArray);
    }
  }
};

Object.keys(extraTypes).forEach(function (name) {
  Monster.addDataType(name, extraTypes[name]);
});
