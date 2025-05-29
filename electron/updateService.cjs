const { autoUpdater } = require('electron-updater');
const { dialog } = require('electron');
const { shell } = require('electron');
const fs = require('fs');
const path = require('path');

// Use node-fetch for HTTP requests with comprehensive fallback
let fetch;
let AbortController;

try {
  // Try to use global fetch first (Node.js 18+)
  fetch = globalThis.fetch;
  AbortController = globalThis.AbortController;
} catch (error) {
  // Fallback to node-fetch for older versions
  try {
    const nodeFetch = require('node-fetch');
    fetch = nodeFetch.default || nodeFetch;
    AbortController = require('abort-controller').AbortController;
  } catch (fetchError) {
    console.warn('No fetch implementation available. Update checking will not work.');
    fetch = null;
    AbortController = null;
  }
}

// Configure logging with error boundaries
let logger;
try {
  logger = require('electron-log');
  autoUpdater.logger = logger;
  autoUpdater.logger.transports.file.level = 'info';
} catch (error) {
  console.warn('Electron log not available, using console');
  logger = console;
}

// Constants for robust update handling
const UPDATE_CONSTANTS = {
  GITHUB_API_TIMEOUT: 15000,
  MAX_RETRIES: 3,
  RETRY_DELAY: 2000,
  RATE_LIMIT_DELAY: 60000,
  MAX_RELEASE_NOTES_LENGTH: 1000
};

// Robust version validation
function validateVersion(version) {
  if (!version || typeof version !== 'string') {
    throw new Error('Invalid version: must be a non-empty string');
  }
  
  const cleanVersion = version.replace(/^v/, '').trim();
  const versionRegex = /^\d+(\.\d+){0,3}(-[a-zA-Z0-9-]+)?$/;
  
  if (!versionRegex.test(cleanVersion)) {
    throw new Error(`Invalid version format: ${version}`);
  }
  
  return cleanVersion;
}

// Safe package.json reading with validation
function getSafeCurrentVersion() {
  try {
    const packagePath = path.join(__dirname, '../package.json');
    
    if (!fs.existsSync(packagePath)) {
      throw new Error('Package.json not found');
    }
    
    const packageContent = fs.readFileSync(packagePath, 'utf8');
    const packageData = JSON.parse(packageContent);
    
    if (!packageData.version) {
      throw new Error('Version not found in package.json');
    }
    
    return validateVersion(packageData.version);
  } catch (error) {
    logger.error('Error reading version from package.json:', error);
    // Fallback version to prevent crashes
    return '1.0.0';
  }
}

// Enhanced error classification
class UpdateError extends Error {
  constructor(message, type = 'UNKNOWN', retryable = false) {
    super(message);
    this.name = 'UpdateError';
    this.type = type;
    this.retryable = retryable;
  }
}

// Robust network request with retry logic
async function makeRobustRequest(url, options = {}) {
  if (!fetch) {
    throw new UpdateError('Network functionality not available', 'NO_FETCH', false);
  }

  const controller = AbortController ? new AbortController() : null;
  const timeoutId = controller ? setTimeout(() => controller.abort(), UPDATE_CONSTANTS.GITHUB_API_TIMEOUT) : null;

  const requestOptions = {
    ...options,
    signal: controller?.signal,
    headers: {
      'User-Agent': 'Clara-App-Updater',
      'Accept': 'application/vnd.github.v3+json',
      ...options.headers
    }
  };

  let lastError;
  
  for (let attempt = 1; attempt <= UPDATE_CONSTANTS.MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url, requestOptions);
      
      if (timeoutId) clearTimeout(timeoutId);
      
      // Handle rate limiting
      if (response.status === 403) {
        const rateLimitReset = response.headers.get('X-RateLimit-Reset');
        if (rateLimitReset) {
          const resetTime = new Date(parseInt(rateLimitReset) * 1000);
          const waitTime = Math.min(resetTime - Date.now(), UPDATE_CONSTANTS.RATE_LIMIT_DELAY);
          throw new UpdateError(
            `GitHub API rate limit exceeded. Try again in ${Math.ceil(waitTime / 1000)} seconds.`,
            'RATE_LIMIT',
            false
          );
        }
      }

      if (!response.ok) {
        throw new UpdateError(
          `GitHub API error: ${response.status} ${response.statusText}`,
          'API_ERROR',
          response.status >= 500 || response.status === 429
        );
      }

      return response;
    } catch (error) {
      lastError = error;
      
      if (timeoutId) clearTimeout(timeoutId);
      
      // Don't retry for non-retryable errors
      if (error instanceof UpdateError && !error.retryable) {
        throw error;
      }
      
      // Don't retry on the last attempt
      if (attempt === UPDATE_CONSTANTS.MAX_RETRIES) {
        break;
      }
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, UPDATE_CONSTANTS.RETRY_DELAY * attempt));
    }
  }

  throw lastError || new UpdateError('All retry attempts failed', 'NETWORK_ERROR', false);
}

// Validate GitHub release data structure
function validateReleaseData(release) {
  if (!release || typeof release !== 'object') {
    throw new UpdateError('Invalid release data structure', 'INVALID_DATA', false);
  }
  
  const requiredFields = ['tag_name', 'html_url', 'assets'];
  for (const field of requiredFields) {
    if (!release[field]) {
      throw new UpdateError(`Missing required field: ${field}`, 'INVALID_DATA', false);
    }
  }
  
  if (!Array.isArray(release.assets)) {
    throw new UpdateError('Release assets must be an array', 'INVALID_DATA', false);
  }
  
  return true;
}

// Platform-specific update service with comprehensive error handling
class PlatformUpdateService {
  constructor() {
    this.platform = process.platform;
    this.currentVersion = getSafeCurrentVersion();
    this.githubRepo = 'badboysm890/ClaraVerse';
    this.isChecking = false; // Prevent concurrent checks
  }

  /**
   * Check if OTA updates are supported for the current platform
   */
  isOTASupported() {
    // Only Mac supports OTA updates because it's signed
    return this.platform === 'darwin';
  }

  /**
   * Safe GitHub releases check with comprehensive validation
   */
  async checkGitHubReleases() {
    // Prevent concurrent update checks
    if (this.isChecking) {
      throw new UpdateError('Update check already in progress', 'CONCURRENT_CHECK', false);
    }

    this.isChecking = true;

    try {
      const url = `https://api.github.com/repos/${this.githubRepo}/releases/latest`;
      logger.info(`Checking for updates at: ${url}`);
      
      const response = await makeRobustRequest(url);
      const release = await response.json();
      
      // Validate release data structure
      validateReleaseData(release);
      
      const latestVersion = validateVersion(release.tag_name);
      const hasUpdate = this.isVersionNewer(latestVersion, this.currentVersion);
      
      const updateInfo = {
        hasUpdate,
        latestVersion,
        currentVersion: this.currentVersion,
        releaseUrl: release.html_url,
        downloadUrl: this.getDownloadUrlForPlatform(release.assets),
        releaseNotes: this.sanitizeReleaseNotes(release.body),
        publishedAt: release.published_at
      };
      
      logger.info('Update check completed successfully:', {
        hasUpdate,
        currentVersion: this.currentVersion,
        latestVersion
      });
      
      return updateInfo;
    } catch (error) {
      logger.error('Error checking GitHub releases:', error);
      
      if (error instanceof UpdateError) {
        throw error;
      }
      
      throw new UpdateError(
        `Failed to check for updates: ${error.message}`,
        'UNKNOWN_ERROR',
        true
      );
    } finally {
      this.isChecking = false;
    }
  }

  /**
   * Sanitize release notes to prevent XSS and limit length
   */
  sanitizeReleaseNotes(notes) {
    if (!notes || typeof notes !== 'string') {
      return 'No release notes available.';
    }
    
    // Basic sanitization - remove HTML tags and limit length
    const sanitized = notes
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/[<>&"']/g, '') // Remove potential XSS characters
      .trim();
    
    if (sanitized.length > UPDATE_CONSTANTS.MAX_RELEASE_NOTES_LENGTH) {
      return sanitized.substring(0, UPDATE_CONSTANTS.MAX_RELEASE_NOTES_LENGTH) + '...';
    }
    
    return sanitized || 'No release notes available.';
  }

  /**
   * Get the appropriate download URL for the current platform with validation
   */
  getDownloadUrlForPlatform(assets) {
    if (!Array.isArray(assets)) {
      logger.warn('Invalid assets array, using fallback URL');
      return `https://github.com/${this.githubRepo}/releases/latest`;
    }

    const platformExtensions = {
      darwin: ['.dmg', '-arm64.dmg', '-mac.dmg'],
      win32: ['.exe', '-win.exe', '-windows.exe'],
      linux: ['.AppImage', '.deb', '-linux.AppImage']
    };

    const extensions = platformExtensions[this.platform] || [];
    
    // Try to find platform-specific download
    for (const ext of extensions) {
      const asset = assets.find(asset => 
        asset && 
        asset.name && 
        typeof asset.name === 'string' && 
        asset.name.toLowerCase().endsWith(ext.toLowerCase()) &&
        asset.browser_download_url
      );
      
      if (asset) {
        logger.info(`Found platform-specific download: ${asset.name}`);
        return asset.browser_download_url;
      }
    }

    // Fallback to releases page
    logger.info('No platform-specific download found, using releases page');
    return `https://github.com/${this.githubRepo}/releases/latest`;
  }

  /**
   * Robust version comparison with detailed logging
   */
  isVersionNewer(newVersion, currentVersion) {
    try {
      const parseVersion = (version) => {
        return version.split('.').map(num => {
          const parsed = parseInt(num, 10);
          return isNaN(parsed) ? 0 : parsed;
        });
      };

      const newParts = parseVersion(newVersion);
      const currentParts = parseVersion(currentVersion);
      const maxLength = Math.max(newParts.length, currentParts.length);

      for (let i = 0; i < maxLength; i++) {
        const newPart = newParts[i] || 0;
        const currentPart = currentParts[i] || 0;

        if (newPart > currentPart) {
          logger.info(`Version ${newVersion} is newer than ${currentVersion}`);
          return true;
        }
        if (newPart < currentPart) {
          logger.info(`Version ${newVersion} is older than ${currentVersion}`);
          return false;
        }
      }

      logger.info(`Version ${newVersion} is same as ${currentVersion}`);
      return false;
    } catch (error) {
      logger.error('Error comparing versions:', error);
      return false; // Safe fallback
    }
  }

  /**
   * Show platform-specific update dialog with error handling
   */
  async showUpdateDialog(updateInfo) {
    try {
      const { hasUpdate, latestVersion, downloadUrl, releaseNotes } = updateInfo;

      if (!hasUpdate) {
        return await dialog.showMessageBox({
          type: 'info',
          title: 'No Updates Available',
          message: 'You are running the latest version of Clara.',
          detail: `Current version: ${this.currentVersion}`,
          buttons: ['OK'],
          defaultId: 0
        });
      }

      const truncatedNotes = releaseNotes && releaseNotes.length > 200 
        ? releaseNotes.substring(0, 200) + '...' 
        : releaseNotes;

      if (this.isOTASupported()) {
        // Mac: Show OTA update dialog
        return await dialog.showMessageBox({
          type: 'info',
          title: 'Update Available',
          message: `Clara ${latestVersion} is available`,
          detail: `You have ${this.currentVersion}. Would you like to download and install the update automatically?\n\n${truncatedNotes ? `What's new:\n${truncatedNotes}` : 'Click "View Release Notes" for details.'}`,
          buttons: ['Download & Install', 'View Release Notes', 'Later'],
          defaultId: 0,
          cancelId: 2
        }).then(({ response }) => {
          try {
            if (response === 0) {
              // Start OTA update
              autoUpdater.downloadUpdate();
              return { action: 'download' };
            } else if (response === 1) {
              // Open release notes
              shell.openExternal(updateInfo.releaseUrl);
              return { action: 'view_notes' };
            }
            return { action: 'later' };
          } catch (error) {
            logger.error('Error handling dialog response:', error);
            return { action: 'error', error: error.message };
          }
        });
      } else {
        // Windows/Linux: Show manual update dialog
        const platformName = this.platform === 'win32' ? 'Windows' : 'Linux';
        
        return await dialog.showMessageBox({
          type: 'info',
          title: 'Update Available',
          message: `Clara ${latestVersion} is available`,
          detail: `You have ${this.currentVersion}. A new version is available for download.\n\nOn ${platformName}, updates need to be installed manually for security reasons.\n\n${truncatedNotes ? `What's new:\n${truncatedNotes}` : 'Click "View Release Notes" for details.'}`,
          buttons: ['Download Now', 'View Release Notes', 'Later'],
          defaultId: 0,
          cancelId: 2
        }).then(({ response }) => {
          try {
            if (response === 0) {
              // Open download page
              shell.openExternal(downloadUrl);
              return { action: 'download' };
            } else if (response === 1) {
              // Open release notes
              shell.openExternal(updateInfo.releaseUrl);
              return { action: 'view_notes' };
            }
            return { action: 'later' };
          } catch (error) {
            logger.error('Error handling dialog response:', error);
            return { action: 'error', error: error.message };
          }
        });
      }
    } catch (error) {
      logger.error('Error showing update dialog:', error);
      
      // Show fallback error dialog
      try {
        await dialog.showErrorBox(
          'Update Dialog Error',
          `Failed to show update information: ${error.message}`
        );
      } catch (dialogError) {
        logger.error('Failed to show error dialog:', dialogError);
      }
      
      return { action: 'error', error: error.message };
    }
  }
}

// Global instance with error protection
let platformUpdateService;
try {
  platformUpdateService = new PlatformUpdateService();
} catch (error) {
  logger.error('Failed to initialize update service:', error);
  platformUpdateService = null;
}

// Enhanced auto-updater setup with comprehensive error handling
function setupAutoUpdater(mainWindow) {
  if (!platformUpdateService || !platformUpdateService.isOTASupported()) {
    logger.info('OTA updates not supported on this platform');
    return;
  }

  try {
    // Check for updates when the app starts (Mac only)
    autoUpdater.checkForUpdatesAndNotify().catch(error => {
      logger.error('Initial update check failed:', error);
    });

    // Check for updates every hour (Mac only) with error handling
    setInterval(() => {
      autoUpdater.checkForUpdatesAndNotify().catch(error => {
        logger.error('Periodic update check failed:', error);
      });
    }, 60 * 60 * 1000);

    // Update available
    autoUpdater.on('update-available', (info) => {
      try {
        dialog.showMessageBox({
          type: 'info',
          title: 'Update Available',
          message: `A new version (${info.version}) is available. Would you like to download and update now?`,
          buttons: ['Update', 'Later'],
          defaultId: 0,
          cancelId: 1
        }).then(({ response }) => {
          if (response === 0) {
            autoUpdater.downloadUpdate().catch(error => {
              logger.error('Download update failed:', error);
              dialog.showErrorBox('Download Failed', `Failed to download update: ${error.message}`);
            });
          }
        }).catch(error => {
          logger.error('Error showing update available dialog:', error);
        });
      } catch (error) {
        logger.error('Error in update-available handler:', error);
      }
    });

    // Update downloaded
    autoUpdater.on('update-downloaded', () => {
      try {
        dialog.showMessageBox({
          type: 'info',
          title: 'Update Ready',
          message: 'The update has been downloaded. The application will restart to apply the update.',
          buttons: ['Restart Now'],
          defaultId: 0
        }).then(() => {
          try {
            autoUpdater.quitAndInstall();
          } catch (error) {
            logger.error('Error during quit and install:', error);
            dialog.showErrorBox('Installation Failed', `Failed to install update: ${error.message}`);
          }
        }).catch(error => {
          logger.error('Error showing update downloaded dialog:', error);
        });
      } catch (error) {
        logger.error('Error in update-downloaded handler:', error);
      }
    });

    // Enhanced error handling
    autoUpdater.on('error', (err) => {
      logger.error('Auto-updater error:', err);
      
      try {
        // Fallback to GitHub-based updates on error
        dialog.showErrorBox('Update Error', 
          `Automatic update failed: ${err.message}\n\nYou can manually download the latest version from GitHub.`
        );
      } catch (dialogError) {
        logger.error('Failed to show error dialog:', dialogError);
      }
    });

    // Progress updates with error handling
    autoUpdater.on('download-progress', (progressObj) => {
      try {
        if (mainWindow && mainWindow.webContents) {
          mainWindow.webContents.send('update-progress', progressObj);
        }
      } catch (error) {
        logger.error('Error sending progress update:', error);
      }
    });

    // No update available
    autoUpdater.on('update-not-available', (info, isManualCheck) => {
      try {
        if (isManualCheck) {
          dialog.showMessageBox({
            type: 'info',
            title: 'No Updates Available',
            message: 'You are running the latest version of Clara.',
            buttons: ['OK'],
            defaultId: 0
          }).catch(error => {
            logger.error('Error showing no update dialog:', error);
          });
        }
      } catch (error) {
        logger.error('Error in update-not-available handler:', error);
      }
    });

    logger.info('Auto-updater setup completed successfully');
  } catch (error) {
    logger.error('Failed to setup auto-updater:', error);
  }
}

// Universal update check with comprehensive error handling
async function checkForUpdates() {
  if (!platformUpdateService) {
    const error = 'Update service not available';
    logger.error(error);
    try {
      dialog.showErrorBox('Update Service Error', error);
    } catch (dialogError) {
      logger.error('Failed to show error dialog:', dialogError);
    }
    return;
  }

  try {
    if (platformUpdateService.isOTASupported()) {
      // Mac: Use electron-updater first, fallback to GitHub
      try {
        return await autoUpdater.checkForUpdates();
      } catch (error) {
        logger.warn('OTA update check failed, falling back to GitHub:', error);
        const updateInfo = await platformUpdateService.checkGitHubReleases();
        return await platformUpdateService.showUpdateDialog(updateInfo);
      }
    } else {
      // Windows/Linux: Use GitHub releases
      const updateInfo = await platformUpdateService.checkGitHubReleases();
      return await platformUpdateService.showUpdateDialog(updateInfo);
    }
  } catch (error) {
    logger.error('Error checking for updates:', error);
    
    let userMessage = 'Could not check for updates. Please check your internet connection and try again.';
    
    if (error instanceof UpdateError) {
      switch (error.type) {
        case 'RATE_LIMIT':
          userMessage = error.message;
          break;
        case 'NO_FETCH':
          userMessage = 'Network functionality is not available. Please restart the application.';
          break;
        case 'CONCURRENT_CHECK':
          userMessage = 'Update check is already in progress. Please wait.';
          break;
        default:
          userMessage = `Update check failed: ${error.message}`;
      }
    }
    
    try {
      dialog.showErrorBox('Update Check Failed', userMessage);
    } catch (dialogError) {
      logger.error('Failed to show error dialog:', dialogError);
    }
  }
}

// Safe update info retrieval for UI
async function getUpdateInfo() {
  if (!platformUpdateService) {
    return {
      hasUpdate: false,
      error: 'Update service not available',
      platform: process.platform,
      isOTASupported: false,
      currentVersion: getSafeCurrentVersion()
    };
  }

  try {
    const updateInfo = await platformUpdateService.checkGitHubReleases();
    return {
      ...updateInfo,
      platform: platformUpdateService.platform,
      isOTASupported: platformUpdateService.isOTASupported()
    };
  } catch (error) {
    logger.error('Error getting update info:', error);
    
    let errorMessage = 'Failed to check for updates';
    
    if (error instanceof UpdateError) {
      errorMessage = error.message;
    } else {
      errorMessage = error.message || 'Unknown error occurred';
    }
    
    return {
      hasUpdate: false,
      error: errorMessage,
      platform: platformUpdateService.platform,
      isOTASupported: platformUpdateService.isOTASupported(),
      currentVersion: platformUpdateService.currentVersion
    };
  }
}

module.exports = { 
  setupAutoUpdater, 
  checkForUpdates, 
  getUpdateInfo,
  platformUpdateService 
};