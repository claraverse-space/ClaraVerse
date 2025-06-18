import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  Upload, 
  FileText, 
  MessageSquare, 
  Trash2, 
  Search,
  Network,
  Calendar,
  FileType,
  Settings,
  AlertCircle,
  Bot,
  Layers,
  Clock,
  CheckCircle,
  XCircle,
  Edit,
  X
} from 'lucide-react';
import DocumentUpload from './DocumentUpload';
import NotebookChat from './NotebookChat';
import GraphViewer from './GraphViewer';
import { 
  claraNotebookService, 
  NotebookResponse, 
  NotebookDocumentResponse 
} from '../../services/claraNotebookService';
import { useProviders } from '../../contexts/ProvidersContext';
import { claraApiService } from '../../services/claraApiService';
import { ClaraModel } from '../../types/clara_assistant_types';

interface NotebookDetailsProps {
  notebook: NotebookResponse;
  onClose: () => void;
  onNotebookUpdated: (notebook: NotebookResponse) => void;
  onNotebookDeleted: () => void;
}

const NotebookDetails: React.FC<NotebookDetailsProps> = ({ 
  notebook, 
  onClose, 
  onNotebookUpdated,
  onNotebookDeleted 
}) => {
  const [documents, setDocuments] = useState<NotebookDocumentResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showGraphModal, setShowGraphModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [isEditingLLM, setIsEditingLLM] = useState(false);
  const [selectedLLMProvider, setSelectedLLMProvider] = useState('');
  const [selectedLLMModel, setSelectedLLMModel] = useState('');
  const [models, setModels] = useState<ClaraModel[]>([]);
  
  // Get providers from context
  const { providers } = useProviders();

  // Load documents from API
  useEffect(() => {
    loadDocuments();
  }, [notebook.id]);

  // Load models when providers change
  useEffect(() => {
    if (providers.length > 0) {
      loadModels();
    }
  }, [providers]);

  // Initialize LLM selection with current notebook values
  useEffect(() => {
    if (notebook.llm_provider) {
      setSelectedLLMProvider(notebook.llm_provider.name);
      setSelectedLLMModel(notebook.llm_provider.model);
    }
  }, [notebook]);

  // Auto-refresh documents every 5 seconds if there are processing documents
  useEffect(() => {
    const hasProcessingDocs = documents.some(doc => doc.status === 'processing');
    
    if (!hasProcessingDocs) return;

    const interval = setInterval(() => {
      loadDocuments();
    }, 5000);

    return () => clearInterval(interval);
  }, [documents, notebook.id]);

  const loadDocuments = async () => {
    if (!claraNotebookService.isBackendHealthy()) {
      setError('Notebook backend is not available');
      setIsLoading(false);
      return;
    }

    // Only show loading on initial load, not on auto-refresh
    if (documents.length === 0) {
      setIsLoading(true);
    }
    setError(null);
    
    try {
      const data = await claraNotebookService.listDocuments(notebook.id);
      setDocuments(data);
    } catch (err) {
      console.error('Failed to load documents:', err);
      setError(err instanceof Error ? err.message : 'Failed to load documents');
      setDocuments([]);
    } finally {
      setIsLoading(false);
    }
  };

  const loadModels = async () => {
    try {
      const allModels = await claraApiService.getModels();
      setModels(allModels);
    } catch (error) {
      console.error('Failed to load models:', error);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getFileIcon = (filename: string) => {
    const extension = filename.split('.').pop()?.toLowerCase() || '';
    switch (extension) {
      case 'pdf':
        return <FileText className="w-4 h-4 text-red-600" />;
      case 'txt':
      case 'md':
        return <FileText className="w-4 h-4 text-blue-600" />;
      case 'csv':
      case 'json':
        return <FileType className="w-4 h-4 text-green-600" />;
      default:
        return <FileText className="w-4 h-4 text-gray-600 dark:text-gray-400" />;
    }
  };

  const getStatusBadge = (status: string, error?: string) => {
    switch (status) {
      case 'completed':
        return (
          <div className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-400 rounded-full text-xs font-medium">
            <CheckCircle className="w-3 h-3" />
            Completed
          </div>
        );
      case 'processing':
        return (
          <div className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-400 rounded-full text-xs font-medium">
            <Clock className="w-3 h-3 animate-spin" />
            Processing
          </div>
        );
      case 'failed':
        return (
          <div className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-400 rounded-full text-xs font-medium" title={error}>
            <XCircle className="w-3 h-3" />
            Failed
          </div>
        );
      default:
        return (
          <div className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-gray-900/20 text-gray-800 dark:text-gray-400 rounded-full text-xs font-medium">
            <Clock className="w-3 h-3" />
            {status}
          </div>
        );
    }
  };

  const filteredDocuments = documents.filter(doc =>
    doc.filename.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDocumentUpload = async (files: File[]) => {
    if (!claraNotebookService.isBackendHealthy()) {
      throw new Error('Notebook backend is not available');
    }

    try {
      const uploadedDocs = await claraNotebookService.uploadDocuments(notebook.id, files);
      
      // Add new documents to the list
      setDocuments(prev => [...uploadedDocs, ...prev]);
      
      // Update notebook document count
      const updatedNotebook = {
        ...notebook,
        document_count: notebook.document_count + uploadedDocs.length
      };
      onNotebookUpdated(updatedNotebook);
      
      setShowUploadModal(false);
    } catch (error) {
      console.error('Upload failed:', error);
      throw error; // Re-throw so the modal can handle it
    }
  };

  const handleDeleteDocument = async (documentId: string) => {
    if (!window.confirm('Are you sure you want to delete this document?')) {
      return;
    }

    if (!claraNotebookService.isBackendHealthy()) {
      setError('Notebook backend is not available');
      return;
    }

    try {
      await claraNotebookService.deleteDocument(notebook.id, documentId);
      
      // Remove from local state
      setDocuments(prev => prev.filter(doc => doc.id !== documentId));
      
      // Update notebook document count
      const updatedNotebook = {
        ...notebook,
        document_count: Math.max(0, notebook.document_count - 1)
      };
      onNotebookUpdated(updatedNotebook);
    } catch (error) {
      console.error('Failed to delete document:', error);
      setError(error instanceof Error ? error.message : 'Failed to delete document');
    }
  };



  const handleUpdateLLM = async () => {
    // TODO: Implement LLM update functionality
    // This would require a backend API to update the notebook's LLM provider
    console.log('Update LLM not yet implemented');
    setIsEditingLLM(false);
  };

  const getLLMModels = (providerId: string) => {
    return models.filter(m => 
      m.provider === providerId && 
      (m.type === 'text' || m.type === 'multimodal')
    );
  };

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col bg-gradient-to-br from-white to-sakura-50 dark:from-gray-900 dark:to-gray-800 overflow-hidden">
      {/* Header - Fixed height */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-gray-200 dark:border-gray-700 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="p-2 hover:bg-sakura-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-sakura-500 rounded-lg text-white">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">{notebook.name}</h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {notebook.description || 'No description provided'}
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-sm text-gray-500 dark:text-gray-400 bg-sakura-100 dark:bg-sakura-900/20 px-3 py-1 rounded-full">
              {notebook.document_count} document{notebook.document_count !== 1 ? 's' : ''}
            </div>
          </div>
        </div>
      </div>

      {/* Error Banner - Fixed height when visible */}
      {error && (
        <div className="flex-shrink-0 px-6 py-3 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800">
          <div className="flex items-center">
            <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 mr-2" />
            <p className="text-red-800 dark:text-red-200 text-sm">{error}</p>
            <button
              onClick={() => setError(null)}
              className="ml-auto text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Split Screen Layout - Takes remaining height */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Left Panel - Documents & Sources */}
        <div className="w-80 flex-shrink-0 border-r border-gray-200 dark:border-gray-700 backdrop-blur-sm flex flex-col overflow-hidden">
          {/* Sources Header - Fixed */}
          <div className="flex-shrink-0 p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-sakura-500" />
                Sources
              </h2>
              <button
                onClick={() => setShowUploadModal(true)}
                disabled={!claraNotebookService.isBackendHealthy()}
                className="px-3 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-gray-700 dark:text-gray-300 flex items-center gap-2"
                title="Add documents"
              >
                <Upload className="w-4 h-4" />
                <span className="text-sm font-medium">Upload</span>
              </button>
            </div>
            
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search documents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-sakura-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Documents List - Scrollable */}
          <div className="flex-1 overflow-y-auto p-2 min-h-0">
            {/* Processing Notice */}
            {documents.some(doc => doc.status === 'processing') && (
              <div className="mb-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <div className="flex items-center gap-2 text-blue-800 dark:text-blue-200">
                  <Clock className="w-4 h-4 animate-spin" />
                  <div>
                    <p className="text-sm font-medium">Processing documents...</p>
                    <p className="text-xs text-blue-600 dark:text-blue-300 mt-1">
                      It might take a few minutes to process the documents, feel free to check back later
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            {isLoading ? (
              <div className="flex items-center justify-center h-32">
                <div className="w-6 h-6 border-2 border-sakura-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : filteredDocuments.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {searchQuery ? 'No documents found' : 'No documents uploaded'}
                </p>
                {!searchQuery && claraNotebookService.isBackendHealthy() && (
                  <button
                    onClick={() => setShowUploadModal(true)}
                    className="mt-2 text-sakura-600 dark:text-sakura-400 hover:text-sakura-800 dark:hover:text-sakura-200 text-sm"
                  >
                    Upload your first document
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredDocuments.map((document) => (
                  <div
                    key={document.id}
                    className="glassmorphic-card p-3 rounded-lg transition-all duration-200 group border border-white/30 dark:border-gray-700/50 hover:border-green-300 dark:hover:border-green-500 hover:shadow-lg hover:-translate-y-0.5"
                  >
                    <div className="flex items-start gap-3">
                      {getFileIcon(document.filename)}
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {document.filename}
                        </h4>
                        <div className="mt-2">
                          {getStatusBadge(document.status, document.error)}
                        </div>
                        {document.status === 'failed' && document.error && (
                          <div className="text-red-600 dark:text-red-400 text-xs mt-2 p-2 bg-red-50 dark:bg-red-900/20 rounded border border-red-200 dark:border-red-800">
                            {document.error}
                          </div>
                        )}
                        <div className="flex items-center gap-1 mt-2 text-xs text-gray-500 dark:text-gray-400">
                          <Calendar className="w-3 h-3" />
                          {formatDate(document.uploaded_at)}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteDocument(document.id);
                          }}
                          className="p-1 hover:bg-red-100 dark:hover:bg-red-900/20 rounded transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-3 h-3 text-red-500" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Center Panel - Chat */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Chat Header - Fixed */}
          <div className="flex-shrink-0 p-4 border-b border-gray-200 dark:border-gray-700 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-sakura-500" />
                Chat
              </h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowGraphModal(true);
                  }}
                  disabled={!claraNotebookService.isBackendHealthy()}
                  className="px-3 py-2 bg-blue-100 dark:bg-blue-900/20 hover:bg-blue-200 dark:hover:bg-blue-800/30 text-blue-700 dark:text-blue-300 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  title="View Knowledge Graph"
                >
                  <Network className="w-4 h-4" />
                  <span className="text-sm font-medium">Graph</span>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowSettingsModal(true);
                  }}
                  className="px-3 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors flex items-center gap-2"
                  title="Notebook Settings"
                >
                  <Settings className="w-4 h-4" />
                  <span className="text-sm font-medium">Settings</span>
                </button>
              </div>
            </div>
          </div>
          {/* Chat Content - Fixed height with internal scrolling */}
          <div className="flex-1 min-h-0 overflow-hidden">
            <NotebookChat 
              notebookId={notebook.id} 
              documentCount={documents.length}
              completedDocumentCount={documents.filter(doc => doc.status === 'completed').length}
            />
          </div>
        </div>
      </div>

      {/* Modals */}
      {showUploadModal && (
        <DocumentUpload 
          onClose={() => setShowUploadModal(false)}
          onUpload={handleDocumentUpload}
        />
      )}

      {showGraphModal && (
        <GraphViewer 
          notebookId={notebook.id}
          onClose={() => setShowGraphModal(false)}
        />
      )}

      {/* Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glassmorphic-card rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200/30 dark:border-gray-700/30">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-600 rounded-lg text-white">
                  <Settings className="w-5 h-5" />
                </div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  Notebook Settings
                </h2>
              </div>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="p-2 hover:bg-white/20 dark:hover:bg-gray-700/50 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* AI Configuration */}
              <div className="glassmorphic-card p-6 rounded-lg border border-white/30 dark:border-gray-700/50">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <Bot className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    AI Configuration
                  </h3>
                  {!isEditingLLM && notebook.llm_provider && (
                    <button
                      onClick={() => setIsEditingLLM(true)}
                      className="p-2 hover:bg-white/20 dark:hover:bg-gray-700/50 rounded-lg transition-colors"
                      title="Edit LLM Configuration"
                    >
                      <Edit className="w-4 h-4 text-gray-500" />
                    </button>
                  )}
                </div>
                
                {notebook.llm_provider && notebook.embedding_provider ? (
                  <div className="space-y-4">
                    {/* LLM Configuration */}
                    <div className="p-4 bg-white/50 dark:bg-gray-800/50 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Bot className="w-4 h-4 text-blue-600" />
                        <span className="font-medium text-gray-700 dark:text-gray-300">Language Model</span>
                      </div>
                      {isEditingLLM ? (
                        <div className="space-y-3">
                          <div>
                            <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Provider</label>
                            <select
                              value={selectedLLMProvider}
                              onChange={(e) => {
                                setSelectedLLMProvider(e.target.value);
                                setSelectedLLMModel('');
                              }}
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            >
                              <option value="">Select Provider</option>
                              {providers.filter(p => p.isEnabled).map(provider => (
                                <option key={provider.id} value={provider.name}>
                                  {provider.name}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Model</label>
                            <select
                              value={selectedLLMModel}
                              onChange={(e) => setSelectedLLMModel(e.target.value)}
                              disabled={!selectedLLMProvider}
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
                            >
                              <option value="">Select Model</option>
                              {selectedLLMProvider && getLLMModels(selectedLLMProvider).map(model => (
                                <option key={model.id} value={model.name}>
                                  {model.name}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="flex gap-2 pt-2">
                            <button
                              onClick={handleUpdateLLM}
                              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                            >
                              Save Changes
                            </button>
                            <button
                              onClick={() => setIsEditingLLM(false)}
                              className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white">{notebook.llm_provider.name}</div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">{notebook.llm_provider.model}</div>
                        </div>
                      )}
                    </div>
                    
                    {/* Embedding Configuration */}
                    <div className="p-4 bg-white/50 dark:bg-gray-800/50 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Layers className="w-4 h-4 text-green-600" />
                        <span className="font-medium text-gray-700 dark:text-gray-300">Embedding Model</span>
                      </div>
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">{notebook.embedding_provider.name}</div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">{notebook.embedding_provider.model}</div>
                        <div className="text-xs text-amber-600 dark:text-amber-400 mt-2 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          Cannot be changed (dimensions fixed once created)
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-gray-500 dark:text-gray-400 text-center py-4">
                    Provider configuration not available (legacy notebook)
                  </div>
                )}
              </div>

              {/* System Status */}
              <div className="glassmorphic-card p-6 rounded-lg border border-white/30 dark:border-gray-700/50">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">System Status</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-700 dark:text-gray-300">Backend Connection</span>
                    <div className={`flex items-center gap-2 ${claraNotebookService.isBackendHealthy() ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      <div className={`w-2 h-2 rounded-full ${claraNotebookService.isBackendHealthy() ? 'bg-green-500' : 'bg-red-500'}`}></div>
                      {claraNotebookService.isBackendHealthy() ? 'Connected' : 'Disconnected'}
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-700 dark:text-gray-300">Documents</span>
                    <span className="text-gray-900 dark:text-white font-medium">{notebook.document_count}</span>
                  </div>
                </div>
              </div>

              {/* Danger Zone */}
              <div className="glassmorphic-card p-6 rounded-lg border border-red-200/50 dark:border-red-800/50 bg-red-50/50 dark:bg-red-900/10">
                <h3 className="text-lg font-semibold text-red-800 dark:text-red-400 mb-4">Danger Zone</h3>
                <div className="space-y-3">
                  <button
                    onClick={loadDocuments}
                    disabled={!claraNotebookService.isBackendHealthy()}
                    className="w-full px-4 py-2 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                  >
                    Refresh All Documents
                  </button>
                  <button
                    onClick={() => {
                      setShowSettingsModal(false);
                      onNotebookDeleted();
                    }}
                    className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                  >
                    Delete Notebook
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotebookDetails; 