const { notarize } = require('@electron/notarize');
const path = require('path');
const fs = require('fs');

// Export using commonjs syntax to prevent promisify errors
exports.default = async function notarizing(context) {
  // Only notarize on macOS
  if (context.electronPlatformName !== 'darwin') {
    return;
  }

  console.log('Notarizing macOS application...');
  
  // Get app information
  const appName = context.packager.appInfo.productFilename;
  const appPath = path.join(context.appOutDir, `${appName}.app`);
  
  // Validate app path
  if (!fs.existsSync(appPath)) {
    console.error(`App not found at: ${appPath}`);
    return;
  }

  // Get notarization credentials
  const { 
    APPLE_ID, 
    APPLE_APP_SPECIFIC_PASSWORD, 
    APPLE_TEAM_ID 
  } = process.env;

  // Validate credentials
  if (!APPLE_ID || !APPLE_APP_SPECIFIC_PASSWORD || !APPLE_TEAM_ID) {
    console.warn('Skipping notarization - missing required environment variables');
    return;
  }

  try {
    console.log(`Notarizing ${appName} with Apple ID: ${APPLE_ID}`);
    
    // Start notarization using the CommonJS version of the API
    await notarize({
      tool: 'notarytool',
      appPath,
      appleId: APPLE_ID,
      appleIdPassword: APPLE_APP_SPECIFIC_PASSWORD,
      teamId: APPLE_TEAM_ID,
    });
    
    console.log(`Successfully notarized ${appName}`);
  } catch (error) {
    console.error('Notarization failed:', error);
    // Don't throw - allows build to continue
    console.warn('Continuing build process despite notarization failure');
  }
};
