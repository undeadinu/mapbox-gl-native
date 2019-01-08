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
}).join('\n');

var params = {
  Bucket: 'mapbox-loading-dock', 
  Key: `raw/nadia_staging_test_v2/${process.env['CIRCLE_SHA1']}.json.gz`
};
 
s3.getObject(params, (err, data) => {
  if (err) {

    console.log(err);
    console.log(JSON.stringify(err))
    
    var params = {
        Body: zlib.gzipSync(iosMetrics),
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
      }
    });
    
  } else {
     // Read the data from the file
     console.log(data)
     
     var androidMetrics = data.toString('utf8');
     var updatedPayload = androidMetrics + '\n' iosMetrics
     
     // Append the new data to it and replace the existing object
     var params = {
         Body: zlib.gzipSync(updatedPayload),
         Bucket: 'mapbox-loading-dock',
         Key: `raw/nadia_staging_test_v2/${process.env['CIRCLE_SHA1']}.json.gz`,
         CacheControl: 'max-age=300',
         ContentType: 'application/json'
     };
     
     return new AWS.S3({region: 'us-east-1'}).putObject(params, function (err, res) {
       if (err) {
         console.log("Error sending iOS binary metrics to S3: ", err);
       } else {
         console.log("iOS binary metrics appended to S3 successfully")
       }
     });
  }
});