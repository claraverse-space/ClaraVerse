/**
 * Utility functions for parsing llamacpp command line parameters
 */

export interface ParsedModelConfig {
  name: string;
  modelPath?: string;
  port?: number;
  gpuLayers?: number;
  estimatedTotalLayers?: number;
  modelSizeGB?: number;
  threads?: number;
  contextSize?: number;
  nativeContextSize?: number; // From GGUF metadata
  batchSize?: number;
  ubatchSize?: number;
  keep?: number;
  defragThreshold?: number;
  memoryLock?: boolean;
  parallel?: number;
  flashAttention?: boolean;
  continuousBatching?: boolean;
  noMmap?: boolean;
  tensorSplit?: string;
  cacheTypeK?: string;
  cacheTypeV?: string;
  jinja?: boolean;
  mmproj?: string;
  pooling?: string;
  embeddings?: boolean;
  ttl?: number;
  proxy?: string;
  isEmbedding?: boolean;
}

/**
 * Parse llamacpp command line arguments to extract configuration
 */
export function parseCommandLine(cmd: string): Partial<ParsedModelConfig> {
  if (!cmd) return {};

  const config: Partial<ParsedModelConfig> = {};
  
  // Split command line into arguments, handling quoted strings
  const args = parseArgs(cmd);
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];
    
    switch (arg) {
      case '-m':
      case '--model':
        config.modelPath = nextArg;
        i++;
        break;
      case '--port':
        config.port = parseInt(nextArg, 10);
        i++;
        break;
      case '--n-gpu-layers':
        config.gpuLayers = parseInt(nextArg, 10);
        i++;
        break;
      case '--threads':
        config.threads = parseInt(nextArg, 10);
        i++;
        break;
      case '--ctx-size':
        config.contextSize = parseInt(nextArg, 10);
        i++;
        break;
      case '--batch-size':
        config.batchSize = parseInt(nextArg, 10);
        i++;
        break;
      case '--ubatch-size':
        config.ubatchSize = parseInt(nextArg, 10);
        i++;
        break;
      case '--keep':
        config.keep = parseInt(nextArg, 10);
        i++;
        break;
      case '--defrag-thold':
        config.defragThreshold = parseFloat(nextArg);
        i++;
        break;
      case '--parallel':
        config.parallel = parseInt(nextArg, 10);
        i++;
        break;
      case '--tensor-split':
        config.tensorSplit = nextArg;
        i++;
        break;
      case '--cache-type-k':
        config.cacheTypeK = nextArg;
        i++;
        break;
      case '--cache-type-v':
        config.cacheTypeV = nextArg;
        i++;
        break;
      case '--mmproj':
        config.mmproj = nextArg;
        i++;
        break;
      case '--pooling':
        config.pooling = nextArg;
        i++;
        break;
      case '--mlock':
        config.memoryLock = true;
        break;
      case '--flash-attn':
        config.flashAttention = true;
        break;
      case '--cont-batching':
        config.continuousBatching = true;
        break;
      case '--no-mmap':
        config.noMmap = true;
        break;
      case '--jinja':
        config.jinja = true;
        break;
      case '--embeddings':
        config.embeddings = true;
        config.isEmbedding = true;
        break;
    }
  }
  
  return config;
}

/**
 * Clean up command line to be properly formatted on a single line
 */
export function cleanCommandLine(cmd: string): string {
  if (!cmd) return cmd;
  
  // Parse and rejoin to clean up formatting
  const args = parseArgs(cmd);
  
  // Re-quote paths that contain spaces and aren't already quoted
  const cleanedArgs = args.map(arg => {
    // If it contains spaces and backslashes (likely a Windows path) and isn't already quoted
    if (arg.includes(' ') && arg.includes('\\') && !arg.startsWith('"') && !arg.startsWith("'")) {
      return `"${arg}"`;
    }
    return arg;
  });
  
  return cleanedArgs.join(' ');
}

/**
 * Parse command line string into arguments array, handling quoted strings and malformed YAML
 */
function parseArgs(cmd: string): string[] {
  if (!cmd) return [];
  
  // First, try to clean up obvious YAML formatting issues
  let cleanCmd = cmd;
  
  // If it looks like YAML with arguments on separate lines, join them
  if (cleanCmd.includes('\n') && !cleanCmd.includes(' ')) {
    // This looks like YAML format where each arg is on its own line
    cleanCmd = cleanCmd.split('\n').map(line => line.trim()).filter(line => line).join(' ');
  }
  
  const args: string[] = [];
  let current = '';
  let inQuotes = false;
  let quoteChar = '';
  
  for (let i = 0; i < cleanCmd.length; i++) {
    const char = cleanCmd[i];
    
    if ((char === '"' || char === "'") && !inQuotes) {
      inQuotes = true;
      quoteChar = char;
      current += char; // Keep the quote
    } else if (char === quoteChar && inQuotes) {
      inQuotes = false;
      quoteChar = '';
      current += char; // Keep the quote
    } else if ((char === ' ' || char === '\n' || char === '\t') && !inQuotes) {
      if (current.trim()) {
        args.push(current.trim());
        current = '';
      }
    } else {
      current += char;
    }
  }
  
  if (current.trim()) {
    args.push(current.trim());
  }
  
  return args;
}

/**
 * Parse complete JSON configuration to extract model configurations
 */
export function parseJsonConfiguration(jsonConfig: any): ParsedModelConfig[] {
  if (!jsonConfig || !jsonConfig.models) {
    return [];
  }
  
  const models: ParsedModelConfig[] = [];
  
  for (const [modelName, modelData] of Object.entries(jsonConfig.models)) {
    const data = modelData as any;
    
    // Clean up the command line first
    const cleanedCmd = cleanCommandLine(data.cmd || '');
    const parsedConfig = parseCommandLine(cleanedCmd);
    
    // Estimate model size from file path if available
    let modelSizeGB: number | undefined;
    if (parsedConfig.modelPath) {
      const fileName = parsedConfig.modelPath.toLowerCase();
      modelSizeGB = estimateModelSizeFromPath(fileName);
    }
    
    // Estimate total layers for this model
    const estimatedTotalLayers = estimateModelTotalLayers(modelName, modelSizeGB);

    const modelConfig: ParsedModelConfig = {
      name: modelName,
      ttl: data.ttl,
      proxy: data.proxy,
      estimatedTotalLayers,
      modelSizeGB,
      ...parsedConfig
    };
    
    // Determine if it's an embedding model
    modelConfig.isEmbedding = !!(
      modelConfig.embeddings || 
      modelConfig.pooling || 
      modelName.includes('embed')
    );
    
    models.push(modelConfig);
  }
  
  return models;
}

/**
 * Estimate model size from file path/name
 */
function estimateModelSizeFromPath(fileName: string): number {
  const name = fileName.toLowerCase();
  
  // Try to extract size from filename patterns
  if (name.includes('30b') || name.includes('27b')) return 25;
  if (name.includes('13b') || name.includes('14b')) return 14;
  if (name.includes('7b') || name.includes('8b')) return 7;
  if (name.includes('3b') || name.includes('4b')) return 3;
  if (name.includes('1b') || name.includes('nano')) return 1;
  if (name.includes('embed')) return 0.5;
  
  // Try to extract from quantization info (rough estimates)
  if (name.includes('q2_k') || name.includes('q2_0')) return 3; // Very compressed
  if (name.includes('q3_k') || name.includes('q3_0')) return 4;
  if (name.includes('q4_k') || name.includes('q4_0')) return 5;
  if (name.includes('q5_k') || name.includes('q5_0')) return 6;
  if (name.includes('q6_k') || name.includes('q6_0')) return 7;
  if (name.includes('q8_0') || name.includes('f16')) return 8;
  
  return 7; // Default assumption for 7B model
}

/**
 * Generate command line from configuration
 */
export function generateCommandLine(config: ParsedModelConfig, binaryPath: string): string {
  const args: string[] = [];
  
  // Add binary path (quoted)
  args.push(`"${binaryPath}"`);
  
  // Add model path
  if (config.modelPath) {
    args.push('-m', `"${config.modelPath}"`);
  }
  
  // Add port
  if (config.port !== undefined) {
    args.push('--port', config.port.toString());
  }
  
  // Add jinja if enabled
  if (config.jinja) {
    args.push('--jinja');
  }
  
  // Add GPU layers
  if (config.gpuLayers !== undefined) {
    args.push('--n-gpu-layers', config.gpuLayers.toString());
  }
  
  // Add threads
  if (config.threads !== undefined) {
    args.push('--threads', config.threads.toString());
  }
  
  // Add context size
  if (config.contextSize !== undefined) {
    args.push('--ctx-size', config.contextSize.toString());
  }
  
  // Add batch size
  if (config.batchSize !== undefined) {
    args.push('--batch-size', config.batchSize.toString());
  }
  
  // Add ubatch size
  if (config.ubatchSize !== undefined) {
    args.push('--ubatch-size', config.ubatchSize.toString());
  }
  
  // Add keep tokens
  if (config.keep !== undefined) {
    args.push('--keep', config.keep.toString());
  }
  
  // Add defrag threshold
  if (config.defragThreshold !== undefined) {
    args.push('--defrag-thold', config.defragThreshold.toString());
  }
  
  // Add memory lock
  if (config.memoryLock) {
    args.push('--mlock');
  }
  
  // Add parallel
  if (config.parallel !== undefined) {
    args.push('--parallel', config.parallel.toString());
  }
  
  // Add flash attention
  if (config.flashAttention) {
    args.push('--flash-attn');
  }
  
  // Add continuous batching
  if (config.continuousBatching) {
    args.push('--cont-batching');
  }
  
  // Add no mmap
  if (config.noMmap) {
    args.push('--no-mmap');
  }
  
  // Add tensor split
  if (config.tensorSplit) {
    args.push('--tensor-split', config.tensorSplit);
  }
  
  // Add cache types
  if (config.cacheTypeK) {
    args.push('--cache-type-k', config.cacheTypeK);
  }
  
  if (config.cacheTypeV) {
    args.push('--cache-type-v', config.cacheTypeV);
  }
  
  // Add mmproj for multimodal models
  if (config.mmproj) {
    args.push('--mmproj', `"${config.mmproj}"`);
  }
  
  // Add embedding-specific options
  if (config.isEmbedding) {
    if (config.pooling) {
      args.push('--pooling', config.pooling);
    }
    if (config.embeddings) {
      args.push('--embeddings');
    }
  }
  
  return args.join(' ');
}

/**
 * Update a specific parameter in a command line string
 */
export function updateCommandLineParameter(cmd: string, field: keyof ParsedModelConfig, value: any): string {
  if (!cmd) return cmd;
  
  const args = parseArgs(cmd);
  const newArgs: string[] = [];
  let i = 0;
  let parameterUpdated = false;
  
  // Map field names to command line arguments
  const fieldToArgMap: Record<string, string> = {
    contextSize: '--ctx-size',
    gpuLayers: '--n-gpu-layers',
    threads: '--threads',
    batchSize: '--batch-size',
    ubatchSize: '--ubatch-size',
    keep: '--keep',
    defragThreshold: '--defrag-thold',
    parallel: '--parallel',
    tensorSplit: '--tensor-split',
    cacheTypeK: '--cache-type-k',
    cacheTypeV: '--cache-type-v',
    mmproj: '--mmproj',
    pooling: '--pooling'
  };
  
  const targetArg = fieldToArgMap[field as string];
  if (!targetArg) {
    // For boolean flags
    const booleanFlags: Record<string, string> = {
      memoryLock: '--mlock',
      flashAttention: '--flash-attn',
      continuousBatching: '--cont-batching',
      noMmap: '--no-mmap',
      jinja: '--jinja',
      embeddings: '--embeddings'
    };
    
    const flagArg = booleanFlags[field as string];
    if (flagArg) {
      // Handle boolean flags
      for (let j = 0; j < args.length; j++) {
        if (args[j] === flagArg) {
          // Flag exists, remove it if value is false
          if (!value) {
            // Skip this flag
            continue;
          }
        }
        newArgs.push(args[j]);
      }
      
      // Add flag if value is true and not already present
      if (value && !args.includes(flagArg)) {
        newArgs.push(flagArg);
      }
      
      return newArgs.join(' ');
    }
    
    // Unknown field, return original
    return cmd;
  }
  
  // Process arguments and update the target parameter
  while (i < args.length) {
    const arg = args[i];
    
    if (arg === targetArg) {
      // Found the parameter to update
      newArgs.push(arg);
      newArgs.push(value.toString());
      i += 2; // Skip the old value
      parameterUpdated = true;
    } else {
      newArgs.push(arg);
      i++;
    }
  }
  
  // If parameter wasn't found, add it
  if (!parameterUpdated && value !== undefined && value !== null) {
    newArgs.push(targetArg);
    newArgs.push(value.toString());
  }
  
  return newArgs.join(' ');
}

/**
 * Get human-readable model name from file path
 */
export function getModelDisplayName(modelPath: string): string {
  if (!modelPath) return 'Unknown Model';
  
  const fileName = modelPath.split(/[/\\]/).pop() || '';
  return fileName.replace(/\.(gguf|bin)$/, '');
}

/**
 * Estimate model size category based on name
 */
export function estimateModelSize(modelName: string): string {
  const name = modelName.toLowerCase();
  
  if (name.includes('30b') || name.includes('27b')) return 'Large (27B-30B)';
  if (name.includes('7b') || name.includes('8b')) return 'Medium (7B-8B)';
  if (name.includes('3b') || name.includes('4b')) return 'Small (3B-4B)';
  if (name.includes('1b') || name.includes('nano')) return 'Tiny (1B)';
  if (name.includes('embed')) return 'Embedding';
  
  return 'Unknown Size';
}

/**
 * Get recommended GPU layers based on model size and GPU memory
 */
export function getRecommendedGpuLayers(modelSize: string, gpuMemoryGB: number): number {
  if (modelSize.includes('30B') || modelSize.includes('27B')) {
    if (gpuMemoryGB >= 24) return 50;
    if (gpuMemoryGB >= 16) return 35;
    if (gpuMemoryGB >= 12) return 25;
    return 15;
  }
  
  if (modelSize.includes('7B') || modelSize.includes('8B')) {
    if (gpuMemoryGB >= 12) return 50;
    if (gpuMemoryGB >= 8) return 40;
    if (gpuMemoryGB >= 6) return 30;
    return 20;
  }
  
  if (modelSize.includes('3B') || modelSize.includes('4B')) {
    if (gpuMemoryGB >= 6) return 50;
    if (gpuMemoryGB >= 4) return 40;
    return 30;
  }
  
  return 50; // Default for small models
}

/**
 * Estimate total layers for a model based on its name and size
 */
export function estimateModelTotalLayers(modelName: string, modelSizeGB?: number): number {
  const name = modelName.toLowerCase();
  
  // Try to extract parameter count from filename
  const paramMatch = name.match(/(\d+(?:\.\d+)?)\s*b/i);
  let estimatedLayers = 32; // default for 7B models
  
  if (paramMatch) {
    const paramCount = parseFloat(paramMatch[1]);
    
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
  } else {
    // Fallback to size-based estimation
    if (name.includes('30b') || name.includes('27b')) estimatedLayers = 60;
    else if (name.includes('7b') || name.includes('8b')) estimatedLayers = 32;
    else if (name.includes('3b') || name.includes('4b')) estimatedLayers = 26;
    else if (name.includes('1b') || name.includes('nano')) estimatedLayers = 22;
  }

  // Adjust based on model size if available (more accurate than filename sometimes)
  if (modelSizeGB) {
    if (modelSizeGB < 1) {
      estimatedLayers = Math.min(estimatedLayers, 22);
    } else if (modelSizeGB < 4) {
      estimatedLayers = Math.min(estimatedLayers, 32);
    } else if (modelSizeGB < 8) {
      estimatedLayers = Math.min(estimatedLayers, 40);
    } else if (modelSizeGB < 15) {
      estimatedLayers = Math.min(estimatedLayers, 60);
    }
  }

  return estimatedLayers;
}

/**
 * Get memory warning level for GPU layer configuration
 */
export function getMemoryWarningLevel(
  gpuLayers: number, 
  totalLayers: number, 
  modelSizeGB: number, 
  gpuMemoryGB: number
): 'safe' | 'warning' | 'danger' {
  if (gpuLayers === 0) return 'safe'; // CPU only is always safe
  
  // Estimate memory usage per layer
  const memoryPerLayerGB = modelSizeGB / totalLayers;
  const estimatedGpuMemoryUsed = (gpuLayers * memoryPerLayerGB) + 1; // +1GB for overhead
  
  const memoryUsagePercent = (estimatedGpuMemoryUsed / gpuMemoryGB) * 100;
  
  if (memoryUsagePercent > 90) return 'danger';
  if (memoryUsagePercent > 75) return 'warning';
  return 'safe';
}

/**
 * Get memory warning message
 */
export function getMemoryWarningMessage(
  warningLevel: 'safe' | 'warning' | 'danger',
  gpuLayers: number,
  totalLayers: number,
  estimatedMemoryUsage: number,
  gpuMemoryGB: number
): string {
  switch (warningLevel) {
    case 'danger':
      return `⚠️ High risk of crash! Using ${gpuLayers}/${totalLayers} layers may exceed GPU memory (${estimatedMemoryUsage.toFixed(1)}GB / ${gpuMemoryGB}GB)`;
    case 'warning':
      return `⚠️ May cause performance issues. Using ${estimatedMemoryUsage.toFixed(1)}GB of ${gpuMemoryGB}GB GPU memory`;
    case 'safe':
    default:
      return `✅ Safe configuration. Using ${estimatedMemoryUsage.toFixed(1)}GB of ${gpuMemoryGB}GB GPU memory`;
  }
}

/**
 * Calculate KV cache memory usage for context size
 */
export function calculateKVCacheMemory(
  contextSize: number,
  modelSizeGB: number,
  gpuLayers: number,
  totalLayers: number
): number {
  // KV cache memory formula (approximate):
  // KV cache = (context_size * hidden_size * num_layers * 2) / (1024^3)
  // hidden_size varies by model size, 2 is for key + value
  
  let hiddenSize: number;
  
  // Estimate hidden dimensions based on model size
  if (modelSizeGB >= 25) { // 30B+ models
    hiddenSize = 8192;
  } else if (modelSizeGB >= 12) { // 13-15B models  
    hiddenSize = 5120;
  } else if (modelSizeGB >= 6) { // 7-8B models
    hiddenSize = 4096;
  } else if (modelSizeGB >= 2) { // 3-4B models
    hiddenSize = 2560;
  } else { // 1B models
    hiddenSize = 2048;
  }
  
  // Calculate KV cache size per layer (in bytes)
  const kvCachePerLayer = contextSize * hiddenSize * 2 * 2; // 2 for K+V, 2 bytes per float16
  
  // Only GPU layers contribute to GPU memory usage
  const gpuLayerRatio = gpuLayers / totalLayers;
  const kvCacheGB = (kvCachePerLayer * totalLayers * gpuLayerRatio) / (1024 * 1024 * 1024);
  
  return kvCacheGB;
}

/**
 * Get model's maximum supported context size based on GGUF metadata or architecture fallback
 */
export function getModelMaxContextSize(modelName: string, nativeContextSize?: number): number {
  // If we have the actual context size from GGUF metadata, use it!
  if (nativeContextSize && nativeContextSize > 0) {
    return nativeContextSize;
  }
  
  // Fallback to architecture-based estimation if no metadata available
  const name = modelName.toLowerCase();
  
  // Extract parameter count from filename
  const paramMatch = name.match(/(\d+(?:\.\d+)?)\s*b/i);
  let maxContext = 32768; // Default 32K
  
  if (paramMatch) {
    const paramCount = parseFloat(paramMatch[1]);
    
    // Model architecture determines max context
    if (paramCount >= 70) {
      maxContext = 131072; // 128K for large models (Llama-70B+)
    } else if (paramCount >= 30) {
      maxContext = 65536;  // 64K for 30B models
    } else if (paramCount >= 13) {
      maxContext = 65536;  // 64K for 13B models
    } else if (paramCount >= 7) {
      maxContext = 131072; // 128K for 7B models (like Llama-7B)
    } else if (paramCount >= 3) {
      maxContext = 32768;  // 32K for 3B models
    } else {
      maxContext = 16384;  // 16K for 1B models
    }
  } else {
    // Fallback based on model names and architecture hints
    if (name.includes('llama') && (name.includes('7b') || name.includes('8b'))) {
      maxContext = 131072; // Llama-7B supports up to 128K
    } else if (name.includes('30b') || name.includes('27b')) {
      maxContext = 65536;
    } else if (name.includes('13b') || name.includes('14b')) {
      maxContext = 65536;
    } else if (name.includes('3b') || name.includes('4b')) {
      maxContext = 32768;
    } else if (name.includes('1b') || name.includes('nano')) {
      maxContext = 16384;
    }
    
    // Check for specific architecture mentions
    if (name.includes('128k') || name.includes('131k')) {
      maxContext = 131072;
    } else if (name.includes('64k') || name.includes('65k')) {
      maxContext = 65536;
    } else if (name.includes('32k')) {
      maxContext = 32768;
    } else if (name.includes('16k')) {
      maxContext = 16384;
    } else if (name.includes('8k')) {
      maxContext = 8192;
    } else if (name.includes('4k')) {
      maxContext = 4096;
    }
  }
  
  // Some models have extended context versions
  if (name.includes('longchat') || name.includes('long') || name.includes('extended')) {
    maxContext = Math.max(maxContext, 131072);
  }
  
  return maxContext;
}
/**
 * Get safe context size for current GPU configuration
 */
export function getSafeContextSize(
  modelName: string,
  modelSizeGB: number,
  gpuLayers: number,
  totalLayers: number,
  gpuMemoryGB: number,
  nativeContextSize?: number
): {
  safeContextSize: number;
  maxContextSize: number;
  modelMaxContextSize: number;
  recommendNoMmap: boolean;
} {
  // Get the model's architectural maximum (using real metadata if available)
  const modelMaxContextSize = getModelMaxContextSize(modelName, nativeContextSize);
  
  // Calculate model memory usage on GPU
  const memoryPerLayerGB = modelSizeGB / totalLayers;
  const modelMemoryUsageGB = (gpuLayers * memoryPerLayerGB);
  
  // Reserve memory for model + overhead (1GB minimum)
  const reservedMemoryGB = modelMemoryUsageGB + Math.max(1, gpuMemoryGB * 0.15);
  const availableMemoryGB = gpuMemoryGB - reservedMemoryGB;
  
  if (availableMemoryGB <= 0) {
    return {
      safeContextSize: 2048,
      maxContextSize: 4096,
      modelMaxContextSize,
      recommendNoMmap: true
    };
  }
  
  // Binary search for safe context size (75% threshold)
  let low = 2048;
  let high = modelMaxContextSize; // Use model's max as upper bound
  let safeContext = 2048;
  let maxContext = 4096;
  
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const kvMemory = calculateKVCacheMemory(mid, modelSizeGB, gpuLayers, totalLayers);
    
    if (kvMemory <= availableMemoryGB * 0.75) { // 75% threshold for "safe"
      safeContext = mid;
      low = mid + 1024;
    } else {
      high = mid - 1024;
    }
  }
  
  // Find absolute maximum we can handle (90% threshold)
  low = safeContext;
  high = modelMaxContextSize;
  
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const kvMemory = calculateKVCacheMemory(mid, modelSizeGB, gpuLayers, totalLayers);
    
    if (kvMemory <= availableMemoryGB * 0.9) { // 90% threshold for "max"
      maxContext = mid;
      low = mid + 1024;
    } else {
      high = mid - 1024;
    }
  }
  
  // Recommend --no-mmap if GPU memory is tight
  const recommendNoMmap = availableMemoryGB < 4 || gpuMemoryGB < 12;
  
  return {
    safeContextSize: Math.max(2048, Math.min(safeContext, modelMaxContextSize)),
    maxContextSize: Math.max(safeContext, Math.min(maxContext, modelMaxContextSize)),
    modelMaxContextSize,
    recommendNoMmap
  };
}

/**
 * Get context size warning level and message
 */
export function getContextWarningLevel(
  contextSize: number,
  modelSizeGB: number,
  gpuLayers: number,
  totalLayers: number,
  gpuMemoryGB: number
): {
  warningLevel: 'safe' | 'warning' | 'danger';
  message: string;
  kvCacheMemoryGB: number;
  totalMemoryUsageGB: number;
  suggestNoMmap: boolean;
} {
  // Calculate memory usage
  const memoryPerLayerGB = modelSizeGB / totalLayers;
  const modelMemoryGB = gpuLayers * memoryPerLayerGB;
  const kvCacheMemoryGB = calculateKVCacheMemory(contextSize, modelSizeGB, gpuLayers, totalLayers);
  const totalMemoryUsageGB = modelMemoryGB + kvCacheMemoryGB;
  
  const memoryUsagePercent = (totalMemoryUsageGB / gpuMemoryGB) * 100;
  
  let warningLevel: 'safe' | 'warning' | 'danger';
  let message: string;
  let suggestNoMmap = false;
  
  if (memoryUsagePercent > 90) {
    warningLevel = 'danger';
    message = `🚨 High crash risk! Context ${(contextSize/1000).toFixed(0)}K uses ${totalMemoryUsageGB.toFixed(1)}GB/${gpuMemoryGB}GB (${memoryUsagePercent.toFixed(0)}%). KV cache: ${kvCacheMemoryGB.toFixed(1)}GB`;
    suggestNoMmap = true;
  } else if (memoryUsagePercent > 75) {
    warningLevel = 'warning';
    message = `⚠️ Memory pressure. Context ${(contextSize/1000).toFixed(0)}K uses ${totalMemoryUsageGB.toFixed(1)}GB/${gpuMemoryGB}GB (${memoryUsagePercent.toFixed(0)}%). KV cache: ${kvCacheMemoryGB.toFixed(1)}GB`;
    suggestNoMmap = gpuMemoryGB < 12;
  } else {
    warningLevel = 'safe';
    message = `✅ Safe context size. Using ${totalMemoryUsageGB.toFixed(1)}GB/${gpuMemoryGB}GB (${memoryUsagePercent.toFixed(0)}%). KV cache: ${kvCacheMemoryGB.toFixed(1)}GB`;
  }
  
  return {
    warningLevel,
    message,
    kvCacheMemoryGB,
    totalMemoryUsageGB,
    suggestNoMmap
  };
}
