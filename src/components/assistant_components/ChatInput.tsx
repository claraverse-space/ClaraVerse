import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Image as ImageIcon,  StopCircle, Database, Send,  Mic, Loader2, Plus, X, Square, File, AlertCircle, Wrench, Code, Check, Settings, Bot, ChevronDown, Zap, Hand } from 'lucide-react';
// @ts-ignore
import api from '../../services/api'; // Import the API service
import type { Tool } from '../../db';
import ModelConfigModal from './ModelConfigModal';

interface ModelConfig {
  visionModel: string;
  toolModel: string;
  ragModel: string;
}

interface ModelSelectionConfig extends ModelConfig {
  mode: 'auto' | 'manual' | 'smart';
}

interface ChatInputProps {
  input: string;
  setInput: (input: string) => void;
  handleSend: () => void;
  handleKeyDown: (e: React.KeyboardEvent) => void;
  isDisabled: boolean;
  isProcessing: boolean;
  onNewChat: () => void;
  onImageUpload?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  images: Array<{ id: string; preview: string }>;
  onRemoveImage: (id: string) => void;
  handleStopStreaming: () => void;
  ragEnabled?: boolean;
  onToggleRag?: (enabled: boolean) => void;
  onTemporaryDocUpload?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  temporaryDocs?: Array<{ id: string; name: string }>;
  onRemoveTemporaryDoc?: (id: string) => void;
  tools?: Tool[];
  onToolSelect?: (tool: Tool | null) => void;
  useAllTools?: boolean;
  onUseAllToolsChange?: (useAll: boolean) => void;
  models?: any[];
  modelConfig: ModelSelectionConfig;
  onModelConfigSave: (config: ModelSelectionConfig) => void;
  onModelSelect?: (modelName: string) => void;
  useStructuredToolCalling?: boolean;
  onToggleStructuredToolCalling?: () => void;
  selectedModel?: string;
}

const defaultModelConfig: ModelConfig = {
  visionModel: '',
  toolModel: '',
  ragModel: ''
};

const ChatInput: React.FC<ChatInputProps> = ({
  input,
  setInput,
  handleSend,
  handleKeyDown,
  isDisabled,
  isProcessing,
  onNewChat,
  onImageUpload,
  images,
  onRemoveImage,
  handleStopStreaming,
  ragEnabled = false,
  onToggleRag,
  onTemporaryDocUpload,
  temporaryDocs = [],
  onRemoveTemporaryDoc,
  tools = [],
  onToolSelect,
  useAllTools = false,
  onUseAllToolsChange,
  models = [],
  modelConfig,
  onModelConfigSave,
  onModelSelect,
  useStructuredToolCalling = false,
  onToggleStructuredToolCalling,
  selectedModel = '',
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const tempDocInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  // Voice recording states
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Add state for API endpoint
  const [apiEndpoint, setApiEndpoint] = useState<string>('');
  
  // Add state for document upload loading
  const [isUploadingDocs, setIsUploadingDocs] = useState(false);

  // Add state for keyboard recording
  const [isKeyboardRecording, setIsKeyboardRecording] = useState(false);

  // Add state for microphone permission
  const [permissionState, setPermissionState] = useState<'unknown' | 'granted' | 'denied'>('unknown');

  // Add state for model configuration
  const [showModelConfig, setShowModelConfig] = useState(false);

  // Add state for tool dropdown
  const [showToolDropdown, setShowToolDropdown] = useState(false);

  // Add state for selected tool
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null);

  // Add state for model selection
  const [showModelSelect, setShowModelSelect] = useState(false);

  // Add state for mode selection
  const [showModeSelect, setShowModeSelect] = useState(false);

  // Get API endpoint on component mount
  useEffect(() => {
    const getApiEndpoint = async () => {
      try {
        // Try to get from API service
        const health = await api.checkHealth();
        if (health.status === 'connected' && health.port) {
          setApiEndpoint(`http://localhost:${health.port}`);
          return;
        }
        
        // Fallback to Electron if available
        if (window.electron) {
          try {
            // @ts-ignore
            const backendStatus = await window.electron.checkPythonBackend?.();
            if (backendStatus && backendStatus.port) {
              setApiEndpoint(`http://localhost:${backendStatus.port}`);
              return;
            }
          } catch (error) {
            console.error('Error getting Python backend status:', error);
          }
        }
        
        // Default fallback
        setApiEndpoint('http://localhost:8099');
      } catch (error) {
        console.error('Error determining API endpoint:', error);
        setApiEndpoint('http://localhost:8099'); // Default fallback
      }
    };
    
    getApiEndpoint();
  }, []);

  const handleImageClick = () => {
    fileInputRef.current?.click();
  };

  // Format recording time (mm:ss)
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  };

  // Check microphone permission
  const checkMicrophonePermission = async () => {
    try {
      // Check if permission is already granted
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioDevice = devices.find(device => device.kind === 'audioinput');
      
      if (audioDevice) {
        if (audioDevice.label) {
          // If we can see the label, permission was already granted
          setPermissionState('granted');
          return true;
        }
      }

      // Request permission
      await navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => {
          // Stop the stream immediately after getting permission
          stream.getTracks().forEach(track => track.stop());
          setPermissionState('granted');
          return true;
        });
      
      return true;
    } catch (err) {
      console.error("Microphone permission error:", err);
      setPermissionState('denied');
      return false;
    }
  };

  // Start recording function
  const startRecording = async () => {
    if (permissionState === 'unknown') {
      const hasPermission = await checkMicrophonePermission();
      if (!hasPermission) {
        alert("Clara needs microphone access for voice input features. Please enable it in System Preferences > Security & Privacy > Privacy > Microphone.");
        return;
      }
    } else if (permissionState === 'denied') {
      alert("Clara needs microphone access for voice input features. Please enable it in System Preferences > Security & Privacy > Privacy > Microphone.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      
      // Start timer
      setRecordingTime(0);
      timerRef.current = setInterval(() => {
        setRecordingTime(prevTime => prevTime + 1);
      }, 1000);
      
    } catch (err) {
      console.error("Error accessing microphone:", err);
      setPermissionState('denied');
      alert("Could not access microphone. Please check permissions.");
    }
  };

  // Stop recording and process audio - for manual recording mode
  const stopRecording = async () => {
    if (!mediaRecorderRef.current) return;
    
    mediaRecorderRef.current.stop();
    setIsRecording(false);
    
    // Clear timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    // Stop all audio tracks
    mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    
    // Wait for final data and process
    mediaRecorderRef.current.onstop = async () => {
      try {
        setIsTranscribing(true);
        
        // Create audio blob and form data
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/mp3' });
        const formData = new FormData();
        formData.append('file', audioBlob, 'recording.mp3');
        formData.append('language', 'en');
        formData.append('beam_size', '5');
        
        // Use dynamic API endpoint
        const transcribeUrl = `${apiEndpoint}/transcribe`;
        console.log(`Sending transcription request to: ${transcribeUrl}`);
        
        // Send to transcription API
        const response = await fetch(transcribeUrl, {
          method: 'POST',
          body: formData,
        });
        
        if (!response.ok) {
          throw new Error(`Transcription failed: ${response.statusText}`);
        }
        
        const result = await response.json();
        
        // Append transcribed text to current input
        if (result?.transcription?.text) {
          const transcribedText = result.transcription.text.trim();
          const newText = input ? `${input} ${transcribedText}` : transcribedText;
          setInput(newText);
          // Focus and resize textarea after appending text
          setTimeout(() => {
            if (textareaRef.current) {
              textareaRef.current.style.height = 'auto';
              textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
              textareaRef.current.focus();
            }
          }, 0);
        }
      } catch (err) {
        console.error("Error transcribing audio:", err);
        alert("Failed to transcribe audio. Please try again.");
      } finally {
        setIsTranscribing(false);
      }
    };
  };

  // Modified version of stopRecording that automatically sends the message
  const stopRecordingAndSend = async () => {
    if (!mediaRecorderRef.current) return;
    
    mediaRecorderRef.current.stop();
    setIsRecording(false);
    
    // Clear timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    // Stop all audio tracks
    mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    
    // Store a reference to whether this was a keyboard-triggered recording
    const wasKeyboardRecording = isKeyboardRecording;
    
    // Wait for final data and process
    mediaRecorderRef.current.onstop = async () => {
      try {
        setIsTranscribing(true);
        
        // Create audio blob and form data
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/mp3' });
        const formData = new FormData();
        formData.append('file', audioBlob, 'recording.mp3');
        formData.append('language', 'en');
        formData.append('beam_size', '5');
        
        // Use dynamic API endpoint
        const transcribeUrl = `${apiEndpoint}/transcribe`;
        console.log(`Sending transcription request to: ${transcribeUrl}`);
        
        // Send to transcription API
        const response = await fetch(transcribeUrl, {
          method: 'POST',
          body: formData,
        });
        
        if (!response.ok) {
          throw new Error(`Transcription failed: ${response.statusText}`);
        }
        
        const result = await response.json();
        
        // Append transcribed text to current input and then send if this was triggered by keyboard
        if (result?.transcription?.text) {
          const transcribedText = result.transcription.text.trim();
          
          if (wasKeyboardRecording) {
            // For keyboard recording, set input and automatically send
            const newText = input ? `${input} ${transcribedText}` : transcribedText;
            setInput(newText);
            
            // Send the message after setting the input
            // We need to use setTimeout to ensure React has updated the state
            setTimeout(() => {
              if (newText.trim()) {
                console.log('Auto-sending message after keyboard recording');
                handleSend(); // Use original handleSend to avoid height reset before sending
              }
            }, 100);
          } else {
            // For manual recording, just set the input without sending
            const newText = input ? `${input} ${transcribedText}` : transcribedText;
            setInput(newText);
            // Focus and resize textarea after appending text
            setTimeout(() => {
              if (textareaRef.current) {
                textareaRef.current.style.height = 'auto';
                textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
                textareaRef.current.focus();
              }
            }, 0);
          }
        }
      } catch (err) {
        console.error("Error transcribing audio:", err);
        alert("Failed to transcribe audio. Please try again.");
      } finally {
        setIsTranscribing(false);
        setIsKeyboardRecording(false);
      }
    };
  };

  // Toggle recording
  const toggleRecording = () => {
    if (isRecording) {
      // Always use stopRecording for manual recording
      stopRecording();
    } else {
      startRecording();
    }
  };

  // Wrap the document upload function to show loading state
  const handleDocUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!onTemporaryDocUpload || !event.target.files || event.target.files.length === 0) return;
    
    setIsUploadingDocs(true);
    try {
      await onTemporaryDocUpload(event);
    } finally {
      setIsUploadingDocs(false);
    }
  };

  // Fix: Modify shouldDisableSend to work properly
  const shouldDisableSend = () => {
    // The button should only be disabled if:
    // 1. We're currently recording audio
    // 2. OR we're currently transcribing audio
    // 3. OR the input is empty (no text to send)
    // 4. OR the external isDisabled prop is true and we're not editing text
    
    const hasInputText = input.trim().length > 0;
    return isRecording || (isDisabled && !hasInputText);
  };

  // Add effect to reset textarea height when input is cleared
  useEffect(() => {
    if (!input && textareaRef.current) {
      // Reset height when input is empty (after sending)
      textareaRef.current.style.height = 'auto';
    }
  }, [input]);

  // Create a modified handleSend function that resets the textarea height
  const handleSendWithReset = () => {
    handleSend();
    setInput('');
    // Clear tool selection after sending
    onToolSelect?.(null);
  };

  // Update local state when parent state changes
  useEffect(() => {
    // Just ensure tools are valid, no need to check selectedTool anymore
    if (tools.length === 0) {
      onToolSelect?.(null);
    }
  }, [tools]);

  // Handle keyboard recording (Ctrl key)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only trigger if Ctrl key is pressed and we're not already recording
      if (e.key === 'Control' && !isRecording && !isTranscribing && !isKeyboardRecording && !isProcessing) {
        console.log('Ctrl key pressed, starting keyboard recording');
        e.preventDefault();
        setIsKeyboardRecording(true);
        startRecording();
      }
    };
    
    const handleKeyUp = async (e: KeyboardEvent) => {
      // Only react to Ctrl key release if we're in a keyboard recording session
      if (e.key === 'Control' && isKeyboardRecording && isRecording) {
        console.log('Ctrl key released, stopping keyboard recording');
        e.preventDefault();
        setIsKeyboardRecording(false);
        
        // Stop recording and send automatically
        if (mediaRecorderRef.current) {
          await stopRecordingAndSend();
        }
      }
    };
    
    // Add event listeners
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    // Clean up
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isRecording, isTranscribing, isKeyboardRecording, isProcessing, handleSend]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Set structured tool calling ON by default
  useEffect(() => {
    if (showToolDropdown && !useStructuredToolCalling && onToggleStructuredToolCalling) {
      onToggleStructuredToolCalling();
    }
    // eslint-disable-next-line
  }, [showToolDropdown]);

  return (
    <div className="border-t dark:border-gray-800 bg-transparent transition-colors duration-100">
      <div className="max-w-4xl mx-auto">
        <div className="p-6 flex justify-center">
          <div className="max-w-3xl w-full">
            {/* Main Input Container */}
            <div className="glassmorphic rounded-xl p-4 bg-white/60 dark:bg-gray-900/40 backdrop-blur-md shadow-lg">
              {/* Images Preview */}
              {images.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {images.map((image) => (
                    <div 
                      key={image.id} 
                      className="relative group w-16 h-16 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700"
                    >
                      <img 
                        src={image.preview} 
                        alt="Uploaded" 
                        className="w-full h-full object-cover"
                      />
                      <button
                        onClick={() => onRemoveImage(image.id)}
                        className="absolute top-1 right-1 p-1 rounded-full bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Temporary Documents Preview */}
              {temporaryDocs.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4 p-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                  {temporaryDocs.map((doc) => (
                    <div 
                      key={doc.id} 
                      className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
                    >
                      <File className="w-4 h-4 text-gray-500" />
                      <span className="text-sm text-gray-700 dark:text-gray-300">{doc.name}</span>
                      <button
                        onClick={() => onRemoveTemporaryDoc?.(doc.id)}
                        className="p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full"
                      >
                        <X className="w-3 h-3 text-red-500" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Document Upload Loading Indicator */}
              {isUploadingDocs && (
                <div className="flex items-center gap-2 mb-4 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-blue-600 dark:text-blue-400">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm font-medium">Uploading document(s)...</span>
                </div>
              )}

              {/* Recording Indicator - modified to show keyboard recording */}
              {isRecording && (
                <div className="flex items-center gap-2 mb-2 py-1 px-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg">
                  <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                  <span className="text-sm font-medium">
                    {isKeyboardRecording ? "Release Ctrl to send" : `Recording: ${formatTime(recordingTime)}`}
                  </span>
                </div>
              )}

              {/* Input Field */}
              <div className="mb-4">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    e.target.style.height = 'auto';
                    e.target.style.height = `${e.target.scrollHeight}px`;
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask me anything..."
                  className="w-full bg-transparent border-0 outline-none focus:outline-none focus:ring-0 resize-none text-gray-700 dark:text-gray-300 placeholder-gray-400 dark:placeholder-gray-500"
                  style={{
                    height: 'auto',
                    minHeight: '24px',
                    maxHeight: '250px',
                    overflowY: 'auto'
                  }}
                  disabled={isProcessing && !input}
                />
              </div>

              {/* Bottom Actions */}
              <div className="flex justify-between items-center">
                {/* Left Side Actions */}
                <div className="flex items-center gap-2">
                  {/* Hide the New Chat button by adding the hidden class */}
                  <button
                    onClick={onNewChat}
                    className="hidden group p-2 rounded-lg hover:bg-sakura-50 dark:hover:bg-sakura-100/5 text-gray-600 dark:text-gray-400 transition-colors relative"
                    title="New Chat"
                  >
                    <Plus className="w-5 h-5" />
                    <div className="absolute left-1/2 -translate-x-1/2 -top-8 px-2 py-0.5 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                      New Chat
                    </div>
                  </button>
                  <button 
                    className="group p-2 rounded-lg hover:bg-sakura-50 dark:hover:bg-sakura-100/5 text-gray-600 dark:text-gray-400 transition-colors relative"
                    onClick={handleImageClick}
                    disabled={isProcessing}
                    title="Add Image"
                  >
                    <ImageIcon className="w-5 h-5" />
                    <div className="absolute left-1/2 -translate-x-1/2 -top-8 px-2 py-0.5 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                      Add Image
                    </div>
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={onImageUpload}
                    className="hidden"
                  />
                  <button
                    onClick={() => tempDocInputRef.current?.click()}
                    disabled={isUploadingDocs}
                    className={`group p-2 rounded-lg transition-colors relative
                      ${isUploadingDocs 
                        ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-wait' 
                        : 'hover:bg-sakura-50 dark:hover:bg-sakura-100/5 text-gray-600 dark:text-gray-400'
                      }`}
                    title={isUploadingDocs ? "Uploading..." : "Add Temporary Document"}
                  >
                    {isUploadingDocs ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <File className="w-5 h-5" />
                    )}
                    <div className="absolute left-1/2 -translate-x-1/2 -top-8 px-2 py-0.5 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                      {isUploadingDocs ? "Uploading..." : "Add Document"}
                    </div>
                  </button>
                  <input
                    ref={tempDocInputRef}
                    type="file"
                    accept=".pdf,.txt,.md,.csv"
                    multiple
                    onChange={handleDocUpload}
                    disabled={isUploadingDocs}
                    className="hidden"
                  />
                  {/* Tool Icon Button */}
                  {tools.length > 0 && (
                    <div className="relative group">
                      <button
                        className={`p-2 rounded-lg hover:bg-sakura-50 dark:hover:bg-sakura-100/5 text-gray-600 dark:text-gray-400 transition-colors ${useAllTools ? 'bg-indigo-100 dark:bg-indigo-900/50' : ''}`}
                        title="Select Tool"
                        onClick={() => {
                          setShowToolDropdown((prev) => !prev);
                        }}
                      >
                        <Wrench className="w-5 h-5" />
                        <span className="absolute left-1/2 -translate-x-1/2 -top-8 px-2 py-0.5 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                          Select Tool
                        </span>
                      </button>
                      {/* Tool Dropdown (opens upwards) */}
                      {showToolDropdown && (
                        <div className="absolute left-0 bottom-12 w-52 rounded-xl z-20 shadow-xl border border-white/5 dark:border-white/5 bg-white/70 dark:bg-gray-900/60 backdrop-blur-md flex flex-col overflow-hidden">
                          {/* Structured Tool Calling Toggle Icon (inside dropdown) */}
                          {onToggleStructuredToolCalling && (
                            <button
                              onClick={onToggleStructuredToolCalling}
                              className={`flex items-center gap-2 px-4 py-2 text-sm rounded-none hover:bg-white/30 dark:hover:bg-gray-800/40 text-gray-800 dark:text-gray-200 transition-colors ${useStructuredToolCalling ? 'bg-blue-100/60 dark:bg-blue-900/40' : ''}`}
                              style={{backdropFilter: 'blur(8px)'}}
                              title="Toggle structured tool calling for Ollama models"
                            >
                              <Code className="w-4 h-4" />
                              <span>Structured Tool Calling</span>
                              {useStructuredToolCalling && (
                                <Check className="w-3 h-3 text-blue-500" />
                              )}
                            </button>
                          )}
                          <button
                            className={`block w-full text-left px-4 py-2 text-sm hover:bg-white/30 dark:hover:bg-gray-800/40 text-gray-800 dark:text-gray-200 ${!useAllTools ? 'font-bold' : ''}`}
                            style={{backdropFilter: 'blur(8px)'}}
                            onClick={() => {
                              onToolSelect?.(null);
                              onUseAllToolsChange?.(false);
                              setShowToolDropdown(false);
                            }}
                          >
                            No Tool
                          </button>
                          <button
                            className={`block w-full text-left px-4 py-2 text-sm hover:bg-white/30 dark:hover:bg-gray-800/40 text-gray-800 dark:text-gray-200 ${useAllTools ? 'font-bold' : ''}`}
                            style={{backdropFilter: 'blur(8px)'}}
                            onClick={() => {
                              onToolSelect?.(null);
                              onUseAllToolsChange?.(true);
                              setShowToolDropdown(false);
                            }}
                          >
                            All Tools
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                  {/* RAG Toggle Icon */}
                  {onToggleRag && (
                    <button
                      onClick={() => onToggleRag(!ragEnabled)}
                      className={`p-2 rounded-lg hover:bg-sakura-50 dark:hover:bg-sakura-100/5 text-gray-600 dark:text-gray-400 transition-colors ${ragEnabled ? 'bg-green-100 dark:bg-green-900/50' : ''}`}
                      title={ragEnabled ? 'RAG Enabled' : 'RAG Disabled'}
                    >
                      <Database className="w-5 h-5" />
                      {ragEnabled && (
                        <Check className="w-3 h-3 absolute top-1 right-1 text-green-500" />
                      )}
                    </button>
                  )}
                  {/* Voice Recording Button - with additional hint text */}
                  <button
                    onClick={toggleRecording}
                    disabled={isTranscribing || isProcessing}
                    className={`group p-2 rounded-lg transition-colors relative ${
                      isRecording
                        ? 'bg-red-500 text-white hover:bg-red-600'
                        : isTranscribing
                        ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-wait'
                        : 'hover:bg-sakura-50 dark:hover:bg-sakura-100/5 text-gray-600 dark:text-gray-400'
                    }`}
                    title={isRecording ? "Stop Recording" : "Start Voice Recording (or hold Ctrl key)"}
                  >
                    {isRecording ? (
                      <StopCircle className="w-5 h-5" />
                    ) : isTranscribing ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Mic className="w-5 h-5" />
                    )}
                    <div className="absolute left-1/2 -translate-x-1/2 -top-8 px-2 py-0.5 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                      {isRecording ? "Stop Recording" : isTranscribing ? "Transcribing..." : "Voice Input (hold Ctrl)"}
                    </div>
                  </button>
                  {/* Model Config Button */}
                  {models.length > 0 && typeof onModelConfigSave === 'function' && (
                    <button
                      onClick={() => setShowModelConfig(true)}
                      className="group p-2 rounded-lg hover:bg-sakura-50 dark:hover:bg-sakura-100/5 text-gray-600 dark:text-gray-400 transition-colors relative"
                      title="Model Configuration"
                    >
                      <Settings className="w-5 h-5" />
                      <div className="absolute left-1/2 -translate-x-1/2 -top-8 px-2 py-0.5 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                        Model Configuration
                      </div>
                    </button>
                  )}
                </div>

                {/* Right Side Actions */}
                <div className="flex items-center gap-2">
                  {/* Show indicator when using temporary docs */}
                  {temporaryDocs && temporaryDocs.length > 0 && (
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-sakura-500 text-white rounded-lg">
                      <Database className="w-4 h-4" />
                      <span className="text-sm">Using {temporaryDocs.length} Docs</span>
                      <button 
                        className="ml-1 p-1 rounded-full hover:bg-sakura-600 transition-colors"
                        title="Document context will be added to your query"
                      >
                        <AlertCircle className="w-3 h-3" />
                      </button>
                    </div>
                  )}

                  {/* Model Selection - Only show in manual mode */}
                  {modelConfig.mode === 'manual' && models.length > 0 && (
                    <div className="relative">
                      <button
                        onClick={() => setShowModelSelect(!showModelSelect)}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm bg-white/50 dark:bg-gray-800/50 hover:bg-white/70 dark:hover:bg-gray-800/70 transition-colors"
                      >
                        <Bot className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                        <span className="text-gray-700 dark:text-gray-300">{selectedModel || 'Select Model'}</span>
                        <ChevronDown className="w-4 h-4 text-gray-500" />
                      </button>

                      {showModelSelect && (
                        <div className="absolute bottom-full right-0 mb-2 w-48 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg">
                          {models.map((model) => (
                            <button
                              key={model.name}
                              onClick={() => {
                                onModelSelect?.(model.name);
                                setShowModelSelect(false);
                              }}
                              className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 ${
                                selectedModel === model.name ? 'bg-sakura-50 dark:bg-sakura-900/20' : ''
                              }`}
                            >
                              {model.name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Mode Selection */}
                  <div className="relative">
                    <button
                      onClick={() => setShowModeSelect(!showModeSelect)}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm bg-white/50 dark:bg-gray-800/50 hover:bg-white/70 dark:hover:bg-gray-800/70 transition-colors"
                    >
                      {modelConfig.mode === 'auto' ? (
                        <>
                          <Zap className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                          <span className="text-gray-700 dark:text-gray-300">Auto</span>
                        </>
                      ) : (
                        <>
                          <Hand className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                          <span className="text-gray-700 dark:text-gray-300">Manual</span>
                        </>
                      )}
                      <ChevronDown className="w-4 h-4 text-gray-500" />
                    </button>

                    {showModeSelect && (
                      <div className="absolute bottom-full right-0 mb-2 w-48 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg">
                        <button
                          onClick={() => {
                            onModelConfigSave({ ...modelConfig, mode: 'auto' });
                            setShowModeSelect(false);
                          }}
                          className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 ${
                            modelConfig.mode === 'auto' ? 'bg-sakura-50 dark:bg-sakura-900/20 text-sakura-600 dark:text-sakura-300' : 'text-gray-700 dark:text-gray-300'
                          }`}
                        >
                          <Zap className="w-4 h-4" />
                          Auto Mode
                        </button>
                        <button
                          onClick={() => {
                            onModelConfigSave({ ...modelConfig, mode: 'manual' });
                            setShowModeSelect(false);
                          }}
                          className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 ${
                            modelConfig.mode === 'manual' ? 'bg-sakura-50 dark:bg-sakura-900/20 text-sakura-600 dark:text-sakura-300' : 'text-gray-700 dark:text-gray-300'
                          }`}
                        >
                          <Hand className="w-4 h-4" />
                          Manual Mode
                        </button>
                      </div>
                    )}
                  </div>

                  {isProcessing ? (
                    <button
                      onClick={handleStopStreaming}
                      className="p-2 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors flex items-center gap-1 group relative"
                      title="Stop generating"
                    >
                      <Square className="w-4 h-4" fill="white" />
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <div className="absolute right-1/2 translate-x-1/2 -top-8 px-2 py-0.5 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                        Stop Generating
                      </div>
                    </button>
                  ) : (
                    <button
                      onClick={handleSendWithReset}
                      disabled={!input.trim() || isRecording || isTranscribing || isUploadingDocs}
                      className="p-2 rounded-lg bg-sakura-500 text-white hover:bg-sakura-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors group relative"
                      title="Send Message"
                    >
                      <Send className="w-5 h-5" />
                      <div className="absolute right-1/2 translate-x-1/2 -top-8 px-2 py-0.5 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                        Send Message
                      </div>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Model Config Modal */}
        {showModelConfig && (
          <ModelConfigModal
            isOpen={showModelConfig}
            onClose={() => setShowModelConfig(false)}
            models={models}
            currentConfig={modelConfig as ModelSelectionConfig}
            onSave={(config) => {
              if (typeof onModelConfigSave === 'function') {
                onModelConfigSave(config as ModelSelectionConfig);
              }
              setShowModelConfig(false);
            }}
          />
        )}
      </div>
    </div>
  );
};

export default ChatInput;