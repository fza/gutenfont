'use strict';

module.exports = {
  SIGNATURE_WOFF: 0x774f4646,    // "wOFF"
  SIGNATURE_WOFF2: 0x774f4632,   // "wOF2"

  FLAVOR_COLLECTION: 0x74746366, // "ttcf"
  FLAVOR_TRUETYPE: 0x00010000,   // 1.0
  FLAVOR_POSTSCRIPT: 0x4f54544f, // "OTTO"

  OUTLINE_TYPE_TRUETYPE: 'TrueType',     // internal
  OUTLINE_TYPE_POSTSCRIPT: 'PostScript', // internal

  TABLE_TAG_CFF: 'CFF',
  TABLE_TAG_GLYF: 'glyf',
  TABLE_TAG_LOCA: 'loca',
  TABLE_TAG_HEAD: 'head',

  GLYPH_TYPE_EMPTY: 'empty',
  GLYPH_TYPE_SIMPLE: 'simple',
  GLYPH_TYPE_COMPOSITE: 'composite',

  BOM_UTF8: '\xEF\xBB\xBF'
};
