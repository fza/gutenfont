'use strict';

/**
 * head – Font header table
 *
 * @see https://developer.apple.com/fonts/TrueType-Reference-Manual/RM06/Chap6head.html
 * @see https://www.microsoft.com/typography/otspec/head.htm
 */

var thr = require('format-throw');
var inherits = require('inherits');
var AbstractTable = require('../abstract-table');
var Monster = require('frankenstein');

var int16Type = 'int16';
var uint16Type = 'uint16';
var uint32Type = 'uint32';
var datetimeType = 'datetime';

var headTableStructType = Monster.makeDataType({
  extend: 'struct',
  structSize: 54,
  struct: [
    ['version', uint32Type],
    ['fontRevision', uint32Type],
    ['checkSumAdjustment', uint32Type],
    ['magicNumber', uint32Type],
    ['flags', uint16Type],
    ['unitsPerEm', uint16Type],
    ['created', datetimeType],
    ['modified', datetimeType],
    ['xMin', int16Type],
    ['yMin', int16Type],
    ['xMax', int16Type],
    ['yMax', int16Type],
    ['macStyle', uint16Type],
    ['lowestRecPPEM', uint16Type],
    ['fontDirectionHint', int16Type],
    ['indexToLocFormat', int16Type],
    ['glyphDataFormat', int16Type]
  ],
  get: function (stream, offset, fields) {
    // Reset checkSumAdjustment field in stream.
    var frozen = stream.frozen;
    stream.unfreeze().peek.from(offset + 8).write.uint32(0);
    if (frozen) {
      stream.freeze();
    }

    return fields;
  },
  set: function (stream, offset, fields, allTables) {
    // TODO Calculate checksumAdjustment for all tables
    fields.checkSumAdjustment = 0;
    stream.struct(fields, this.struct);

    var checkSumAdjustment = 0;
    allTables.forEach(function (table) {
      checkSumAdjustment += table.checksum;
    });
    stream.peek.from(offset).uint32(checkSumAdjustment % 0x100000000);
  },
  validate: function (fields) {
    if (fields.version !== 0x00010000) {
      thr('Unsupported head table version');
    } else if (fields.checkSumAdjustment === 0) {
      thr('Invalid head table encoding');
    } else if ([0, 2].indexOf(fields.indexToLocFormat) === -1) {
      thr('');
    }
  }
});

function HeadTable(fields) {
  AbstractTable.call(this, 'head', fields);
}

inherits(HeadTable, AbstractTable);

HeadTable.prototype.toByteArray = function (allTables) {
  var dataStream = new Monster(headTableStructType.structSize, {
    extensible: false
  });
  return dataStream.set(headTableStructType, this.fields, allTables).toByteArray();
};

HeadTable.fromStream = function (dataStream) {
  return new HeadTable(dataStream.get(headTableStructType));
};

module.exports = HeadTable;
