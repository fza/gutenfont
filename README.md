# woff2otf

> WOFF to OpenType converter in pure JavaScript

For node.js and browserify.

Loosely based on [woff2otf](https://github.com/arty-name/woff2otf) (JS), which in turn is based on [woff2otf](https://github.com/hanikesn/woff2otf) (Python). The former has some quite confusing bits in the code and is not CommonJS compatible, which is the reason for this fork.

My use case is to extract the base64-encoded data-uri of a .woff file that is included in a stylesheet, transform it to OpenType using this package, then passing the result to [opentype.js](https://github.com/nodebox/opentype.js) for typesetting in an SVG or canvas context, which often results in a more visually appealing rendering than letting the Browser munch the glyphs together. You loose the advantages of subpixel rendering, however.

WOFF is simply a compressed variant of OpenType, so a converted .otf file includes all glyphs and font features that were present in the source file. Typically, gzipping an .otf file should yield about same file size as the corresponding .woff.

## Installation

```shell
npm i woff2otf
```

## Example

```javascript
var woff2otf = require('woff2otf');
var opentype = require('opentype');

var woffArrayBuf = getArrayBufferSomehow();
var font = opentype(woff2otf(woffArrayBuf));
```

## @see

* http://www.w3.org/TR/WOFF/
* https://www.microsoft.com/typography/otspec/otff.htm
* https://developer.apple.com/fonts/TrueType-Reference-Manual/RM06/Chap6.html

## License

Copyright (c) 2015 [Felix Zandanel](http://felix.zandanel.me)  
Licensed under the MIT license.

See LICENSE for more info.
