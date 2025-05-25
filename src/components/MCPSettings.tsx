import React, { useState, useEffect } from 'react';
import { Server, Upload, Plus, Check, X, Edit3, RotateCcw, Square, Play, AlertCircle, CheckCircle, FileText, Trash2 } from 'lucide-react';

// MCP Types
interface MCPServerConfig {
  name: string;
  type: 'stdio' | 'remote';
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  headers?: Record<string, string>;
  description?: string;
  enabled?: boolean;
}

interface MCPServerInfo {
  process?: any;
  name: string;
  config: MCPServerConfig;
  startedAt: Date;
  status: 'starting' | 'running' | 'error' | 'stopped';
  error?: string;
}

interface MCPServerStatus {
  name: string;
  config: MCPServerConfig;
  isRunning: boolean;
  status: 'starting' | 'running' | 'error' | 'stopped';
  startedAt?: Date;
  error?: string;
  pid?: number;
}

interface MCPServer {
  name: string;
  config: MCPServerConfig;
  isRunning: boolean;
  status: 'starting' | 'running' | 'error' | 'stopped';
  startedAt?: Date;
  error?: string;
  pid?: number;
}

interface MCPServerTemplate {
  name: string;
  displayName: string;
  description: string;
  command: string;
  args: string[];
  type: 'stdio' | 'remote';
  category: string;
  env?: Record<string, string>;
}

// Extend window interface for MCP service
declare global {
  interface Window {
    mcpService?: {
      getServers: () => Promise<MCPServer[]>;
      addServer: (serverConfig: MCPServerConfig) => Promise<boolean>;
      removeServer: (name: string) => Promise<boolean>;
      updateServer: (name: string, updates: Partial<MCPServerConfig>) => Promise<boolean>;
      startServer: (name: string) => Promise<MCPServerInfo>;
      stopServer: (name: string) => Promise<boolean>;
      restartServer: (name: string) => Promise<MCPServerInfo>;
      getServerStatus: (name: string) => Promise<MCPServerStatus | null>;
      testServer: (name: string) => Promise<{ success: boolean; message?: string; error?: string }>;
      getTemplates: () => Promise<MCPServerTemplate[]>;
      startAllEnabled: () => Promise<{ name: string; success: boolean; error?: string }[]>;
      stopAll: () => Promise<{ name: string; success: boolean; error?: string }[]>;
      importClaudeConfig: (configPath: string) => Promise<{ imported: number; errors: any[] }>;
      executeToolCall: (toolCall: any) => Promise<any>;
    };
  }
}

const MCPSettings: React.FC = () => {
  // MCP state
  const [mcpServers, setMcpServers] = useState<MCPServer[]>([]);
  const [mcpTemplates, setMcpTemplates] = useState<MCPServerTemplate[]>([]);
  const [isLoadingMcp, setIsLoadingMcp] = useState(true);
  const [showAddMcpModal, setShowAddMcpModal] = useState(false);
  const [editingMcpServer, setEditingMcpServer] = useState<MCPServer | null>(null);
  const [showDeleteMcpConfirm, setShowDeleteMcpConfirm] = useState<string | null>(null);
  const [testingMcpServer, setTestingMcpServer] = useState<string | null>(null);
  const [mcpTestResults, setMcpTestResults] = useState<{ [key: string]: 'success' | 'error' | null }>({});
  const [newMcpServerForm, setNewMcpServerForm] = useState({
    name: '',
    type: 'stdio' as 'stdio' | 'remote',
    command: '',
    args: [] as string[],
    env: {} as Record<string, string>,
    url: '',
    headers: {} as Record<string, string>,
    description: '',
    enabled: true
  });

  // Load MCP servers and templates
  useEffect(() => {
    const loadMcpData = async () => {
      if (!window.mcpService) return;
      
      setIsLoadingMcp(true);
      try {
        const [servers, templates] = await Promise.all([
          window.mcpService.getServers(),
          window.mcpService.getTemplates()
        ]);
        
        setMcpServers(servers);
        setMcpTemplates(templates);
      } catch (error) {
        console.error('Error loading MCP data:', error);
      } finally {
        setIsLoadingMcp(false);
      }
    };

    loadMcpData();
  }, []);

  // MCP management functions
  const handleAddMcpServer = async () => {
    if (!window.mcpService) return;
    
    try {
      await window.mcpService.addServer(newMcpServerForm);
      
      // Refresh servers list
      const servers = await window.mcpService.getServers();
      setMcpServers(servers);
      
      setShowAddMcpModal(false);
      setNewMcpServerForm({
        name: '',
        type: 'stdio',
        command: '',
        args: [],
        env: {},
        url: '',
        headers: {},
        description: '',
        enabled: true
      });
    } catch (error) {
      console.error('Error adding MCP server:', error);
      alert('Failed to add MCP server. Please try again.');
    }
  };

  const handleEditMcpServer = (server: MCPServer) => {
    setEditingMcpServer(server);
    setNewMcpServerForm({
      name: server.name,
      type: server.config.type,
      command: server.config.command || '',
      args: server.config.args || [],
      env: server.config.env || {},
      url: server.config.url || '',
      headers: server.config.headers || {},
      description: server.config.description || '',
      enabled: server.config.enabled !== false
    });
    setShowAddMcpModal(true);
  };

  const handleUpdateMcpServer = async () => {
    if (!editingMcpServer || !window.mcpService) return;
    
    try {
      await window.mcpService.updateServer(editingMcpServer.name, newMcpServerForm);
      
      // Refresh servers list
      const servers = await window.mcpService.getServers();
      setMcpServers(servers);
      
      setShowAddMcpModal(false);
      setEditingMcpServer(null);
      setNewMcpServerForm({
        name: '',
        type: 'stdio',
        command: '',
        args: [],
        env: {},
        url: '',
        headers: {},
        description: '',
        enabled: true
      });
    } catch (error) {
      console.error('Error updating MCP server:', error);
      alert('Failed to update MCP server. Please try again.');
    }
  };

  const handleDeleteMcpServer = async (name: string) => {
    if (!window.mcpService) return;
    
    try {
      await window.mcpService.removeServer(name);
      
      // Refresh servers list
      const servers = await window.mcpService.getServers();
      setMcpServers(servers);
      
      setShowDeleteMcpConfirm(null);
    } catch (error) {
      console.error('Error deleting MCP server:', error);
      alert('Failed to delete MCP server. Please try again.');
    }
  };

  const handleMcpServerAction = async (name: string, action: 'start' | 'stop' | 'restart') => {
    if (!window.mcpService) return;
    
    try {
      switch (action) {
        case 'start':
          await window.mcpService.startServer(name);
          break;
        case 'stop':
          await window.mcpService.stopServer(name);
          break;
        case 'restart':
          await window.mcpService.restartServer(name);
          break;
      }
      
      // Refresh servers list
      const servers = await window.mcpService.getServers();
      setMcpServers(servers);
    } catch (error) {
      console.error(`Error ${action}ing MCP server:`, error);
      alert(`Failed to ${action} MCP server. Please try again.`);
    }
  };

  const testMcpServer = async (name: string) => {
    if (!window.mcpService) return;
    
    setTestingMcpServer(name);
    setMcpTestResults(prev => ({ ...prev, [name]: null }));
    
    try {
      const result = await window.mcpService.testServer(name);
      setMcpTestResults(prev => ({ ...prev, [name]: result.success ? 'success' : 'error' }));
    } catch (error) {
      setMcpTestResults(prev => ({ ...prev, [name]: 'error' }));
      console.error('MCP server test failed:', error);
    } finally {
      setTestingMcpServer(null);
      
      // Clear test results after 3 seconds
      setTimeout(() => {
        setMcpTestResults(prev => ({ ...prev, [name]: null }));
      }, 3000);
    }
  };

  const handleImportClaudeConfig = async () => {
    if (!window.mcpService) return;
    
    try {
      // Open file dialog
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) {
          try {
            const text = await file.text();
            const config = JSON.parse(text);
            
            // Import the config
            const result = await window.mcpService!.importClaudeConfig(file.path);
            
            if (result.imported > 0) {
              alert(`Successfully imported ${result.imported} MCP servers from Claude Desktop config.`);
              
              // Refresh servers list
              const servers = await window.mcpService!.getServers();
              setMcpServers(servers);
            } else {
              alert('No new servers were imported. They may already exist.');
            }
            
            if (result.errors.length > 0) {
              console.warn('Import errors:', result.errors);
            }
          } catch (error) {
            console.error('Error importing Claude config:', error);
            alert('Failed to import Claude Desktop config. Please check the file format.');
          }
        }
      };
      input.click();
    } catch (error) {
      console.error('Error importing Claude config:', error);
      alert('Failed to import Claude Desktop config.');
    }
  };

  const addMcpServerFromTemplate = (template: MCPServerTemplate) => {
    setNewMcpServerForm({
      name: template.name,
      type: template.type,
      command: template.command,
      args: template.args,
      env: template.env || {},
      url: '',
      headers: {},
      description: template.description,
      enabled: true
    });
    setShowAddMcpModal(true);
  };

  return (
    <div className="space-y-6">
      {/* MCP Servers Section */}
      <div className="glassmorphic rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Server className="w-6 h-6 text-sakura-500" />
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                MCP Servers
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Manage Model Context Protocol servers for enhanced AI capabilities
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleImportClaudeConfig}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2"
            >
              <Upload className="w-4 h-4" />
              Import Claude Config
            </button>
            <button
              onClick={() => {
                setEditingMcpServer(null);
                setNewMcpServerForm({
                  name: '',
                  type: 'stdio',
                  command: '',
                  args: [],
                  env: {},
                  url: '',
                  headers: {},
                  description: '',
                  enabled: true
                });
                setShowAddMcpModal(true);
              }}
              className="px-4 py-2 bg-sakura-500 text-white rounded-lg hover:bg-sakura-600 transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Server
            </button>
          </div>
        </div>

        {/* MCP Servers List */}
        {isLoadingMcp ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-sakura-500"></div>
          </div>
        ) : (
          <div className="space-y-3">
            {mcpServers.length > 0 ? (
              mcpServers.map((server) => (
                <div
                  key={server.name}
                  className={`p-4 rounded-lg border transition-all ${
                    server.isRunning 
                      ? 'border-green-300 dark:border-green-600 bg-green-50/30 dark:bg-green-900/10 shadow-sm' 
                      : 'border-gray-200 dark:border-gray-700 bg-white/30 dark:bg-gray-800/30'
                  } hover:bg-white/50 dark:hover:bg-gray-800/50`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                        server.isRunning 
                          ? 'bg-green-500' 
                          : server.config.enabled 
                          ? 'bg-sakura-500' 
                          : 'bg-gray-400 dark:bg-gray-600'
                      }`}>
                        <Server className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium text-gray-900 dark:text-white">
                            {server.name}
                          </h4>
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            server.status === 'running' 
                              ? 'bg-green-100 dark:bg-green-800 text-green-700 dark:text-green-300'
                              : server.status === 'error'
                              ? 'bg-red-100 dark:bg-red-800 text-red-700 dark:text-red-300'
                              : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                          }`}>
                            {server.status}
                          </span>
                          {!server.config.enabled && (
                            <span className="px-2 py-1 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-xs rounded-full">
                              Disabled
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {server.config.description || 'No description'}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-500 font-mono">
                          {server.config.type === 'stdio' 
                            ? `${server.config.command} ${(server.config.args || []).join(' ')}`
                            : server.config.url
                          }
                        </p>
                        {server.error && (
                          <p className="text-xs text-red-500 dark:text-red-400 mt-1">
                            Error: {server.error}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Server Controls */}
                      {server.isRunning ? (
                        <>
                          <button
                            onClick={() => handleMcpServerAction(server.name, 'restart')}
                            className="p-2 text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                            title="Restart server"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleMcpServerAction(server.name, 'stop')}
                            className="p-2 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors"
                            title="Stop server"
                          >
                            <Square className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => handleMcpServerAction(server.name, 'start')}
                          disabled={!server.config.enabled}
                          className="p-2 text-green-500 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          title="Start server"
                        >
                          <Play className="w-4 h-4" />
                        </button>
                      )}
                      
                      {/* Test Button */}
                      <button
                        onClick={() => testMcpServer(server.name)}
                        disabled={testingMcpServer === server.name}
                        className={`px-3 py-1 text-sm rounded transition-colors disabled:opacity-50 flex items-center gap-1 ${
                          mcpTestResults[server.name] === 'success' 
                            ? 'bg-green-100 dark:bg-green-800 text-green-700 dark:text-green-300 border border-green-300 dark:border-green-600'
                            : mcpTestResults[server.name] === 'error'
                            ? 'bg-red-100 dark:bg-red-800 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-600'
                            : 'bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-700'
                        }`}
                      >
                        {testingMcpServer === server.name ? (
                          <>
                            <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                            Testing...
                          </>
                        ) : mcpTestResults[server.name] === 'success' ? (
                          <>
                            <CheckCircle className="w-3 h-3" />
                            Available
                          </>
                        ) : mcpTestResults[server.name] === 'error' ? (
                          <>
                            <AlertCircle className="w-3 h-3" />
                            Failed
                          </>
                        ) : (
                          <>
                            <Server className="w-3 h-3" />
                            Test
                          </>
                        )}
                      </button>
                      
                      <button
                        onClick={() => handleEditMcpServer(server)}
                        className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                        title="Edit server"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      
                      <button
                        onClick={() => setShowDeleteMcpConfirm(server.name)}
                        className="p-2 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors"
                        title="Delete server"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Server className="w-8 h-8 text-gray-400 dark:text-gray-600" />
                </div>
                <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No MCP servers configured</h4>
                <p className="text-gray-500 dark:text-gray-400 mb-4">
                  Add MCP servers to extend AI capabilities with external tools and data sources
                </p>
                <button 
                  onClick={() => setShowAddMcpModal(true)}
                  className="px-4 py-2 bg-sakura-500 text-white rounded-lg hover:bg-sakura-600 transition-colors"
                >
                  Add Your First Server
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* MCP Templates Section */}
      <div className="glassmorphic rounded-xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <FileText className="w-6 h-6 text-sakura-500" />
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Server Templates
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Quick setup for popular MCP servers
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {mcpTemplates.map((template) => (
            <div
              key={template.name}
              className="p-4 bg-white/30 dark:bg-gray-800/30 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-white/50 dark:hover:bg-gray-800/50 transition-colors"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white">
                    {template.displayName}
                  </h4>
                  <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                    {template.category}
                  </span>
                </div>
                <button
                  onClick={() => addMcpServerFromTemplate(template)}
                  className="px-3 py-1 bg-sakura-500 text-white text-sm rounded hover:bg-sakura-600 transition-colors"
                >
                  Use Template
                </button>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                {template.description}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 font-mono mt-2">
                {template.command} {template.args.join(' ')}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* MCP Delete Confirmation Modal */}
      {showDeleteMcpConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md mx-4 shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
                <Trash2 className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Delete MCP Server
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  This action cannot be undone.
                </p>
              </div>
            </div>
            
            <div className="mb-6">
              <p className="text-gray-700 dark:text-gray-300">
                Are you sure you want to delete the MCP server "{showDeleteMcpConfirm}"? This will stop the server and remove all its configuration.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteMcpConfirm(null)}
                className="flex-1 px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteMcpServer(showDeleteMcpConfirm)}
                className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors flex items-center justify-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Delete Server
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit MCP Server Modal */}
      {showAddMcpModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-2xl mx-4 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {editingMcpServer ? 'Edit MCP Server' : 'Add MCP Server'}
              </h3>
              <button
                onClick={() => {
                  setShowAddMcpModal(false);
                  setEditingMcpServer(null);
                }}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Server Name
                  </label>
                  <input
                    type="text"
                    value={newMcpServerForm.name}
                    onChange={(e) => setNewMcpServerForm(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-4 py-2 rounded-lg bg-white/50 border border-gray-200 focus:outline-none focus:border-sakura-300 dark:bg-gray-800/50 dark:border-gray-700 dark:text-gray-100"
                    placeholder="Enter server name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Server Type
                  </label>
                  <select
                    value={newMcpServerForm.type}
                    onChange={(e) => setNewMcpServerForm(prev => ({ ...prev, type: e.target.value as 'stdio' | 'remote' }))}
                    className="w-full px-4 py-2 rounded-lg bg-white/50 border border-gray-200 focus:outline-none focus:border-sakura-300 dark:bg-gray-800/50 dark:border-gray-700 dark:text-gray-100"
                  >
                    <option value="stdio">Standard I/O</option>
                    <option value="remote">Remote Server</option>
                  </select>
                </div>
              </div>

              {newMcpServerForm.type === 'stdio' ? (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Command
                    </label>
                    <input
                      type="text"
                      value={newMcpServerForm.command}
                      onChange={(e) => setNewMcpServerForm(prev => ({ ...prev, command: e.target.value }))}
                      className="w-full px-4 py-2 rounded-lg bg-white/50 border border-gray-200 focus:outline-none focus:border-sakura-300 dark:bg-gray-800/50 dark:border-gray-700 dark:text-gray-100"
                      placeholder="npx @modelcontextprotocol/server-filesystem"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Arguments (one per line)
                    </label>
                    <textarea
                      value={newMcpServerForm.args.join('\n')}
                      onChange={(e) => setNewMcpServerForm(prev => ({ 
                        ...prev, 
                        args: e.target.value.split('\n').filter(arg => arg.trim()).map(arg => arg.trim())
                      }))}
                      className="w-full px-4 py-2 rounded-lg bg-white/50 border border-gray-200 focus:outline-none focus:border-sakura-300 dark:bg-gray-800/50 dark:border-gray-700 dark:text-gray-100"
                      rows={3}
                      placeholder="/path/to/directory"
                    />
                  </div>
                </>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Server URL
                  </label>
                  <input
                    type="url"
                    value={newMcpServerForm.url}
                    onChange={(e) => setNewMcpServerForm(prev => ({ ...prev, url: e.target.value }))}
                    className="w-full px-4 py-2 rounded-lg bg-white/50 border border-gray-200 focus:outline-none focus:border-sakura-300 dark:bg-gray-800/50 dark:border-gray-700 dark:text-gray-100"
                    placeholder="https://your-mcp-server.com"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={newMcpServerForm.description}
                  onChange={(e) => setNewMcpServerForm(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-4 py-2 rounded-lg bg-white/50 border border-gray-200 focus:outline-none focus:border-sakura-300 dark:bg-gray-800/50 dark:border-gray-700 dark:text-gray-100"
                  placeholder="Brief description of what this server does"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Environment Variables (JSON format)
                </label>
                <textarea
                  value={JSON.stringify(newMcpServerForm.env, null, 2)}
                  onChange={(e) => {
                    try {
                      const env = JSON.parse(e.target.value);
                      setNewMcpServerForm(prev => ({ ...prev, env }));
                    } catch {
                      // Invalid JSON, ignore
                    }
                  }}
                  className="w-full px-4 py-2 rounded-lg bg-white/50 border border-gray-200 focus:outline-none focus:border-sakura-300 dark:bg-gray-800/50 dark:border-gray-700 dark:text-gray-100 font-mono text-sm"
                  rows={4}
                  placeholder='{\n  "API_KEY": "your-api-key",\n  "DATABASE_URL": "your-db-url"\n}'
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="mcpEnabled"
                  checked={newMcpServerForm.enabled}
                  onChange={(e) => setNewMcpServerForm(prev => ({ ...prev, enabled: e.target.checked }))}
                  className="w-4 h-4 text-sakura-500 rounded border-gray-300 focus:ring-sakura-500"
                />
                <label htmlFor="mcpEnabled" className="text-sm text-gray-700 dark:text-gray-300">
                  Enable this server
                </label>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowAddMcpModal(false);
                  setEditingMcpServer(null);
                }}
                className="flex-1 px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={editingMcpServer ? handleUpdateMcpServer : handleAddMcpServer}
                disabled={!newMcpServerForm.name.trim() || (!newMcpServerForm.command.trim() && newMcpServerForm.type === 'stdio') || (!newMcpServerForm.url.trim() && newMcpServerForm.type === 'remote')}
                className="flex-1 px-4 py-2 bg-sakura-500 text-white rounded-lg hover:bg-sakura-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                <Check className="w-4 h-4" />
                {editingMcpServer ? 'Update' : 'Add'} Server
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MCPSettings; 