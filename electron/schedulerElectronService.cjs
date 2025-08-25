// ClaraVerse Scheduler Service for Electron Main Process
const { ipcMain } = require('electron');

class SchedulerElectronService {
  constructor(mainWindow = null) {
    this.scheduler = null;
    this.isRunning = false;
    this.activeExecutions = 0;
    this.mainWindow = mainWindow;
    this.initializeIPC();
  }

  setMainWindow(window) {
    this.mainWindow = window;
    if (this.scheduler && this.scheduler.setMainWindow) {
      this.scheduler.setMainWindow(window);
    }
  }

  initializeIPC() {
    // Scheduler control commands
    ipcMain.handle('scheduler:start', async () => {
      try {
        console.log('📞 IPC received scheduler:start');
        
        if (!this.scheduler) {
          console.log('⚙️ Initializing scheduler...');
          await this.initializeScheduler();
        }
        
        if (this.scheduler && typeof this.scheduler.start === 'function') {
          await this.scheduler.start();
          this.isRunning = true;
          console.log('✅ Scheduler started from main process');
          return { success: true };
        } else {
          throw new Error('Scheduler not properly initialized');
        }
      } catch (error) {
        console.error('❌ Failed to start scheduler:', error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('scheduler:stop', async () => {
      try {
        console.log('📞 IPC received scheduler:stop');
        if (this.scheduler && typeof this.scheduler.stop === 'function') {
          await this.scheduler.stop();
          this.isRunning = false;
          console.log('🛑 Scheduler stopped from main process');
        }
        return { success: true };
      } catch (error) {
        console.error('❌ Failed to stop scheduler:', error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('scheduler:status', async () => {
      try {
        console.log('📞 IPC received scheduler:status');
        
        let status = {
          isRunning: this.isRunning,
          activeExecutions: this.activeExecutions
        };
        
        // If scheduler exists, get status from it
        if (this.scheduler && typeof this.scheduler.getStatus === 'function') {
          try {
            const schedulerStatus = this.scheduler.getStatus();
            status = { ...status, ...schedulerStatus };
          } catch (statusError) {
            console.warn('⚠️ Failed to get scheduler status:', statusError);
          }
        }
        
        console.log('📊 Scheduler status:', status);
        return status;
      } catch (error) {
        console.error('❌ Failed to get scheduler status:', error);
        return { isRunning: false, activeExecutions: 0, error: error.message };
      }
    });

    ipcMain.handle('scheduler:getActiveTasks', async () => {
      try {
        console.log('📞 IPC received scheduler:getActiveTasks');
        if (!this.scheduler || typeof this.scheduler.getActiveTasks !== 'function') {
          return [];
        }
        
        const tasks = await this.scheduler.getActiveTasks();
        return tasks;
      } catch (error) {
        console.error('❌ Failed to get active tasks:', error);
        return [];
      }
    });

    ipcMain.handle('scheduler:getTaskExecutions', async (event, taskId) => {
      try {
        console.log('📞 IPC received scheduler:getTaskExecutions');
        if (!this.scheduler || typeof this.scheduler.getTaskExecutions !== 'function') {
          return [];
        }
        
        const executions = await this.scheduler.getTaskExecutions(taskId);
        return executions;
      } catch (error) {
        console.error('❌ Failed to get task executions:', error);
        return [];
      }
    });

    ipcMain.handle('scheduler:cancelTask', async (event, taskId) => {
      try {
        console.log('📞 IPC received scheduler:cancelTask');
        if (!this.scheduler || typeof this.scheduler.cancelTask !== 'function') {
          return { success: false, error: 'Scheduler not initialized' };
        }
        
        await this.scheduler.cancelTask(taskId);
        return { success: true };
      } catch (error) {
        console.error('❌ Failed to cancel task:', error);
        return { success: false, error: error.message };
      }
    });

    // Auto-start scheduler when app starts
    this.autoStartScheduler();
  }

  async initializeScheduler() {
    try {
      console.log('🔧 Initializing scheduler bridge...');
      
      // Use the CommonJS bridge instead of trying to import TypeScript
      const { schedulerBridge } = require('./schedulerBridge.cjs');
      this.scheduler = schedulerBridge;
      
      // Set the main window reference
      if (this.mainWindow && this.scheduler.setMainWindow) {
        this.scheduler.setMainWindow(this.mainWindow);
      }
      
      console.log('✅ Scheduler bridge loaded successfully');
      
      if (this.scheduler) {
        console.log('🔍 Scheduler methods available:', Object.getOwnPropertyNames(Object.getPrototypeOf(this.scheduler)));
      }
      
    } catch (error) {
      console.error('❌ Failed to initialize scheduler bridge:', error);
      throw error;
    }
  }

  async autoStartScheduler() {
    try {
      // Wait a bit for the app to fully initialize
      setTimeout(async () => {
        console.log('🚀 Auto-starting ClaraVerse Scheduler...');
        
        try {
          if (!this.scheduler) {
            await this.initializeScheduler();
          }
          
          if (this.scheduler && typeof this.scheduler.start === 'function') {
            await this.scheduler.start();
            this.isRunning = true;
            console.log('✅ Scheduler auto-started successfully');
          } else {
            console.error('❌ Scheduler not properly initialized for auto-start');
          }
        } catch (initError) {
          console.error('❌ Failed to auto-start scheduler:', initError);
        }
      }, 5000); // 5 second delay
    } catch (error) {
      console.error('❌ Failed to setup auto-start scheduler:', error);
    }
  }

  // Call this when app is closing
  async cleanup() {
    if (this.scheduler) {
      await this.scheduler.stop();
      console.log('🧹 Scheduler cleaned up');
    }
  }
}

module.exports = { SchedulerElectronService };
