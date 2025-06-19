import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  BookOpen, 
  FolderOpen,
  AlertCircle,
  Wifi,
  WifiOff
} from 'lucide-react';
import NotebookCard from './NotebookCard';
import CreateNotebookModal from './CreateNotebookModal';
import NotebookDetails from './NotebookDetails';
import { claraNotebookService, NotebookResponse, ProviderConfig } from '../../services/claraNotebookService';
import { ProvidersProvider } from '../../contexts/ProvidersContext';

const NotebooksContent: React.FC = () => {
  const [notebooks, setNotebooks] = useState<NotebookResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedNotebook, setSelectedNotebook] = useState<NotebookResponse | null>(null);
  const [isBackendHealthy, setIsBackendHealthy] = useState(false);

  // Subscribe to backend health changes
  useEffect(() => {
    const unsubscribe = claraNotebookService.onHealthChange(setIsBackendHealthy);
    return unsubscribe;
  }, []);

  // Load notebooks on component mount and when backend becomes healthy
  useEffect(() => {
    if (isBackendHealthy) {
      loadNotebooks();
    }
  }, [isBackendHealthy]);

  const loadNotebooks = async () => {
    if (!isBackendHealthy) {
      setError('Notebook backend is not available');
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const data = await claraNotebookService.listNotebooks();
      setNotebooks(data);
    } catch (err) {
      console.error('Failed to load notebooks:', err);
      setError(err instanceof Error ? err.message : 'Failed to load notebooks');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateNotebook = async (name: string, description: string, llmProvider: ProviderConfig, embeddingProvider: ProviderConfig) => {
    if (!isBackendHealthy) {
      throw new Error('Notebook backend is not available');
    }

    try {
      const newNotebook = await claraNotebookService.createNotebook({
        name,
        description: description || undefined,
        llm_provider: llmProvider,
        embedding_provider: embeddingProvider
      });
      
      // Add the new notebook to the list
      setNotebooks(prev => [newNotebook, ...prev]);
      setShowCreateModal(false);
      
      // Automatically open the newly created notebook
      setSelectedNotebook(newNotebook);
    } catch (error) {
      console.error('Failed to create notebook:', error);
      throw error; // Re-throw so the modal can handle it
    }
  };

  const handleDeleteNotebook = async (id: string) => {
    if (!isBackendHealthy) {
      setError('Notebook backend is not available');
      return;
    }

    try {
      await claraNotebookService.deleteNotebook(id);
      
      // Remove from local state
      setNotebooks(prev => prev.filter(notebook => notebook.id !== id));
      
      // Close details if this notebook was selected
      if (selectedNotebook?.id === id) {
        setSelectedNotebook(null);
      }
    } catch (error) {
      console.error('Failed to delete notebook:', error);
      setError(error instanceof Error ? error.message : 'Failed to delete notebook');
    }
  };

  const handleOpenNotebook = (notebook: NotebookResponse) => {
    setSelectedNotebook(notebook);
  };

  const handleCloseNotebook = () => {
    setSelectedNotebook(null);
  };

  const handleNotebookUpdated = (updatedNotebook: NotebookResponse) => {
    setNotebooks(prev => 
      prev.map(notebook => 
        notebook.id === updatedNotebook.id ? updatedNotebook : notebook
      )
    );
    setSelectedNotebook(updatedNotebook);
  };

  // Filter and sort notebooks based on search query (most recent first)
  const filteredNotebooks = notebooks
    .filter(notebook =>
      notebook.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (notebook.description && notebook.description.toLowerCase().includes(searchQuery.toLowerCase()))
    )
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  // Show notebook details if one is selected
  if (selectedNotebook) {
    return (
      <NotebookDetails 
        notebook={selectedNotebook}
        onClose={handleCloseNotebook}
        onNotebookUpdated={handleNotebookUpdated}
        onNotebookDeleted={() => {
          handleDeleteNotebook(selectedNotebook.id);
          handleCloseNotebook();
        }}
      />
    );
  }

  return (
    <div className="h-[94vh] flex flex-col bg-gray-50 dark:bg-black">
      {/* Header - Fixed height */}
      <div className="flex-shrink-0 bg-white dark:bg-black px-6 py-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <BookOpen className="h-6 w-6 text-sakura-500" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Notebooks
            </h1>
            {/* Backend status indicator */}
            <div className="flex items-center space-x-2">
              {isBackendHealthy ? (
                <div className="flex items-center text-green-600 dark:text-green-400">
                  <Wifi className="h-4 w-4 mr-1" />
                  <span className="text-sm">Connected</span>
                </div>
              ) : (
                <div className="flex items-center text-red-600 dark:text-red-400">
                  <WifiOff className="h-4 w-4 mr-1" />
                  <span className="text-sm">Disconnected</span>
                </div>
              )}
            </div>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            disabled={!isBackendHealthy}
            className="flex items-center space-x-2 bg-sakura-500 hover:bg-sakura-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>New Notebook</span>
          </button>
        </div>

        {/* Search bar */}
        <div className="mt-4 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <input
            type="text"
            placeholder="Search notebooks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-black text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-sakura-500 focus:border-sakura-500 transition-colors"
          />
        </div>
      </div>

      {/* Content - Scrollable area */}
      <div className="flex-1 overflow-y-auto">
        {/* Error state */}
        {error && (
          <div className="m-6 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
            <div className="flex items-center">
              <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 mr-2" />
              <p className="text-red-800 dark:text-red-200">{error}</p>
            </div>
            {isBackendHealthy && (
              <button
                onClick={loadNotebooks}
                className="mt-2 text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200 underline"
              >
                Try again
              </button>
            )}
          </div>
        )}

        {/* Loading state */}
        {isLoading && (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sakura-500"></div>
            <span className="ml-2 text-black dark:text-gray-400">Loading notebooks...</span>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !error && notebooks.length === 0 && (
          <div className="flex flex-col items-center justify-center h-64">
            <FolderOpen className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No notebooks yet
            </h3>
            <p className="text-gray-500 dark:text-gray-400 text-center mb-4">
              {isBackendHealthy 
                ? "Create your first notebook to start organizing your documents and knowledge."
                : "Backend is not available. Please check your connection."
              }
            </p>
            {isBackendHealthy && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center space-x-2 bg-sakura-500 hover:bg-sakura-600 text-white px-4 py-2 rounded-lg transition-colors"
              >
                <Plus className="h-4 w-4" />
                <span>Create Notebook</span>
              </button>
            )}
          </div>
        )}

        {/* Notebooks grid */}
        {!isLoading && !error && filteredNotebooks.length > 0 && (
          <div className="p-6 pb-20">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredNotebooks.map((notebook) => (
                <NotebookCard
                  key={notebook.id}
                  notebook={notebook}
                  onOpen={() => handleOpenNotebook(notebook)}
                  onDelete={() => handleDeleteNotebook(notebook.id)}
                />
              ))}
            </div>
          </div>
        )}

        {/* No search results */}
        {!isLoading && !error && notebooks.length > 0 && filteredNotebooks.length === 0 && (
          <div className="flex flex-col items-center justify-center h-64">
            <Search className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No notebooks found
            </h3>
            <p className="text-gray-500 dark:text-gray-400 text-center">
              Try adjusting your search terms or create a new notebook.
            </p>
          </div>
        )}
      </div>

      {/* Create notebook modal */}
      {showCreateModal && (
        <CreateNotebookModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreateNotebook}
        />
      )}
    </div>
  );
};

const Notebooks: React.FC = () => {
  return (
    <ProvidersProvider>
      <NotebooksContent />
    </ProvidersProvider>
  );
};

export default Notebooks; 