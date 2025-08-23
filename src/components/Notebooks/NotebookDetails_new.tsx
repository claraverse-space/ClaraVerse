import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  Upload, 
  FileText, 
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
  X,
  BookOpen,
  Eye,
  BarChart3,
  TrendingUp,
  Maximize2,
  Minimize2,
  Sparkles,
  PieChart,
  Activity
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

interface NotebookDetailsNewProps {
  notebook: NotebookResponse;
  onClose: () => void;
  onNotebookUpdated: (notebook: NotebookResponse) => void;
  onNotebookDeleted: () => void;
}

const NotebookDetails_new: React.FC<NotebookDetailsNewProps> = ({ 
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
  const [studioActiveTab, setStudioActiveTab] = useState<'overview' | 'graph' | 'analytics'>('overview');
  const [sourcesCollapsed, setSourcesCollapsed] = useState(false);
  const [studioCollapsed, setStudioCollapsed] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<NotebookDocumentResponse | null>(null);
  
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

  const getDocumentStats = () => {
    const total = documents.length;
    const completed = documents.filter(doc => doc.status === 'completed').length;
    const processing = documents.filter(doc => doc.status === 'processing').length;
    const failed = documents.filter(doc => doc.status === 'failed').length;
    
    return { total, completed, processing, failed };
  };

  const stats = getDocumentStats();

  const renderStudioContent = () => {
    switch (studioActiveTab) {
      case 'overview':
        return (
          <div className="p-4 space-y-4">
            {/* Knowledge Cards Header */}
            <div className="glassmorphic rounded-xl p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                <Eye className="w-5 h-5 text-sakura-500" />
                Knowledge Cards
              </h3>
              
              {/* Quick Stats Grid */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="glassmorphic p-4 rounded-xl">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Documents</div>
                      <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</div>
                    </div>
                    <FileText className="w-8 h-8 text-blue-500" />
                  </div>
                </div>
                <div className="glassmorphic p-4 rounded-xl">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Completed</div>
                      <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.completed}</div>
                    </div>
                    <CheckCircle className="w-8 h-8 text-green-500" />
                  </div>
                </div>
                <div className="glassmorphic p-4 rounded-xl">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Processing</div>
                      <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.processing}</div>
                    </div>
                    <Clock className="w-8 h-8 text-blue-500 animate-spin" />
                  </div>
                </div>
                <div className="glassmorphic p-4 rounded-xl">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Failed</div>
                      <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.failed}</div>
                    </div>
                    <XCircle className="w-8 h-8 text-red-500" />
                  </div>
                </div>
              </div>

              {/* Recent Activity */}
              <div className="glassmorphic p-4 rounded-lg">
                <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-sakura-500" />
                  Recent Activity
                </h4>
                <div className="space-y-2">
                  {documents.slice(0, 5).map((doc) => (
                    <div key={doc.id} className="flex items-center gap-3 p-3 bg-white/30 dark:bg-gray-800/30 rounded-lg glassmorphic hover:bg-white/40 dark:hover:bg-gray-800/40 transition-all">
                      {getFileIcon(doc.filename)}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {doc.filename}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {formatDate(doc.uploaded_at)}
                        </div>
                      </div>
                      {getStatusBadge(doc.status, doc.error)}
                    </div>
                  ))}
                  {documents.length === 0 && (
                    <div className="text-center text-sm text-gray-500 dark:text-gray-400 py-8">
                      <div className="mb-3">
                        <Upload className="w-12 h-12 mx-auto text-gray-400" />
                      </div>
                      <div className="font-medium mb-1">No documents yet</div>
                      <div className="text-xs">Upload documents to get started</div>
                    </div>
                  )}
                </div>
              </div>

              {/* AI Configuration */}
              <div className="glassmorphic p-4 rounded-lg">
                <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  <Bot className="w-4 h-4 text-blue-500" />
                  AI Configuration
                </h4>
                {notebook.llm_provider ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-3 bg-white/30 dark:bg-gray-800/30 rounded-lg glassmorphic">
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {notebook.llm_provider.name}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {notebook.llm_provider.model}
                        </div>
                      </div>
                      <Bot className="w-4 h-4 text-blue-500" />
                    </div>
                    {notebook.embedding_provider && (
                      <div className="flex items-center justify-between p-3 bg-white/30 dark:bg-gray-800/30 rounded-lg glassmorphic">
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {notebook.embedding_provider.name}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {notebook.embedding_provider.model}
                          </div>
                        </div>
                        <Layers className="w-4 h-4 text-green-500" />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-sm text-gray-500 dark:text-gray-400 p-3 bg-white/20 dark:bg-gray-800/20 rounded-lg">
                    Configuration not available
                  </div>
                )}
              </div>
            </div>
          </div>
        );

      case 'graph':
        return (
          <div className="h-full p-4">
            <div className="h-full glassmorphic rounded-xl overflow-hidden">
              <div className="h-full bg-white/20 dark:bg-gray-900/20 backdrop-blur-sm">
                <GraphViewer 
                  notebookId={notebook.id}
                />
              </div>
            </div>
          </div>
        );

      case 'analytics':
        return (
          <div className="p-4 space-y-4">
            <div className="glassmorphic rounded-xl p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-purple-500" />
                Analytics Dashboard
              </h3>
              
              {/* Document Type Distribution */}
              <div className="glassmorphic p-4 rounded-lg mb-4">
              <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <PieChart className="w-4 h-4 text-purple-500" />
                Document Types
              </h4>
              <div className="space-y-2">
                {(() => {
                  const typeCount: Record<string, number> = {};
                  documents.forEach(doc => {
                    const ext = doc.filename.split('.').pop()?.toLowerCase() || 'unknown';
                    typeCount[ext] = (typeCount[ext] || 0) + 1;
                  });
                  
                  return Object.entries(typeCount).map(([type, count]) => (
                    <div key={type} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {getFileIcon(`file.${type}`)}
                        <span className="text-sm text-gray-900 dark:text-white capitalize">{type}</span>
                      </div>
                      <div className="text-sm font-medium text-gray-600 dark:text-gray-400">
                        {count}
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </div>

            {/* Processing Status */}
            <div className="glassmorphic p-4 rounded-lg">
              <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-blue-500" />
                Processing Status
              </h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Success Rate</span>
                  <span className="text-sm font-medium text-green-600 dark:text-green-400">
                    {stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div 
                    className="bg-green-500 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${stats.total > 0 ? (stats.completed / stats.total) * 100 : 0}%` }}
                  ></div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="text-center">
                    <div className="text-green-600 dark:text-green-400 font-medium">{stats.completed}</div>
                    <div className="text-gray-500 dark:text-gray-400">Completed</div>
                  </div>
                  <div className="text-center">
                    <div className="text-blue-600 dark:text-blue-400 font-medium">{stats.processing}</div>
                    <div className="text-gray-500 dark:text-gray-400">Processing</div>
                  </div>
                  <div className="text-center">
                    <div className="text-red-600 dark:text-red-400 font-medium">{stats.failed}</div>
                    <div className="text-gray-500 dark:text-gray-400">Failed</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Upload Timeline */}
            <div className="glassmorphic p-4 rounded-lg">
              <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-sakura-500" />
                Upload Timeline
              </h4>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {documents
                  .sort((a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime())
                  .slice(0, 5)
                  .map((doc) => (
                    <div key={doc.id} className="flex items-center gap-3 text-xs">
                      <div className="w-2 h-2 bg-sakura-500 rounded-full flex-shrink-0"></div>
                      <div className="flex-1 min-w-0">
                        <span className="text-gray-900 dark:text-white truncate">{doc.filename}</span>
                      </div>
                      <div className="text-gray-500 dark:text-gray-400">
                        {formatDate(doc.uploaded_at)}
                      </div>
                    </div>
                  ))}
                {documents.length === 0 && (
                  <div className="text-center text-gray-500 dark:text-gray-400 py-2">
                    No upload history
                  </div>
                )}
              </div>
            </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="h-[94vh] flex flex-col glassmorphic">
      {/* Header */}
      <div className="flex-shrink-0 glassmorphic h-16">
        <div className="flex items-center justify-between px-6 h-full">
          {/* Left side - Back button and notebook info */}
          <div className="flex items-center space-x-4 flex-1 min-w-0">
            <button
              onClick={onClose}
              className="flex items-center space-x-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors group"
            >
              <ArrowLeft className="h-5 w-5 group-hover:-translate-x-1 transition-transform" />
              <span className="text-sm font-medium">Back</span>
            </button>
            
            <div className="h-6 w-px bg-gradient-to-b from-transparent via-gray-300 dark:via-gray-600 to-transparent"></div>
            
            <div className="flex items-center space-x-3 flex-1 min-w-0">
              <div className="p-2 bg-gradient-to-br from-sakura-400 to-sakura-600 rounded-xl shadow-lg">
                <BookOpen className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-xl font-bold text-gray-900 dark:text-white truncate">
                  {notebook.name}
                </h1>
                <div className="flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400">
                  <div className="flex items-center space-x-1">
                    <FileText className="h-4 w-4" />
                    <span>{notebook.document_count} documents</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Bot className="h-4 w-4" />
                    <span>{notebook.llm_provider?.name || 'No AI'}</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Calendar className="h-4 w-4" />
                    <span>{formatDate(notebook.created_at)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main content area - 3 column layout */}
      <div className="flex overflow-hidden" style={{ height: 'calc(96vh - 4rem)' }}>
        {/* Sources Panel (Left) */}
        <div className={`${sourcesCollapsed ? 'w-12' : 'w-80'} transition-all duration-300 glassmorphic flex flex-col`}>
          {/* Sources Header */}
          <div className="flex-shrink-0 flex items-center justify-between p-4">
            {!sourcesCollapsed && (
              <>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <FileText className="h-5 w-5 text-blue-500" />
                  Sources
                </h2>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowUploadModal(true)}
                    className="flex items-center space-x-1 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 shadow-lg hover:shadow-xl backdrop-blur-sm"
                  >
                    <Upload className="h-3 w-3" />
                    <span>Upload</span>
                  </button>
                  
                  <button
                    onClick={() => setShowSettingsModal(true)}
                    className="p-1.5 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-white/20 dark:hover:bg-gray-800/50 rounded-lg transition-all backdrop-blur-sm"
                  >
                    <Settings className="h-4 w-4" />
                  </button>
                  
                  <span className="text-xs text-gray-500 dark:text-gray-400 bg-white/50 dark:bg-gray-700/50 px-2 py-1 rounded-full backdrop-blur-sm">
                    {filteredDocuments.length}
                  </span>
                  <button
                    onClick={() => setSourcesCollapsed(true)}
                    className="p-1 hover:bg-white/20 dark:hover:bg-gray-700/50 rounded-lg transition-all backdrop-blur-sm"
                  >
                    <Minimize2 className="h-4 w-4 text-gray-500" />
                  </button>
                </div>
              </>
            )}
            {sourcesCollapsed && (
              <button
                onClick={() => setSourcesCollapsed(false)}
                className="p-2 hover:bg-white/20 dark:hover:bg-gray-700/50 rounded-lg transition-all w-full flex justify-center backdrop-blur-sm"
              >
                <Maximize2 className="h-4 w-4 text-gray-500" />
              </button>
            )}
          </div>

          {!sourcesCollapsed && (
            <>
              {/* Search */}
              <div className="flex-shrink-0 p-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <input
                    type="text"
                    placeholder="Search documents..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-white/50 dark:bg-gray-900/50 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 rounded-xl focus:outline-none focus:ring-2 focus:ring-sakura-500 focus:bg-white/80 dark:focus:bg-gray-800/80 transition-all backdrop-blur-sm"
                  />
                </div>
              </div>

              {/* Error state */}
              {error && (
                <div className="mx-4 mb-4 p-3 bg-red-50/80 dark:bg-red-900/30 rounded-xl backdrop-blur-sm">
                  <div className="flex items-center">
                    <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 mr-2" />
                    <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
                  </div>
                </div>
              )}

              {/* Documents list */}
              <div className="flex-1 overflow-y-auto px-4 pb-4">
                {isLoading && documents.length === 0 ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-sakura-500"></div>
                    <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">Loading...</span>
                  </div>
                ) : filteredDocuments.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900/30 dark:to-blue-800/30 rounded-2xl flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
                      <FileText className="h-8 w-8 text-blue-500" />
                    </div>
                    <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                      {documents.length === 0 ? 'No documents uploaded' : 'No matching documents'}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                      {documents.length === 0 
                        ? 'Upload your first documents to get started'
                        : 'Try adjusting your search terms'
                      }
                    </p>
                    {documents.length === 0 && (
                      <button
                        onClick={() => setShowUploadModal(true)}
                        className="inline-flex items-center gap-2 bg-gradient-to-r from-sakura-500 to-sakura-600 hover:from-sakura-600 hover:to-sakura-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all shadow-lg backdrop-blur-sm"
                      >
                        <Upload className="h-4 w-4" />
                        Upload Documents
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredDocuments.map((doc) => (
                      <div
                        key={doc.id}
                        onClick={() => setSelectedDocument(doc)}
                        className={`p-4 glassmorphic rounded-xl cursor-pointer transition-all duration-200 ${
                          selectedDocument?.id === doc.id 
                            ? 'ring-2 ring-sakura-500 bg-gradient-to-br from-sakura-50/80 to-pink-50/80 dark:from-sakura-900/30 dark:to-pink-900/30' 
                            : 'hover:bg-white/20 dark:hover:bg-gray-700/30 hover:shadow-lg'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start space-x-3 flex-1 min-w-0">
                            {getFileIcon(doc.filename)}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                {doc.filename}
                              </p>
                              <div className="flex items-center gap-2 mt-1">
                                {getStatusBadge(doc.status, doc.error)}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                {formatDate(doc.uploaded_at)}
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteDocument(doc.id);
                            }}
                            className="p-1 text-gray-400 hover:text-red-600 transition-all ml-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg backdrop-blur-sm"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>

                        {/* Document details when selected */}
                        {selectedDocument?.id === doc.id && (
                          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600 space-y-2">
                            <div className="text-xs text-gray-600 dark:text-gray-400">
                              <div className="grid grid-cols-1 gap-2">
                                <div>
                                  <span className="font-medium">Status:</span> {doc.status}
                                </div>
                                <div>
                                  <span className="font-medium">Upload Date:</span> {formatDate(doc.uploaded_at)}
                                </div>
                              </div>
                              {doc.error && (
                                <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 rounded text-red-600 dark:text-red-400">
                                  <span className="font-medium">Error:</span> {doc.error}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Chat Panel (Center) */}
        <div className="flex-1 glassmorphic flex flex-col">
          <NotebookChat 
            notebookId={notebook.id} 
            documentCount={notebook.document_count}
            completedDocumentCount={documents.filter(doc => doc.status === 'completed').length}
            onDocumentUpload={handleDocumentUpload}
          />
        </div>

        {/* Studio Panel (Right) */}
        <div className={`${studioCollapsed ? 'w-12' : 'w-[500px]'} transition-all duration-300 glassmorphic flex flex-col`}>
          {/* Studio Header */}
          <div className="flex-shrink-0 flex items-center justify-between p-4">
            {!studioCollapsed && (
              <>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-purple-500" />
                  Studio
                </h2>
                <button
                  onClick={() => setStudioCollapsed(true)}
                  className="p-1 hover:bg-white/20 dark:hover:bg-gray-700/50 rounded-lg transition-all backdrop-blur-sm"
                >
                  <Minimize2 className="h-4 w-4 text-gray-500" />
                </button>
              </>
            )}
            {studioCollapsed && (
              <button
                onClick={() => setStudioCollapsed(false)}
                className="p-2 hover:bg-white/20 dark:hover:bg-gray-700/50 rounded-lg transition-all w-full flex justify-center backdrop-blur-sm"
              >
                <Maximize2 className="h-4 w-4 text-gray-500" />
              </button>
            )}
          </div>

          {!studioCollapsed && (
            <div className="flex flex-1 min-h-0">
              {/* Studio Sidebar Navigation */}
              <div className="flex-shrink-0 w-20 bg-white/20 dark:bg-gray-900/40 backdrop-blur-sm border-r border-white/20 dark:border-gray-700/50">
                <div className="flex flex-col items-center gap-2 p-2">
                  {[
                    { id: 'overview', label: 'Cards', icon: Eye, tooltip: 'Knowledge Cards' },
                    { id: 'graph', label: 'Graph', icon: Network, tooltip: 'Knowledge Graph' },
                    { id: 'analytics', label: 'Stats', icon: BarChart3, tooltip: 'Analytics' }
                  ].map((tab) => {
                    const IconComponent = tab.icon;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setStudioActiveTab(tab.id as any)}
                        className={`w-14 h-14 flex flex-col items-center justify-center gap-1 rounded-xl text-xs font-medium transition-all group relative ${
                          studioActiveTab === tab.id
                            ? 'text-sakura-600 dark:text-sakura-400 bg-white/60 dark:bg-gray-800/60 backdrop-blur-md shadow-lg scale-105'
                            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-white/30 dark:hover:bg-gray-800/30 hover:scale-105'
                        }`}
                        title={tab.tooltip}
                      >
                        <IconComponent className="h-5 w-5" />
                        <span className="text-[10px] leading-none">{tab.label}</span>
                        
                        {/* Tooltip */}
                        <div className="absolute left-16 bg-black/80 text-white text-xs px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                          {tab.tooltip}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Studio Content Area */}
              <div className="flex-1 overflow-y-auto">
                {renderStudioContent()}
              </div>
            </div>
          )}
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
          <div className="glassmorphic rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between p-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-gray-500 to-gray-600 rounded-xl text-white shadow-lg">
                  <Settings className="w-5 h-5" />
                </div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  Notebook Settings
                </h2>
              </div>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="p-2 hover:bg-white/20 dark:hover:bg-black/30 rounded-xl transition-all backdrop-blur-sm"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* AI Configuration */}
              <div className="glassmorphic p-6 rounded-lg">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <Bot className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    AI Configuration
                  </h3>
                  {!isEditingLLM && notebook.llm_provider && (
                    <button
                      onClick={() => setIsEditingLLM(true)}
                      className="p-2 hover:bg-white/20 dark:hover:bg-black/30 rounded-xl transition-all backdrop-blur-sm"
                      title="Edit LLM Configuration"
                    >
                      <Edit className="w-4 h-4 text-gray-500" />
                    </button>
                  )}
                </div>
                
                {notebook.llm_provider && notebook.embedding_provider ? (
                  <div className="space-y-4">
                    {/* LLM Configuration */}
                    <div className="p-4 bg-white/50 dark:bg-black/30 rounded-lg">
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
                              className="w-full px-3 py-2 rounded-lg bg-white dark:bg-black text-gray-900 dark:text-white"
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
                              className="w-full px-3 py-2 rounded-lg bg-white dark:bg-black text-gray-900 dark:text-white disabled:opacity-50"
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
                    <div className="p-4 bg-white/50 dark:bg-black/30 rounded-lg">
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
              <div className="glassmorphic p-6 rounded-lg">
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
              <div className="glassmorphic p-6 rounded-xl bg-red-50/50 dark:bg-red-900/10">
                <h3 className="text-lg font-semibold text-red-800 dark:text-red-400 mb-4">Danger Zone</h3>
                <div className="space-y-3">
                  <button
                    onClick={loadDocuments}
                    disabled={!claraNotebookService.isBackendHealthy()}
                    className="w-full px-4 py-2 bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed text-white rounded-xl transition-all shadow-lg"
                  >
                    Refresh All Documents
                  </button>
                  <button
                    onClick={() => {
                      setShowSettingsModal(false);
                      onNotebookDeleted();
                    }}
                    className="w-full px-4 py-2 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white rounded-xl transition-all shadow-lg"
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

export default NotebookDetails_new;
