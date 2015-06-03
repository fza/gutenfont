'use strict';

var thr = require('format-throw');
var inherits = require('inherits');
var AbstractTable = require('../abstract-table');
var Monster = require('frankenstein');

var int16Type = 'int16';
var uint16Type = 'uint16';
var uint32Type = 'uint32';

Monster.addDataType('hheaTableStruct', {
  size: null,
  tableSize: 36,
  struct: [
    ['version', uint32Type],
    ['ascender', int16Type],
    ['descender', int16Type],
    ['lineGap', int16Type],
    ['advanceWidthMax', uint16Type],
    ['minLeftSideBearing', int16Type],
    ['minRightSideBearing', int16Type],
    ['xMaxExtent', int16Type],
    ['caretSlopeRise', int16Type],
    ['caretSlopeRun', int16Type],
    ['caretOffset', int16Type],
    [null, 'skip', 8],
    ['metricDataFormat', int16Type],
    ['numberOfHMetrics', uint16Type]
  ]
});

/**
 * Horizontal metrics table
 * @param fields
 * @constructor
 */
function HheaTable(fields) {
  AbstractTable.call(this, 'hhea', fields);
}

inherits(HheaTable, AbstractTable);

HheaTable.prototype.toBytes = function (allTables) {
  var dataStream = new Monster(Monster.types.hheaTableStruct.structSize, {
    extensible: false
  });
  return dataStream.write.hheaTableStruct(this.fields, allTables).toByteArray();
};

HheaTable.fromStream = function (dataStream, tableCollection) {
  return new HheaTable(dataStream.hheaTableStruct());
};

module.exports = HheaTable;
