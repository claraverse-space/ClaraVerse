import { memo, useState, useEffect } from 'react';
import { NodeProps } from 'reactflow';
import { 
  Volume2, Play, Pause, Square, Settings, 
  ChevronDown, Info, CheckCircle, 
  AlertCircle, Loader2, Speaker
} from 'lucide-react';
import BaseNode from './BaseNode';
import { claraTTSService, TTSRequest } from '../../../services/claraTTSService';

interface TextToSpeechNodeProps extends NodeProps {
  // Inherit all standard node props
}

const TextToSpeechNode = memo<TextToSpeechNodeProps>((props) => {
  const { data } = props;
  
  // Configuration state
  const [engine, setEngine] = useState(data.engine || 'kokoro');
  const [voice, setVoice] = useState(data.voice || 'af_sarah');
  const [language, setLanguage] = useState(data.language || 'en');
  const [speed, setSpeed] = useState(data.speed || 1.0);
  const [volume, setVolume] = useState(data.volume || 1.0);
  const [autoPlay, setAutoPlay] = useState(data.autoPlay !== undefined ? data.autoPlay : true);
  const [slow, setSlow] = useState(data.slow || false);
  
  // UI state
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [progress, setProgress] = useState(0);
  
  // Status and error state
  const [lastError, setLastError] = useState<string | null>(null);
  const [lastSuccess, setLastSuccess] = useState<boolean | null>(null);
  const [generatedAudioUrl, setGeneratedAudioUrl] = useState<string | null>(null);
  const [ttsServiceHealthy, setTtsServiceHealthy] = useState(false);
  
  // Input text from connected node
  const inputText = data.inputValue || data.text || '';
  
  // Refs
  const nodeId = props.id;
  
  // Check TTS service health on mount
  useEffect(() => {
    const checkHealth = () => {
      setTtsServiceHealthy(claraTTSService.isBackendHealthy());
    };
    
    checkHealth();
    
    // Subscribe to health changes
    const unsubscribeHealth = claraTTSService.onHealthChange((isHealthy) => {
      setTtsServiceHealthy(isHealthy);
      if (!isHealthy && isPlaying) {
        setIsPlaying(false);
        setIsPaused(false);
      }
    });
    
    // Subscribe to audio state changes
    const unsubscribeState = claraTTSService.onStateChange((state) => {
      // Only update if this node's message is playing
      if (state.messageId === nodeId || (!state.messageId && generatedAudioUrl)) {
        setIsPlaying(state.isPlaying);
        setIsPaused(state.isPaused);
        setCurrentTime(state.currentTime);
        setDuration(state.duration);
        setProgress(state.progress);
      }
    });
    
    return () => {
      unsubscribeHealth();
      unsubscribeState();
    };
  }, [nodeId, generatedAudioUrl, isPlaying]);
  
  // Handle configuration changes
  const handleConfigChange = (key: string, value: any) => {
    const updates = { [key]: value };
    
    switch (key) {
      case 'engine':
        setEngine(value);
        break;
      case 'voice':
        setVoice(value);
        break;
      case 'language':
        setLanguage(value);
        break;
      case 'speed':
        setSpeed(value);
        break;
      case 'volume':
        setVolume(value);
        break;
      case 'autoPlay':
        setAutoPlay(value);
        break;
      case 'slow':
        setSlow(value);
        break;
    }
    
    if (data.onUpdate) {
      data.onUpdate({ 
        data: { 
          ...data, 
          ...updates
        } 
      });
    }
  };
  
  // Generate speech from text
  const handleGenerateSpeech = async () => {
    if (!inputText.trim()) {
      setLastError('No input text provided');
      setLastSuccess(false);
      return;
    }
    
    if (!ttsServiceHealthy) {
      setLastError('TTS service is not available');
      setLastSuccess(false);
      return;
    }
    
    setIsGenerating(true);
    setLastError(null);
    
    try {
      const request: TTSRequest = {
        text: inputText.trim(),
        engine: engine as any,
        voice: voice,
        language: language,
        speed: speed,
        slow: slow
      };
      
      console.log('🔊 Generating TTS with request:', request);
      
      const result = await claraTTSService.synthesizeText(request);
      
      if (result.success && result.audioUrl) {
        setGeneratedAudioUrl(result.audioUrl);
        setLastSuccess(true);
        setLastError(null);
        
        // Update node outputs
        if (data.onUpdate) {
          data.onUpdate({
            data: {
              ...data,
              outputs: {
                audioUrl: result.audioUrl,
                success: true,
                status: {
                  engine: engine,
                  voice: voice,
                  language: language,
                  textLength: inputText.length,
                  generatedAt: new Date().toISOString()
                }
              }
            }
          });
        }
        
        // Auto-play if enabled
        if (autoPlay) {
          await handlePlayAudio();
        }
        
        console.log('✅ TTS generation successful');
      } else {
        throw new Error(result.error || 'TTS generation failed');
      }
    } catch (error) {
      console.error('❌ TTS generation failed:', error);
      setLastError(error instanceof Error ? error.message : 'TTS generation failed');
      setLastSuccess(false);
      
      // Update node outputs with error
      if (data.onUpdate) {
        data.onUpdate({
          data: {
            ...data,
            outputs: {
              audioUrl: null,
              success: false,
              status: {
                error: error instanceof Error ? error.message : 'TTS generation failed',
                generatedAt: new Date().toISOString()
              }
            }
          }
        });
      }
    } finally {
      setIsGenerating(false);
    }
  };
  
  // Play generated audio
  const handlePlayAudio = async () => {
    if (!generatedAudioUrl) {
      await handleGenerateSpeech();
      return;
    }
    
    try {
      await claraTTSService.playAudioWithControls(
        generatedAudioUrl,
        volume,
        speed,
        nodeId
      );
    } catch (error) {
      console.error('Audio playback failed:', error);
      setLastError('Audio playback failed');
    }
  };
  
  // Pause audio
  const handlePauseAudio = () => {
    claraTTSService.pauseAudio();
  };
  
  // Resume audio
  const handleResumeAudio = () => {
    claraTTSService.resumeAudio();
  };
  
  // Stop audio
  const handleStopAudio = () => {
    claraTTSService.stopPlayback();
  };
  
  // Seek to progress
  const handleSeek = (newProgress: number) => {
    claraTTSService.seekToProgress(newProgress);
  };
  
  // Format time for display
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  // Get status color
  const getStatusColor = () => {
    if (!ttsServiceHealthy) return 'text-red-500';
    if (isGenerating) return 'text-blue-500';
    if (lastSuccess === true) return 'text-green-500';
    if (lastSuccess === false) return 'text-red-500';
    return 'text-gray-500';
  };
  
  // Get status text
  const getStatusText = () => {
    if (!ttsServiceHealthy) return 'TTS Service Offline';
    if (isGenerating) return 'Generating Speech...';
    if (lastSuccess === true) return 'Ready to Play';
    if (lastError) return lastError;
    return 'Ready';
  };

  return (
    <BaseNode 
      {...props} 
      title="Text to Speech"
      category="media"
      icon={<Volume2 className="w-4 h-4" />}
      inputs={data.inputs || []}
      outputs={data.outputs || []}
    >
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Volume2 className="w-4 h-4 text-blue-500" />
            <span className="font-medium text-sm">Text to Speech</span>
          </div>
          <div className="flex items-center gap-1">
            {/* Service Health Indicator */}
            <div className={`w-2 h-2 rounded-full ${
              ttsServiceHealthy ? 'bg-green-500' : 'bg-red-500'
            }`} title={ttsServiceHealthy ? 'TTS Service Online' : 'TTS Service Offline'} />
            
            {/* Config Toggle */}
            <button
              onClick={() => setIsConfigOpen(!isConfigOpen)}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
              title="Settings"
            >
              <Settings className="w-3 h-3 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Input Text Display */}
        <div className="space-y-2">
          <div className="text-xs font-medium text-gray-600 dark:text-gray-400">
            Input Text ({inputText.length} chars)
          </div>
          <div className="text-xs bg-gray-50 dark:bg-gray-800 p-2 rounded border max-h-20 overflow-y-auto">
            {inputText || <span className="text-gray-400 italic">No input text</span>}
          </div>
        </div>

        {/* Status */}
        <div className="flex items-center gap-2 text-xs">
          {isGenerating ? (
            <Loader2 className="w-3 h-3 animate-spin text-blue-500" />
          ) : lastSuccess === true ? (
            <CheckCircle className="w-3 h-3 text-green-500" />
          ) : lastSuccess === false ? (
            <AlertCircle className="w-3 h-3 text-red-500" />
          ) : (
            <Info className="w-3 h-3 text-gray-500" />
          )}
          <span className={getStatusColor()}>{getStatusText()}</span>
        </div>

        {/* Audio Controls */}
        {(generatedAudioUrl || isPlaying || isPaused) && (
          <div className="space-y-2 p-3 bg-gray-50 dark:bg-gray-800 rounded">
            {/* Playback Controls */}
            <div className="flex items-center gap-2">
              {!isPlaying && !isPaused ? (
                <button
                  onClick={handlePlayAudio}
                  disabled={isGenerating || !ttsServiceHealthy}
                  className="p-1.5 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded transition-colors"
                  title="Play"
                >
                  <Play className="w-3 h-3" />
                </button>
              ) : isPaused ? (
                <button
                  onClick={handleResumeAudio}
                  className="p-1.5 bg-green-500 hover:bg-green-600 text-white rounded transition-colors"
                  title="Resume"
                >
                  <Play className="w-3 h-3" />
                </button>
              ) : (
                <button
                  onClick={handlePauseAudio}
                  className="p-1.5 bg-yellow-500 hover:bg-yellow-600 text-white rounded transition-colors"
                  title="Pause"
                >
                  <Pause className="w-3 h-3" />
                </button>
              )}
              
              <button
                onClick={handleStopAudio}
                disabled={!isPlaying && !isPaused}
                className="p-1.5 bg-red-500 hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded transition-colors"
                title="Stop"
              >
                <Square className="w-3 h-3" />
              </button>
              
              <div className="text-xs text-gray-600 dark:text-gray-400">
                {formatTime(currentTime)} / {formatTime(duration)}
              </div>
            </div>

            {/* Progress Bar */}
            {duration > 0 && (
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-blue-500 transition-all duration-200 rounded-full"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-500">{Math.round(progress)}%</span>
                </div>
                
                {/* Clickable progress bar for seeking */}
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={progress}
                  onChange={(e) => handleSeek(Number(e.target.value))}
                  className="w-full h-1 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
                  title="Seek"
                />
              </div>
            )}
          </div>
        )}

        {/* Generate Button */}
        <button
          onClick={handleGenerateSpeech}
          disabled={!inputText.trim() || isGenerating || !ttsServiceHealthy}
          className="w-full px-3 py-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded text-sm font-medium transition-colors flex items-center justify-center gap-2"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Speaker className="w-4 h-4" />
              Generate Speech
            </>
          )}
        </button>

        {/* Configuration Panel */}
        {isConfigOpen && (
          <div className="space-y-3 p-3 border border-gray-200 dark:border-gray-700 rounded bg-gray-50 dark:bg-gray-800">
            <div className="flex items-center gap-2">
              <ChevronDown className="w-3 h-3 text-gray-500" />
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Configuration</span>
            </div>
            
            {/* Engine Selection */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Engine</label>
              <select
                value={engine}
                onChange={(e) => handleConfigChange('engine', e.target.value)}
                className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              >
                <option value="kokoro">Kokoro (High Quality)</option>
                <option value="kokoro-onnx">Kokoro ONNX (Fast)</option>
                <option value="gtts">Google TTS</option>
                <option value="pyttsx3">Pyttsx3 (Local)</option>
                <option value="auto">Auto Select</option>
              </select>
            </div>

            {/* Voice Selection */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Voice</label>
              <select
                value={voice}
                onChange={(e) => handleConfigChange('voice', e.target.value)}
                className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              >
                <option value="af_sarah">Sarah (Female)</option>
                <option value="am_alex">Alex (Male)</option>
                <option value="af_nicole">Nicole (Female)</option>
                <option value="am_michael">Michael (Male)</option>
                <option value="bf_emma">Emma (Female)</option>
                <option value="bm_brian">Brian (Male)</option>
              </select>
            </div>

            {/* Language Selection */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Language</label>
              <select
                value={language}
                onChange={(e) => handleConfigChange('language', e.target.value)}
                className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              >
                <option value="en">English</option>
                <option value="es">Spanish</option>
                <option value="fr">French</option>
                <option value="de">German</option>
                <option value="it">Italian</option>
                <option value="pt">Portuguese</option>
                <option value="ja">Japanese</option>
                <option value="ko">Korean</option>
                <option value="zh">Chinese</option>
              </select>
            </div>

            {/* Speed Control */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
                Speed: {speed}x
              </label>
              <input
                type="range"
                min="0.5"
                max="2.0"
                step="0.1"
                value={speed}
                onChange={(e) => handleConfigChange('speed', Number(e.target.value))}
                className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            {/* Volume Control */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
                Volume: {Math.round(volume * 100)}%
              </label>
              <input
                type="range"
                min="0.0"
                max="1.0"
                step="0.1"
                value={volume}
                onChange={(e) => handleConfigChange('volume', Number(e.target.value))}
                className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            {/* Options */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={autoPlay}
                  onChange={(e) => handleConfigChange('autoPlay', e.target.checked)}
                  className="rounded"
                />
                <span className="text-gray-700 dark:text-gray-300">Auto-play generated audio</span>
              </label>
              
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={slow}
                  onChange={(e) => handleConfigChange('slow', e.target.checked)}
                  className="rounded"
                />
                <span className="text-gray-700 dark:text-gray-300">Slow speech mode</span>
              </label>
            </div>
          </div>
        )}
      </div>
    </BaseNode>
  );
});

TextToSpeechNode.displayName = 'TextToSpeechNode';

export default TextToSpeechNode;
