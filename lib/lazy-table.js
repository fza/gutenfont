'use strict';

var thr = require('format-throw');
var utils = require('./utils');
var Monster = require('frankenstein');
var tableFactory = require('./table-factory');

/**
 * A LazyTable is decoded only when accessed
 * @param {string} tag
 * @param {Monster|Uint8Array} sourceData
 * @param {object} [sourceMeta]
 * @constructor
 */
function LazyTable(tag, sourceData, sourceMeta) {
  Object.defineProperties(this, {
    tag: {
      enumerable: true,
      value: tag
    },

    sourceMeta: {
      enumerable: true,
      value: sourceMeta
    },

    _stream: {
      writable: true,
      value: new Monster(sourceData)
    },

    _checksum: {
      writable: true,
      value: null
    },

    _table: {
      writable: true,
      value: null
    }
  });
}

var LazyTableProto = LazyTable.prototype;

Object.defineProperties(LazyTableProto, {
  table: {
    enumerable: true,
    get: function () {
      return this._table || this._decodeSourceData();
    }
  },

  checksum: {
    enumerable: true,
    get: function () {
      return this._checksum || this._calcChecksum();
    }
  }
});

LazyTableProto._decodeSourceData = function () {
  return this._table || (this._table = tableFactory(this.tag, this._stream, this.sourceMeta));
};

LazyTableProto._calcChecksum = function () {
  if (this.tag === 'head') {
    // Special case: Need to reset the checkSumAdjustment field in head table via the table decoder.
    this._decodeSourceData();
  }

  return (this._checksum = utils.calcChecksum(this._stream));
};

function LazyTableCollection() {}

var LazyTableCollectionProto = LazyTableCollection.prototype;

LazyTableCollectionProto.addTable = function (lazyTable) {
  var tag = lazyTable.tag;
  if (this.hasOwnProperty(tag)) {
    thr('Collection already has an instance of table %s', tag);
  }

  this[tag] = lazyTable;
};

LazyTableCollectionProto.decodeAll = function () {
  var lazyTables = this._tables;
  var tables = {};
  Object.keys(this).forEach(function (tag) {
    tables[tag] = lazyTables[tag].table;
  });

  return tables;
};

LazyTable.LazyTableCollection = LazyTableCollection;

module.exports = LazyTable;

