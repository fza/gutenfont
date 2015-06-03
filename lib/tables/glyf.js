'use strict';

var inherits = require('inherits');
var AbstractTable = require('../abstract-table');

function GlyfTable() {
  AbstractTable.call(this, 'glyf');
}

inherits(GlyfTable, AbstractTable);

GlyfTable.fromStream = function (dataStream) {

};

var GlyfTableProto = GlyfTable.prototype;

GlyfTableProto.addGlyph = function () {
  console.log('ADD GLYPH TO GLYF TABLE');
};

module.exports = GlyfTable;

