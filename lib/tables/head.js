'use strict';

var thr = require('format-throw');
var inherits = require('inherits');
var AbstractTable = require('../abstract-table');
var Monster = require('frankenstein');

var int16Type = 'int16';
var uint16Type = 'uint16';
var uint32Type = 'uint32';
var datetimeType = 'datetime';

Monster.addDataType('headTableStruct', {
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
    if (fields.version !== 0x00010000) {
      thr('Unsupported head table version');
    } else if (fields.checkSumAdjustment === 0) {
      thr('Invalid head table encoding');
    }

    // Reset checkSumAdjustment field in stream
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
  }
});

function HeadTable(fields) {
  AbstractTable.call(this, 'head', fields);
}

inherits(HeadTable, AbstractTable);

HeadTable.prototype.toByteArray = function (allTables) {
  var dataStream = new Monster(Monster.types.headTableStruct.structSize, {
    extensible: false
  });
  return dataStream.write.headTableStruct(this.fields, allTables).toByteArray();
};

HeadTable.fromStream = function (dataStream) {
  return new HeadTable(dataStream.headTableStruct());
};

module.exports = HeadTable;
