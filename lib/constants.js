'use strict';

module.exports = {
  // Supported WOFF formats
  SIGNATURE_WOFF: 0x774f4646,    // "wOFF"
  SIGNATURE_WOFF2: 0x774f4632,   // "wOF2"

  // Supported OpenType flavors (sfnt version field in the OpenType header)
  FLAVOR_COLLECTION: 0x74746366,      // "ttcf"
  FLAVOR_TRUETYPE: 0x00010000,        // 1.0, default, "general" TrueType signature
  FLAVOR_TRUETYPE_APPLE: 0x74727565,  // "true", AAT-style TrueType signature
  FLAVOR_POSTSCRIPT: 0x4f54544f,      // "OTTO"

  // Supported outline types (internal only)
  OUTLINE_TYPE_TRUETYPE: 'TrueType',
  OUTLINE_TYPE_POSTSCRIPT: 'PostScript',

  // Special sfnt table tags used in various contexts
  TABLE_TAG_CFF: 'CFF',
  TABLE_TAG_GLYF: 'glyf',
  TABLE_TAG_LOCA: 'loca',
  TABLE_TAG_HEAD: 'head',

  // TrueType glyph types (internal only)
  GLYPH_TYPE_EMPTY: 'empty',
  GLYPH_TYPE_SIMPLE: 'simple',
  GLYPH_TYPE_COMPOSITE: 'composite',

  // Encoding-related constants
  BOM_UTF8: '\xEF\xBB\xBF'
};
