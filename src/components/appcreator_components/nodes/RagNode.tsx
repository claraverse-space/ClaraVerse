import React, { useState, useEffect, useRef } from 'react';
import { Handle, Position } from 'reactflow';
import { useTheme } from '../../../hooks/useTheme';
import { BookA, Upload, X, Plus, Settings, RefreshCw, Database } from 'lucide-react';
import { getNodeExecutor } from '../../../nodeExecutors/NodeExecutorRegistry';

const RagNode: React.FC<{ data: any; isConnectable: boolean }> = ({ data, isConnectable }) => {
  const { isDark } = useTheme();
  const tool = data.tool;
  const Icon = tool.icon;
  const nodeColor = isDark ? tool.darkColor : tool.lightColor;
  
  const [collections, setCollections] = useState<{name: string, description: string}[]>([]);
  const [isLoadingCollections, setIsLoadingCollections] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Initialize config if not present
  if (!data.config) data.config = {};
  if (!data.config.collectionName) data.config.collectionName = 'default_collection';
  if (!data.config.resultCount) data.config.resultCount = 3;
  
  const [collectionName, setCollectionName] = useState(data.config.collectionName);
  const [resultCount, setResultCount] = useState(data.config.resultCount);
  
  // Load available collections on mount
  useEffect(() => {
    fetchCollections();
  }, []);
  
  const fetchCollections = async () => {
    setIsLoadingCollections(true);
    try {
      const pythonPort = await window.electron?.getPythonPort?.() || 8099;
      const response = await fetch(`http://0.0.0.0:${pythonPort}/collections`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch collections: ${response.statusText}`);
      }
      
      const data = await response.json();
      setCollections(data.collections || []);
      
      // Create default collection if not exists
      if (!data.collections.some((c: any) => c.name === 'default_collection')) {
        await fetch(`http://0.0.0.0:${pythonPort}/collections`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: 'default_collection',
            description: 'Default RAG collection'
          })
        });
        
        // Refresh collections after creating default
        fetchCollections();
      }
    } catch (error) {
      console.error('Error loading collections:', error);
    } finally {
      setIsLoadingCollections(false);
    }
  };
  
  const handleCollectionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setCollectionName(e.target.value);
    data.config.collectionName = e.target.value;
  };
  
  const handleResultCountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const count = parseInt(e.target.value, 10);
    setResultCount(count);
    data.config.resultCount = count;
  };
  
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    setIsUploading(true);
    setUploadStatus('Uploading file...');
    
    try {
      // Get upload handler from executor
      const executor = getNodeExecutor('ragNode');
      if (!executor || !executor.uploadFile) {
        throw new Error('Upload functionality not available');
      }
      
      const file = files[0];
      const result = await executor.uploadFile(file, collectionName);
      setUploadStatus(result);
      
      // Clear file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
      // Refresh collections after upload
      fetchCollections();
    } catch (error) {
      console.error('Upload error:', error);
      setUploadStatus(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsUploading(false);
    }
  };
  
  const handleAddCollection = async () => {
    const name = prompt('Enter collection name:');
    if (!name) return;
    
    try {
      const pythonPort = await window.electron?.getPythonPort?.() || 8099;
      const response = await fetch(`http://0.0.0.0:${pythonPort}/collections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description: `Collection created from RAG node`
        })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to create collection: ${response.statusText}`);
      }
      
      // Refresh collections
      fetchCollections();
      
      // Set as active collection
      setCollectionName(name);
      data.config.collectionName = name;
    } catch (error) {
      console.error('Error creating collection:', error);
      alert(`Failed to create collection: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };
  
  // Prevent click propagation to the node
  const stopPropagation = (e: React.MouseEvent) => {
    e.stopPropagation();
  };
  
  return (
    <div 
      className={`p-3 rounded-lg border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} shadow-md w-72`}
      onClick={stopPropagation}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg" style={{ background: nodeColor }}>
            <Icon className="w-5 h-5 text-white" />
          </div>
          <div className="font-medium text-sm">
            {data.label || 'RAG Query'}
          </div>
        </div>
        <button 
          onClick={() => setShowSettings(!showSettings)}
          className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
        >
          <Settings size={16} className={isDark ? 'text-gray-300' : 'text-gray-600'} />
        </button>
      </div>
      
      <div className="mb-3">
        <label className={`block text-xs mb-1 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
          Select Document Collection
        </label>
        <div className="flex items-center gap-1">
          <select
            value={collectionName}
            onChange={handleCollectionChange}
            className={`w-full p-2 rounded border ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'} text-sm`}
          >
            {collections.map(collection => (
              <option key={collection.name} value={collection.name}>
                {collection.name}
              </option>
            ))}
          </select>
          <button 
            onClick={fetchCollections}
            className={`p-2 rounded ${isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
            title="Refresh collections"
          >
            <RefreshCw size={14} className={isLoadingCollections ? 'animate-spin' : ''} />
          </button>
          <button 
            onClick={handleAddCollection}
            className={`p-2 rounded ${isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
            title="Add new collection"
          >
            <Plus size={14} />
          </button>
        </div>
      </div>
      
      {showSettings && (
        <div className="mb-3 p-2 border border-dashed rounded bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600">
          <div className="mb-2">
            <label className={`block text-xs mb-1 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
              Number of Results
            </label>
            <input
              type="number"
              min="1"
              max="10"
              value={resultCount}
              onChange={handleResultCountChange}
              className={`w-full p-2 rounded border ${isDark ? 'bg-gray-600 border-gray-500 text-white' : 'bg-white border-gray-300'} text-sm`}
            />
          </div>
          
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <Database size={12} />
            <span>Using Python Backend on port {window.electron?.getPythonPort?.() || 8099}</span>
          </div>
        </div>
      )}
      
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <label className={`block text-xs ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
            Upload Document
          </label>
          {uploadStatus && (
            <button 
              onClick={() => setUploadStatus(null)}
              className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
            >
              <X size={12} className="text-gray-500" />
            </button>
          )}
        </div>
        
        <div className="relative">
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileUpload}
            className="hidden"
            accept=".pdf,.txt,.csv,.md"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className={`w-full p-2 flex items-center justify-center gap-2 rounded border ${
              isDark 
                ? 'bg-gray-700 border-gray-600 text-white hover:bg-gray-600' 
                : 'bg-white border-gray-300 hover:bg-gray-50'
            } text-sm transition-colors`}
          >
            <Upload size={14} className={isUploading ? 'animate-bounce' : ''} />
            {isUploading ? 'Uploading...' : 'Upload File'}
          </button>
        </div>
        
        {uploadStatus && (
          <div className={`mt-2 p-2 text-xs rounded ${
            uploadStatus.startsWith('Error') 
              ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' 
              : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
          }`}>
            {uploadStatus}
          </div>
        )}
      </div>
      
      <div className="mb-1">
        <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          Connect text input for query and receive document results
        </p>
      </div>
      
      <Handle
        type="target"
        position={Position.Left}
        id="text-in"
        isConnectable={isConnectable}
        className="!bg-blue-500 !w-3 !h-3"
        style={{ left: -6 }}
      />
      
      <Handle
        type="source"
        position={Position.Right}
        id="text-out"
        isConnectable={isConnectable}
        className="!bg-purple-500 !w-3 !h-3"
        style={{ right: -6 }}
      />
    </div>
  );
};

// Export metadata as a named export for NodeRegistry
export const metadata = {
  id: 'rag',
  name: 'RAG',
  description: 'Retrieval-Augmented Generation: Query your documents for relevant information',
  icon: BookA,
  color: 'bg-indigo-500',
  bgColor: 'bg-indigo-100',
  lightColor: '#6366F1',
  darkColor: '#818CF8',
  category: 'process',
  inputs: ['text'],
  outputs: ['text'],
};

export default RagNode;
