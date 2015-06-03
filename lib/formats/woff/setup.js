'use strict';

var Monster = require('frankenstein');
require('../../inflate');

var typeUint16 = 'uint16';
var typeUint32 = 'uint32';

Monster.addDataType('woffHeaderStruct', {
  extend: 'struct',
  structSize: 44,
  struct: [
    ['signature', typeUint32],
    ['flavor', typeUint32],
    ['length', typeUint32],
    ['numTables', typeUint16],
    ['reserved', typeUint16], // must validate this according to WOFF spec
    ['totalSfntSize', typeUint32],
    ['majorVersion', typeUint16],
    ['minorVersion', typeUint16],
    ['metaOffset', typeUint32],
    ['metaLength', typeUint32],
    ['metaOrigLength', typeUint32],
    ['privOffset', typeUint32],
    ['privLength', typeUint32]
  ]
});

Monster.addDataType('woffTableDirectoryEntryStruct', {
  extend: 'struct',
  structSize: 20,
  struct: [
    ['tag', 'tag'],
    ['offset', typeUint32],
    ['compLength', typeUint32],
    ['origLength', typeUint32],
    ['origChecksum', typeUint32]
  ]
});
