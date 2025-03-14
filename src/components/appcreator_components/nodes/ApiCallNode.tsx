import React, { useState } from 'react';
import { Handle, Position } from 'reactflow';
import { useTheme } from '../../../hooks/useTheme';
import { Plus, Trash2, ChevronDown, ChevronUp, Settings } from 'lucide-react';

const ApiCallNode = ({ data, isConnectable }: any) => {
  const { isDark } = useTheme();
  const tool = data.tool || {};
  const Icon = tool.icon || Settings;
  const nodeColor = isDark ? tool.darkColor || '#F87171' : tool.lightColor || '#EF4444';
  
  // Base state
  const [endpoint, setEndpoint] = useState(data.config?.endpoint || '');
  const [method, setMethod] = useState(data.config?.method || 'GET');
  
  // Advanced configuration
  const [queryParams, setQueryParams] = useState<{ key: string, value: string }[]>(
    data.config?.queryParams || [{ key: '', value: '' }]
  );
  const [headers, setHeaders] = useState<{ key: string, value: string }[]>(
    data.config?.headers || [{ key: 'Content-Type', value: 'application/json' }]
  );
  const [requestBody, setRequestBody] = useState(data.config?.requestBody || '{\n  \n}');
  
  // UI state for advanced toggles
  const [showQueryParams, setShowQueryParams] = useState(false);
  const [showHeaders, setShowHeaders] = useState(false);
  
  // Handlers for input changes
  const handleEndpointChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    setEndpoint(e.target.value);
    data.config = { ...data.config, endpoint: e.target.value };
  };
  
  const handleMethodChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    e.stopPropagation();
    setMethod(e.target.value);
    data.config = { ...data.config, method: e.target.value };
  };
  
  const handleBodyChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    e.stopPropagation();
    setRequestBody(e.target.value);
    data.config = { ...data.config, requestBody: e.target.value };
  };
  
  // Query parameters handlers
  const addQueryParam = () => {
    const newParams = [...queryParams, { key: '', value: '' }];
    setQueryParams(newParams);
    data.config = { ...data.config, queryParams: newParams };
  };
  
  const removeQueryParam = (index: number) => {
    const newParams = queryParams.filter((_, i) => i !== index);
    setQueryParams(newParams);
    data.config = { ...data.config, queryParams: newParams };
  };
  
  const updateQueryParam = (index: number, field: 'key' | 'value', value: string) => {
    const newParams = [...queryParams];
    newParams[index][field] = value;
    setQueryParams(newParams);
    data.config = { ...data.config, queryParams: newParams };
  };
  
  // Headers handlers
  const addHeader = () => {
    const newHeaders = [...headers, { key: '', value: '' }];
    setHeaders(newHeaders);
    data.config = { ...data.config, headers: newHeaders };
  };
  
  const removeHeader = (index: number) => {
    const newHeaders = headers.filter((_, i) => i !== index);
    setHeaders(newHeaders);
    data.config = { ...data.config, headers: newHeaders };
  };
  
  const updateHeader = (index: number, field: 'key' | 'value', value: string) => {
    const newHeaders = [...headers];
    newHeaders[index][field] = value;
    setHeaders(newHeaders);
    data.config = { ...data.config, headers: newHeaders };
  };

  // Stop event propagation for inner elements
  const stopPropagation = (e: React.SyntheticEvent) => {
    e.stopPropagation();
    e.nativeEvent.stopImmediatePropagation();
  };

  return (
    <div 
      className={`p-3 rounded-lg border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} shadow-md w-80`}
      onClick={stopPropagation}
      onMouseDown={stopPropagation}
    >
      {/* Header with Icon and Label */}
      <div className="flex items-center gap-2 mb-2">
        <div className="p-2 rounded-lg" style={{ background: nodeColor }}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div className="font-medium text-sm text-gray-900 dark:text-white truncate">
          {data.label || 'API Call'}
        </div>
      </div>
      
      {/* Method and Endpoint */}
      <div className="mb-2" onClick={stopPropagation}>
        <div className="flex gap-2">
          <div className="w-1/4">
            <select 
              value={method}
              onChange={handleMethodChange}
              onClick={stopPropagation}
              onMouseDown={stopPropagation}
              className={`w-full p-2 rounded border ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'} text-sm`}
            >
              <option value="GET">GET</option>
              <option value="POST">POST</option>
              <option value="PUT">PUT</option>
              <option value="DELETE">DELETE</option>
            </select>
          </div>
          <div className="w-3/4">
            <input 
              type="text"
              value={endpoint}
              onChange={handleEndpointChange}
              onClick={stopPropagation}
              onMouseDown={stopPropagation}
              placeholder="https://api.example.com/endpoint"
              className={`w-full p-2 rounded border ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'} text-sm`}
            />
          </div>
        </div>
      </div>
      
      {/* Query Parameters (for GET) */}
      {method === 'GET' && (
        <div className="mb-3 border-t border-gray-200 dark:border-gray-700 pt-2">
          <button 
            className={`flex justify-between items-center w-full text-xs font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-1`}
            onClick={() => setShowQueryParams(!showQueryParams)}
          >
            <span>Query Parameters</span>
            {showQueryParams ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          
          {showQueryParams && (
            <div className="space-y-2 mt-2">
              {queryParams.map((param, index) => (
                <div key={index} className="flex gap-2 items-center">
                  <input
                    type="text"
                    placeholder="Parameter name"
                    value={param.key}
                    onChange={(e) => updateQueryParam(index, 'key', e.target.value)}
                    className={`flex-1 p-1 text-xs rounded border ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                  />
                  <input
                    type="text"
                    placeholder="Value"
                    value={param.value}
                    onChange={(e) => updateQueryParam(index, 'value', e.target.value)}
                    className={`flex-1 p-1 text-xs rounded border ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                  />
                  <button
                    onClick={() => removeQueryParam(index)}
                    className="p-1 text-red-500 hover:bg-red-100 dark:hover:bg-red-900 rounded"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              <button
                onClick={addQueryParam}
                className={`flex items-center gap-1 text-xs ${isDark ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700'}`}
              >
                <Plus size={14} />
                <span>Add Parameter</span>
              </button>
            </div>
          )}
        </div>
      )}
      
      {/* Request Body (for POST/PUT) */}
      {(method === 'POST' || method === 'PUT') && (
        <div className="mb-3">
          <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
            Request Body (JSON)
          </label>
          <textarea
            value={requestBody}
            onChange={handleBodyChange}
            onClick={stopPropagation}
            onMouseDown={stopPropagation}
            rows={5}
            className={`w-full p-2 rounded border font-mono text-xs ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
          />
        </div>
      )}
      
      {/* Headers Section */}
      <div className="mb-3 border-t border-gray-200 dark:border-gray-700 pt-2">
        <button 
          className={`flex justify-between items-center w-full text-xs font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-1`}
          onClick={() => setShowHeaders(!showHeaders)}
        >
          <span>Headers</span>
          {showHeaders ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
        
        {showHeaders && (
          <div className="space-y-2 mt-2">
            {headers.map((header, index) => (
              <div key={index} className="flex gap-2 items-center">
                <input
                  type="text"
                  placeholder="Header name"
                  value={header.key}
                  onChange={(e) => updateHeader(index, 'key', e.target.value)}
                  className={`flex-1 p-1 text-xs rounded border ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                />
                <input
                  type="text"
                  placeholder="Value"
                  value={header.value}
                  onChange={(e) => updateHeader(index, 'value', e.target.value)}
                  className={`flex-1 p-1 text-xs rounded border ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                />
                <button
                  onClick={() => removeHeader(index)}
                  className="p-1 text-red-500 hover:bg-red-100 dark:hover:bg-red-900 rounded"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            <button
              onClick={addHeader}
              className={`flex items-center gap-1 text-xs ${isDark ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700'}`}
            >
              <Plus size={14} />
              <span>Add Header</span>
            </button>
          </div>
        )}
      </div>
      
      {/* Note for Users */}
      <div className="text-xs text-center p-2 bg-blue-50 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded mb-3">
        API requests will automatically execute when you run the flow
      </div>
      
      {/* Input and Output Handles */}
      <Handle
        type="target"
        position={Position.Top}
        id="text-in"
        isConnectable={isConnectable}
        className="!bg-blue-500 !w-3 !h-3"
        style={{ top: -6 }}
      />
      
      <Handle
        type="source"
        position={Position.Bottom}
        id="text-out"
        isConnectable={isConnectable}
        className="!bg-purple-500 !w-3 !h-3"
        style={{ bottom: -6 }}
      />
    </div>
  );
};

export const metadata = {
  id: 'api_call',
  name: 'API Call',
  description: 'Make external API requests',
  icon: Settings,
  color: 'bg-red-500',
  bgColor: 'bg-red-100',
  lightColor: '#EF4444',
  darkColor: '#F87171',
  category: 'function',
  inputs: ['text'],
  outputs: ['text'],
};

export default ApiCallNode;
