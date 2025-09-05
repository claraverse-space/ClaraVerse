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
  BarChart3,
  TrendingUp,
  Sparkles,
  PieChart,
  RefreshCw,
  AlertTriangle,
  Maximize2,
  File,
  FileSpreadsheet,
  Presentation,
  Globe,
  FileImage
} from 'lucide-react';
import DocumentUpload from './DocumentUpload';
import CreateDocumentModal from './CreateDocumentModal';
import FileViewerModal from './FileViewerModal';
import NotebookChat from './NotebookChat_clara';
import GraphViewer from './GraphViewer';
import GraphViewerModal from './GraphViewerModal';
import { 
  claraNotebookService, 
  NotebookResponse, 
  NotebookDocumentResponse 
} from '../../services/claraNotebookService';
import { useProviders } from '../../contexts/ProvidersContext';
import { claraApiService } from '../../services/claraApiService';
import { ClaraModel } from '../../types/clara_assistant_types';
import { useClaraCoreAutostart } from '../../hooks/useClaraCoreAutostart';
import ClaraCoreStatusBanner from './ClaraCoreStatusBanner';
import { notebookFileStorage } from '../../services/notebookFileStorage';

interface ChatMessage {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  role?: 'user' | 'assistant';
  citations?: Array<{
    file_path: string;
    title: string;
    content?: string;
  }>;
}

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
  const [showCreateDocModal, setShowCreateDocModal] = useState(false);
  const [showFileViewerModal, setShowFileViewerModal] = useState(false);
  const [selectedDocumentForViewing, setSelectedDocumentForViewing] = useState<NotebookDocumentResponse | null>(null);
  const [localFileAvailability, setLocalFileAvailability] = useState<Record<string, boolean>>({});
  const [showGraphModal, setShowGraphModal] = useState(false);
  const [showGraphViewerModal, setShowGraphViewerModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [isEditingLLM, setIsEditingLLM] = useState(false);
  const [selectedLLMProvider, setSelectedLLMProvider] = useState('');
  const [selectedLLMModel, setSelectedLLMModel] = useState('');
  const [models, setModels] = useState<ClaraModel[]>([]);
  const [studioActiveTab, setStudioActiveTab] = useState<'sources' | 'graph' | 'analytics'>('sources');
  const [selectedDocument, setSelectedDocument] = useState<NotebookDocumentResponse | null>(null);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  
  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [isBackendHealthy, setIsBackendHealthy] = useState(true);
  
  // Clara Core auto-start functionality
  const claraCoreStatus = useClaraCoreAutostart(notebook);
  const [showClaraCoreStatus, setShowClaraCoreStatus] = useState(true);
  
  // Get providers from context
  const { providers } = useProviders();

  // Load documents from API
  useEffect(() => {
    loadDocuments();
  }, [notebook.id]);

  // Check local file availability when documents change
  useEffect(() => {
    checkLocalFileAvailability();
  }, [documents]);

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

  const checkLocalFileAvailability = async () => {
    if (documents.length === 0) return;

    try {
      const availability: Record<string, boolean> = {};
      
      // Check each document's availability in parallel
      const availabilityPromises = documents.map(async (doc) => {
        const isAvailable = await notebookFileStorage.isFileAvailable(doc.id);
        availability[doc.id] = isAvailable;
        return { id: doc.id, available: isAvailable };
      });

      await Promise.all(availabilityPromises);
      setLocalFileAvailability(availability);
    } catch (error) {
      console.error('Failed to check local file availability:', error);
    }
  };

  const handleDocumentClick = (document: NotebookDocumentResponse) => {
    setSelectedDocumentForViewing(document);
    setShowFileViewerModal(true);
  };

  const storeFileLocally = async (file: File, documentId: string) => {
    try {
      await notebookFileStorage.storeFile(documentId, notebook.id, file);
      
      // Update availability state
      setLocalFileAvailability(prev => ({
        ...prev,
        [documentId]: true
      }));
    } catch (error) {
      console.error('Failed to store file locally:', error);
      // Don't throw error - local storage is optional
    }
  };

  const storeTextFileLocally = async (filename: string, content: string, documentId: string) => {
    try {
      await notebookFileStorage.storeTextFile(documentId, notebook.id, filename, content);
      
      // Update availability state
      setLocalFileAvailability(prev => ({
        ...prev,
        [documentId]: true
      }));
    } catch (error) {
      console.error('Failed to store text file locally:', error);
      // Don't throw error - local storage is optional
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
      
      // Text formats
      case 'txt':
      case 'md':
      case 'rtf':
        return <FileText className="w-4 h-4 text-blue-600" />;
      
      // Microsoft Office Document formats
      case 'doc':
      case 'docx':
      case 'odt':
        return <File className="w-4 h-4 text-blue-700" />;
      
      // Spreadsheet formats
      case 'xls':
      case 'xlsx':
      case 'ods':
        return <FileSpreadsheet className="w-4 h-4 text-green-600" />;
      
      // Presentation formats
      case 'ppt':
      case 'pptx':
      case 'odp':
        return <Presentation className="w-4 h-4 text-orange-600" />;
      
      // Web formats
      case 'html':
      case 'htm':
      case 'xml':
        return <Globe className="w-4 h-4 text-purple-600" />;
      
      // Data formats
      case 'csv':
      case 'json':
        return <FileType className="w-4 h-4 text-green-600" />;
      
      // Image formats (for reference, though not processed as documents)
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
      case 'bmp':
      case 'svg':
        return <FileImage className="w-4 h-4 text-pink-600" />;
      
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
          <div className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-400 rounded-full text-xs font-medium" title={error ? `Error: ${error}. Click retry button to try again.` : "Processing failed. Click retry button to try again."}>
            <XCircle className="w-3 h-3" />
            Failed - Click retry
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
      
      // Store files locally in IndexedDB (in parallel with upload)
      const storePromises = files.map((file, index) => {
        const doc = uploadedDocs[index];
        if (doc) {
          return storeFileLocally(file, doc.id);
        }
        return Promise.resolve();
      });
      
      // Don't await - let local storage happen in background
      Promise.all(storePromises).catch(error => {
        console.warn('Some files could not be stored locally:', error);
      });
      
      // Add new documents to the list
      setDocuments(prev => [...uploadedDocs, ...prev]);
      
      // Update notebook document count
      const updatedNotebook = {
        ...notebook,
        document_count: notebook.document_count + uploadedDocs.length
      };
      onNotebookUpdated(updatedNotebook);
      
      setShowUploadModal(false);
      setShowCreateDocModal(false);
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
      
      // Remove from local storage (don't await - it's optional)
      notebookFileStorage.deleteFile(documentId).catch(error => {
        console.warn('Failed to delete file from local storage:', error);
      });
      
      // Remove from local state
      setDocuments(prev => prev.filter(doc => doc.id !== documentId));
      
      // Update availability state
      setLocalFileAvailability(prev => {
        const updated = { ...prev };
        delete updated[documentId];
        return updated;
      });
      
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

  const handleRetryDocument = async (documentId: string) => {
    if (!claraNotebookService.isBackendHealthy()) {
      setError('Notebook backend is not available');
      return;
    }

    try {
      // Call the retry API
      const retryResponse = await claraNotebookService.retryDocument(notebook.id, documentId);
      
      // Update the document status in local state
      setDocuments(prev => prev.map(doc => 
        doc.id === documentId 
          ? { ...doc, status: 'processing' as const, error: undefined }
          : doc
      ));
      
      // Show success notification
      setNotification({ 
        message: 'Document retry initiated successfully. Processing will resume from where it failed.', 
        type: 'success' 
      });
      
      console.log('Document retry initiated:', retryResponse.message);
    } catch (error) {
      console.error('Failed to retry document:', error);
      setError(error instanceof Error ? error.message : 'Failed to retry document');
      
      // Show error notification
      setNotification({ 
        message: error instanceof Error ? error.message : 'Failed to retry document', 
        type: 'error' 
      });
    }
  };

  // Auto-clear notifications after 5 seconds
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => {
        setNotification(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

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

  // Chat functionality
  const checkBackendHealth = async () => {
    const healthy = claraNotebookService.isBackendHealthy();
    setIsBackendHealthy(healthy);
    return healthy;
  };

  const handleSendMessage = async (message: string) => {
    if (!message.trim()) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: message.trim(),
      timestamp: new Date(),
      role: 'user'
    };

    setChatMessages(prev => [...prev, userMessage]);
    setIsChatLoading(true);

    try {
      const response = await claraNotebookService.sendChatMessage(notebook.id, {
        question: message.trim(),
        use_chat_history: true
      });
      
      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: response.answer || 'Sorry, I could not process your request.',
        timestamp: new Date(),
        role: 'assistant',
        citations: response.citations || []
      };

      setChatMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Failed to send message:', error);
      
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: 'Sorry, I encountered an error while processing your message. Please try again.',
        timestamp: new Date(),
        role: 'assistant'
      };

      setChatMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsChatLoading(false);
    }
  };

  // Check backend health on component mount
  useEffect(() => {
    checkBackendHealth();
    const interval = setInterval(checkBackendHealth, 30000); // Check every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const stats = getDocumentStats();

  const renderStudioContent = () => {
    switch (studioActiveTab) {
      case 'sources':
        return (
          <div className="h-full flex flex-col">
            {/* Sources Header Actions - More compact */}
            <div className="flex-shrink-0 p-4 border-b border-white/20 dark:border-gray-800/30">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-bold bg-gradient-to-r from-blue-600 to-cyan-600 dark:from-blue-400 dark:to-cyan-400 bg-clip-text text-transparent flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-500" />
                  Sources
                </h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowCreateDocModal(true)}
                    className="glassmorphic bg-white/60 dark:bg-gray-800/60 px-3 py-1.5 rounded-lg border border-white/30 dark:border-gray-700/30 shadow-md flex items-center space-x-1.5 hover:bg-white/80 dark:hover:bg-gray-800/80 transition-all"
                  >
                    <FileText className="h-3 w-3 text-xs font-semibold text-sakura-600 dark:text-sakura-400" />
                    <span className="text-xs font-semibold text-sakura-700 dark:text-sakura-300">Create Doc</span>
                  </button>
                  <button
                    onClick={() => setShowUploadModal(true)}
                    className="glassmorphic bg-white/60 dark:bg-gray-800/60 px-3 py-1.5 rounded-lg border border-white/30 dark:border-gray-700/30 shadow-md flex items-center space-x-1.5 hover:bg-white/80 dark:hover:bg-gray-800/80 transition-all"
                  >
                    <Upload className="h-3 w-3 text-xs font-semibold text-gray-700 dark:text-gray-300" />
                    <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">Upload Docs</span>
                  </button>
                  
                </div>
              </div>
              
              {/* Search - More compact */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 h-4 w-4" />
                <input
                  type="text"
                  placeholder="Search documents..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 glassmorphic bg-white/60 dark:bg-gray-800/60 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 dark:focus:ring-blue-400/50 dark:focus:border-blue-400/50 transition-all duration-200 border border-white/30 dark:border-gray-700/30 shadow-md backdrop-blur-xl text-sm"
                />
              </div>
            </div>

            {/* Error state - More compact */}
            {error && (
              <div className="mx-4 mt-3 glassmorphic bg-red-50/90 dark:bg-red-900/40 border border-red-200/50 dark:border-red-700/30 rounded-lg p-3 backdrop-blur-xl shadow-md">
                <div className="flex items-center">
                  <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 mr-2" />
                  <p className="text-xs font-medium text-red-800 dark:text-red-200">{error}</p>
                </div>
              </div>
            )}

            {/* Documents list - More compact */}
            <div className="flex-1 overflow-y-auto px-4 pb-4 custom-scrollbar">
              {isLoading && documents.length === 0 ? (
                <div className="flex items-center justify-center py-8">
                  <div className="glassmorphic bg-white/60 dark:bg-gray-800/60 rounded-xl p-6 border border-white/30 dark:border-gray-700/30 shadow-lg backdrop-blur-xl">
                    <div className="flex flex-col items-center space-y-3">
                      <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-500 border-t-transparent"></div>
                      <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Loading documents...</span>
                    </div>
                  </div>
                </div>
              ) : filteredDocuments.length === 0 ? (
                <div className="text-center py-8">
                  <div className="glassmorphic bg-white/60 dark:bg-gray-800/60 rounded-lg p-4 border border-white/30 dark:border-gray-700/30 shadow-md backdrop-blur-xl mx-auto max-w-xs">
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center mx-auto mb-3 shadow-md">
                      <FileText className="h-4 w-4 text-white" />
                    </div>
                    <h3 className="text-xs font-bold text-gray-900 dark:text-white mb-2">
                      {documents.length === 0 ? 'No documents yet' : 'No matches'}
                    </h3>
                    <p className="text-[10px] text-gray-600 dark:text-gray-400 mb-3 leading-relaxed">
                      {documents.length === 0 
                        ? 'Upload documents to start building your knowledge base.'
                        : 'Try adjusting your search terms.'
                      }
                    </p>
                    {documents.length === 0 && (
                      <div className="flex items-center gap-2 justify-center">
                        <button
                          onClick={() => setShowCreateDocModal(true)}
                          className="inline-flex items-center gap-1 glassmorphic bg-gradient-to-r from-sakura-500 to-pink-500 hover:from-sakura-600 hover:to-pink-600 text-white px-3 py-1.5 rounded-lg text-[10px] font-semibold transition-all duration-200 shadow-md hover:shadow-lg border border-white/20"
                        >
                          <FileText className="h-2.5 w-2.5" />
                          Create Document
                        </button>
                        <button
                          onClick={() => setShowUploadModal(true)}
                          className="inline-flex items-center gap-1 glassmorphic bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white px-3 py-1.5 rounded-lg text-[10px] font-semibold transition-all duration-200 shadow-md hover:shadow-lg border border-white/20"
                        >
                          <Upload className="h-2.5 w-2.5" />
                          Upload Documents
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-3 mt-4">
                  {filteredDocuments.map((doc) => (
                    <div
                      key={doc.id}
                      className={`glassmorphic rounded-lg cursor-pointer transition-all duration-200 border backdrop-blur-xl shadow-md hover:shadow-lg ${
                        selectedDocument?.id === doc.id 
                          ? 'ring-1 ring-blue-500/50 bg-blue-50/80 dark:bg-blue-900/30 border-blue-200/50 dark:border-blue-700/30' 
                          : 'bg-white/60 dark:bg-gray-800/60 border-white/30 dark:border-gray-700/30 hover:bg-white/80 dark:hover:bg-gray-800/80 hover:border-gray-300/50 dark:hover:border-gray-600/50'
                      }`}
                    >
                      <div className="p-3">
                        <div className="flex items-center justify-between">
                          <div 
                            className="flex items-center space-x-3 flex-1 min-w-0 cursor-pointer"
                            onClick={() => {
                              setSelectedDocument(doc);
                              handleDocumentClick(doc);
                            }}
                          >
                            <div className="relative p-1.5 glassmorphic bg-white/60 dark:bg-gray-700/60 rounded-lg border border-white/30 dark:border-gray-600/30">
                              {getFileIcon(doc.filename)}
                              {/* Local availability indicator */}
                              {localFileAvailability[doc.id] && (
                                <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-gray-800 shadow-sm" title="Available locally" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <p className="text-xs font-semibold text-gray-900 dark:text-white truncate">
                                  {doc.filename}
                                </p>
                                {localFileAvailability[doc.id] && (
                                  <span className="text-[8px] bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-1.5 py-0.5 rounded-full font-medium">
                                    LOCAL
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mb-1">
                                {getStatusBadge(doc.status, doc.error)}
                              </div>
                              <div className="text-[10px] font-medium text-gray-500 dark:text-gray-400">
                                {formatDate(doc.uploaded_at)}
                                {localFileAvailability[doc.id] && (
                                  <span className="ml-2 text-green-600 dark:text-green-400">• Click to view</span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 ml-3">
                            {/* Show retry button for failed documents */}
                            {doc.status === 'failed' && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRetryDocument(doc.id);
                                }}
                                className="p-1.5 glassmorphic bg-white/60 dark:bg-gray-700/60 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-all duration-200 rounded-lg border border-white/30 dark:border-gray-600/30 shadow-sm hover:shadow-md"
                              >
                                <RefreshCw className="h-3 w-3" />
                              </button>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteDocument(doc.id);
                              }}
                              className="p-1.5 glassmorphic bg-white/60 dark:bg-gray-700/60 hover:bg-red-50 dark:hover:bg-red-900/30 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-all duration-200 rounded-lg border border-white/30 dark:border-gray-600/30 shadow-sm hover:shadow-md"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </div>

                        {/* Document details when selected - Compact */}
                        {selectedDocument?.id === doc.id && (
                          <div className="mt-3 pt-3 border-t border-white/30 dark:border-gray-700/30 space-y-2 animate-in slide-in-from-top-2 fade-in-0">
                            <div className="text-[10px] text-gray-600 dark:text-gray-400">
                              <div className="grid grid-cols-2 gap-2">
                                <div className="glassmorphic bg-white/40 dark:bg-gray-700/40 p-2 rounded-lg border border-white/20 dark:border-gray-600/20">
                                  <span className="font-semibold text-gray-700 dark:text-gray-300">Status:</span>
                                  <span className="ml-1 font-medium">{doc.status}</span>
                                </div>
                                <div className="glassmorphic bg-white/40 dark:bg-gray-700/40 p-2 rounded-lg border border-white/20 dark:border-gray-600/20">
                                  <span className="font-semibold text-gray-700 dark:text-gray-300">Uploaded:</span>
                                  <span className="ml-1 font-medium">{formatDate(doc.uploaded_at)}</span>
                                </div>
                              </div>
                              {doc.error && (
                                <div className="mt-2 glassmorphic bg-red-50/80 dark:bg-red-900/30 rounded-lg border border-red-200/50 dark:border-red-700/30 p-2 backdrop-blur-sm">
                                  <div className="text-red-600 dark:text-red-400 text-[10px] font-medium mb-2">
                                    <span className="font-semibold">Error:</span> {doc.error}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleRetryDocument(doc.id);
                                      }}
                                      className="inline-flex items-center gap-1 glassmorphic bg-blue-600 hover:bg-blue-700 text-white text-[10px] px-2 py-1 rounded-lg transition-all duration-200 border border-blue-500/30 shadow-md hover:shadow-lg font-semibold"
                                    >
                                      <RefreshCw className="w-2.5 h-2.5" />
                                      Retry
                                    </button>
                                    <span className="text-[9px] text-gray-500 dark:text-gray-400">
                                      Skips processed chunks
                                    </span>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );

      case 'graph':
        return (
          <div className="h-full flex flex-col">
            {/* Graph Header with Full View Button */}
            <div className="flex-shrink-0 p-4 border-b border-white/20 dark:border-gray-800/30">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold bg-gradient-to-r from-green-600 to-emerald-600 dark:from-green-400 dark:to-emerald-400 bg-clip-text text-transparent flex items-center gap-2">
                  <Network className="w-5 h-5 text-green-500" />
                  Knowledge Graph
                </h3>
                <button
                  onClick={() => setShowGraphViewerModal(true)}
                  className="glassmorphic bg-white/60 dark:bg-gray-800/60 px-3 py-1.5 rounded-lg border border-white/30 dark:border-gray-700/30 shadow-md flex items-center space-x-1.5 hover:bg-white/80 dark:hover:bg-gray-800/80 transition-all"
                >
                  <Maximize2 className="h-3 w-3 text-green-600 dark:text-green-400" />
                  <span className="text-xs font-semibold text-green-700 dark:text-green-300">Open 3D View</span>
                </button>
              </div>
            </div>

            {/* Graph Content */}
            <div className="flex-1 p-1">
              <div className="h-full glassmorphic rounded-2xl overflow-hidden bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl border border-white/30 dark:border-gray-700/30 shadow-xl">
                <div className="h-full bg-gradient-to-br from-white/80 to-white/40 dark:from-gray-900/80 dark:to-gray-900/40 backdrop-blur-sm">
                  <GraphViewer 
                    notebookId={notebook.id}
                    onViewFull={() => setShowGraphViewerModal(true)}
                  />
                </div>
              </div>
            </div>
          </div>
        );

      case 'analytics':
        return (
          // text is white in dark mode but in light mode text should be dark  a
          <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar">
            <div className="glassmorphic bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl border border-white/30 dark:border-gray-700/30 rounded-2xl p-6 shadow-xl">
              <h3 className="text-xl font-bold bg-gradient-to-r from-purple-600 to-violet-600 dark:from-purple-400 dark:to-violet-400 bg-clip-text text-transparent mb-6 flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-purple-500 to-violet-500 rounded-xl shadow-lg">
                  <BarChart3 className="w-5 h-5 text-white" />
                </div>
                Analytics Dashboard
              </h3>
              
              {/* Document Type Distribution */}
              <div className="glassmorphic bg-white/40 dark:bg-gray-700/40 border border-white/20 dark:border-gray-600/20 p-5 rounded-xl mb-6 backdrop-blur-sm shadow-lg">
                <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl shadow-lg">
                    <PieChart className="w-4 h-4 text-white" />
                  </div>
                  Document Types
                </h4>
                <div className="space-y-3">
                  {(() => {
                    const typeCount: Record<string, number> = {};
                    documents.forEach(doc => {
                      const ext = doc.filename.split('.').pop()?.toLowerCase() || 'unknown';
                      typeCount[ext] = (typeCount[ext] || 0) + 1;
                    });
                    
                    return Object.entries(typeCount).map(([type, count]) => (
                      <div key={type} className="flex items-center justify-between glassmorphic bg-white/50 dark:bg-gray-800/50 p-3 rounded-xl border border-white/20 dark:border-gray-600/20">
                        <div className="flex items-center gap-3">
                          <div className="p-2 glassmorphic bg-white/60 dark:bg-gray-700/60 rounded-lg border border-white/30 dark:border-gray-600/30">
                            {getFileIcon(`file.${type}`)}
                          </div>
                          <span className="text-sm font-semibold text-gray-900 dark:text-white capitalize">{type}</span>
                        </div>
                        <div className="glassmorphic bg-white/60 dark:bg-gray-700/60 px-3 py-1 rounded-lg border border-white/30 dark:border-gray-600/30">
                          <span className="text-sm font-bold text-gray-700 dark:text-gray-300">{count}</span>
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              </div>

              {/* Processing Status */}
              <div className="glassmorphic bg-white/40 dark:bg-gray-700/40 border border-white/20 dark:border-gray-600/20 p-5 rounded-xl mb-6 backdrop-blur-sm shadow-lg">
                <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl shadow-lg">
                    <BarChart3 className="w-4 h-4 text-white" />
                  </div>
                  Processing Status
                </h4>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Success Rate</span>
                    <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400 glassmorphic bg-emerald-50/80 dark:bg-emerald-900/30 px-3 py-1 rounded-xl border border-emerald-200/50 dark:border-emerald-600/30">
                      {stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0}%
                    </span>
                  </div>
                  <div className="w-full glassmorphic bg-gray-200/60 dark:bg-gray-600/60 rounded-full h-3 border border-white/20 dark:border-gray-500/20 overflow-hidden">
                    <div 
                      className="bg-gradient-to-r from-emerald-500 to-green-500 h-3 rounded-full transition-all duration-1000 ease-out shadow-lg"
                      style={{ width: `${stats.total > 0 ? (stats.completed / stats.total) * 100 : 0}%` }}
                    ></div>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-xs">
                    <div className="text-center glassmorphic bg-emerald-50/80 dark:bg-emerald-900/30 p-3 rounded-xl border border-emerald-200/50 dark:border-emerald-600/30">
                      <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{stats.completed}</div>
                      <div className="text-gray-600 dark:text-gray-400 font-medium">Completed</div>
                    </div>
                    <div className="text-center glassmorphic bg-blue-50/80 dark:bg-blue-900/30 p-3 rounded-xl border border-blue-200/50 dark:border-blue-600/30">
                      <div className="text-lg font-bold text-blue-600 dark:text-blue-400">{stats.processing}</div>
                      <div className="text-gray-600 dark:text-gray-400 font-medium">Processing</div>
                    </div>
                    <div className="text-center glassmorphic bg-red-50/80 dark:bg-red-900/30 p-3 rounded-xl border border-red-200/50 dark:border-red-600/30">
                      <div className="text-lg font-bold text-red-600 dark:text-red-400">{stats.failed}</div>
                      <div className="text-gray-600 dark:text-gray-400 font-medium">Failed</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Failed Documents - Retry Available */}
              {stats.failed > 0 && (
                <div className="glassmorphic bg-red-50/80 dark:bg-red-900/30 border border-red-200/50 dark:border-red-700/30 p-5 rounded-xl mb-6 backdrop-blur-sm shadow-lg">
                  <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-red-500 to-pink-500 rounded-xl shadow-lg">
                      <RefreshCw className="w-4 h-4 text-white" />
                    </div>
                    Failed Documents
                  </h4>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between glassmorphic bg-white/60 dark:bg-gray-800/60 p-3 rounded-xl border border-white/20 dark:border-gray-600/20">
                      <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Ready for Retry</span>
                      <span className="text-sm font-bold text-red-600 dark:text-red-400 glassmorphic bg-red-50/80 dark:bg-red-900/40 px-3 py-1 rounded-lg border border-red-200/50 dark:border-red-600/30">
                        {stats.failed} document{stats.failed !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400 font-medium glassmorphic bg-white/40 dark:bg-gray-700/40 p-3 rounded-xl border border-white/20 dark:border-gray-600/20">
                      Click the retry button next to any failed document to resume processing. 
                      LightRAG will skip chunks that were already processed successfully.
                    </div>
                  </div>
                </div>
              )}

              {/* Upload Timeline */}
              <div className="glassmorphic bg-white/40 dark:bg-gray-700/40 border border-white/20 dark:border-gray-600/20 p-5 rounded-xl backdrop-blur-sm shadow-lg">
                <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl shadow-lg">
                    <TrendingUp className="w-4 h-4 text-white" />
                  </div>
                  Upload Timeline
                </h4>
                <div className="space-y-3 max-h-40 overflow-y-auto custom-scrollbar">
                  {documents
                    .sort((a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime())
                    .slice(0, 5)
                    .map((doc) => (
                      <div key={doc.id} className="flex items-center gap-4 text-xs glassmorphic bg-white/50 dark:bg-gray-800/50 p-3 rounded-xl border border-white/20 dark:border-gray-600/20">
                        <div className="w-3 h-3 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex-shrink-0 shadow-lg"></div>
                        <div className="flex-1 min-w-0">
                          <span className="text-gray-900 dark:text-white font-semibold truncate block">{doc.filename}</span>
                        </div>
                        <div className="text-gray-600 dark:text-gray-400 font-medium glassmorphic bg-white/60 dark:bg-gray-700/60 px-2 py-1 rounded-lg border border-white/30 dark:border-gray-600/30">
                          {formatDate(doc.uploaded_at)}
                        </div>
                      </div>
                    ))}
                  {documents.length === 0 && (
                    <div className="text-center text-gray-600 dark:text-gray-400 py-6 glassmorphic bg-white/40 dark:bg-gray-700/40 rounded-xl border border-white/20 dark:border-gray-600/20">
                      <div className="font-medium">No upload history</div>
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
    <div className="h-[calc(100vh-4rem)] flex flex-col bg-gradient-to-br from-sakura-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800 relative overflow-hidden">
      {/* Notification Toast */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 glassmorphic rounded-xl shadow-2xl backdrop-blur-xl transition-all duration-500 transform ${
          notification.type === 'success' 
            ? 'bg-emerald-50/90 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-200 border border-emerald-200/50 dark:border-emerald-600/30' 
            : 'bg-red-50/90 dark:bg-red-900/50 text-red-800 dark:text-red-200 border border-red-200/50 dark:border-red-600/30'
        } animate-in slide-in-from-top-2 fade-in-0`}>
          <div className="flex items-start gap-3 p-3">
            <div className="flex-shrink-0">
              {notification.type === 'success' ? (
                <CheckCircle className="w-4 h-4" />
              ) : (
                <XCircle className="w-4 h-4" />
              )}
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">{notification.message}</p>
            </div>
            <button
              onClick={() => setNotification(null)}
              className="flex-shrink-0 ml-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors rounded-lg p-1 hover:bg-white/20"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}
      
      {/* Header - Compact and responsive */} 
      <div className="flex-shrink-0 glassmorphic bg-white/60 dark:bg-gray-900/40 backdrop-blur-xl border-b border-white/20 dark:border-gray-800/30 shadow-lg">
        <div className="flex items-center justify-between px-4 py-2 min-h-[60px]">
          {/* Left side - Back button and notebook info */}
          <div className="flex items-center space-x-3 lg:space-x-4 flex-1 min-w-0">
            <button
              onClick={onClose}
              className="flex items-center space-x-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-all duration-200 group glassmorphic px-3 py-2 rounded-lg bg-white/50 dark:bg-gray-800/50 hover:bg-white/70 dark:hover:bg-gray-800/70 border border-white/30 dark:border-gray-700/30"
            >
              <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
              <span className="text-sm font-medium hidden sm:inline">Back</span>
            </button>
            
            <div className="h-6 w-px bg-gradient-to-b from-transparent via-gray-300/50 dark:via-gray-600/50 to-transparent hidden sm:block"></div>
            
            <div className="flex items-center space-x-3 flex-1 min-w-0">
              <div className="p-2 bg-gradient-to-br from-sakura-500 to-blue-500 rounded-xl shadow-lg">
                <BookOpen className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-lg font-bold bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300 bg-clip-text text-transparent truncate">
                  {notebook.name}
                </h1>
                <div className="flex items-center space-x-3 lg:space-x-4 text-xs text-gray-500 dark:text-gray-400">
                  <div className="flex items-center space-x-1">
                    <FileText className="h-3 w-3" />
                    <span>{notebook.document_count} docs</span>
                  </div>
                  <div className="flex items-center space-x-1 hidden sm:flex">
                    <Bot className="h-3 w-3" />
                    <span className="truncate max-w-24">{notebook.llm_provider?.name || 'No AI'}</span>
                  </div>
                  <div className="flex items-center space-x-1 hidden lg:flex">
                    <Calendar className="h-3 w-3" />
                    <span>{formatDate(notebook.created_at)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main content area - 2 column layout with proper height constraints */}
      <div className="flex-1 flex overflow-hidden relative min-h-0">
        {/* Studio Panel (Left) - Contains Sources, Graph, and Analytics */}
        <div className="w-[320px] sm:w-[400px] lg:w-[480px] max-w-[50vw] xl:max-w-[40vw] glassmorphic bg-white/40 dark:bg-gray-900/30 backdrop-blur-xl border-r border-white/20 dark:border-gray-800/30 flex flex-col shadow-2xl relative z-10">
          {/* Studio Header - More compact */}
          <div className="flex-shrink-0 flex items-center justify-between p-3 border-b border-white/20 dark:border-gray-800/30">
            <h2 className="text-lg font-bold bg-gradient-to-r from-purple-600 to-pink-600 dark:from-purple-400 dark:to-pink-400 bg-clip-text text-transparent flex items-center gap-2">
              <div className="p-1.5 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg shadow-lg">
                <Sparkles className="h-4 w-4 text-white drop-shadow-md" />
              </div>
              Studio
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowSettingsModal(true)}
                className="p-2 glassmorphic bg-white/50 dark:bg-gray-800/50 hover:bg-white/70 dark:hover:bg-gray-800/70 rounded-lg transition-all duration-200 border border-white/30 dark:border-gray-700/30 text-gray-700 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white shadow-lg"
                title="Settings"
              >
                <Settings className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex flex-1 min-h-0">
              {/* Studio Sidebar Navigation */}
              <div className=" flex-shrink-0 w-16 sm:w-20 border-r border-white/20 dark:border-gray-800/30 ">
                <div className="flex flex-col items-center gap-2 p-2">
                  {[
                    { id: 'sources', label: 'Sources', icon: FileText, color: 'from-blue-500 to-cyan-500', solidColor: 'bg-blue-600' },
                    { id: 'graph', label: 'Graph', icon: Network, color: 'from-green-500 to-emerald-500', solidColor: 'bg-green-600' },
                    { id: 'analytics', label: 'Analytics', icon: BarChart3, color: 'from-purple-500 to-violet-500', solidColor: 'bg-purple-600' }
                  ].map((tab) => {
                    const IconComponent = tab.icon;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setStudioActiveTab(tab.id as any)}
                        className={`w-12 h-12 sm:w-14 sm:h-14 flex flex-col items-center justify-center gap-0.5 rounded-xl text-xs font-medium transition-all duration-200 border shadow-md ${
                          studioActiveTab === tab.id
                            ? `${tab.solidColor} dark:bg-gradient-to-br dark:${tab.color} text-white border-white/30 shadow-lg`
                            : 'bg-white/60 dark:bg-gray-800/60 border-white/30 dark:border-gray-700/30 text-gray-700 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-white/80 dark:hover:bg-gray-800/80 hover:shadow-lg'
                        }`}
                      >
                        <IconComponent className={`h-3 w-3 sm:h-4 sm:w-4 ${
                          studioActiveTab === tab.id ? 'text-white filter drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]' : ''
                        }`} />
                        <span className={`text-[8px] sm:text-[9px] leading-none font-semibold hidden sm:block ${
                          studioActiveTab === tab.id ? 'text-white filter drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]' : ''
                        }`}>{tab.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Studio Content Area */}
              <div className="flex-1 overflow-y-auto min-h-0">
                {renderStudioContent()}
              </div>
            </div>
        </div>

        {/* Chat Panel (Right) - Takes remaining space and is responsive */}
        <div className="flex-1 glassmorphic bg-white/30 dark:bg-gray-900/20 backdrop-blur-xl flex flex-col relative min-w-0">
          <NotebookChat 
            notebookId={notebook.id} 
            messages={chatMessages}
            onSendMessage={handleSendMessage}
            isLoading={isChatLoading}
            documentCount={notebook.document_count}
            completedDocumentCount={documents.filter(doc => doc.status === 'completed').length}
            isBackendHealthy={isBackendHealthy}
            onDocumentUpload={handleDocumentUpload}
          />
        </div>
      </div>

      {/* Modals */}
      {showUploadModal && (
        <DocumentUpload 
          onClose={() => setShowUploadModal(false)}
          onUpload={handleDocumentUpload}
        />
      )}

      {showCreateDocModal && (
        <CreateDocumentModal 
          onClose={() => setShowCreateDocModal(false)}
          onUpload={handleDocumentUpload}
          onTextFileCreated={(filename, content, documentId) => {
            // Store text file locally after it's uploaded
            storeTextFileLocally(filename, content, documentId);
          }}
        />
      )}

      {showFileViewerModal && selectedDocumentForViewing && (
        <FileViewerModal 
          documentId={selectedDocumentForViewing.id}
          filename={selectedDocumentForViewing.filename}
          onClose={() => {
            setShowFileViewerModal(false);
            setSelectedDocumentForViewing(null);
          }}
        />
      )}

      {showGraphModal && (
        <GraphViewer 
          notebookId={notebook.id}
          onClose={() => setShowGraphModal(false)}
        />
      )}

      {showGraphViewerModal && (
        <GraphViewerModal
          notebookId={notebook.id}
          onClose={() => setShowGraphViewerModal(false)}
          initialViewMode="html"
        />
      )}

      {/* Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="glassmorphic bg-white/80 dark:bg-gray-900/80 backdrop-blur-2xl rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden border border-white/30 dark:border-gray-700/30">
            {/* Header */}
            <div className="flex items-center justify-between p-8 border-b border-white/20 dark:border-gray-800/30">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-gradient-to-br from-gray-500 to-gray-600 rounded-2xl text-white shadow-lg">
                  <Settings className="w-6 h-6" />
                </div>
                <h2 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">
                  Notebook Settings
                </h2>
              </div>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="p-3 glassmorphic bg-white/60 dark:bg-gray-800/60 hover:bg-white/80 dark:hover:bg-gray-800/80 rounded-2xl transition-all duration-200 border border-white/30 dark:border-gray-700/30 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 shadow-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-8 space-y-8 overflow-y-auto custom-scrollbar max-h-[calc(90vh-120px)]">
              {/* AI Configuration */}
              <div className="glassmorphic bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl p-6 rounded-2xl border border-white/30 dark:border-gray-700/30 shadow-xl">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 dark:from-blue-400 dark:to-cyan-400 bg-clip-text text-transparent flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl shadow-lg">
                      <Bot className="w-5 h-5 text-white" />
                    </div>
                    AI Configuration
                  </h3>
                  {!isEditingLLM && notebook.llm_provider && (
                    <button
                      onClick={() => setIsEditingLLM(true)}
                      className="p-2 glassmorphic bg-white/60 dark:bg-gray-700/60 hover:bg-white/80 dark:hover:bg-gray-700/80 rounded-xl transition-all duration-200 border border-white/30 dark:border-gray-600/30 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 shadow-lg"
                      title="Edit LLM Configuration"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                  )}
                </div>
                
                {notebook.llm_provider && notebook.embedding_provider ? (
                  <div className="space-y-6">
                    {/* LLM Configuration */}
                    <div className="glassmorphic bg-white/50 dark:bg-gray-700/50 backdrop-blur-sm p-5 rounded-xl border border-white/20 dark:border-gray-600/20 shadow-lg">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl shadow-lg">
                          <Bot className="w-4 h-4 text-white" />
                        </div>
                        <span className="font-bold text-gray-700 dark:text-gray-300">Language Model</span>
                      </div>
                      {isEditingLLM ? (
                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2">Provider</label>
                            <select
                              value={selectedLLMProvider}
                              onChange={(e) => {
                                setSelectedLLMProvider(e.target.value);
                                setSelectedLLMModel('');
                              }}
                              className="w-full px-4 py-3 glassmorphic bg-white/60 dark:bg-gray-800/60 text-gray-900 dark:text-white rounded-xl border border-white/30 dark:border-gray-700/30 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all backdrop-blur-sm shadow-lg"
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
                            <label className="block text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2">Model</label>
                            <select
                              value={selectedLLMModel}
                              onChange={(e) => setSelectedLLMModel(e.target.value)}
                              disabled={!selectedLLMProvider}
                              className="w-full px-4 py-3 glassmorphic bg-white/60 dark:bg-gray-800/60 text-gray-900 dark:text-white rounded-xl border border-white/30 dark:border-gray-700/30 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all backdrop-blur-sm shadow-lg disabled:opacity-50"
                            >
                              <option value="">Select Model</option>
                              {selectedLLMProvider && getLLMModels(selectedLLMProvider).map(model => (
                                <option key={model.id} value={model.name}>
                                  {model.name}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="flex gap-3 pt-2">
                            <button
                              onClick={handleUpdateLLM}
                              className="px-6 py-3 glassmorphic bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-all duration-200 border border-emerald-500/30 shadow-lg hover:shadow-xl font-semibold"
                            >
                              Save Changes
                            </button>
                            <button
                              onClick={() => setIsEditingLLM(false)}
                              className="px-6 py-3 glassmorphic bg-gray-600 hover:bg-gray-700 text-white rounded-xl transition-all duration-200 border border-gray-500/30 shadow-lg hover:shadow-xl font-semibold"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="glassmorphic bg-white/40 dark:bg-gray-800/40 p-4 rounded-xl border border-white/20 dark:border-gray-600/20">
                          <div className="font-bold text-gray-900 dark:text-white">{notebook.llm_provider.name}</div>
                          <div className="text-sm text-gray-600 dark:text-gray-400 font-medium">{notebook.llm_provider.model}</div>
                        </div>
                      )}
                    </div>
                    
                    {/* Embedding Configuration */}
                    <div className="glassmorphic bg-white/50 dark:bg-gray-700/50 backdrop-blur-sm p-5 rounded-xl border border-white/20 dark:border-gray-600/20 shadow-lg">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl shadow-lg">
                          <Layers className="w-4 h-4 text-white" />
                        </div>
                        <span className="font-bold text-gray-700 dark:text-gray-300">Embedding Model</span>
                      </div>
                      <div className="glassmorphic bg-white/40 dark:bg-gray-800/40 p-4 rounded-xl border border-white/20 dark:border-gray-600/20">
                        <div className="font-bold text-gray-900 dark:text-white">{notebook.embedding_provider.name}</div>
                        <div className="text-sm text-gray-600 dark:text-gray-400 font-medium">{notebook.embedding_provider.model}</div>
                        <div className="text-xs text-amber-600 dark:text-amber-400 mt-3 flex items-center gap-2 glassmorphic bg-amber-50/80 dark:bg-amber-900/30 p-2 rounded-lg border border-amber-200/50 dark:border-amber-600/30">
                          <AlertCircle className="w-3 h-3 flex-shrink-0" />
                          <span className="font-medium">Cannot be changed (dimensions fixed once created)</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 glassmorphic bg-white/40 dark:bg-gray-700/40 rounded-xl border border-white/20 dark:border-gray-600/20">
                    <div className="text-gray-500 dark:text-gray-400 font-medium">
                      Provider configuration not available (legacy notebook)
                    </div>
                  </div>
                )}
              </div>

              {/* System Status */}
              <div className="glassmorphic bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl p-6 rounded-2xl border border-white/30 dark:border-gray-700/30 shadow-xl">
                <h3 className="text-xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 dark:from-green-400 dark:to-emerald-400 bg-clip-text text-transparent mb-6 flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl shadow-lg">
                    <Sparkles className="w-5 h-5 text-white" />
                  </div>
                  System Status
                </h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between glassmorphic bg-white/50 dark:bg-gray-700/50 p-4 rounded-xl border border-white/20 dark:border-gray-600/20">
                    <span className="text-gray-700 dark:text-gray-300 font-semibold">Backend Connection</span>
                    <div className={`flex items-center gap-3 ${claraNotebookService.isBackendHealthy() ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                      <div className={`w-3 h-3 rounded-full shadow-lg ${claraNotebookService.isBackendHealthy() ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
                      <span className="font-bold">{claraNotebookService.isBackendHealthy() ? 'Connected' : 'Disconnected'}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between glassmorphic bg-white/50 dark:bg-gray-700/50 p-4 rounded-xl border border-white/20 dark:border-gray-600/20">
                    <span className="text-gray-700 dark:text-gray-300 font-semibold">Documents</span>
                    <span className="text-gray-900 dark:text-white font-bold glassmorphic bg-white/60 dark:bg-gray-800/60 px-3 py-1 rounded-lg border border-white/30 dark:border-gray-700/30">{notebook.document_count}</span>
                  </div>
                </div>
              </div>

              {/* Danger Zone */}
              <div className="glassmorphic bg-red-50/80 dark:bg-red-900/20 backdrop-blur-xl p-6 rounded-2xl border border-red-200/50 dark:border-red-700/30 shadow-xl">
                <h3 className="text-xl font-bold text-red-800 dark:text-red-400 mb-6 flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-br from-red-500 to-pink-500 rounded-xl shadow-lg">
                    <AlertTriangle className="w-5 h-5 text-white" />
                  </div>
                  Danger Zone
                </h3>
                <div className="space-y-4">
                  <button
                    onClick={loadDocuments}
                    disabled={!claraNotebookService.isBackendHealthy()}
                    className="w-full px-6 py-4 glassmorphic bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed text-white rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl border border-gray-500/30 font-semibold"
                  >
                    Refresh All Documents
                  </button>
                  <button
                    onClick={() => {
                      setShowSettingsModal(false);
                      onNotebookDeleted();
                    }}
                    className="w-full px-6 py-4 glassmorphic bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl border border-red-500/30 font-semibold"
                  >
                    Delete Notebook
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Clara Core Status Banner */}
      <ClaraCoreStatusBanner
        isRunning={claraCoreStatus.isRunning}
        isStarting={claraCoreStatus.isStarting}
        error={claraCoreStatus.error}
        serviceName={claraCoreStatus.serviceName}
        phase={claraCoreStatus.phase}
        requiresClaraCore={claraCoreStatus.requiresClaraCore}
        onRetry={claraCoreStatus.startClaraCore}
        isVisible={showClaraCoreStatus}
        onToggleVisibility={() => setShowClaraCoreStatus(!showClaraCoreStatus)}
      />
    </div>
  );
};

export default NotebookDetails_new;
