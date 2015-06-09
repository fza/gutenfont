'use strict';

/**
 * ankr – Anchor point table
 *
 * Supported by: OS X 10.9+, iOS 7+
 *
 * An ankr table will be completely ignored if a GPOS table is present AND the GPOS table already
 * contains anchor points. Decoded anchor points will be incorporated into the Glyph objects anchor
 * points array. GutenFont *never* encodes an ankr table, but stores anchor points as a subtable of
 * the GPOS table.
 *
 * @see https://developer.apple.com/fonts/TrueType-Reference-Manual/RM06/Chap6ankr.html
 */

var thr = require('format-throw');
var inherits = require('inherits');
var AbstractTable = require('./abstract');
var Monster = require('frankenstein');

var int16Type = 'int16';
var uint16Type = 'uint16';
var uint32Type = 'uint32';

var ankrGlyphDataTableAnchorPointStructType = Monster.makeDataType({
  extend: 'struct',
  structSize: 4,
  struct: [
    ['x', int16Type],
    ['y', int16Type]
  ]
});

var ankrGlyphDataTableType = Monster.makeDataType({
  get: function (stream) {
    return stream.array(stream.uint32(), ankrGlyphDataTableAnchorPointStructType);
  }
});

var ankrTableHeaderStructType = Monster.makeDataType({
  extend: 'struct',
  struct: [
    ['version', uint16Type],
    ['flags', uint16Type],
    ['lookupTableOffset', uint32Type],
    ['glyphDataTableOffset', uint32Type]
  ],
  staticData: {
    version: 0,
    flags: 0,
    lookupTableOffset: 12
  }
});

var ankrTableStruct = Monster.makeDataType({
  get: function (stream) {
    var header = stream.get(ankrTableHeaderStructType);
    var lookup = stream.aatLookupTable();
    var glyphData = stream.get(ankrGlyphDataTableType);
  }
});

function AnkrTable(glyphPoints) {
  AbstractTable.call(this, 'ankr');
  this.glyphPoints = glyphPoints;
}

inherits(AnkrTable, AbstractTable);

AnkrTable.depends = ['kerx'];

AnkrTable.decode = function (dataStream) {
  return new AnkrTable(dataStream.get(ankrTableStruct));
};

module.exports = function (GutenFont) {
  GutenFont.registerPlugin('ankrTable', GutenFont.PluginType.TABLE, {
    ankr: AnkrTable
  });
};
