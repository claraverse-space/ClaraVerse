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

// Llama.cpp Binary Update Service
class LlamacppUpdateService {
  constructor() {
    this.platform = process.platform;
    this.arch = process.arch;
    this.githubRepo = 'ggerganov/llama.cpp';
    this.isUpdating = false;
    this.binariesPath = this.getBinariesPath();
  }

  getBinariesPath() {
    const path = require('path');
    const { app } = require('electron');
    
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    if (isDevelopment) {
      return path.join(__dirname, 'llamacpp-binaries');
    } else {
      // Production paths
      const possiblePaths = [
        path.join(process.resourcesPath, 'electron', 'llamacpp-binaries'),
        path.join(app.getAppPath(), 'electron', 'llamacpp-binaries'),
        path.join(__dirname, 'llamacpp-binaries')
      ];
      
      for (const possiblePath of possiblePaths) {
        if (require('fs').existsSync(possiblePath)) {
          return possiblePath;
        }
      }
      
      return path.join(app.getPath('userData'), 'llamacpp-binaries');
    }
  }

  getCurrentVersion() {
    const path = require('path');
    const fs = require('fs');
    
    try {
      const versionFile = path.join(this.binariesPath, 'version.txt');
      if (fs.existsSync(versionFile)) {
        return fs.readFileSync(versionFile, 'utf8').trim();
      }
    } catch (error) {
      logger.warn('Could not read current llama.cpp version:', error);
    }
    
    return 'Unknown';
  }

  getPlatformInfo() {
    switch (this.platform) {
      case 'darwin':
        return {
          platform: 'darwin',
          arch: this.arch === 'arm64' ? 'arm64' : 'x64',
          platformDir: this.arch === 'arm64' ? 'darwin-arm64' : 'darwin-x64',
          assetPattern: this.arch === 'arm64' ? 'llama-.*-bin-macos-arm64.zip' : 'llama-.*-bin-macos-x64.zip'
        };
      case 'linux':
        return {
          platform: 'linux',
          arch: 'x64',
          platformDir: 'linux-x64',
          assetPattern: 'llama-.*-bin-ubuntu-x64.zip'
        };
      case 'win32':
        return {
          platform: 'win32',
          arch: 'x64',
          platformDir: 'win32-x64',
          assetPattern: 'llama-.*-bin-win-.*-x64.zip'
        };
      default:
        throw new Error(`Unsupported platform: ${this.platform}-${this.arch}`);
    }
  }

  async checkForUpdates() {
    if (!fetch) {
      throw new UpdateError('Network functionality not available', 'NO_FETCH', false);
    }

    try {
      const response = await makeRobustRequest(`https://api.github.com/repos/${this.githubRepo}/releases/latest`);
      const release = await response.json();
      
      validateReleaseData(release);
      
      const currentVersion = this.getCurrentVersion();
      const latestVersion = release.tag_name;
      const hasUpdate = currentVersion === 'Unknown' || currentVersion !== latestVersion;
      
      const platformInfo = this.getPlatformInfo();
      const matchingAsset = release.assets.find(asset => 
        new RegExp(platformInfo.assetPattern, 'i').test(asset.name)
      );
      
      return {
        hasUpdate,
        currentVersion,
        latestVersion,
        platform: this.platform,
        downloadSize: matchingAsset ? this.formatFileSize(matchingAsset.size) : 'Unknown size',
        releaseUrl: release.html_url,
        downloadUrl: matchingAsset?.browser_download_url,
        publishedAt: release.published_at,
        error: matchingAsset ? null : `No compatible binary found for ${this.platform}-${this.arch}`
      };
    } catch (error) {
      logger.error('Error checking for llama.cpp updates:', error);
      throw error;
    }
  }

  async updateBinaries() {
    if (this.isUpdating) {
      throw new Error('Binary update already in progress');
    }

    this.isUpdating = true;

    try {
      const updateInfo = await this.checkForUpdates();
      
      if (!updateInfo.hasUpdate) {
        return { success: true, message: 'Binaries are already up to date' };
      }

      if (!updateInfo.downloadUrl) {
        throw new Error(updateInfo.error || 'No download URL available');
      }

      const result = await this.downloadAndInstallBinaries(updateInfo);
      return result;
    } catch (error) {
      logger.error('Error updating llama.cpp binaries:', error);
      return { 
        success: false, 
        error: error.message || 'Failed to update binaries' 
      };
    } finally {
      this.isUpdating = false;
    }
  }

  async downloadAndInstallBinaries(updateInfo) {
    const path = require('path');
    const fs = require('fs').promises;
    const fsSync = require('fs');
    
    // Robust require for adm-zip with fallback
    let AdmZip;
    try {
      AdmZip = require('adm-zip');
    } catch (requireError) {
      // Try alternative require paths
      try {
        const mainPath = require.resolve('adm-zip', { paths: [process.cwd(), __dirname, path.join(__dirname, '..', 'node_modules')] });
        AdmZip = require(mainPath);
      } catch (fallbackError) {
        // If adm-zip is not available, try using built-in modules for Windows
        if (this.platform === 'win32') {
          return await this.downloadAndInstallBinariesWindows(updateInfo);
        }
        throw new Error(`Cannot find 'adm-zip' module. Please install it: npm install adm-zip. Error: ${requireError.message}`);
      }
    }
    
    try {
      logger.info(`Downloading llama.cpp binaries from: ${updateInfo.downloadUrl}`);
      
      // Download the zip file
      const response = await makeRobustRequest(updateInfo.downloadUrl);
      const buffer = Buffer.from(await response.arrayBuffer());
      
      // Create temporary file
      const tempDir = path.join(require('os').tmpdir(), 'clara-llamacpp-update');
      await fs.mkdir(tempDir, { recursive: true });
      const tempZipPath = path.join(tempDir, 'llamacpp-binaries.zip');
      
      await fs.writeFile(tempZipPath, buffer);
      logger.info(`Downloaded binaries to: ${tempZipPath}`);
      
      // Extract zip file
      const zip = new AdmZip(tempZipPath);
      const extractDir = path.join(tempDir, 'extracted');
      zip.extractAllTo(extractDir, true);
      
      // ===== STOP ALL SERVICES BEFORE UPDATING =====
      logger.info('🛑 Stopping all services before binary update...');
      const servicesWereStopped = await this.stopAllServicesForUpdate();
      
      try {
        // Find the platform directory to update
        const platformInfo = this.getPlatformInfo();
        const targetPlatformDir = path.join(this.binariesPath, platformInfo.platformDir);
        
        // Backup current official llama.cpp files only (preserving Clara's custom files)
        const backupDir = path.join(this.binariesPath, `${platformInfo.platformDir}-backup-${Date.now()}`);
        if (fsSync.existsSync(targetPlatformDir)) {
          await fs.mkdir(backupDir, { recursive: true });
          
          // Only backup official llama.cpp files, leave Clara's custom files alone
          const files = await fs.readdir(targetPlatformDir);
          for (const file of files) {
            // Only backup official llama.cpp files (not Clara's custom binaries)
            if (this.isOfficialLlamacppFile(file)) {
              const sourcePath = path.join(targetPlatformDir, file);
              const backupPath = path.join(backupDir, file);
              
              if (fsSync.existsSync(sourcePath)) {
                await fs.copyFile(sourcePath, backupPath);
                logger.info(`Backed up ${file} to backup directory`);
              }
            }
          }
        }
        
        // Ensure target directory exists
        await fs.mkdir(targetPlatformDir, { recursive: true });
        
        // Find and copy official llama.cpp files from extracted files
        const extractedFiles = await this.findOfficialFilesInExtracted(extractDir);
        
        if (extractedFiles.length === 0) {
          throw new Error('No official llama.cpp files found in the downloaded archive');
        }
        
        for (const [sourceFile, targetName] of extractedFiles) {
          const targetPath = path.join(targetPlatformDir, targetName);
          await fs.copyFile(sourceFile, targetPath);
          
          // Make executable for binary files on Unix systems
          if (this.platform !== 'win32' && this.isExecutableFile(targetName)) {
            await fs.chmod(targetPath, 0o755);
          }
          
          logger.info(`Installed official file: ${targetName}`);
        }
        
        // Save version info
        const versionFile = path.join(this.binariesPath, 'version.txt');
        await fs.writeFile(versionFile, updateInfo.latestVersion);
        
        // Validate the installation by testing the main binary
        await this.validateInstallation(targetPlatformDir);
        
        logger.info(`Successfully updated llama.cpp binaries and libraries to version ${updateInfo.latestVersion}`);
        logger.info(`Clara's custom binaries (like llama-swap) were preserved and not modified`);
        
      } finally {
        // ===== RESTART SERVICES AFTER UPDATE =====
        if (servicesWereStopped) {
          logger.info('🔄 Restarting services after binary update...');
          await this.restartAllServicesAfterUpdate();
        }
      }
      
      // Cleanup
      await fs.rm(tempDir, { recursive: true, force: true });
      
      return { 
        success: true, 
        message: `Successfully updated llama.cpp binaries and libraries to version ${updateInfo.latestVersion}. Clara's custom binaries were preserved. Services have been restarted.`,
        version: updateInfo.latestVersion
      };
      
    } catch (error) {
      logger.error('Error during binary installation:', error);
      throw new Error(`Installation failed: ${error.message}`);
    }
  }

  // Windows-specific binary update using built-in modules if adm-zip fails
  async downloadAndInstallBinariesWindows(updateInfo) {
    const path = require('path');
    const fs = require('fs').promises;
    const fsSync = require('fs');
    const { spawn } = require('child_process');
    
    try {
      logger.info(`Downloading llama.cpp binaries for Windows from: ${updateInfo.downloadUrl}`);
      
      // Download the zip file
      const response = await makeRobustRequest(updateInfo.downloadUrl);
      const buffer = Buffer.from(await response.arrayBuffer());
      
      // Create temporary file
      const tempDir = path.join(require('os').tmpdir(), 'clara-llamacpp-update');
      await fs.mkdir(tempDir, { recursive: true });
      const tempZipPath = path.join(tempDir, 'llamacpp-binaries.zip');
      
      await fs.writeFile(tempZipPath, buffer);
      logger.info(`Downloaded binaries to: ${tempZipPath}`);
      
      // Use Windows built-in extract if available, or try PowerShell
      const extractDir = path.join(tempDir, 'extracted');
      await fs.mkdir(extractDir, { recursive: true });
      
      // Try PowerShell extraction first
      const success = await this.extractWithPowerShell(tempZipPath, extractDir);
      
      if (!success) {
        // Fallback to manual extraction
        throw new Error('Could not extract zip file. Please ensure adm-zip package is properly installed.');
      }
      
      // ===== STOP ALL SERVICES BEFORE UPDATING =====
      logger.info('🛑 Stopping all services before binary update (Windows fallback)...');
      const servicesWereStopped = await this.stopAllServicesForUpdate();
      
      try {
        // Continue with the same logic as the main function
        const platformInfo = this.getPlatformInfo();
        const targetPlatformDir = path.join(this.binariesPath, platformInfo.platformDir);
        
        // Backup current official llama.cpp files only (preserving Clara's custom files)
        const backupDir = path.join(this.binariesPath, `${platformInfo.platformDir}-backup-${Date.now()}`);
        if (fsSync.existsSync(targetPlatformDir)) {
          await fs.mkdir(backupDir, { recursive: true });
          
          // Only backup official llama.cpp files, leave Clara's custom files alone
          const files = await fs.readdir(targetPlatformDir);
          for (const file of files) {
            if (this.isOfficialLlamacppFile(file)) {
              const sourcePath = path.join(targetPlatformDir, file);
              const backupPath = path.join(backupDir, file);
              
              if (fsSync.existsSync(sourcePath)) {
                await fs.copyFile(sourcePath, backupPath);
                logger.info(`Backed up ${file} to backup directory`);
              }
            }
          }
        }
        
        // Ensure target directory exists
        await fs.mkdir(targetPlatformDir, { recursive: true });
        
        // Find and copy official llama.cpp files from extracted files
        const extractedFiles = await this.findOfficialFilesInExtracted(extractDir);
        
        if (extractedFiles.length === 0) {
          throw new Error('No official llama.cpp files found in the downloaded archive');
        }
        
        for (const [sourceFile, targetName] of extractedFiles) {
          const targetPath = path.join(targetPlatformDir, targetName);
          await fs.copyFile(sourceFile, targetPath);
          logger.info(`Installed official file: ${targetName}`);
        }
        
        // Save version info
        const versionFile = path.join(this.binariesPath, 'version.txt');
        await fs.writeFile(versionFile, updateInfo.latestVersion);
        
        // Validate the installation
        await this.validateInstallation(targetPlatformDir);
        
        logger.info(`Successfully updated llama.cpp binaries and libraries to version ${updateInfo.latestVersion} (Windows fallback method)`);
        
      } finally {
        // ===== RESTART SERVICES AFTER UPDATE =====
        if (servicesWereStopped) {
          logger.info('🔄 Restarting services after binary update (Windows fallback)...');
          await this.restartAllServicesAfterUpdate();
        }
      }
      
      // Cleanup
      await fs.rm(tempDir, { recursive: true, force: true });
      
      return { 
        success: true, 
        message: `Successfully updated llama.cpp binaries and libraries to version ${updateInfo.latestVersion}. Clara's custom binaries were preserved. Services have been restarted.`,
        version: updateInfo.latestVersion
      };
      
    } catch (error) {
      logger.error('Error during Windows binary installation:', error);
      throw new Error(`Windows installation failed: ${error.message}`);
    }
  }

  // Extract zip using PowerShell on Windows
  async extractWithPowerShell(zipPath, extractPath) {
    return new Promise((resolve) => {
      const powerShellCommand = `
        try {
          Add-Type -AssemblyName System.IO.Compression.FileSystem
          [System.IO.Compression.ZipFile]::ExtractToDirectory('${zipPath}', '${extractPath}')
          Write-Output "SUCCESS"
        } catch {
          Write-Output "ERROR: $($_.Exception.Message)"
          exit 1
        }
      `;
      
      const powerShell = spawn('powershell', [
        '-Command', powerShellCommand
      ], {
        stdio: ['ignore', 'pipe', 'pipe']
      });
      
      let output = '';
      let errorOutput = '';
      
      powerShell.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      powerShell.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });
      
      powerShell.on('close', (code) => {
        if (code === 0 && output.includes('SUCCESS')) {
          logger.info('Successfully extracted using PowerShell');
          resolve(true);
        } else {
          logger.warn('PowerShell extraction failed:', errorOutput || output);
          resolve(false);
        }
      });
      
      powerShell.on('error', (error) => {
        logger.warn('PowerShell extraction error:', error.message);
        resolve(false);
      });
    });
  }

  // Stop all services that might be using llama.cpp binaries
  async stopAllServicesForUpdate() {
    const stoppedServices = [];
    
    try {
      // Get IPC access to communicate with main process
      const { ipcMain } = require('electron');
      
      // Try to stop llama swap service
      try {
        logger.info('Stopping LlamaSwap service...');
        const llamaSwapService = require('./llamaSwapService.cjs');
        if (llamaSwapService && typeof llamaSwapService.stop === 'function') {
          await llamaSwapService.stop();
          stoppedServices.push('llamaSwap');
          logger.info('✅ LlamaSwap service stopped');
        }
      } catch (error) {
        logger.warn('Could not stop LlamaSwap service:', error.message);
      }
      
      // Try to stop any Python backend services
      try {
        logger.info('Stopping Python backend services...');
        // Send signal to main process to stop Python services
        const { BrowserWindow } = require('electron');
        const mainWindow = BrowserWindow.getAllWindows()[0];
        if (mainWindow && mainWindow.webContents) {
          mainWindow.webContents.send('stop-python-services');
          stoppedServices.push('python');
          logger.info('✅ Python backend services stop signal sent');
        }
      } catch (error) {
        logger.warn('Could not stop Python services:', error.message);
      }
      
      // Try to stop any model server processes
      try {
        logger.info('Stopping model server processes...');
        
        // Kill any llama-server processes that might be running
        if (this.platform === 'win32') {
          const { spawn } = require('child_process');
          
          // Try to gracefully stop llama-server processes
          const taskkill = spawn('taskkill', ['/F', '/IM', 'llama-server.exe'], { 
            stdio: 'ignore',
            windowsHide: true 
          });
          
          await new Promise((resolve) => {
            taskkill.on('close', () => resolve());
            setTimeout(resolve, 3000); // Don't wait forever
          });
          
          stoppedServices.push('llama-server');
          logger.info('✅ Windows llama-server processes stopped');
        } else {
          // Unix-like systems
          const { spawn } = require('child_process');
          
          const pkill = spawn('pkill', ['-f', 'llama-server'], { 
            stdio: 'ignore' 
          });
          
          await new Promise((resolve) => {
            pkill.on('close', () => resolve());
            setTimeout(resolve, 3000); // Don't wait forever
          });
          
          stoppedServices.push('llama-server');
          logger.info('✅ Unix llama-server processes stopped');
        }
      } catch (error) {
        logger.warn('Could not stop model server processes:', error.message);
      }
      
      // Wait a bit for processes to fully release file handles
      logger.info('⏳ Waiting for processes to release file handles...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      logger.info(`🛑 Stopped services: ${stoppedServices.join(', ')}`);
      return stoppedServices.length > 0;
      
    } catch (error) {
      logger.error('Error stopping services:', error);
      return false;
    }
  }

  // Restart services after update
  async restartAllServicesAfterUpdate() {
    try {
      // Wait a moment for the system to settle
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Repair binary paths after update
      try {
        logger.info('🔧 Repairing binary paths after update...');
        const LlamaSwapService = require('./llamaSwapService.cjs');
        await LlamaSwapService.repairBinariesAfterUpdate();
        logger.info('✅ Binary paths repaired after update');
      } catch (repairError) {
        logger.warn('Binary repair failed, but continuing with restart:', repairError.message);
      }
      
      // Restart LlamaSwap service
      try {
        logger.info('Restarting LlamaSwap service...');
        const llamaSwapService = require('./llamaSwapService.cjs');
        if (llamaSwapService && typeof llamaSwapService.restart === 'function') {
          await llamaSwapService.restart();
          logger.info('✅ LlamaSwap service restarted');
        }
      } catch (error) {
        logger.warn('Could not restart LlamaSwap service:', error.message);
      }
      
      // Send signal to restart Python services
      try {
        logger.info('Restarting Python backend services...');
        const { BrowserWindow } = require('electron');
        const mainWindow = BrowserWindow.getAllWindows()[0];
        if (mainWindow && mainWindow.webContents) {
          mainWindow.webContents.send('restart-python-services');
          logger.info('✅ Python backend services restart signal sent');
        }
      } catch (error) {
        logger.warn('Could not restart Python services:', error.message);
      }
      
      // The services will automatically start when needed, so we don't need to explicitly start model servers
      logger.info('🔄 Service restart completed');
      
    } catch (error) {
      logger.error('Error restarting services:', error);
    }
  }

  // Check if a file is an official llama.cpp file (binaries, libraries, headers, etc.)
  isOfficialLlamacppFile(fileName) {
    const officialBinaries = [
      'llama-server',
      'llama-server.exe',
      'llama-cli',
      'llama-cli.exe',
      'llama-quantize',
      'llama-quantize.exe',
      'llama-perplexity',
      'llama-perplexity.exe',
      'llama-embedding',
      'llama-embedding.exe',
      'llama-bench',
      'llama-bench.exe',
      'llama-eval',
      'llama-eval.exe',
      'llama-export-lora',
      'llama-export-lora.exe',
      'llama-finetune',
      'llama-finetune.exe',
      'llama-convert-hf',
      'llama-convert-hf.exe'
    ];
    
    // Official supporting libraries and files
    const officialLibraries = [
      // Dynamic libraries
      'libllama.dylib',
      'libggml.dylib',
      'libggml-metal.dylib',
      'libggml-cpu.dylib',
      'libggml-base.dylib',
      'libggml-blas.dylib',
      'libggml-rpc.dylib',
      'libmtmd.dylib',
      'libmtmd_shared.dylib',
      // Windows DLLs
      'llama.dll',
      'ggml.dll',
      'ggml-metal.dll',
      'ggml-cpu.dll',
      'ggml-base.dll',
      'ggml-blas.dll',
      'ggml-rpc.dll',
      // Linux shared objects
      'libllama.so',
      'libggml.so',
      'libggml-metal.so',
      'libggml-cpu.so',
      'libggml-base.so',
      'libggml-blas.so',
      'libggml-rpc.so',
      // Metal shaders and headers
      'ggml-metal.metal',
      'ggml-common.h',
      'ggml-metal-impl.h'
    ];
    
    // Exclude Clara's custom binaries
    const claraCustomBinaries = [
      'llama-swap',
      'llama-swap.exe',
      'llama-swap-darwin',
      'llama-swap-darwin-arm64',
      'llama-swap-linux',
      'llama-swap-win32-x64.exe'
    ];
    
    // Don't touch Clara's custom binaries
    if (claraCustomBinaries.some(custom => fileName.includes(custom))) {
      return false;
    }
    
    // Check if it's an official binary
    if (officialBinaries.some(official => fileName === official || fileName.includes(official.replace('.exe', '')))) {
      return true;
    }
    
    // Check if it's an official library or supporting file
    if (officialLibraries.some(lib => fileName === lib || fileName.includes(lib.replace(/\.(dylib|dll|so)$/, '')))) {
      return true;
    }
    
    return false;
  }

  // Check if a file should be made executable
  isExecutableFile(fileName) {
    const executableExtensions = ['', '.exe']; // No extension on Unix, .exe on Windows
    const binaryNames = [
      'llama-server',
      'llama-cli', 
      'llama-quantize',
      'llama-perplexity',
      'llama-embedding',
      'llama-bench',
      'llama-eval',
      'llama-export-lora',
      'llama-finetune',
      'llama-convert-hf'
    ];
    
    return binaryNames.some(name => 
      fileName === name || 
      fileName === `${name}.exe` ||
      fileName.startsWith(`${name}-`) // Handle versioned binaries
    );
  }

  async findOfficialFilesInExtracted(extractDir) {
    const path = require('path');
    const fs = require('fs').promises;
    
    const filesMap = [];
    
    // All files we want to update - more comprehensive mapping
    const targetFiles = [
      // Main binaries
      ...(this.platform === 'win32' 
        ? ['llama-server.exe', 'llama-cli.exe', 'llama-quantize.exe', 'llama-perplexity.exe', 'llama-bench.exe']
        : ['llama-server', 'llama-cli', 'llama-quantize', 'llama-perplexity', 'llama-bench']),
      
      // Core libraries - ensure we get all variants
      ...(this.platform === 'darwin' 
        ? ['libllama.dylib', 'libggml.dylib', 'libggml-metal.dylib', 'libggml-cpu.dylib', 
           'libggml-base.dylib', 'libggml-blas.dylib', 'libggml-rpc.dylib', 'libmtmd.dylib', 'libmtmd_shared.dylib']
        : this.platform === 'win32'
        ? [
            // Essential core libraries
            'llama.dll', 'ggml.dll',
            // GPU acceleration libraries  
            'ggml-cuda.dll', 'ggml-metal.dll',
            // CPU optimization libraries
            'ggml-cpu.dll', 'ggml-base.dll', 'ggml-cpu-alderlake.dll', 'ggml-cpu-haswell.dll',
            'ggml-cpu-icelake.dll', 'ggml-cpu-sandybridge.dll', 'ggml-cpu-sapphirerapids.dll',
            'ggml-cpu-skylakex.dll', 'ggml-cpu-sse42.dll', 'ggml-cpu-x64.dll',
            // Communication and other libraries
            'ggml-rpc.dll', 'ggml-blas.dll'
          ]
        : ['libllama.so', 'libggml.so', 'libggml-metal.so', 'libggml-cpu.so', 'libggml-base.so', 'libggml-blas.so', 'libggml-rpc.so']),
      
      // Common supporting files
      'ggml-metal.metal',
      'ggml-common.h',
      'ggml-metal-impl.h'
    ];
    
    // Required core files that must be present for a valid update
    const requiredFiles = this.platform === 'win32' 
      ? ['llama-server.exe', 'llama.dll', 'ggml.dll']
      : this.platform === 'darwin'
      ? ['llama-server', 'libllama.dylib', 'libggml.dylib']
      : ['llama-server', 'libllama.so', 'libggml.so'];
    
    async function searchDirectory(dir) {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          await searchDirectory(fullPath);
        } else if (entry.isFile()) {
          // Check if this file matches one of our target files
          for (const targetFile of targetFiles) {
            // Direct name match (preferred)
            if (entry.name === targetFile) {
              filesMap.push([fullPath, targetFile]);
              break;
            }
            
            // Pattern-based matching for more flexible detection
            const baseName = targetFile.replace(/\.(exe|dylib|dll|so)$/, '');
            
            // Handle versioned or prefix-modified binaries
            if ((entry.name.includes(baseName) && !entry.name.includes('swap')) ||
                (targetFile.includes('ggml') && entry.name.includes('ggml') && 
                 entry.name.replace(/\.(dll|dylib|so)$/, '') === baseName)) {
              
              // Double-check we don't have this target file already mapped
              const alreadyMapped = filesMap.some(([, mappedTarget]) => mappedTarget === targetFile);
              if (!alreadyMapped) {
                filesMap.push([fullPath, targetFile]);
                break;
              }
            }
          }
        }
      }
    }
    
    await searchDirectory(extractDir);
    
    // Validate that we have the essential files for a complete update
    const foundFiles = filesMap.map(([, targetName]) => targetName);
    const missingRequired = requiredFiles.filter(required => !foundFiles.includes(required));
    
    if (missingRequired.length > 0) {
      logger.warn(`Missing required files for complete update: ${missingRequired.join(', ')}`);
      logger.warn(`Found files: ${foundFiles.join(', ')}`);
      logger.warn('This might cause compatibility issues. Skipping update.');
      throw new Error(`Incomplete update package: missing required files ${missingRequired.join(', ')}`);
    }
    
    // Enhanced validation: ensure we have at least the minimum set of libraries
    const essentialLibs = this.platform === 'win32' 
      ? ['ggml.dll', 'llama.dll']
      : this.platform === 'darwin'
      ? ['libggml.dylib', 'libllama.dylib']  
      : ['libggml.so', 'libllama.so'];
    
    const missingEssential = essentialLibs.filter(lib => !foundFiles.includes(lib));
    if (missingEssential.length > 0) {
      throw new Error(`Critical libraries missing from update: ${missingEssential.join(', ')}`);
    }
    
    logger.info(`Found ${filesMap.length} official files for update: ${foundFiles.slice(0, 10).join(', ')}${foundFiles.length > 10 ? '...' : ''}`);
    
    return filesMap;
  }

  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  async validateInstallation(targetPlatformDir) {
    const path = require('path');
    const fs = require('fs').promises;
    const fsSync = require('fs');
    
    try {
      // Check that the main binary exists and is executable
      const mainBinaryPath = path.join(targetPlatformDir, this.platform === 'win32' ? 'llama-server.exe' : 'llama-server');
      
      if (!fsSync.existsSync(mainBinaryPath)) {
        throw new Error(`Main binary not found: ${mainBinaryPath}`);
      }
      
      // Check that required libraries exist
      const requiredLibs = this.platform === 'darwin' 
        ? ['libllama.dylib']
        : this.platform === 'win32'
        ? ['llama.dll']
        : ['libllama.so'];
      
      for (const lib of requiredLibs) {
        const libPath = path.join(targetPlatformDir, lib);
        if (!fsSync.existsSync(libPath)) {
          throw new Error(`Required library not found: ${libPath}`);
        }
      }
      
      logger.info('Installation validation completed successfully');
    } catch (error) {
      logger.error('Installation validation failed:', error);
      throw new Error(`Installation validation failed: ${error.message}`);
    }
  }
}

// Create llama.cpp update service instance
const llamacppUpdateService = new LlamacppUpdateService();

// Safe llama.cpp update check for UI
async function checkLlamacppUpdates() {
  try {
    return await llamacppUpdateService.checkForUpdates();
  } catch (error) {
    logger.error('Error checking llama.cpp updates:', error);
    
    let errorMessage = 'Failed to check for llama.cpp updates';
    
    if (error instanceof UpdateError) {
      errorMessage = error.message;
    } else {
      errorMessage = error.message || 'Unknown error occurred';
    }
    
    return {
      hasUpdate: false,
      error: errorMessage,
      platform: llamacppUpdateService.platform,
      currentVersion: llamacppUpdateService.getCurrentVersion()
    };
  }
}

// Safe llama.cpp binary update
async function updateLlamacppBinaries() {
  try {
    return await llamacppUpdateService.updateBinaries();
  } catch (error) {
    logger.error('Error updating llama.cpp binaries:', error);
    return {
      success: false,
      error: error.message || 'Failed to update binaries'
    };
  }
}

module.exports = { 
  setupAutoUpdater, 
  checkForUpdates, 
  getUpdateInfo,
  checkLlamacppUpdates,
  updateLlamacppBinaries,
  platformUpdateService 
};