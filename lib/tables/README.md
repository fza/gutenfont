# Supported sfnt tables

This directory contains the decoders, encoders and processors of all sfnt tables supported by GutenFont by default. The term »supported« means that GutenFont can at least decode a table from a binary stream. It may not necessarily be able to encode all table types, though this typically refers to tables that are obsolete anyway. When encoding a font, GutenFont always chooses the most appropriate set of tables to represent metrics, glyphs, ligatures, substitutions etc.

For example, although GutenFont can read a »kern« table, it never produces one and instead always outputs a GPOS table to safe kerning information. In order for this to work, the GutenFont processor is smart enough to detect and choose the appropriate source tables which are then used to build a font file.

GutenFont supports table formats (and OpenType features) via a plugin system. Have look at the [GutenFont plugin index]() to see which plugins are available and which could be of use to you. Also have a look at the [GutenFont examples wiki page]() in order to find out how to load plugins and how to use them.
