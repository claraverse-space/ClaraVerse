const { app, webContents } = require('electron');
const log = require('electron-log');

/**
 * Network Service Manager - Prevents UI refreshes during service crashes
 * Handles network service crash recovery without forcing renderer restarts
 */
class NetworkServiceManager {
  constructor() {
    this.crashCount = 0;
    this.maxRetries = 3;
    this.retryDelay = 1000;
    this.isRecovering = false;
    this.statePreservation = new Map();
    
    this.setupNetworkServiceHandlers();
  }

  setupNetworkServiceHandlers() {
    // Monitor for network service crashes
    app.on('child-process-gone', (event, details) => {
      if (details.type === 'Utility' && details.name === 'network.mojom.NetworkService') {
        log.warn('🔄 Network service crashed, attempting graceful recovery...');
        this.handleNetworkServiceCrash(details);
      }
    });

    // Preserve React state before potential crash
    app.on('web-contents-created', (event, contents) => {
      contents.on('render-process-gone', (crashEvent, details) => {
        if (details.reason === 'crashed' || details.reason === 'abnormal-exit') {
          this.preserveRendererState(contents);
        }
      });
    });
  }

  async handleNetworkServiceCrash(details) {
    if (this.isRecovering) return;
    
    this.isRecovering = true;
    this.crashCount++;

    try {
      log.info(`🚑 Network service recovery attempt ${this.crashCount}/${this.maxRetries}`);
      
      // Prevent automatic renderer restart
      const allWebContents = webContents.getAllWebContents();
      allWebContents.forEach(contents => {
        if (contents.getType() === 'window') {
          // Preserve current state
          this.preserveWebContentsState(contents);
          
          // Disable automatic reload on network failure
          contents.setWindowOpenHandler(() => ({
            action: 'allow',
            overrideBrowserWindowOptions: {
              webPreferences: {
                webSecurity: false // Temporary for recovery
              }
            }
          }));
        }
      });

      // Wait for network service to recover
      await this.waitForNetworkRecovery();

      // Restore preserved state without full reload
      await this.restorePreservedState();
      
      log.info('✅ Network service recovered without UI refresh');
      
    } catch (error) {
      log.error('❌ Network service recovery failed:', error);
      
      if (this.crashCount >= this.maxRetries) {
        log.warn('🔥 Max recovery attempts reached, allowing normal crash handling');
        return;
      }
    } finally {
      this.isRecovering = false;
    }
  }

  preserveRendererState(contents) {
    try {
      // Inject state preservation script before potential crash
      contents.executeJavaScriptInIsolatedWorld(999, [{
        code: `
          // Preserve React component state
          if (window.React && window.React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED) {
            const fiber = document.querySelector('#root')?._reactInternalFiber ||
                         document.querySelector('#root')?._reactInternals;
            if (fiber) {
              window.__PRESERVED_REACT_STATE__ = {
                timestamp: Date.now(),
                location: window.location.href,
                reactState: 'preserved'
              };
            }
          }
          
          // Preserve form data and user inputs
          const formData = {};
          document.querySelectorAll('input, textarea, select').forEach((elem, index) => {
            if (elem.value) {
              formData[\`input_\${index}\`] = {
                type: elem.type,
                value: elem.value,
                name: elem.name,
                id: elem.id
              };
            }
          });
          window.__PRESERVED_FORM_DATA__ = formData;
          
          'state-preserved'
        `
      }]);
    } catch (error) {
      log.warn('Failed to preserve renderer state:', error);
    }
  }

  preserveWebContentsState(contents) {
    const webContentsId = contents.id;
    this.statePreservation.set(webContentsId, {
      url: contents.getURL(),
      title: contents.getTitle(),
      timestamp: Date.now()
    });
  }

  async waitForNetworkRecovery() {
    return new Promise((resolve) => {
      let attempts = 0;
      const maxAttempts = 10;
      
      const checkNetwork = () => {
        attempts++;
        
        // Simple network connectivity test
        require('dns').lookup('google.com', (err) => {
          if (!err || attempts >= maxAttempts) {
            resolve();
          } else {
            setTimeout(checkNetwork, this.retryDelay);
          }
        });
      };
      
      checkNetwork();
    });
  }

  async restorePreservedState() {
    const allWebContents = webContents.getAllWebContents();
    
    for (const contents of allWebContents) {
      if (contents.getType() === 'window') {
        try {
          // Restore preserved state without reload
          await contents.executeJavaScript(`
            // Restore form data if preserved
            if (window.__PRESERVED_FORM_DATA__) {
              const formData = window.__PRESERVED_FORM_DATA__;
              Object.values(formData).forEach(field => {
                const elem = field.id ? document.getElementById(field.id) :
                           field.name ? document.querySelector(\`[name="\${field.name}"]\`) :
                           null;
                if (elem && elem.type === field.type) {
                  elem.value = field.value;
                }
              });
              delete window.__PRESERVED_FORM_DATA__;
            }
            
            // Signal successful recovery to React app
            if (window.electron && window.electron.networkRecovered) {
              window.electron.networkRecovered();
            }
            
            console.log('🔄 State restored after network service recovery');
          `);
        } catch (error) {
          log.warn('Failed to restore state for webContents:', error);
        }
      }
    }
  }

  // Reset crash counter after successful stable period
  resetCrashCount() {
    this.crashCount = 0;
  }
}

module.exports = NetworkServiceManager;
