const { EventEmitter } = require('events');
const { Notification } = require('electron');
const log = require('electron-log');

class WatchdogService extends EventEmitter {
  constructor(dockerSetup, llamaSwapService, mcpService, ipcLogger = null) {
    super();
    this.dockerSetup = dockerSetup;
    this.llamaSwapService = llamaSwapService;
    this.mcpService = mcpService;
    this.ipcLogger = ipcLogger; // Add IPC logger reference
    
    // Get user's feature selections
    const selectedFeatures = global.selectedFeatures || {
      comfyUI: true,
      n8n: true,
      ragAndTts: true,
      claraCore: true
    };
    
    // Watchdog configuration
    this.config = {
      checkInterval: 30000, // Check every 30 seconds
      startupDelay: 60000, // Wait 60 seconds before starting health checks after startup
      retryAttempts: 3,
      retryDelay: 10000, // 10 seconds between retries
      notificationTimeout: 5000, // Auto-dismiss notifications after 5 seconds
      maxNotificationAttempts: 3, // Stop showing notifications after this many attempts
      gracePeriod: 30 * 60 * 1000, // 30 minutes grace period after service is confirmed healthy
    };
    
    // Service status tracking - only include selected services
    this.services = {};
    
    // Clara Core is always enabled
    this.services.clarasCore = {
      name: "Clara's Core",
      status: 'unknown',
      lastCheck: null,
      lastHealthyTime: null, // Track when service was last confirmed healthy
      failureCount: 0,
      isRetrying: false,
      enabled: true,
      healthCheck: () => this.checkClarasCoreHealth(),
      restart: () => this.restartClarasCore()
    };
    
    // Python backend is always enabled (core service)
    this.services.python = {
      name: 'Python Backend Service',
      status: 'unknown',
      lastCheck: null,
      lastHealthyTime: null, // Track when service was last confirmed healthy
      failureCount: 0,
      isRetrying: false,
      enabled: selectedFeatures.ragAndTts, // Only if RAG & TTS is selected
      healthCheck: () => this.checkPythonHealth(),
      restart: () => this.restartPythonService()
    };
    
    // N8N only if selected
    if (selectedFeatures.n8n) {
      this.services.n8n = {
        name: 'n8n Workflow Engine',
        status: 'unknown',
        lastCheck: null,
        lastHealthyTime: null, // Track when service was last confirmed healthy
        failureCount: 0,
        isRetrying: false,
        enabled: true,
        healthCheck: () => this.checkN8nHealth(),
        restart: () => this.restartN8nService()
      };
    }
    
    // ComfyUI only if selected
    if (selectedFeatures.comfyUI) {
      this.services.comfyui = {
        name: 'ComfyUI Image Generation',
        status: 'unknown',
        lastCheck: null,
        lastHealthyTime: null, // Track when service was last confirmed healthy
        failureCount: 0,
        isRetrying: false,
        enabled: true, // Will be updated based on user consent
        healthCheck: () => this.checkComfyUIHealth(),
        restart: () => this.restartComfyUIService()
      };
    }
    
    // Watchdog state
    this.isRunning = false;
    this.isStarting = false;
    this.checkTimer = null;
    this.startupTimer = null;
    this.activeNotifications = new Map();
    
    log.info('Watchdog Service initialized');
    if (this.ipcLogger) {
      this.ipcLogger.logServiceCall('WatchdogService', 'constructor', { selectedFeatures }, 'initialized');
    }
  }

  // Enable or disable ComfyUI monitoring based on user consent
  setComfyUIMonitoring(enabled) {
    if (this.ipcLogger) {
      this.ipcLogger.logServiceCall('WatchdogService', 'setComfyUIMonitoring', { enabled });
    }
    
    if (enabled) {
      this.services.comfyui.enabled = true;
      log.info('ComfyUI monitoring enabled by user consent');
    } else {
      this.services.comfyui.enabled = false;
      this.services.comfyui.status = 'disabled';
      log.info('ComfyUI monitoring disabled - user has not consented');
    }
  }

  // Start the watchdog monitoring
  start() {
    if (this.ipcLogger) {
      this.ipcLogger.logServiceCall('WatchdogService', 'start');
    }
    
    if (this.isRunning) {
      log.warn('Watchdog service is already running');
      return;
    }

    this.isRunning = true;
    this.isStarting = true;
    log.info('Starting Watchdog Service...');
    
    // Set all services to "starting" state during startup
    for (const service of Object.values(this.services)) {
      service.status = 'starting';
    }
    
    // Check ComfyUI consent status
    const fs = require('fs');
    const path = require('path');
    const { app } = require('electron');
    
    try {
      const userDataPath = app.getPath('userData');
      const consentFile = path.join(userDataPath, 'comfyui-consent.json');
      
      if (this.ipcLogger) {
        this.ipcLogger.logFileOperation('read', consentFile);
      }
      
      if (fs.existsSync(consentFile)) {
        const consentData = JSON.parse(fs.readFileSync(consentFile, 'utf8'));
        this.setComfyUIMonitoring(consentData.hasConsented === true);
      } else {
        this.setComfyUIMonitoring(false);
      }
    } catch (error) {
      log.warn('Could not read ComfyUI consent status, disabling monitoring:', error);
      if (this.ipcLogger) {
        this.ipcLogger.logError('WatchdogService.readConsentFile', error);
      }
      this.setComfyUIMonitoring(false);
    }
    
    // Wait for startup delay before beginning health checks
    log.info(`Watchdog waiting ${this.config.startupDelay / 1000} seconds before starting health checks...`);
    this.startupTimer = setTimeout(() => {
      this.isStarting = false;
      log.info('Watchdog startup delay complete, beginning health checks...');
      
      if (this.ipcLogger) {
        this.ipcLogger.logWatchdogEvent('startup-complete', 'watchdog');
      }
      
      // Perform initial health checks
      this.performHealthChecks();
      
      // Schedule regular health checks
      this.checkTimer = setInterval(() => {
        this.performHealthChecks();
      }, this.config.checkInterval);
    }, this.config.startupDelay);

    this.emit('started');
    log.info('Watchdog Service started successfully (health checks will begin after startup delay)');
  }

  // Stop the watchdog monitoring
  stop() {
    if (this.ipcLogger) {
      this.ipcLogger.logServiceCall('WatchdogService', 'stop');
    }
    
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    this.isStarting = false;
    
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = null;
    }

    if (this.startupTimer) {
      clearTimeout(this.startupTimer);
      this.startupTimer = null;
    }

    // Clear any active notifications
    this.activeNotifications.forEach((notification, id) => {
      notification.close();
    });
    this.activeNotifications.clear();

    this.emit('stopped');
    log.info('Watchdog Service stopped');
  }

  // Check if a service is within its grace period
  isServiceInGracePeriod(service) {
    if (!service.lastHealthyTime) {
      return false; // No grace period if never been healthy
    }
    
    const timeSinceHealthy = Date.now() - service.lastHealthyTime;
    const inGracePeriod = timeSinceHealthy < this.config.gracePeriod;
    
    if (inGracePeriod) {
      const remainingMinutes = Math.ceil((this.config.gracePeriod - timeSinceHealthy) / (60 * 1000));
      log.debug(`${service.name} is in grace period (${remainingMinutes} minutes remaining)`);
    }
    
    return inGracePeriod;
  }

  // Perform health checks on all services
  async performHealthChecks() {
    // Skip health checks during startup phase
    if (this.isStarting) {
      log.debug('Skipping health checks during startup phase');
      return;
    }

    const timestamp = new Date();
    log.debug('Performing watchdog health checks...');
    
    if (this.ipcLogger) {
      this.ipcLogger.logWatchdogEvent('health-check-start', 'all-services');
    }

    for (const [serviceKey, service] of Object.entries(this.services)) {
      // Skip disabled services
      if (!service.enabled) {
        continue;
      }

      // Skip services that are in grace period (recently confirmed healthy)
      if (this.isServiceInGracePeriod(service)) {
        log.debug(`Skipping health check for ${service.name} - in grace period`);
        continue;
      }

      try {
        if (this.ipcLogger) {
          this.ipcLogger.logWatchdogEvent('health-check', serviceKey, { status: service.status });
        }
        
        const isHealthy = await service.healthCheck();
        service.lastCheck = timestamp;

        if (isHealthy) {
          if (service.status !== 'healthy') {
            log.info(`${service.name} is now healthy - granting ${this.config.gracePeriod / (60 * 1000)} minute grace period`);
            service.status = 'healthy';
            service.lastHealthyTime = Date.now(); // Start grace period
            service.failureCount = 0;
            service.isRetrying = false;
            
            if (this.ipcLogger) {
              this.ipcLogger.logWatchdogEvent('service-healthy', serviceKey, { 
                gracePeriodMinutes: this.config.gracePeriod / (60 * 1000) 
              });
            }
            
            this.emit('serviceRestored', serviceKey, service);
          } else {
            // Service was already healthy, refresh the grace period
            service.lastHealthyTime = Date.now();
            log.debug(`${service.name} confirmed healthy - grace period refreshed`);
          }
        } else {
          // Service is unhealthy - grace period no longer applies
          service.lastHealthyTime = null;
          service.failureCount++;
          log.warn(`${service.name} health check failed (attempt ${service.failureCount}/${this.config.retryAttempts})`);
          
          if (this.ipcLogger) {
            this.ipcLogger.logWatchdogEvent('service-unhealthy', serviceKey, { 
              failureCount: service.failureCount,
              maxRetries: this.config.retryAttempts,
              gracePeriodCleared: true
            });
          }

          if (service.failureCount >= this.config.retryAttempts && !service.isRetrying) {
            // Max retries reached, attempt to restart service
            service.status = 'failed';
            service.isRetrying = true;
            
            log.error(`${service.name} has failed after ${this.config.retryAttempts} attempts. Attempting restart...`);
            
            if (this.ipcLogger) {
              this.ipcLogger.logWatchdogEvent('service-restart-attempt', serviceKey);
            }
            
            try {
              await service.restart();
              
              // Wait a bit before checking if restart was successful
              setTimeout(async () => {
                const restartHealthy = await service.healthCheck();
                if (restartHealthy) {
                  service.status = 'healthy';
                  service.lastHealthyTime = Date.now(); // Start new grace period after successful restart
                  service.failureCount = 0;
                  service.isRetrying = false;
                  log.info(`${service.name} successfully restarted and is healthy - new grace period granted`);
                  
                  if (this.ipcLogger) {
                    this.ipcLogger.logWatchdogEvent('service-restart-success', serviceKey, {
                      gracePeriodMinutes: this.config.gracePeriod / (60 * 1000)
                    });
                  }
                  
                  this.emit('serviceRestarted', serviceKey, service);
                  this.showRestartSuccessNotification(service);
                } else {
                  service.isRetrying = false;
                  service.lastHealthyTime = null; // Clear grace period on failed restart
                  log.error(`${service.name} restart failed - service still unhealthy`);
                  
                  if (this.ipcLogger) {
                    this.ipcLogger.logWatchdogEvent('service-restart-failed', serviceKey);
                  }
                  
                  this.emit('serviceFailed', serviceKey, service);
                  this.showRestartFailureNotification(service);
                }
              }, this.config.retryDelay);
              
            } catch (restartError) {
              service.isRetrying = false;
              service.lastHealthyTime = null; // Clear grace period on restart error
              log.error(`Error restarting ${service.name}:`, restartError);
              
              if (this.ipcLogger) {
                this.ipcLogger.logError(`WatchdogService.restart.${serviceKey}`, restartError);
              }
              
              this.emit('serviceFailed', serviceKey, service);
              this.showRestartFailureNotification(service);
            }
          } else if (service.failureCount < this.config.retryAttempts) {
            service.status = 'degraded';
          }
        }
      } catch (error) {
        log.error(`Error performing health check for ${service.name}:`, error);
        service.status = 'error';
        service.lastCheck = timestamp;
        service.lastHealthyTime = null; // Clear grace period on health check error
        
        if (this.ipcLogger) {
          this.ipcLogger.logError(`WatchdogService.healthCheck.${serviceKey}`, error);
        }
      }
    }
  }

  // Individual service health check methods
  async checkClarasCoreHealth() {
    try {
      if (this.ipcLogger) {
        this.ipcLogger.logServiceCall('WatchdogService', 'checkClarasCoreHealth');
      }
      
      const status = await this.llamaSwapService.getStatusWithHealthCheck();
      const isHealthy = status.isRunning && status.healthCheck === 'passed';
      
      if (this.ipcLogger) {
        this.ipcLogger.logServiceCall('LlamaSwapService', 'getStatusWithHealthCheck', null, { 
          isRunning: status.isRunning, 
          healthCheck: status.healthCheck,
          isHealthy: isHealthy 
        });
      }
      
      return isHealthy;
    } catch (error) {
      log.error('Clara\'s Core health check error:', error);
      if (this.ipcLogger) {
        this.ipcLogger.logError('WatchdogService.checkClarasCoreHealth', error);
      }
      return false;
    }
  }

  async checkN8nHealth() {
    try {
      if (this.ipcLogger) {
        this.ipcLogger.logServiceCall('WatchdogService', 'checkN8nHealth');
      }
      
      const result = await this.dockerSetup.checkN8NHealth();
      
      if (this.ipcLogger) {
        this.ipcLogger.logDockerOperation('health-check', 'n8n', result);
      }
      
      return result.success === true;
    } catch (error) {
      log.error('n8n health check error:', error);
      if (this.ipcLogger) {
        this.ipcLogger.logError('WatchdogService.checkN8nHealth', error);
      }
      return false;
    }
  }

  async checkPythonHealth() {
    try {
      if (this.ipcLogger) {
        this.ipcLogger.logServiceCall('WatchdogService', 'checkPythonHealth');
      }
      
      const isRunning = await this.dockerSetup.isPythonRunning();
      
      if (this.ipcLogger) {
        this.ipcLogger.logDockerOperation('health-check', 'python', { isRunning });
      }
      
      return isRunning;
    } catch (error) {
      log.error('Python service health check error:', error);
      if (this.ipcLogger) {
        this.ipcLogger.logError('WatchdogService.checkPythonHealth', error);
      }
      return false;
    }
  }

  async checkComfyUIHealth() {
    try {
      if (this.ipcLogger) {
        this.ipcLogger.logServiceCall('WatchdogService', 'checkComfyUIHealth');
      }
      
      const isRunning = await this.dockerSetup.isComfyUIRunning();
      
      if (this.ipcLogger) {
        this.ipcLogger.logDockerOperation('health-check', 'comfyui', { isRunning });
      }
      
      return isRunning;
    } catch (error) {
      log.error('ComfyUI health check error:', error);
      if (this.ipcLogger) {
        this.ipcLogger.logError('WatchdogService.checkComfyUIHealth', error);
      }
      return false;
    }
  }

  // Individual service restart methods
  async restartClarasCore() {
    log.info('Restarting Clara\'s Core service...');
    
    if (this.ipcLogger) {
      this.ipcLogger.logServiceCall('WatchdogService', 'restartClarasCore');
    }
    
    try {
      if (this.llamaSwapService.isRunning) {
        if (this.ipcLogger) {
          this.ipcLogger.logServiceCall('LlamaSwapService', 'stop');
        }
        await this.llamaSwapService.stop();
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
      
      if (this.ipcLogger) {
        this.ipcLogger.logServiceCall('LlamaSwapService', 'start');
      }
      await this.llamaSwapService.start();
    } catch (error) {
      log.error('Error restarting Clara\'s Core:', error);
      if (this.ipcLogger) {
        this.ipcLogger.logError('WatchdogService.restartClarasCore', error);
      }
      throw error;
    }
  }

  async restartN8nService() {
    log.info('Restarting n8n service...');
    
    if (this.ipcLogger) {
      this.ipcLogger.logServiceCall('WatchdogService', 'restartN8nService');
    }
    
    try {
      if (this.dockerSetup.containers.n8n) {
        if (this.ipcLogger) {
          this.ipcLogger.logDockerOperation('restart', 'n8n');
        }
        await this.dockerSetup.startContainer(this.dockerSetup.containers.n8n);
      }
    } catch (error) {
      log.error('Error restarting n8n service:', error);
      if (this.ipcLogger) {
        this.ipcLogger.logError('WatchdogService.restartN8nService', error);
      }
      throw error;
    }
  }

  async restartPythonService() {
    log.info('Restarting Python service...');
    
    if (this.ipcLogger) {
      this.ipcLogger.logServiceCall('WatchdogService', 'restartPythonService');
    }
    
    try {
      if (this.dockerSetup.containers.python) {
        if (this.ipcLogger) {
          this.ipcLogger.logDockerOperation('restart', 'python');
        }
        await this.dockerSetup.startContainer(this.dockerSetup.containers.python);
      }
    } catch (error) {
      log.error('Error restarting Python service:', error);
      if (this.ipcLogger) {
        this.ipcLogger.logError('WatchdogService.restartPythonService', error);
      }
      throw error;
    }
  }

  async restartComfyUIService() {
    log.info('Restarting ComfyUI service...');
    
    if (this.ipcLogger) {
      this.ipcLogger.logServiceCall('WatchdogService', 'restartComfyUIService');
    }
    
    try {
      if (this.dockerSetup.containers.comfyui) {
        if (this.ipcLogger) {
          this.ipcLogger.logDockerOperation('restart', 'comfyui');
        }
        await this.dockerSetup.startContainer(this.dockerSetup.containers.comfyui);
      }
    } catch (error) {
      log.error('Error restarting ComfyUI service:', error);
      if (this.ipcLogger) {
        this.ipcLogger.logError('WatchdogService.restartComfyUIService', error);
      }
      throw error;
    }
  }

  // Notification methods for restart success/failure
  showRestartSuccessNotification(service) {
    this.showNotification(
      `${service.name} Restarted`,
      `${service.name} has been successfully restarted and is now healthy.`,
      'success'
    );
  }

  showRestartFailureNotification(service) {
    // Only show failure notifications for the first few attempts to avoid spam
    if (service.failureCount <= this.config.maxNotificationAttempts) {
      this.showNotification(
        `${service.name} Restart Failed`,
        `Failed to restart ${service.name}. Manual intervention may be required.`,
        'error'
      );
    } else {
      log.info(`${service.name} restart failure notification suppressed (attempt ${service.failureCount} > max ${this.config.maxNotificationAttempts}) - working silently`);
    }
  }

  // Show non-persistent notification
  showNotification(title, body, type = 'info') {
    try {
      if (this.ipcLogger) {
        this.ipcLogger.logWatchdogEvent('notification', 'system', { title, body, type });
      }
      
      const notification = new Notification({
        title,
        body,
        icon: this.getNotificationIcon(type),
        silent: false,
        urgency: type === 'error' ? 'critical' : type === 'warning' ? 'normal' : 'low'
      });

      // Auto-dismiss notification after configured timeout
      const notificationId = Date.now().toString();
      this.activeNotifications.set(notificationId, notification);

      notification.show();

      notification.on('click', () => {
        notification.close();
        this.activeNotifications.delete(notificationId);
      });

      notification.on('close', () => {
        this.activeNotifications.delete(notificationId);
      });

      // Auto-close after timeout
      setTimeout(() => {
        if (this.activeNotifications.has(notificationId)) {
          notification.close();
          this.activeNotifications.delete(notificationId);
        }
      }, this.config.notificationTimeout);

      log.info(`Notification shown: ${title} - ${body}`);
    } catch (error) {
      log.error('Error showing notification:', error);
      if (this.ipcLogger) {
        this.ipcLogger.logError('WatchdogService.showNotification', error);
      }
    }
  }

  // Get appropriate icon for notification type
  getNotificationIcon(type) {
    // You can customize these paths to your app's icon files
    switch (type) {
      case 'success':
        return null; // Use default app icon
      case 'warning':
        return null; // Use default app icon
      case 'error':
        return null; // Use default app icon
      default:
        return null; // Use default app icon
    }
  }

  // Get current status of all services
  getServicesStatus() {
    const status = {};
    for (const [key, service] of Object.entries(this.services)) {
      const inGracePeriod = this.isServiceInGracePeriod(service);
      const gracePeriodRemainingMinutes = service.lastHealthyTime 
        ? Math.max(0, Math.ceil((this.config.gracePeriod - (Date.now() - service.lastHealthyTime)) / (60 * 1000)))
        : 0;
        
      status[key] = {
        name: service.name,
        status: service.status,
        lastCheck: service.lastCheck,
        lastHealthyTime: service.lastHealthyTime,
        failureCount: service.failureCount,
        isRetrying: service.isRetrying,
        inGracePeriod: inGracePeriod,
        gracePeriodRemainingMinutes: gracePeriodRemainingMinutes
      };
    }
    return status;
  }

  // Get overall system health
  getOverallHealth() {
    const statuses = Object.values(this.services).map(service => service.status);
    const healthyCount = statuses.filter(status => status === 'healthy').length;
    const totalCount = statuses.length;
    
    if (healthyCount === totalCount) {
      return 'healthy';
    } else if (healthyCount === 0) {
      return 'critical';
    } else {
      return 'degraded';
    }
  }

  // Update configuration
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    log.info('Watchdog configuration updated:', this.config);
    
    // Restart monitoring with new interval if it changed and service is running
    if (this.isRunning && newConfig.checkInterval) {
      this.stop();
      this.start();
    }
  }

  // Signal that Docker setup is complete and watchdog can start monitoring
  signalSetupComplete() {
    if (!this.isRunning || !this.isStarting) {
      return;
    }

    log.info('Docker setup complete signal received, starting health checks early...');
    
    // Clear the startup timer if it's still running
    if (this.startupTimer) {
      clearTimeout(this.startupTimer);
      this.startupTimer = null;
    }

    this.isStarting = false;
    
    // Perform initial health checks
    this.performHealthChecks();
    
    // Schedule regular health checks
    this.checkTimer = setInterval(() => {
      this.performHealthChecks();
    }, this.config.checkInterval);

    log.info('Watchdog health checks started early due to setup completion');
  }

  // Manual health check trigger
  async performManualHealthCheck() {
    log.info('Manual health check triggered');
    await this.performHealthChecks();
    return this.getServicesStatus();
  }

  // Reset failure counts for all services
  resetFailureCounts() {
    for (const service of Object.values(this.services)) {
      service.failureCount = 0;
      service.isRetrying = false;
      // Keep grace period intact when resetting failure counts
    }
    log.info('All service failure counts reset (grace periods preserved)');
  }

  // Force end grace period for a specific service (for manual intervention)
  endGracePeriod(serviceKey) {
    if (this.services[serviceKey]) {
      this.services[serviceKey].lastHealthyTime = null;
      log.info(`Grace period ended for ${this.services[serviceKey].name}`);
    }
  }

  // Force end grace period for all services
  endAllGracePeriods() {
    for (const service of Object.values(this.services)) {
      service.lastHealthyTime = null;
    }
    log.info('All service grace periods ended');
  }
}

module.exports = WatchdogService; 