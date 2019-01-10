#!/usr/bin/env node

const fs = require('fs');
const zlib = require('zlib');
const AWS = require('aws-sdk');

const date = new Date();

const binaries = [
  ["Android AAR", "platform/android/MapboxGLAndroidSDK/build/outputs/aar/MapboxGLAndroidSDK-release.aar"],
  ["armv7", "platform/android/MapboxGLAndroidSDK/build/intermediates/intermediate-jars/release/jni/armeabi-v7a/libmapbox-gl.so"],
  ["arm64-v8a", "platform/android/MapboxGLAndroidSDK/build/intermediates/intermediate-jars/release/jni/arm64-v8a/libmapbox-gl.so"],
  ["x86", "platform/android/MapboxGLAndroidSDK/build/intermediates/intermediate-jars/release/jni/x86/libmapbox-gl.so"],
  ["x86_64", "platform/android/MapboxGLAndroidSDK/build/intermediates/intermediate-jars/release/jni/x86_64/libmapbox-gl.so"]
]

const androidMetrics = binaries.map(binary => {
  return JSON.stringify({
      'sdk': 'maps',
      'platform' : 'Android',
      'arch': binary[0],
      'size' : fs.statSync(binary[1]).size,
      'created_at': `${date.getUTCFullYear()}-${date.getUTCMonth() + 1}-${date.getUTCDate()}`
  })
}).join('\n');

var params = {
  Bucket: 'mapbox-loading-dock', 
  Key: `raw/nadia_staging_test_v2/${process.env['CIRCLE_SHA1']}.json.gz`
};

var s3 = new AWS.S3();

var testParams = {
  Bucket: 'mapbox-loading-dock', 
  Key: `raw/nadia_staging_test_v2/5d38def92486076d182c1450a4c4451575cd1e2f.json.gz`
};

console.log('📦 TEST PARAMS: ' + testParams);

s3.getObject(testParams, (err, data) => {
  if (err) {
    console.log('❌ TEST GET FAILED:' + err);
  } else {
    console.log('✅ TEST GET PASSED:' + JSON.stringify(data.toString('utf8')));
  }
});


console.log('🅿️ ACTUAL PARAMS: ' + params);

s3.getObject(params, (err, data) => {
  if (err) {
    // Try with known existing object
    console.log('👎 ACTUAL GET FAILED: ' + err);
    
    var params = {
        Body: zlib.gzipSync(androidMetrics),
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
      }
    });
    
  } else {
     // Read the data from the file
     console.log(data)
     
     var iosMetrics = data.toString('utf8');
     var updatedPayload = iosMetrics + '\n' + androidMetrics;
     
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
         console.log("Error sending Android binary metrics to S3: ", err);
       } else {
         console.log("Android binary metrics appended to S3 successfully")
       }
     });
  }
});