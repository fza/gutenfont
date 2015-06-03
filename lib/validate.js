'use strict';

var thr = require('format-throw');
var utils = require('./utils');
var constants = require('./constants');

// These are the tables required by GutenFont. The list does not necessarily include all required
// tables as per the OpenType spec. For example the "OS/2" table is Windows-specific, nonetheless
// listed as required in the specs. We utilize it when it exists, but don't require it. The tags
// on this list must be carefully chosen in order not to break official test suites.
var REQUIRED_TABLE_TAGS = ['cmap', 'head', 'hhea', 'hmtx', 'maxp', 'name', 'post'];

function missingTable(flavor, tag) {
  var flavorString = flavor === constants.FLAVOR_TRUETYPE ? 'TrueType' : 'PostScript';
  thr('Missing %s table for %s flavored OpenType font', tag, flavorString);
}

function invalidAlignment(tag) {
  thr('Invalid alignment of %s table', tag);
}

function invalidCompression(tag) {
  thr('Invalid compression of %s table', tag);
}

function unexpectedTable(tag) {
  thr('Found unexpected %s table', tag);
}

var validate = exports;

/**
 * Perform WOFF/WOFF2 header validation
 * @param {object} header
 * @param {Monster} dataStream
 */
validate.woffHeader = function (header, dataStream) {
  if (
    [constants.SIGNATURE_WOFF, constants.SIGNATURE_WOFF2].indexOf(header.signature) === -1 ||
    header.numTables === 0 ||
    header.reserved !== 0 ||
    !utils.allOrNone(header.metaOffset, header.metaLength, header.metaOrigLength) ||
    !utils.allOrNone(header.privOffset, header.privLength) ||
    header.length !== dataStream.byteLength ||
    header.totalSfntSize !== utils.round4(header.totalSfntSize)
  ) {
    thr('Malformed WOFF/WOFF2 file header');
  }

  return this;
};

/**
 * Check for supported sfnt version / WOFF flavor
 * @param flavor
 */
validate.flavor = function (flavor) {
  if (flavor === null) {
    thr('Unsupported OpenType flavor');
  }

  return this;
};

/**
 * Validate padding bytes
 * @param {Monster} dataStream
 */
validate.padding = function (dataStream) {
  var paddingBytesLength = dataStream.lastSkippedBytes;
  var peek = dataStream.peek.at(-paddingBytesLength);
  for (var i = 0; i < paddingBytesLength; ++i) {
    if (peek.uint8() !== 0) {
      thr('Found invalid padding');
    }
  }

  return this;
};

validate.woffCompressedTableLength = function (tag, compressedLength, origLength) {
  if (compressedLength > origLength) {
    invalidCompression(tag);
  }

  return this;
};

validate.compression = function (tag, decompressedByteLength, expectedByteLength) {
  if (decompressedByteLength !== expectedByteLength) {
    invalidCompression(tag);
  }

  return this;
};

/**
 * Perform table validation according to OpenType spec. Validate that tables are sorted by their
 * tags in natural sort order and that all required tables are present.
 * @param {Array} tables
 */
validate.tables = function (tables) {
  var tablesLength = tables.length, tag;
  var tagMap = {};
  var tagSortedTables = new Array(tablesLength);

  tables.forEach(function (table, idx) {
    tag = table.tag;

    if (tagMap.hasOwnProperty(tag)) {
      thr('Found multiple %s tables where only one is expected', tag);
    }

    tagMap[tag] = true;
    tagSortedTables[idx] = table;
  });

  REQUIRED_TABLE_TAGS.forEach(function (requiredTableTag) {
    if (!tagMap[requiredTableTag]) {
      thr('Missing table %s', requiredTableTag);
    }
  });

  var tmp;
  tagSortedTables.sort(function (a, b) {
    tmp = [a.tag, b.tag];
    tmp.sort();
    return b.tag === tmp[0] ? 1 : -1;
  });

  for (var i = 0; i < tablesLength; ++i) {
    if (tables[i] !== tagSortedTables[i]) {
      thr('Invalid table order');
    }
  }

  return this;
};

/**
 * Perform table validation according to WOFF/WOFF2 spec. Validate that tables do not overlap,
 * that there is no extraneous data despite padding between the tables, and that table offsets do
 * not extend beyond the input buffer.
 * @param {Array} tables
 * @param {Monster} dataStream
 * @param {number} firstTableOffset
 * @param {function} tableSizeCb
 * @param {function} [endOffsetCb]
 */
validate.tableOffsets = function (tables, dataStream, firstTableOffset, tableSizeCb, endOffsetCb) {
  var offsetSortedTables = tables.slice(0);
  offsetSortedTables.sort(function (a, b) {
    return a.offset - b.offset;
  });

  var peek = dataStream.peek.seek(firstTableOffset);
  offsetSortedTables.forEach(function (table, idx) {
    var tag = table.tag;

    if (peek.offset !== table.offset) {
      invalidAlignment(tag);
    }

    try {
      peek.skip(tableSizeCb(table));
    } catch (err) {
      thr('Invalid %s table size');
    }

    try {
      peek.pad4();
    } catch (err) {
      invalidAlignment(tag);
    }

    validate.padding(peek);
  });

  if (endOffsetCb) {
    endOffsetCb(peek.offset);
  }

  return this;
};

validate.woffLength = function (fileHeader, expectedSize) {
  ['metaLength', 'privLength'].forEach(function (lengthField) {
    if (fileHeader[lengthField]) {
      expectedSize = utils.round4(expectedSize) + fileHeader[lengthField];
    }
  });

  if (expectedSize !== fileHeader.length) {
    thr('Invalid woff file size');
  }
};

validate.origLength = function (what, computedSize, expectedSize) {
  if (computedSize !== expectedSize) {
    thr('Invalid %s size', what);
  }

  return this;
};

validate.checksum = function (tag, computedChecksum, expectedChecksum) {
  if (computedChecksum !== expectedChecksum) {
    thr('%s table checksum mismatch', tag);
  }

  return this;
};

/**
 * Validate that there are no extraneous tables that are not referenced by any font in a
 * collection.
 * @param {Array} tables
 * @param {Array} fontCollection
 */
validate.noExtraneousTables = function (tables, fontCollection) {
  var foundTables = {};

  fontCollection.forEach(function (font) {
    font.tables.forEach(function (table) {
      foundTables[table.offset] = true;
    });
  });

  var numFoundTables = Object.keys(foundTables).length;
  if (numFoundTables !== tables.length) {
    thr('Found %d unexpected tables in source file', numFoundTables);
  }

  return this;
};

validate.outlineTables = function (outlineType, flavor, tablesByTag) {
  if (outlineType === constants.OUTLINE_TYPE_TRUETYPE) {
    return validate.trueTypeTables(tablesByTag);
  } else if (outlineType === constants.OUTLINE_TYPE_POSTSCRIPT) {
    return validate.postScriptTables(tablesByTag);
  }

  thr('Unsupported font outline type');
};

validate.trueTypeTables = function (tablesByTag) {
  var outlineType = constants.OUTLINE_TYPE_TRUETYPE;
  var glyfTag = constants.TABLE_TAG_GLYF;
  var locaTag = constants.TABLE_TAG_LOCA;
  var cffTag = constants.TABLE_TAG_CFF;

  if (!tablesByTag[glyfTag]) {
    missingTable(outlineType, glyfTag);
  } else if (!tablesByTag[locaTag]) {
    missingTable(outlineType, locaTag);
  } else if (tablesByTag[cffTag]) {
    unexpectedTable(cffTag);
  }

  return this;
};

validate.postScriptTables = function (tablesByTag) {
  var cffTag = constants.TABLE_TAG_CFF;

  if (!tablesByTag[cffTag]) {
    missingTable(constants.OUTLINE_TYPE_POSTSCRIPT, cffTag);
  }

  return this;
};

validate.metadataEncoding = function (metadataStream) {
  var peek = metadataStream.peek;
  var valid = false;
  var str, c;

  // Valid if we have a UTF-8 BOM or the start of the XML tag can be read like 8-bit ASCII
  // This is not a thorough encoding check, but the metadata parser would throw anyway.
  str = peek.from(0).string(3, true);
  if (str === constants.BOM_UTF8 || (str += peek.string(2, true)) === '<?xml') {
    valid = true;
  }

  // If valid, check the encoding attribute, too
  if (valid) {
    // Read up to the first ">"
    peek.from(0);
    str = '';
    while (!peek.finished) {
      str += (c = peek.string(1, true));
      if (c === '>') {
        break;
      }
    }

    // If there is an encoding attribute, it must have the value "UTF-8"
    var match = str.match(/\s+encoding\s*=\s*((['"])([^'"]+)(['"]))/);
    if (match && match[2] === match[4]) {
      valid = match[3].toUpperCase() === 'UTF-8';
    }
  }

  if (!valid) {
    thr('Invalid metadata encoding');
  }

  return this;
};

validate.noMoreData = function (dataStream) {
  if (!dataStream.finished) {
    thr('Found extraneous data at the end of the source file');
  }

  return this;
};
