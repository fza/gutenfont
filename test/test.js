'use strict';

var lib = require('../index');

lib.convert(process.argv[2], 'opentype')
  .then(function (result) {
    console.dir(result, {depth: 3, colors: true});
    //console.dir(result.collectionFontEntries, {depth: 3});
    //console.dir(result.tables, {colors: true, depth: 2});
  })
  .catch(function (err) {
    console.error(err.stack);
  });
