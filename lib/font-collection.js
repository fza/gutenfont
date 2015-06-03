'use strict';

//var extend = require('object-extend');

/**
 * TTC/OTC Font Collection
 * @constructor
 */
function FontCollection() {
  this.woffHeader = null;
  this.ttcVersion = null;
  this.fonts = [];
  this.extendedMetadata = null;
  this.privateData = null;
}

module.exports = FontCollection;
