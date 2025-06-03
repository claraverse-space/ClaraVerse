const { EventEmitter } = require('events');
const { Notification } = require('electron');
const log = require('electron-log');

class WatchdogService extends EventEmitter {
  constructor(dockerSetup, llamaSwapService, mcpService) {
    super();
    this.dockerSetup = dockerSetup;
    this.llamaSwapService = llamaSwapService;
    this.mcpService = mcpService;
    
    // Watchdog configuration
    this.config = {
      checkInterval: 30000, // Check every 30 seconds
      retryAttempts: 3,
      retryDelay: 10000, // 10 seconds between retries
      notificationTimeout: 5000, // Auto-dismiss notifications after 5 seconds
    };
    
    // Service status tracking
    this.services = {
      clarasCore: {
        name: "Clara's Core",
        status: 'unknown',
        lastCheck: null,
        failureCount: 0,
        isRetrying: false,
        healthCheck: () => this.checkClarasCoreHealth(),
        restart: () => this.restartClarasCore()
      },
      n8n: {
        name: 'n8n Workflow Engine',
        status: 'unknown',
        lastCheck: null,
        failureCount: 0,
        isRetrying: false,
        healthCheck: () => this.checkN8nHealth(),
        restart: () => this.restartN8nService()
      },
      python: {
        name: 'Python Backend Service',
        status: 'unknown',
        lastCheck: null,
        failureCount: 0,
        isRetrying: false,
        healthCheck: () => this.checkPythonHealth(),
        restart: () => this.restartPythonService()
      }
    };
    
    // Watchdog state
    this.isRunning = false;
    this.checkTimer = null;
    this.activeNotifications = new Map();
    
    log.info('Watchdog Service initialized');
  }

  // Start the watchdog monitoring
  start() {
    if (this.isRunning) {
      log.warn('Watchdog service is already running');
      return;
    }

    this.isRunning = true;
    log.info('Starting Watchdog Service...');
    
    // Perform initial health checks
    this.performHealthChecks();
    
    // Schedule regular health checks
    this.checkTimer = setInterval(() => {
      this.performHealthChecks();
    }, this.config.checkInterval);

    this.emit('started');
    log.info('Watchdog Service started successfully');
  }

  // Stop the watchdog monitoring
  stop() {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = null;
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
    const timestamp = new Date();
    log.debug('Performing watchdog health checks...');

    for (const [serviceKey, service] of Object.entries(this.services)) {
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

    // Show notification on first failure or every 3rd failure to avoid spam
    if (service.failureCount === 1 || service.failureCount % 3 === 0) {
      this.showNotification(
        `${service.name} Issue Detected`,
        `${service.name} is not responding. Attempting to restart...`,
        'warning'
      );
    }

    // Attempt to restart the service if not already retrying
    if (!service.isRetrying && service.failureCount <= this.config.retryAttempts) {
      this.attemptServiceRestart(serviceKey, service);
    } else if (service.failureCount > this.config.retryAttempts) {
      log.error(`${service.name} has exceeded maximum retry attempts (${this.config.retryAttempts})`);
      service.status = 'failed';
      
      this.showNotification(
        `${service.name} Failed`,
        `${service.name} could not be restarted after ${this.config.retryAttempts} attempts. Manual intervention may be required.`,
        'error'
      );
      
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
      
      this.showNotification(
        `${service.name} Restart Failed`,
        `Failed to restart ${service.name}: ${error.message}`,
        'error'
      );
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