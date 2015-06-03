'use strict';

var thr = require('format-throw');
var constants = require('./constants');
var FontMeta = require('./font-meta');
var FontMetrics = require('./font-metrics');

/**
 * GutenType Font Class
 * @param {string} outlineType
 * @param {Array} [tables]
 * @constructor
 */
function Font(tables) {
  Object.defineProperties(this, {
    outlineType: {
      enumerable: true,
      get: function () {
        return this._detectOutlineType();
      }
    },

    tables: {
      enumerable: true,
      get: function () {
        return this._tables;
      }
    },

    tablesByTag: {
      enumerable: true,
      get: function () {
        return this._tablesByTag;
      }
    },

    meta: {
      enumerable: true,
      value: new FontMeta(this)
    },

    metrics: {
      enumerable: true,
      value: new FontMetrics(this)
    },

    _tables: {
      writable: true,
      value: []
    },

    _tablesByTag: {
      writable: true,
      value: {}
    }
  });

  if (tables) {
    tables.forEach(this.addTable.bind(this));
  }
}

var FontProto = Font.prototype;

FontProto.addTable = function (table) {
  var tag = table.tag;

  if (this.hasTable(tag)) {
    thr('A %s table already exists', tag);
  }

  this._tables.push(table);
  this._tablesByTag[tag] = table;
};

FontProto.hasTable = function (tag) {
  return this._tablesByTag.hasOwnProperty(tag);
};

FontProto.validate = function () {

};

FontProto._detectOutlineType = function () {
  var tablesByTag = this._tablesByTag;
  var hasCFF = !!tablesByTag[constants.TABLE_TAG_CFF];
  var hasGlyf = !!tablesByTag[constants.TABLE_TAG_GLYF];
  var hasLoca = !!tablesByTag[constants.TABLE_TAG_LOCA];

  var sfntVersion = this.meta.get('sfntVersion');
  if (sfntVersion === constants.FLAVOR_TRUETYPE && hasGlyf && hasLoca) {
    return constants.OUTLINE_TYPE_TRUETYPE;
  } else if (sfntVersion === constants.FLAVOR_POSTSCRIPT && hasCFF) {
    return constants.OUTLINE_TYPE_POSTSCRIPT;
  }
};

module.exports = Font;
