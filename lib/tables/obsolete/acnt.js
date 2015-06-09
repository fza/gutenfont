'use strict';

/**
 * acnt – Accent attachment table
 *
 * @see https://developer.apple.com/fonts/TrueType-Reference-Manual/RM06/Chap6acnt.html
 */

var thr = require('format-throw');
var inherits = require('inherits');
var AbstractTable = require('../../abstract-table');
var Monster = require('frankenstein');

var int16Type = 'int16';
var uint16Type = 'uint16';
var uint32Type = 'uint32';

Monster.addDataType('acntTableStruct', {
  size: null,
  tableSize: 4,
  struct: [
    ['version', uint32Type]
  ]
});

function AcntTable(fields) {
  AbstractTable.call(this, 'acnt', fields);
}

inherits(AcntTable, AbstractTable);

var AcntTableProto = AcntTable.prototype;

AcntTableProto.toByteArray = function () {
  var dataStream = new Monster(Monster.types.acntTableStruct.structSize, {
    extensible: false
  });
  return dataStream.write.acntTableStruct(this.fields).toByteArray();
};

AcntTable.fromStream = function (dataStream, tableCollection) {
  return new AcntTable(dataStream.acntTableStruct());
};

module.exports = AcntTable;
