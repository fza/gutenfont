'use strict';

var thr = require('format-throw');
var constants = require('./../../constants');
var utils = require('./../../utils');
var processSeries = utils.processUnitOfWork;
var iterateSeries = utils.iterateSeries;
var WOFF2Reader = require('./reader/woff2');
var BaseWriter = require('./writer/base');
var GlyfTableWriter = require('./../../writer/glyf-table');

var GLYPH_TYPE_EMPTY = constants.GLYPH_TYPE_EMPTY;
var GLYPH_TYPE_SIMPLE = constants.GLYPH_TYPE_SIMPLE;
var GLYPH_TYPE_COMPOSITE = constants.GLYPH_TYPE_COMPOSITE;

var COMPOSITE_GLYPH_ARG1_ARG2_ARE_WORDS = 1;
var COMPOSITE_GLYPH_HAVE_SCALE = 8;
var COMPOSITE_GLYPH_MORE_COMPONENTS = 32;
var COMPOSITE_GLYPH_HAVE_XY_SCALE = 64;
var COMPOSITE_GLYPH_HAVE_TWO_BY_TWO = 128;
var COMPOSITE_GLYPH_WE_HAVE_INSTRUCTIONS = 256;

var EMPTY_BBOX = {
  xmin: 0,
  ymin: 0,
  xmax: 0,
  ymax: 0
};

function decodeHeader(uow) {
  var glyfTable = uow.glyfTable;
  var dataStream = uow.dataStream = new WOFF2Reader.TransformedGlyfTableReader(glyfTable.data.buffer);
  var header = uow.header = dataStream.header();
  var numGlyphs = header.numGlyphs;
  var indexFormat = header.indexFormat;
  if (header.version !== 0 || numGlyphs === 0 || (indexFormat !== 0 && indexFormat !== 1)) {
    thr('Invalid source glyf table');
  }

  var locaItemBytes = uow.locaItemBytes = header.indexFormat === 0 ? 2 : 4;
  if (uow.locaTable.origLength !== (header.numGlyphs + 1) * locaItemBytes) {
    thr('Invalid glyf/loca tables');
  }
}

function getSubStreamReader(dataStream, byteLength) {
  return new WOFF2Reader.Woff2Stream(dataStream.data(byteLength).buffer);
}

function prepareStreams(uow) {
  var header = uow.header;
  var dataStream = uow.dataStream;

  uow.streams = {
    nContour: getSubStreamReader(dataStream, header.nContourStreamSize),
    nPoints: getSubStreamReader(dataStream, header.nPointsStreamSize),
    flag: getSubStreamReader(dataStream, header.flagStreamSize),
    glyph: getSubStreamReader(dataStream, header.glyphStreamSize),
    composite: getSubStreamReader(dataStream, header.compositeStreamSize),
    bbox: getSubStreamReader(dataStream, header.bboxStreamSize),
    instruction: getSubStreamReader(dataStream, header.instructionStreamSize)
  };

  if (!dataStream.finished) {
    thr('Found extraneous data in transformed glyf table');
  }
}

function prepareWriters(state, uow) {
  var buf = state.outputBuffer;
  var offset = state.outputBufferOffset;
  var locaItemBytes = uow.locaItemBytes;
  var glyfTableLength = uow.glyfTable.origLength;
  var locaTableLength = uow.locaTable.origLength;

  if (locaTableLength !== uow.header.numGlyphs * locaItemBytes + locaItemBytes) {
    thr('Invalid loca table length');
  }

  uow.glyfWriter = new GlyfTableWriter(buf.slice(offset, offset + glyfTableLength));
  offset += glyfTableLength;
  uow.locaWriter = new BaseWriter(buf.slice(offset, offset + locaTableLength));
  state.outputBufferOffset = offset + locaTableLength;

  if (buf.byteLength - state.outputBufferOffset < 0) {
    thr('Invalid source glyf/loca table sizing');
  }
}

function decodeBboxBitmap(uow) {
  uow.bboxBitmap = uow.streams.bbox.bitmap(((uow.header.numGlyphs + 31) >> 5) << 2);
}

function signVal(flag, val) {
  return (flag & 1) ? val : -val;
}

function decodeTriplets(flagStream, glyphStream, numPoints) {
  var x = 0, y = 0, dx, dy;
  var flag, onCurve, a, b, bytes;
  var points = new Array(numPoints);
  var nextGlyphByte = glyphStream.uint8;

  for (var i = 0; i < numPoints; ++i) {
    flag = flagStream.uint8();
    onCurve = !(flag >> 7);
    flag &= 0x7f;

    if (flag < 10) {
      dx = 0;
      dy = signVal(flag, ((flag & 14) << 7) + nextGlyphByte());
    } else if (flag < 20) {
      dx = signVal(flag, (((flag - 10) & 14) << 7) + nextGlyphByte());
      dy = 0;
    } else if (flag < 84) {
      a = flag - 20;
      b = nextGlyphByte();
      dx = signVal(flag, 1 + (a & 0x30) + (b >> 4));
      dy = signVal(flag >> 1, 1 + ((a & 0x0c) << 2) + (b & 0x0f));
    } else if (flag < 120) {
      a = flag - 84;
      dx = signVal(flag, 1 + ((a / 12) << 8) + nextGlyphByte());
      dy = signVal(flag >> 1, 1 + (((a % 12) >> 2) << 8) + nextGlyphByte());
    } else if (flag < 124) {
      bytes = glyphStream.array(3);
      dx = signVal(flag, (bytes[0] << 4) + (bytes[1] >> 4));
      dy = signVal(flag >> 1, ((bytes[1] & 0x0f) << 8) + bytes[2]);
    } else {
      dx = signVal(flag, (nextGlyphByte() << 8) + nextGlyphByte());
      dy = signVal(flag >> 1, (nextGlyphByte() << 8) + nextGlyphByte());
    }

    points[i] = {
      x: (x += dx),
      y: (y += dy),
      onCurve: onCurve
    };
  }

  return points;
}

function computeBbox(points) {
  var x = points[0].x, y = points[0].y;
  var xmin = x, ymin = y, xmax = x, ymax = y;
  var numPoints = points.length;

  for (var i = 0; i < numPoints; ++i) {
    x = points[i].x;
    y = points[i].y;

    xmin = Math.min(x, xmin);
    ymin = Math.min(y, ymin);
    xmax = Math.max(x, xmax);
    ymax = Math.max(y, ymax);
  }

  return {
    xmin: xmin,
    ymin: ymin,
    xmax: xmax,
    ymax: ymax
  };
}

function decodeNextSimpleGlyph(uow, glyph) {
  var streams = uow.streams;
  var numContours = glyph.numContours;

  var numPoints = -1;
  var endPointsOfContours = glyph.endPointsOfContours = new Array(numContours);
  for (var i = 0; i < numContours; ++i) {
    endPointsOfContours[i] = (numPoints += streams.nPoints.b255Uint16());
  }
  numPoints++;

  var points = glyph.points = decodeTriplets(streams.flag, streams.glyph, numPoints);
  glyph.bbox = computeBbox(points);

  glyph.instructionData = streams.instruction.data(streams.glyph.b255Uint16());
}

function decodeNextCompositeGlyph(uow, glyph) {
  var streams = uow.streams;
  var compositeStream = streams.composite;
  var haveInstructions = false;
  var startOffset = compositeStream.offset;
  var flags = COMPOSITE_GLYPH_MORE_COMPONENTS;
  var argSize;

  while (flags & COMPOSITE_GLYPH_MORE_COMPONENTS) {
    flags = compositeStream.uint16();
    haveInstructions = !!(flags & COMPOSITE_GLYPH_WE_HAVE_INSTRUCTIONS);

    argSize = flags & COMPOSITE_GLYPH_ARG1_ARG2_ARE_WORDS ? 4 : 2;
    if (flags & COMPOSITE_GLYPH_HAVE_SCALE) {
      argSize += 2;
    } else if (flags & COMPOSITE_GLYPH_HAVE_XY_SCALE) {
      argSize += 4;
    } else if (flags & COMPOSITE_GLYPH_HAVE_TWO_BY_TWO) {
      argSize += 8;
    }

    compositeStream.skip(2 + argSize); // glyphIndex + argument1 + argument2 + transformation
  }

  glyph.bbox = uow.streams.bbox.array(4, 'int16');
  glyph.compositeData = compositeStream.data(
    compositeStream.offset - startOffset,
    startOffset,
    true
  );

  glyph.instructionData = haveInstructions
    ? streams.instruction.data(streams.glyph.b255Uint16())
    : null;
}

function validateBbox(uow, glyph) {
  var glyphType = glyph.type;
  if (uow.bboxBitmap.bit(glyph.index)) { // Explicit bbox
    if (glyphType === GLYPH_TYPE_COMPOSITE) {
      return true;
    }

    var a = glyph.bbox; // EMPTY_BBOX or computed bbox for simple glyphs
    var b = uow.streams.bbox.array(4, 'int16');

    for (var i = 0; i < 4; ++i) {
      if (a[i] !== b[i]) {
        thr('Found mismatching bbox');
      }
    }
  } else if (glyphType === GLYPH_TYPE_COMPOSITE) {
    thr('Found composite glyph without bbox');
  }

  return true;
}

function writeCurrentGlyph(uow, glyph) {
  uow.storeCurrentGlyphOffset(glyph.offset);
  uow.glyfWriter.glyph(glyph);
}

function decodeGlyphs(uow) {
  var streams = uow.streams;
  var locaWriter = uow.locaWriter;
  uow.storeCurrentGlyphOffset = uow.locaItemBytes === 2 ? locaWriter.uint16 : locaWriter.uint32;

  var series = iterateSeries(uow.header.numGlyphs, function (idx) {
    var numContours = streams.nContour.int16();
    var glyph = {
      bbox: EMPTY_BBOX,
      index: idx,
      numContours: numContours,
      offset: uow.glyfWriter.offset
    };

    var processors = [];
    if (numContours === 0) {
      glyph.type = GLYPH_TYPE_EMPTY;
    } else if (numContours === -1) {
      glyph.type = GLYPH_TYPE_COMPOSITE;
      processors.push(decodeNextCompositeGlyph);
    } else if (numContours > 0) {
      glyph.type = GLYPH_TYPE_SIMPLE;
      processors.push(decodeNextSimpleGlyph);
    } else {
      thr('Invalid source glyf table');
    }

    return processSeries(processors.concat([
      validateBbox,
      writeCurrentGlyph
    ]), uow, glyph);
  });

  return series.then(function () {
    uow.storeCurrentGlyphOffset(uow.glyfWriter.offset);
  });
}

function finalizeGlyphData(uow) {
  var glyfTable = uow.glyfTable;
  var locaTable = uow.locaTable;
  var glyfWriter = uow.glyfWriter;
  var locaWriter = uow.locaWriter;

  // Check source input offsets
  Object.keys(uow.streams).forEach(function (key) {
    var stream = uow.streams[key];
    if (!stream.finished) {
      thr(
        'Found %d bytes of abundant data in %s input of source glyf table',
        stream.byteLength - stream.offset,
        key
      );
    }
  });

  if (!glyfWriter.finished) {
    thr('Failed to decode glyf table');
  } else if (!locaWriter.finished) {
    thr('Failed to recreate loca table');
  }

  glyfTable.data = glyfWriter.byteArray;
  locaTable.data = locaWriter.byteArray;
}

module.exports = function reconstructWoff2GlyphTable(glyfTable, idx, allGlyfTables, state) {
  var uow = {
    glyfTable: glyfTable,
    locaTable: glyfTable.locaTable
  };

  return processSeries([
    decodeHeader,
    prepareStreams,
    decodeBboxBitmap,
    prepareWriters.bind(null, state),
    decodeGlyphs,
    finalizeGlyphData
  ], uow);
};
