import React, { useState, useEffect } from 'react';
import { Handle, Position } from 'reactflow';
import { useTheme } from '../../../hooks/useTheme';
import { Settings, RefreshCw, Sparkles } from 'lucide-react';
import { useOllama } from '../../../context/OllamaContext';

const ImageUploadLlmNode: React.FC<any> = ({ data, isConnectable }) => {
  const { isDark } = useTheme();
  const { baseUrl } = useOllama();
  const tool = data.tool;
  const Icon = tool.icon;
  const nodeColor = isDark ? tool.darkColor : tool.lightColor;
  
  // Store default configuration
  if (!data.config.ollamaUrl) data.config.ollamaUrl = baseUrl;
  
  const [model, setModel] = useState(data.config.model || '');
  const [staticText, setStaticText] = useState(data.config.staticText || 'Describe this image:');
  const [uploadedImage, setUploadedImage] = useState<string | null>(data.config.imageData || null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [resultText, setResultText] = useState(data.config.resultText || '');
  const [showSettings, setShowSettings] = useState(false);
  const [customUrl, setCustomUrl] = useState(data.config.ollamaUrl || baseUrl);
  
  // Node-specific states for models
  const [nodeModels, setNodeModels] = useState<any[]>([]);
  const [nodeLoading, setNodeLoading] = useState(false);
  const [nodeError, setNodeError] = useState<string | null>(null);

  // Function to fetch models using the node's custom URL
  const fetchModels = async (url: string) => {
    setNodeLoading(true);
    setNodeError(null);
    
    try {
      const response = await fetch(`${url}/api/tags`);
      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.statusText}`);
      }
      
      const responseData = await response.json();
      setNodeModels(responseData.models || []);
      
      // If we have models but no model is selected, select the first one
      if (responseData.models?.length > 0 && !model) {
        const firstModel = responseData.models[0]?.name;
        if (firstModel) {
          setModel(firstModel);
          data.config.model = firstModel;
        }
      }
    } catch (error) {
      setNodeError(error instanceof Error ? error.message : 'Failed to fetch models');
    } finally {
      setNodeLoading(false);
    }
  };
  
  // Fetch models when the component mounts or the URL changes
  useEffect(() => {
    fetchModels(customUrl);
  }, [customUrl]);
  
  // Handle file upload and convert to base64
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setUploadedImage(result);
      data.config.imageData = result;
    };
    reader.readAsDataURL(file);
  };
  
  const handleModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    e.stopPropagation(); // Prevent event bubbling
    setModel(e.target.value);
    data.config.model = e.target.value;
  };
  
  const handleSettingsClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowSettings(!showSettings);
  };
  
  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    setCustomUrl(e.target.value);
    data.config.ollamaUrl = e.target.value;
  };

  const handleRefreshClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent event bubbling
    fetchModels(customUrl); // Use node's custom URL to refresh models
  };
  
  const handleProcessClick = async () => {
    if (!uploadedImage) {
      alert("Please upload an image first.");
      return;
    }
    setIsProcessing(true);
    try {
      let processedImage = uploadedImage;
      if (processedImage.startsWith('data:image/')){
        processedImage = processedImage.replace(/^data:image\/[a-zA-Z]+;base64,/, '');
      }
      
      const selectedModel = model || 'llava'; // use default if none selected
      console.log(`Processing image with model: ${selectedModel}`);
      
      const response = await fetch(`${customUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: selectedModel,
          prompt: staticText,
          images: [processedImage],
          stream: false
        })
      });
      if (!response.ok) {
        const err = await response.text();
        throw new Error(err);
      }
      const json = await response.json();
      setResultText(json.response || "No response from model");
      data.config.resultText = json.response || "";
    } catch (error) {
      setResultText(`Error: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsProcessing(false);
    }
  };
  
  const stopPropagation = (e: React.SyntheticEvent) => {
    e.stopPropagation();
    e.nativeEvent.stopImmediatePropagation();
  };

  return (
    <div 
      className={`p-3 rounded-lg border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} shadow-md w-72`}
      onClick={stopPropagation} onMouseDown={stopPropagation}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg" style={{ background: nodeColor }}>
            <Icon className="w-5 h-5 text-white"/>
          </div>
          <div className="font-medium text-sm">{data.label}</div>
        </div>
        <button onClick={handleSettingsClick} className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700">
          <Settings size={16} className={isDark ? 'text-gray-300' : 'text-gray-600'}/>
        </button>
      </div>
      
      {showSettings && (
        <div className="mb-3 p-2 border border-dashed rounded">
          <label className={`block text-xs mb-1 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>Ollama API URL</label>
          <div className="flex gap-2">
            <input 
              type="text" value={customUrl} onChange={handleUrlChange}
              className={`w-full p-2 rounded border ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'} text-xs`}
              placeholder="http://localhost:11434"
            />
            <button 
              onClick={handleRefreshClick}
              className="p-1 bg-blue-500 hover:bg-blue-600 text-white rounded"
              disabled={nodeLoading}
            >
              <RefreshCw size={16} className={nodeLoading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      )}
      
      {/* Model selection dropdown */}
      <div className="mb-2" onClick={stopPropagation} onMouseDown={stopPropagation}>
        <label className={`block text-xs mb-1 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
          Select LLM Model
        </label>
        <div className="flex items-center gap-2">
          <select 
            value={model}
            onChange={handleModelChange}
            onClick={stopPropagation}
            onMouseDown={stopPropagation}
            className={`w-full p-2 rounded border ${
              isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'
            } text-sm pointer-events-auto`}
            disabled={nodeLoading}
          >
            {nodeLoading ? (
              <option>Loading models...</option>
            ) : nodeError ? (
              <option>Error loading models</option>
            ) : nodeModels.length === 0 ? (
              <option>No models available</option>
            ) : (
              nodeModels.map(model => (
                <option 
                  key={model.name} 
                  value={model.name}
                >
                  {model.name} ({Math.round(model.size / 1024 / 1024 / 1024)}GB)
                </option>
              ))
            )}
          </select>
          <button 
            onClick={handleRefreshClick}
            onMouseDown={stopPropagation}
            className="p-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded"
            disabled={nodeLoading}
          >
            <RefreshCw size={14} className={nodeLoading ? 'animate-spin' : ''} />
          </button>
        </div>
        {nodeError && (
          <p className="text-xs text-red-500 mt-1">
            {nodeError}
          </p>
        )}
      </div>
      
      {/* Image upload section */}
      <div className="mb-2">
        <label className="block text-xs mb-1">Upload Image</label>
        <input type="file" accept="image/*" onChange={handleFileChange} />
        {uploadedImage && (
          <div className="mt-2">
            <img 
              src={uploadedImage} 
              alt="Uploaded preview" 
              className="max-h-32 max-w-full rounded border"
            />
          </div>
        )}
      </div>
      
      <div className="mb-2">
        <label className={`block text-xs mb-1 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
          Static Text (sent with image)
        </label>
        <textarea 
          value={staticText} onChange={e => { e.stopPropagation(); setStaticText(e.target.value); data.config.staticText = e.target.value; }}
          placeholder="Enter text to send with the image..."
          className={`w-full p-2 rounded border ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'} text-sm`}
          rows={3}
        />
      </div>
      
      <button 
        onClick={handleProcessClick} 
        className="mb-2 w-full py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400"
        disabled={isProcessing || !uploadedImage || !model}
      >
        {isProcessing ? "Processing..." : "Process Image"}
      </button>
      
      {resultText && (
        <div className={`p-2 border rounded ${isDark ? 'bg-gray-700 text-white' : 'bg-gray-100'} text-sm mt-2`}>
          {resultText}
        </div>
      )}
      
      <Handle type="source" position={Position.Bottom} id="text-out" isConnectable={isConnectable} className="!bg-purple-500 !w-3 !h-3" style={{ bottom: -6 }}/>
    </div>
  );
};

export default ImageUploadLlmNode;
