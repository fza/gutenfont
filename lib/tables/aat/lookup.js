'use strict';

/**
 * AAT lookup table
 * Commonly used as a subtable in a sfnt table object.
 *
 * @see https://developer.apple.com/fonts/TrueType-Reference-Manual/RM06/Chap6Tables.html
 */

var thr = require('format-throw');
var inherits = require('inherits');
var utils = require('../../utils');
var AbstractTable = require('../abstract');
var Monster = require('frankenstein');

function AATLookupTable(values, hints) {
  AbstractTable.call(this, 'aat-lookup');

  hints = hints || {};

  var minIndex = hints.minIndex || 0;
  var maxIndex = hints.maxIndex || 0;
  var minValue = hints.minValue || 0;
  var maxValue = hints.maxValue || 0;
  var length = hints.length || 0;

  // TODO Use Array.isArray()
  if (values.length) {
    minIndex = null;
    var valLength = values.length;
    for (var i = 0, val; i < valLength; ++i) {
      val = values[i];
      // TODO use Number.isNumber()
      if (typeof val === 'number') {
        if (minIndex === null) {
          minIndex = i;
        }
        length++;
        maxIndex = i;
        minValue = Math.min(minValue, val);
        maxValue = Math.max(maxValue, val);
      }
    }
  }

  Object.defineProperties(this, {
    _values: {
      writable: true,
      value: values || []
    },

    _minIndex: {
      writable: true,
      value: minIndex
    },

    _maxIndex: {
      writable: true,
      value: maxIndex
    },

    _minValue: {
      writable: true,
      value: minValue
    },

    _maxValue: {
      writable: true,
      value: maxValue
    },

    _length: {
      writable: true,
      value: length
    }
  });
}

inherits(AATLookupTable, AbstractTable);

AATLookupTable.decode = function (data, font, valueType) {
  var startOffset = data.offset;
  var format = data.uint16();
  var values = {};
  var minIndex = 0;
  var maxIndex = 0;
  var minValue = 0;
  var maxValue = 0;
  var length = 0;
  var i, j, val, firstGlyph, lastGlyph;
  if (format === 0) {
    // Simple array of values
    length = font.numberOfGlyphs;
    maxIndex = length - 1;
    for (i = 0; i < length; ++i) {
      val = values[i] = data.get(valueType);
      minValue = Math.min(minValue, val);
      maxValue = Math.max(maxValue, val);
    }
  } else if (format === 8) {
    // Trimmed array. Like a segmented lookup table with only one segment
    firstGlyph = minIndex = data.uint16();
    length = data.uint16();
    maxIndex = lastGlyph = length + firstGlyph;
    for (i = firstGlyph; i < lastGlyph; ++i) {
      val = values[i] = data.get(valueType);
      minValue = Math.min(minValue, val);
      maxValue = Math.max(maxValue, val);
    }
  } else if (format === 2 || format === 4 || format === 6) {
    // Segmented lookup table
    var binSearchHeader = data.aatBinarySearchHeaderStruct();
    if (binSearchHeader.unitSize !== 4 + Monster.sizeof(valueType)) {
      thr('Invalid AAT binary search table');
    }

    var segmentsLength = binSearchHeader.nUnits;
    if (format === 2) {
      // Format 2 lookup table. One value for all indexes in a segment
      for (i = 0; i < segmentsLength; ++i) {
        lastGlyph = data.uint16();
        firstGlyph = data.uint16();
        minIndex = i === 0 ? firstGlyph : minIndex;
        maxIndex = lastGlyph;
        val = data.get(valueType);
        minValue = Math.min(minValue, val);
        maxValue = Math.max(maxValue, val);
        length += lastGlyph - firstGlyph;
        for (j = firstGlyph; j <= lastGlyph; ++i) {
          values[j] = val;
        }
      }
    } else if (format === 4) {
      // Format 4 lookup table. Like format 2, but with values stored at explicit offsets
      var peek = data.peek;
      var endOffset = peek.offset;
      for (i = 0; i < segmentsLength; ++i) {
        lastGlyph = data.uint16();
        firstGlyph = data.uint16();
        val = peek.from(startOffset + data.uint16()).get(valueType);
        endOffset = Math.max(endOffset, peek.offset, data.offset);
        minValue = Math.min(minValue, val);
        maxValue = Math.max(maxValue, val);
        length += lastGlyph - firstGlyph;
        for (j = firstGlyph; j <= lastGlyph; ++j) {
          values[j] = val;
        }
      }
      data.seek(endOffset);
    } else {
      // Format 6 lookup table with values stored as [index, value] structs, one glyph per segment
      length = segmentsLength;
      var glyphIndex;
      for (i = 0; i < segmentsLength; ++i) {
        glyphIndex = data.uint16();
        minIndex = i === 0 ? glyphIndex : Math.min(glyphIndex, minIndex);
        maxIndex = Math.max(maxIndex, glyphIndex);
        val = values[glyphIndex] = data.get(valueType);
        minValue = Math.min(minValue, val);
        maxValue = Math.max(maxValue, val);
      }
    }
  } else {
    thr('Unsupported AAT lookup table format');
  }

  return new AATLookupTable(values, {
    minIndex: minIndex,
    maxIndex: maxIndex,
    minValue: minValue,
    maxValue: maxValue,
    length: length
  });
};

var AATLookupTableProto = AATLookupTable.prototype;

AATLookupTableProto.get = function (idx) {
  return this._values[idx];
};

AATLookupTableProto.set = function (idx, val) {
  this._minIndex = !this._length ? idx : Math.min(this._minIndex, idx);
  this._maxIndex = Math.max(this._maxIndex, idx);
  this._minValue = Math.min(this._minValue, val);
  this._maxValue = Math.max(this._minValue, val);
  this._length += this._values[idx] === undefined ? 1 : 0;
  return this._values[idx] = val;
};

AATLookupTableProto.getEncodedSize = utils.nullIdentity;

AATLookupTableProto.encode = function () {
  // 1. Determine the best format to store the values in this array and calculate the size in bytes
  // 1a. Loop over the the whole value array, starting with minIndex, ending with maxIndex
  // 1aa. Detect segments (series of contiguous indexes)
  // 1ab. Break the loop when we have more than 40 segments
  // 1b. When there is only on segment:
  // 1ba. When minIndex is 0, use "simple array" strategy
  // 1bb. Otherwise use "trimmed array" strategy
  // 1c. When there are multiple segments:
  // 1ca. Determine the variability of all values
  // 1cb. When we have <= 40 segments
  // 1cba. TODO
  // 1cc. When we have > 40 segments
  // 1cca. TODO
  // 2. Make a data stream
  // 3. Write header
  // 4. Encode according to format
  // 5. Return data stream
};

Monster.addDataType('aatLookupTable', {
  get: function (stream) {
    return AATLookupTable.decode(stream);
  },
  set: function (stream, offset, lookupTable) {
    stream.stream(lookupTable.encode());
  }
});

module.exports = AATLookupTable;
