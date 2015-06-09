# Supported sfnt tables

This directory contains the decoders, encoders and processors of all sfnt tables supported by GutenFont by default. The term »supported« means that GutenFont can at least decode a table from a binary stream. It may not necessarily be able to encode all table types, though this typically refers to tables that are obsolete anyway. When encoding a font, GutenFont always chooses the most appropriate set of tables to represent metrics, glyphs, ligatures, substitutions etc.

For example, although GutenFont can read a »kern« table, it never produces one and instead always outputs a GPOS table to safe kerning information. In order for this to work, the GutenFont processor is smart enough to detect and choose the appropriate source tables which are then used to build a font file.

GutenFont supports table formats (and OpenType features) via a plugin system. Have look at the [GutenFont plugin index]() to see which plugins are available and which could be of use to you. Also have a look at the [GutenFont examples wiki page]() in order to find out how to load plugins and how to use them.

## Development guidelines

Every script dealing with encoding/decoding of table data must use one JavaScript file per sfnt table. The table factory will `require()` this file dynamically, so the script file name should exactly match the registered sfnt table tag after the following character replacement took place:

```javascript
var filename = sfntTag.replace(/[^a-zA-Z0-9]/g, '') + '.js';

// Examples:
// 'head' => 'head.js'
// 'OS/2' => 'OS2.js' (note the stripped slash)
// 'cvt ' => 'cvt.js' (note the stripped space)
```

Every table must inherit from `AbstractTable`, not only that it is possible to recognize an object as an sfnt table representation, but also to maintain a consistent structure throughout the GutenFont code. Every sfnt table implementation must be able to decode data, the encoding is optional. Every plugin must add itself as a callback to the hooks it wishes to be called for. The list of this hooks shall be kept at a very minimum. A plugin can register its own hooks, can observe hooks registered by other plugins and can depend on other plugins directly. However, GutenFont will not load plugins for which it detects a circular dependency. That means if there is a "baseplugin" plugin, which needs plugin "foo", but "foo" also depends on "baseplugin", GutenFont will reject loading any of them, even if there are other plugins which depend on "baseplugin" etc. When you need to declare new data types, these should generally be private unless there is sufficient reasoning that a type should be public. Please add a short comment in the code when you declare a public data type.

The structure of a sfnt table implementation is as follows:

```javascript
// statements: require()
// definition of public and private data types
// constructor definition following the scheme "SfnttagTable"
// statement: inherits(SfnttagTable, AbstractTable)
// method: Static SfnttagTable.decode
// statement: var SfnttagTableProto = SfnttagTable.prototype
// prototype methods
// statement: module.exports = SfnttagTable
```

**Plugins which do not follow these guidelines will not be added to the official GutenFont plugin index.**
