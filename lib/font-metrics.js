'use strict';

// Notes: Need head, hhea, hmtx, vmtx, maxp (?), hdmx, OS/2

function FontMetrics(font) {
  Object.defineProperties(this, {
    _font: {
      value: font
    }
  });
}

var FontMetricsProto = FontMetrics.prototype;

FontMetricsProto.get = function (metricType) {
  console.log('>>> get metric ' + metricType);
};

module.exports = FontMetrics;
