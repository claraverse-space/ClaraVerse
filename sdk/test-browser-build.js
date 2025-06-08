#!/usr/bin/env node

/**
 * Test script for browser build of Clara Flow SDK
 * Verifies UMD build can be loaded and basic functionality works
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🌐 Testing Clara Flow SDK Browser Build...\n');

// Check if UMD files exist
const umdPath = path.join(__dirname, 'dist', 'clara-flow-sdk.umd.js');
const umdMinPath = path.join(__dirname, 'dist', 'clara-flow-sdk.umd.min.js');

console.log('📁 Checking build files...');

if (fs.existsSync(umdPath)) {
  const stats = fs.statSync(umdPath);
  console.log(`✅ UMD build exists: ${(stats.size / 1024).toFixed(1)}KB`);
} else {
  console.log('❌ UMD build not found');
  process.exit(1);
}

if (fs.existsSync(umdMinPath)) {
  const stats = fs.statSync(umdMinPath);
  console.log(`✅ UMD minified build exists: ${(stats.size / 1024).toFixed(1)}KB`);
} else {
  console.log('❌ UMD minified build not found');
  process.exit(1);
}

// Check if source map files exist
const umdMapPath = path.join(__dirname, 'dist', 'clara-flow-sdk.umd.js.map');
const umdMinMapPath = path.join(__dirname, 'dist', 'clara-flow-sdk.umd.min.js.map');

if (fs.existsSync(umdMapPath)) {
  console.log('✅ UMD source map exists');
} else {
  console.log('⚠️  UMD source map not found');
}

if (fs.existsSync(umdMinMapPath)) {
  console.log('✅ UMD minified source map exists');
} else {
  console.log('⚠️  UMD minified source map not found');
}

// Read and analyze UMD build
console.log('\n🔍 Analyzing UMD build...');

const umdContent = fs.readFileSync(umdPath, 'utf8');

// Check for UMD wrapper
if (umdContent.includes('(function (global, factory)')) {
  console.log('✅ UMD wrapper detected');
} else {
  console.log('❌ UMD wrapper not found');
}

// Check for global export
if (umdContent.includes('ClaraFlowSDK')) {
  console.log('✅ Global ClaraFlowSDK export detected');
} else {
  console.log('❌ Global ClaraFlowSDK export not found');
}

// Check for main exports
const expectedExports = [
  'ClaraFlowRunner',
  'BrowserUtils',
  'createFlowRunner',
  'validateFlow'
];

let exportsFound = 0;
expectedExports.forEach(exportName => {
  if (umdContent.includes(exportName)) {
    console.log(`✅ Export found: ${exportName}`);
    exportsFound++;
  } else {
    console.log(`❌ Export missing: ${exportName}`);
  }
});

// Check for Node.js-specific code that should be excluded
const nodeSpecificPatterns = [
  'require(\'fs\')',
  'require(\'path\')',
  'process.env'
];

let nodeCodeFound = false;
nodeSpecificPatterns.forEach(pattern => {
  if (umdContent.includes(pattern)) {
    console.log(`⚠️  Node.js-specific code found: ${pattern}`);
    nodeCodeFound = true;
  }
});

if (!nodeCodeFound) {
  console.log('✅ No Node.js-specific code detected');
}

// Check for browser-specific features
const browserFeatures = [
  'FileReader',
  'Blob',
  'URL.createObjectURL',
  'fetch'
];

let browserFeaturesFound = 0;
browserFeatures.forEach(feature => {
  if (umdContent.includes(feature)) {
    console.log(`✅ Browser feature found: ${feature}`);
    browserFeaturesFound++;
  }
});

// Generate CDN usage examples
console.log('\n📝 Generating CDN usage examples...');

const cdnExamples = {
  unpkg: {
    latest: 'https://unpkg.com/clara-flow-sdk@latest/dist/clara-flow-sdk.umd.js',
    minified: 'https://unpkg.com/clara-flow-sdk@latest/dist/clara-flow-sdk.umd.min.js',
    specific: 'https://unpkg.com/clara-flow-sdk@1.4.0/dist/clara-flow-sdk.umd.js'
  },
  jsdelivr: {
    latest: 'https://cdn.jsdelivr.net/npm/clara-flow-sdk@latest/dist/clara-flow-sdk.umd.js',
    minified: 'https://cdn.jsdelivr.net/npm/clara-flow-sdk@latest/dist/clara-flow-sdk.umd.min.js',
    specific: 'https://cdn.jsdelivr.net/npm/clara-flow-sdk@1.4.0/dist/clara-flow-sdk.umd.js'
  }
};

console.log('📦 CDN Links:');
console.log('  unpkg (latest):', cdnExamples.unpkg.latest);
console.log('  unpkg (minified):', cdnExamples.unpkg.minified);
console.log('  jsDelivr (latest):', cdnExamples.jsdelivr.latest);
console.log('  jsDelivr (minified):', cdnExamples.jsdelivr.minified);

// Create simple HTML test file
const htmlTest = `<!DOCTYPE html>
<html>
<head>
    <title>Clara Flow SDK Test</title>
</head>
<body>
    <h1>Clara Flow SDK Browser Test</h1>
    <div id="output"></div>
    
    <script src="./dist/clara-flow-sdk.umd.js"></script>
    <script>
        const output = document.getElementById('output');
        
        try {
            // Test SDK loading
            if (typeof ClaraFlowSDK !== 'undefined') {
                output.innerHTML += '<p>✅ ClaraFlowSDK loaded successfully</p>';
                
                // Test exports
                const exports = Object.keys(ClaraFlowSDK);
                output.innerHTML += '<p>📦 Available exports: ' + exports.join(', ') + '</p>';
                
                // Test initialization
                const runner = new ClaraFlowSDK.ClaraFlowRunner();
                output.innerHTML += '<p>✅ ClaraFlowRunner initialized</p>';
                
                // Test browser utils
                const isBrowser = ClaraFlowSDK.BrowserUtils.isBrowser();
                output.innerHTML += '<p>🌐 Is browser: ' + isBrowser + '</p>';
                
                output.innerHTML += '<p>🎉 All tests passed!</p>';
            } else {
                output.innerHTML += '<p>❌ ClaraFlowSDK not found</p>';
            }
        } catch (error) {
            output.innerHTML += '<p>❌ Error: ' + error.message + '</p>';
        }
    </script>
</body>
</html>`;

const testHtmlPath = path.join(__dirname, 'test-browser.html');
fs.writeFileSync(testHtmlPath, htmlTest);
console.log(`\n📄 Test HTML file created: ${testHtmlPath}`);

// Summary
console.log('\n📊 Build Summary:');
console.log(`✅ UMD build: ${(fs.statSync(umdPath).size / 1024).toFixed(1)}KB`);
console.log(`✅ UMD minified: ${(fs.statSync(umdMinPath).size / 1024).toFixed(1)}KB`);
console.log(`✅ Exports found: ${exportsFound}/${expectedExports.length}`);
console.log(`✅ Browser features: ${browserFeaturesFound}/${browserFeatures.length}`);

if (exportsFound === expectedExports.length && !nodeCodeFound) {
  console.log('\n🎉 Browser build test PASSED!');
  console.log('📦 Ready for CDN distribution');
  console.log('\n🔗 Usage:');
  console.log('  <script src="https://unpkg.com/clara-flow-sdk@latest/dist/clara-flow-sdk.umd.js"></script>');
  console.log('  <script>const runner = new ClaraFlowSDK.ClaraFlowRunner();</script>');
} else {
  console.log('\n❌ Browser build test FAILED!');
  process.exit(1);
} 