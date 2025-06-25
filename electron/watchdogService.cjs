const { EventEmitter } = require('events');
const { Notification } = require('electron');
const log = require('electron-log');

class WatchdogService extends EventEmitter {
  constructor(dockerSetup, llamaSwapService, mcpService) {
    super();
    this.dockerSetup = dockerSetup;
    this.llamaSwapService = llamaSwapService;
    this.mcpService = mcpService;
    
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
    };
    
    // Service status tracking - only include selected services
    this.services = {};
    
    // Clara Core is always enabled
    this.services.clarasCore = {
      name: "Clara's Core",
      status: 'unknown',
      lastCheck: null,
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
  }

  // Enable or disable ComfyUI monitoring based on user consent
  setComfyUIMonitoring(enabled) {
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
      
      if (fs.existsSync(consentFile)) {
        const consentData = JSON.parse(fs.readFileSync(consentFile, 'utf8'));
        this.setComfyUIMonitoring(consentData.hasConsented === true);
      } else {
        this.setComfyUIMonitoring(false);
      }
    } catch (error) {
      log.warn('Could not read ComfyUI consent status, disabling monitoring:', error);
      this.setComfyUIMonitoring(false);
    }
    
    // Wait for startup delay before beginning health checks
    log.info(`Watchdog waiting ${this.config.startupDelay / 1000} seconds before starting health checks...`);
    this.startupTimer = setTimeout(() => {
      this.isStarting = false;
      log.info('Watchdog startup delay complete, beginning health checks...');
      
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

  // Perform health checks on all services
  async performHealthChecks() {
    // Skip health checks during startup phase
    if (this.isStarting) {
      log.debug('Skipping health checks during startup phase');
      return;
    }

    const timestamp = new Date();
    log.debug('Performing watchdog health checks...');

    for (const [serviceKey, service] of Object.entries(this.services)) {
      // Skip disabled services (like ComfyUI when user hasn't consented)
      if (service.enabled === false) {
        service.lastCheck = timestamp;
        continue;
      }
      
      try {
        service.lastCheck = timestamp;
        const isHealthy = await service.healthCheck();
        
        if (isHealthy) {
          this.handleServiceHealthy(serviceKey, service);
        } else {
          this.handleServiceUnhealthy(serviceKey, service);
        }
      } catch (error) {
        log.error(`Health check failed for ${service.name}:`, error);
        this.handleServiceUnhealthy(serviceKey, service, error);
      }
    }

    this.emit('healthCheckCompleted', this.getServicesStatus());
  }

  // Handle when a service is healthy
  handleServiceHealthy(serviceKey, service) {
    const wasUnhealthy = service.status !== 'healthy';
    
    service.status = 'healthy';
    service.failureCount = 0;
    service.isRetrying = false;

    if (wasUnhealthy) {
      log.info(`${service.name} is now healthy`);
      this.showNotification(
        `${service.name} Restored`,
        `${service.name} is now running normally.`,
        'success'
      );
      this.emit('serviceRestored', serviceKey, service);
    }
  }

  // Handle when a service is unhealthy
  async handleServiceUnhealthy(serviceKey, service, error = null) {
    const wasHealthy = service.status === 'healthy';
    
    service.status = 'unhealthy';
    service.failureCount++;

    if (wasHealthy) {
      log.warn(`${service.name} became unhealthy`);
    }

    log.error(`${service.name} health check failed (attempt ${service.failureCount}):`, error?.message || 'Service not responding');

    // Show notifications only for the first maxNotificationAttempts failures to avoid spam
    // After that, work silently
    if (service.failureCount <= this.config.maxNotificationAttempts) {
      // Show notification on first failure or every 3rd failure to avoid spam
      if (service.failureCount === 1 || service.failureCount % 3 === 0) {
        this.showNotification(
          `${service.name} Issue Detected`,
          `${service.name} is not responding. Attempting to restart...`,
          'warning'
        );
      }
    } else {
      log.info(`${service.name} notification suppressed (attempt ${service.failureCount} > max ${this.config.maxNotificationAttempts}) - working silently`);
    }

    // Attempt to restart the service if not already retrying
    if (!service.isRetrying && service.failureCount <= this.config.retryAttempts) {
      this.attemptServiceRestart(serviceKey, service);
    } else if (service.failureCount > this.config.retryAttempts) {
      log.error(`${service.name} has exceeded maximum retry attempts (${this.config.retryAttempts})`);
      service.status = 'failed';
      
      // Only show failure notification if we haven't exceeded maxNotificationAttempts yet
      // This prevents spam when retryAttempts > maxNotificationAttempts
      if (service.failureCount <= this.config.maxNotificationAttempts) {
        this.showNotification(
          `${service.name} Failed`,
          `${service.name} could not be restarted after ${this.config.retryAttempts} attempts. Manual intervention may be required.`,
          'error'
        );
      } else {
        log.info(`${service.name} failure notification suppressed (attempt ${service.failureCount} > max ${this.config.maxNotificationAttempts}) - working silently`);
      }
      
      this.emit('serviceFailed', serviceKey, service);
    }
  }

  // Attempt to restart a failed service
  async attemptServiceRestart(serviceKey, service) {
    if (service.isRetrying) {
      return;
    }

    service.isRetrying = true;
    log.info(`Attempting to restart ${service.name}...`);

    try {
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, this.config.retryDelay));
      
      // Attempt restart
      await service.restart();
      
      log.info(`Restart command sent for ${service.name}`);
      
      // Give the service time to start up
      await new Promise(resolve => setTimeout(resolve, 15000));
      
      // Check if restart was successful
      const isHealthy = await service.healthCheck();
      
      if (isHealthy) {
        log.info(`${service.name} restarted successfully`);
        service.status = 'healthy';
        service.failureCount = 0;
        service.isRetrying = false;
        
        // Always show success notifications as they indicate problem resolution
        this.showNotification(
          `${service.name} Restarted`,
          `${service.name} has been successfully restarted.`,
          'success'
        );
        
        this.emit('serviceRestarted', serviceKey, service);
      } else {
        log.warn(`${service.name} restart failed - service still not healthy`);
        service.isRetrying = false;
      }
    } catch (error) {
      log.error(`Error restarting ${service.name}:`, error);
      service.isRetrying = false;
      
      // Only show restart failure notifications for the first maxNotificationAttempts attempts
      // After that, work silently to avoid notification spam
      if (service.failureCount <= this.config.maxNotificationAttempts) {
        this.showNotification(
          `${service.name} Restart Failed`,
          `Failed to restart ${service.name}: ${error.message}`,
          'error'
        );
      } else {
        log.info(`${service.name} restart failure notification suppressed (attempt ${service.failureCount} > max ${this.config.maxNotificationAttempts}) - working silently`);
      }
    }
  }

  // Individual service health check methods
  async checkClarasCoreHealth() {
    try {
      const status = await this.llamaSwapService.getStatusWithHealthCheck();
      return status.isRunning && status.healthCheck === 'passed';
    } catch (error) {
      log.error('Clara\'s Core health check error:', error);
      return false;
    }
  }

  async checkN8nHealth() {
    try {
      const result = await this.dockerSetup.checkN8NHealth();
      return result.success === true;
    } catch (error) {
      log.error('n8n health check error:', error);
      return false;
    }
  }

  async checkPythonHealth() {
    try {
      return await this.dockerSetup.isPythonRunning();
    } catch (error) {
      log.error('Python service health check error:', error);
      return false;
    }
  }

  async checkComfyUIHealth() {
    try {
      return await this.dockerSetup.isComfyUIRunning();
    } catch (error) {
      log.error('ComfyUI health check error:', error);
      return false;
    }
  }

  // Individual service restart methods
  async restartClarasCore() {
    log.info('Restarting Clara\'s Core service...');
    try {
      if (this.llamaSwapService.isRunning) {
        await this.llamaSwapService.stop();
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
      await this.llamaSwapService.start();
    } catch (error) {
      log.error('Error restarting Clara\'s Core:', error);
      throw error;
    }
  }

  async restartN8nService() {
    log.info('Restarting n8n service...');
    try {
      if (this.dockerSetup.containers.n8n) {
        await this.dockerSetup.startContainer(this.dockerSetup.containers.n8n);
      }
    } catch (error) {
      log.error('Error restarting n8n service:', error);
      throw error;
    }
  }

  async restartPythonService() {
    log.info('Restarting Python service...');
    try {
      if (this.dockerSetup.containers.python) {
        await this.dockerSetup.startContainer(this.dockerSetup.containers.python);
      }
    } catch (error) {
      log.error('Error restarting Python service:', error);
      throw error;
    }
  }

  async restartComfyUIService() {
    log.info('Restarting ComfyUI service...');
    try {
      if (this.dockerSetup.containers.comfyui) {
        await this.dockerSetup.startContainer(this.dockerSetup.containers.comfyui);
      }
    } catch (error) {
      log.error('Error restarting ComfyUI service:', error);
      throw error;
    }
  }

  // Show non-persistent notification
  showNotification(title, body, type = 'info') {
    try {
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
      status[key] = {
        name: service.name,
        status: service.status,
        lastCheck: service.lastCheck,
        failureCount: service.failureCount,
        isRetrying: service.isRetrying
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
    }
    log.info('All service failure counts reset');
  }
}

module.exports = WatchdogService; 