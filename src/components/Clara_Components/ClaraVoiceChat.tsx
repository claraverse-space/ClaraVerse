import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, MicOff, Volume2, VolumeX, Square, Play, VolumeIcon } from 'lucide-react';

// Import TTS service for health monitoring
import { claraTTSService } from '../../services/claraTTSService';

// VAD (Voice Activity Detection) using @ricky0123/vad-web
// This is a SOTA VAD model that runs entirely in the browser
interface VADOptions {
  onSpeechStart: () => void;
  onSpeechEnd: (audio: Float32Array) => void;
  onVADMisfire: () => void;
  positiveSpeechThreshold: number;
  negativeSpeechThreshold: number;
  redemptionFrames: number;
  frameSamples: number;
  preSpeechPadFrames: number;
  minSpeechFrames: number;
}

interface ClaraVoiceChatProps {
  isEnabled: boolean;
  onToggle: () => void;
  onSendAudio: (audioBlob: Blob) => Promise<void>;
  onReceiveAudio?: (audioUrl: string) => void;
  isProcessing: boolean; // Voice transcription processing
  isAIResponding?: boolean; // AI is generating a response
  isStreaming?: boolean;
  streamingText?: string;
  autoTTSText?: string; // Text to automatically speak when provided
  autoTTSTrigger?: {text: string, timestamp: number} | null; // Trigger with timestamp to ensure re-triggering
}

// Audio visualization component
const AudioVisualizer: React.FC<{ 
  isListening: boolean; 
  isSpeaking: boolean; 
  audioLevel: number;
  isProcessing: boolean;
  isAIResponding?: boolean;
}> = ({ isListening, isSpeaking, audioLevel, isProcessing, isAIResponding = false }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      const width = canvas.width;
      const height = canvas.height;
      
      ctx.clearRect(0, 0, width, height);
      
      // Center circle
      const centerX = width / 2;
      const centerY = height / 2;
      const baseRadius = 30;
      
      if (isProcessing) {
        // Processing animation - pulsing circle
        const time = Date.now() * 0.005;
        const pulseRadius = baseRadius + Math.sin(time) * 10;
        
        ctx.beginPath();
        ctx.arc(centerX, centerY, pulseRadius, 0, 2 * Math.PI);
        ctx.fillStyle = `rgba(59, 130, 246, ${0.3 + Math.sin(time) * 0.2})`;
        ctx.fill();
        
        // Outer ring
        ctx.beginPath();
        ctx.arc(centerX, centerY, pulseRadius + 15, 0, 2 * Math.PI);
        ctx.strokeStyle = `rgba(59, 130, 246, ${0.2 + Math.sin(time * 1.5) * 0.1})`;
        ctx.lineWidth = 2;
        ctx.stroke();
        
      } else if (isAIResponding) {
        // AI responding animation - rotating gradient circle with thinking dots
        const time = Date.now() * 0.003;
        
        // Main pulsing circle
        const pulseRadius = baseRadius + Math.sin(time * 2) * 8;
        ctx.beginPath();
        ctx.arc(centerX, centerY, pulseRadius, 0, 2 * Math.PI);
        ctx.fillStyle = `rgba(168, 85, 247, ${0.4 + Math.sin(time * 2) * 0.2})`;
        ctx.fill();
        
        // Rotating thinking dots around the circle
        const dots = 8;
        for (let i = 0; i < dots; i++) {
          const angle = (time + i * 0.5) % (2 * Math.PI);
          const dotRadius = pulseRadius + 20;
          const x = centerX + Math.cos(angle) * dotRadius;
          const y = centerY + Math.sin(angle) * dotRadius;
          const dotSize = 3 + Math.sin(time * 3 + i) * 2;
          
          ctx.beginPath();
          ctx.arc(x, y, dotSize, 0, 2 * Math.PI);
          ctx.fillStyle = `rgba(168, 85, 247, ${0.6 + Math.sin(time * 2 + i) * 0.3})`;
          ctx.fill();
        }
        
        // Inner thinking indicator
        ctx.beginPath();
        ctx.arc(centerX, centerY, baseRadius * 0.6, 0, 2 * Math.PI);
        ctx.fillStyle = `rgba(168, 85, 247, ${0.2 + Math.sin(time * 4) * 0.1})`;
        ctx.fill();
        
      } else if (isListening) {
        // Listening animation - audio level visualization
        const radius = baseRadius + audioLevel * 20;
        
        // Main circle
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
        ctx.fillStyle = `rgba(34, 197, 94, ${0.4 + audioLevel * 0.3})`;
        ctx.fill();
        
        // Audio bars around the circle
        const bars = 12;
        for (let i = 0; i < bars; i++) {
          const angle = (i / bars) * 2 * Math.PI;
          const barHeight = 5 + audioLevel * 15 + Math.random() * 5;
          const x1 = centerX + Math.cos(angle) * (radius + 10);
          const y1 = centerY + Math.sin(angle) * (radius + 10);
          const x2 = centerX + Math.cos(angle) * (radius + 10 + barHeight);
          const y2 = centerY + Math.sin(angle) * (radius + 10 + barHeight);
          
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.strokeStyle = `rgba(34, 197, 94, ${0.6 + audioLevel * 0.4})`;
          ctx.lineWidth = 3;
          ctx.stroke();
        }
        
      } else if (isSpeaking) {
        // Speaking animation - wave pattern
        const time = Date.now() * 0.01;
        const waves = 3;
        
        for (let w = 0; w < waves; w++) {
          ctx.beginPath();
          const waveRadius = baseRadius + w * 15;
          const opacity = 0.4 - w * 0.1;
          
          for (let i = 0; i <= 360; i += 5) {
            const angle = (i * Math.PI) / 180;
            const waveOffset = Math.sin(time + w * 2 + i * 0.02) * 8;
            const x = centerX + Math.cos(angle) * (waveRadius + waveOffset);
            const y = centerY + Math.sin(angle) * (waveRadius + waveOffset);
            
            if (i === 0) {
              ctx.moveTo(x, y);
            } else {
              ctx.lineTo(x, y);
            }
          }
          
          ctx.closePath();
          ctx.strokeStyle = `rgba(147, 51, 234, ${opacity})`;
          ctx.lineWidth = 2;
          ctx.stroke();
        }
        
      } else {
        // Idle state - simple circle
        ctx.beginPath();
        ctx.arc(centerX, centerY, baseRadius, 0, 2 * Math.PI);
        ctx.fillStyle = 'rgba(107, 114, 128, 0.3)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(107, 114, 128, 0.5)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      
      animationRef.current = requestAnimationFrame(draw);
    };
    
    draw();
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isListening, isSpeaking, audioLevel, isProcessing, isAIResponding]);

  return (
    <canvas
      ref={canvasRef}
      width={200}
      height={200}
      className="w-32 h-32"
    />
  );
};

// Main voice chat component
const ClaraVoiceChat: React.FC<ClaraVoiceChatProps> = ({
  isEnabled,
  onToggle,
  onSendAudio,
  onReceiveAudio,
  isProcessing,
  isAIResponding = false,
  isStreaming = false,
  streamingText = '',
  autoTTSText = '',
  autoTTSTrigger = null
}) => {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [vadReady, setVadReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isProcessingAudio, setIsProcessingAudio] = useState(false);
  
  // TTS health monitoring state
  const [isTTSHealthy, setIsTTSHealthy] = useState(false);
  
  // Auto TTS state
  const [autoTTSEnabled, setAutoTTSEnabled] = useState(false);
  const [isAutoTTSPlaying, setIsAutoTTSPlaying] = useState(false);
  
  // Audio refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const vadRef = useRef<any>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  
  // Add initialization tracking to prevent multiple instances
  const isInitializingRef = useRef<boolean>(false);
  const healthCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Add ref to track processed auto TTS triggers to prevent repetition
  const processedTriggerRef = useRef<{text: string, timestamp: number} | null>(null);
  
  // Refs to track current state for VAD callbacks (to prevent stale closure issues)
  const isProcessingAudioRef = useRef<boolean>(false);
  const isProcessingRef = useRef<boolean>(false);
  const isAIRespondingRef = useRef<boolean>(false);
  const isEnabledRef = useRef<boolean>(false);
  const isListeningRef = useRef<boolean>(false);
  const isManualRecordingRef = useRef<boolean>(false);
  const isAutoTTSPlayingRef = useRef<boolean>(false);
  
  // Manual recording state (fallback when VAD fails)
  const [isManualRecording, setIsManualRecording] = useState(false);
  const [manualRecorder, setManualRecorder] = useState<MediaRecorder | null>(null);
  const [manualAudioChunks, setManualAudioChunks] = useState<Blob[]>([]);
  
  // Permission state
  const [permissionStatus, setPermissionStatus] = useState<'unknown' | 'granted' | 'denied' | 'requesting'>('unknown');
  const [showPermissionRequest, setShowPermissionRequest] = useState(false);
  
  // Detect if we're running in Electron
  const isElectron = typeof window !== 'undefined' && window.process && window.process.type;
  
  // Audio level monitoring
  const monitorAudioLevel = useCallback(() => {
    if (!analyserRef.current || !isListening) return;
    
    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);
    
    // Calculate RMS (Root Mean Square) for audio level
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i] * dataArray[i];
    }
    const rms = Math.sqrt(sum / dataArray.length);
    const normalizedLevel = Math.min(rms / 128, 1);
    
    setAudioLevel(normalizedLevel);
    
    // Continue monitoring only if still listening and enabled
    if (isListening && isEnabledRef.current) {
      requestAnimationFrame(monitorAudioLevel);
    }
  }, [isListening]);

  // Setup audio context and analyser for level monitoring
  const setupAudioAnalyser = useCallback(async () => {
    try {
      // Reuse existing audio context if available and not closed
      if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
        audioContextRef.current = new AudioContext();
      }
      
      // Resume audio context if suspended
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }
      
      // Reuse existing analyser if available
      if (!analyserRef.current) {
        analyserRef.current = audioContextRef.current.createAnalyser();
        analyserRef.current.fftSize = 256;
      }
      
      // Only get new stream if we don't have one or it's inactive
      if (!streamRef.current || !streamRef.current.active) {
        // Get microphone stream for analysis
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;
        
        const source = audioContextRef.current.createMediaStreamSource(stream);
        source.connect(analyserRef.current);
      }
      
      console.log('🎤 Audio analyser setup complete');
    } catch (error) {
      console.error('Failed to setup audio analyser:', error);
    }
  }, []);

  // Cleanup audio resources
  const cleanupAudioResources = useCallback(() => {
    // Stop stream tracks immediately
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    // Close audio context asynchronously to avoid blocking
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      // Don't wait for close to complete - do it asynchronously
      audioContextRef.current.close().catch(error => {
        console.warn('Audio context close error (non-blocking):', error);
      });
      audioContextRef.current = null;
    }
    
    // Clear analyser reference immediately
    analyserRef.current = null;
    setAudioLevel(0);
    console.log('🎤 Audio resources cleaned up');
  }, []);

  // Request microphone permission
  const requestMicrophonePermission = async (): Promise<boolean> => {
    try {
      setPermissionStatus('requesting');
      console.log('🎤 Requesting microphone permission...');
      
      // Handle Electron environment
      if (isElectron) {
        console.log('🖥️ Detected Electron environment');
        
        // In Electron, we need to request permission through the main process
        // First, try to access the microphone directly
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          console.log('✅ Microphone permission granted in Electron');
          setPermissionStatus('granted');
          
          // Stop the stream immediately as we just needed permission
          stream.getTracks().forEach(track => track.stop());
          return true;
        } catch (electronError) {
          console.error('❌ Electron microphone access failed:', electronError);
          
          // If direct access fails, check if we have access to Electron's API
          if (window.electronAPI && (window.electronAPI as any).requestMicrophonePermission) {
            console.log('🔧 Requesting permission through Electron API...');
            const granted = await (window.electronAPI as any).requestMicrophonePermission();
            if (granted) {
              setPermissionStatus('granted');
              return true;
            }
          }
          
          // Fallback: Show instructions for manual permission grant
          setPermissionStatus('denied');
          setError('Microphone access denied. Please enable microphone permissions in your system settings for this app.');
          return false;
        }
      } else {
        // Regular browser environment
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        // If we get here, permission was granted
        console.log('✅ Microphone permission granted');
        setPermissionStatus('granted');
        
        // Stop the stream immediately as we just needed permission
        stream.getTracks().forEach(track => track.stop());
        
        return true;
      }
    } catch (error) {
      console.error('❌ Microphone permission denied:', error);
      setPermissionStatus('denied');
      
      if (isElectron) {
        setError('Microphone access denied. Please check your system settings and ensure this app has microphone permissions.');
      } else {
        setError('Microphone access denied. Please allow microphone access in your browser settings.');
      }
      return false;
    }
  };

  // Check existing permission status
  const checkPermissionStatus = async () => {
    try {
      if (!navigator.permissions) {
        console.log('⚠️ Permissions API not supported, will request on demand');
        setPermissionStatus('unknown');
        return;
      }

      const permission = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      console.log('🎤 Current microphone permission:', permission.state);
      
      if (permission.state === 'granted') {
        setPermissionStatus('granted');
      } else if (permission.state === 'denied') {
        setPermissionStatus('denied');
        setError('Microphone access denied. Please allow microphone access in your browser settings.');
      } else {
        setPermissionStatus('unknown');
        setShowPermissionRequest(true);
      }

      // Listen for permission changes
      permission.onchange = () => {
        console.log('🎤 Permission status changed:', permission.state);
        if (permission.state === 'granted') {
          setPermissionStatus('granted');
          setError(null);
          setShowPermissionRequest(false);
        } else if (permission.state === 'denied') {
          setPermissionStatus('denied');
          setError('Microphone access denied. Please allow microphone access in your browser settings.');
        }
      };
    } catch (error) {
      console.warn('Could not check permission status:', error);
      setPermissionStatus('unknown');
      setShowPermissionRequest(true);
    }
  };

  // Check permissions on mount
  useEffect(() => {
    checkPermissionStatus();
  }, []);

  // TTS health monitoring - hide microphone when TTS backend is unhealthy
  useEffect(() => {
    console.log('🔊 Setting up TTS health monitoring for voice chat...');
    
    const unsubscribe = claraTTSService.onHealthChange((isHealthy) => {
      setIsTTSHealthy(isHealthy);
      console.log(`🔊 TTS health changed in voice chat: ${isHealthy ? 'healthy' : 'unhealthy'}`);
      
      if (!isHealthy) {
        console.log('🔊 TTS backend unhealthy - voice features may be limited');
      }
    });
    
    // Cleanup subscription on unmount
    return () => {
      console.log('🔊 Cleaning up TTS health monitoring for voice chat');
      unsubscribe();
    };
  }, []);

  // Auto-request permission and initialize VAD when voice mode is enabled
  useEffect(() => {
    const initializeVoiceMode = async () => {
      // Only proceed if voice mode is enabled
      if (!isEnabledRef.current) {
        // Voice mode disabled - stop everything
        if (vadRef.current && isListeningRef.current) {
          vadRef.current.pause();
          console.log('🎤 VAD stopped (voice mode disabled)');
          setIsListening(false);
          setAudioLevel(0);
          cleanupAudioResources();
        }
        if (isManualRecordingRef.current) {
          stopManualRecording();
        }
        setIsProcessingAudio(false);
        return;
      }
      
      // Voice mode enabled - check if AI is responding or auto TTS is playing
      if (isAIRespondingRef.current || isAutoTTSPlayingRef.current) {
        // AI is responding or auto TTS is playing - pause voice detection
        if (vadRef.current && isListeningRef.current) {
          vadRef.current.pause();
          console.log('🎤 VAD paused (AI is responding or auto TTS is playing)');
          setIsListening(false);
          setAudioLevel(0);
          cleanupAudioResources();
        }
        if (isManualRecordingRef.current) {
          stopManualRecording();
        }
        return;
      }
      
      // If we don't have permission yet, request it automatically
      if (permissionStatus !== 'granted') {
        console.log('🎤 Voice mode enabled but no microphone permission - requesting automatically...');
        const granted = await requestMicrophonePermission();
        if (!granted) {
          console.log('🎤 Microphone permission denied, voice mode cannot start');
          return;
        }
        // Permission will be set by requestMicrophonePermission, which will trigger VAD initialization
        return;
      }
      
      // If we have permission but VAD isn't ready, wait for it
      if (permissionStatus === 'granted' && !vadReady && !isInitializingRef.current) {
        console.log('🎤 Permission granted, waiting for VAD to initialize...');
        return;
      }
      
      // If everything is ready, start listening
      if (vadReady && vadRef.current && !isListeningRef.current && !isProcessingAudioRef.current) {
        try {
          console.log('🎤 Auto-starting VAD (voice mode enabled)');
          await setupAudioAnalyser();
          await vadRef.current.start();
          console.log('🎤 VAD auto-started successfully');
          monitorAudioLevel();
        } catch (error) {
          console.error('🎤 Failed to auto-start VAD:', error);
          // Fallback to manual recording
          if (permissionStatus === 'granted') {
            await startManualRecording();
          }
        }
      }
    };

    initializeVoiceMode();
  }, [isEnabled, permissionStatus, vadReady, isAIResponding, isAutoTTSPlaying]);

  // Initialize VAD only after permission is granted
  useEffect(() => {
    const initializeVAD = async () => {
      // Prevent multiple simultaneous initializations
      if (isInitializingRef.current) {
        console.log('🎤 VAD initialization already in progress, skipping...');
        return;
      }
      
      // Only initialize if we have permission
      if (permissionStatus !== 'granted') {
        console.log('🎤 Waiting for microphone permission before initializing VAD');
        return;
      }

      // Cleanup any existing VAD instance first
      if (vadRef.current) {
        console.log('🎤 Cleaning up existing VAD instance before reinitializing...');
        vadRef.current.pause();
        vadRef.current.destroy();
        vadRef.current = null;
        setVadReady(false);
      }

      isInitializingRef.current = true;

      try {
        console.log('🎤 Initializing VAD with granted permissions...');
        setError(null); // Clear any previous errors
        
        // Add timeout to prevent infinite loading
        const timeoutId = setTimeout(() => {
          console.error('❌ VAD initialization timeout after 30 seconds');
          setError('VAD initialization timed out. Please refresh the page and try again.');
          setVadReady(false);
          isInitializingRef.current = false;
        }, 30000);
        
        // Dynamic import of VAD library
        console.log('🎤 Importing VAD library...');
        const { MicVAD } = await import('@ricky0123/vad-web');
        console.log('🎤 VAD library imported successfully');
        
        console.log('🎤 Creating MicVAD instance...');
        const vad = await MicVAD.new({
          onSpeechStart: () => {
            console.log('🎤 Speech started');
            setIsListening(true);
            audioChunksRef.current = [];
          },
          onSpeechEnd: async (audio: Float32Array) => {
            console.log('🎤 Speech ended');
            
            // CRITICAL: Check if we should ignore this speech due to concurrent processing
            if (isProcessingAudioRef.current || isProcessingRef.current || isAIRespondingRef.current) {
              console.log('🎤 Ignoring speech end - already processing or AI responding');
              setIsListening(false);
              setAudioLevel(0);
              return;
            }
            
            setIsListening(false);
            setAudioLevel(0);
            setIsProcessingAudio(true);
            
            // Pause VAD to prevent continuous listening during processing
            if (vadRef.current) {
              vadRef.current.pause();
              console.log('🎤 VAD paused for processing');
            }
            
            // Convert Float32Array to Blob and send
            const audioBlob = await convertFloat32ArrayToBlob(audio);
            if (audioBlob) {
              try {
                await onSendAudio(audioBlob);
                console.log('🎤 Audio sent successfully');
              } catch (error: unknown) {
                console.error('🎤 Error sending audio:', error);
              }
            }
            
            // Mark processing as complete
            setIsProcessingAudio(false);
            
            // OPTIMIZED: Faster auto-restart with reduced delay and better conditions
            setTimeout(async () => {
              // CRITICAL: Check all conditions before restarting (including auto TTS)
              if (isEnabledRef.current && vadRef.current && !isListeningRef.current && !isProcessingAudioRef.current && !isProcessingRef.current && !isAIRespondingRef.current && !isAutoTTSPlayingRef.current) {
                try {
                  console.log('🎤 Auto-restarting VAD after speech processing...');
                  await setupAudioAnalyser(); // Ensure audio analyser is ready
                  await vadRef.current.start();
                  console.log('🎤 VAD auto-restarted successfully');
                  monitorAudioLevel();
                } catch (restartError) {
                  console.error('🎤 Failed to auto-restart VAD:', restartError);
                  // If auto-restart fails, user can manually restart
                }
              } else {
                console.log('🎤 Skipping VAD auto-restart - conditions not met:', {
                  isEnabled: isEnabledRef.current,
                  vadExists: !!vadRef.current,
                  isListening: isListeningRef.current,
                  isProcessingAudio: isProcessingAudioRef.current,
                  isProcessing: isProcessingRef.current,
                  isAIResponding: isAIRespondingRef.current,
                  isAutoTTSPlaying: isAutoTTSPlayingRef.current
                });
              }
            }, 200); // REDUCED from 1000ms to 200ms for much faster restart
          },
          onVADMisfire: () => {
            console.log('🎤 VAD misfire - false positive detected');
            setIsListening(false);
            setAudioLevel(0);
            // Don't restart on misfire, let it continue listening
          },
          // Improved VAD parameters for better speech detection
          positiveSpeechThreshold: 0.6,    // Slightly lower threshold for better sensitivity
          negativeSpeechThreshold: 0.15,   // Lower threshold for better speech end detection
          redemptionFrames: 8,              // Fewer frames for faster response
          frameSamples: 1536,               // Keep default frame size
          preSpeechPadFrames: 1,            // Less padding for faster start
          minSpeechFrames: 4                // Fewer frames required to confirm speech
        });
        
        clearTimeout(timeoutId); // Clear timeout if successful
        vadRef.current = vad;
        setVadReady(true);
        console.log('✅ VAD initialized successfully');
        
      } catch (error) {
        console.error('❌ Failed to initialize VAD:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        setError(`Failed to initialize voice detection: ${errorMessage}`);
        setVadReady(false);
      } finally {
        isInitializingRef.current = false;
      }
    };

    // Initialize VAD when we have permission
    if (permissionStatus === 'granted' && !vadReady && !isInitializingRef.current) {
      initializeVAD();
    }

    return () => {
      // Cleanup on unmount or permission change
      if (vadRef.current) {
        vadRef.current.pause();
        vadRef.current.destroy();
        vadRef.current = null;
        setVadReady(false);
      }
      cleanupAudioResources();
      isInitializingRef.current = false;
    };
  }, [permissionStatus]); // Only depend on permission status

  // Convert Float32Array to Blob
  const convertFloat32ArrayToBlob = async (float32Array: Float32Array): Promise<Blob | null> => {
    try {
      // Create audio context for conversion
      const audioContext = new AudioContext({ sampleRate: 16000 });
      const audioBuffer = audioContext.createBuffer(1, float32Array.length, 16000);
      audioBuffer.copyToChannel(float32Array, 0);
      
      // Convert to WAV format
      const wavBlob = await audioBufferToWav(audioBuffer);
      return wavBlob;
    } catch (error) {
      console.error('Error converting audio:', error);
      return null;
    }
  };

  // Convert AudioBuffer to WAV Blob
  const audioBufferToWav = (audioBuffer: AudioBuffer): Promise<Blob> => {
    return new Promise((resolve) => {
      const numberOfChannels = audioBuffer.numberOfChannels;
      const sampleRate = audioBuffer.sampleRate;
      const format = 1; // PCM
      const bitDepth = 16;
      
      const bytesPerSample = bitDepth / 8;
      const blockAlign = numberOfChannels * bytesPerSample;
      
      const buffer = audioBuffer.getChannelData(0);
      const arrayBuffer = new ArrayBuffer(44 + buffer.length * bytesPerSample);
      const view = new DataView(arrayBuffer);
      
      // WAV header
      const writeString = (offset: number, string: string) => {
        for (let i = 0; i < string.length; i++) {
          view.setUint8(offset + i, string.charCodeAt(i));
        }
      };
      
      writeString(0, 'RIFF');
      view.setUint32(4, 36 + buffer.length * bytesPerSample, true);
      writeString(8, 'WAVE');
      writeString(12, 'fmt ');
      view.setUint32(16, 16, true);
      view.setUint16(20, format, true);
      view.setUint16(22, numberOfChannels, true);
      view.setUint32(24, sampleRate, true);
      view.setUint32(28, sampleRate * blockAlign, true);
      view.setUint16(32, blockAlign, true);
      view.setUint16(34, bitDepth, true);
      writeString(36, 'data');
      view.setUint32(40, buffer.length * bytesPerSample, true);
      
      // Convert float samples to 16-bit PCM
      let offset = 44;
      for (let i = 0; i < buffer.length; i++) {
        const sample = Math.max(-1, Math.min(1, buffer[i]));
        view.setInt16(offset, sample * 0x7FFF, true);
        offset += 2;
      }
      
      resolve(new Blob([arrayBuffer], { type: 'audio/wav' }));
    });
  };

  // Start/stop voice chat
  const toggleVoiceChat = async () => {
    // Check if we need to request permission first
    if (permissionStatus === 'unknown' || permissionStatus === 'denied') {
      const granted = await requestMicrophonePermission();
      if (!granted) {
        return; // Don't proceed if permission denied
      }
    }

    if (!vadReady && !isEnabled) {
      // If VAD is not ready, use manual recording as fallback
      if (isManualRecording) {
        stopManualRecording();
      } else {
        await startManualRecording();
      }
      onToggle();
      return;
    }

    if (!vadReady) {
      setError('Voice detection not ready');
      return;
    }

    try {
      if (isEnabled && vadRef.current) {
        // Start listening
        await setupAudioAnalyser(); // Setup audio monitoring
        await vadRef.current.start();
        console.log('🎤 Started listening');
        monitorAudioLevel();
      } else if (vadRef.current) {
        // Stop listening
        vadRef.current.pause();
        console.log('🎤 Stopped listening');
        setIsListening(false);
        setAudioLevel(0);
        cleanupAudioResources(); // Cleanup audio resources
      }
      
      onToggle();
    } catch (error) {
      console.error('Error toggling voice chat:', error);
      setError('Failed to toggle voice chat');
    }
  };

  // Play received audio
  const playAudio = useCallback(async (audioUrl: string) => {
    try {
      setIsSpeaking(true);
      
      if (audioElementRef.current) {
        audioElementRef.current.pause();
      }
      
      const audio = new Audio(audioUrl);
      audioElementRef.current = audio;
      
      audio.onended = () => {
        setIsSpeaking(false);
        audioElementRef.current = null;
      };
      
      audio.onerror = () => {
        setIsSpeaking(false);
        audioElementRef.current = null;
        console.error('Error playing audio');
      };
      
      await audio.play();
    } catch (error) {
      console.error('Error playing audio:', error);
      setIsSpeaking(false);
    }
  }, []);

  // Handle received audio
  useEffect(() => {
    // Set up the audio playback handler when onReceiveAudio prop changes
    // This will be used to play audio responses from Clara
  }, [onReceiveAudio]);

  // Toggle auto TTS
  const toggleAutoTTS = useCallback(() => {
    setAutoTTSEnabled(prev => {
      const newValue = !prev;
      console.log(`🔊 Auto TTS ${newValue ? 'enabled' : 'disabled'}`);
      
      // If disabling and currently playing, stop TTS
      if (!newValue && isAutoTTSPlaying) {
        claraTTSService.stopPlayback();
        setIsAutoTTSPlaying(false);
        setIsSpeaking(false);
      }
      
      return newValue;
    });
  }, [isAutoTTSPlaying]);

  // Manual restart function for when VAD gets stuck
  const restartVAD = useCallback(async () => {
    // Prevent multiple simultaneous restarts
    if (isInitializingRef.current) {
      console.log('🔄 VAD restart already in progress, skipping...');
      return;
    }
    
    // Don't restart if AI is responding
    if (isAIRespondingRef.current) {
      console.log('🔄 VAD restart skipped - AI is responding');
      return;
    }
    
    console.log('🔄 Manually restarting VAD...');
    isInitializingRef.current = true;
    
    try {
      // Stop current VAD immediately
      if (vadRef.current) {
        vadRef.current.pause();
        setIsListening(false);
        setAudioLevel(0);
      }
      
      // Cleanup audio resources immediately
      cleanupAudioResources();
      
      // Reset processing state
      setIsProcessingAudio(false);
      
      // Minimal wait for cleanup - reduced from 500ms to 100ms
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Restart if enabled and VAD is ready and AI is not responding
      if (isEnabledRef.current && vadReady && vadRef.current && !isAIRespondingRef.current) {
        try {
          console.log('🎤 Setting up audio analyser for restart...');
          await setupAudioAnalyser();
          console.log('🎤 Starting VAD after restart...');
          await vadRef.current.start();
          console.log('🎤 VAD manually restarted successfully');
          monitorAudioLevel();
        } catch (error) {
          console.error('Failed to restart VAD:', error);
          setError('Failed to restart voice detection. Try refreshing the page.');
        }
      } else {
        console.log('🎤 Cannot restart VAD - enabled:', isEnabledRef.current, 'vadReady:', vadReady, 'vadRef exists:', !!vadRef.current, 'AI responding:', isAIRespondingRef.current);
      }
    } finally {
      isInitializingRef.current = false;
    }
  }, [vadReady, setupAudioAnalyser, cleanupAudioResources, monitorAudioLevel]);

  // Auto TTS effect - process autoTTSTrigger when enabled
  useEffect(() => {
    const processAutoTTS = async () => {
      console.log('🔊 Auto TTS effect triggered:', {
        autoTTSEnabled,
        hasAutoTTSTrigger: !!autoTTSTrigger,
        isTTSHealthy,
        autoTTSTrigger: autoTTSTrigger ? {
          text: autoTTSTrigger.text.slice(0, 50) + '...',
          timestamp: autoTTSTrigger.timestamp
        } : null,
        processedTrigger: processedTriggerRef.current
      });

      // Only process if auto TTS is enabled and we have a trigger
      if (!autoTTSEnabled || !autoTTSTrigger || !isTTSHealthy) {
        console.log('🔊 Auto TTS skipped:', {
          autoTTSEnabled,
          hasAutoTTSTrigger: !!autoTTSTrigger,
          isTTSHealthy
        });
        return;
      }

      // Check if this trigger was already processed to prevent repetition
      if (processedTriggerRef.current && 
          processedTriggerRef.current.text === autoTTSTrigger.text && 
          processedTriggerRef.current.timestamp === autoTTSTrigger.timestamp) {
        console.log('🔊 Auto TTS trigger already processed, skipping...');
        return;
      }

      // Mark this trigger as processed before starting TTS
      processedTriggerRef.current = {
        text: autoTTSTrigger.text,
        timestamp: autoTTSTrigger.timestamp
      };

      console.log('🔊 Processing auto TTS trigger:', autoTTSTrigger.text.slice(0, 50) + '...');

      try {
        // Pause voice detection during TTS
        if (vadRef.current && isListeningRef.current) {
          vadRef.current.pause();
          console.log('🎤 VAD paused for auto TTS');
          setIsListening(false);
          setAudioLevel(0);
          cleanupAudioResources();
        }

        // Stop manual recording if active
        if (isManualRecordingRef.current) {
          stopManualRecording();
        }

        setIsAutoTTSPlaying(true);
        setIsSpeaking(true);

        // Clean the content for TTS (remove markdown, etc.)
        const cleanContent = autoTTSTrigger.text
          .replace(/<think>[\s\S]*?<\/think>/gi, '') // Remove <think> tags and their content
          .replace(/<[^>]*>/g, '') // Remove any other HTML/XML tags
          .replace(/```[\s\S]*?```/g, '[code block]') // Replace code blocks
          .replace(/`([^`]+)`/g, '$1') // Remove inline code backticks
          .replace(/\*\*([^*]+)\*\*/g, '$1') // Remove bold markdown
          .replace(/\*([^*]+)\*/g, '$1') // Remove italic markdown
          .replace(/#{1,6}\s+/g, '') // Remove headers
          .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Replace links with text
          .replace(/\n{3,}/g, '\n\n') // Reduce multiple newlines
          .replace(/\s+/g, ' ') // Normalize whitespace
          .trim();

        if (!cleanContent) {
          console.warn('🔊 No content to synthesize after cleaning');
          return;
        }

        console.log('🔊 Starting auto TTS synthesis...');
        await claraTTSService.synthesizeAndPlay({
          text: cleanContent,
          engine: 'kokoro',
          voice: 'af_sarah',
          speed: 1.0,
          language: 'en'
        });

        console.log('🔊 Auto TTS playback completed');

      } catch (error) {
        console.error('🔊 Auto TTS error:', error);
        // Don't show error to user for auto TTS failures, just log it
      } finally {
        setIsAutoTTSPlaying(false);
        setIsSpeaking(false);

        // Resume voice detection after TTS with a short delay
        setTimeout(async () => {
          if (isEnabledRef.current && vadReady && vadRef.current && !isListeningRef.current && !isProcessingAudioRef.current && !isAIRespondingRef.current && !isAutoTTSPlayingRef.current) {
            try {
              console.log('🎤 Resuming VAD after auto TTS...');
              await setupAudioAnalyser();
              await vadRef.current.start();
              console.log('🎤 VAD resumed after auto TTS');
              monitorAudioLevel();
            } catch (error) {
              console.error('🎤 Failed to resume VAD after auto TTS:', error);
            }
          }
        }, 500); // 500ms delay to ensure TTS has fully stopped
      }
    };

    processAutoTTS();
  }, [autoTTSTrigger, autoTTSEnabled, isTTSHealthy, vadReady, setupAudioAnalyser, monitorAudioLevel]);

  // VAD health check - automatically restart if stuck - OPTIMIZED FOR SPEED
  useEffect(() => {
    // Clear any existing health check
    if (healthCheckIntervalRef.current) {
      clearInterval(healthCheckIntervalRef.current);
      healthCheckIntervalRef.current = null;
    }
    
    // Only start health check if voice mode is enabled and VAD is ready
    if (!isEnabled || !vadReady) return;
    
    // REDUCED from 10 seconds to 2 seconds for faster response
    healthCheckIntervalRef.current = setInterval(() => {
      // Check if VAD should be listening but isn't (and we're not processing, AI is not responding, and auto TTS is not playing)
      if (isEnabledRef.current && vadReady && !isListeningRef.current && !isProcessingAudioRef.current && !isManualRecordingRef.current && !isInitializingRef.current && !isAIRespondingRef.current && !isAutoTTSPlayingRef.current) {
        console.log('🔍 VAD health check: Should be listening but isn\'t - auto-restarting...');
        restartVAD();
      } else if ((isAIRespondingRef.current || isAutoTTSPlayingRef.current) && isListeningRef.current) {
        // If AI is responding or auto TTS is playing and we're still listening, pause VAD immediately
        console.log('🔍 VAD health check: AI is responding or auto TTS is playing, pausing VAD...');
        if (vadRef.current) {
          vadRef.current.pause();
          setIsListening(false);
          setAudioLevel(0);
          cleanupAudioResources();
        }
        if (isManualRecordingRef.current) {
          stopManualRecording();
        }
      }
    }, 2000); // REDUCED from 10000ms to 2000ms for much faster response
    
    return () => {
      if (healthCheckIntervalRef.current) {
        clearInterval(healthCheckIntervalRef.current);
        healthCheckIntervalRef.current = null;
      }
    };
  }, [isEnabled, vadReady, isAIResponding, restartVAD]);

  // IMMEDIATE VAD restart when AI response completes - NEW EFFECT
  useEffect(() => {
    // When AI stops responding, immediately check if we should restart VAD (but not if auto TTS is playing)
    if (!isAIResponding && isEnabled && vadReady && !isListening && !isProcessingAudio && !isManualRecording && !isInitializingRef.current && !isAutoTTSPlaying) {
      console.log('🚀 AI response completed - immediately restarting VAD...');
      // Use a very short delay to ensure state has settled
      setTimeout(() => {
        if (isEnabledRef.current && vadReady && !isListeningRef.current && !isProcessingAudioRef.current && !isAIRespondingRef.current && !isAutoTTSPlayingRef.current) {
          restartVAD();
        }
      }, 50); // Only 50ms delay for immediate response
    }
  }, [isAIResponding, isEnabled, vadReady, isListening, isProcessingAudio, isManualRecording, isAutoTTSPlaying, restartVAD]);

  // Debug effect to monitor VAD state transitions
  useEffect(() => {
    console.log('🔍 VAD State Change:', {
      isEnabled,
      vadReady,
      isListening,
      isProcessingAudio,
      isProcessing,
      isAIResponding,
      isManualRecording,
      isAutoTTSPlaying,
      isInitializing: isInitializingRef.current,
      vadExists: !!vadRef.current,
      timestamp: new Date().toISOString()
    });
  }, [isEnabled, vadReady, isListening, isProcessingAudio, isProcessing, isAIResponding, isManualRecording, isAutoTTSPlaying]);

  // AGGRESSIVE immediate restart - triggers on any state change that should enable listening
  useEffect(() => {
    // If all conditions are met for listening but we're not listening, restart immediately
    if (isEnabled && vadReady && !isListening && !isProcessingAudio && !isAIResponding && !isManualRecording && !isInitializingRef.current && !isAutoTTSPlaying && vadRef.current) {
      console.log('🚀 All conditions met for listening - immediate restart...');
      // Immediate restart without delay
      const immediateRestart = async () => {
        try {
          await setupAudioAnalyser();
          await vadRef.current!.start();
          console.log('🎤 Immediate VAD restart successful');
          monitorAudioLevel();
        } catch (error) {
          console.error('🎤 Immediate restart failed:', error);
          // Fall back to regular restart mechanism
          setTimeout(() => restartVAD(), 100);
        }
      };
      immediateRestart();
    }
  }, [isEnabled, vadReady, isListening, isProcessingAudio, isAIResponding, isManualRecording, isAutoTTSPlaying, setupAudioAnalyser, monitorAudioLevel, restartVAD]);

  // Cleanup effect when component unmounts or voice mode is disabled
  useEffect(() => {
    return () => {
      // Cleanup when component unmounts
      console.log('🎤 Voice chat component unmounting - cleaning up all resources...');
      
      // Clear health check interval
      if (healthCheckIntervalRef.current) {
        clearInterval(healthCheckIntervalRef.current);
        healthCheckIntervalRef.current = null;
      }
      
      // Stop and destroy VAD
      if (vadRef.current) {
        vadRef.current.pause();
        vadRef.current.destroy();
        vadRef.current = null;
      }
      
      // Cleanup audio resources
      cleanupAudioResources();
      
      // Stop manual recording
      if (manualRecorder && manualRecorder.state === 'recording') {
        manualRecorder.stop();
      }
      
      // Reset all refs and state
      isInitializingRef.current = false;
      setVadReady(false);
      setIsListening(false);
      setIsProcessingAudio(false);
      setIsManualRecording(false);
      
      console.log('🎤 Voice chat component cleanup complete');
    };
  }, []); // Empty dependency array - only run on unmount

  // Stop speaking
  const stopSpeaking = () => {
    if (audioElementRef.current) {
      audioElementRef.current.pause();
      audioElementRef.current = null;
      setIsSpeaking(false);
    }
  };

  // Manual recording functions
  const startManualRecording = async () => {
    try {
      // Check permission before starting
      if (permissionStatus !== 'granted') {
        const granted = await requestMicrophonePermission();
        if (!granted) {
          return;
        }
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(chunks, { type: 'audio/webm' });
        await onSendAudio(audioBlob);
        setManualAudioChunks([]);
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setManualRecorder(recorder);
      setManualAudioChunks(chunks);
      setIsManualRecording(true);
      setIsListening(true);
    } catch (error) {
      console.error('Failed to start manual recording:', error);
      setError('Failed to access microphone');
    }
  };

  const stopManualRecording = () => {
    if (manualRecorder && manualRecorder.state === 'recording') {
      manualRecorder.stop();
      setManualRecorder(null);
      setIsManualRecording(false);
      setIsListening(false);
    }
  };

  // Update refs when state changes to prevent stale closure issues
  useEffect(() => {
    isProcessingAudioRef.current = isProcessingAudio;
  }, [isProcessingAudio]);
  
  useEffect(() => {
    isProcessingRef.current = isProcessing;
  }, [isProcessing]);
  
  useEffect(() => {
    isAIRespondingRef.current = isAIResponding;
  }, [isAIResponding]);
  
  useEffect(() => {
    isEnabledRef.current = isEnabled;
  }, [isEnabled]);
  
  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);
  
  useEffect(() => {
    isManualRecordingRef.current = isManualRecording;
  }, [isManualRecording]);

  // Add missing ref update for auto TTS
  useEffect(() => {
    isAutoTTSPlayingRef.current = isAutoTTSPlaying;
  }, [isAutoTTSPlaying]);

  return (
    <div className="flex flex-col items-center space-y-4 p-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
      {/* Permission Request UI */}
      {showPermissionRequest && permissionStatus !== 'granted' && (
        <div className="w-full max-w-md p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <div className="flex items-center space-x-3">
            <Mic className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
            <div className="flex-1">
              <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                Microphone Access Required
              </h3>
              <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                {isElectron 
                  ? 'Voice chat needs microphone access. This app may need permission in your system settings.'
                  : 'Voice chat needs access to your microphone to detect speech and record audio.'
                }
              </p>
            </div>
          </div>
          <div className="mt-3 flex space-x-2">
            <button
              onClick={requestMicrophonePermission}
              disabled={permissionStatus === 'requesting'}
              className="px-3 py-1 bg-yellow-600 hover:bg-yellow-700 disabled:bg-yellow-400 text-white text-xs rounded font-medium transition-colors"
            >
              {permissionStatus === 'requesting' ? 'Requesting...' : 'Grant Permission'}
            </button>
            <button
              onClick={() => setShowPermissionRequest(false)}
              className="px-3 py-1 bg-gray-300 hover:bg-gray-400 dark:bg-gray-600 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-200 text-xs rounded font-medium transition-colors"
            >
              Later
            </button>
          </div>
        </div>
      )}

      {/* Permission Denied UI */}
      {permissionStatus === 'denied' && (
        <div className="w-full max-w-md p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <div className="flex items-center space-x-3">
            <MicOff className="w-6 h-6 text-red-600 dark:text-red-400" />
            <div className="flex-1">
              <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
                Microphone Access Denied
              </h3>
              <p className="text-xs text-red-700 dark:text-red-300 mt-1">
                {isElectron 
                  ? 'Please enable microphone permissions for this app in your system settings (Privacy & Security → Microphone).'
                  : 'To use voice chat, please allow microphone access in your browser settings.'
                }
              </p>
            </div>
          </div>
          <div className="mt-3 flex space-x-2">
            <button
              onClick={() => {
                setPermissionStatus('unknown');
                setShowPermissionRequest(true);
                setError(null);
              }}
              className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded font-medium transition-colors"
            >
              Try Again
            </button>
            {isElectron && (
              <button
                onClick={() => {
                  // Open system preferences (this would need to be implemented in the main process)
                  if ((window.electronAPI as any).openSystemPreferences) {
                    (window.electronAPI as any).openSystemPreferences('privacy');
                  }
                }}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded font-medium transition-colors"
              >
                Open Settings
              </button>
            )}
          </div>
        </div>
      )}

      {/* Audio Visualizer */}
      <div className="relative">
        <AudioVisualizer
          isListening={isListening}
          isSpeaking={isSpeaking}
          audioLevel={audioLevel}
          isProcessing={isProcessing}
          isAIResponding={isAIResponding}
        />
        
        {/* Status overlay */}
        <div className="absolute inset-0 flex items-center justify-center">
          {isProcessing ? (
            <div className="text-blue-500">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
          ) : isListening ? (
            <Mic className="w-8 h-8 text-green-500" />
          ) : isSpeaking ? (
            <Volume2 className="w-8 h-8 text-purple-500" />
          ) : !isTTSHealthy ? (
            <MicOff className="w-8 h-8 text-red-400" />
          ) : (
            <MicOff className="w-8 h-8 text-gray-400" />
          )}
        </div>
      </div>

      {/* Status Text */}
      <div className="text-center">
        {!isTTSHealthy ? (
          <p className="text-red-500 text-sm">🔊 Voice features unavailable - TTS backend offline</p>
        ) : error ? (
          <p className="text-red-500 text-sm">{error}</p>
        ) : permissionStatus === 'requesting' ? (
          <p className="text-blue-600 text-sm">Requesting microphone permission...</p>
        ) : permissionStatus === 'denied' ? (
          <p className="text-red-500 text-sm">Microphone access denied</p>
        ) : permissionStatus !== 'granted' ? (
          <p className="text-yellow-600 text-sm">
            {isEnabled ? 'Voice mode enabled - requesting microphone access...' : 'Microphone permission required'}
          </p>
        ) : isProcessingAudio ? (
          <p className="text-orange-600 text-sm">🎵 Converting audio...</p>
        ) : isProcessing ? (
          <p className="text-blue-600 text-sm">Processing your voice...</p>
        ) : isListening ? (
          <p className="text-green-600 text-sm">
            🎤 Listening... (speak now)
          </p>
        ) : isSpeaking ? (
          <p className="text-purple-600 text-sm">
            🔊 {isAutoTTSPlaying ? 'Auto TTS: Clara is speaking...' : 'Clara is speaking...'}
          </p>
        ) : isEnabled && !vadReady && !isInitializingRef.current ? (
          <p className="text-blue-600 text-sm">🎤 Initializing voice detection...</p>
        ) : isEnabled && !vadReady && isInitializingRef.current ? (
          <p className="text-blue-600 text-sm">🎤 Loading voice detection engine...</p>
        ) : isEnabled && vadReady && isAIResponding ? (
          <p className="text-orange-600 text-sm">🎤 Voice paused (Clara is responding)</p>
        ) : isEnabled && vadReady && !isListening && !isAIResponding ? (
          <p className="text-yellow-600 text-sm">🎤 Ready - starting voice detection...</p>
        ) : isEnabled || isManualRecording ? (
          <p className="text-blue-600 text-sm">
            {vadReady ? '🎤 Ready - speak to activate' : '🎤 Voice mode active (manual recording)'}
          </p>
        ) : (
          <p className="text-gray-400 text-sm">Click microphone to start voice mode</p>
        )}
      </div>

      {/* Streaming Text Display */}
      {isStreaming && streamingText && (
        <div className="max-w-md p-3 bg-gray-100 dark:bg-gray-700 rounded-lg">
          <p className="text-sm text-gray-700 dark:text-gray-300">
            {streamingText}
            <span className="animate-pulse">|</span>
          </p>
        </div>
      )}

      {/* Controls */}
      <div className="flex space-x-2">
        {/* Auto TTS Toggle Button */}
        {isTTSHealthy && (
          <button
            onClick={toggleAutoTTS}
            className={`px-3 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2 ${
              autoTTSEnabled 
                ? 'bg-purple-500 hover:bg-purple-600 text-white' 
                : 'bg-gray-300 hover:bg-gray-400 dark:bg-gray-600 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-200'
            }`}
            title={autoTTSEnabled ? 'Disable Auto TTS' : 'Enable Auto TTS'}
          >
            <Volume2 className="w-4 h-4" />
            <span className="text-sm">Auto TTS</span>
            {isAutoTTSPlaying && (
              <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
            )}
          </button>
        )}

        {/* Only show stop speaking button when Clara is speaking */}
        {isSpeaking && (
          <button
            onClick={stopSpeaking}
            className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors"
          >
            <VolumeX className="w-4 h-4 inline mr-2" />
            Stop Speaking
          </button>
        )}
        
        {/* Manual restart button when VAD is stuck or having issues */}
        {isEnabled && vadReady && (isListening || error) && (
          <button
            onClick={restartVAD}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors"
          >
            🔄 Restart Voice Detection
          </button>
        )}
        
        {/* Show permission request button only when needed */}
        {permissionStatus !== 'granted' && !showPermissionRequest && (
          <button
            onClick={() => setShowPermissionRequest(true)}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors"
          >
            <Mic className="w-4 h-4 inline mr-2" />
            Enable Microphone
          </button>
        )}
      </div>

      {/* System Status */}
      <div className="text-xs text-gray-500 text-center">
        <div className="flex items-center justify-center space-x-2">
          <span>Voice Detection: {vadReady ? '✅ Ready' : '⏳ Loading...'}</span>
          <span>•</span>
          <span>Microphone: {
            permissionStatus === 'granted' ? '✅ Ready' :
            permissionStatus === 'denied' ? '❌ Blocked' :
            permissionStatus === 'requesting' ? '⏳ Requesting...' :
            '❓ Not Set'
          }</span>
          <span>•</span>
          <span>TTS Backend: {isTTSHealthy ? '✅ Ready' : '❌ Offline'}</span>
          {isTTSHealthy && (
            <>
              <span>•</span>
              <span>Auto TTS: {autoTTSEnabled ? '✅ Enabled' : '❌ Disabled'}</span>
            </>
          )}
        </div>
        {error && (
          <div className="mt-2">
            <button
              onClick={() => {
                setError(null);
                setVadReady(true); // Allow bypass
              }}
              className="px-2 py-1 text-xs bg-yellow-500 hover:bg-yellow-600 text-white rounded"
            >
              Continue without Voice Detection
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ClaraVoiceChat; 