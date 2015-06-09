'use strict';

require('./../../setup');

var thr = require('format-throw');
var constants = require('./../../constants');
var utils = require('./../../utils');
var processSeries = utils.processUnitOfWork;
var iterateSeries = utils.iterateSeries;
var iterateParallel = utils.iterateParallel;
var reconstructWoff2GlyfTable = require('./lib/woff2-glyf');
var srcToDataStream = require('./../../src-to-datastream/index');
var encodeOpenType = require('./../../encode-opentype');
var BaseReader = require('./lib/reader/input');
var WOFF2Reader = require('./lib/reader/woff2');
var FontData = require('./../../font');

var TABLE_TAG_GLYF = constants.TABLE_TAG_GLYF;
var TABLE_TAG_LOCA = constants.TABLE_TAG_LOCA;

var TTC_VERSION2 = 0x020000;

var TTC_HEADER_START_SIZE = 12;
var TTC_2_HEADER_SIG_SIZE = 12;
var OFFSET_TABLE_SIZE = 12;
var TABLE_RECORD_SIZE = 16;

function decodeHeader(fontData, srcReader, state) {
  var header = fontData.header = srcReader.header();
  if (header.signature !== constants.SIGNATURE_WOFF2) {
    thr('Source does not look like WOFF2 data');
  }

  if (header.numTables === 0) {
    thr('Invalid source header');
  }

  fontData.isCollection = header.flavor === constants.FLAVOR_COLLECTION;

  // Track the size of the source OpenType data, excluding loca and glyf tables. This is used to
  // determine the buffer size needed for the reconstruction of glyf and loca tables.
  state.identDataSize = 0;
}

function decodeTableDirectory(fontData, srcReader, state) {
  var numTables = fontData.header.numTables;
  var tables = fontData.tables = new Array(numTables);
  var tablesByTag = fontData.tablesByTag = {};
  var isCollection = fontData.isCollection;
  var glyfTable, locaTable;
  var totalUncompressedDataSize = 0;

  var series = iterateSeries(numTables, function (idx) {
    var table = tables[idx] = srcReader.tableDirectoryEntry();
    tablesByTag[table.tag] = table;
  });

  series = series.then(function () {
    var prevTable;
    return iterateSeries(tables, function (table) {
      var tag = table.tag;

      if (tag !== TABLE_TAG_LOCA) {
        totalUncompressedDataSize += table.transformLength || table.origLength;
      }

      if (!isCollection) {
        if (tag === TABLE_TAG_GLYF) {
          glyfTable = table;
        } else if (tag === TABLE_TAG_LOCA) {
          locaTable = table;
        }
      } else if (tag === TABLE_TAG_LOCA) {
        if (prevTable.tag !== TABLE_TAG_GLYF) {
          thr('Missing glyf table for loca table');
        }
        prevTable.locaTable = table;
      }

      prevTable = table;
    });
  });

  return series.then(function () {
    state.totalUncompressedDataSize = totalUncompressedDataSize;

    if (!isCollection) {
      glyfTable.locaTable = locaTable;
    }
  });
}

function decodeCollectionData(fontData, srcReader, state) {
  if (fontData.isCollection) {
    var tables = fontData.tables;
    var collectionHeader = fontData.collectionHeader = srcReader.collectionHeader();
    var numFonts = collectionHeader.numFonts;

    if (numFonts === 0) {
      thr('Invalid collection header');
    }

    var entries = fontData.collectionFontEntries = new Array(numFonts);

    // TTC header
    state.identDataSize += TTC_HEADER_START_SIZE + 4 * numFonts;
    if (collectionHeader.version === TTC_VERSION2) {
      state.identDataSize += TTC_2_HEADER_SIG_SIZE;
    }

    return iterateSeries(numFonts, function (entryIdx) {
      var entry = entries[entryIdx] = srcReader.collectionFontEntry();

      // With TTC, every font collection entry has its own set of offset tables
      state.identDataSize += OFFSET_TABLE_SIZE + entry.numTables * TABLE_RECORD_SIZE;

      var fontTables = entry.tables = [];
      entry.tableIndexes.forEach(function (tableIdx, idx) {
        if (!tables[tableIdx]) {
          thr('Invalid font collection');
        }

        fontTables[idx] = tables[tableIdx];
      });
    });
  }

  // When there's no TTC header, we have just one single offset table
  state.identDataSize += OFFSET_TABLE_SIZE + fontData.header.numTables * TABLE_RECORD_SIZE;
}

function decompressTableData(fontData, srcReader, state) {
  var header = fontData.header;
  var compressedSize = header.totalCompressedSize;
  var uncompressedSize = state.totalUncompressedDataSize;
  var data;

  try {
    data = state.uncompressedTableData = srcReader.brotliData(
      compressedSize,
      null,
      uncompressedSize
    );
    srcReader.round4();
  } catch (err) {
    thr('Unable to decompress table data');
  }

  if (uncompressedSize !== data.byteLength) {
    thr('Invalid data compression');
  }
}

function decodeTableData(fontData, srcReader, state) {
  var glyfTables = [];
  var tablesReader = new StreamReader(state.uncompressedTableData.buffer);

  var series = iterateSeries(fontData.tables, function (table) {
    var tableSize = 0;
    var tag = table.tag;
    if (tag === TABLE_TAG_GLYF) {
      if (!table.locaTable) {
        thr('Missing loca table for glyf table');
      }

      tableSize = table.transformLength;
    } else if (tag !== TABLE_TAG_LOCA) {
      state.identDataSize += utils.round4(tableSize = table.origLength);
    }

    if (tableSize) {
      table.data = tablesReader.data(tableSize);

      if (tag === TABLE_TAG_GLYF) {
        glyfTables.push(table);
      }
    }
  });

  return series.then(function () {
    // Allocate one large block of memory in advance for all reconstructed glyf and loca tables.
    // WOFF2 spec 3.2 has a side note that says that the totalSfntSize of the WOFF2 header may not
    // be accurate due to the transformation of glyf tables, but the C reference implementation
    // sticks to the exact totalSfntSize. Although the transformed glyf tables partly use the data
    // types 255Uint16 and UintBase128, which are variable-length, those data types are not present
    // in the OpenType format. That means, after reconstructing the data, the result *should*
    // always be byte-equal to the original OpenType font. Therefore, it should be safe to allocate
    // just totalSfntSize bytes minus size of non-transformed tables. Every glyf reconstructor
    // takes the memory it needs from the following allocated buffer. At the end the buffer is
    // expected to be fully drained.
    return iterateParallel(glyfTables, reconstructWoff2GlyfTable, {
      outputBuffer: new ArrayBuffer(fontData.header.totalSfntSize - state.identDataSize),
      outputBufferOffset: 0
    });
  });
}

function decodeExtendedMetadata(fontData, srcReader, state) {
  var header = fontData.header;

  try {
    if (header.metaLength > 0 && header.metaOffset >= srcReader.offset) {
      fontData.extendedMetadata = utils.removeUTF8BOM(srcReader.brotliString(
        header.metaOrigLength,
        header.metaOffset,
        header.metaLength
      ));
    }
  } catch (err) {
    state.brokenTailData = true;
  }
}

function decodePrivateData(fontData, srcReader, state) {
  var header = fontData.header;

  try {
    if (header.privLength > 0 && header.privOffset >= srcReader.offset) {
      fontData.privateData = srcReader.data(header.privLength, header.privOffset);
    }
  } catch (err) {
    state.brokenTailData = true;
  }
}

function finalizeFontData(fontData, srcReader, state) {
  if (!state.brokenTailData && !srcReader.finished) {
    thr('Found abundant data at the end of the source data input');
  }

  fontData.finalize();

  return fontData;
}

function decode(src) {
  return srcToDataStream(src)
    .then(function (arrayBuf) {
      return processSeries([
        decodeHeader,
        decodeTableDirectory,
        decodeCollectionData,
        decompressTableData,
        decodeTableData,
        decodeExtendedMetadata,
        decodePrivateData,
        finalizeFontData
      ], new Font(), new WOFF2Reader(arrayBuf), {});
    });
}

module.exports = exports = function woff2ToOpenType(src, options) {
  return decode(src)
    .then(function (fontData) {
      return encodeOpenType(fontData, options);
    });
};

exports.decode = decode;
