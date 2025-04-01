const { autoUpdater } = require('electron-updater');
const { dialog } = require('electron');

// Configure logging
autoUpdater.logger = require('electron-log');
autoUpdater.logger.transports.file.level = 'info';

// Configure update events
function setupAutoUpdater(mainWindow) {
  // Check for updates when the app starts
  autoUpdater.checkForUpdatesAndNotify();

  // Check for updates every hour
  setInterval(() => {
    autoUpdater.checkForUpdatesAndNotify();
  }, 60 * 60 * 1000);

  // Update available
  autoUpdater.on('update-available', (info) => {
    dialog.showMessageBox({
      type: 'info',
      title: 'Update Available',
      message: `A new version (${info.version}) is available. Would you like to download and update now?`,
      buttons: ['Update', 'Later'],
      defaultId: 0,
      cancelId: 1
    }).then(({ response }) => {
      if (response === 0) {
        autoUpdater.downloadUpdate();
      }
    });
  });

  // Update downloaded
  autoUpdater.on('update-downloaded', () => {
    dialog.showMessageBox({
      type: 'info',
      title: 'Update Ready',
      message: 'The update has been downloaded. The application will restart to apply the update.',
      buttons: ['Restart Now'],
      defaultId: 0
    }).then(() => {
      autoUpdater.quitAndInstall();
    });
  });

  // Error handling
  autoUpdater.on('error', (err) => {
    console.error('Update error:', err);
    // Log more detailed error information
    autoUpdater.logger.error('Update error details:', err);
    
    dialog.showErrorBox('Update Error', err.message);
  });

  // Progress updates
  autoUpdater.on('download-progress', (progressObj) => {
    mainWindow.webContents.send('update-progress', progressObj);
  });

  // No update available
  autoUpdater.on('update-not-available', (info, isManualCheck) => {
    if (isManualCheck) {
      dialog.showMessageBox({
        type: 'info',
        title: 'No Updates Available',
        message: 'You are running the latest version of Clara.',
        buttons: ['OK'],
        defaultId: 0
      });
    }
  });
}

// Manual check for updates
function checkForUpdates() {
  return autoUpdater.checkForUpdates().then(() => {
    // Pass true to indicate this is a manual check
    autoUpdater.emit('update-not-available', null, true);
  });
}

module.exports = { setupAutoUpdater, checkForUpdates };