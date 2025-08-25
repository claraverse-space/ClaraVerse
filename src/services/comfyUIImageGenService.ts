import { Client, BasePipe, EfficientPipe } from '@stable-canvas/comfyui-client';

export interface ComfyUIGenerationConfig {
  prompt: string;
  model: string;
  steps: number;
  guidanceScale: number;
  denoise: number;
  sampler: string;
  scheduler: string;
  width: number;
  height: number;
  negativePrompt: string;
  seed: number;
}

export interface ComfyUIGenerationResult {
  imageBase64: string;
  metadata: any;
  prompt: string;
  seed: number;
  duration: number;
}

export interface ComfyUIConnectionResult {
  success: boolean;
  error?: string;
  url?: string;
}

class ComfyUIImageGenService {
  private client: Client | null = null;
  private isConnected = false;
  private currentUrl = 'http://localhost:8188';
  private availableModels: string[] = [];

  async connectToComfyUI(): Promise<ComfyUIConnectionResult> {
    try {
      console.log('🔌 Attempting to connect to ComfyUI...');
      
      // Get the current ComfyUI URL from service configuration
      const comfyuiUrl = await this.getComfyUIUrl();
      this.currentUrl = comfyuiUrl;
      
      console.log('🔗 ComfyUI URL:', comfyuiUrl);
      
      // Process URL like ImageGen.tsx does
      let processedUrl = comfyuiUrl;
      let isHttps = false;
      
      if (comfyuiUrl.includes('http://') || comfyuiUrl.includes('https://')) {
        isHttps = comfyuiUrl.includes('https://');
        processedUrl = comfyuiUrl.replace(/^https?:\/\//, '');
      }
      
      console.log('📡 Processed URL:', processedUrl, 'SSL:', isHttps);
      
      // Initialize the ComfyUI client using the same method as ImageGen.tsx
      this.client = new Client({ 
        api_host: processedUrl, 
        ssl: isHttps,
        clientId: `clara-verse-${Date.now()}`
      });
      
      // Connect the client first
      await this.client.connect();
      
      // Wait for the client's WebSocket connection to open
      await this.waitForClientConnection(this.client);
      
      // Test connection by trying to get system stats
      await this.client.getSystemStats();
      
      this.isConnected = true;
      console.log('✅ Connected to ComfyUI successfully');
      
      return {
        success: true,
        url: comfyuiUrl
      };
    } catch (error) {
      console.error('❌ Failed to connect to ComfyUI:', error);
      this.isConnected = false;
      this.client = null;
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Connection failed'
      };
    }
  }

  // Wait for the client's WebSocket connection to open before proceeding - with timeout
  private async waitForClientConnection(client: Client): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("WebSocket connection timeout - failed to connect after 15 seconds"));
      }, 15000);
      
      if (client.socket && client.socket.readyState === WebSocket.OPEN) {
        clearTimeout(timeout);
        resolve();
      } else {
        const checkInterval = setInterval(() => {
          if (client.socket && client.socket.readyState === WebSocket.OPEN) {
            clearInterval(checkInterval);
            clearTimeout(timeout);
            resolve();
          }
        }, 100);
      }
    });
  }

  private async getComfyUIUrl(): Promise<string> {
    try {
      // Check if electronAPI is available
      if ((window as any).electronAPI) {
        console.log('📡 Getting ComfyUI configuration from electron API...');
        
        const configs = await (window as any).electronAPI.invoke('service-config:get-all-configs');
        const status = await (window as any).electronAPI.invoke('service-config:get-enhanced-status');
        
        const comfyuiConfig = configs?.comfyui || { mode: 'docker', url: null };
        const comfyuiStatus = status?.comfyui || {};

        let finalUrl = 'http://localhost:8188'; // Default fallback

        if (comfyuiConfig.mode === 'manual' && comfyuiConfig.url) {
          // Use manual configuration URL
          finalUrl = comfyuiConfig.url;
        } else if (comfyuiStatus.serviceUrl) {
          // Use auto-detected URL from service status
          finalUrl = comfyuiStatus.serviceUrl;
        }
        
        console.log('🎨 ComfyUI Service Config:', {
          configMode: comfyuiConfig.mode,
          configUrl: comfyuiConfig.url,
          statusUrl: comfyuiStatus.serviceUrl,
          finalUrl
        });
        
        return finalUrl;
      }
    } catch (error) {
      console.warn('Failed to get ComfyUI URL from service config:', error);
    }
    
    // Fallback to default
    return 'http://localhost:8188';
  }

  async getAvailableModels(): Promise<string[]> {
    if (!this.isConnected || !this.client) {
      throw new Error('Not connected to ComfyUI');
    }

    try {
      console.log('🎨 Loading available models...');
      
      // Get models directly from ComfyUI client like ImageGen.tsx does
      const sdModelsResp = await this.client.getSDModels();
      this.availableModels = sdModelsResp || [];
      
      console.log('📦 Loaded models from ComfyUI client:', this.availableModels.length);
      console.log('📦 Models:', this.availableModels);
      
      return this.availableModels;
    } catch (error) {
      console.error('❌ Failed to load models from ComfyUI client:', error);
      
      // Fallback: try to get models from electron API if available
      try {
        if ((window as any).electronAPI) {
          const localModels = await (window as any).electronAPI.invoke('models:comfyuiGetLocalModels');
          if (localModels?.checkpoints && localModels.checkpoints.length > 0) {
            this.availableModels = localModels.checkpoints.map((m: any) => m.name);
            console.log('📦 Loaded models from electron API fallback:', this.availableModels.length);
            return this.availableModels;
          }
        }
      } catch (electronError) {
        console.warn('Failed to get models from electron API fallback:', electronError);
      }
      
      // Fallback: try to get models from ComfyUI API directly
      try {
        const response = await fetch(`${this.currentUrl}/object_info`);
        if (response.ok) {
          const objectInfo = await response.json();
          const checkpointNode = objectInfo['CheckpointLoaderSimple'];
          
          if (checkpointNode && checkpointNode.input && checkpointNode.input.required && checkpointNode.input.required.ckpt_name) {
            this.availableModels = checkpointNode.input.required.ckpt_name[0] || [];
            console.log('📦 Loaded models from ComfyUI HTTP API:', this.availableModels.length);
            return this.availableModels;
          }
        }
      } catch (fetchError) {
        console.warn('Failed to fetch from ComfyUI HTTP API:', fetchError);
      }
      
      // Default models if nothing else works
      this.availableModels = [];
      console.log('📦 No models found, using empty list');
      return this.availableModels;
    }
  }

  getOptimalConfig(model: string): Partial<ComfyUIGenerationConfig> {
    // Provide optimal settings based on model type
    const modelLower = model.toLowerCase();
    
    if (modelLower.includes('xl') || modelLower.includes('sdxl')) {
      return {
        steps: 25,
        guidanceScale: 7.0,
        denoise: 1.0,
        sampler: 'dpmpp_2m_sde',
        scheduler: 'karras',
        negativePrompt: 'blurry, bad quality, distorted, deformed'
      };
    } else if (modelLower.includes('1.5') || modelLower.includes('sd15')) {
      return {
        steps: 20,
        guidanceScale: 7.5,
        denoise: 1.0,
        sampler: 'euler_ancestral',
        scheduler: 'normal',
        negativePrompt: 'blurry, bad quality, distorted, deformed, ugly'
      };
    } else if (modelLower.includes('flux')) {
      return {
        steps: 20,
        guidanceScale: 3.5,
        denoise: 1.0,
        sampler: 'euler',
        scheduler: 'simple',
        negativePrompt: ''
      };
    } else {
      // Default settings
      return {
        steps: 20,
        guidanceScale: 7.5,
        denoise: 1.0,
        sampler: 'euler',
        scheduler: 'normal',
        negativePrompt: 'blurry, bad quality, distorted'
      };
    }
  }

  async generateImage(
    config: ComfyUIGenerationConfig,
    onProgress?: (progress: number, message: string) => void
  ): Promise<ComfyUIGenerationResult> {
    if (!this.isConnected || !this.client) {
      throw new Error('Not connected to ComfyUI');
    }

    const startTime = Date.now();
    
    try {
      console.log('🎨 Starting image generation with config:', config);
      
      onProgress?.(10, 'Preparing generation pipeline...');
      
      // Check if client is still connected, reconnect if needed
      if (!this.client || this.client.socket?.readyState !== WebSocket.OPEN) {
        console.log('Client not connected, attempting to reconnect...');
        const reconnectResult = await this.connectToComfyUI();
        if (!reconnectResult.success) {
          throw new Error(`Reconnection failed: ${reconnectResult.error}`);
        }
      }
      
      onProgress?.(20, 'Building generation pipeline...');
      
      // Create generation pipeline
      const pipeline = this.createGenerationPipeline(config);
      
      onProgress?.(30, 'Submitting generation request...');
      
      // Execute the pipeline using the same method as ImageGen.tsx
      const pipelinePromise = pipeline.save().wait();
      
      // Add timeout like ImageGen.tsx does
      const result = await Promise.race([
        pipelinePromise,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Generation timed out")), 5 * 60 * 1000)
        )
      ]) as { images: any[] };
      
      onProgress?.(90, 'Processing generated image...');
      
      if (!result.images || result.images.length === 0) {
        throw new Error('No images generated');
      }
      
      // Convert first image to base64 using the same method as ImageGen.tsx
      const imageData = result.images[0];
      const base64Data = this.arrayBufferToBase64(imageData.data);
      const imageBase64 = `data:${imageData.mime || 'image/png'};base64,${base64Data}`;
      
      const duration = Date.now() - startTime;
      
      onProgress?.(100, 'Image generation completed!');
      
      console.log('✅ Image generation completed in', duration, 'ms');
      
      return {
        imageBase64,
        metadata: {
          model: config.model,
          steps: config.steps,
          guidanceScale: config.guidanceScale,
          sampler: config.sampler,
          scheduler: config.scheduler,
          width: config.width,
          height: config.height,
          seed: config.seed,
          duration
        },
        prompt: config.prompt,
        seed: config.seed,
        duration
      };
      
    } catch (error) {
      console.error('❌ Image generation failed:', error);
      throw error;
    }
  }

  private createGenerationPipeline(config: ComfyUIGenerationConfig): BasePipe | EfficientPipe {
    // Create a simple BasePipe for text-to-image generation, following ImageGen.tsx pattern
    const pipeline = new BasePipe()
      .with(this.client!)
      .model(config.model)
      .prompt(config.prompt)
      .negative(config.negativePrompt)
      .size(config.width, config.height)
      .steps(config.steps)
      .cfg(config.guidanceScale)
      .denoise(config.denoise)
      .sampler(config.sampler)
      .scheduler(config.scheduler);
    
    // Only set seed if it's not -1 (random)
    if (config.seed !== -1) {
      pipeline.seed(config.seed);
    } else {
      pipeline.seed(); // Generate random seed
    }

    return pipeline;
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  isComfyUIConnected(): boolean {
    return this.isConnected;
  }

  getCurrentUrl(): string {
    return this.currentUrl;
  }

  getLoadedModels(): string[] {
    return [...this.availableModels];
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      try {
        // Close any open connections
        this.client = null;
        this.isConnected = false;
        console.log('🔌 Disconnected from ComfyUI');
      } catch (error) {
        console.error('Error during ComfyUI disconnect:', error);
      }
    }
  }
}

// Export singleton instance
export const comfyUIImageGenService = new ComfyUIImageGenService();
export default comfyUIImageGenService;
