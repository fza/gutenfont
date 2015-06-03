'use strict';

var thr = require('format-throw');

// Populated lazily when the table script files are required
var tableClassMap = {
  head: null
};

module.exports = function (tag, stream, sourceMeta, tableCollection) {
  try {
    var TableClass = tableClassMap[tag] || (tableClassMap[tag] = require('./tables/' + tag));
    return TableClass.fromStream(stream, sourceMeta, tableCollection);
  } catch (e) {}

  thr('Unknown table %s', tag);
};
