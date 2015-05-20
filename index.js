'use strict';

var inflate = require('pako/lib/inflate').inflate;

var UINT_16 = 1;
var UINT_32 = 2;

function getPadding(offset) {
  return ((offset % 4) !== 0) ? 4 - (offset % 4) : 0;
}

function Converter() {
  var self = this;
  self.unpack16 = self._unpack.bind(self, UINT_16);
  self.unpack32 = self._unpack.bind(self, UINT_32);
}

Converter.prototype.convert = function (bufIn) {
  var self = this;

  self.dataViewIn = new DataView(bufIn);
  self.offsetIn = 0;

  var woffHeader = self._readWOFFHeader();
  var entrySelector = self._calcEntrySelector(woffHeader);
  var searchRange = Math.pow(2, entrySelector) * 16;
  var rangeShift = (woffHeader.numTables * 16) - searchRange;
  var dirRecords = new Array(woffHeader.numTables);
  var offset = 12; // OTF header size: 4 + 2 + 2 + 2 + 2
  var totalTablesUncompressedSize = 0;

  for (var i = 0; i < woffHeader.numTables; i++) {
    dirRecords[i] = self._readNextDirectoryRecord();
    offset += 16; // OTF directory record size: 4 + 4 + 4 + 4
    totalTablesUncompressedSize += dirRecords[i].origLength;
  }

  var arrayOut = new Uint8Array(offset + totalTablesUncompressedSize + (4 * woffHeader.numTables));
  var bufferOut = arrayOut.buffer;

  self.dataViewOut = new DataView(bufferOut);
  self.offsetOut = 0;

  // Write OpenType header
  self._write(woffHeader.flavor, UINT_32);
  self._write(woffHeader.numTables, UINT_16);
  self._write(searchRange, UINT_16);
  self._write(entrySelector, UINT_16);
  self._write(rangeShift, UINT_16);

  // Write directory records
  dirRecords.forEach(function (record) {
    self._write(record.tag, UINT_32);
    self._write(record.origChecksum, UINT_32);
    self._write(offset, UINT_32);
    self._write(record.origLength, UINT_32);

    record.outOffset = offset;

    offset += record.origLength + getPadding(offset);
  });

  // Write tables
  var size = 0;
  var padding;
  var inflated, deflated;
  dirRecords.forEach(function (record) {
    deflated = new Uint8Array(bufIn.slice(record.offset, record.offset + record.compLength));
    inflated = (record.compLength !== record.origLength) ? inflate(deflated) : deflated;

    arrayOut.set(inflated, record.outOffset);
    offset = record.outOffset + record.origLength;
    padding = getPadding(offset);
    arrayOut.set(new Uint8Array(padding), record.outOffset + record.origLength);
    size = offset + padding;
  });

  return bufferOut.slice(0, size);
};

Converter.prototype._readWOFFHeader = function () {
  var self = this;
  var unpack16 = self.unpack16;
  var unpack32 = self.unpack32;

  return {
    signature: unpack32(),
    flavor: unpack32(),
    length: unpack32(),
    numTables: unpack16(),
    reserved: unpack16(),
    totalSfntSize: unpack32(),
    majorVersion: unpack16(),
    minorVersion: unpack16(),
    metaOffset: unpack32(),
    metaLength: unpack32(),
    metaOrigLength: unpack32(),
    privOffset: unpack32(),
    privLength: unpack32()
  };
};

Converter.prototype._readNextDirectoryRecord = function () {
  var self = this;
  var unpack32 = self.unpack32;

  return {
    tag: unpack32(),
    offset: unpack32(),
    compLength: unpack32(),
    origLength: unpack32(),
    origChecksum: unpack32()
  };
};

Converter.prototype._calcEntrySelector = function (woffHeader) {
  var entrySelector = 0;
  while (Math.pow(2, entrySelector) <= woffHeader.numTables) {
    entrySelector++;
  }

  return entrySelector - 1;
};

Converter.prototype._write = function (val, format) {
  var self = this;
  var dataViewOut = self.dataViewOut;
  var offsetOut = self.offsetOut;
  if (format === UINT_16) {
    dataViewOut.setUint16(offsetOut, val);
    self.offsetOut += 2;
  } else if (format === UINT_32) {
    dataViewOut.setUint32(offsetOut, val);
    self.offsetOut += 4;
  }
};

Converter.prototype._unpack = function (format) {
  var self = this;
  var dataViewIn = self.dataViewIn;
  var offsetIn = self.offsetIn;
  var val;
  if (format === UINT_16) {
    val = dataViewIn.getUint16(offsetIn);
    self.offsetIn += 2;
  } else if (format === UINT_32) {
    val = dataViewIn.getUint32(offsetIn);
    self.offsetIn += 4;
  }

  return val;
};

module.exports = function (buf) {
  return (new Converter()).convert(buf);
};