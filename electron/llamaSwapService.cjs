const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const os = require('os');
const log = require('electron-log');
const { app } = require('electron');
const PlatformManager = require('./platformManager.cjs');

class LlamaSwapService {
  constructor() {
    this.process = null;
    this.isRunning = false;
    this.port = 8091;
    
    // Flash attention retry mechanism flags
    this.handleFlashAttentionRequired = false;
    this.flashAttentionRetryAttempted = false;
    this.forceFlashAttention = false;
    
    // Progress tracking for UI feedback
    this.progressCallback = null;
    
    // Custom model paths
    this.customModelPaths = [];
    
    // Handle different base directory paths for development vs production
    this.baseDir = this.getBaseBinaryDirectory();
    this.modelsDir = path.join(os.homedir(), '.clara', 'llama-models');
    this.configPath = path.join(this.baseDir, 'config.yaml');
    this.logPath = path.join(this.baseDir, 'llama-swap.log');
    
    log.info(`Base binary directory: ${this.baseDir}`);
    log.info(`Models directory: ${this.modelsDir}`);
    
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
      log.info(`Models directory ensured at: ${this.modelsDir}`);
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
    // Convert filename to a readable model name
    // Example: "gemma-3-1b-it.Q4_K_M.gguf" -> "gemma3:1b"
    // Example: "Llama-3.2-1B-Instruct-Q4_K_M.gguf" -> "llama3.2:1b"
    
    let name = filename
      .replace('.gguf', '')
      .toLowerCase();
    
    // Extract base model name
    let baseName = name;
    
    // Handle common model families
    if (name.includes('llama')) {
      baseName = name.match(/llama[.-]?(\d+(?:\.\d+)?)/)?.[0]?.replace(/[.-]/g, '') || 'llama';
    } else if (name.includes('gemma')) {
      baseName = name.match(/gemma[.-]?(\d+(?:\.\d+)?)/)?.[0]?.replace(/[.-]/g, '') || 'gemma';
    } else if (name.includes('qwen')) {
      baseName = name.match(/qwen[.-]?(\d+(?:\.\d+)?)/)?.[0]?.replace(/[.-]/g, '') || 'qwen';
    } else if (name.includes('mxbai')) {
      baseName = 'mxbai-embed-large';
    } else if (name.includes('moondream')) {
      baseName = 'moondream';
    } else {
      // For other models, take the first part before any numbers or separators
      baseName = name.split(/[-._]/)[0];
    }
    
    // Extract size information
    const sizeMatch = name.match(/(\d+(?:\.\d+)?)\s*b(?:illion)?/i);
    let size = sizeMatch ? `${sizeMatch[1]}b` : null;
    
    // If no size found, check for common patterns
    if (!size) {
      if (name.includes('large') || name.includes('7b') || name.includes('8b')) {
        if (name.includes('7b')) size = '7b';
        else if (name.includes('8b')) size = '8b';
        else size = 'large';
      } else if (name.includes('small') || name.includes('1b')) {
        size = '1b';
      } else if (name.includes('medium') || name.includes('3b') || name.includes('4b')) {
        if (name.includes('3b')) size = '3b';
        else if (name.includes('4b')) size = '4b';
        else size = 'medium';
      } else {
        size = 'latest';
      }
    }
    
    return `${baseName}:${size}`;
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
      
      // Calculate optimal GPU layers for this specific model
      const optimalGpuLayers = await this.calculateOptimalGPULayers(model.path, model.size);
      
      // Find matching mmproj model for this main model
      const matchingMmproj = this.findMatchingMmproj(model, mmprojModels);
      
      let cmdLine = `      "${llamaServerPath}"
      -m "${model.path}"
      --port 9999`;

      // Add --jinja parameter for all models
      cmdLine += ` --jinja`;
      
      // Add dynamic GPU layers based on calculation
      if (optimalGpuLayers > 0) {
        cmdLine += ` --n-gpu-layers ${optimalGpuLayers}`;
        log.info(`Model ${model.name}: Using ${optimalGpuLayers} GPU layers`);
      } else {
        log.info(`Model ${model.name}: Using CPU only (0 GPU layers)`);
      }
      
      // Add mmproj parameter if a matching mmproj model is found
      if (matchingMmproj) {
        cmdLine += `
      --mmproj "${matchingMmproj.path}"`;
      }
      
      // CPU optimization from performance settings
      cmdLine += ` --threads ${perfConfig.threads}`;
      
      // **CRITICAL KV CACHE OPTIMIZATIONS FOR CONVERSATIONAL SPEED**
      
      // 1. Context window optimization - use saved setting or calculate optimal
      const contextSize = perfConfig.contextSize || this.calculateOptimalContextSize(
        model.size / (1024 * 1024 * 1024), // Convert to GB
        optimalGpuLayers > 0,
        16 // Assume reasonable memory amount, will be detected properly later
      );
      cmdLine += ` --ctx-size ${contextSize}`;
      
      // 2. Batch size optimization for both TTFT and conversation continuation
      const { batchSize, ubatchSize } = this.calculateTTFTOptimizedBatchSizes(
        model.size / (1024 * 1024 * 1024),
        { hasGPU: optimalGpuLayers > 0, gpuMemoryGB: 16 }
      );
      cmdLine += ` --batch-size ${batchSize}`;
      cmdLine += ` --ubatch-size ${ubatchSize}`;
      
      // 3. KV Cache retention for fast subsequent responses - use saved setting or calculate
      const keepTokens = perfConfig.keepTokens || Math.min(1024, Math.floor(contextSize * 0.25));
      cmdLine += ` --keep ${keepTokens}`;
      
      // 4. Cache efficiency settings - use saved setting or default
      const defragThreshold = perfConfig.defragThreshold || 0.1;
      cmdLine += ` --defrag-thold ${defragThreshold}`;
      
      // 5. Memory optimization for conversations
      cmdLine += ` --mlock`; // Lock model in memory for consistent performance
      
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
      
      // TTFT-specific optimizations (only when explicitly enabled in settings)
      if (perfConfig.optimizeFirstToken) {
        log.info(`Model ${model.name}: TTFT mode enabled - optimizing for first token speed`);
        
        // Use fewer threads for batch processing to reduce contention during prefill
        const batchThreads = Math.max(1, Math.floor(perfConfig.threads / 2));
        cmdLine += ` --threads-batch ${batchThreads}`;
        
        // Skip warmup to get to first token faster (warmup is for benchmarking)
        cmdLine += ` --no-warmup`;
        
        // TTFT mode: smaller context for faster initial response
        const ttftContextSize = Math.min(8192, contextSize);
        cmdLine = cmdLine.replace(`--ctx-size ${contextSize}`, `--ctx-size ${ttftContextSize}`);
        
        // TTFT mode: more aggressive cache clearing for speed over efficiency
        cmdLine = cmdLine.replace(`--defrag-thold ${defragThreshold}`, `--defrag-thold 0.05`);
        
        // TTFT mode: disable continuous batching
        cmdLine = cmdLine.replace(` --cont-batching`, '');
        
        log.info(`Model ${model.name}: TTFT optimizations applied - context: ${ttftContextSize}, keep: ${keepTokens}`);
      } else {
        log.info(`Model ${model.name}: Conversational mode - optimizing for multi-turn chat speed`);
        log.info(`Model ${model.name}: Context: ${contextSize}, Keep: ${keepTokens}, Batch: ${batchSize}`);
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
    proxy: "http://127.0.0.1:9999"
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

    // Add groups configuration
    configYaml += `groups:
  "default_group":
    swap: true
    exclusive: true
    members:
`;
    
    groupMembers.forEach(member => {
      configYaml += `      - "${member}"\n`;
    });

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
  findMatchingMmproj(mainModel, mmprojModels) {
    const mainModelName = mainModel.name.toLowerCase();
    const mainModelFile = mainModel.file.toLowerCase();
    
    // Special handling for gemma3 models - always use the bundled mmproj model
    if (mainModelName.includes('gemma3') || mainModelFile.includes('gemma')) {
      const bundledMmprojPath = path.join(this.baseDir, 'models', 'mmproj-model-f16.gguf');
      
      // Check if the bundled mmproj file exists
      if (fsSync.existsSync(bundledMmprojPath)) {
        return {
          name: 'mmproj-model-f16',
          file: 'mmproj-model-f16.gguf',
          path: bundledMmprojPath,
          source: 'bundled'
        };
      }
    }
    
    // For other models, try to find mmproj model with similar name pattern
    const mainModelBaseName = this.getModelBaseName(mainModel.file);
    
    for (const mmprojModel of mmprojModels) {
      const mmprojBaseName = this.getModelBaseName(mmprojModel.file);
      
      // Check if they share a common base name (e.g., "Qwen2.5-VL-7B")
      if (this.modelsMatch(mainModelBaseName, mmprojBaseName)) {
        return mmprojModel;
      }
    }
    
    // For vision/multimodal models that don't have a specific mmproj match,
    // check if this appears to be a vision model and use bundled mmproj as fallback
    if (this.isVisionModel(mainModel.file)) {
      const bundledMmprojPath = path.join(this.baseDir, 'models', 'mmproj-model-f16.gguf');
      
      if (fsSync.existsSync(bundledMmprojPath)) {
        log.info(`Using bundled mmproj for vision model: ${mainModel.name}`);
        return {
          name: 'mmproj-model-f16',
          file: 'mmproj-model-f16.gguf',
          path: bundledMmprojPath,
          source: 'bundled'
        };
      }
    }
    
    return null;
  }

  // Helper method to detect vision/multimodal models
  isVisionModel(filename) {
    const visionKeywords = ['vl', 'vision', 'multimodal', 'mm', 'clip', 'siglip'];
    const lowerFilename = filename.toLowerCase();
    
    return visionKeywords.some(keyword => lowerFilename.includes(keyword));
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
    if (this.isRunning) {
      log.info('Llama-swap service is already running');
      return { success: true, message: 'Service already running' };
    }

    // Check for stale processes after updates
    await this.cleanupStaleProcesses();

    try {
      // macOS Security Pre-check - Prepare for potential firewall prompts
      if (process.platform === 'darwin') {
        log.info('🔒 macOS detected - checking network security requirements...');
        
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

      this.process = spawn(this.binaryPaths.llamaSwap, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: this.platformManager.getPlatformEnvironment(),
        detached: false
      });

      this.isRunning = true;
      
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
        }
        
        this.parseProgressFromOutput(output);
      });

      this.process.stderr.on('data', (data) => {
        const error = data.toString();
        log.error(`llama-swap stderr: ${error.trim()}`);
        
        // Check for V cache quantization error that requires flash attention
        if (error.includes('V cache quantization requires flash_attn') || 
            error.includes('failed to create context with model')) {
          log.warn('⚠️ Model requires flash attention for V cache quantization - will retry with flash attention enabled');
          this.handleFlashAttentionRequired = true;
        }
        
        // Enhanced error handling for common issues
        if (error.includes('bind: address already in use')) {
          log.error(`❌ Port ${this.port} is already in use. Please stop any existing llama-swap processes.`);
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
      port: this.port,
      pid: this.process?.pid,
      apiUrl: `http://localhost:${this.port}`,
      processExists: hasProcess,
      flagStatus: this.isRunning
    };
  }

  // Add a new method to check if service is actually responding
  async getStatusWithHealthCheck() {
    const basicStatus = this.getStatus();
    
    // If we think it's not running, return early
    if (!basicStatus.isRunning) {
      return basicStatus;
    }
    
    // Try to make a quick health check
    try {
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
      
      return {
        ...basicStatus,
        isResponding: response.ok,
        healthCheck: 'passed'
      };
    } catch (error) {
      return {
        ...basicStatus,
        isResponding: false,
        healthCheck: 'failed',
        healthError: error.message
      };
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
      enableContinuousBatching: true  // Explicit continuous batching flag
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
      conversationMode: 'balanced'
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
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      log.warn('Stale process cleanup encountered error:', error.message);
      // Don't fail startup if cleanup fails
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
}

module.exports = LlamaSwapService;