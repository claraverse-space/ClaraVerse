#!/bin/bash
# Setup script for notarization dependencies

# Uninstall any existing version
npm uninstall --save-dev @electron/notarize

# Install a specific compatible version that works with CommonJS
npm install --save-dev @electron/notarize@2.2.0

# Make a test file to verify installation
cat > notarize-test.cjs << 'EOF'
const { notarize } = require('@electron/notarize');
console.log('Notarize package loaded successfully');
EOF

# Test that the module loads correctly
node notarize-test.cjs
rm notarize-test.cjs

echo "Notarization dependencies installed successfully."
echo "Run ./package-mac-signed.sh to build and notarize your app."
