import React, { useState, useEffect } from 'react';
import { Search, HardDrive, Zap, CheckCircle, TrendingUp, Clock, Star, RefreshCw, AlertCircle } from 'lucide-react';
import { HuggingFaceModel, DownloadProgress } from './types';
import EnhancedModelCard from './EnhancedModelCard';

interface EnhancedModelDiscoveryProps {
  onDownload: (modelId: string, fileName: string) => void;
  onDownloadWithDependencies?: (modelId: string, fileName: string, allFiles: Array<{ rfilename: string; size?: number }>) => void;
  downloading: Set<string>;
  downloadProgress: { [fileName: string]: DownloadProgress };
}

interface SystemInfo {
  totalRAM: number;
  availableRAM: number;
  gpu: {
    name: string;
    vram: number;
    hasNvidiaGPU: boolean;
    isAMD: boolean;
  } | null;
}

interface EnhancedModel extends HuggingFaceModel {
  compatibility: {
    fitsInRAM: 'yes' | 'maybe' | 'no';
    fitsInVRAM: 'yes' | 'maybe' | 'no' | 'na';
    parameterCount: string;
    estimatedRAMUsage: number;
    quantization: string;
    architecture: string;
  };
  metadata?: {
    embeddingSize?: number;
    contextLength?: number;
    isVisionModel?: boolean;
    needsMmproj?: boolean;
    availableQuantizations?: Array<{
      type: string;
      files: Array<{ rfilename: string; size?: number }>;
      totalSize: number;
      displayName: string;
    }>;
  };
}

const EnhancedModelDiscovery: React.FC<EnhancedModelDiscoveryProps> = ({
  onDownload,
  onDownloadWithDependencies,
  downloading,
  downloadProgress
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [models, setModels] = useState<EnhancedModel[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [activeFilter, setActiveFilter] = useState<'recommended' | 'latest' | 'popular' | 'trending'>('recommended');
  const [apiError, setApiError] = useState<string | null>(null);
  const [isRateLimited, setIsRateLimited] = useState(false);

  // Load system information
  useEffect(() => {
    const loadSystemInfo = async () => {
      try {
        // Try multiple GPU detection methods in order of preference
        const [sysInfo, electronGPU, llamaSwapGPU] = await Promise.all([
          (window as any).electronAPI?.getSystemInfo(),
          (window as any).electronAPI?.getGPUInfo(),
          (window as any).llamaSwap?.getGPUDiagnostics()
        ]);

        console.log('System info:', sysInfo);
        console.log('Electron GPU info:', electronGPU);
        console.log('LlamaSwap GPU diagnostics:', llamaSwapGPU);

        // Parse RAM from system info - handle multiple formats
        let totalRAM = 8 * 1024 * 1024 * 1024; // 8GB default
        let availableRAM = 4 * 1024 * 1024 * 1024; // 4GB default

        if (sysInfo) {
          // Try different memory field formats
          if (sysInfo.totalMemory && sysInfo.freeMemory) {
            totalRAM = sysInfo.totalMemory;
            availableRAM = sysInfo.freeMemory;
          } else if (sysInfo.memory) {
            totalRAM = sysInfo.memory.total || totalRAM;
            availableRAM = sysInfo.memory.free || sysInfo.memory.available || totalRAM * 0.5;
          } else if (typeof sysInfo.ram === 'string') {
            // Handle string format like "64 GB"
            const ramMatch = sysInfo.ram.match(/(\d+\.?\d*)/);
            if (ramMatch) {
              totalRAM = parseFloat(ramMatch[1]) * 1024 * 1024 * 1024;
              availableRAM = totalRAM * 0.6; // Assume 60% available
            }
          }
        }

        // Parse GPU info - try LlamaSwap GPU diagnostics first (most comprehensive)
        let gpu = null;
        
        if (llamaSwapGPU?.success && llamaSwapGPU.gpuInfo) {
          const gpuData = llamaSwapGPU.gpuInfo;
          console.log('Using LlamaSwap GPU data:', gpuData);
          console.log('Available GPU fields:', Object.keys(gpuData));
          
          // Try multiple VRAM field names that might be returned
          let vramBytes = 0;
          if (gpuData.gpuMemoryBytes) {
            vramBytes = gpuData.gpuMemoryBytes;
            console.log('Found VRAM via gpuMemoryBytes:', vramBytes);
          } else if (gpuData.gpuMemoryGB) {
            vramBytes = gpuData.gpuMemoryGB * 1024 * 1024 * 1024;
            console.log('Found VRAM via gpuMemoryGB:', gpuData.gpuMemoryGB, 'GB');
          } else if (gpuData.vramSize) {
            vramBytes = gpuData.vramSize;
            console.log('Found VRAM via vramSize:', vramBytes);
          } else if (gpuData.dedicatedVideoMemory) {
            vramBytes = gpuData.dedicatedVideoMemory;
            console.log('Found VRAM via dedicatedVideoMemory:', vramBytes);
          }
          
          // Try multiple GPU name fields
          const gpuName = gpuData.gpuName || 
                         gpuData.name || 
                         gpuData.deviceName || 
                         gpuData.description ||
                         'Unknown GPU';
          
          console.log('GPU name candidates:', {
            gpuName: gpuData.gpuName,
            name: gpuData.name,
            deviceName: gpuData.deviceName,
            description: gpuData.description,
            final: gpuName
          });
          
          gpu = {
            name: gpuName,
            vram: vramBytes,
            hasNvidiaGPU: gpuData.hasNvidiaGPU || gpuData.gpuType === 'nvidia' || gpuName.toLowerCase().includes('nvidia') || false,
            isAMD: gpuData.isAMD || gpuData.gpuType === 'amd' || gpuName.toLowerCase().includes('amd') || false
          };
        }
        
        // Fallback to Electron GPU info if LlamaSwap doesn't have complete info
        if ((!gpu || gpu.name === 'Unknown GPU' || gpu.vram === 0) && electronGPU?.success && electronGPU.gpuInfo) {
          const gpuData = electronGPU.gpuInfo;
          console.log('Using Electron GPU data:', gpuData);
          
          // Try multiple VRAM field names
          let vramBytes = gpu?.vram || 0;
          if (!vramBytes) {
            if (gpuData.vramSize) {
              vramBytes = gpuData.vramSize;
            } else if (gpuData.memorySize) {
              vramBytes = gpuData.memorySize;
            } else if (gpuData.dedicatedVideoMemory) {
              vramBytes = gpuData.dedicatedVideoMemory;
            }
          }
          
          // Try multiple GPU name fields
          const gpuName = gpuData.gpuName || 
                         gpuData.name || 
                         gpuData.deviceName || 
                         gpuData.description ||
                         gpu?.name ||
                         'Unknown GPU';
          
          gpu = {
            name: gpuName,
            vram: vramBytes,
            hasNvidiaGPU: gpuData.hasNvidiaGPU || gpuData.vendor?.toLowerCase().includes('nvidia') || gpuName.toLowerCase().includes('nvidia') || false,
            isAMD: gpuData.isAMD || gpuData.vendor?.toLowerCase().includes('amd') || gpuName.toLowerCase().includes('amd') || false
          };
        }

        // If we still don't have VRAM info but have GPU name, try to estimate VRAM
        if (gpu && gpu.vram === 0 && gpu.name && gpu.name !== 'Unknown GPU') {
          const estimatedVRAM = estimateVRAMFromGPUName(gpu.name);
          if (estimatedVRAM > 0) {
            gpu.vram = estimatedVRAM;
            console.log(`Estimated VRAM for ${gpu.name}: ${estimatedVRAM / (1024 * 1024 * 1024)}GB`);
          }
        }

        // If we have VRAM but no GPU name, try to reverse-engineer the GPU name
        if (gpu && gpu.vram > 0 && (gpu.name === 'Unknown GPU' || !gpu.name)) {
          const vramGB = gpu.vram / (1024 * 1024 * 1024);
          gpu.name = estimateGPUNameFromVRAM(vramGB, gpu.hasNvidiaGPU, gpu.isAMD);
        }

        console.log('Final parsed system info:', { totalRAM, availableRAM, gpu });

        // Cache system info for model analysis
        (window as any).__systemInfo = {
          totalRAM,
          availableRAM,
          gpu
        };

        setSystemInfo({
          totalRAM,
          availableRAM,
          gpu
        });
      } catch (error) {
        console.error('Failed to load system info:', error);
        // Set defaults
        setSystemInfo({
          totalRAM: 8 * 1024 * 1024 * 1024, // 8GB default
          availableRAM: 4 * 1024 * 1024 * 1024, // 4GB default
          gpu: null
        });
      }
    };

    loadSystemInfo();
  }, []);

  // Helper function to estimate VRAM for known GPU models
  const estimateVRAMFromGPUName = (gpuName: string): number => {
    const name = gpuName.toLowerCase();
    
    // NVIDIA RTX 40 series
    if (name.includes('rtx 4090')) return 24 * 1024 * 1024 * 1024; // 24GB
    if (name.includes('rtx 4080')) return 16 * 1024 * 1024 * 1024; // 16GB
    if (name.includes('rtx 4070 ti')) return 12 * 1024 * 1024 * 1024; // 12GB
    if (name.includes('rtx 4070')) return 12 * 1024 * 1024 * 1024; // 12GB
    if (name.includes('rtx 4060 ti')) return 16 * 1024 * 1024 * 1024; // 16GB or 8GB
    if (name.includes('rtx 4060')) return 8 * 1024 * 1024 * 1024; // 8GB
    
    // NVIDIA RTX 30 series
    if (name.includes('rtx 3090')) return 24 * 1024 * 1024 * 1024; // 24GB
    if (name.includes('rtx 3080')) return 10 * 1024 * 1024 * 1024; // 10GB
    if (name.includes('rtx 3070')) return 8 * 1024 * 1024 * 1024; // 8GB
    if (name.includes('rtx 3060')) return 12 * 1024 * 1024 * 1024; // 12GB
    
    // AMD RX 7000 series
    if (name.includes('rx 7900')) return 20 * 1024 * 1024 * 1024; // 20GB
    if (name.includes('rx 7800')) return 16 * 1024 * 1024 * 1024; // 16GB
    if (name.includes('rx 7700')) return 12 * 1024 * 1024 * 1024; // 12GB
    if (name.includes('rx 7600')) return 8 * 1024 * 1024 * 1024; // 8GB
    
    // AMD RX 6000 series
    if (name.includes('rx 6950')) return 16 * 1024 * 1024 * 1024; // 16GB
    if (name.includes('rx 6900')) return 16 * 1024 * 1024 * 1024; // 16GB
    if (name.includes('rx 6800')) return 16 * 1024 * 1024 * 1024; // 16GB
    if (name.includes('rx 6700')) return 12 * 1024 * 1024 * 1024; // 12GB
    if (name.includes('rx 6600')) return 8 * 1024 * 1024 * 1024; // 8GB
    
    return 0; // Unknown GPU
  };

  // Helper function to estimate GPU name from VRAM amount and vendor
  const estimateGPUNameFromVRAM = (vramGB: number, isNvidia: boolean, isAMD: boolean): string => {
    const vram = Math.round(vramGB);
    
    if (isNvidia) {
      // NVIDIA GPUs based on VRAM
      if (vram === 24) return 'NVIDIA GeForce RTX 4090'; // Most likely for 24GB
      if (vram === 16) return 'NVIDIA GeForce RTX 4080';
      if (vram === 12) return 'NVIDIA GeForce RTX 4070 Ti';
      if (vram === 10) return 'NVIDIA GeForce RTX 3080';
      if (vram === 8) return 'NVIDIA GeForce RTX 4060';
      if (vram === 6) return 'NVIDIA GeForce GTX 1060';
      if (vram === 4) return 'NVIDIA GeForce GTX 1050 Ti';
    } else if (isAMD) {
      // AMD GPUs based on VRAM
      if (vram === 20) return 'AMD Radeon RX 7900 XTX';
      if (vram === 16) return 'AMD Radeon RX 6800 XT';
      if (vram === 12) return 'AMD Radeon RX 6700 XT';
      if (vram === 8) return 'AMD Radeon RX 7600';
      if (vram === 6) return 'AMD Radeon RX 5600 XT';
      if (vram === 4) return 'AMD Radeon RX 5500 XT';
    } else {
      // Unknown vendor but try to guess from VRAM
      if (vram === 24) return 'High-End GPU (24GB)'; // Likely RTX 4090 or RTX 3090
      if (vram === 16) return 'High-End GPU (16GB)';
      if (vram === 12) return 'Mid-High-End GPU (12GB)';
      if (vram === 10) return 'Mid-High-End GPU (10GB)';
      if (vram === 8) return 'Mid-Range GPU (8GB)';
      if (vram === 6) return 'Mid-Range GPU (6GB)';
      if (vram === 4) return 'Entry-Level GPU (4GB)';
    }
    
    return `GPU with ${vram}GB VRAM`;
  };

  // Enhanced model analysis with file size fetching
  const analyzeModel = async (model: HuggingFaceModel): Promise<EnhancedModel> => {
    // Filter and prioritize GGUF files, exclude non-model files and split files
    const filteredFiles = model.files.filter(file => {
      const filename = file.rfilename.toLowerCase();
      
      // Exclude documentation and non-model files
      if (filename.includes('readme') || filename.includes('.md') || filename.includes('.txt') || 
          filename.includes('license') || filename.includes('.json') || filename.includes('.py') ||
          filename.includes('config') || filename.includes('.git')) {
        return false;
      }
      
      // Exclude split files (not supported) - files with pattern like "001-of-003"
      if (filename.match(/\d+-of-\d+\.gguf$/)) {
        console.log(`Filtering out split file: ${file.rfilename}`);
        return false;
      }
      
      // Only include GGUF files
      return filename.includes('.gguf') || filename.includes('.bin') || filename.includes('.safetensors');
    });
    
    console.log(`Model ${model.name}: Original files: ${model.files.length}, Filtered GGUF files: ${filteredFiles.length}`);
    
    if (filteredFiles.length === 0) {
      console.warn(`No compatible GGUF files found for ${model.name}`);
      // Return minimal model info if no compatible files
      return {
        ...model,
        files: [],
        compatibility: {
          fitsInRAM: 'no' as const,
          fitsInVRAM: 'no' as const,
          parameterCount: 'Unknown',
          estimatedRAMUsage: 0,
          quantization: 'Unsupported',
          architecture: 'Unknown',
          fitAnalysis: null
        },
        metadata: {}
      } as any;
    }
    
    // Fetch actual file sizes if they're missing (0 B)
    const filesWithSizes = await Promise.all(filteredFiles.map(async (file) => {
      if (!file.size || file.size === 0) {
        try {
          // Try to fetch file metadata from Hugging Face API
          const response = await fetch(`https://huggingface.co/${model.id}/resolve/main/${file.rfilename}`, {
            method: 'HEAD'
          });
          
          if (response.ok) {
            const contentLength = response.headers.get('content-length');
            if (contentLength) {
              const size = parseInt(contentLength, 10);
              console.log(`Fetched size for ${file.rfilename}: ${size} bytes`);
              return { ...file, size };
            }
          }
        } catch (error) {
          console.warn(`Failed to fetch size for ${file.rfilename}:`, error);
        }
        
        // Fallback: estimate size based on model parameters and quantization
        const nameParamMatch = model.name.match(/(\d+\.?\d*)[bB]/i);
        const paramCount = nameParamMatch ? parseFloat(nameParamMatch[1]) : 0;
        
        if (paramCount > 0) {
          // Estimate total model size based on parameters and quantization
          let bytesPerParam = 0.5; // Default for Q4
          if (file.rfilename.toLowerCase().includes('q4_k_s')) bytesPerParam = 0.45;
          else if (file.rfilename.toLowerCase().includes('q4_k_m')) bytesPerParam = 0.5;
          else if (file.rfilename.toLowerCase().includes('q5_k_s')) bytesPerParam = 0.65;
          else if (file.rfilename.toLowerCase().includes('q5_k_m')) bytesPerParam = 0.7;
          else if (file.rfilename.toLowerCase().includes('q6_k')) bytesPerParam = 0.8;
          else if (file.rfilename.toLowerCase().includes('q8_0')) bytesPerParam = 1.0;
          else if (file.rfilename.toLowerCase().includes('fp16')) bytesPerParam = 2.0;
          else if (file.rfilename.toLowerCase().includes('fp32')) bytesPerParam = 4.0;
          
          const estimatedSize = paramCount * 1000000000 * bytesPerParam;
          console.log(`Estimated size for ${file.rfilename}: ${estimatedSize} bytes`);
          return { ...file, size: Math.round(estimatedSize) };
        }
      }
      return file;
    }));
    
    console.log('Files with sizes:', filesWithSizes.map(f => ({ name: f.rfilename, size: f.size })));
    
    // Group files by quantization type for smart selection
    const quantGroups = new Map<string, typeof filesWithSizes>();
    filesWithSizes.forEach(file => {
      const filename = file.rfilename.toLowerCase();
      let quantType = 'unknown';
      
      if (filename.includes('q4_k_s')) quantType = 'q4_k_s';
      else if (filename.includes('q4_k_m')) quantType = 'q4_k_m';
      else if (filename.includes('q4_0')) quantType = 'q4_0';
      else if (filename.includes('q4_1')) quantType = 'q4_1';
      else if (filename.includes('q4')) quantType = 'q4';
      else if (filename.includes('q5_k_s')) quantType = 'q5_k_s';
      else if (filename.includes('q5_k_m')) quantType = 'q5_k_m';
      else if (filename.includes('q5_0')) quantType = 'q5_0';
      else if (filename.includes('q5_1')) quantType = 'q5_1';
      else if (filename.includes('q5')) quantType = 'q5';
      else if (filename.includes('q6_k')) quantType = 'q6_k';
      else if (filename.includes('q8_0')) quantType = 'q8_0';
      else if (filename.includes('q8')) quantType = 'q8';
      else if (filename.includes('fp16')) quantType = 'fp16';
      else if (filename.includes('fp32')) quantType = 'fp32';
      
      if (!quantGroups.has(quantType)) quantGroups.set(quantType, []);
      quantGroups.get(quantType)!.push(file);
    });
    
    // Find the best quantization that fits the system
    const cachedSystemInfo = (window as any).__systemInfo; // Get cached system info
    let bestQuantGroup: typeof filesWithSizes = [];
    
    if (cachedSystemInfo?.gpu?.vram && cachedSystemInfo.availableRAM) {
      const gpuVRAM = cachedSystemInfo.gpu.vram;
      const availableRAM = cachedSystemInfo.availableRAM;
      const totalMemory = gpuVRAM + (availableRAM * 0.6); // Hybrid approach
      
      // Priority order: try to fit in GPU first, then hybrid, then smallest available
      const quantPriority = ['q4_k_s', 'q4_k_m', 'q4_0', 'q4_1', 'q4', 'q5_k_s', 'q5_k_m', 'q5_0', 'q5_1', 'q5', 'q6_k', 'q8_0', 'q8'];
      
      for (const quantType of quantPriority) {
        const group = quantGroups.get(quantType);
        if (group && group.length > 0) {
          const groupSize = group.reduce((acc, file) => acc + (file.size || 0), 0);
          
          // Check if it fits in available memory
          if (groupSize <= totalMemory) {
            bestQuantGroup = group;
            console.log(`Selected best quantization: ${quantType} (${groupSize} bytes fits in ${totalMemory} bytes)`);
            break;
          }
        }
      }
      
      // If nothing fits, use the smallest available
      if (bestQuantGroup.length === 0) {
        for (const quantType of quantPriority) {
          const group = quantGroups.get(quantType);
          if (group && group.length > 0) {
            bestQuantGroup = group;
            console.log(`Using smallest available quantization: ${quantType}`);
            break;
          }
        }
      }
    }
    
    // Fallback to first available if no system info
    if (bestQuantGroup.length === 0 && quantGroups.size > 0) {
      const firstEntry = Array.from(quantGroups.entries())[0];
      bestQuantGroup = firstEntry[1];
    }
    
    // Sort selected group by file size (smaller first)
    bestQuantGroup.sort((a, b) => (a.size || 0) - (b.size || 0));
    
    // Use the best quantization group for analysis
    const analysisFiles = bestQuantGroup.length > 0 ? bestQuantGroup : filesWithSizes;
    
    // Extract parameter count from name or description
    const nameParamMatch = model.name.match(/(\d+\.?\d*)[bB]/i);
    const descParamMatch = model.description?.match(/(\d+\.?\d*)[bB]/i);
    const paramCount = nameParamMatch ? parseFloat(nameParamMatch[1]) : 
                     descParamMatch ? parseFloat(descParamMatch[1]) : 0;
    
    // Detect quantization from filename - be more specific and accurate
    const primaryFile = analysisFiles[0];
    let quantization = 'Unknown';
    if (primaryFile?.rfilename) {
      const filename = primaryFile.rfilename.toLowerCase();
      
      // Look for specific quantization patterns with improved regex
      const q4k_mMatch = filename.match(/q4[_-]?k[_-]?m\b/i);
      const q4k_sMatch = filename.match(/q4[_-]?k[_-]?s\b/i);
      const q4_0Match = filename.match(/q4[_-]?0\b/i);
      const q4_1Match = filename.match(/q4[_-]?1\b/i);
      const q5k_mMatch = filename.match(/q5[_-]?k[_-]?m\b/i);
      const q5k_sMatch = filename.match(/q5[_-]?k[_-]?s\b/i);
      const q5_0Match = filename.match(/q5[_-]?0\b/i);
      const q5_1Match = filename.match(/q5[_-]?1\b/i);
      const q6kMatch = filename.match(/q6[_-]?k\b/i);
      const q8_0Match = filename.match(/q8[_-]?0\b/i);
      const fp16Match = filename.match(/fp16|f16\b/i);
      const fp32Match = filename.match(/fp32|f32\b/i);
      
      // Map to specific quantization types
      if (q4k_mMatch) quantization = 'Q4_K_M';
      else if (q4k_sMatch) quantization = 'Q4_K_S';
      else if (q4_1Match) quantization = 'Q4_1';
      else if (q4_0Match) quantization = 'Q4_0';
      else if (filename.includes('q4')) quantization = 'Q4';
      else if (q5k_mMatch) quantization = 'Q5_K_M';
      else if (q5k_sMatch) quantization = 'Q5_K_S';
      else if (q5_1Match) quantization = 'Q5_1';
      else if (q5_0Match) quantization = 'Q5_0';
      else if (filename.includes('q5')) quantization = 'Q5';
      else if (q6kMatch) quantization = 'Q6_K';
      else if (q8_0Match) quantization = 'Q8_0';
      else if (filename.includes('q8')) quantization = 'Q8';
      else if (fp16Match) quantization = 'FP16';
      else if (fp32Match) quantization = 'FP32';
      else {
        // Advanced inference from file size and parameter count
        const fileSize = primaryFile.size || 0;
        if (paramCount > 0 && fileSize > 0) {
          const bytesPerParam = fileSize / (paramCount * 1000000000);
          if (bytesPerParam < 0.6) quantization = 'Q4_K_M';
          else if (bytesPerParam < 0.8) quantization = 'Q5_K_M';
          else if (bytesPerParam < 1.2) quantization = 'Q6_K';
          else if (bytesPerParam < 1.8) quantization = 'Q8_0';
          else if (bytesPerParam < 2.5) quantization = 'FP16';
          else quantization = 'FP32';
        }
      }
    }
    
    // Calculate model size from filtered GGUF files only (exclude READMEs, etc.)
    const modelSize = analysisFiles.reduce((acc, file) => acc + (file.size || 0), 0);
    
    // Enhanced RAM usage calculation based on quantization type
    let ramMultiplier = 1.4; // Default 40% overhead
    
    // Adjust multiplier based on quantization precision
    switch (quantization) {
      case 'Q4_K_M':
      case 'Q4_K_S':
      case 'Q4_0':
      case 'Q4_1':
      case 'Q4':
        ramMultiplier = 1.3; // Q4 is more memory efficient
        break;
      case 'Q5_K_M':
      case 'Q5_K_S':
      case 'Q5_0':
      case 'Q5_1':
      case 'Q5':
        ramMultiplier = 1.35;
        break;
      case 'Q6_K':
        ramMultiplier = 1.4;
        break;
      case 'Q8_0':
      case 'Q8':
        ramMultiplier = 1.45;
        break;
      case 'FP16':
        ramMultiplier = 1.5;
        break;
      case 'FP32':
        ramMultiplier = 1.6; // FP32 needs more overhead
        break;
    }
    
    const estimatedRAMUsage = modelSize * ramMultiplier;
    
    // Determine architecture from name/tags/description
    let architecture = 'Unknown';
    const nameAndDesc = (model.name + ' ' + (model.description || '')).toLowerCase();
    
    if (nameAndDesc.includes('llama')) architecture = 'Llama';
    else if (nameAndDesc.includes('qwen')) architecture = 'Qwen';
    else if (nameAndDesc.includes('phi')) architecture = 'Phi';
    else if (nameAndDesc.includes('mistral')) architecture = 'Mistral';
    else if (nameAndDesc.includes('gemma')) architecture = 'Gemma';
    else if (nameAndDesc.includes('yi ')) architecture = 'Yi';
    else if (nameAndDesc.includes('baichuan')) architecture = 'Baichuan';
    else if (nameAndDesc.includes('chatglm')) architecture = 'ChatGLM';
    else if (nameAndDesc.includes('internlm')) architecture = 'InternLM';
    else if (nameAndDesc.includes('codellama')) architecture = 'CodeLlama';
    else if (nameAndDesc.includes('deepseek')) architecture = 'DeepSeek';
    
    // Enhanced compatibility assessment with smart RAM+GPU logic
    // Use cached system info if state systemInfo is not yet available (during initial load)
    const effectiveSystemInfo = systemInfo || (window as any).__systemInfo;
    
    const compatibility = {
      fitsInRAM: effectiveSystemInfo ? (() => {
        if (estimatedRAMUsage <= effectiveSystemInfo.availableRAM * 0.8) return 'yes';
        if (estimatedRAMUsage <= effectiveSystemInfo.totalRAM * 0.9) return 'maybe';
        return 'no';
      })() : 'maybe' as 'yes' | 'maybe' | 'no',
      
      fitsInVRAM: effectiveSystemInfo?.gpu && effectiveSystemInfo.gpu.vram > 0 ? (() => {
        // Check if model fits fully in GPU VRAM
        if (modelSize <= effectiveSystemInfo.gpu.vram * 0.8) return 'yes';
        if (modelSize <= effectiveSystemInfo.gpu.vram) return 'maybe';
        
        // Check if model can fit using RAM+GPU hybrid approach
        if (effectiveSystemInfo.availableRAM > 0) {
          const totalMemory = effectiveSystemInfo.gpu.vram + (effectiveSystemInfo.availableRAM * 0.6); // Use 60% of available RAM
          if (modelSize <= totalMemory) return 'maybe'; // Can use hybrid approach
        }
        
        return 'no';
      })() : 'na' as 'yes' | 'maybe' | 'no' | 'na',
      
      parameterCount: paramCount >= 1 ? `${paramCount}B` : 
                     paramCount > 0 ? `${(paramCount * 1000).toFixed(0)}M` : 'Unknown',
      estimatedRAMUsage,
      quantization,
      architecture,
      
      // Add detailed fit analysis for UI display
      fitAnalysis: effectiveSystemInfo ? {
        fitsFullyInGPU: effectiveSystemInfo.gpu?.vram ? modelSize <= effectiveSystemInfo.gpu.vram * 0.8 : false,
        fitsInRAMPlusGPU: effectiveSystemInfo.gpu?.vram && effectiveSystemInfo.availableRAM ? 
          modelSize <= (effectiveSystemInfo.gpu.vram + effectiveSystemInfo.availableRAM * 0.6) : false,
        recommendedMemoryGB: Math.ceil(estimatedRAMUsage / (1024 * 1024 * 1024)),
        modelSizeGB: Math.ceil(modelSize / (1024 * 1024 * 1024))
      } : null
    } as any;

    // Enhanced metadata detection
    const metadata = {
      isVisionModel: model.tags?.some(tag => 
        ['vision', 'multimodal', 'vl', 'llava', 'clip'].includes(tag.toLowerCase())
      ) || nameAndDesc.includes('vision') || nameAndDesc.includes('multimodal'),
      
      needsMmproj: (model.tags?.some(tag => tag.toLowerCase() === 'vision') || 
                   nameAndDesc.includes('llava')) && 
                   !model.files.some(f => f.rfilename.toLowerCase().includes('mmproj')),
                   
      contextLength: (() => {
        const contextMatch = nameAndDesc.match(/(\d+)k\s*context|context\s*(\d+)k/i);
        return contextMatch ? parseInt(contextMatch[1] || contextMatch[2]) * 1000 : undefined;
      })()
    };

    return {
      ...model,
      files: analysisFiles, // Use best-fit quantization files
      compatibility,
      metadata: {
        ...metadata,
        availableQuantizations: Array.from(quantGroups.entries()).map(([type, files]) => ({
          type,
          files,
          totalSize: files.reduce((acc, file) => acc + (file.size || 0), 0),
          displayName: type.toUpperCase().replace(/_/g, '_')
        })).sort((a, b) => a.totalSize - b.totalSize)
      }
    };
  };

  // Load and analyze models
  const loadModels = async (filter: typeof activeFilter, query: string = '') => {
    if (!window.modelManager?.searchHuggingFaceModels) return;
    
    setIsLoading(true);
    setApiError(null);
    setIsRateLimited(false);
    
    try {
      let sortParam = 'lastModified';
      let searchQueries: string[] = [];
      
      switch (filter) {
        case 'recommended':
          // Focus on smaller, efficient models for recommendations
          searchQueries = ['7b q4', '3b q4', '1.5b q4', 'instruct q4'];
          sortParam = 'downloads';
          break;
        case 'latest':
          searchQueries = [query || ''];
          sortParam = 'lastModified';
          break;
        case 'popular':
          searchQueries = [query || ''];
          sortParam = 'downloads';
          break;
        case 'trending':
          searchQueries = [query || ''];
          sortParam = 'trending';
          break;
      }

      const allModels: HuggingFaceModel[] = [];
      let hasRateLimitError = false;
      
      for (const searchQuery of searchQueries) {
        const result = await window.modelManager.searchHuggingFaceModels(
          searchQuery, 
          filter === 'recommended' ? 15 : 20, 
          sortParam
        );
        
        if (result.success) {
          allModels.push(...result.models);
        } else if (result.error) {
          // Check for rate limiting (HTTP 429) or API errors
          if (result.error.includes('429') || result.error.toLowerCase().includes('rate limit')) {
            hasRateLimitError = true;
            console.log('Rate limit detected:', result.error);
          } else {
            console.error('API error:', result.error);
            setApiError(result.error);
          }
        }
      }

      // If we hit rate limits, set appropriate state
      if (hasRateLimitError && allModels.length === 0) {
        setIsRateLimited(true);
        setModels([]);
        return;
      }

      // Remove duplicates
      const uniqueModels = allModels.filter((model, index, self) => 
        index === self.findIndex(m => m.id === model.id)
      );

      // Analyze each model
      const enhancedModels = await Promise.all(
        uniqueModels.map(model => analyzeModel(model))
      );

      // Sort by compatibility for recommended tab
      if (filter === 'recommended') {
        enhancedModels.sort((a, b) => {
          const aScore = (a.compatibility.fitsInRAM === 'yes' ? 3 : a.compatibility.fitsInRAM === 'maybe' ? 2 : 1) +
                        (a.downloads / 1000);
          const bScore = (b.compatibility.fitsInRAM === 'yes' ? 3 : b.compatibility.fitsInRAM === 'maybe' ? 2 : 1) +
                        (b.downloads / 1000);
          return bScore - aScore;
        });
      }

      setModels(enhancedModels.slice(0, 12)); // Show top 12 results
    } catch (error) {
      console.error('Error loading models:', error);
      
      // Check if the error message contains rate limit indicators
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('429') || errorMessage.toLowerCase().includes('rate limit')) {
        setIsRateLimited(true);
      } else {
        setApiError(errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Load models when filter or search changes, but wait for system info on initial load
  useEffect(() => {
    // For initial load (recommended filter), wait for system info to be available
    if (activeFilter === 'recommended' && !systemInfo && !(window as any).__systemInfo) {
      console.log('Waiting for system info before loading models...');
      return;
    }
    
    loadModels(activeFilter, searchQuery);
  }, [activeFilter, systemInfo]);

  // Trigger initial model load when system info becomes available
  useEffect(() => {
    if (systemInfo && models.length === 0 && !isLoading) {
      console.log('System info available, loading initial models...');
      loadModels(activeFilter, searchQuery);
    }
  }, [systemInfo]);

  const handleSearch = () => {
    loadModels(activeFilter, searchQuery);
  };

  const formatBytes = (bytes: number): string => {
    const sizes = ['B', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6">
      {/* System Info Header */}
      {systemInfo && (
        <div className="glassmorphic rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-blue-500" />
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  RAM: {formatBytes(systemInfo.totalRAM)} ({formatBytes(systemInfo.availableRAM)} available)
                </span>
              </div>
              {systemInfo.gpu && (
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-green-500" />
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {systemInfo.gpu.name} ({systemInfo.gpu.vram > 0 ? formatBytes(systemInfo.gpu.vram) : 'VRAM Unknown'})
                  </span>
                </div>
              )}
              {!systemInfo.gpu && (
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-500 dark:text-gray-500">
                    No dedicated GPU detected
                  </span>
                </div>
              )}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Compatibility based on your system
            </div>
          </div>
        </div>
      )}

      {/* Search and Filters */}
      <div className="glassmorphic rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <Search className="w-5 h-5 text-sakura-500" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Model Discovery Hub
          </h3>
        </div>

        {/* Search Bar */}
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Search models, authors, capabilities..."
            className="flex-1 px-4 py-3 rounded-lg bg-white/50 border border-gray-200 focus:outline-none focus:border-sakura-300 dark:bg-gray-800/50 dark:border-gray-700 dark:text-gray-100"
          />
          <button
            onClick={handleSearch}
            disabled={isLoading}
            className="px-6 py-3 bg-sakura-500 text-white rounded-lg hover:bg-sakura-600 disabled:opacity-50 transition-colors flex items-center gap-2"
          >
            <Search className="w-4 h-4" />
            {isLoading ? 'Searching...' : 'Search'}
          </button>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2">
          {[
            { id: 'recommended', label: 'Recommended', icon: CheckCircle },
            { id: 'latest', label: 'Latest', icon: Clock },
            { id: 'popular', label: 'Popular', icon: Star },
            { id: 'trending', label: 'Trending', icon: TrendingUp }
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveFilter(id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                activeFilter === id
                  ? 'bg-sakura-500 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="text-sm font-medium">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Models Grid */}
      <div className="grid gap-4">
        {isLoading ? (
          <div className="glassmorphic rounded-xl p-12 text-center">
            <div className="w-8 h-8 border-2 border-sakura-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">Loading models...</p>
          </div>
        ) : isRateLimited ? (
          <div className="glassmorphic rounded-xl p-8 text-center border-l-4 border-amber-500">
            <div className="flex items-center justify-center mb-4">
              <Clock className="w-8 h-8 text-amber-600 dark:text-amber-400" />
            </div>
            <h4 className="text-lg font-semibold text-amber-800 dark:text-amber-200 mb-3">
              Taking a Brief Pause
            </h4>
            <p className="text-amber-700 dark:text-amber-300 mb-4 max-w-md mx-auto">
              We've made quite a few requests to Hugging Face's servers and they've asked us to slow down a bit. 
              This isn't an error on your part - it's a normal part of how the API works to ensure fair access for everyone.
            </p>
            <p className="text-amber-600 dark:text-amber-400 text-sm mb-6">
              Please wait a moment and try again. The models will be available shortly!
              <br />
              <small>Dev Note: We don't have any server and we never wanted to check the models you use so yeah thats the reason. You are safe that your data is not being logged or monitored in any way.</small>
            </p>
            <button
              onClick={() => {
                setIsRateLimited(false);
                loadModels(activeFilter, searchQuery);
              }}
              className="bg-amber-600 hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-600 text-white px-6 py-2 rounded-lg transition-colors inline-flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Try Again
            </button>
          </div>
        ) : apiError ? (
          <div className="glassmorphic rounded-xl p-8 text-center border-l-4 border-red-500">
            <div className="flex items-center justify-center mb-4">
              <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
            </div>
            <h4 className="text-lg font-semibold text-red-800 dark:text-red-200 mb-3">
              Connection Issue
            </h4>
            <p className="text-red-700 dark:text-red-300 mb-4 max-w-md mx-auto">
              We're having trouble connecting to the model repository. This could be a temporary network issue.
            </p>
            <p className="text-red-600 dark:text-red-400 text-sm mb-6 font-mono bg-red-100 dark:bg-red-900/30 p-2 rounded">
              {apiError}
            </p>
            <button
              onClick={() => {
                setApiError(null);
                loadModels(activeFilter, searchQuery);
              }}
              className="bg-red-600 hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600 text-white px-6 py-2 rounded-lg transition-colors inline-flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Retry
            </button>
          </div>
        ) : models.length > 0 ? (
          models.map((model) => (
            <EnhancedModelCard
              key={model.id}
              model={model}
              onDownload={onDownload}
              onDownloadWithDependencies={onDownloadWithDependencies}
              downloading={downloading}
              downloadProgress={downloadProgress}
              systemInfo={systemInfo}
            />
          ))
        ) : (
          <div className="glassmorphic rounded-xl p-12 text-center">
            <Search className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No models found matching your criteria
            </h4>
            <p className="text-gray-600 dark:text-gray-400">
              Try adjusting your search terms or filters
            </p>
          </div>
        )}
      </div>

      {/* API Status Footer */}
      <div className="glassmorphic rounded-xl p-4">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-500" />
            <span className="text-gray-600 dark:text-gray-400">
              Powered by Hugging Face Public API
            </span>
          </div>
          <div className="text-gray-500 dark:text-gray-400">
            {models.length} models analyzed
          </div>
        </div>
      </div>
    </div>
  );
};

export default EnhancedModelDiscovery;
