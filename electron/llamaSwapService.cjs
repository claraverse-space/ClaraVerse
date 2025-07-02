const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const os = require('os');
const log = require('electron-log');
const { app } = require('electron');
const PlatformManager = require('./platformManager.cjs');

class LlamaSwapService {
  constructor(ipcLogger = null) {
    this.process = null;
    this.isRunning = false;
    this.isStarting = false; // Add this flag to prevent concurrent starts
    this.port = 8091;
    this.ipcLogger = ipcLogger; // Add IPC logger reference
    
    // Flash attention retry mechanism flags
    this.handleFlashAttentionRequired = false;
    this.flashAttentionRetryAttempted = false;
    this.forceFlashAttention = false;
    
    // Port cleanup retry mechanism flags
    this.needsPortRetry = false;
    this.portRetryAttempted = false;
    
    // Progress tracking for UI feedback
    this.progressCallback = null;
    
    // Custom model paths
    this.customModelPaths = [];
    
    // Handle different base directory paths for development vs production
    this.baseDir = this.getBaseBinaryDirectory();
    this.modelsDir = path.join(os.homedir(), '.clara', 'llama-models');
    
    // Use userData directory for config files to avoid read-only filesystem issues in AppImage
    const userDataDir = app && app.getPath ? app.getPath('userData') : path.join(os.homedir(), '.clara');
    this.configPath = path.join(userDataDir, 'llama-swap-config.yaml');
    this.logPath = path.join(userDataDir, 'llama-swap.log');
    
    log.info(`Base binary directory: ${this.baseDir}`);
    log.info(`Models directory: ${this.modelsDir}`);
    log.info(`Config path: ${this.configPath}`);
    log.info(`Log path: ${this.logPath}`);
    
    // Initialize platform manager
    this.platformManager = new PlatformManager(this.baseDir);
    this.platformInfo = this.platformManager.platformInfo;
    this.platformBinDir = this.platformManager.getPlatformLibraryDirectory();
    
    // Get platform-specific binary paths with fallback support
    this.binaryPaths = this.getBinaryPathsWithFallback();
    
    log.info(`Platform detected: ${this.platformInfo.platform}-${this.platformInfo.arch}`);
    log.info(`Using platform directory: ${this.platformInfo.platformDir}`);
    log.info(`Binary paths:`, this.binaryPaths);
    
    // Initialize GPU info cache
    this.gpuInfo = null;
    this.systemMemoryGB = Math.round(os.totalmem() / (1024 * 1024 * 1024));
    
    // Ensure models directory exists
    this.ensureDirectories();
    
    if (this.ipcLogger) {
      this.ipcLogger.logServiceCall('LlamaSwapService', 'constructor', null, 'initialized');
    }
  }

  /**
   * Get the correct base directory for binaries in both development and production
   */
  getBaseBinaryDirectory() {
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    if (isDevelopment) {
      // Development mode - use electron directory
      return path.join(__dirname, 'llamacpp-binaries');
    } else {
      // Production mode - check multiple possible locations
      const possiblePaths = [
        // Standard Electron app structure
        process.resourcesPath ? path.join(process.resourcesPath, 'electron', 'llamacpp-binaries') : null,
        // Alternative app structure
        app && app.getAppPath ? path.join(app.getAppPath(), 'electron', 'llamacpp-binaries') : null,
        // Fallback to current directory structure
        path.join(__dirname, 'llamacpp-binaries')
      ].filter(Boolean); // Remove null entries
      
      for (const possiblePath of possiblePaths) {
        log.info(`Checking binary path: ${possiblePath}`);
        if (fsSync.existsSync(possiblePath)) {
          log.info(`Found binaries at: ${possiblePath}`);
          return possiblePath;
        }
      }
      
      // If none found, create in app data directory and log error
      const fallbackPath = app && app.getPath 
        ? path.join(app.getPath('userData'), 'llamacpp-binaries')
        : path.join(__dirname, 'llamacpp-binaries'); // Final fallback for non-Electron environments
      log.error(`No binary directory found! Checked paths:`, possiblePaths);
      log.error(`Using fallback path: ${fallbackPath}`);
      return fallbackPath;
    }
  }

  /**
   * Get binary paths with fallback to legacy locations for backward compatibility
   */
  getBinaryPathsWithFallback() {
    try {
      // Try to get platform-specific paths first
      if (this.platformManager.isCurrentPlatformSupported()) {
        return this.platformManager.getBinaryPaths();
      }
    } catch (error) {
      log.warn('Failed to get platform-specific binary paths, falling back to legacy detection:', error.message);
    }

    // Fallback to legacy behavior
    return this.getLegacyBinaryPaths();
  }

  /**
   * Legacy binary path detection for backward compatibility
   */
  getLegacyBinaryPaths() {
    const platform = os.platform();
    const arch = os.arch();
    
    let platformDir;
    let binaryNames;
    
    switch (platform) {
      case 'darwin':
        platformDir = arch === 'arm64' ? 'darwin-arm64' : 'darwin-x64';
        binaryNames = {
          llamaSwap: 'llama-swap-darwin',
          llamaServer: 'llama-server'
        };
        break;
      case 'linux':
        platformDir = 'linux-x64';
        binaryNames = {
          llamaSwap: 'llama-swap-linux',
          llamaServer: 'llama-server'
        };
        break;
      case 'win32':
        platformDir = 'win32-x64';
        binaryNames = {
          llamaSwap: 'llama-swap-win32-x64.exe',
          llamaServer: 'llama-server.exe'
        };
        break;
      default:
        throw new Error(`Unsupported platform: ${platform}-${arch}`);
    }
    
    const platformPath = path.join(this.baseDir, platformDir);
    
    // For llama-swap, try multiple possible names in order of preference
    const llamaSwapCandidates = platform === 'win32' 
      ? ['llama-swap-win32-x64.exe', 'llama-swap.exe']
      : platform === 'darwin'
      ? ['llama-swap-darwin', 'llama-swap']
      : ['llama-swap-linux', 'llama-swap'];
    
    let llamaSwapPath = null;
    for (const candidate of llamaSwapCandidates) {
      const candidatePath = path.join(platformPath, candidate);
      if (fsSync.existsSync(candidatePath)) {
        llamaSwapPath = candidatePath;
        log.info(`Found llama-swap binary: ${candidate}`);
        break;
      }
    }
    
    // Fallback to the expected name if no candidates found
    if (!llamaSwapPath) {
      llamaSwapPath = path.join(platformPath, binaryNames.llamaSwap);
      log.warn(`No llama-swap binary found in candidates, using expected path: ${binaryNames.llamaSwap}`);
    }
    
    return {
      llamaSwap: llamaSwapPath,
      llamaServer: path.join(platformPath, binaryNames.llamaServer)
    };
  }

  async validateBinaries() {
    log.info('Starting binary validation...');
    
    try {
      // Use platform manager validation if available
      if (this.platformManager.isCurrentPlatformSupported()) {
        log.info('Using platform manager validation');
        await this.platformManager.validatePlatformBinaries();
        return true;
      }
    } catch (error) {
      log.warn('Platform manager validation failed, using legacy validation:', error.message);
    }

    // Fallback to legacy validation
    log.info('Using legacy binary validation');
    const { llamaSwap, llamaServer } = this.binaryPaths;
    
    const issues = [];
    
    log.info(`Checking llama-swap binary: ${llamaSwap}`);
    if (!this.binaryExists(llamaSwap)) {
      const error = `llama-swap binary not found at: ${llamaSwap}`;
      log.error(error);
      issues.push(error);
    } else {
      log.info('✅ llama-swap binary found');
    }
    
    log.info(`Checking llama-server binary: ${llamaServer}`);
    if (!this.binaryExists(llamaServer)) {
      const error = `llama-server binary not found at: ${llamaServer}`;
      log.error(error);
      issues.push(error);
    } else {
      log.info('✅ llama-server binary found');
    }
    
    if (issues.length > 0) {
      // Additional diagnostic information
      log.error('=== BINARY VALIDATION FAILED ===');
      log.error('Base directory:', this.baseDir);
      log.error('Platform directory:', this.platformBinDir);
      log.error('Platform info:', this.platformInfo);
      
      // List what's actually in the directories
      try {
        const baseContents = fsSync.readdirSync(this.baseDir);
        log.error('Base directory contents:', baseContents);
        
        if (fsSync.existsSync(this.platformBinDir)) {
          const platformContents = fsSync.readdirSync(this.platformBinDir);
          log.error('Platform directory contents:', platformContents);
        } else {
          log.error('Platform directory does not exist:', this.platformBinDir);
        }
      } catch (dirError) {
        log.error('Error reading directory contents:', dirError.message);
      }
      
      const error = new Error(`Binary validation failed:\n${issues.join('\n')}`);
      error.issues = issues;
      error.diagnostics = {
        baseDir: this.baseDir,
        platformBinDir: this.platformBinDir,
        platformInfo: this.platformInfo,
        binaryPaths: this.binaryPaths
      };
      throw error;
    }
    
    // Check if binaries are executable
    try {
      await fs.access(llamaSwap, fs.constants.F_OK | fs.constants.X_OK);
      await fs.access(llamaServer, fs.constants.F_OK | fs.constants.X_OK);
      log.info('✅ Binaries are executable');
    } catch (error) {
      const execError = new Error(`Binaries exist but are not executable: ${error.message}`);
      log.error(execError.message);
      throw execError;
    }
    
    log.info('✅ Legacy binary validation successful');
    return true;
  }

  binaryExists(binaryPath) {
    try {
      return fsSync.existsSync(binaryPath) && fsSync.statSync(binaryPath).isFile();
    } catch (error) {
      return false;
    }
  }

  // Legacy method for backward compatibility
  getBinaryPath() {
    return this.binaryPaths.llamaSwap;
  }

  getPlatformInfo() {
    return this.platformManager.getPlatformInfo();
  }

  async ensureDirectories() {
    try {
      await fs.mkdir(path.join(os.homedir(), '.clara'), { recursive: true });
      await fs.mkdir(this.modelsDir, { recursive: true });
      
      // Ensure the directory for config files exists
      const configDir = path.dirname(this.configPath);
      await fs.mkdir(configDir, { recursive: true });
      
      log.info(`Models directory ensured at: ${this.modelsDir}`);
      log.info(`Config directory ensured at: ${configDir}`);
    } catch (error) {
      log.error('Error creating directories:', error);
    }
  }

  async scanModels() {
    const models = [];
    const sources = [
      { path: this.modelsDir, source: 'user' },
      { path: path.join(this.baseDir, 'models'), source: 'bundled' }
    ];

    // Add custom model paths
    this.customModelPaths.forEach(customPath => {
      sources.push({ path: customPath, source: 'custom' });
    });

    for (const { path: modelPath, source } of sources) {
      try {
        if (await fs.access(modelPath).then(() => true).catch(() => false)) {
          const files = await fs.readdir(modelPath);
          const ggufFiles = files.filter(file => file.endsWith('.gguf'));
          
          for (const file of ggufFiles) {
            const fullPath = path.join(modelPath, file);
            try {
              const stats = await fs.stat(fullPath);
              
              models.push({
                file: file,
                path: fullPath,
                size: stats.size,
                source: source,
                lastModified: stats.mtime
              });
            } catch (error) {
              log.warn(`Error reading stats for ${file}:`, error);
            }
          }
        }
      } catch (error) {
        log.warn(`Error scanning models in ${modelPath}:`, error);
      }
    }

    return models;
  }

  generateModelName(filename) {
    const raw = filename.replace('.gguf', '');
    const name = raw.toLowerCase();
    
    // Fixed mappings (override everything else)
    const fixedMappings = {
      'mxbai': 'mxbai-embed-large:embed',
    };
    
    for (const key in fixedMappings) {
      if (name.includes(key)) {
        return fixedMappings[key];
      }
    }
    
    // Special case for moondream - extract version number
    if (name.includes('moondream')) {
      const versionMatch = name.match(/moondream[-_.]?(\d+(?:\.\d+)?)/);
      const version = versionMatch ? versionMatch[1] : '2';
      return `moondream:${version}`;
    }
    
    // Try to match size - improved regex to handle various formats
    let size = null;
    
    // Look for patterns like "3B", "8B", "1B" etc.
    const sizeMatch = name.match(/(?:^|[^a-z\d])(\d+(?:\.\d+)?)b(?:[^a-z]|$)/i);
    if (sizeMatch) {
      size = `${sizeMatch[1]}b`;
    }
    
    // Fallback size detection for edge cases
    if (!size) {
      if (name.includes('large')) size = 'large';
      else if (name.includes('medium')) size = 'medium';
      else if (name.includes('small')) size = 'small';
      else size = 'unknown';
    }
    
    // Ordered patterns — first match wins (most specific first)
    const patterns = [
      // TinyLlama patterns - MUST come before Llama patterns
      { 
        regex: /(tinyllama)/i, 
        format: (m) => 'tinyllama' 
      },
      
      // DeepSeek patterns - handle R1 and version numbers
      { 
        regex: /(deepseek[-_.]r\d+(?:[-_.]?\d+)*)/i, 
        format: (m) => m[1].toLowerCase().replace(/[-_.]/g, '-') 
      },
      
      // Nomic embed patterns
      { 
        regex: /(nomic[-_.]?embed[-_.]?text[-_.]?v\d+(?:\.\d+)?)/i, 
        format: (m) => m[1].toLowerCase().replace(/[-_.]/g, '-') 
      },
      
      // Llama patterns - handle version numbers like 3.2
      { 
        regex: /(llama)[-_.]?(\d+(?:\.\d+)?)/i, 
        format: (m) => `llama${m[2]}` 
      },
      
      // Gemma patterns
      { 
        regex: /(gemma)[-_.]?(\d+(?:\.\d+)?)/i, 
        format: (m) => `gemma${m[2]}` 
      },
      
      // Qwen patterns - handle version numbers like 2.5
      { 
        regex: /(qwen)(\d+(?:\.\d+)?)/i, 
        format: (m) => `qwen${m[2]}` 
      },
      
      // Mistral patterns
      { 
        regex: /(mistral)/i, 
        format: (m) => 'mistral' 
      },
      
      // Devstral patterns
      { 
        regex: /(devstral)/i, 
        format: (m) => 'devstral' 
      },
    ];
    
    for (const { regex, format } of patterns) {
      const match = name.match(regex);
      if (match) {
        const base = format(match);
        return size !== 'unknown' ? `${base}:${size}` : base;
      }
    }
    
    // Fallback: clean up the filename and use as-is
    const fallback = raw.toLowerCase().replace(/[-_.]/g, '-');
    return size !== 'unknown' ? `${fallback}:${size}` : fallback;
  }

  /**
   * Start monitoring the main process and any child processes
   * This helps prevent zombie processes and handles cleanup after updates
   */
  startProcessMonitoring() {
    if (this.processMonitor) {
      clearInterval(this.processMonitor);
    }
    
    this.processMonitor = setInterval(() => {
      if (!this.process || this.process.killed) {
        log.warn('Main process lost during monitoring, cleaning up...');
        this.cleanup();
        return;
      }
      
      // Check if process is still responsive
      if (this.isRunning && this.process.pid) {
        try {
          // Send signal 0 to check if process exists (doesn't actually kill it)
          process.kill(this.process.pid, 0);
          
          // Optional: Check if port is still open
          this.checkPortStatus().catch(error => {
            log.debug('Port check failed during monitoring:', error.message);
          });
          
        } catch (error) {
          if (error.code === 'ESRCH') {
            log.warn('Main process no longer exists, cleaning up state...');
            this.cleanup();
          } else if (error.code === 'EPERM') {
            log.debug('Process exists but no permission to signal (this is normal)');
          } else {
            log.warn('Unexpected error during process monitoring:', error.message);
          }
        }
      }
    }, 30000); // Check every 30 seconds
  }
  
  /**
   * Check if the service port is responsive
   */
  async checkPortStatus() {
    try {
      let fetch;
      try {
        fetch = global.fetch || (await import('node-fetch')).default;
      } catch (importError) {
        const nodeFetch = require('node-fetch');
        fetch = nodeFetch.default || nodeFetch;
      }
      
      const response = await Promise.race([
        fetch(`http://localhost:${this.port}/v1/models`),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000))
      ]);
      
      return response.ok;
    } catch (error) {
      throw new Error(`Port ${this.port} not responsive: ${error.message}`);
    }
  }

  async generateConfig() {
    const models = await this.scanModels();
    
    // Separate main models from mmproj files
    const mainModels = models.filter(model => !this.isMmprojModel(model.file));
    const mmprojModels = models.filter(model => this.isMmprojModel(model.file));
    
    // Generate names and handle conflicts
    const modelNames = new Map();
    const nameConflicts = new Map();
    
    // First pass: generate base names and collect all conflicts
    mainModels.forEach((model) => {
      const baseName = this.generateModelName(model.file);
      if (modelNames.has(baseName)) {
        // If this is the first conflict for this name, move the existing model to conflicts
        if (!nameConflicts.has(baseName)) {
          nameConflicts.set(baseName, [modelNames.get(baseName)]);
        }
        // Add this conflicting model to the list
        nameConflicts.get(baseName).push(model);
      } else {
        modelNames.set(baseName, model);
      }
    });
    
    // Second pass: resolve conflicts by adding differentiators
    nameConflicts.forEach((conflictedModels, baseName) => {
      // Remove the original conflicting entry from modelNames
      modelNames.delete(baseName);
      
      // Generate unique names for all conflicting models
      const usedNames = new Set();
      
      conflictedModels.forEach((model, index) => {
        const quantization = this.extractQuantization(model.file);
        const sizeInfo = this.extractFileSizeInfo(model.file, model.size);
        let newName;
        
        if (quantization) {
          // Try quantization-based naming first
          newName = `${baseName.split(':')[0]}:${baseName.split(':')[1]}-${quantization}`;
          
          // If this quantization-based name is also taken, add size info
          if (usedNames.has(newName)) {
            newName = `${baseName.split(':')[0]}:${baseName.split(':')[1]}-${quantization}-${sizeInfo}`;
          }
          
          // If still taken, add index
          if (usedNames.has(newName)) {
            newName = `${baseName.split(':')[0]}:${baseName.split(':')[1]}-${quantization}-${sizeInfo}-v${index + 1}`;
          }
        } else {
          // Use size info and version for models without clear quantization
          newName = `${baseName}-${sizeInfo}-v${index + 1}`;
        }
        
        // Ensure the name is truly unique by adding additional suffixes if needed
        let finalName = newName;
        let suffix = 1;
        while (usedNames.has(finalName) || modelNames.has(finalName)) {
          finalName = `${newName}-${suffix}`;
          suffix++;
        }
        
        // Update the model name and track it
        model.name = finalName;
        usedNames.add(finalName);
        modelNames.set(finalName, model);
        
        log.info(`Resolved name conflict: ${model.file} -> ${finalName}`);
      });
    });
    
    // Assign final names to models that didn't have conflicts
    modelNames.forEach((model, name) => {
      if (!model.name) {
        model.name = name;
      }
    });

    // Load saved performance settings to apply to configuration
    let globalPerfSettings;
    try {
      const savedSettings = await this.loadPerformanceSettings();
      if (savedSettings.success && savedSettings.settings) {
        globalPerfSettings = savedSettings.settings;
        log.info('Applying saved performance settings to configuration:', globalPerfSettings);
        } else {
        globalPerfSettings = this.getSafeDefaultConfig();
        log.info('No saved performance settings found, using safe defaults');
      }
    } catch (error) {
      log.warn('Failed to load performance settings, using safe defaults:', error.message);
      globalPerfSettings = this.getSafeDefaultConfig();
    }
    
    let configYaml = `# Auto-generated llama-swap configuration
# Models directory: ${this.modelsDir}
healthCheckTimeout: 30
logLevel: info

models:
`;

    const groupMembers = [];

    // Generate model configurations with dynamic GPU layer calculation
    for (const model of mainModels) {
      // Use platform-specific llama-server path
      const llamaServerPath = this.binaryPaths.llamaServer;
      
      // Calculate optimal performance configuration for this model
      let perfConfig;
      try {
        // Start with saved performance settings
        perfConfig = { ...globalPerfSettings };
        
        // Apply some model-specific optimizations based on available GPU info
        try {
          const gpuInfo = await this.detectGPUInfo();
          const cpuCores = require('os').cpus().length;
          
          // Apply performance settings to configuration
          if (globalPerfSettings.threads) {
            perfConfig.threads = globalPerfSettings.threads;
          } else {
            // Fallback to auto-detection if not set
            perfConfig.threads = Math.max(1, Math.min(8, Math.floor(cpuCores / 2)));
          }

          // Apply context size from settings
          if (globalPerfSettings.maxContextSize) {
            perfConfig.contextSize = globalPerfSettings.maxContextSize;
          }

          // Apply parallel sequences from settings
          if (globalPerfSettings.parallelSequences) {
            perfConfig.parallelSequences = globalPerfSettings.parallelSequences;
          }

          // Apply optimization flags from settings
          perfConfig.flashAttention = globalPerfSettings.flashAttention !== false;
          perfConfig.optimizeFirstToken = globalPerfSettings.optimizeFirstToken || false;
          perfConfig.aggressiveOptimization = globalPerfSettings.aggressiveOptimization || false;
          perfConfig.enableContinuousBatching = globalPerfSettings.enableContinuousBatching !== false;
          
          // Apply conversation optimization settings
          if (globalPerfSettings.keepTokens) {
            perfConfig.keepTokens = globalPerfSettings.keepTokens;
          }
          if (globalPerfSettings.defragThreshold) {
            perfConfig.defragThreshold = globalPerfSettings.defragThreshold;
          }
          
          log.info(`Model ${model.name}: Applied performance settings - threads:${perfConfig.threads}, context:${perfConfig.contextSize}, flash:${perfConfig.flashAttention}`);
          
        } catch (detectionError) {
          log.warn('GPU detection failed during config generation, using settings as-is:', detectionError.message);
        }
        
      } catch (error) {
        // Use safe defaults if performance calculation fails
        log.warn(`Failed to calculate performance config for ${model.name}, using defaults:`, error.message);
        perfConfig = this.getSafeDefaultConfig();
      }
      
      // Determine GPU layers to use - prioritize user setting over automatic calculation
      let gpuLayersToUse;
      if (globalPerfSettings.gpuLayers !== undefined && globalPerfSettings.gpuLayers !== null) {
        // User has explicitly set GPU layers - use their setting
        gpuLayersToUse = globalPerfSettings.gpuLayers;
        log.info(`Model ${model.name}: Using user-configured GPU layers: ${gpuLayersToUse}`);
      } else {
        // No user setting - calculate optimal GPU layers for this specific model
        gpuLayersToUse = await this.calculateOptimalGPULayers(model.path, model.size);
        log.info(`Model ${model.name}: Using auto-calculated GPU layers: ${gpuLayersToUse}`);
      }
      
      // Find matching mmproj model for this main model
      const matchingMmproj = await this.findMatchingMmproj(model, mmprojModels);
      
      // Use different port for embedding models
      const isEmbedding = this.isEmbeddingModel(model.file);
      const modelPort = isEmbedding ? 9998 : 9999;
      
      let cmdLine = `      "${llamaServerPath}"
      -m "${model.path}"
      --port ${modelPort}`;

      // Add --jinja parameter for all models
      cmdLine += ` --jinja`;
      
      // Add GPU layers based on user setting or calculation
      if (gpuLayersToUse > 0) {
        cmdLine += ` --n-gpu-layers ${gpuLayersToUse}`;
        log.info(`Model ${model.name}: Using ${gpuLayersToUse} GPU layers`);
      } else {
        log.info(`Model ${model.name}: Using CPU only (0 GPU layers)`);
      }
      
      // Add mmproj parameter if a matching mmproj model is found
      if (matchingMmproj) {
        cmdLine += `
      --mmproj "${matchingMmproj.path}"`;
      }
      
      // Add embedding pooling type for embedding models
      log.info(`Model ${model.name}: isEmbeddingModel: ${isEmbedding}, port: ${modelPort}`);
      if (isEmbedding) {
        log.info(`Model ${model.name}: Using embedding pooling type: mean`);
        cmdLine += ` --pooling mean`;
        cmdLine += ` --embeddings`;
        log.info(`Model ${model.name}: Embeddings support enabled`);
      }
      
      // CPU optimization from performance settings
      cmdLine += ` --threads ${perfConfig.threads}`;
      
      // **CRITICAL KV CACHE OPTIMIZATIONS FOR CONVERSATIONAL SPEED**
      
      // 1. Context window optimization - let llama-server auto-detect from model metadata
      // Different models have different native context lengths (8k, 32k, 128k, etc.)
      // llama-server can read this from model metadata and use the optimal size
      let contextSize;
      if (!isEmbedding && perfConfig.contextSize) {
        // User has explicitly set a context size - use their setting (but not for embedding models)
        contextSize = perfConfig.contextSize;
        cmdLine += ` --ctx-size ${contextSize}`;
        log.info(`Model ${model.name}: Using user-configured context size: ${contextSize}`);
      } else if (isEmbedding) {
        // For embedding models, never add context size - let llama-server decide automatically
        log.info(`Model ${model.name}: Embedding model - letting llama-server auto-detect context size`);
        contextSize = 8192; // Default fallback for keep token calculation only (not used in command line)
      } else {
        // No user setting - let llama-server auto-detect from model metadata
        // This allows each model to use its native maximum context length
        log.info(`Model ${model.name}: Using auto-detected context size from model metadata`);
        contextSize = 8192; // Default fallback for keep token calculation only
      }
      
      // 2. Batch size optimization - prioritize user settings over automatic calculation
      let batchSize, ubatchSize;
      if (globalPerfSettings.batchSize !== undefined && globalPerfSettings.ubatchSize !== undefined) {
        // User has explicitly set batch sizes - use their settings
        batchSize = globalPerfSettings.batchSize;
        ubatchSize = globalPerfSettings.ubatchSize;
        log.info(`Model ${model.name}: Using user-configured batch sizes: ${batchSize}/${ubatchSize}`);
      } else {
        // No user setting - calculate optimal batch sizes
        const calculatedSizes = this.calculateTTFTOptimizedBatchSizes(
          model.size / (1024 * 1024 * 1024),
          { hasGPU: gpuLayersToUse > 0, gpuMemoryGB: 16 }
        );
        batchSize = calculatedSizes.batchSize;
        ubatchSize = calculatedSizes.ubatchSize;
        log.info(`Model ${model.name}: Using auto-calculated batch sizes: ${batchSize}/${ubatchSize}`);
      }
      cmdLine += ` --batch-size ${batchSize}`;
      cmdLine += ` --ubatch-size ${ubatchSize}`;
      
      // 3. KV Cache retention for fast subsequent responses - use saved setting or calculate
      const keepTokens = perfConfig.keepTokens || Math.min(1024, Math.floor(contextSize * 0.25));
      cmdLine += ` --keep ${keepTokens}`;
      
      // 4. Cache efficiency settings - use saved setting or default
      const defragThreshold = perfConfig.defragThreshold || 0.1;
      cmdLine += ` --defrag-thold ${defragThreshold}`;
      
      // 5. Memory optimization for conversations - respect user setting
      if (globalPerfSettings.memoryLock !== false) {
        cmdLine += ` --mlock`; // Lock model in memory for consistent performance
        log.info(`Model ${model.name}: Memory lock enabled`);
      } else {
        log.info(`Model ${model.name}: Memory lock disabled by user setting`);
      }
      
      // 6. Parallel processing optimization - use saved setting
      cmdLine += ` --parallel ${perfConfig.parallelSequences || 1}`;
      
      // 7. Flash attention if enabled in settings
      if (perfConfig.flashAttention) {
        cmdLine += ` --flash-attn`;
      }
      
      // 8. Continuous batching for better multi-turn performance - use saved setting
      if (perfConfig.enableContinuousBatching && !perfConfig.optimizeFirstToken) {
        cmdLine += ` --cont-batching`;
      }
      
      // 9. Cache type optimization
      if (perfConfig.kvCacheType && perfConfig.kvCacheType !== 'f16') {
        cmdLine += ` --cache-type-k ${perfConfig.kvCacheType}`;
        cmdLine += ` --cache-type-v ${perfConfig.kvCacheType}`;
      }
      
      // 10. Context shift for handling long conversations - DISABLED (not supported by llama-server yet)
      // if (perfConfig.enableContextShift !== false && !isEmbedding) {
      //   cmdLine += ` --ctx-shift`;
      //   log.info(`Model ${model.name}: Context shift enabled for long conversations`);
      // }
      
      // TTFT-specific optimizations (only when explicitly enabled in settings)
      if (perfConfig.optimizeFirstToken) {
        log.info(`Model ${model.name}: TTFT mode enabled - optimizing for first token speed`);
        
        // Use fewer threads for batch processing to reduce contention during prefill
        const batchThreads = Math.max(1, Math.floor(perfConfig.threads / 2));
        cmdLine += ` --threads-batch ${batchThreads}`;
        
        // Skip warmup to get to first token faster (warmup is for benchmarking)
        cmdLine += ` --no-warmup`;
        
        // TTFT mode: smaller context for faster initial response (only if user set explicit context and not embedding model)
        if (!isEmbedding && perfConfig.contextSize) {
          const ttftContextSize = Math.min(8192, contextSize);
          cmdLine = cmdLine.replace(`--ctx-size ${contextSize}`, `--ctx-size ${ttftContextSize}`);
          log.info(`Model ${model.name}: TTFT context override: ${ttftContextSize}`);
        } else if (!isEmbedding) {
          // For auto-detected context, add a reasonable TTFT limit (but not for embedding models)
          cmdLine += ` --ctx-size 8192`;
          log.info(`Model ${model.name}: TTFT context limit: 8192 (overriding auto-detection for speed)`);
        } else {
          log.info(`Model ${model.name}: Embedding model - skipping TTFT context override, letting llama-server decide`);
        }
        
        // TTFT mode: more aggressive cache clearing for speed over efficiency
        cmdLine = cmdLine.replace(`--defrag-thold ${defragThreshold}`, `--defrag-thold 0.05`);
        
        // TTFT mode: disable continuous batching
        cmdLine = cmdLine.replace(` --cont-batching`, '');
        
        log.info(`Model ${model.name}: TTFT optimizations applied - keep: ${keepTokens}`);
      } else {
        log.info(`Model ${model.name}: Conversational mode - optimizing for multi-turn chat speed`);
        if (perfConfig.contextSize) {
          log.info(`Model ${model.name}: Context: ${contextSize}, Keep: ${keepTokens}, Batch: ${batchSize}`);
        } else {
          log.info(`Model ${model.name}: Context: auto-detected, Keep: ${keepTokens}, Batch: ${batchSize}`);
        }
      }
      
      // Get platform-specific environment variables for the model process
      const platformEnv = this.platformManager.getPlatformEnvironment();
      
      // Build environment variables array for the YAML config
      let envVars = [];
      if (this.platformInfo.isLinux && platformEnv.LD_LIBRARY_PATH) {
        envVars.push(`LD_LIBRARY_PATH=${platformEnv.LD_LIBRARY_PATH}`);
      } else if (this.platformInfo.isMac && platformEnv.DYLD_LIBRARY_PATH) {
        envVars.push(`DYLD_LIBRARY_PATH=${platformEnv.DYLD_LIBRARY_PATH}`);
      }
      
      // Add CUDA environment variables if available
      if (process.env.CUDA_VISIBLE_DEVICES) {
        envVars.push(`CUDA_VISIBLE_DEVICES=${process.env.CUDA_VISIBLE_DEVICES}`);
      }
      
      configYaml += `  "${model.name}":
    proxy: "http://127.0.0.1:${modelPort}"
    cmd: |
${cmdLine}`;

      // Add environment variables if any are needed
      if (envVars.length > 0) {
        configYaml += `
    env:`;
        envVars.forEach(envVar => {
          configYaml += `
      - "${envVar}"`;
        });
      }

      configYaml += `
    ttl: 300

`;
      
      groupMembers.push(model.name);
    }

    // Separate models into embedding and regular groups
    const embeddingModels = [];
    const regularModels = [];
    
    groupMembers.forEach(memberName => {
      const model = mainModels.find(m => m.name === memberName);
      if (model && this.isEmbeddingModel(model.file)) {
        embeddingModels.push(memberName);
      } else {
        regularModels.push(memberName);
      }
    });

    // Add groups configuration
    configYaml += `groups:`;
    
    // Embedding models group - persistent and non-exclusive so they can run alongside other models
    if (embeddingModels.length > 0) {
      configYaml += `
  "embedding_models":
    # Allow multiple embedding models to run together
    swap: false
    # Don't unload other groups when embedding models start
    exclusive: false
    # Prevent other groups from unloading embedding models
    persistent: true
    members:
`;
      embeddingModels.forEach(member => {
        configYaml += `      - "${member}"\n`;
      });
    }
    
    // Regular models group - traditional swapping behavior
    if (regularModels.length > 0) {
      configYaml += `
  "regular_models":
    # Only one regular model at a time (traditional behavior)
    swap: true
    # Unload other non-persistent groups when loading
    exclusive: true
    members:
`;
      regularModels.forEach(member => {
        configYaml += `      - "${member}"\n`;
      });
    }

    await fs.writeFile(this.configPath, configYaml);
    log.info('Dynamic config generated with', mainModels.length, 'models using saved performance settings');
    
    return { models: mainModels.length };
  }

  // Helper method to check if a file is an mmproj model
  isMmprojModel(filename) {
    return filename.toLowerCase().includes('mmproj') || 
           filename.toLowerCase().includes('mm-proj') ||
           filename.toLowerCase().includes('projection');
  }

  // Helper method to find matching mmproj model for a main model
  async findMatchingMmproj(mainModel, mmprojModels) {
    const mainModelName = mainModel.name.toLowerCase();
    const mainModelFile = mainModel.file.toLowerCase();
    
    log.info(`Looking for mmproj model for: ${mainModel.name}`);
    
    // Track whether we have any saved mappings system at all
    let hasSavedMappingsSystem = false;
    let foundValidSavedMapping = false;
    
    // FIRST: Check for saved mmproj mappings (highest priority)
    try {
      const mappingsResult = await this.loadMmprojMappings();
      if (mappingsResult.success && mappingsResult.mappings) {
        hasSavedMappingsSystem = true; // We have a mappings system
        const mappingsCount = Object.keys(mappingsResult.mappings).length;
        log.info(`🔍 Checking ${mappingsCount} saved mmproj mappings for model: ${mainModel.name}`);
        
        const savedMapping = mappingsResult.mappings[mainModel.path];
        if (savedMapping && savedMapping.mmprojPath) {
          log.info(`📌 Found saved mmproj mapping for ${mainModel.name}: ${savedMapping.mmprojPath}`);
          
          // Verify the mapped mmproj file still exists
          if (fsSync.existsSync(savedMapping.mmprojPath)) {
            log.info(`✅ Using saved mmproj mapping: ${savedMapping.mmprojName} for ${mainModel.name} (${savedMapping.isManual ? 'manual' : 'automatic'})`);
            foundValidSavedMapping = true;
            return {
              name: savedMapping.mmprojName,
              file: savedMapping.mmprojName,
              path: savedMapping.mmprojPath,
              source: savedMapping.isManual ? 'manual' : 'automatic',
              isFromSavedMapping: true
            };
          } else {
            log.warn(`⚠️ Saved mmproj mapping points to non-existent file: ${savedMapping.mmprojPath}`);
            // Continue to automatic detection as fallback
          }
        } else {
          log.info(`📝 No saved mapping found for model: ${mainModel.name} (${mainModel.path})`);
        }
      } else {
        log.info(`📂 No mmproj mappings file found - will use automatic detection for ${mainModel.name}`);
      }
    } catch (error) {
      log.warn('Error loading saved mmproj mappings:', error.message);
      // Continue to automatic detection as fallback
    }
    
    // SECOND: Try to find a specifically matching mmproj model by name (automatic detection)
    // ONLY if no saved mappings system exists - this prevents overriding user's manual assignments
    if (!hasSavedMappingsSystem) {
      const mainModelBaseName = this.getModelBaseName(mainModel.file);
      
      for (const mmprojModel of mmprojModels) {
        const mmprojBaseName = this.getModelBaseName(mmprojModel.file);
        
        // Check if they share a common base name (e.g., "Qwen2.5-VL-7B")
        if (this.modelsMatch(mainModelBaseName, mmprojBaseName)) {
          log.info(`Found matching mmproj model: ${mmprojModel.file} for ${mainModel.name} (no saved mappings exist)`);
          return mmprojModel;
        }
      }
    } else {
      log.info(`🚫 Automatic name-based mmproj detection skipped for ${mainModel.name} - respecting user's saved mappings system`);
    }
    
    // Special handling for gemma models - ONLY if no saved mappings system exists
    // This prevents overriding user's manual mmproj assignments
    if (!hasSavedMappingsSystem && (mainModelName.includes('gemma') || mainModelFile.includes('gemma'))) {
      log.info(`Gemma model detected: ${mainModel.name}, no saved mappings exist - checking for compatible mmproj...`);
      
      // Check multiple possible locations for the mmproj file
      const possiblePaths = [
        path.join(this.baseDir, 'models', 'mmproj-model-f16.gguf'),
        path.join(this.modelsDir, 'mmproj-model-f16.gguf'),
        path.join(this.baseDir, 'mmproj-model-f16.gguf')
      ];
      
      // Also check if there's already a mmproj model in the scanned models
      const existingMmproj = mmprojModels.find(m => m.file === 'mmproj-model-f16.gguf');
      if (existingMmproj) {
        log.info(`Found existing generic mmproj model for Gemma: ${existingMmproj.path}`);
        log.warn(`⚠️ Using generic mmproj - may cause embedding dimension mismatch. Consider downloading model-specific mmproj.`);
        return existingMmproj;
      }
      
      // Check each possible path
      for (const bundledMmprojPath of possiblePaths) {
        log.info(`Checking mmproj path: ${bundledMmprojPath}`);
        if (fsSync.existsSync(bundledMmprojPath)) {
          log.info(`Found bundled mmproj for Gemma model at: ${bundledMmprojPath}`);
          log.warn(`⚠️ Using generic bundled mmproj - may cause embedding dimension mismatch. Consider downloading model-specific mmproj.`);
          return {
            name: 'mmproj-model-f16',
            file: 'mmproj-model-f16.gguf',
            path: bundledMmprojPath,
            source: 'bundled'
          };
        }
      }
      
      log.warn(`Gemma model detected but no compatible mmproj file found. Checked paths:`, possiblePaths);
    } else if (hasSavedMappingsSystem && (mainModelName.includes('gemma') || mainModelFile.includes('gemma'))) {
      log.info(`🚫 Gemma model detected but saved mappings system exists - respecting user's mmproj choices for ${mainModel.name}`);
    }
    
    // For vision/multimodal models that don't have a specific mmproj match,
    // check if this appears to be a vision model and use bundled mmproj as fallback
    // ONLY if no saved mappings system exists - this prevents overriding user's choices
    if (!hasSavedMappingsSystem && this.isVisionModel(mainModel.file)) {
      const bundledMmprojPath = path.join(this.baseDir, 'models', 'mmproj-model-f16.gguf');
      
      if (fsSync.existsSync(bundledMmprojPath)) {
        log.info(`Using bundled mmproj for vision model: ${mainModel.name} (no saved mappings exist)`);
        log.warn(`⚠️ Using generic bundled mmproj - may cause embedding dimension mismatch. Consider downloading model-specific mmproj.`);
        return {
          name: 'mmproj-model-f16',
          file: 'mmproj-model-f16.gguf',
          path: bundledMmprojPath,
          source: 'bundled'
        };
      }
    } else if (hasSavedMappingsSystem && this.isVisionModel(mainModel.file)) {
      log.info(`🚫 Vision model detected but saved mappings system exists - respecting user's mmproj choices for ${mainModel.name}`);
    }
    
    log.info(`ℹ️ No mmproj model found for ${mainModel.name} - model will run without multimodal capabilities`);
    return null;
  }

  // Helper method to detect vision/multimodal models
  isVisionModel(filename) {
    const visionKeywords = ['vl', 'vision', 'multimodal', 'mm', 'clip', 'siglip'];
    const lowerFilename = filename.toLowerCase();
    
    return visionKeywords.some(keyword => lowerFilename.includes(keyword));
  }

  // Helper method to detect embedding models
  isEmbeddingModel(filename) {
    const embeddingKeywords = [
      'embed', 'embedding', 'embeddings',
      'mxbai', 'nomic', 'bge', 'e5',
      'sentence-transformer', 'sentence_transformer',
      'all-minilm', 'all_minilm'
    ];
    const lowerFilename = filename.toLowerCase();
    
    return embeddingKeywords.some(keyword => lowerFilename.includes(keyword));
  }

  // Helper method to extract base model name from filename
  getModelBaseName(filename) {
    return filename
      .replace('.gguf', '')
      .replace(/-(mmproj|mm-proj|projection).*$/i, '')
      .replace(/-(q4_k_m|q4_k_s|q8_0|f16|instruct).*$/i, '')
      .toLowerCase();
  }

  // Helper method to check if two model names match
  modelsMatch(baseName1, baseName2) {
    // Remove common suffixes and compare
    const normalized1 = baseName1.replace(/-(instruct|chat|it)$/i, '');
    const normalized2 = baseName2.replace(/-(instruct|chat|it)$/i, '');
    
    return normalized1 === normalized2 || 
           normalized1.includes(normalized2) || 
           normalized2.includes(normalized1);
  }

  async start() {
    if (this.ipcLogger) {
      this.ipcLogger.logServiceCall('LlamaSwapService', 'start');
    }
    
    // Prevent concurrent start attempts
    if (this.isRunning) {
      log.info('Llama-swap service is already running');
      return { success: true, message: 'Service already running' };
    }
    
    if (this.isStarting) {
      log.info('Llama-swap service is already starting, waiting for completion...');
      // Wait for the current start attempt to complete
      let attempts = 0;
      while (this.isStarting && attempts < 30) { // Wait up to 30 seconds
        await new Promise(resolve => setTimeout(resolve, 1000));
        attempts++;
      }
      
      if (this.isRunning) {
        return { success: true, message: 'Service started by concurrent request' };
      } else {
        return { success: false, error: 'Concurrent start attempt failed or timed out' };
      }
    }
    
    this.isStarting = true;
    
    try {
      // Reset retry flags for fresh start attempt
      this.flashAttentionRetryAttempted = false;
      this.portRetryAttempted = false;
      this.handleFlashAttentionRequired = false;
      this.needsPortRetry = false;

      // Check for stale processes after updates
      await this.cleanupStaleProcesses();

      // macOS Security Pre-check - Prepare for potential firewall prompts
      if (process.platform === 'darwin') {
        log.info('🔒 macOS detected - checking network security requirements...');
        
        if (this.ipcLogger) {
          this.ipcLogger.logServiceCall('LlamaSwapService', 'macOS-security-check');
        }
        
        // Check if port is already in use (could indicate permission issues)
        try {
          const net = require('net');
          const server = net.createServer();
          
          await new Promise((resolve, reject) => {
            server.listen(this.port, '127.0.0.1', () => {
              server.close();
              resolve(true);
            });
            
            server.on('error', (err) => {
              if (err.code === 'EADDRINUSE') {
                log.warn(`⚠️ Port ${this.port} already in use - may indicate permission or conflict issues`);
              }
              reject(err);
            });
          });
          
          log.info('✅ Port availability check passed');
        } catch (portError) {
          if (portError.code === 'EADDRINUSE') {
            log.warn(`⚠️ Port ${this.port} is already in use. This may cause permission prompts.`);
          }
          if (this.ipcLogger) {
            this.ipcLogger.logError('LlamaSwapService.portCheck', portError);
          }
        }
        
        log.info('🔓 Network security check complete. Starting service...');
        log.info('💡 If macOS shows a firewall prompt, please click "Allow" to enable local AI functionality.');
      }

      // Verify and repair binaries after potential updates
      log.info('🔧 Verifying binary integrity after potential updates...');
      await this.verifyAndRepairBinariesAfterUpdate();

      // Validate binaries before attempting to start
      log.info('Validating binaries before startup...');
      await this.validateBinaries();
      
      // Ensure models directory and config exist
      await this.ensureDirectories();
      await this.generateConfig();

      log.info('Starting llama-swap service...');
      log.info(`Platform: ${this.platformInfo.platformDir}`);
      log.info(`Binary path: ${this.binaryPaths.llamaSwap}`);
      log.info(`Config path: ${this.configPath}`);
      log.info(`Port: ${this.port}`);

      // Fixed command line arguments according to the binary's help output
      const args = [
        '-config', this.configPath,
        '-listen', `127.0.0.1:${this.port}` // Bind to localhost only for better security
      ];

      log.info(`Starting with args: ${args.join(' ')}`);
      
      if (this.ipcLogger) {
        this.ipcLogger.logProcessSpawn(this.binaryPaths.llamaSwap, args, {
          port: this.port,
          config: this.configPath
        });
      }

      // Final port check right before spawning - catch any lingering processes
      log.info('🔍 Performing final port availability check...');
      await this.killProcessesOnPort(this.port);
      
      // Double-check port is actually free by trying to bind to it briefly
      try {
        const net = require('net');
        const testServer = net.createServer();
        
        await new Promise((resolve, reject) => {
          testServer.listen(this.port, '127.0.0.1', () => {
            testServer.close();
            log.info(`✅ Port ${this.port} is available for use`);
            resolve();
          });
          
          testServer.on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
              log.error(`❌ Port ${this.port} is still in use after cleanup attempts`);
              reject(new Error(`Port ${this.port} is still in use after cleanup. Please manually stop any processes using this port.`));
            } else {
              reject(err);
            }
          });
        });
      } catch (portError) {
        if (this.ipcLogger) {
          this.ipcLogger.logError('LlamaSwapService.finalPortCheck', portError);
        }
        throw portError;
      }

      this.process = spawn(this.binaryPaths.llamaSwap, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: this.platformManager.getPlatformEnvironment(),
        detached: false
      });

      this.isRunning = true;
      
      if (this.ipcLogger) {
        this.ipcLogger.logServiceCall('LlamaSwapService', 'processSpawned', { pid: this.process.pid });
      }
      
      // Start process monitoring to prevent zombie processes after updates
      this.startProcessMonitoring();

      // Handle process output
      this.process.stdout.on('data', (data) => {
        const output = data.toString();
        log.info(`llama-swap stdout: ${output.trim()}`);
        
        // Parse progress information for UI feedback
        this.parseProgressFromOutput(output);
        
        // Check for successful startup - look for different possible success messages
        if (output.includes(`listening on`) || 
            output.includes(`server started`) ||
            output.includes(`:${this.port}`)) {
          log.info(`llama-swap service started successfully on port ${this.port}`);
          if (this.ipcLogger) {
            this.ipcLogger.logServiceCall('LlamaSwapService', 'startupSuccess', { port: this.port });
          }
        }
        
        this.parseProgressFromOutput(output);
      });

      this.process.stderr.on('data', (data) => {
        const error = data.toString();
        log.error(`llama-swap stderr: ${error.trim()}`);
        
        if (this.ipcLogger) {
          this.ipcLogger.logServiceCall('LlamaSwapService', 'stderr', { error: error.trim() });
        }
        
        // Check for V cache quantization error that requires flash attention
        if (error.includes('V cache quantization requires flash_attn') || 
            error.includes('failed to create context with model')) {
          log.warn('⚠️ Model requires flash attention for V cache quantization - will retry with flash attention enabled');
          this.handleFlashAttentionRequired = true;
        }
        
        // Enhanced error handling for common issues
        if (error.includes('bind: address already in use') || 
            error.includes('bind: Only one usage of each socket address')) {
          log.error(`❌ Port ${this.port} is already in use - attempting automatic cleanup and retry`);
          
          // Mark for automatic retry with port cleanup
          this.needsPortRetry = true;
        }
        if (error.includes('no such file or directory')) {
          log.error('❌ Binary or config file not found');
        }
        if (error.includes('permission denied') || error.includes('Operation not permitted')) {
          log.error('🔒 Permission denied - this may be due to macOS security restrictions.');
          log.error('💡 If you saw a firewall prompt, make sure you clicked "Allow".');
          log.error('🔧 To fix: Go to System Preferences → Security & Privacy → Firewall → Firewall Options');
          log.error('📝 Find your Clara app and ensure it\'s set to "Allow incoming connections"');
        }
        if (error.includes('bind') && error.includes('cannot assign requested address')) {
          log.error('🌐 Network binding failed - possible firewall or permission issue');
          log.error('💡 This often happens if macOS firewall permission was denied');
        }
      });

      this.process.on('close', (code) => {
        log.info(`llama-swap process exited with code ${code}`);
        this.isRunning = false;
        this.process = null;
        
        if (this.ipcLogger) {
          this.ipcLogger.logProcessExit('llama-swap', code);
        }
        
        if (code !== 0 && code !== null) {
          log.error(`llama-swap service failed with exit code ${code}`);
          
          // If we detected a flash attention requirement, mark for retry
          if (this.handleFlashAttentionRequired) {
            log.info('🔄 Preparing automatic retry with flash attention enabled...');
          }
        }
      });

      this.process.on('error', (error) => {
        log.error('Failed to start llama-swap service:', error);
        this.isRunning = false;
        this.process = null;
      });

      // Wait a bit to see if the process starts successfully
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Check if process is still running (didn't exit immediately due to error)
      if (this.process && !this.process.killed) {
        log.info('llama-swap process is running, checking if service is responding...');
        
        // Try to check if the service is actually responding
        try {
          await this.waitForService(10); // Wait up to 10 seconds
          log.info('llama-swap service is responding to requests');
          return { success: true, message: 'Service started successfully' };
        } catch (serviceError) {
          log.warn('llama-swap process started but service is not responding:', serviceError.message);
          return { success: true, message: 'Service started but not responding yet', warning: serviceError.message };
        }
      } else {
        this.isRunning = false;
        
        // Check if we need to retry with flash attention enabled
        if (this.handleFlashAttentionRequired && !this.flashAttentionRetryAttempted) {
          log.info('🔄 Automatically retrying with flash attention enabled...');
          this.flashAttentionRetryAttempted = true;
          this.handleFlashAttentionRequired = false;
          
          // Force regenerate config with flash attention enabled
          await this.enableFlashAttentionAndRegenerate();
          
          // Recursive retry
          this.isStarting = false; // Reset flag before recursive call
          return await this.start();
        }
        
        // Check if we need to retry due to port binding issues
        if (this.needsPortRetry && !this.portRetryAttempted) {
          log.info('🔄 Automatically retrying after port cleanup...');
          this.portRetryAttempted = true;
          this.needsPortRetry = false;
          
          // Force kill all processes on the port
          await this.killProcessesOnPort(this.port);
          
          // Wait a bit longer for cleanup
          await new Promise(resolve => setTimeout(resolve, 5000));
          
          // Recursive retry
          this.isStarting = false; // Reset flag before recursive call
          return await this.start();
        }
        
        const errorMsg = this.handleFlashAttentionRequired 
          ? 'Model requires flash attention but retry failed. Please enable flash attention in GPU Diagnostics → Performance Settings.'
          : 'llama-swap process failed to start or exited immediately';
        log.error(errorMsg);
        return { success: false, error: errorMsg };
      }
    } catch (error) {
      log.error('Error starting llama-swap service:', error);
      this.isRunning = false;
      this.process = null;
      
      return { 
        success: false, 
        error: error.message,
        diagnostics: error.diagnostics || null
      };
    } finally {
      // Always reset the starting flag
      this.isStarting = false;
    }
  }

  async waitForService(maxAttempts = 30) {
    let fetch;
    try {
      fetch = global.fetch || (await import('node-fetch')).default;
    } catch (importError) {
      // Fallback for older Node versions or import issues
      const nodeFetch = require('node-fetch');
      fetch = nodeFetch.default || nodeFetch;
    }

    for (let i = 0; i < maxAttempts; i++) {
      try {
        const response = await fetch(`http://localhost:${this.port}/v1/models`);
        if (response.ok) {
          return true;
        }
      } catch (error) {
        // Service not ready yet
        log.debug(`Service check attempt ${i + 1}/${maxAttempts} failed:`, error.message);
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    throw new Error('llama-swap service failed to start within timeout period');
  }

  async stop() {
    if (!this.isRunning || !this.process) {
      log.info('Llama-swap service is not running');
      return true;
    }

    return new Promise((resolve) => {
      log.info('Stopping llama-swap service...');
      
      // Enhanced timeout with graceful degradation
      const timeout = setTimeout(() => {
        if (this.process) {
          log.warn('Graceful shutdown timeout, attempting force kill...');
          
          // Try different kill signals in sequence
          try {
            this.process.kill('SIGKILL');
          } catch (killError) {
            log.warn('SIGKILL failed, trying alternative methods:', killError.message);
            
            // On Windows, try taskkill as fallback
            if (process.platform === 'win32' && this.process.pid) {
              try {
                const { spawn } = require('child_process');
                spawn('taskkill', ['/F', '/T', '/PID', this.process.pid.toString()], {
                  stdio: 'ignore'
                });
                log.info('Used taskkill as fallback for process termination');
              } catch (taskillError) {
                log.warn('Taskkill fallback also failed:', taskillError.message);
              }
            }
          }
        }
        this.cleanup();
        resolve(true);
      }, 8000); // Increased timeout for updated binaries

      this.process.once('close', () => {
        clearTimeout(timeout);
        this.cleanup();
        log.info('llama-swap service stopped gracefully');
        resolve(true);
      });

      this.process.once('error', (error) => {
        clearTimeout(timeout);
        log.warn('Error during stop process:', error.message);
        this.cleanup();
        resolve(true);
      });

      // Try graceful shutdown first
      try {
        this.process.kill('SIGTERM');
      } catch (error) {
        log.warn('SIGTERM failed, will use timeout fallback:', error.message);
        // Let timeout handle the force kill
      }
    });
  }

  cleanup() {
    this.isRunning = false;
    this.isStarting = false; // Reset starting flag
    this.process = null;
    // Reset flash attention retry flags for next start attempt
    this.handleFlashAttentionRequired = false;
    this.flashAttentionRetryAttempted = false;
    this.forceFlashAttention = false;
    
    // Additional cleanup for updated binaries
    // Clear any cached process references
    if (this.processMonitor) {
      clearInterval(this.processMonitor);
      this.processMonitor = null;
    }
  }

  async restart() {
    log.info('Restarting llama-swap service...');
    await this.stop();
    
    // Additional cleanup to ensure fresh start after updates
    this.cleanup();
    
    // Longer wait time to ensure process cleanup after binary updates
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Regenerate config to ensure compatibility with updated binaries
    try {
      await this.generateConfig();
      log.info('Configuration regenerated for updated binaries');
    } catch (configError) {
      log.warn('Config regeneration failed, using existing config:', configError.message);
    }
    
    return await this.start();
  }

  getStatus() {
    // First check if we have a process reference
    const hasProcess = this.process && !this.process.killed;
    
    return {
      isRunning: this.isRunning && hasProcess,
      isStarting: this.isStarting, // Include starting status for debugging
      port: this.port,
      pid: this.process?.pid,
      apiUrl: `http://localhost:${this.port}`,
      processExists: hasProcess,
      flagStatus: this.isRunning
    };
  }

  // Add a new method to check if service is actually responding
  async getStatusWithHealthCheck() {
    if (this.ipcLogger) {
      this.ipcLogger.logServiceCall('LlamaSwapService', 'getStatusWithHealthCheck');
    }
    
    const basicStatus = this.getStatus();
    
    // If we think it's not running, return early
    if (!basicStatus.isRunning) {
      if (this.ipcLogger) {
        this.ipcLogger.logServiceCall('LlamaSwapService', 'getStatusWithHealthCheck', null, { 
          isRunning: false, 
          healthCheck: 'not-running' 
        });
      }
      return basicStatus;
    }
    
    // Try to make a quick health check
    try {
      if (this.ipcLogger) {
        this.ipcLogger.logHttpRequest('GET', `http://localhost:${this.port}/v1/models`);
      }
      
      let fetch;
      try {
        fetch = global.fetch || (await import('node-fetch')).default;
      } catch (importError) {
        const nodeFetch = require('node-fetch');
        fetch = nodeFetch.default || nodeFetch;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000); // 2 second timeout
      
      const response = await fetch(`http://localhost:${this.port}/v1/models`, {
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      const result = {
        ...basicStatus,
        isResponding: response.ok,
        healthCheck: response.ok ? 'passed' : 'failed'
      };
      
      if (this.ipcLogger) {
        this.ipcLogger.logHttpResponse('GET', `http://localhost:${this.port}/v1/models`, response.status);
        this.ipcLogger.logServiceCall('LlamaSwapService', 'getStatusWithHealthCheck', null, result);
      }
      
      return result;
    } catch (error) {
      const result = {
        ...basicStatus,
        isResponding: false,
        healthCheck: 'failed',
        healthError: error.message
      };
      
      if (this.ipcLogger) {
        this.ipcLogger.logError('LlamaSwapService.healthCheck', error);
        this.ipcLogger.logServiceCall('LlamaSwapService', 'getStatusWithHealthCheck', null, result);
      }
      
      return result;
    }
  }

  async getModels() {
    if (!this.isRunning) {
      return [];
    }

    try {
      let fetch;
      try {
        fetch = global.fetch || (await import('node-fetch')).default;
      } catch (importError) {
        const nodeFetch = require('node-fetch');
        fetch = nodeFetch.default || nodeFetch;
      }

      const response = await fetch(`http://localhost:${this.port}/v1/models`);
      if (response.ok) {
        const data = await response.json();
        return data.data || [];
      }
    } catch (error) {
      log.error('Error fetching models from llama-swap:', error);
    }
    
    return [];
  }

  async downloadModel(modelUrl, modelName) {
    // This would be implemented to download models from Hugging Face or other sources
    // For now, this is a placeholder
    log.info(`Download model functionality to be implemented: ${modelName} from ${modelUrl}`);
    throw new Error('Model download functionality not yet implemented');
  }

  getApiUrl() {
    return `http://localhost:${this.port}`;
  }

  // Helper method to extract quantization info
  extractQuantization(filename) {
    // Check for common quantization patterns in order of specificity
    const quantMatch = filename.toLowerCase().match(/(q4_k_m|q4_k_s|q5_k_m|q5_k_s|q6_k|q8_0|f16|f32|q4_0|q4_1|q5_0|q5_1|q2_k|q3_k_m|q3_k_s|q3_k_l|iq3_xxs|iq3_xs|iq3_s|iq3_m|iq4_xs|iq4_nl)/i);
    if (quantMatch) {
      return quantMatch[1].toLowerCase();
    }
    
    // Check for other patterns like IQ (IMatrix quantization)
    const iqMatch = filename.toLowerCase().match(/(iq\d+_\w+)/i);
    if (iqMatch) {
      return iqMatch[1].toLowerCase();
    }
    
    // Check for BitNet patterns
    const bitnetMatch = filename.toLowerCase().match(/(1\.58|bitnet)/i);
    if (bitnetMatch) {
      return 'bitnet';
    }
    
    return null;
  }

  // Helper method to extract file size as a differentiator
  extractFileSizeInfo(filename, fileSizeBytes) {
    // Convert file size to GB and create a readable size indicator
    const sizeGB = fileSizeBytes / (1024 * 1024 * 1024);
    
    if (sizeGB < 1) {
      return 'xs'; // Extra small
    } else if (sizeGB < 3) {
      return 's'; // Small
    } else if (sizeGB < 6) {
      return 'm'; // Medium
    } else if (sizeGB < 12) {
      return 'l'; // Large
    } else {
      return 'xl'; // Extra large
    }
  }

  /**
   * Detect GPU capabilities and memory
   */
  async detectGPUInfo() {
    if (this.gpuInfo) {
      return this.gpuInfo;
    }

    const platform = os.platform();
    let gpuMemoryMB = 0;
    let hasGPU = false;
    let gpuType = 'unknown';

    try {
      if (platform === 'darwin') {
        // For macOS, try to detect Metal/Apple Silicon info
        const systemInfo = await this.getMacOSGPUInfo();
        gpuMemoryMB = systemInfo.gpuMemoryMB;
        hasGPU = systemInfo.hasGPU;
        gpuType = systemInfo.gpuType;
      } else if (platform === 'win32') {
        // For Windows, try to detect NVIDIA/AMD/Intel GPU
        const systemInfo = await this.getWindowsGPUInfo();
        gpuMemoryMB = systemInfo.gpuMemoryMB;
        hasGPU = systemInfo.hasGPU;
        gpuType = systemInfo.gpuType;
      } else {
        // For Linux, try to detect GPU via nvidia-smi or other methods
        const systemInfo = await this.getLinuxGPUInfo();
        gpuMemoryMB = systemInfo.gpuMemoryMB;
        hasGPU = systemInfo.hasGPU;
        gpuType = systemInfo.gpuType;
      }
    } catch (error) {
      log.warn('Failed to detect GPU info:', error.message);
    }

    // Fallback estimation based on system memory and platform
    if (!hasGPU || gpuMemoryMB === 0) {
      const estimatedInfo = this.estimateGPUCapabilities();
      gpuMemoryMB = estimatedInfo.gpuMemoryMB;
      hasGPU = estimatedInfo.hasGPU;
      gpuType = estimatedInfo.gpuType;
    }

    this.gpuInfo = {
      hasGPU,
      gpuMemoryMB,
      gpuMemoryGB: Math.round(gpuMemoryMB / 1024 * 10) / 10,
      gpuType,
      systemMemoryGB: this.systemMemoryGB,
      platform
    };

    log.info('GPU Detection Results:', this.gpuInfo);
    return this.gpuInfo;
  }

  /**
   * Get macOS GPU information using system_profiler
   */
  async getMacOSGPUInfo() {
    return new Promise((resolve) => {
      const { spawn } = require('child_process');
      
      // Try to get GPU info from system_profiler
      const process = spawn('system_profiler', ['SPDisplaysDataType', '-json'], {
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let stdout = '';
      process.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      process.on('close', (code) => {
        try {
          if (code === 0 && stdout) {
            const displayData = JSON.parse(stdout);
            const displays = displayData.SPDisplaysDataType || [];
            
            let maxMemoryMB = 0;
            let gpuType = 'integrated';
            
            displays.forEach(display => {
              // Check for VRAM information
              if (display.sppci_model && display.sppci_model.includes('Apple')) {
                gpuType = 'apple_silicon';
                // For Apple Silicon, estimate based on unified memory
                // Apple Silicon shares memory, so use a portion of system memory
                const systemMemoryGB = Math.round(os.totalmem() / (1024 * 1024 * 1024));
                if (systemMemoryGB >= 32) {
                  maxMemoryMB = 16384; // 16GB for high-end systems
                } else if (systemMemoryGB >= 16) {
                  maxMemoryMB = 8192; // 8GB for mid-range
                } else {
                  maxMemoryMB = 4096; // 4GB for entry-level
                }
              } else if (display.sppci_vram) {
                // Dedicated GPU with VRAM
                const vramStr = display.sppci_vram;
                const vramMatch = vramStr.match(/(\d+)/);
                if (vramMatch) {
                  const vramMB = parseInt(vramMatch[1]);
                  if (vramMB > maxMemoryMB) {
                    maxMemoryMB = vramMB;
                    gpuType = 'dedicated';
                  }
                }
              }
            });

            resolve({
              hasGPU: maxMemoryMB > 0,
              gpuMemoryMB: maxMemoryMB,
              gpuType
            });
          } else {
            throw new Error('Failed to get system profiler data');
          }
        } catch (error) {
          log.warn('Error parsing macOS GPU info:', error.message);
          resolve(this.estimateGPUCapabilities());
        }
      });

      // Timeout after 5 seconds
      setTimeout(() => {
        process.kill();
        resolve(this.estimateGPUCapabilities());
      }, 5000);
    });
  }

  /**
   * Get Windows GPU information using nvidia-smi (preferred) or wmic (fallback)
   */
  async getWindowsGPUInfo() {
    return new Promise((resolve) => {
      const { spawn, spawnSync } = require('child_process');

      // Try nvidia-smi first (for NVIDIA GPUs)
      try {
        const nvidiaSmi = spawnSync('nvidia-smi', [
          '--query-gpu=memory.total',
          '--format=csv,noheader,nounits'
        ], { encoding: 'utf8' });

        if (nvidiaSmi.status === 0 && nvidiaSmi.stdout) {
          const lines = nvidiaSmi.stdout.trim().split('\n');
          const maxMemoryMB = Math.max(...lines.map(line => parseInt(line.trim())));
          if (maxMemoryMB > 0) {
            return resolve({
              hasGPU: true,
              gpuMemoryMB: maxMemoryMB,
              gpuType: 'nvidia'
            });
          }
        }
      } catch (err) {
        // Ignore and fallback to WMIC
      }

      // Fallback to WMIC
      const process = spawn('wmic', ['path', 'win32_VideoController', 'get', 'name,AdapterRAM', '/format:csv'], {
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let stdout = '';
      process.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      process.on('close', (code) => {
        try {
          if (code === 0 && stdout) {
            const lines = stdout.split('\n').filter(line => line.trim());
            let maxMemoryMB = 0;
            let gpuType = 'integrated';

            lines.forEach(line => {
              const parts = line.split(',');
              if (parts.length >= 3) {
                const ramStr = parts[1];
                const nameStr = parts[2];

                if (ramStr && nameStr && !isNaN(parseInt(ramStr))) {
                  const ramBytes = parseInt(ramStr);
                  const ramMB = Math.round(ramBytes / (1024 * 1024));

                  if (ramMB > maxMemoryMB) {
                    maxMemoryMB = ramMB;

                    // Determine GPU type based on name
                    const lowerName = nameStr.toLowerCase();
                    if (lowerName.includes('nvidia') || lowerName.includes('geforce') || lowerName.includes('rtx') || lowerName.includes('gtx')) {
                      gpuType = 'nvidia';
                    } else if (lowerName.includes('amd') || lowerName.includes('radeon')) {
                      gpuType = 'amd';
                    } else if (lowerName.includes('intel')) {
                      gpuType = 'intel';
                    } else {
                      gpuType = 'dedicated';
                    }
                  }
                }
              }
            });

            resolve({
              hasGPU: maxMemoryMB > 0,
              gpuMemoryMB: maxMemoryMB,
              gpuType
            });
          } else {
            throw new Error('Failed to get Windows GPU info');
          }
        } catch (error) {
          log.warn('Error parsing Windows GPU info:', error.message);
          resolve(this.estimateGPUCapabilities());
        }
      });

      // Timeout after 5 seconds
      setTimeout(() => {
        process.kill();
        resolve(this.estimateGPUCapabilities());
      }, 5000);
    });
  }

  /**
   * Get Linux GPU information using nvidia-smi or other methods
   */
  async getLinuxGPUInfo() {
    return new Promise((resolve) => {
      const { spawn } = require('child_process');
      
      // Try nvidia-smi first
      const process = spawn('nvidia-smi', ['--query-gpu=memory.total', '--format=csv,noheader,nounits'], {
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let stdout = '';
      process.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      process.on('close', (code) => {
        try {
          if (code === 0 && stdout.trim()) {
            const memoryMB = parseInt(stdout.trim());
            if (!isNaN(memoryMB) && memoryMB > 0) {
              resolve({
                hasGPU: true,
                gpuMemoryMB: memoryMB,
                gpuType: 'nvidia'
              });
              return;
            }
          }
          
          // Fallback to estimation
          resolve(this.estimateGPUCapabilities());
        } catch (error) {
          log.warn('Error parsing Linux GPU info:', error.message);
          resolve(this.estimateGPUCapabilities());
        }
      });

      // Timeout after 5 seconds
      setTimeout(() => {
        process.kill();
        resolve(this.estimateGPUCapabilities());
      }, 5000);
    });
  }

  /**
   * Estimate GPU capabilities based on system specs
   */
  estimateGPUCapabilities() {
    const platform = os.platform();
    const arch = os.arch();
    const systemMemoryGB = this.systemMemoryGB;

    let hasGPU = true;
    let gpuMemoryMB = 2048; // Default 2GB
    let gpuType = 'integrated';

    if (platform === 'darwin') {
      if (arch === 'arm64') {
        // Apple Silicon - unified memory architecture
        gpuType = 'apple_silicon';
        if (systemMemoryGB >= 32) {
          gpuMemoryMB = 16384; // 16GB for high-end
        } else if (systemMemoryGB >= 16) {
          gpuMemoryMB = 8192; // 8GB for mid-range
        } else {
          gpuMemoryMB = 4096; // 4GB minimum
        }
      } else {
        // Intel Mac
        gpuType = 'integrated';
        gpuMemoryMB = Math.min(4096, systemMemoryGB * 256); // Up to 4GB or system memory/4
      }
    } else {
      // Windows/Linux - conservative estimate
      if (systemMemoryGB >= 16) {
        gpuMemoryMB = 4096; // Assume 4GB for systems with 16GB+ RAM
        gpuType = 'dedicated';
      } else if (systemMemoryGB >= 8) {
        gpuMemoryMB = 2048; // 2GB for 8GB systems
      } else {
        gpuMemoryMB = 1024; // 1GB for lower-end systems
        hasGPU = false; // Disable GPU for very low-end systems
      }
    }

    return { hasGPU, gpuMemoryMB, gpuType };
  }

  /**
   * Calculate optimal GPU layers for a model
   */
  async calculateOptimalGPULayers(modelPath, modelFileSize = null) {
    const gpuInfo = await this.detectGPUInfo();
    
    if (!gpuInfo.hasGPU || gpuInfo.gpuMemoryMB < 1024) {
      log.info('GPU not available or insufficient memory, using CPU only');
      return 0;
    }

    try {
      // Get model file size if not provided
      if (!modelFileSize) {
        const stats = await fs.stat(modelPath);
        modelFileSize = stats.size;
      }

      const modelSizeGB = modelFileSize / (1024 * 1024 * 1024);
      const availableGpuMemoryGB = gpuInfo.gpuMemoryGB;

      // Estimate model parameters and layers based on file size
      const modelInfo = this.estimateModelInfo(modelPath, modelSizeGB);
      
      log.info(`Model analysis for ${path.basename(modelPath)}:`, {
        sizeGB: modelSizeGB,
        estimatedParams: modelInfo.estimatedParams,
        estimatedLayers: modelInfo.estimatedLayers,
        availableGpuMemoryGB,
        gpuType: gpuInfo.gpuType
      });

      // Calculate how many layers can fit in GPU memory
      const layersToOffload = this.calculateLayerOffloading(modelInfo, gpuInfo, modelSizeGB);
      
      log.info(`Calculated optimal GPU layers: ${layersToOffload} / ${modelInfo.estimatedLayers}`);
      
      return layersToOffload;
    } catch (error) {
      log.warn('Error calculating optimal GPU layers:', error.message);
      // Fallback to conservative estimate
      return this.getConservativeGPULayers(gpuInfo);
    }
  }

  /**
   * Estimate model information from filename and size
   */
  estimateModelInfo(modelPath, modelSizeGB) {
    const fileName = path.basename(modelPath).toLowerCase();
    
    // Try to extract parameter count from filename
    let estimatedParams = '7b'; // default
    let estimatedLayers = 32; // default for 7B models
    
    // Extract parameter info from filename
    const paramMatch = fileName.match(/(\d+(?:\.\d+)?)\s*b/i);
    if (paramMatch) {
      const paramCount = parseFloat(paramMatch[1]);
      estimatedParams = `${paramCount}b`;
      
      // Estimate layers based on parameter count
      if (paramCount <= 1) {
        estimatedLayers = 22; // 1B models
      } else if (paramCount <= 3) {
        estimatedLayers = 26; // 3B models
      } else if (paramCount <= 7) {
        estimatedLayers = 32; // 7B models
      } else if (paramCount <= 13) {
        estimatedLayers = 40; // 13B models
      } else if (paramCount <= 30) {
        estimatedLayers = 60; // 30B models
      } else if (paramCount <= 70) {
        estimatedLayers = 80; // 70B models
      } else {
        estimatedLayers = 100; // Larger models
      }
    }

    // Adjust based on model size (more accurate than filename sometimes)
    if (modelSizeGB < 1) {
      estimatedLayers = Math.min(estimatedLayers, 22);
    } else if (modelSizeGB < 4) {
      estimatedLayers = Math.min(estimatedLayers, 32);
    } else if (modelSizeGB < 8) {
      estimatedLayers = Math.min(estimatedLayers, 40);
    } else if (modelSizeGB < 15) {
      estimatedLayers = Math.min(estimatedLayers, 60);
    }

    return {
      estimatedParams,
      estimatedLayers,
      modelSizeGB
    };
  }

  /**
   * Calculate how many layers to offload based on available memory
   */
  calculateLayerOffloading(modelInfo, gpuInfo, modelSizeGB) {
    const availableGpuMemoryGB = gpuInfo.gpuMemoryGB;
    const totalLayers = modelInfo.estimatedLayers;
    
    // Reserve memory for context and other overhead
    let reservedMemoryGB = 1; // Default 1GB reserved
    
    if (gpuInfo.gpuType === 'apple_silicon') {
      // Apple Silicon shares memory, so be more conservative
      reservedMemoryGB = Math.max(2, availableGpuMemoryGB * 0.3);
    } else if (gpuInfo.gpuType === 'integrated') {
      // Integrated graphics share system memory
      reservedMemoryGB = Math.max(1.5, availableGpuMemoryGB * 0.4);
    } else {
      // Dedicated GPU
      reservedMemoryGB = Math.max(1, availableGpuMemoryGB * 0.2);
    }

    const usableGpuMemoryGB = Math.max(0, availableGpuMemoryGB - reservedMemoryGB);
    
    // Estimate memory per layer (rough approximation)
    const memoryPerLayerGB = modelSizeGB / totalLayers;
    
    // Calculate how many layers can fit
    let maxLayers = Math.floor(usableGpuMemoryGB / memoryPerLayerGB);
    
    // Apply safety limits and platform-specific optimizations
    if (gpuInfo.gpuType === 'apple_silicon') {
      // Apple Silicon handles memory differently, can be more aggressive
      maxLayers = Math.min(maxLayers, totalLayers);
    } else if (gpuInfo.gpuType === 'nvidia' && gpuInfo.gpuMemoryMB >= 8192) {
      // High-end NVIDIA cards can handle full offloading better
      maxLayers = Math.min(maxLayers, totalLayers);
    } else {
      // Conservative approach for other GPUs
      maxLayers = Math.min(maxLayers, Math.floor(totalLayers * 0.8));
    }

    // Ensure we don't exceed total layers or go negative
    maxLayers = Math.max(0, Math.min(maxLayers, totalLayers));
    
    // Round down to avoid edge cases
    return Math.floor(maxLayers);
  }

  /**
   * Get conservative GPU layer estimate as fallback
   */
  getConservativeGPULayers(gpuInfo) {
    if (!gpuInfo.hasGPU) return 0;
    
    if (gpuInfo.gpuMemoryGB >= 16) {
      return 35; // High-end GPU
    } else if (gpuInfo.gpuMemoryGB >= 8) {
      return 25; // Mid-range GPU
    } else if (gpuInfo.gpuMemoryGB >= 4) {
      return 15; // Entry-level dedicated GPU
    } else {
      return 5; // Integrated graphics
    }
  }

  /**
   * Get GPU diagnostics information for the frontend
   */
  async getGPUDiagnostics() {
    try {
      // Get GPU information
      const gpuInfo = await this.detectGPUInfo();
      
      // Get model information with GPU allocation details
      const models = await this.scanModels();
      const mainModels = models.filter(model => !this.isMmprojModel(model.file));
      
      const modelInfo = [];
      
      for (const model of mainModels) {
        try {
          const modelSizeGB = model.size / (1024 * 1024 * 1024);
          const modelEstimation = this.estimateModelInfo(model.path, modelSizeGB);
          const allocatedLayers = await this.calculateOptimalGPULayers(model.path, model.size);
          
          modelInfo.push({
            name: this.generateModelName(model.file),
            path: model.path,
            sizeGB: modelSizeGB,
            estimatedLayers: modelEstimation.estimatedLayers,
            allocatedLayers: allocatedLayers,
            estimatedParams: modelEstimation.estimatedParams
          });
        } catch (error) {
          log.warn(`Error getting GPU info for model ${model.file}:`, error.message);
          // Include model with fallback data
          modelInfo.push({
            name: this.generateModelName(model.file),
            path: model.path,
            sizeGB: model.size / (1024 * 1024 * 1024),
            estimatedLayers: 32, // fallback
            allocatedLayers: 0, // fallback to CPU
            estimatedParams: 'unknown'
          });
        }
      }
      
      return {
        gpuInfo,
        modelInfo
      };
    } catch (error) {
      log.error('Error getting GPU diagnostics:', error);
      throw error;
    }
  }

  /**
   * Get safe default performance configuration when calculation fails
   */
  getSafeDefaultConfig() {
    const cpuCores = require('os').cpus().length;
    
    return {
      gpuLayers: 0,
      contextSize: 8192,      // Larger default context for better conversations
      batchSize: 512,
      ubatchSize: 128,
      flashAttention: this.forceFlashAttention || true,   // Enable by default or when forced - many modern quantized models require it
      useMemoryMapping: true,
      useMemoryLock: true,    // Enable memory locking for consistent performance
      useContinuousBatching: true,  // Enable by default for better multi-turn performance
      optimizeFirstToken: false,    // Default to conversational mode, not TTFT mode
      threads: Math.max(4, Math.min(8, Math.floor(cpuCores / 2))), // Better thread calculation
      parallelSequences: 1,
      kvCacheType: 'q8_0',
      // New conversational optimization settings
      keepTokens: 1024,       // Keep more tokens for faster subsequent responses
      defragThreshold: 0.1,   // Less aggressive defrag for better cache retention
      enableContinuousBatching: true,  // Explicit continuous batching flag
      enableContextShift: true,  // Enable context shift by default to prevent context overflow
      conversationMode: 'balanced',
    };
  }

  /**
   * Optimize conversation performance settings dynamically
   * This method can be called to adjust settings based on real usage patterns
   */
  async optimizeConversationPerformance(modelPath, conversationLength = 10) {
    try {
      const modelSizeGB = (await fs.stat(modelPath)).size / (1024 * 1024 * 1024);
      const gpuInfo = await this.detectGPUInfo();
      
      // Calculate optimal settings based on conversation length and system resources
      const contextSize = this.calculateOptimalContextSize(modelSizeGB, gpuInfo.hasGPU, gpuInfo.gpuMemoryGB);
      
      // Adjust keep tokens based on conversation length
      let keepTokens;
      if (conversationLength <= 5) {
        // Short conversations: keep most of the context
        keepTokens = Math.min(2048, Math.floor(contextSize * 0.4));
      } else if (conversationLength <= 15) {
        // Medium conversations: balance memory and speed
        keepTokens = Math.min(1536, Math.floor(contextSize * 0.3));
      } else {
        // Long conversations: more conservative to prevent memory issues
        keepTokens = Math.min(1024, Math.floor(contextSize * 0.25));
      }
      
      // Adjust defrag threshold based on conversation activity
      const defragThreshold = conversationLength > 20 ? 0.15 : 0.1;
      
      return {
        contextSize,
        keepTokens,
        defragThreshold,
        enableContinuousBatching: true,
        // Batch size optimization for conversation flow
        batchSize: modelSizeGB <= 4 ? 256 : 512,
        ubatchSize: modelSizeGB <= 4 ? 64 : 128
      };
    } catch (error) {
      log.warn('Failed to optimize conversation performance:', error.message);
      return this.getSafeDefaultConfig();
    }
  }

  /**
   * Get conversation-optimized command line arguments
   * This replaces the aggressive TTFT settings with conversation-friendly ones
   */
  getConversationOptimizedArgs(perfConfig, modelSizeGB) {
    const args = [];
    
    // Context size for good conversation memory
    const contextSize = perfConfig.contextSize || 8192;
    args.push(`--ctx-size ${contextSize}`);
    
    // Generous keep tokens to avoid reprocessing conversation history
    const keepTokens = perfConfig.keepTokens || Math.min(1024, Math.floor(contextSize * 0.25));
    args.push(`--keep ${keepTokens}`);
    
    // Less aggressive defrag to preserve cache
    const defragThreshold = perfConfig.defragThreshold || 0.1;
    args.push(`--defrag-thold ${defragThreshold}`);
    
    // Enable continuous batching for multi-turn efficiency
    if (perfConfig.enableContinuousBatching !== false) {
      args.push('--cont-batching');
    }
    
    // Memory locking for consistent performance
    if (perfConfig.useMemoryLock !== false) {
      args.push('--mlock');
    }
    
    // Batch sizes optimized for conversation flow
    const batchSize = perfConfig.batchSize || (modelSizeGB <= 4 ? 256 : 512);
    const ubatchSize = perfConfig.ubatchSize || (modelSizeGB <= 4 ? 64 : 128);
    args.push(`--batch-size ${batchSize}`);
    args.push(`--ubatch-size ${ubatchSize}`);
    
    // Parallel sequences
    const parallel = perfConfig.parallelSequences || 1;
    args.push(`--parallel ${parallel}`);
    
    // Cache type optimization
    if (perfConfig.kvCacheType && perfConfig.kvCacheType !== 'f16') {
      args.push(`--cache-type-k ${perfConfig.kvCacheType}`);
      args.push(`--cache-type-v ${perfConfig.kvCacheType}`);
    }
    
    // Flash attention if supported
    if (perfConfig.flashAttention) {
      args.push('--flash-attn');
    }
    
    // Context shift for long conversations - DISABLED (not supported by llama-server yet)
    // if (perfConfig.enableContextShift !== false) {
    //   args.push('--ctx-shift');
    // }
    
    return args;
  }

  /**
   * Save performance settings to persistent storage
   */
  async savePerformanceSettings(settings) {
    try {
      const fs = require('fs').promises;
      const path = require('path');
      const os = require('os');
      
      // Create settings directory if it doesn't exist
      const settingsDir = path.join(os.homedir(), '.clara', 'settings');
      await fs.mkdir(settingsDir, { recursive: true });
      
      // Save performance settings to file
      const settingsPath = path.join(settingsDir, 'performance-settings.json');
      await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
      
      log.info('Performance settings saved successfully:', settingsPath);
      return { success: true, path: settingsPath };
      
    } catch (error) {
      log.error('Error saving performance settings:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Load performance settings from persistent storage
   */
  async loadPerformanceSettings() {
    try {
      const fs = require('fs').promises;
      const path = require('path');
      const os = require('os');
      
      const settingsPath = path.join(os.homedir(), '.clara', 'settings', 'performance-settings.json');
      
      // Check if settings file exists
      try {
        await fs.access(settingsPath);
      } catch (accessError) {
        // File doesn't exist, return default settings
        log.info('No saved performance settings found, using defaults');
        return { success: true, settings: this.getDefaultPerformanceSettings() };
      }
      
      // Read and parse settings file
      const settingsData = await fs.readFile(settingsPath, 'utf8');
      const settings = JSON.parse(settingsData);
      
      log.info('Performance settings loaded successfully:', settingsPath);
      return { success: true, settings };
      
    } catch (error) {
      log.error('Error loading performance settings:', error);
      return { success: false, error: error.message, settings: this.getDefaultPerformanceSettings() };
    }
  }

  /**
   * Get performance settings (alias for loadPerformanceSettings for compatibility)
   */
  async getPerformanceSettings() {
    return await this.loadPerformanceSettings();
  }

  /**
   * Get default performance settings for UI initialization
   */
  getDefaultPerformanceSettings() {
    const cpuCores = require('os').cpus().length;
    
    return {
      flashAttention: true,   // Enable by default - required for many modern quantized models
      autoOptimization: true,
      maxContextSize: 8192,
      aggressiveOptimization: false,
      prioritizeSpeed: false,
      optimizeFirstToken: false,
      threads: Math.max(4, Math.min(8, Math.floor(cpuCores / 2))),
      parallelSequences: 1,
      // Conversational optimization settings
      optimizeConversations: true,
      keepTokens: 1024,
      defragThreshold: 0.1,
      enableContinuousBatching: true,
      enableContextShift: true,  // Enable context shift by default to prevent context overflow
      conversationMode: 'balanced',
      // GPU and batch settings - set to undefined by default so auto-calculation kicks in
      gpuLayers: undefined,   // undefined = auto-calculate, number = user override
      batchSize: 256,
      ubatchSize: 256,
      memoryLock: true
    };
  }

  // Helper method to calculate TTFT-optimized batch sizes and parameters
  calculateTTFTOptimizedBatchSizes(modelSizeGB, gpuInfo) {
    const hasGPU = gpuInfo.hasGPU;
    const memoryGB = hasGPU ? gpuInfo.gpuMemoryGB : 8; // Assume 8GB RAM fallback
    
    // For TTFT optimization, use smaller batch sizes for faster prefill
    let batchSize = 512;  // Default batch size for TTFT
    let ubatchSize = 128; // Smaller micro-batch for TTFT
    
    if (modelSizeGB <= 4) {
      // Small models: aggressive TTFT optimization
      batchSize = 256;
      ubatchSize = 64;
    } else if (modelSizeGB <= 8) {
      // Medium models: balanced TTFT
      batchSize = 512;
      ubatchSize = 128;
    } else {
      // Large models: conservative TTFT
      batchSize = 1024;
      ubatchSize = 256;
    }
    
    return { batchSize, ubatchSize };
  }

  // Helper method to optimize context size for performance vs capability
  calculateOptimalContextSize(modelSizeGB, hasGPU, memoryGB) {
    // For optimal conversational performance, we need larger context windows
    // but must balance memory usage
    
    if (modelSizeGB <= 4) {
      // Small models can handle larger contexts
      return hasGPU && memoryGB >= 8 ? 32768 : 16384;
    } else if (modelSizeGB <= 8) {
      // Medium models: balance performance and memory
      return hasGPU && memoryGB >= 12 ? 16384 : 8192;
    } else if (modelSizeGB <= 16) {
      // Large models: conservative context
      return hasGPU && memoryGB >= 16 ? 8192 : 4096;
    } else {
      // Very large models: minimal context for memory efficiency
      return hasGPU && memoryGB >= 24 ? 4096 : 2048;
    }
  }

  async enableFlashAttentionAndRegenerate() {
    try {
      log.info('🔄 Enabling flash attention and regenerating configuration...');
      
      // Temporarily force flash attention to true for this regeneration
      this.forceFlashAttention = true;
      
      // Regenerate the configuration with flash attention enabled
      await this.generateConfig();
      
      log.info('✅ Configuration regenerated with flash attention enabled');
      
      // Also try to update saved performance settings to enable flash attention by default
      try {
        const currentSettings = await this.loadPerformanceSettings();
        if (currentSettings.success) {
          const updatedSettings = {
            ...currentSettings.settings,
            flashAttention: true
          };
          await this.savePerformanceSettings(updatedSettings);
          log.info('💾 Updated saved performance settings to enable flash attention by default');
        }
      } catch (settingsError) {
        log.warn('Could not update performance settings:', settingsError.message);
      }
      
    } catch (error) {
      log.error('Failed to enable flash attention and regenerate config:', error);
      throw error;
    }
  }

  /**
   * Set a callback function to receive progress updates
   */
  setProgressCallback(callback) {
    this.progressCallback = callback;
  }

  /**
   * Parse progress information from llama-swap stdout
   */
  parseProgressFromOutput(output) {
    if (!this.progressCallback) return;

    try {
      // Parse different types of progress messages
      
      // Context processing progress: "slot update_slots: id  0 | task 1508 | prompt processing progress, n_past = 517, n_tokens = 512, progress = 0.335958"
      const contextMatch = output.match(/(?:slot update_slots.*?)?prompt processing progress.*?progress = ([\d.]+)/);
      if (contextMatch) {
        const progress = Math.round(parseFloat(contextMatch[1]) * 100);
        
        // Extract additional details for better context
        const nPastMatch = output.match(/n_past = (\d+)/);
        const nTokensMatch = output.match(/n_tokens = (\d+)/);
        
        let details = 'Processing conversation context...';
        if (nPastMatch && nTokensMatch) {
          details = `Processed ${nPastMatch[1]} tokens, batch size ${nTokensMatch[1]}`;
        }
        
        this.progressCallback({
          type: 'context_loading',
          progress: progress,
          message: `Loading Context`,
          details: details
        });
        
        // Log progress to console for debugging
        console.log(`📊 Context Loading Progress: ${progress}% - ${details}`);
        return;
      }

      // Memory optimization: "kv cache rm"
      if (output.includes('kv cache rm')) {
        this.progressCallback({
          type: 'memory_optimization',
          progress: -1, // Indeterminate
          message: 'Optimizing Memory',
          details: 'Clearing conversation cache...'
        });
        
        console.log('🧹 Memory Optimization: Clearing cache');
        return;
      }

      // Chat format initialization
      const chatFormatMatch = output.match(/Chat format: (.+)/);
      if (chatFormatMatch) {
        this.progressCallback({
          type: 'initialization',
          progress: -1,
          message: 'Initializing',
          details: `Chat format: ${chatFormatMatch[1]}`
        });
        
        console.log(`🔧 Initializing chat format: ${chatFormatMatch[1]}`);
        return;
      }

      // Model loading/warmup
      if (output.includes('loading model') || output.includes('warming up')) {
        this.progressCallback({
          type: 'model_loading',
          progress: -1,
          message: 'Loading Model',
          details: 'Preparing AI model...'
        });
        
        console.log('🤖 Loading/warming up model');
        return;
      }

      // Task processing (new prompt)
      const taskMatch = output.match(/slot launch_slot_: id\s+(\d+) \| task (\d+) \| processing task/);
      if (taskMatch) {
        this.progressCallback({
          type: 'task_processing',
          progress: -1,
          message: 'Processing Request',
          details: `Starting task ${taskMatch[2]} on slot ${taskMatch[1]}`
        });
        
        console.log(`⚡ Starting new task: ${taskMatch[2]} on slot ${taskMatch[1]}`);
        return;
      }

    } catch (error) {
      // Silently ignore parsing errors but log for debugging
      console.warn('Progress parsing error:', error);
    }
  }

  /**
   * Clean up any stale processes that might be left after binary updates
   * This prevents "unexpected state" errors when restarting
   */
  async cleanupStaleProcesses() {
    try {
      log.info('🧹 Cleaning up stale processes before service start...');
      
      // First, try to kill processes using our specific port
      await this.killProcessesOnPort(this.port);
      
      // On Windows, check for any remaining llama-server or llama-swap processes
      if (process.platform === 'win32') {
        const { spawn } = require('child_process');
        
        // Kill any orphaned llama-server processes on our port
        try {
          const netstatProcess = spawn('netstat', ['-ano'], { stdio: ['ignore', 'pipe', 'ignore'] });
          let netstatOutput = '';
          
          netstatProcess.stdout.on('data', (data) => {
            netstatOutput += data.toString();
          });
          
          await new Promise((resolve) => {
            netstatProcess.on('close', () => resolve());
          });
          
          // Look for processes using our ports
          const lines = netstatOutput.split('\n');
          const processesOnPort = [];
          
          for (const line of lines) {
            if (line.includes(':9999') || line.includes(`:${this.port}`)) {
              const parts = line.trim().split(/\s+/);
              const pid = parts[parts.length - 1];
              if (pid && pid !== '0' && /^\d+$/.test(pid)) {
                processesOnPort.push(pid);
              }
            }
          }
          
          // Kill processes found on our ports
          for (const pid of processesOnPort) {
            try {
              spawn('taskkill', ['/F', '/PID', pid], { stdio: 'ignore' });
              log.info(`Cleaned up stale process on port: PID ${pid}`);
            } catch (killError) {
              log.debug(`Could not kill PID ${pid}: ${killError.message}`);
            }
          }
          
        } catch (netstatError) {
          log.debug('Netstat cleanup failed:', netstatError.message);
        }
        
        // Also try to kill by process name as backup
        try {
          spawn('taskkill', ['/F', '/IM', 'llama-server.exe'], { stdio: 'ignore' });
          spawn('taskkill', ['/F', '/IM', 'llama-swap.exe'], { stdio: 'ignore' });
          spawn('taskkill', ['/F', '/IM', 'llama-swap-win32-x64.exe'], { stdio: 'ignore' });
          log.debug('Attempted cleanup of llama processes by name');
        } catch (cleanupError) {
          log.debug('Process name cleanup failed:', cleanupError.message);
        }
      }
      
      // Unix-like systems (macOS, Linux)
      else if (process.platform === 'darwin' || process.platform === 'linux') {
        const { spawn } = require('child_process');
        
        try {
          // Kill processes using our ports
          spawn('pkill', ['-f', 'llama-server'], { stdio: 'ignore' });
          spawn('pkill', ['-f', 'llama-swap'], { stdio: 'ignore' });
          log.debug('Attempted cleanup of llama processes on Unix-like system');
        } catch (cleanupError) {
          log.debug('Unix process cleanup failed:', cleanupError.message);
        }
      }
      
      // Wait a moment for cleanup to complete
      await new Promise(resolve => setTimeout(resolve, 2000)); // Increased wait time
      
      log.info('✅ Stale process cleanup completed');
      
    } catch (error) {
      log.warn('Stale process cleanup encountered error:', error.message);
      // Don't fail startup if cleanup fails
    }
  }

  /**
   * Kill processes specifically using the given port
   */
  async killProcessesOnPort(port) {
    try {
      log.info(`🔍 Checking for processes using port ${port}...`);
      
      if (process.platform === 'win32') {
        const { spawn } = require('child_process');
        
        // Use netstat to find processes using the port
        const netstatProcess = spawn('netstat', ['-ano'], { stdio: ['ignore', 'pipe', 'ignore'] });
        let netstatOutput = '';
        
        netstatProcess.stdout.on('data', (data) => {
          netstatOutput += data.toString();
        });
        
        await new Promise((resolve) => {
          netstatProcess.on('close', () => resolve());
        });
        
        // Parse output to find PIDs using our port
        const lines = netstatOutput.split('\n');
        const pidsToKill = new Set();
        
        for (const line of lines) {
          if (line.includes(`:${port} `) || line.includes(`:${port}\t`)) {
            const parts = line.trim().split(/\s+/);
            const pid = parts[parts.length - 1];
            if (pid && pid !== '0' && /^\d+$/.test(pid)) {
              pidsToKill.add(pid);
            }
          }
        }
        
        // Kill all processes using the port
        for (const pid of pidsToKill) {
          try {
            log.info(`🔪 Killing process PID ${pid} using port ${port}`);
            spawn('taskkill', ['/F', '/PID', pid], { stdio: 'ignore' });
          } catch (killError) {
            log.debug(`Could not kill PID ${pid}: ${killError.message}`);
          }
        }
        
        if (pidsToKill.size > 0) {
          log.info(`✅ Cleaned up ${pidsToKill.size} processes using port ${port}`);
          // Wait for processes to actually die
          await new Promise(resolve => setTimeout(resolve, 3000));
        } else {
          log.info(`✅ No processes found using port ${port}`);
        }
        
      } else if (process.platform === 'darwin' || process.platform === 'linux') {
        const { spawn, exec } = require('child_process');
        
        // Use lsof to find processes using the port
        return new Promise((resolve) => {
          exec(`lsof -ti:${port}`, (error, stdout, stderr) => {
            if (error) {
              log.debug(`No processes found using port ${port}`);
              resolve();
              return;
            }
            
            const pids = stdout.trim().split('\n').filter(pid => pid && /^\d+$/.test(pid));
            
            if (pids.length > 0) {
              log.info(`🔪 Killing ${pids.length} processes using port ${port}`);
              
              for (const pid of pids) {
                try {
                  spawn('kill', ['-9', pid], { stdio: 'ignore' });
                  log.info(`Killed process PID ${pid} using port ${port}`);
                } catch (killError) {
                  log.debug(`Could not kill PID ${pid}: ${killError.message}`);
                }
              }
              
              // Wait for processes to die
              setTimeout(resolve, 3000);
            } else {
              log.info(`✅ No processes found using port ${port}`);
              resolve();
            }
          });
        });
      }
      
    } catch (error) {
      log.warn(`Error killing processes on port ${port}:`, error.message);
    }
  }

  /**
   * Attempt to recover from service errors (502/503) after updates
   */
  async recoverFromErrors() {
    log.info('Attempting service recovery after errors...');
    
    try {
      // Stop the service if it's in a bad state
      if (this.isRunning) {
        await this.stop();
      }
      
      // Clean up any stale processes
      await this.cleanupStaleProcesses();
      
      // Verify and repair binaries (especially important after updates)
      await this.verifyAndRepairBinariesAfterUpdate();
      
      // Regenerate configuration to ensure compatibility
      await this.generateConfig();
      
      // Wait a bit longer for complete cleanup
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Restart the service
      const result = await this.start();
      
      if (result.success) {
        log.info('Service recovery completed successfully');
      } else {
        log.error('Service recovery failed:', result.error);
      }
      
      return result;
      
    } catch (error) {
      log.error('Service recovery encountered error:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Verify and repair binary paths after updates
   * This ensures the service can find the correct binaries even if naming changes after updates
   */
  async verifyAndRepairBinariesAfterUpdate() {
    log.info('🔧 Verifying and repairing binary paths after update...');
    
    try {
      const platform = os.platform();
      const platformPath = path.join(this.baseDir, this.platformInfo.platformDir);
      
      if (!fsSync.existsSync(platformPath)) {
        throw new Error(`Platform directory not found: ${platformPath}`);
      }
      
      // List all files in the platform directory
      const files = fsSync.readdirSync(platformPath);
      log.info(`Files found in platform directory:`, files);
      
      // Check for llama-swap binary variants
      const llamaSwapFiles = files.filter(file => 
        file.includes('llama-swap') && 
        !file.includes('backup') && 
        (file.endsWith('.exe') || !file.includes('.'))
      );
      
      // Check for llama-server binary
      const llamaServerFiles = files.filter(file => 
        file.includes('llama-server') && 
        !file.includes('backup') &&
        (file.endsWith('.exe') || !file.includes('.'))
      );
      
      log.info(`Found llama-swap candidates:`, llamaSwapFiles);
      log.info(`Found llama-server candidates:`, llamaServerFiles);
      
      // If we have multiple llama-swap binaries, ensure we have the standard names
      if (llamaSwapFiles.length > 0) {
        const standardName = platform === 'win32' ? 'llama-swap.exe' : 'llama-swap';
        const platformSpecificName = platform === 'win32' ? 'llama-swap-win32-x64.exe' 
          : platform === 'darwin' ? 'llama-swap-darwin' 
          : 'llama-swap-linux';
        
        const hasStandardName = llamaSwapFiles.includes(standardName);
        const hasPlatformName = llamaSwapFiles.includes(platformSpecificName);
        
        // If we only have platform-specific name, create a symlink/copy to standard name
        if (!hasStandardName && hasPlatformName) {
          try {
            const sourcePath = path.join(platformPath, platformSpecificName);
            const targetPath = path.join(platformPath, standardName);
            
            if (platform === 'win32') {
              // On Windows, copy the file
              fsSync.copyFileSync(sourcePath, targetPath);
              log.info(`✅ Created standard llama-swap binary: ${standardName}`);
            } else {
              // On Unix systems, create a symlink
              fsSync.symlinkSync(platformSpecificName, targetPath);
              log.info(`✅ Created symlink for llama-swap: ${standardName} -> ${platformSpecificName}`);
            }
          } catch (linkError) {
            log.warn(`Could not create standard binary name:`, linkError.message);
          }
        }
        
        // If we only have standard name, create platform-specific name
        if (hasStandardName && !hasPlatformName) {
          try {
            const sourcePath = path.join(platformPath, standardName);
            const targetPath = path.join(platformPath, platformSpecificName);
            
            if (platform === 'win32') {
              // On Windows, copy the file
              fsSync.copyFileSync(sourcePath, targetPath);
              log.info(`✅ Created platform-specific llama-swap binary: ${platformSpecificName}`);
            } else {
              // On Unix systems, create a symlink
              fsSync.symlinkSync(standardName, targetPath);
              log.info(`✅ Created symlink for llama-swap: ${platformSpecificName} -> ${standardName}`);
            }
          } catch (linkError) {
            log.warn(`Could not create platform-specific binary name:`, linkError.message);
          }
        }
      }
      
      // Refresh binary paths after potential repairs
      this.binaryPaths = this.getBinaryPathsWithFallback();
      log.info(`✅ Binary verification and repair completed`);
      log.info(`Updated binary paths:`, this.binaryPaths);
      
      return true;
      
    } catch (error) {
      log.error('Binary verification and repair failed:', error.message);
      return false;
    }
  }

  /**
   * Static method for update service to repair binaries after updates
   * This can be called without creating a full service instance
   */
  static async repairBinariesAfterUpdate(baseDir = null) {
    log.info('🔧 Static binary repair called after update...');
    
    try {
      if (!baseDir) {
        // Determine base directory using the same logic as constructor
        const isDevelopment = process.env.NODE_ENV === 'development';
        
        if (isDevelopment) {
          baseDir = path.join(__dirname, 'llamacpp-binaries');
        } else {
          const possiblePaths = [
            process.resourcesPath ? path.join(process.resourcesPath, 'electron', 'llamacpp-binaries') : null,
            app && app.getAppPath ? path.join(app.getAppPath(), 'electron', 'llamacpp-binaries') : null,
            path.join(__dirname, 'llamacpp-binaries')
          ].filter(Boolean);
          
          for (const possiblePath of possiblePaths) {
            if (fsSync.existsSync(possiblePath)) {
              baseDir = possiblePath;
              break;
            }
          }
          
          if (!baseDir) {
            baseDir = path.join(__dirname, 'llamacpp-binaries');
          }
        }
      }
      
      const platformManager = new PlatformManager(baseDir);
      const platformInfo = platformManager.platformInfo;
      const platform = os.platform();
      const platformPath = path.join(baseDir, platformInfo.platformDir);
      
      if (!fsSync.existsSync(platformPath)) {
        log.warn(`Platform directory not found during static repair: ${platformPath}`);
        return false;
      }
      
      // List all files and repair llama-swap binaries
      const files = fsSync.readdirSync(platformPath);
      const llamaSwapFiles = files.filter(file => 
        file.includes('llama-swap') && 
        !file.includes('backup') && 
        (file.endsWith('.exe') || !file.includes('.'))
      );
      
      log.info(`Static repair found llama-swap candidates:`, llamaSwapFiles);
      
      if (llamaSwapFiles.length > 0) {
        const standardName = platform === 'win32' ? 'llama-swap.exe' : 'llama-swap';
        const platformSpecificName = platform === 'win32' ? 'llama-swap-win32-x64.exe' 
          : platform === 'darwin' ? 'llama-swap-darwin' 
          : 'llama-swap-linux';
        
        const hasStandardName = llamaSwapFiles.includes(standardName);
        const hasPlatformName = llamaSwapFiles.includes(platformSpecificName);
        
        // Ensure both names exist for maximum compatibility
        if (!hasStandardName && hasPlatformName) {
          try {
            const sourcePath = path.join(platformPath, platformSpecificName);
            const targetPath = path.join(platformPath, standardName);
            fsSync.copyFileSync(sourcePath, targetPath);
            log.info(`✅ Static repair created standard binary: ${standardName}`);
          } catch (error) {
            log.warn(`Static repair failed to create standard binary:`, error.message);
          }
        }
        
        if (hasStandardName && !hasPlatformName) {
          try {
            const sourcePath = path.join(platformPath, standardName);
            const targetPath = path.join(platformPath, platformSpecificName);
            fsSync.copyFileSync(sourcePath, targetPath);
            log.info(`✅ Static repair created platform-specific binary: ${platformSpecificName}`);
          } catch (error) {
            log.warn(`Static repair failed to create platform-specific binary:`, error.message);
          }
        }
      }
      
      log.info('✅ Static binary repair completed');
      return true;
      
    } catch (error) {
      log.error('Static binary repair failed:', error.message);
      return false;
    }
  }

  /**
   * Set custom model paths
   */
  setCustomModelPaths(paths) {
    this.customModelPaths = Array.isArray(paths) ? paths : [paths].filter(Boolean);
    log.info('Custom model paths updated:', this.customModelPaths);
  }

  /**
   * Add a custom model path
   */
  addCustomModelPath(path) {
    if (path && !this.customModelPaths.includes(path)) {
      this.customModelPaths.push(path);
      log.info('Added custom model path:', path);
    }
  }

  /**
   * Remove a custom model path
   */
  removeCustomModelPath(path) {
    const index = this.customModelPaths.indexOf(path);
    if (index > -1) {
      this.customModelPaths.splice(index, 1);
      log.info('Removed custom model path:', path);
    }
  }

  /**
   * Get all custom model paths
   */
  getCustomModelPaths() {
    return [...this.customModelPaths];
  }

  /**
   * Apply system resource limitations to the service
   */
  applyResourceLimitations(limitations) {
    try {
      log.info('🎯 Applying system resource limitations to LlamaSwap service:', limitations);
      
      this.resourceLimitations = limitations;
      
      // Apply thread limitations
      if (limitations.limitedThreads) {
        log.info(`🧵 Limiting thread count to: ${limitations.limitedThreads}`);
        this.maxThreads = limitations.limitedThreads;
      }
      
      // Apply context size limitations
      if (limitations.maxContextSize) {
        log.info(`📝 Limiting context size to: ${limitations.maxContextSize}`);
        this.maxContextSize = limitations.maxContextSize;
      }
      
      // Apply concurrent model limitations
      if (limitations.maxConcurrentModels) {
        log.info(`🔄 Limiting concurrent models to: ${limitations.maxConcurrentModels}`);
        this.maxConcurrentModels = limitations.maxConcurrentModels;
      }
      
      // Disable GPU acceleration if required
      if (limitations.disableGPUAcceleration) {
        log.info('🚫 GPU acceleration disabled due to system limitations');
        this.forceDisableGPU = true;
      }
      
      // Store limitations for later use in model spawning
      this.systemLimitations = limitations;
      
      log.info('✅ System resource limitations applied successfully');
    } catch (error) {
      log.error('❌ Failed to apply system resource limitations:', error);
    }
  }

  /**
   * Get system resource limitations
   */
  getResourceLimitations() {
    return this.resourceLimitations || {};
  }

  /**
   * Check if a feature is limited by system resources
   */
  isFeatureLimited(featureName) {
    const limitations = this.getResourceLimitations();
    
    switch (featureName) {
      case 'gpu':
        return limitations.disableGPUAcceleration || false;
      case 'concurrent_models':
        return limitations.maxConcurrentModels ? limitations.maxConcurrentModels < 2 : false;
      case 'large_context':
        return limitations.maxContextSize ? limitations.maxContextSize < 16384 : false;
      default:
        return false;
    }
  }

  /**
   * Extract metadata from GGUF file including embedding dimensions
   */
  async extractGGUFMetadata(modelPath) {
    try {
      const fs = require('fs');
      const buffer = Buffer.alloc(1024); // Read first 1KB to get header info
      
      const fd = fs.openSync(modelPath, 'r');
      fs.readSync(fd, buffer, 0, 1024, 0);
      fs.closeSync(fd);
      
      // GGUF magic number check
      const magic = buffer.readUInt32LE(0);
      if (magic !== 0x46554747) { // 'GGUF' in little endian
        return null;
      }
      
      // Read version
      const version = buffer.readUInt32LE(4);
      
      // Skip tensor count and metadata count for now
      let offset = 8;
      const tensorCount = buffer.readBigUInt64LE(offset);
      offset += 8;
      const metadataCount = buffer.readBigUInt64LE(offset);
      offset += 8;
      
      // For a more complete implementation, we would parse the full metadata
      // For now, try to determine embedding size from common patterns
      let embeddingSize = this.estimateEmbeddingSize(modelPath);
      
      return {
        version,
        tensorCount: Number(tensorCount),
        metadataCount: Number(metadataCount),
        embeddingSize
      };
    } catch (error) {
      log.warn(`Failed to extract GGUF metadata from ${modelPath}:`, error.message);
      return {
        embeddingSize: this.estimateEmbeddingSize(modelPath)
      };
    }
  }

  /**
   * Estimate embedding size based on model name patterns and known models
   */
  estimateEmbeddingSize(modelPath) {
    const fileName = path.basename(modelPath).toLowerCase();
    
    // Known embedding dimensions for common models
    const embeddingDimensionMap = {
      // Text models (common dimensions)
      'gemma': 2048,
      'llama': 4096,
      'qwen': 4096,
      'mistral': 4096,
      'phi': 2560,
      'tinyllama': 2048,
      'deepseek': 4096,
      
      // Embedding models
      'nomic-embed': 768,
      'mxbai': 1024,
      'bge': 1024,
      'e5': 1024,
      'all-minilm': 384,
      
      // Vision models (projection dimensions)
      'llava': 4096,
      'moondream': 2048,
      'vision': 4096,
      'multimodal': 4096
    };
    
    // Check for specific model patterns
    for (const [pattern, dimension] of Object.entries(embeddingDimensionMap)) {
      if (fileName.includes(pattern)) {
        // Special case for e5-large-v2 which has higher dimensions
        if (pattern === 'e5' && fileName.includes('large')) {
          return 1024;
        }
        return dimension;
      }
    }
    
    // Fallback based on model size (rough estimation)
    if (this.isEmbeddingModel(fileName)) {
      return 768; // Default for embedding models
    }
    
    // Default for text models
    return 4096;
  }

  /**
   * Find compatible mmproj files for a model based on embedding dimensions
   */
  async findCompatibleMmprojFiles(model, allMmprojModels) {
    const compatibleFiles = [];
    
    try {
      // Get the model's embedding dimensions
      const modelMetadata = await this.extractGGUFMetadata(model.path);
      const modelEmbeddingSize = modelMetadata?.embeddingSize || this.estimateEmbeddingSize(model.path);
      
      // Check each mmproj file for compatibility
      for (const mmprojModel of allMmprojModels) {
        try {
          const mmprojMetadata = await this.extractGGUFMetadata(mmprojModel.path);
          const mmprojEmbeddingSize = mmprojMetadata?.embeddingSize || this.estimateEmbeddingSize(mmprojModel.path);
          
          // Models are compatible if their embedding dimensions match
          if (modelEmbeddingSize === mmprojEmbeddingSize) {
            compatibleFiles.push({
              ...mmprojModel,
              embeddingSize: mmprojEmbeddingSize,
              isCompatible: true,
              compatibilityReason: `Matching embedding dimensions (${mmprojEmbeddingSize})`
            });
          } else {
            // Include incompatible files with warning
            compatibleFiles.push({
              ...mmprojModel,
              embeddingSize: mmprojEmbeddingSize,
              isCompatible: false,
              compatibilityReason: `Dimension mismatch: model=${modelEmbeddingSize}, mmproj=${mmprojEmbeddingSize}`
            });
          }
        } catch (error) {
          log.warn(`Error checking mmproj compatibility for ${mmprojModel.file}:`, error.message);
          // Include with unknown compatibility
          compatibleFiles.push({
            ...mmprojModel,
            embeddingSize: 'unknown',
            isCompatible: false,
            compatibilityReason: 'Unable to determine compatibility'
          });
        }
      }
      
      // Sort compatible files first
      compatibleFiles.sort((a, b) => {
        if (a.isCompatible && !b.isCompatible) return -1;
        if (!a.isCompatible && b.isCompatible) return 1;
        return 0;
      });
      
    } catch (error) {
      log.error(`Error finding compatible mmproj files for ${model.file}:`, error.message);
    }
    
    return compatibleFiles;
  }

  /**
   * Get enhanced model information with embedding dimensions and mmproj compatibility
   */
  async getModelEmbeddingInfo(modelPath) {
    try {
      const metadata = await this.extractGGUFMetadata(modelPath);
      const embeddingSize = metadata?.embeddingSize || this.estimateEmbeddingSize(modelPath);
      const fileName = path.basename(modelPath);
      
      // Scan for available mmproj files
      const allModels = await this.scanModels();
      const mmprojModels = allModels.filter(model => this.isMmprojModel(model.file));
      
      // Find compatible mmproj files
      const model = { path: modelPath, file: fileName };
      const compatibleMmprojFiles = await this.findCompatibleMmprojFiles(model, mmprojModels);
      
      // Check if this is a vision model that needs mmproj
      const isVision = this.isVisionModel(fileName);
      const hasCompatibleMmproj = compatibleMmprojFiles.some(file => file.isCompatible);
      
      return {
        embeddingSize,
        isVisionModel: isVision,
        needsMmproj: isVision,
        compatibleMmprojFiles,
        hasCompatibleMmproj,
        compatibilityStatus: isVision ? 
          (hasCompatibleMmproj ? 'compatible' : 'needs_mmproj') : 
          'not_applicable'
      };
    } catch (error) {
      log.error(`Error getting model embedding info for ${modelPath}:`, error.message);
      return {
        embeddingSize: 'unknown',
        isVisionModel: false,
        needsMmproj: false,
        compatibleMmprojFiles: [],
        hasCompatibleMmproj: false,
        compatibilityStatus: 'unknown'
      };
    }
  }

  /**
   * Search Hugging Face for compatible mmproj files for a given model
   */
  async searchHuggingFaceForMmproj(modelName, embeddingSize) {
    try {
      let fetch;
      try {
        fetch = global.fetch || (await import('node-fetch')).default;
      } catch (importError) {
        const nodeFetch = require('node-fetch');
        fetch = nodeFetch.default || nodeFetch;
      }
      
      // Extract base model name for searching
      const baseModelName = modelName.toLowerCase()
        .replace(/[-_.]?(q\d+_k_[ms]|f16|f32|gguf).*$/i, '') // Remove quantization suffixes
        .replace(/[-_.]/g, '-');
      
      // Search for mmproj files related to this model
      const searchQueries = [
        `${baseModelName} mmproj`,
        `${baseModelName} mm-proj`,
        `${baseModelName} projection`,
        `mmproj ${baseModelName}`
      ];
      
      const results = [];
      
      for (const query of searchQueries) {
        try {
          const url = `https://huggingface.co/api/models?search=${encodeURIComponent(query)}&filter=gguf&limit=10`;
          const response = await fetch(url);
          
          if (response.ok) {
            const models = await response.json();
            
            for (const model of models) {
              // Check if this model has mmproj files
              const mmprojFiles = (model.siblings || []).filter(file => 
                file.rfilename.toLowerCase().includes('mmproj') ||
                file.rfilename.toLowerCase().includes('mm-proj') ||
                file.rfilename.toLowerCase().includes('projection')
              );
              
              if (mmprojFiles.length > 0) {
                results.push({
                  modelId: model.modelId || model.id,
                  modelName: model.modelId || model.id,
                  description: model.description || '',
                  files: mmprojFiles,
                  estimatedEmbeddingSize: this.estimateEmbeddingSize(mmprojFiles[0].rfilename),
                  isLikelyCompatible: this.estimateEmbeddingSize(mmprojFiles[0].rfilename) === embeddingSize,
                  downloads: model.downloads || 0,
                  likes: model.likes || 0
                });
              }
            }
          }
        } catch (searchError) {
          log.warn(`Error searching for mmproj with query "${query}":`, searchError.message);
        }
      }
      
      // Remove duplicates and sort by compatibility and popularity
      const uniqueResults = results.reduce((acc, current) => {
        const existing = acc.find(item => item.modelId === current.modelId);
        if (!existing) {
          acc.push(current);
        }
        return acc;
      }, []);
      
      uniqueResults.sort((a, b) => {
        // Sort compatible first, then by downloads
        if (a.isLikelyCompatible && !b.isLikelyCompatible) return -1;
        if (!a.isLikelyCompatible && b.isLikelyCompatible) return 1;
        return (b.downloads || 0) - (a.downloads || 0);
      });
      
      return uniqueResults.slice(0, 5); // Return top 5 results
    } catch (error) {
      log.error(`Error searching Hugging Face for mmproj files:`, error.message);
      return [];
    }
  }

  /**
   * Save mmproj mappings to persistent storage
   */
  async saveMmprojMappings(mappings) {
    try {
      log.info('🔍 saveMmprojMappings called with mappings:', mappings);
      log.info('🔍 mappings type:', typeof mappings);
      log.info('🔍 mappings length/keys:', Array.isArray(mappings) ? mappings.length : Object.keys(mappings).length);
      
      const settingsDir = path.join(os.homedir(), '.clara', 'settings');
      log.info('🔍 Settings directory:', settingsDir);
      
      await fs.mkdir(settingsDir, { recursive: true });
      log.info('🔍 Settings directory ensured');
      
      // Convert array format to object format for consistency
      let mappingsToSave;
      if (Array.isArray(mappings)) {
        // Frontend sends array format - convert to object format
        mappingsToSave = {};
        mappings.forEach(mapping => {
          if (mapping.modelPath) {
            mappingsToSave[mapping.modelPath] = mapping;
          }
        });
        log.info('🔍 Converted array format to object format for mmproj mappings');
        log.info('🔍 Converted mappings:', mappingsToSave);
      } else {
        // Already in object format
        mappingsToSave = mappings;
        log.info('🔍 Using existing object format');
      }
      
      const mappingsPath = path.join(settingsDir, 'mmproj-mappings.json');
      log.info('🔍 Writing to file:', mappingsPath);
      
      const jsonContent = JSON.stringify(mappingsToSave, null, 2);
      log.info('🔍 JSON content to write:', jsonContent);
      
      await fs.writeFile(mappingsPath, jsonContent, 'utf8');
      log.info('🔍 File written successfully');
      
      // Verify the file was created
      try {
        const stats = await fs.stat(mappingsPath);
        log.info('🔍 File verification - size:', stats.size, 'bytes');
      } catch (statError) {
        log.error('❌ File verification failed:', statError);
      }
      
      log.info('✅ Mmproj mappings saved successfully:', mappingsPath);
      log.info(`✅ Saved ${Object.keys(mappingsToSave).length} mappings to ${mappingsPath}`);
      return { success: true, path: mappingsPath };
    } catch (error) {
      log.error('❌ Error saving mmproj mappings:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Load mmproj mappings from persistent storage
   */
  async loadMmprojMappings() {
    try {
      const mappingsPath = path.join(os.homedir(), '.clara', 'settings', 'mmproj-mappings.json');
      
      // Check if mappings file exists
      try {
        await fs.access(mappingsPath);
      } catch (accessError) {
        // File doesn't exist, return empty mappings
        log.info('No saved mmproj mappings found, returning empty object');
        return { success: true, mappings: {} };
      }
      
      // Read and parse mappings file
      const mappingsData = await fs.readFile(mappingsPath, 'utf8');
      const storedData = JSON.parse(mappingsData);
      
      // The data is always stored in object format (modelPath -> mapping)
      // Return as object for internal use (config generation)
      const mappings = storedData;
      
      log.info('Mmproj mappings loaded successfully:', mappingsPath);
      log.info(`Loaded ${Object.keys(mappings).length} mappings from ${mappingsPath}`);
      return { success: true, mappings };
    } catch (error) {
      log.error('Error loading mmproj mappings:', error);
      return { success: false, error: error.message, mappings: {} };
    }
  }

  /**
   * Get all available mmproj files from the file system
   */
  async getAvailableMmprojFiles() {
    try {
      const allModels = await this.scanModels();
      const mmprojModels = allModels.filter(model => this.isMmprojModel(model.file));
      
      // Enhance mmproj files with metadata
      const enhancedMmprojFiles = await Promise.all(
        mmprojModels.map(async (mmprojModel) => {
          try {
            const metadata = await this.extractGGUFMetadata(mmprojModel.path);
            return {
              ...mmprojModel,
              embeddingSize: metadata?.embeddingSize || this.estimateEmbeddingSize(mmprojModel.path),
              fileSize: mmprojModel.size,
              fileSizeFormatted: this.formatFileSize(mmprojModel.size)
            };
          } catch (error) {
            log.warn(`Error getting metadata for mmproj file ${mmprojModel.file}:`, error.message);
            return {
              ...mmprojModel,
              embeddingSize: 'unknown',
              fileSize: mmprojModel.size,
              fileSizeFormatted: this.formatFileSize(mmprojModel.size)
            };
          }
        })
      );
      
      return { success: true, mmprojFiles: enhancedMmprojFiles };
    } catch (error) {
      log.error('Error getting available mmproj files:', error);
      return { success: false, error: error.message, mmprojFiles: [] };
    }
  }

  /**
   * Format file size for display
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

module.exports = LlamaSwapService;