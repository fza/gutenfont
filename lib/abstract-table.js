'use strict';

function AbstractTable(tag, fields) {
  Object.defineProperties(this, {
    tag: {
      enumerable: true,
      value: tag
    },

    fields: {
      enumerable: true,
      value: fields || {}
    }
  });
}

var AbstractTableProto = AbstractTable.prototype;

AbstractTableProto.get = function (field) {
  return this.fields[field];
};

AbstractTableProto.has = function (field) {
  return this.fields.hasOwnProperty(field);
};

AbstractTableProto.set = function (field, val) {
  this.fields[field] = val;
};

module.exports = AbstractTable;
