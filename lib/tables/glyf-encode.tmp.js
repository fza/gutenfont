'use strict';

var thr = require('format-throw');
var inherits = require('inherits');
var constants = require('../constants');
var extend = require('object-extend');
var BaseWriter = require('./index');

var GLYPH_TYPE_EMPTY = constants.GLYPH_TYPE_EMPTY;
var GLYPH_TYPE_SIMPLE = constants.GLYPH_TYPE_SIMPLE;
var GLYPH_TYPE_COMPOSITE = constants.GLYPH_TYPE_COMPOSITE;

var SIMPLE_GLYPH_POINT_ON_CURVE = 1;
var SIMPLE_GLYPH_POINT_X_CHAR = 2;
var SIMPLE_GLYPH_POINT_Y_CHAR = 4;
var SIMPLE_GLYPH_POINT_REPEAT = 8;
var SIMPLE_GLYPH_POINT_SAME_X = 16;
var SIMPLE_GLYPH_POINT_SAME_Y = 32;

/**
 * Glyf table writer
 */
function GlyfTableWriter(arrayBuf) {
  BaseWriter.call(this, arrayBuf);
}

inherits(GlyfTableWriter, BaseWriter);

extend(GlyfTableWriter.prototype, {
  glyph: function (glyph) {
    if (glyph.type === GLYPH_TYPE_EMPTY) {
      // Nothing to do
      return false;
    }

    this.glyphHeader(glyph);

    if (glyph.type === GLYPH_TYPE_SIMPLE) {
      this.array(glyph.endPointsOfContours, 'uint16');
      this.instructionData(glyph);
      this.simpleGlyphPoints(glyph.points);
    } else if (glyph.type === GLYPH_TYPE_COMPOSITE) {
      this.data(glyph.compositeData);
      this.instructionData(glyph);
    }

    // Seems to be common practice to pad after each glyph.
    this.round4();
  },

  glyphHeader: function (glyph) {
    var int16 = this.int16;

    int16(glyph.numContours);

    var bbox = glyph.bbox;
    int16(bbox.xmin);
    int16(bbox.ymin);
    int16(bbox.xmax);
    int16(bbox.ymax);
  },

  instructionData: function (glyph) {
    if (glyph.instructionData) {
      var instructionData = glyph.instructionData;
      this.uint16(instructionData.byteLength);
      this.data(instructionData);
    }
  },

  simpleGlyphPoints: function (points) {
    var i, pointsLength = points.length;
    var uint8 = this.uint8, int16 = this.int16;
    var prevX = 0, prevY = 0, prevFlag = -1, repeatCount = 0;
    var byteArray = this.byteArray, xBytes = 0;
    var point, flag, dx, dy;

    // First pass: store flag input
    for (i = 0; i < pointsLength; ++i) {
      point = points[i];
      flag = point.onCurve ? SIMPLE_GLYPH_POINT_ON_CURVE : 0;
      dx = point.x - prevX;
      dy = point.y - prevY;

      if (dx === 0) {
        flag |= SIMPLE_GLYPH_POINT_SAME_X;
      } else if (dx > -256 && dx < 256) {
        flag |= SIMPLE_GLYPH_POINT_X_CHAR | (dx > 0 ? SIMPLE_GLYPH_POINT_SAME_X : 0);
        xBytes++;
      } else {
        xBytes += 2;
      }

      if (dy === 0) {
        flag |= SIMPLE_GLYPH_POINT_SAME_Y;
      } else if (dy > -256 && dy < 256) {
        flag |= SIMPLE_GLYPH_POINT_Y_CHAR | (dy > 0 ? SIMPLE_GLYPH_POINT_SAME_Y : 0);
      }

      if (flag === prevFlag && repeatCount !== 255) {
        byteArray[this.offset - 1] |= SIMPLE_GLYPH_POINT_REPEAT;
        repeatCount++;
      } else {
        if (repeatCount > 0) {
          uint8(repeatCount);
          repeatCount = 0;
        }

        uint8(flag);
      }

      prevFlag = flag;
      prevX = point.x;
      prevY = point.y;
    }

    if (repeatCount > 0) {
      uint8(repeatCount);
    }

    // Second pass: store x and y coordinate streams
    var xStartOffset = this.offset;
    var yStartOffset = xStartOffset + xBytes;
    var yOffset = yStartOffset;
    prevX = prevY = 0;
    for (i = 0; i < pointsLength; ++i) {
      point = points[i];
      dx = point.x - prevX;
      dy = point.y - prevY;

      if (dx !== 0) {
        if (dx > -256 && dx < 256) {
          uint8(Math.abs(dy));
        } else {
          int16(dx);
        }

        prevX += dx;
      }

      if (dy !== 0) {
        if (dy > -256 && dy < 256) {
          uint8(Math.abs(dy), yOffset++, true);
        } else {
          int16(dy, yOffset, true);
          yOffset += 2;
        }

        prevY += dy;
      }
    }

    if (this.offset !== xStartOffset + xBytes) {
      thr('Failed to encode simple glyph type coordinates');
    }

    this.skip(yOffset - yStartOffset);
  }
});

module.exports = GlyfTableWriter;
