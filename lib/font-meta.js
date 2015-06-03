'use strict';

function FontMeta(font) {
  Object.defineProperties(this, {
    _font: {
      value: font
    }
  });
}

module.exports = FontMeta;
