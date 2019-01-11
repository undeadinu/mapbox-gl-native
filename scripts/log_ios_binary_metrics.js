#!/usr/bin/env node

const fs = require('fs');
const zlib = require('zlib');
const AWS = require('aws-sdk');
var s3 = new AWS.S3();

const date = new Date();

// Name of variant and path to binary
const binaries = [
  ["universal", "build/ios/pkg/dynamic/Mapbox-stripped"],
  ["armv7", "build/ios/pkg/dynamic/Mapbox-stripped-armv7"],
  ["arm64", "build/ios/pkg/dynamic/Mapbox-stripped-arm64"],
  ["x86_64", "build/ios/pkg/dynamic/Mapbox-stripped-x86_64"]
]

const iosMetrics = binaries.map(binary => {
  return JSON.stringify({
      'sdk': 'maps',
      'platform' : 'iOS',
      'arch': binary[0],
      'size' : fs.statSync(binary[1]).size,
      'created_at': `${date.getUTCFullYear()}-${date.getUTCMonth() + 1}-${date.getUTCDate()}`
  })
}).join('\n');

console.log('Original ios metrics: ' + iosMetrics);

// Since the CircleCI default workflow runs several jobs for multiple platforms 
// on each commit, we need to check if binary size metrics for this commit
// exist already to prevent existing metrics from being overridden.

s3.getObject({
  Bucket: 'mapbox-loading-dock', 
  Key: `raw/nadia_staging_test_v2/${process.env['CIRCLE_SHA1']}.json.gz`
}, (err, data) => {
  if (err) {
    // Create new metrics object if it does not exist
    if (err.statusCode == 404) {
      return new AWS.S3({region: 'us-east-1'}).putObject({
          Body: zlib.gzipSync(iosMetrics),
          Bucket: 'mapbox-loading-dock',
          Key: `raw/nadia_staging_test_v2/${process.env['CIRCLE_SHA1']}.json.gz`,
          CacheControl: 'max-age=300',
          ContentType: 'application/json'
      }, function (err, res) {
        if (err) {
          console.log("Error uploading new binary size metrics: ", err);
        } else {
          console.log("Successfully uploaded new binary size metrics");
        }
      });

    } else {
      console.log('Unknown error checking for existing metrics in S3: ' + err);
    }
    
  } else {
     // Metrics already exist for this commit, so append additional data to it
     var androidMetrics = data.Body;
     
     zlib.unzip(androidMetrics, (err, data) => {
      if (err) throw err;
      var updatedPayload = androidMetrics + '\n' + iosMetrics;
      console.log("📦 Updated payload - stringified:");
      console.log(JSON.stringify(data));
      console.log("📦 Updated payload - unstringified:");
      console.log(data);
      
      return new AWS.S3({region: 'us-east-1'}).putObject({
          Body: zlib.gzipSync(data),
          Bucket: 'mapbox-loading-dock',
          Key: `raw/nadia_staging_test_v2/${process.env['CIRCLE_SHA1']}.json.gz`,
          CacheControl: 'max-age=300',
          ContentType: 'application/json'
      }, function (err, res) {
        if (err) {
          console.log("Error uploading iOS binary size metrics to existing metrics: ", err);
        } else {
          console.log("Successfully uploaded iOS binary size metrics to existing metrics:")
        }
      });
     });
  }
});