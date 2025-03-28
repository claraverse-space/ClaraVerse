const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const electron = require('electron');

class PythonSetup {
  constructor() {
    this.app = electron.app;
    
    // Use different paths for dev and production
    const isDev = process.env.NODE_ENV === 'development';
    if (isDev) {
      this.appDataPath = path.join(__dirname, '..', '.clara');
    } else if (process.platform === 'darwin') {
      this.appDataPath = path.join(this.app.getPath('appData'), 'Clara');
    } else if (process.platform === 'win32') {
      this.appDataPath = path.join(this.app.getPath('appData'), 'Clara');
    } else {
      this.appDataPath = path.join(this.app.getPath('userData'), '.clara');
    }

    // Ensure app data directory exists
    if (!fs.existsSync(this.appDataPath)) {
      fs.mkdirSync(this.appDataPath, { recursive: true });
    }

    // Update paths
    this.initPath = path.join(this.appDataPath, '.initialized');
    this.venvPath = path.join(this.appDataPath, 'venv');
    this.venvPython = process.platform === 'win32'
      ? path.join(this.venvPath, 'Scripts', 'python.exe')
      : path.join(this.venvPath, 'bin', 'python');

    // Use raw paths in dev mode, escaped paths in production
    if (!isDev) {
      this.venvPython = this.venvPython.replace(/ /g, '\\ ');
    }
  }

  isInitialized() {
    return fs.existsSync(this.initPath);
  }

  markAsInitialized() {
    fs.writeFileSync(this.initPath, new Date().toISOString());
  }

  async createVirtualEnv() {
    await this.ensureSystemPython();
    
    if (!fs.existsSync(this.venvPath)) {
      console.log('Creating virtual environment at:', this.venvPath);
      await new Promise((resolve, reject) => {
        const venvCommand = process.env.NODE_ENV === 'development' 
          ? ['-m', 'venv', this.venvPath]
          : `"${this.pythonCommand}" -m venv "${this.venvPath}"`;

        const venv = spawn(
          process.env.NODE_ENV === 'development' ? this.pythonCommand : venvCommand,
          process.env.NODE_ENV === 'development' ? ['-m', 'venv', this.venvPath] : [],
          {
            stdio: 'pipe',
            shell: true
          }
        );

        let error = '';
        venv.stderr.on('data', (data) => {
          error += data.toString();
        });

        venv.on('close', (code) => {
          if (code === 0) {
            this.pythonCommand = this.venvPython;
            resolve();
          } else {
            reject(new Error(`Failed to create virtual environment: ${error}`));
          }
        });
      });
    } else {
      this.pythonCommand = this.venvPython;
    }
  }

  async installDependencies() {
    await this.createVirtualEnv();

    const backendPath = path.join(__dirname, '..', 'py_backend');
    const requirementsPath = path.join(backendPath, 'requirements.txt');

    try {
      // First upgrade pip without --user flag in venv
      await this._runPipCommand(['install', '--upgrade', 'pip']);
      
      // Then install requirements without --user flag
      await this._runPipCommand(['install', '--no-cache-dir', '-r', requirementsPath]);
      
      this.markAsInitialized();
    } catch (error) {
      console.error('Failed to install dependencies:', error);
      throw error;
    }
  }

  async _runPipCommand(args) {
    if (!this.pythonCommand) {
      await this.ensureSystemPython();
    }

    const pipArgs = [...args];
    const env = { ...process.env };

    // Remove user-specific pip configurations when using venv
    if (this.venvPython && this.pythonCommand === this.venvPython) {
      delete env.PIP_USER;
    } else if (process.platform === 'darwin') {
      pipArgs.push('--user');
      env.PIP_USER = '1';
    }

    console.log('Running pip command:', this.pythonCommand, '-m pip', ...pipArgs);

    return new Promise((resolve, reject) => {
      const pip = spawn(this.pythonCommand, ['-m', 'pip', ...pipArgs], {
        stdio: 'pipe',
        shell: true,
        env: {
          ...env,
          PYTHONPATH: process.env.PYTHONPATH || '',
          VIRTUAL_ENV: this.venvPath // Add this for venv recognition
        }
      });

      let output = '';
      let errorOutput = '';

      pip.stdout.on('data', (data) => {
        const str = data.toString();
        output += str;
        // Filter out warnings
        if (!str.toLowerCase().includes('warning')) {
          console.log('pip:', str);
        }
      });

      pip.stderr.on('data', (data) => {
        const str = data.toString();
        errorOutput += str;
        if (!str.toLowerCase().includes('warning')) {
          console.error('pip error:', str);
        }
      });

      pip.on('close', (code) => {
        // Ignore warnings about invalid distributions
        const filteredError = errorOutput
          .split('\n')
          .filter(line => !line.includes('invalid distribution') && 
                         !line.includes('Ignoring') &&
                         !line.includes('pip available'))
          .join('\n');

        if (code === 0 || !filteredError.trim()) {
          this.markAsInitialized();
          resolve(output);
        } else {
          reject(new Error(`Failed to run pip command: ${filteredError}`));
        }
      });
    });
  }

  async checkPythonVersion() {
    const pythonCommands = ['python3', 'python'];
    
    for (const cmd of pythonCommands) {
      try {
        const version = await this._tryPythonCommand(cmd);
        if (version) {
          // Store the working python command for later use
          this.pythonCommand = cmd;
          return version;
        }
      } catch (err) {
        console.log(`Failed to run ${cmd}:`, err.message);
      }
    }
    
    throw new Error('No suitable Python installation found. Please install Python 3.x');
  }

  async ensureSystemPython() {
    if (this.pythonCommand) {
      return this.pythonCommand;
    }

    if (process.platform === 'win32') {
      await this._findWindowsPython();
    } else {
      // Check common Python locations on macOS/Linux
      const pythonPaths = [
        '/usr/bin/python3',
        '/usr/local/bin/python3',
        '/opt/homebrew/bin/python3',
        'python3',
        'python'
      ];

      for (const pythonPath of pythonPaths) {
        try {
          const version = await this._tryPythonCommand(pythonPath);
          if (version) {
            this.pythonCommand = pythonPath;
            console.log(`Found Python: ${version} at ${pythonPath}`);
            return this.pythonCommand;
          }
        } catch (err) {
          console.log(`Failed to use Python at ${pythonPath}: ${err.message}`);
        }
      }
    }

    if (!this.pythonCommand) {
      throw new Error('Python 3 not found. Please install Python 3.x from python.org');
    }

    return this.pythonCommand;
  }

  async _findWindowsPython() {
    // Common Windows Python locations
    const pythonPaths = [
      'python.exe',
      'python3.exe',
      '%LocalAppData%\\Programs\\Python\\Python3*\\python.exe',
      '%ProgramFiles%\\Python3*\\python.exe',
      '%ProgramFiles(x86)%\\Python3*\\python.exe'
    ];

    for (const pythonPath of pythonPaths) {
      try {
        // Use where command on Windows to find Python
        const where = spawn('where', [pythonPath], { shell: true });
        const path = await new Promise((resolve, reject) => {
          let output = '';
          where.stdout.on('data', data => output += data.toString());
          where.on('close', code => code === 0 ? resolve(output.split('\n')[0].trim()) : reject());
        });

        if (path) {
          this.pythonCommand = path;
          return await this._tryPythonCommand(path);
        }
      } catch (err) {
        console.log(`Failed to find Python at ${pythonPath}`);
      }
    }
    
    throw new Error('Python 3 not found. Please install Python 3.x from python.org');
  }

  _tryPythonCommand(command) {
    return new Promise((resolve, reject) => {
      const python = spawn(command, ['--version'], {
        stdio: 'pipe',
        shell: true
      });

      let version = '';
      let error = '';

      python.stdout.on('data', (data) => {
        version += data.toString();
      });

      python.stderr.on('data', (data) => {
        error += data.toString();
      });

      python.on('close', (code) => {
        if (code === 0 && version.toLowerCase().includes('python 3')) {
          resolve(version.trim());
        } else {
          reject(new Error(error || `${command} not found or invalid version`));
        }
      });
    });
  }
}

module.exports = PythonSetup;
