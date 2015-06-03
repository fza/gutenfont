'use strict';

require('./setup');

var thr = require('format-throw');
var constants = require('../../constants');

var utils = require('../../utils');
var Promise = utils.Promise;

var validate = require('../../validate'); // <validate/>
var Monster = require('frankenstein');
var LazyTable = require('../../lazy-table');
var parseMetadata = require('../../parse-woff-metadata');
var Font = require('../../font');

function invalidFile() {
  thr('Source does not look like WOFF');
}

function decodeHeader(uow) {
  var dataStream = uow.dataStream;

  if (dataStream.byteLength < 45) {
    invalidFile();
  } else {
    var header = uow.header = dataStream.woffHeaderStruct();
    if (header.signature !== constants.SIGNATURE_WOFF) {
      invalidFile();
    }
  }

  // Common WOFF/WOFF2 header validation
  validate.woffHeader(header, dataStream);
}

function decodeTableDirectory(uow) {
  var dataStream = uow.dataStream;
  var header = uow.header;
  var tables = uow.tables = dataStream.array(header.numTables, 'woffTableDirectoryEntryStruct');
  var tablesByTag = {};
  var computedSfntSize = 12; // sfnt header size
  var firstTableOffset = dataStream.offset;

  tables.forEach(function (table) {
    var tag = table.tag;
    tablesByTag[tag] = table;

    // assert(compLength <= origLength)
    validate.woffCompressedTableLength(tag, table.compLength, table.origLength);

    // sfnt offset table size + table data length + padding
    computedSfntSize += 16 + utils.round4(table.origLength);
  });

  var flavor = header.flavor;
  var outlineType = uow.outlineType = utils.detectFontOutlineType(flavor, tablesByTag);

  validate
    // Check that the computed OT/TT file size matches the original file size
    .origLength('file', computedSfntSize, header.totalSfntSize)
    // Check that the outline type is supported by GutenFont
    .flavor(outlineType)
    // Check that the source file has all required tables in natural sort order
    .tables(tables)
    // Check that the tables required by the outline type are present
    .outlineTables(outlineType, flavor, tablesByTag)
    // Check table offsets and lengths
    .tableOffsets(tables, dataStream, firstTableOffset, function (table) {
      return table.compLength;
    }, function (endOfDataBlockOffset) {
      dataStream.seek(endOfDataBlockOffset);
    })
    .woffLength(header, dataStream.offset);
}

function decodeTableData(uow) {
  var dataStream = uow.dataStream;
  var tables = uow.tables;
  var peek = dataStream.peek;

  return utils.iterateParallel(tables, function (table, tableIdx) {
    var compLength = table.compLength;
    var origLength = table.origLength;
    var tag = table.tag;

    peek.seek(table.offset);

    var getTableData;
    if (origLength === compLength) {
      getTableData = Promise.resolve(peek.byteArray(origLength));
    } else {
      getTableData = peek
        .deflatedData(compLength)
        .catch(function () {
          thr('Invalid compression of %s table', tag);
        });
    }

    return getTableData.then(function (byteArray) {
      validate.compression(tag, byteArray.byteLength, origLength);
      tables[tableIdx] = new LazyTable(tag, byteArray, table);
    });
  });
}

function validateTableData(uow) {
  return utils.iterateSeries(uow.tables, function (table) {
    validate.checksum(table.tag, table.checksum, table.sourceMeta.origChecksum);
  });
}

function decodeExtendedMetadata(uow) {
  var dataStream = uow.dataStream;
  var header = uow.header;

  if (header.metaLength > 0) {
    dataStream.pad4();

    if (header.metaOffset === dataStream.offset) {
      validate.padding(dataStream);

      return dataStream
        .seek(header.metaOffset)
        .deflatedData(header.metaLength)
        .catch(function () {
          thr('Invalid metadata compression');
        })
        .then(function (byteArray) {
          validate.origLength('metadata', header.metaOrigLength, byteArray.byteLength);
          var metadataStream = new Monster(byteArray);
          validate.metadataEncoding(metadataStream);
          uow.extendedMetadata = parseMetadata(metadataStream.string());
          uow.originalExtendedMetadataStream = metadataStream.seek(0);
        });
    }
  }
}

function decodePrivateData(uow) {
  var dataStream = uow.dataStream;
  var header = uow.header;

  if (header.privLength > 0) {
    dataStream.pad4();

    if (header.privOffset === dataStream.offset) {
      validate.padding(dataStream);

      uow.privateData = dataStream.byteArray(header.privLength);
    }
  }
}

function decodeFinish(uow) {
  validate.noMoreData(uow.dataStream);

  return new Font(uow.tables);
}

module.exports = function decodeWoff(dataStream, options) {
  var unitOfWork = {
    dataStream: dataStream,
    options: options || {}
  };

  return utils.processUnitOfWork(unitOfWork, [
    decodeHeader,
    decodeTableDirectory,
    decodeTableData,
    validateTableData,
    decodeExtendedMetadata,
    decodePrivateData,
    decodeFinish
  ]);
};
