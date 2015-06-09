'use strict';

/**
 * AAT binary search table
 * Commonly used as a subtable in a sfnt table object.
 *
 * @see https://developer.apple.com/fonts/TrueType-Reference-Manual/RM06/Chap6Tables.html
 */

var inherits = require('inherits');
var utils = require('../../utils');
var AbstractTable = require('../abstract');
var Monster = require('frankenstein');

var HEADER_SIZE = 10;

var uint16Type = 'uint16';
var aatBinarySearchHeaderStructType = Monster.addDataType('aatBinarySearchHeaderStruct', {
  extend: 'struct',
  structSize: HEADER_SIZE,
  struct: [
    ['unitSize', uint16Type],
    ['nUnits', uint16Type],
    ['searchRange', uint16Type],
    ['entrySelector', uint16Type],
    ['rangeShift', uint16Type]
  ],
  validate: function (fields) {
    // TODO
  }
});

function AATBinarySearchTable(fields) {
  AbstractTable.call(this, fields);
}

inherits(AATBinarySearchTable, AbstractTable);

AATBinarySearchTable.decode = function (dataStream) {
  return new AATBinarySearchTable(dataStream.get(aatBinarySearchHeaderStructType));
};

var AATBinarySearchTableProto = AATBinarySearchTable.prototype;

AATBinarySearchTableProto.getEncodedSize = utils.identity(HEADER_SIZE);

AATBinarySearchTableProto.encode = function (dataStream) {
  dataStream.write.set(aatBinarySearchHeaderStructType, this.fields);
};

module.exports = AATBinarySearchTable;
