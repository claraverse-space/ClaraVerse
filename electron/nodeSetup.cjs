const { execSync, exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const log = require('electron-log');
const { EventEmitter } = require('events');
const os = require('os');

class NodeSetup extends EventEmitter {
  constructor() {
    super();
    this.homeDir = process.env.HOME;
    this.nvmDir = path.join(this.homeDir, '.nvm');
    this.nodeVersion = 'v20.11.1'; // Specify the Node.js version we want
    this.sudoGrantedUpfront = false;
  }

  // Helper to check write access to a directory
  async checkWriteAccess(directory) {
    if (process.platform === 'win32') return true;
    try {
      await fs.promises.access(directory, fs.constants.W_OK);
      return true;
    } catch (error) {
      if (error.code === 'ENOENT') {
        log.warn(`Directory ${directory} does not exist. Assuming sudo might be needed.`);
        return false;
      }
      log.warn(`No write access to ${directory}: ${error.message}`);
      return false;
    }
  }

  // Checks if sudo might be needed for global npm installs
  async checkNeedsSudo() {
    if (process.platform === 'win32') return false;

    const globalNodeModules = '/usr/local/lib/node_modules';
    const globalBin = '/usr/local/bin';

    const hasWriteAccessNodeModules = await this.checkWriteAccess(globalNodeModules);
    const hasWriteAccessBin = await this.checkWriteAccess(globalBin);

    return !hasWriteAccessNodeModules || !hasWriteAccessBin;
  }

  async execWithSudoAsync(command, promptMessage) {
    if (process.platform !== 'darwin') {
      // For non-macOS platforms, fall back to regular execution
      return this.execAsync(command);
    }

    return new Promise((resolve, reject) => {
      // Escape single quotes in the command
      const escapedCmd = command.replace(/'/g, "'\\''");
      
      // Create the AppleScript that will request sudo access
      const appleScript = `
        do shell script "${escapedCmd}" with administrator privileges with prompt "${promptMessage || 'Administrator privileges are required.'}"
      `;

      // Execute the AppleScript
      exec('osascript -e \'' + appleScript + '\'', (error, stdout, stderr) => {
        if (error) {
          // Check if the error is due to user cancellation
          if (error.message.includes('User canceled')) {
            reject(new Error('User did not grant administrator permission.'));
          } else {
            log.error(`Sudo command failed: ${error.message}`);
            reject(error);
          }
          return;
        }
        resolve(stdout.trim());
      });
    });
  }

  async setup(statusCallback) {
    this.sudoGrantedUpfront = false;
    try {
      // Proactive Sudo Check
      if (await this.checkNeedsSudo()) {
        statusCallback('Checking system permissions...');
        log.info('Global npm directories may require elevated permissions.');
        try {
          // Ask for permissions upfront
          await this.execWithSudoAsync('echo "Permissions granted"', "Installing NodeJS and NVM requires Permission");
          log.info('Administrator permission granted proactively.');
          this.sudoGrantedUpfront = true;
          statusCallback('Administrator permissions granted.');
        } catch (error) {
          log.error('User did not grant administrator permission upfront:', error);
          statusCallback('Administrator permission denied. Setup might fail if global installs are needed.', 'warn');
        }
      }

      // Check if NVM is installed
      if (!await this.isNvmInstalled()) {
        statusCallback('Installing NVM...');
        await this.installNvm();
      }

      // Source NVM
      const nvmScript = path.join(this.nvmDir, 'nvm.sh');
      if (!fs.existsSync(nvmScript)) {
        throw new Error(`NVM script not found at ${nvmScript}. NVM installation might have failed.`);
      }
      const sourceNvm = `. "${nvmScript}" && `;

      // Check if required Node version is installed
      statusCallback('Checking Node.js installation...');
      const hasNode = await this.execAsync(`${sourceNvm} nvm list | grep "${this.nodeVersion}"`).catch(() => false);
      
      if (!hasNode) {
        statusCallback(`Installing Node.js ${this.nodeVersion}...`);
        await this.execAsync(`${sourceNvm} nvm install ${this.nodeVersion}`);
        await this.execAsync(`${sourceNvm} nvm alias default ${this.nodeVersion}`);
      }

      // Use the installed Node version
      await this.execAsync(`${sourceNvm} nvm use ${this.nodeVersion}`);

      // Check if n8n is installed globally
      statusCallback('Checking N8N installation...');
      let hasN8n = false;
      try {
        await this.execAsync(`${sourceNvm} npm list -g n8n`);
        hasN8n = true;
      } catch (error) {
        if (!error.message.includes('npm list -g n8n')) {
          log.warn('Error checking for N8N, assuming not installed:', error);
        }
      }

      if (!hasN8n) {
        statusCallback('Installing N8N (this may take about 15 minutes)...');
        statusCallback('Time to grab a coffee while N8N installs! ☕');
        
        const installCommand = `${sourceNvm} npm install -g n8n`;

        if (this.sudoGrantedUpfront) {
          statusCallback('Installing N8N using granted administrator permissions...');
          log.info('Installing N8N with proactively granted administrator permissions.');
          await this.execWithSudoAsync(installCommand);
        } else {
          try {
            await this.execAsync(installCommand, 900000); // 15 minute timeout
          } catch (error) {
            log.error('First N8N install attempt failed:', error);
            if (error.message.includes('EACCES') || error.message.includes('permission denied')) {
              statusCallback('Permission denied. Retrying N8N installation with elevated permissions...');
              log.info('Requesting administrator permissions to install N8N globally.');
              await this.execWithSudoAsync(installCommand, 'Clara needs administrator permissions to install N8N globally.');
            } else {
              throw error;
            }
          }
        }
      }

      statusCallback('Node.js and N8N setup completed successfully!');
      return true;
    } catch (error) {
      log.error('Node setup error:', error);
      if (error.message.includes('NVM script not found')) {
        statusCallback('Error: NVM setup failed. Please check installation.', 'error');
      } else if (error.message.includes('EACCES') || error.message.includes('permission denied')) {
        statusCallback('Error: Permission issues encountered during setup. Please check file permissions or run with administrator privileges.', 'error');
      } else {
        statusCallback(`Setup failed: ${error.message}`, 'error');
      }
      throw error;
    }
  }

  async isNvmInstalled() {
    // First check if NVM directory and script exist
    const nvmExists = fs.existsSync(this.nvmDir) && fs.existsSync(path.join(this.nvmDir, 'nvm.sh'));
    
    if (!nvmExists) return false;
    
    try {
      // Try to execute nvm command to verify it's properly installed
      await this.execAsync('. "${NVM_DIR}/nvm.sh" && nvm --version');
      return true;
    } catch (error) {
      log.warn('NVM directory exists but seems to be invalid:', error);
      // If directory exists but nvm doesn't work, we should clean it up
      try {
        await fs.promises.rm(this.nvmDir, { recursive: true, force: true });
      } catch (rmError) {
        log.error('Failed to remove invalid NVM directory:', rmError);
      }
      return false;
    }
  }

  async installNvm() {
    try {
      // Ensure any existing invalid installation is removed
      if (fs.existsSync(this.nvmDir)) {
        await fs.promises.rm(this.nvmDir, { recursive: true, force: true });
      }

      const installScript = 'curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash';
      await this.execAsync(installScript);
      
      // Wait for installation to complete and verify
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Source nvm and verify installation
      const nvmScript = path.join(this.nvmDir, 'nvm.sh');
      if (!fs.existsSync(nvmScript)) {
        throw new Error('NVM installation script did not create nvm.sh');
      }

      // Try to execute nvm to verify installation
      await this.execAsync(`. "${nvmScript}" && nvm --version`);
      
      // Add NVM initialization to shell profile if not already present
      const shellProfile = path.join(this.homeDir, '.zshrc');
      const nvmInit = `
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \\. "$NVM_DIR/nvm.sh"  # This loads nvm
[ -s "$NVM_DIR/bash_completion" ] && \\. "$NVM_DIR/bash_completion"  # This loads nvm bash_completion
`;
      
      try {
        const profileContent = fs.existsSync(shellProfile) ? await fs.promises.readFile(shellProfile, 'utf8') : '';
        if (!profileContent.includes('NVM_DIR')) {
          await fs.promises.appendFile(shellProfile, nvmInit);
        }
      } catch (error) {
        log.warn('Failed to update shell profile:', error);
      }

      return true;
    } catch (error) {
      log.error('NVM installation error:', error);
      throw error;
    }
  }

  execAsync(command, timeout = 60000) {
    return new Promise((resolve, reject) => {
      const fullCommand = fs.existsSync(path.join(this.nvmDir, 'nvm.sh')) 
        ? `. "${path.join(this.nvmDir, 'nvm.sh')}" && ${command}`
        : command;

      exec(fullCommand, { 
        shell: '/bin/bash',
        timeout: timeout,
        env: { ...process.env, NVM_DIR: this.nvmDir }
      }, (error, stdout, stderr) => {
        if (error) {
          log.error(`Command failed: ${command}\nError: ${error.message}\nStderr: ${stderr}`);
          reject(error);
          return;
        }
        if (stderr) {
          log.warn(`Command stderr: ${command}\nStderr: ${stderr}`);
        }
        resolve(stdout.trim());
      });
    });
  }

  getNodePath() {
    return path.join(this.nvmDir, 'versions', 'node', this.nodeVersion, 'bin', 'node');
  }

  getN8nPath() {
    return path.join(this.nvmDir, 'versions', 'node', this.nodeVersion, 'bin', 'n8n');
  }
}

module.exports = NodeSetup;  