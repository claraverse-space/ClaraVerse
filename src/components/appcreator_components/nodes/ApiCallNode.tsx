import React, { useState } from 'react';
import { Handle, Position } from 'reactflow';
import { useTheme } from '../../../hooks/useTheme';
import { Plus, Trash2, ChevronDown, ChevronUp, HelpCircle, Globe } from 'lucide-react';

const ApiCallNode = ({ data, isConnectable }: any) => {
  const { isDark } = useTheme();
  const tool = data.tool || {};
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
  const [showHelp, setShowHelp] = useState(false);
  
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
    <div className={`p-3 rounded-lg border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} shadow-md w-80`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg" style={{ background: nodeColor }}>
            <Globe className="w-5 h-5 text-white" />
          </div>
          <div className="font-medium text-sm">{data.label || 'API Call'}</div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowHelp(!showHelp)}
            className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
            title="Show help"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
        </div>
      </div>

      {showHelp && (
        <div className="mb-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-sm">
          <h4 className="font-medium mb-2">How to use the API Call node:</h4>
          <div className="space-y-2">
            <p><strong>Input:</strong> The node accepts JSON input from previous nodes.</p>
            
            <p><strong>GET Requests:</strong></p>
            <ul className="list-disc pl-4">
              <li>Add query parameters using the "Query Params" section</li>
              <li>Use <code>{'{{input}}'}</code> in parameter values to include the input</li>
              <li>Example: <code>{"{ \"key\": \"id\", \"value\": \"{{input}}\" }"}</code></li>
            </ul>

            <p><strong>POST Requests:</strong></p>
            <ul className="list-disc pl-4">
              <li>Write your JSON request body in the "Request Body" section</li>
              <li>Use <code>{'{{input}}'}</code> to include the input in the body</li>
              <li>Example: <code>{"{ \"data\": {{input}} }"}</code></li>
            </ul>

            <p><strong>Output:</strong> The node returns a JSON string containing both input and API response.</p>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <div>
          <label className="block text-xs mb-1">Endpoint</label>
          <input
            type="text"
            value={endpoint}
            onChange={handleEndpointChange}
            className="w-full p-2 text-sm rounded border bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white"
            placeholder="https://api.example.com/endpoint"
          />
        </div>

        <div>
          <label className="block text-xs mb-1">Method</label>
          <select
            value={method}
            onChange={handleMethodChange}
            className="w-full p-2 text-sm rounded border bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="GET">GET</option>
            <option value="POST">POST</option>
            <option value="PUT">PUT</option>
            <option value="DELETE">DELETE</option>
          </select>
        </div>

        <div>
          <button
            onClick={() => setShowQueryParams(!showQueryParams)}
            className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          >
            {showQueryParams ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            Query Parameters
          </button>
          {showQueryParams && (
            <div className="mt-2 space-y-2">
              {queryParams.map((param, index) => (
                <div key={index} className="flex gap-2">
                  <input
                    type="text"
                    value={param.key}
                    onChange={(e) => {
                      const newParams = [...queryParams];
                      newParams[index] = { ...param, key: e.target.value };
                      setQueryParams(newParams);
                      data.config = { ...data.config, queryParams: newParams };
                    }}
                    className="flex-1 p-2 text-sm rounded border bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="Key"
                  />
                  <input
                    type="text"
                    value={param.value}
                    onChange={(e) => {
                      const newParams = [...queryParams];
                      newParams[index] = { ...param, value: e.target.value };
                      setQueryParams(newParams);
                      data.config = { ...data.config, queryParams: newParams };
                    }}
                    className="flex-1 p-2 text-sm rounded border bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="Value"
                  />
                  <button
                    onClick={() => {
                      const newParams = queryParams.filter((_, i) => i !== index);
                      setQueryParams(newParams);
                      data.config = { ...data.config, queryParams: newParams };
                    }}
                    className="p-2 text-red-500 hover:text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <button
                onClick={addQueryParam}
                className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-600"
              >
                <Plus className="w-3 h-3" />
                Add Parameter
              </button>
            </div>
          )}
        </div>

        <div>
          <button
            onClick={() => setShowHeaders(!showHeaders)}
            className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          >
            {showHeaders ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            Headers
          </button>
          {showHeaders && (
            <div className="mt-2 space-y-2">
              {headers.map((header, index) => (
                <div key={index} className="flex gap-2">
                  <input
                    type="text"
                    value={header.key}
                    onChange={(e) => {
                      const newHeaders = [...headers];
                      newHeaders[index] = { ...header, key: e.target.value };
                      setHeaders(newHeaders);
                      data.config = { ...data.config, headers: newHeaders };
                    }}
                    className="flex-1 p-2 text-sm rounded border bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="Key"
                  />
                  <input
                    type="text"
                    value={header.value}
                    onChange={(e) => {
                      const newHeaders = [...headers];
                      newHeaders[index] = { ...header, value: e.target.value };
                      setHeaders(newHeaders);
                      data.config = { ...data.config, headers: newHeaders };
                    }}
                    className="flex-1 p-2 text-sm rounded border bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="Value"
                  />
                  <button
                    onClick={() => {
                      const newHeaders = headers.filter((_, i) => i !== index);
                      setHeaders(newHeaders);
                      data.config = { ...data.config, headers: newHeaders };
                    }}
                    className="p-2 text-red-500 hover:text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <button
                onClick={addHeader}
                className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-600"
              >
                <Plus className="w-3 h-3" />
                Add Header
              </button>
            </div>
          )}
        </div>

        {(method === 'POST' || method === 'PUT') && (
          <div>
            <label className="block text-xs mb-1">Request Body</label>
            <textarea
              value={requestBody}
              onChange={handleBodyChange}
              className="w-full p-2 text-sm rounded border bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white font-mono"
              rows={4}
              placeholder="{\n  \n}"
            />
          </div>
        )}
      </div>
      
      {/* Input and Output Handles */}
      {isConnectable && (
        <>
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
        </>
      )}
    </div>
  );
};

export const metadata = {
  id: 'api_call',
  name: 'API Call',
  description: 'Make external API requests',
  icon: Globe,
  color: 'bg-red-500',
  bgColor: 'bg-red-100',
  lightColor: '#EF4444',
  darkColor: '#F87171',
  category: 'function',
  inputs: ['text'],
  outputs: ['text'],
};

export default ApiCallNode;
