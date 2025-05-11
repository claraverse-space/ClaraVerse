import React, { useState, useRef, useEffect, useMemo, forwardRef } from 'react';
import { Image as ImageIcon,  StopCircle, Database, Send,  Mic, Loader2, Plus, X, Square, File, AlertCircle, Wrench, Code, Check, Settings, Bot, ChevronDown, Zap, Hand, Bolt, ShieldAlert, Paperclip } from 'lucide-react';
// @ts-ignore
import api from '../../services/api'; // Import the API service
import type { Tool } from '../../db';
import ModelConfigModal from './ModelConfigModal';
import { readPdfContent } from '../../utils/documentUtils';
import { useInterpreter } from '../../contexts/InterpreterContext';
import { FileInfo } from '../../utils/InterpreterClient';

interface ModelConfig {
  visionModel: string;
  toolModel: string;
  ragModel: string;
}

interface ModelSelectionConfig extends ModelConfig {
  mode: 'auto' | 'manual' | 'smart';
}

interface ChatInputProps {
  input?: string;
  setInput?: (value: string) => void;
  handleSend?: () => void;
  handleKeyDown?: (e: React.KeyboardEvent) => void;
  isDisabled?: boolean;
  isProcessing?: boolean;
  onNewChat?: () => void;
  onImageUpload?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  images?: any[];
  onRemoveImage?: (index: number) => void;
  handleStopStreaming?: () => void;
  ragEnabled?: boolean;
  onToggleRag?: (enabled: boolean) => void;
  onTemporaryDocUpload?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  temporaryDocs?: any[];
  onRemoveTemporaryDoc?: (id: string) => void;
  tools?: any[];
  onToolSelect?: (tool: any) => void;
  useAllTools?: boolean;
  onUseAllToolsChange?: (useAll: boolean) => void;
  models?: any[];
  modelConfig?: any;
  onModelConfigSave?: (config: any) => void;
  onModelSelect?: (model: string) => void;
  useStructuredToolCalling?: boolean;
  onToggleStructuredToolCalling?: () => void;
  selectedModel?: string;
}

const defaultModelConfig: ModelConfig = {
  visionModel: '',
  toolModel: '',
  ragModel: ''
};

// Add AI Glow CSS (for demo, ideally move to a CSS file)
const aiGlowStyle = `
@keyframes ai-glow {
  0% { box-shadow: 0 0 0 0 rgba(99,102,241,0.7), 0 0 0 0 rgba(236,72,153,0.5); }
  50% { box-shadow: 0 0 32px 12px rgba(99,102,241,0.7), 0 0 64px 24px rgba(236,72,153,0.3); }
  100% { box-shadow: 0 0 0 0 rgba(99,102,241,0.7), 0 0 0 0 rgba(236,72,153,0.5); }
}
.ai-glow-box {
  animation: ai-glow 2.5s ease-in-out;
  z-index: 10;
  position: relative;
}
.code-interpreter-popup {
  position: absolute;
  left: 50%;
  top: 0;
  transform: translate(-50%, -70%);
  background: linear-gradient(90deg, #6366f1 0%, #ec4899 100%);
  color: white;
  padding: 1.25rem 2rem;
  border-radius: 1rem;
  box-shadow: 0 8px 32px 0 rgba(99,102,241,0.25), 0 2px 8px 0 rgba(236,72,153,0.15);
  font-size: 1.1rem;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  z-index: 50;
  pointer-events: none;
  opacity: 0.98;
  animation: fadeInOut 2.5s;
}
@keyframes fadeInOut {
  0% { opacity: 0; transform: translate(-50%, -90%) scale(0.95); }
  10% { opacity: 1; transform: translate(-50%, -70%) scale(1.02); }
  90% { opacity: 1; transform: translate(-50%, -70%) scale(1.02); }
  100% { opacity: 0; transform: translate(-50%, -90%) scale(0.95); }
}
`;

const ChatInput = forwardRef<any, ChatInputProps>((props, ref) => {
  const {
    input = '',
    setInput = () => {},
    handleSend = () => {},
    handleKeyDown = () => {},
    isDisabled = false,
    isProcessing = false,
    onNewChat,
    onImageUpload,
    images = [],
    onRemoveImage = () => {},
    handleStopStreaming = () => {},
    ragEnabled = false,
    onToggleRag,
    onTemporaryDocUpload,
    temporaryDocs = [],
    onRemoveTemporaryDoc = () => {},
    tools = [],
    onToolSelect = () => {},
    useAllTools = false,
    onUseAllToolsChange = () => {},
    models = [],
    modelConfig = {},
    onModelConfigSave = () => {},
    onModelSelect = () => {},
    useStructuredToolCalling = false,
    onToggleStructuredToolCalling,
    selectedModel = ''
  } = props;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const tempDocInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  // Voice recording states
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [wasKeyboardRecording, setWasKeyboardRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Add state for API endpoint
  const [apiEndpoint, setApiEndpoint] = useState<string>('');
  
  // Add state for document upload loading
  const [isUploadingDocs, setIsUploadingDocs] = useState(false);

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

  // Notice for manual mode
  const [showManualNotice, setShowManualNotice] = useState(false);
  const prevMode = useRef(modelConfig.mode);

  // Add AI Glow CSS (for demo, ideally move to a CSS file)
  const { isInterpreterMode, setInterpreterMode, sendMessage, isExecuting, interpreterClient } = useInterpreter();
  const [aiGlow, setAiGlow] = useState(false);
  const [showCodeInterpreterPopup, setShowCodeInterpreterPopup] = useState(false);

  const interpreterFileInputRef = useRef<HTMLInputElement>(null);
  const [interpreterFiles, setInterpreterFiles] = useState<Array<{id: string; name: string; path: string}>>([]);
  
  // Add state for selected files from file manager
  const [selectedManagerFiles, setSelectedManagerFiles] = useState<Array<{id: string; name: string; path: string}>>([]);

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
      // Process each file
      for (const file of event.target.files) {
        if (file.type === 'application/pdf') {
          try {
            // Extract text content from PDF
            const pdfContent = await readPdfContent(file);
            
            // Create a new text file using the global File constructor
            const textFile = new window.File(
              [pdfContent],
              file.name.replace('.pdf', '.txt'),
              { type: 'text/plain', lastModified: Date.now() }
            );
            
            // Create a synthetic event with the text file
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(textFile);
            
            // Create a custom event that matches React's event type
            const customEvent = {
              target: {
                files: dataTransfer.files
              },
              preventDefault: () => {},
              stopPropagation: () => {}
            } as React.ChangeEvent<HTMLInputElement>;
            
            // Pass the processed file to the original upload handler
            await onTemporaryDocUpload(customEvent);
          } catch (pdfError) {
            console.error('Error processing PDF:', pdfError);
            // If PDF processing fails, try to upload the original file
            await onTemporaryDocUpload(event);
          }
        } else {
          // For non-PDF files, use the original upload handler directly
          await onTemporaryDocUpload(event);
        }
      }
    } catch (error) {
      console.error('Error processing document:', error);
      alert('Failed to process document. Please try again.');
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

  // Set structured tool calling ON by default on component mount
  useEffect(() => {
    if (!useStructuredToolCalling && onToggleStructuredToolCalling) {
      onToggleStructuredToolCalling();
    }
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    if (modelConfig.mode === 'manual' && prevMode.current !== 'manual') {
      setShowManualNotice(true);
      setTimeout(() => setShowManualNotice(false), 3000);
    }
    prevMode.current = modelConfig.mode;
  }, [modelConfig.mode]);

  // Handler for Code Interpreter button
  const handleCodeInterpreterClick = () => {
    if (!isInterpreterMode) {
      setAiGlow(true);
      setShowCodeInterpreterPopup(true);
      setTimeout(() => setAiGlow(false), 2500);
      setTimeout(() => setShowCodeInterpreterPopup(false), 2500);
    }
    setInterpreterMode(!isInterpreterMode);
  };

  // Expose handleFileSelect through ref
  useEffect(() => {
    if (ref) {
      (ref as any).current = {
        handleFileSelect: (file: FileInfo) => {
          const fileToAdd = {
            id: file.id,
            name: file.name,
            path: `/clara_uploads/${file.name}`
          };
          // Check if file is already selected
          const isAlreadySelected = selectedManagerFiles.some(f => f.id === file.id);
          if (!isAlreadySelected) {
            const newSelected = [...selectedManagerFiles, fileToAdd];
            setSelectedManagerFiles(newSelected);

            // Build the new input value with all selected file paths at the top
            const filePaths = newSelected.map(f => f.path).join('\n');
            // Extract the user's message (after the first blank line, if any)
            const userMessage = input.split('\n\n').slice(1).join('\n\n');
            const newInput = `${filePaths}\n\n${userMessage}`.trim();
            console.log('handleFileSelect called, new input:', newInput);
            setInput(newInput);
          }
        },
        selectedManagerFiles
      };
    }
  }, [ref, selectedManagerFiles, setInput, input]);

  // Add function to remove selected file and update input
  const handleRemoveSelectedFile = (id: string) => {
    const newSelected = selectedManagerFiles.filter(file => file.id !== id);
    setSelectedManagerFiles(newSelected);

    // Build the new input value with remaining file paths at the top
    const filePaths = newSelected.map(f => f.path).join('\n');
    // Extract the user's message (after the first blank line, if any)
    const userMessage = input.split('\n\n').slice(1).join('\n\n');
    setInput(filePaths ? `${filePaths}\n\n${userMessage}`.trim() : userMessage.trim());
  };

  // Modify handleSendWithMode to always inject file paths at send time
  const handleSendWithMode = () => {
    if (isInterpreterMode) {
      let messageToSend = input;
      if (selectedManagerFiles.length > 0) {
        const filePaths = selectedManagerFiles.map(file => file.path).join('\n');
        messageToSend = `${filePaths}\n\n${input}`;
      }
      sendMessage(messageToSend);
      setInput('');
      setSelectedManagerFiles([]);
      setInterpreterFiles([]);
    } else {
      handleSendWithReset();
    }
  };

  // Modify handleKeyDownWithMode similarly
  const handleKeyDownWithMode = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (isInterpreterMode) {
        let messageToSend = input;
        const allFiles = [...interpreterFiles, ...selectedManagerFiles];
        if (allFiles.length > 0) {
          const filePaths = allFiles.map(file => file.path).join('\n');
          messageToSend = `${filePaths}\n\n${messageToSend}`;
        }
        sendMessage(messageToSend);
        setInput('');
        // Clear selected files after sending
        setSelectedManagerFiles([]);
        setInterpreterFiles([]);
      } else {
        handleKeyDown(e);
      }
    }
  };

  // Add effect to clear selected files when leaving interpreter mode
  useEffect(() => {
    if (!isInterpreterMode) {
      setSelectedManagerFiles([]);
    }
  }, [isInterpreterMode]);

  // Add new function to handle interpreter file uploads
  const handleInterpreterFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0 || !interpreterClient) return;
    
    try {
      const file = event.target.files[0];
      const uploadResult = await interpreterClient.uploadFile(file);
      
      setInterpreterFiles(prev => [...prev, {
        id: uploadResult.id,
        name: uploadResult.name,
        path: `/clara_uploads/${uploadResult.name}` // Set the actual path in Clara uploads directory
      }]);
      
      // Just show a simple notification of upload success
      const fileInfo = `File uploaded: ${uploadResult.name} (${formatFileSize(uploadResult.size)})`;
      setInput(input ? `${input}\n${fileInfo}` : fileInfo);
      
      // Focus and resize textarea after appending text
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto';
          textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
          textareaRef.current.focus();
        }
      }, 0);
    } catch (error) {
      console.error('Error uploading file:', error);
      alert('Failed to upload file. Please try again.');
    }
  };

  // Helper function to format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    else if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    else if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    else return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
  };

  // Add function to remove interpreter files
  const handleRemoveInterpreterFile = (id: string) => {
    setInterpreterFiles(prev => prev.filter(file => file.id !== id));
  };

  return (
    <>
      <style>{aiGlowStyle}</style>
      <div className="relative dark:border-gray-800 bg-transparent bg-opacity-80 dark:bg-opacity-80  transition-colors duration-100 z-10">
        <div className="max-w-4xl mx-auto">
          {/* Manual mode notice */}
          {showManualNotice && (
            <div className="mb-2 max-w-3xl mx-auto px-4 py-2 rounded-lg bg-red-100 text-red-700 text-center font-medium shadow-md animate-fade-in-out">
              Manual Mode turned on – Auto Mode is preferred for best results.
            </div>
          )}
          <div className="p-6 flex justify-center">
            <div className="max-w-3xl w-full relative">
              {/* Main Input Container */}
              <div className={`glassmorphic rounded-xl p-4 bg-white/60 dark:bg-gray-900/40 backdrop-blur-md shadow-lg transition-all duration-300${aiGlow ? ' ai-glow-box' : ''}`}>
                {/* Code Interpreter Popup */}
                {showCodeInterpreterPopup && (
                  <div className="code-interpreter-popup">
                    <ShieldAlert className="w-6 h-6 text-white drop-shadow" />
                    <div>
                      Clara is now in <span className="font-bold underline">Code Interpreter</span> mode.<br />
                      <span className="text-xs font-normal opacity-90">It can execute code on your PC.</span>
                    </div>
                  </div>
                )}
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
                      Recording: {formatTime(recordingTime)}
                    </span>
                  </div>
                )}

                {/* Add Interpreter Files Preview - Modified to show both types of files */}
                {isInterpreterMode && (interpreterFiles.length > 0 || selectedManagerFiles.length > 0) && (
                  <div className="flex flex-wrap gap-2 mb-4 p-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                    {interpreterFiles.map((file) => (
                      <div 
                        key={file.id} 
                        className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
                      >
                        <File className="w-4 h-4 text-gray-500" />
                        <span className="text-sm text-gray-700 dark:text-gray-300">{file.name}</span>
                        <button
                          onClick={() => handleRemoveInterpreterFile(file.id)}
                          className="p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full"
                        >
                          <X className="w-3 h-3 text-red-500" />
                        </button>
                      </div>
                    ))}
                    {selectedManagerFiles.map((file) => (
                      <div 
                        key={file.id} 
                        className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-gray-800 rounded-lg border border-sakura-200 dark:border-sakura-700"
                      >
                        <Database className="w-4 h-4 text-sakura-500" />
                        <span className="text-sm text-gray-700 dark:text-gray-300">{file.name}</span>
                        <button
                          onClick={() => handleRemoveSelectedFile(file.id)}
                          className="p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full"
                        >
                          <X className="w-3 h-3 text-red-500" />
                        </button>
                      </div>
                    ))}
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
                    onKeyDown={handleKeyDownWithMode}
                    placeholder={isInterpreterMode ? "What should i do..." : "Ask me anything..."}
                    className={`w-full border-0 outline-none focus:outline-none focus:ring-0 resize-none font-${isInterpreterMode ? 'mono' : 'sans'}${aiGlow ? ' ai-glow' : ''} ${
                      isInterpreterMode 
                        ? 'bg-transparent text-gray-700 dark:text-gray-300 placeholder-gray-400 dark:placeholder-gray-500' 
                        : 'bg-transparent text-gray-700 dark:text-gray-300 placeholder-gray-400 dark:placeholder-gray-500'
                    }`}
                    style={{
                      height: 'auto',
                      minHeight: '24px',
                      maxHeight: '250px',
                      overflowY: 'auto',
                      padding: isInterpreterMode ? '8px' : '0',
                      borderRadius: isInterpreterMode ? '4px' : '0'
                    }}
                    disabled={isInterpreterMode ? isExecuting : (isProcessing && !input)}
                  />
                </div>

                {/* Bottom Actions */}
                <div className="flex justify-between items-center">
                  {/* Left Side Actions */}
                  <div className="flex items-center gap-2">
                    {/* New Chat button - Only visible in interpreter mode */}
                    {isInterpreterMode && (
                      <button
                        onClick={async () => {
                          // Clear conversation history
                          if (interpreterClient) {
                            interpreterClient.clearConversation();
                          }
                          // Clear input and files
                          setInput('');
                          setSelectedManagerFiles([]);
                          setInterpreterFiles([]);
                          
                          // Restart the interpreter container
                          try {
                            console.log('Attempting to restart interpreter container...');
                            // Use type assertion to work around TypeScript error
                            if (window.electron && 'restartInterpreterContainer' in window.electron) {
                              const electronWithRestart = window.electron as unknown as { 
                                restartInterpreterContainer: () => Promise<{ success: boolean; error?: string }> 
                              };
                              
                              const result = await electronWithRestart.restartInterpreterContainer();
                              if (result.success) {
                                console.log('Interpreter container restarted successfully');
                                // Show success message to user
                                alert('Interpreter restarted successfully. Please start a new conversation.');
                              } else {
                                console.error('Failed to restart interpreter container:', result.error);
                                alert(`Failed to restart interpreter: ${result.error || 'Unknown error'}`);
                              }
                            } else {
                              console.error('restartInterpreterContainer function not available from Electron');
                              alert('Could not restart interpreter - function not available. Please restart Clara.');
                            }
                          } catch (error) {
                            console.error('Error restarting interpreter container:', error);
                            alert('Error restarting interpreter. Please restart Clara manually.');
                          }
                        }}
                        className="group p-2 rounded-lg hover:bg-sakura-50 dark:hover:bg-sakura-100/5 text-gray-600 dark:text-gray-400 transition-colors relative"
                        title="New Chat"
                      >
                        <Plus className="w-5 h-5" />
                        <div className="absolute left-1/2 -translate-x-1/2 -top-8 px-2 py-0.5 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                          New Chat
                        </div>
                      </button>
                    )}
                    
                    {/* Hide the New Chat button in non-interpreter mode */}
                    {!isInterpreterMode && (
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
                    )}
                    
                    {!isInterpreterMode && (
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
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={onImageUpload}
                      className="hidden"
                    />
                    {/* Document Upload Button - Only visible in non-interpreter mode */}
                    {!isInterpreterMode && (
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
                    )}
                    <input
                      ref={tempDocInputRef}
                      type="file"
                      accept=".pdf,.txt,.md,.csv"
                      multiple
                      onChange={handleDocUpload}
                      disabled={isUploadingDocs}
                      className="hidden"
                    />
                    {/* Tool Icon Button - Only visible when Code Interpreter is disabled */}
                    {!isInterpreterMode && tools.length > 0 && (
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
                    {/* Code Interpreter Icon Button - Always visible */}
                    <button
                      className={`group p-2 rounded-lg transition-colors relative ${isInterpreterMode ? 'bg-indigo-500 dark:bg-indigo-700 border-2 border-indigo-400 dark:border-indigo-500 shadow-md' : 'hover:bg-sakura-50 dark:hover:bg-sakura-100/5 text-gray-600 dark:text-gray-400'}`}
                      title="Code Interpreter"
                      onClick={handleCodeInterpreterClick}
                    >
                      <Zap className="w-5 h-5" color={isInterpreterMode ? 'white' : undefined} />
                      <div className="absolute left-1/2 -translate-x-1/2 -top-8 px-2 py-0.5 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                        Code Interpreter
                      </div>
                    </button>
                    {/* RAG Toggle Icon - Only visible when Code Interpreter is disabled */}
                    {!isInterpreterMode && onToggleRag && (
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
                    {/* Voice Recording Button - Only visible when Code Interpreter is disabled */}
                    {!isInterpreterMode && (
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
                        title={isRecording ? "Stop Recording" : "Start Voice Recording"}
                      >
                        {isRecording ? (
                          <StopCircle className="w-5 h-5" />
                        ) : isTranscribing ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <Mic className="w-5 h-5" />
                        )}
                        <div className="absolute left-1/2 -translate-x-1/2 -top-8 px-2 py-0.5 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                          {isRecording ? "Stop Recording" : isTranscribing ? "Transcribing..." : "Voice Input"}
                        </div>
                      </button>
                    )}
                    {/* Model Config Button - Only visible when Code Interpreter is disabled */}
                    {!isInterpreterMode && models.length > 0 && typeof onModelConfigSave === 'function' && (
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
                    {/* Add Interpreter File Upload Button - Only visible in interpreter mode */}
                    {isInterpreterMode && (
                      <>
                        <button
                          onClick={() => interpreterFileInputRef.current?.click()}
                          className="group p-2 rounded-lg hover:bg-sakura-50 dark:hover:bg-sakura-100/5 text-gray-600 dark:text-gray-400 transition-colors relative"
                          title="Attach File"
                        >
                          <Paperclip className="w-5 h-5" />
                          <div className="absolute left-1/2 -translate-x-1/2 -top-8 px-2 py-0.5 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                            Attach File
                          </div>
                        </button>
                        <input
                          ref={interpreterFileInputRef}
                          type="file"
                          onChange={handleInterpreterFileUpload}
                          className="hidden"
                        />
                      </>
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
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm bg-white/50 dark:bg-gray-800/50 hover:bg-white/70 dark:hover:bg-gray-800/70 transition-colors
                          ${modelConfig.mode === 'manual' ? 'border-2 border-red-500 shadow-[0_0_0_4px_rgba(239,68,68,0.2)] animate-pulse' : ''}`}
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

                    {/* Send Button */}
                    {isProcessing || isExecuting ? (
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
                        onClick={handleSendWithMode}
                        disabled={!input.trim() || isRecording || isTranscribing || isUploadingDocs || (isInterpreterMode && isExecuting)}
                        className="p-2 rounded-lg bg-sakura-500 text-white hover:bg-sakura-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors group relative"
                        title="Send Message"
                      >
                        <Send className="w-5 h-5" />
                        <div className="absolute right-1/2 translate-x-1/2 -top-8 px-2 py-0.5 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                          {isInterpreterMode ? 'Execute Code' : 'Send Message'}
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
    </>
  );
});

export default ChatInput;