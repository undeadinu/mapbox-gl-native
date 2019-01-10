#!/usr/bin/env node

const fs = require('fs');
const zlib = require('zlib');
const AWS = require('aws-sdk');
var s3 = new AWS.S3();

const date = new Date();

// Name of variant and path to binary
const binaries = [
  ["Android AAR", "platform/android/MapboxGLAndroidSDK/build/outputs/aar/MapboxGLAndroidSDK-release.aar"],
  ["armv7", "platform/android/MapboxGLAndroidSDK/build/intermediates/intermediate-jars/release/jni/armeabi-v7a/libmapbox-gl.so"],
  ["arm64-v8a", "platform/android/MapboxGLAndroidSDK/build/intermediates/intermediate-jars/release/jni/arm64-v8a/libmapbox-gl.so"],
  ["x86", "platform/android/MapboxGLAndroidSDK/build/intermediates/intermediate-jars/release/jni/x86/libmapbox-gl.so"],
  ["x86_64", "platform/android/MapboxGLAndroidSDK/build/intermediates/intermediate-jars/release/jni/x86_64/libmapbox-gl.so"]
]

// Generate metrics to upload to S3
const androidMetrics = binaries.map(binary => {
  return JSON.stringify({
      'sdk': 'maps',
      'platform' : 'Android',
      'arch': binary[0],
      'size' : fs.statSync(binary[1]).size,
      'created_at': `${date.getUTCFullYear()}-${date.getUTCMonth() + 1}-${date.getUTCDate()}`
  })
}).join('\n');

// Since the CircleCI default workflow runs several jobs for multiple platforms 
// on each commit, we need to check if binary size metrics for this commit
// exist already to prevent existing metrics from being overridden.

s3.getObject({
  Bucket: 'mapbox-loading-dock', 
  Key: `raw/nadia_staging_test_v2/${process.env['CIRCLE_SHA1']}.json.gz`
}, (err, data) => {
  if (err) {
    
    // Create new metrics object if it does not exist
    if (err.includes('NoSuchKey')) {
      return new AWS.S3({region: 'us-east-1'}).putObject({
          Body: zlib.gzipSync(androidMetrics),
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
     var iosMetrics = JSON.stringify(data.Body);

     var updatedPayload = iosMetrics + '\n' + androidMetrics;
     
     return new AWS.S3({region: 'us-east-1'}).putObject({
         Body: zlib.gzipSync(updatedPayload),
         Bucket: 'mapbox-loading-dock',
         Key: `raw/nadia_staging_test_v2/${process.env['CIRCLE_SHA1']}.json.gz`,
         CacheControl: 'max-age=300',
         ContentType: 'application/json'
     }, function (err, res) {
       if (err) {
         console.log("Error uploading Android binary size metrics to existing metrics: ", err);
       } else {
         console.log("Successfully uploaded Android binary size metrics to existing metrics:")
       }
     });
  }
});