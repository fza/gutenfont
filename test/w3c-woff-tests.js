'use strict';

var path = require('path');
var utils = require('./../lib/utils');
var Promise = utils.Promise;
var woffToOpenType = require('./../index');
var fixturesPath = path.join(__dirname, 'fixtures/woff/w3c');
var tests = require(path.join(__dirname, '/w3c-woff-tests.json'));
var testFiles = Object.keys(tests);
var skippedTestsCount = 0;

utils.iterateSeries(testFiles, function (testFile) {
  var test = tests[testFile];

  if (test.skip) {
    skippedTestsCount++;
    console.log('SKIPPED: ' + testFile);
    return Promise.resolve();
  }

  return new Promise(function (resolve, reject) {
    woffToOpenType.decodeWoff(path.join(fixturesPath, testFile))
      .then(function () {
        if (test.valid) {
          console.log('OK: ' + testFile);
          resolve();
        } else {
          reject(new Error('FAIL: ' + testFile));
        }
      })
      .catch(function (err) {
        if (test.valid) {
          console.log(err.stack);
          reject(new Error('FAIL: ' + testFile + ' (' + err.message + ')'));
        } else {
          tests[testFile].errorMessage = err.message;
          console.log('OK: ' + testFile + ' (EXPECTED FAIL: ' + err.message + ')');
          resolve();
        }
      });
  });
}).then(function () {
  console.log('ALL TESTS PASSED', (skippedTestsCount ? '(' + skippedTestsCount + ' SKIPPED)' : ''));
}).catch(function (err) {
  console.log(err.message);
});
