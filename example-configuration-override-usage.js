/**
 * Example usage of the new Configuration Override IPC API
 * 
 * This file demonstrates how to use the new IPC handlers for configuration override functionality.
 * These APIs allow users to:
 * 1. Get available GPU backends
 * 2. Override the default engine selection
 * 3. Force specific backends
 * 4. Trigger reconfiguration
 * 5. Get config YAML as JSON
 * 
 * Use this as a reference when building the new configuration UI.
 */

// Example 1: Get all available backends for the current platform
async function getAvailableBackends() {
  try {
    const result = await window.llamaSwap.getAvailableBackends();
    
    if (result.success) {
      console.log('Available backends:', result.backends);
      console.log('Platform:', result.platform);
      console.log('Architecture:', result.architecture);
      
      // Filter only available backends
      const availableBackends = result.backends.filter(backend => backend.isAvailable);
      console.log('Available backends with binaries:', availableBackends);
      
      // Example backend structure:
      // {
      //   id: 'cuda',
      //   name: 'NVIDIA CUDA',
      //   description: 'Optimized for NVIDIA GPUs with CUDA support',
      //   folder: 'win32-x64-cuda',
      //   requiresGPU: true,
      //   gpuType: 'nvidia',
      //   isAvailable: true,
      //   binaryPath: '/path/to/binaries'
      // }
      
      return result;
    } else {
      console.error('Failed to get available backends:', result.error);
      return null;
    }
  } catch (error) {
    console.error('Error getting available backends:', error);
    return null;
  }
}

// Example 2: Set/override the backend selection
async function setBackendOverride(backendId) {
  try {
    console.log(`Setting backend override to: ${backendId}`);
    const result = await window.llamaSwap.setBackendOverride(backendId);
    
    if (result.success) {
      console.log('Backend override set successfully:', result.backendId);
      return true;
    } else {
      console.error('Failed to set backend override:', result.error);
      return false;
    }
  } catch (error) {
    console.error('Error setting backend override:', error);
    return false;
  }
}

// Example 3: Get current backend override status
async function getCurrentBackendOverride() {
  try {
    const result = await window.llamaSwap.getBackendOverride();
    
    if (result.success) {
      if (result.isOverridden) {
        console.log('Backend is overridden to:', result.backendId);
        console.log('Override set at:', result.timestamp);
      } else {
        console.log('No backend override set - using auto-detection');
      }
      return result;
    } else {
      console.error('Failed to get backend override:', result.error);
      return null;
    }
  } catch (error) {
    console.error('Error getting backend override:', error);
    return null;
  }
}

// Example 4: Get current configuration as JSON
async function getConfigurationAsJson() {
  try {
    const result = await window.llamaSwap.getConfigAsJson();
    
    if (result.success) {
      console.log('Configuration loaded successfully:');
      console.log('Config path:', result.configPath);
      console.log('Last modified:', result.lastModified);
      console.log('Configuration:', result.config);
      
      // Access specific parts of the config
      if (result.config.models) {
        console.log('Available models:', Object.keys(result.config.models));
      }
      if (result.config.groups) {
        console.log('Model groups:', Object.keys(result.config.groups));
      }
      
      return result.config;
    } else {
      console.error('Failed to get configuration:', result.error);
      return null;
    }
  } catch (error) {
    console.error('Error getting configuration:', error);
    return null;
  }
}

// Example 5: Force reconfigure with current settings
async function forceReconfigure() {
  try {
    console.log('Triggering force reconfiguration...');
    const result = await window.llamaSwap.forceReconfigure();
    
    if (result.success) {
      console.log('Reconfiguration completed successfully');
      console.log('Models found:', result.modelsFound);
      console.log('Config path:', result.configPath);
      return true;
    } else {
      console.error('Force reconfiguration failed:', result.error);
      return false;
    }
  } catch (error) {
    console.error('Error during force reconfiguration:', error);
    return false;
  }
}

// Example 6: Get comprehensive configuration information
async function getConfigurationInfo() {
  try {
    const result = await window.llamaSwap.getConfigurationInfo();
    
    if (result.success) {
      console.log('=== Comprehensive Configuration Info ===');
      
      // Available backends
      console.log('Available backends:', result.availableBackends.length);
      result.availableBackends.forEach(backend => {
        console.log(`  - ${backend.name} (${backend.id}): ${backend.isAvailable ? 'Available' : 'Not Available'}`);
      });
      
      // Current override
      if (result.currentBackendOverride && result.currentBackendOverride.isOverridden) {
        console.log('Current override:', result.currentBackendOverride.backendId);
      } else {
        console.log('No override - using auto-detection');
      }
      
      // Configuration
      if (result.configuration) {
        console.log('Configuration loaded, models:', Object.keys(result.configuration.models || {}).length);
      }
      
      // Performance settings
      if (result.performanceSettings) {
        console.log('Performance settings loaded');
      }
      
      // System info
      console.log('Platform:', result.platform);
      console.log('Architecture:', result.architecture);
      
      // Service status
      console.log('Service running:', result.serviceStatus.isRunning);
      
      return result;
    } else {
      console.error('Failed to get configuration info:', result.error);
      return null;
    }
  } catch (error) {
    console.error('Error getting configuration info:', error);
    return null;
  }
}

// Example 7: Restart service with overrides applied
async function restartWithOverrides() {
  try {
    console.log('Restarting service with overrides...');
    const result = await window.llamaSwap.restartWithOverrides();
    
    if (result.success) {
      console.log('Service restarted successfully with overrides');
      return true;
    } else {
      console.error('Failed to restart service with overrides:', result.error);
      return false;
    }
  } catch (error) {
    console.error('Error restarting service with overrides:', error);
    return false;
  }
}

// Example 8: Complete workflow - Change backend and restart
async function changeBackendWorkflow(targetBackendId) {
  try {
    console.log(`=== Changing Backend to ${targetBackendId} ===`);
    
    // Step 1: Get available backends to validate the target
    const backends = await getAvailableBackends();
    if (!backends) return false;
    
    const targetBackend = backends.backends.find(b => b.id === targetBackendId);
    if (!targetBackend) {
      console.error(`Backend '${targetBackendId}' not found`);
      return false;
    }
    
    if (!targetBackend.isAvailable) {
      console.error(`Backend '${targetBackendId}' is not available (binaries not found)`);
      return false;
    }
    
    // Step 2: Set the backend override
    const overrideSuccess = await setBackendOverride(targetBackendId);
    if (!overrideSuccess) return false;
    
    // Step 3: Force reconfigure to apply the override
    const reconfigureSuccess = await forceReconfigure();
    if (!reconfigureSuccess) return false;
    
    // Step 4: Restart the service with the new configuration
    const restartSuccess = await restartWithOverrides();
    if (!restartSuccess) return false;
    
    console.log(`✅ Successfully changed backend to ${targetBackend.name}`);
    return true;
    
  } catch (error) {
    console.error('Error in change backend workflow:', error);
    return false;
  }
}

// Example 9: Reset to auto-detection
async function resetToAutoDetection() {
  try {
    console.log('Resetting to auto-detection...');
    
    // Set override to 'auto' or null to reset
    const result = await setBackendOverride('auto');
    if (!result) return false;
    
    // Force reconfigure to apply the reset
    const reconfigureSuccess = await forceReconfigure();
    if (!reconfigureSuccess) return false;
    
    // Restart service
    const restartSuccess = await restartWithOverrides();
    if (!restartSuccess) return false;
    
    console.log('✅ Successfully reset to auto-detection');
    return true;
    
  } catch (error) {
    console.error('Error resetting to auto-detection:', error);
    return false;
  }
}

// Example 10: Build a simple UI configuration panel
function createConfigurationPanel() {
  return {
    // Load initial state
    async initialize() {
      const info = await getConfigurationInfo();
      if (!info) return null;
      
      return {
        availableBackends: info.availableBackends,
        currentOverride: info.currentBackendOverride,
        serviceStatus: info.serviceStatus,
        platform: info.platform
      };
    },
    
    // Get backend options for dropdown
    getBackendOptions(backends) {
      return backends
        .filter(backend => backend.isAvailable)
        .map(backend => ({
          value: backend.id,
          label: backend.name,
          description: backend.description,
          requiresGPU: backend.requiresGPU
        }));
    },
    
    // Handle backend selection change
    async onBackendChange(selectedBackendId) {
      if (selectedBackendId === 'auto') {
        return await resetToAutoDetection();
      } else {
        return await changeBackendWorkflow(selectedBackendId);
      }
    },
    
    // Check if restart is needed
    async isRestartNeeded() {
      const override = await getCurrentBackendOverride();
      const status = await window.llamaSwap.getStatus();
      
      // If service is running and there's an override, restart might be needed
      return status.isRunning && override && override.isOverridden;
    }
  };
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    getAvailableBackends,
    setBackendOverride,
    getCurrentBackendOverride,
    getConfigurationAsJson,
    forceReconfigure,
    getConfigurationInfo,
    restartWithOverrides,
    changeBackendWorkflow,
    resetToAutoDetection,
    createConfigurationPanel
  };
} 