# @lilabyte/xml-stream-2-json

This code is a fork of [xml-to-json](https://github.com/alabianca/xml-to-json). It fixes some parts of that codebase as it is no longer being actively maintained.

Simple module to convert XML stream to JSON with javascript that provides streaming capability.

## Download
`npm install @lilabyte/xml-stream-2-json` or `npm install @lilabyte/xml-stream-2-json -g`

Installing the package globally allows you to convert xml file to json files via the command line.
`cat config.xml | tojson > config.json` . If you want to ignore xml attribute simply add the `-no-attr` flag.

See [xml-to-json](https://github.com/alabianca/xml-to-json) for documentation and examples.

License: MIT

## Future updates
* Refactor in typescript
