'use strict';

/**
 * AAT state table
 *
 * @see https://developer.apple.com/fonts/TrueType-Reference-Manual/RM06/Chap6Tables.html
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

function AATLookupTable() {

}

AATLookupTable.fromStream = function (dataStream) {

};

module.exports = AATLookupTable;
