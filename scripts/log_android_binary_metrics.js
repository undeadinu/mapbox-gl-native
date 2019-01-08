#!/usr/bin/env node

const fs = require('fs');
const zlib = require('zlib');
const AWS = require('aws-sdk');

const date = new Date();

const binaries = [
  ["Android", "Android AAR", "platform/android/MapboxGLAndroidSDK/build/outputs/aar/MapboxGLAndroidSDK-release.aar"],
  ["Android", "armv7", "platform/android/MapboxGLAndroidSDK/build/intermediates/intermediate-jars/release/jni/armeabi-v7a/libmapbox-gl.so"],
  ["Android", "arm64-v8a", "platform/android/MapboxGLAndroidSDK/build/intermediates/intermediate-jars/release/jni/arm64-v8a/libmapbox-gl.so"],
  ["Android", "x86", "platform/android/MapboxGLAndroidSDK/build/intermediates/intermediate-jars/release/jni/x86/libmapbox-gl.so"],
  ["Android", "x86_64", "platform/android/MapboxGLAndroidSDK/build/intermediates/intermediate-jars/release/jni/x86_64/libmapbox-gl.so"]
]

const androidMetrics = binaries.map(binary => {
  return JSON.stringify({
      'sdk': 'maps',
      'platform' : binary[0],
      'arch': binary[1],
      'size' : fs.statSync(binary[2]).size,
      'created_at': `${date.getUTCFullYear()}-${date.getUTCMonth() + 1}-${date.getUTCDate()}`
  })
}).join('\n') + '\n';

fs.appendFile('temp-metrics.json', androidMetrics, (err) => {
  if (err) throw err;
  console.log('Android metrics written to temporary file');
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
      console.log("Error sending Android binary metrics to S3: ", err);
    } else {
      console.log("Android binary size logged to S3 successfully")
      
      fs.unlink('temp-metrics.json', (err) => {
        if (err) throw err;
        console.log('temp-metrics.json was deleted');
      });
    }
  });
});