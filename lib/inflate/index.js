'use strict';

// Will be replaced by aliasify when making the distribution bundle
var inflate = module.exports = require('./node');

var Monster = require('frankenstein');

Monster.addDataType('deflatedData', {
  get: function (stream, offset, compLength) {
    return inflate(stream.byteArray(compLength));
  }
});
