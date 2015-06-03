'use strict';

/* eslint-env browser */
/* global File */

var thr = require('format-throw');
var Promise = require('../utils').Promise;

module.exports = function (src) {
  return new Promise(function (resolve, reject) {
    if (src instanceof ArrayBuffer) {
      return resolve(src);
    }

    if ((File && src instanceof File) || (Blob && src instanceof Blob)) {
      var reader = new FileReader();
      reader.onload = function (err) {
        if (err) {
          return reject(err);
        }

        resolve(reader.result);
      };

      return reader.readAsArrayBuffer(src);
    }

    thr('Unrecognized data source');
  });
};
