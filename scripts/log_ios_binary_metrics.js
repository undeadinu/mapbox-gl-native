#!/usr/bin/env node

const fs = require('fs');
const zlib = require('zlib');
const AWS = require('aws-sdk');

const date = new Date();

const binaries = [
  ["iOS", "universal", "build/ios/pkg/dynamic/Mapbox-stripped"],
  ["iOS", "armv7", "build/ios/pkg/dynamic/Mapbox-stripped-armv7"],
  ["iOS", "arm64", "build/ios/pkg/dynamic/Mapbox-stripped-arm64"],
  ["iOS", "x86_64", "build/ios/pkg/dynamic/Mapbox-stripped-x86_64"]
]

const iosMetrics = binaries.map(binary => {
  return JSON.stringify({
      'sdk': 'maps',
      'platform' : binary[0],
      'arch': binary[1],
      'size' : fs.statSync(binary[2]).size,
      'created_at': `${date.getUTCFullYear()}-${date.getUTCMonth() + 1}-${date.getUTCDate()}`
  })
}).join('\n') + '\n';

fs.appendFile('temp-metrics.json', iosMetrics, (err) => {
  if (err) throw err;
  console.log('iOS metrics written to temporary file');
});

fs.readFile('temp-metrics.json', (err, data) => {
  if (err) throw err;

  var payload = data.toString('utf8').trim()

  var params = {
      Body: zlib.gzipSync(payload),
      Bucket: 'mapbox-loading-dock',
      Key: `raw/nadia_staging_test_v2/${process.env['CIRCLE_SHA1']}.json.gz`,
      CacheControl: 'max-age=300',
      ContentType: 'application/json'
  };
  
  return new AWS.S3({region: 'us-east-1'}).putObject(params, function (err, res) {
    if (err) {
      console.log("Error sending iOS binary metrics to S3: ", err);
    } else {
      console.log("iOS binary size logged to S3 successfully")
      
      fs.unlink('temp-metrics.json', (err) => {
        if (err) throw err;
        console.log('temp-metrics.json was deleted');
      });
    }
  });
});