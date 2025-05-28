/**
 * Clara Text-to-Speech Service
 * 
 * This service handles text-to-speech functionality with health checking
 * for the backend service. It automatically hides TTS features when the
 * backend is not available.
 */

export interface TTSRequest {
  text: string;
  language?: string;
  engine?: 'gtts' | 'pyttsx3' | 'kokoro' | 'kokoro-onnx' | 'auto';
  slow?: boolean;
  voice?: string;
  speed?: number;
}

export interface TTSResponse {
  success: boolean;
  audioUrl?: string;
  error?: string;
}

export interface BackendHealth {
  status: string;
  port: number;
  uptime: string;
}

export class ClaraTTSService {
  private baseUrl: string;
  private isHealthy: boolean = false;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private healthCheckCallbacks: ((isHealthy: boolean) => void)[] = [];
  private audioCache: Map<string, string> = new Map();
  private abortController: AbortController | null = null;

  constructor(baseUrl: string = 'http://localhost:5001') {
    this.baseUrl = baseUrl;
    this.startHealthChecking();
  }

  /**
   * Start periodic health checking
   */
  private startHealthChecking(): void {
    // Initial health check
    this.checkHealth();
    
    // Set up periodic health checks every 10 seconds
    this.healthCheckInterval = setInterval(() => {
      this.checkHealth();
    }, 10000);
  }

  /**
   * Stop health checking
   */
  public stopHealthChecking(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  /**
   * Check backend health
   */
  private async checkHealth(): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000) // 5 second timeout
      });

      if (response.ok) {
        const health: BackendHealth = await response.json();
        const wasHealthy = this.isHealthy;
        this.isHealthy = health.status === 'healthy';
        
        // Notify callbacks if health status changed
        if (wasHealthy !== this.isHealthy) {
          console.log(`🏥 TTS Backend health changed: ${this.isHealthy ? 'healthy' : 'unhealthy'}`);
          this.notifyHealthCallbacks();
        }
      } else {
        this.setUnhealthy();
      }
    } catch (error) {
      this.setUnhealthy();
    }
  }

  /**
   * Set backend as unhealthy
   */
  private setUnhealthy(): void {
    const wasHealthy = this.isHealthy;
    this.isHealthy = false;
    
    if (wasHealthy) {
      console.log('🏥 TTS Backend is unhealthy');
      this.notifyHealthCallbacks();
    }
  }

  /**
   * Notify all health callbacks
   */
  private notifyHealthCallbacks(): void {
    this.healthCheckCallbacks.forEach(callback => {
      try {
        callback(this.isHealthy);
      } catch (error) {
        console.error('Error in health callback:', error);
      }
    });
  }

  /**
   * Subscribe to health status changes
   */
  public onHealthChange(callback: (isHealthy: boolean) => void): () => void {
    this.healthCheckCallbacks.push(callback);
    
    // Immediately call with current status
    callback(this.isHealthy);
    
    // Return unsubscribe function
    return () => {
      const index = this.healthCheckCallbacks.indexOf(callback);
      if (index > -1) {
        this.healthCheckCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Get current health status
   */
  public isBackendHealthy(): boolean {
    return this.isHealthy;
  }

  /**
   * Force a health check
   */
  public async forceHealthCheck(): Promise<boolean> {
    await this.checkHealth();
    return this.isHealthy;
  }

  /**
   * Generate cache key for TTS request
   */
  private getCacheKey(request: TTSRequest): string {
    return `${request.text}-${request.engine || 'auto'}-${request.voice || 'af_sarah'}-${request.speed || 1.0}-${request.language || 'en'}`;
  }

  /**
   * Synthesize text to speech
   */
  public async synthesizeText(request: TTSRequest): Promise<TTSResponse> {
    if (!this.isHealthy) {
      return {
        success: false,
        error: 'TTS backend is not available'
      };
    }

    try {
      // Check cache first
      const cacheKey = this.getCacheKey(request);
      if (this.audioCache.has(cacheKey)) {
        return {
          success: true,
          audioUrl: this.audioCache.get(cacheKey)!
        };
      }

      // Cancel any previous request
      if (this.abortController) {
        this.abortController.abort();
      }
      this.abortController = new AbortController();

      const response = await fetch(`${this.baseUrl}/synthesize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: request.text,
          language: request.language || 'en',
          engine: request.engine || 'kokoro',
          slow: request.slow || false,
          voice: request.voice || 'af_sarah',
          speed: request.speed || 1.0
        }),
        signal: this.abortController.signal
      });

      if (!response.ok) {
        throw new Error(`TTS request failed: ${response.statusText}`);
      }

      // Get audio data as blob
      const audioBlob = await response.blob();
      
      // Create object URL for the audio
      const audioUrl = URL.createObjectURL(audioBlob);
      
      // Cache the result (with size limit)
      if (this.audioCache.size > 50) {
        // Remove oldest entries
        const firstKey = this.audioCache.keys().next().value;
        if (firstKey) {
          const oldUrl = this.audioCache.get(firstKey);
          if (oldUrl) {
            URL.revokeObjectURL(oldUrl);
          }
          this.audioCache.delete(firstKey);
        }
      }
      this.audioCache.set(cacheKey, audioUrl);

      return {
        success: true,
        audioUrl
      };

    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return {
          success: false,
          error: 'TTS request was cancelled'
        };
      }

      console.error('TTS synthesis error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'TTS synthesis failed'
      };
    }
  }

  /**
   * Play audio from URL
   */
  public async playAudio(audioUrl: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const audio = new Audio(audioUrl);
      
      audio.onended = () => resolve();
      audio.onerror = () => reject(new Error('Audio playback failed'));
      
      audio.play().catch(reject);
    });
  }

  /**
   * Synthesize and play text
   */
  public async synthesizeAndPlay(request: TTSRequest): Promise<void> {
    const result = await this.synthesizeText(request);
    
    if (result.success && result.audioUrl) {
      await this.playAudio(result.audioUrl);
    } else {
      throw new Error(result.error || 'TTS synthesis failed');
    }
  }

  /**
   * Stop current TTS playback
   */
  public stopPlayback(): void {
    // Stop any ongoing synthesis
    if (this.abortController) {
      this.abortController.abort();
    }

    // Stop all audio elements
    const audioElements = document.querySelectorAll('audio');
    audioElements.forEach(audio => {
      audio.pause();
      audio.currentTime = 0;
    });
  }

  /**
   * Clear audio cache and revoke URLs
   */
  public clearCache(): void {
    this.audioCache.forEach(url => {
      URL.revokeObjectURL(url);
    });
    this.audioCache.clear();
  }

  /**
   * Cleanup resources
   */
  public destroy(): void {
    this.stopHealthChecking();
    this.stopPlayback();
    this.clearCache();
    this.healthCheckCallbacks = [];
  }
}

// Create singleton instance
export const claraTTSService = new ClaraTTSService();

// Cleanup on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    claraTTSService.destroy();
  });
} 