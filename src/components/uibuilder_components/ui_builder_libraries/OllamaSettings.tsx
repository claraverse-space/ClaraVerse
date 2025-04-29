import React, { useState, useEffect } from 'react';
import { Server, Settings, Check, RefreshCw, AlertTriangle } from 'lucide-react';
import ollamaSettingsStore from './OllamaSettingsStore';
import OllamaService from './OllamaService';
import { OllamaConnection } from './OllamaTypes';

interface OllamaSettingsProps {
  onClose?: () => void;
}

const OllamaSettings: React.FC<OllamaSettingsProps> = ({ onClose }) => {
  const [connection, setConnection] = useState<OllamaConnection>(ollamaSettingsStore.getConnection());
  const [isTesting, setIsTesting] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  
  // Create a temporary service for testing connections
  const testService = new OllamaService(connection);
  
  // Handle input changes
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    
    setConnection(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : name === 'port' ? parseInt(value) || 11434 : value
    }));
  };
  
  // Test the connection
  const testConnection = async () => {
    setIsTesting(true);
    setTestStatus('idle');
    setErrorMessage('');
    
    try {
      const isConnected = await testService.checkConnection();
      
      if (isConnected) {
        setTestStatus('success');
      } else {
        setTestStatus('error');
        setErrorMessage('Could not connect to Ollama server');
      }
    } catch (err) {
      setTestStatus('error');
      setErrorMessage(err instanceof Error ? err.message : 'An error occurred while testing connection');
    } finally {
      setIsTesting(false);
    }
  };
  
  // Save settings
  const saveSettings = () => {
    ollamaSettingsStore.updateConnection(connection);
    if (onClose) onClose();
  };
  
  // Reset to defaults
  const resetToDefaults = () => {
    ollamaSettingsStore.resetToDefaults();
    setConnection(ollamaSettingsStore.getConnection());
  };
  
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-lg max-w-md w-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <Settings className="w-5 h-5 mr-2 text-sakura-500" />
          <h3 className="font-medium text-gray-800 dark:text-gray-200">Ollama Connection Settings</h3>
        </div>
      </div>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Host
          </label>
          <input
            type="text"
            name="host"
            value={connection.host}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
            placeholder="localhost or IP address"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Port
          </label>
          <input
            type="number"
            name="port"
            value={connection.port}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
            placeholder="11434"
          />
        </div>
        
        <div className="flex items-center">
          <input
            type="checkbox"
            id="secure"
            name="secure"
            checked={connection.secure}
            onChange={handleChange}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label htmlFor="secure" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
            Use HTTPS (secure connection)
          </label>
        </div>
        
        <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={testConnection}
            disabled={isTesting}
            className="flex items-center justify-center w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {isTesting ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Testing...
              </>
            ) : (
              <>
                <Server className="w-4 h-4 mr-2" />
                Test Connection
              </>
            )}
          </button>
          
          {testStatus === 'success' && (
            <div className="mt-2 text-sm text-green-600 dark:text-green-400 flex items-center">
              <Check className="w-4 h-4 mr-1" />
              Successfully connected to Ollama server
            </div>
          )}
          
          {testStatus === 'error' && (
            <div className="mt-2 text-sm text-red-600 dark:text-red-400 flex items-center">
              <AlertTriangle className="w-4 h-4 mr-1" />
              {errorMessage || 'Failed to connect to Ollama server'}
            </div>
          )}
        </div>
      </div>
      
      <div className="mt-5 pt-3 border-t border-gray-200 dark:border-gray-700 flex justify-between">
        <button
          onClick={resetToDefaults}
          className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
        >
          Reset to Defaults
        </button>
        
        <div className="flex space-x-2">
          {onClose && (
            <button
              onClick={onClose}
              className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
          )}
          
          <button
            onClick={saveSettings}
            className="px-4 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
};

export default OllamaSettings; 