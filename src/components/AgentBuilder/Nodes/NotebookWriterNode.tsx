import { memo, useState, useEffect } from 'react';
import { NodeProps } from 'reactflow';
import { 
  BookOpen, Send, FileText, 
  CheckCircle, AlertCircle, Loader2
} from 'lucide-react';
import BaseNode from './BaseNode';
import { claraNotebookService } from '../../../services/claraNotebookService';

interface NotebookWriterNodeProps extends NodeProps {
  // Inherit all standard node props
}

const NotebookWriterNode = memo<NotebookWriterNodeProps>((props) => {
  const { data, id } = props;
  
  // Configuration state from properties
  const [selectedNotebook, setSelectedNotebook] = useState(data.selectedNotebook || '');
  const [documentTitle, setDocumentTitle] = useState(data.documentTitle || '');
  const [contentType, setContentType] = useState(data.contentType || 'text');
  
  // Ensure the initial configuration is saved to node data
  useEffect(() => {
    if (data.onUpdate && (!data.selectedNotebook || !data.documentTitle || !data.contentType)) {
      data.onUpdate({
        data: {
          ...data,
          selectedNotebook: selectedNotebook || data.selectedNotebook || '',
          documentTitle: documentTitle || data.documentTitle || '',
          contentType: contentType || data.contentType || 'text'
        }
      });
    }
  }, []); // Run once on mount
  
  // UI state
  const [isWriting, setIsWriting] = useState(false);
  const [availableNotebooks, setAvailableNotebooks] = useState<any[]>([]);
  
  // Status and error state
  const [lastError, setLastError] = useState<string | null>(null);
  const [lastSuccess, setLastSuccess] = useState<boolean | null>(null);
  const [lastDocumentId, setLastDocumentId] = useState<string | null>(null);
  const [notebookServiceHealthy, setNotebookServiceHealthy] = useState(false);
  
  // Input text from connected node - handle various input formats
  const inputText = data.inputValue || data.text || data.inputs?.text || data.content || '';
  
  // Listen for execution events from the workflow engine
  useEffect(() => {
    const handleWorkflowExecution = (event: CustomEvent) => {
      const { nodeId, inputs } = event.detail;
      
      // Check if this execution is for our node
      if (nodeId === id) {
        console.log('📝 NotebookWriter received workflow execution:', { nodeId, inputs });
        
        const executionText = inputs.text || inputs.content || inputs.value || inputs.output || '';
        
        if (executionText.trim() && selectedNotebook && notebookServiceHealthy) {
          console.log('📝 NotebookWriter executing upload from workflow');
          handleWriteToNotebook(executionText);
        }
      }
    };
    
    // Listen for custom workflow execution events
    window.addEventListener('workflowNodeExecution', handleWorkflowExecution as EventListener);
    
    return () => {
      window.removeEventListener('workflowNodeExecution', handleWorkflowExecution as EventListener);
    };
  }, [id, selectedNotebook, notebookServiceHealthy]);
  
  // Auto-execute when input text changes and configuration is valid
  useEffect(() => {
    console.log('📝 NotebookWriter auto-execute check:', {
      inputText: inputText,
      inputTextLength: inputText.length,
      selectedNotebook: selectedNotebook,
      notebookServiceHealthy: notebookServiceHealthy,
      isWriting: isWriting,
      allData: data
    });
    
    const shouldAutoExecute = inputText.trim() && 
                             selectedNotebook && 
                             notebookServiceHealthy && 
                             !isWriting;
    
    if (shouldAutoExecute) {
      console.log('📝 NotebookWriter triggering auto-execution');
      // Small delay to ensure state is settled
      const timeoutId = setTimeout(() => {
        handleWriteToNotebook();
      }, 100);
      
      return () => clearTimeout(timeoutId);
    }
  }, [inputText, selectedNotebook, notebookServiceHealthy]);
  
  // Check notebook service health and load notebooks on mount
  useEffect(() => {
    const checkHealth = () => {
      setNotebookServiceHealthy(claraNotebookService.isBackendHealthy());
    };
    
    const loadNotebooks = async () => {
      if (claraNotebookService.isBackendHealthy()) {
        try {
          const notebooks = await claraNotebookService.listNotebooks();
          setAvailableNotebooks(notebooks);
        } catch (error) {
          console.error('Failed to load notebooks:', error);
          setAvailableNotebooks([]);
        }
      }
    };
    
    checkHealth();
    loadNotebooks();
    
    // Subscribe to health changes
    const unsubscribeHealth = claraNotebookService.onHealthChange((isHealthy) => {
      setNotebookServiceHealthy(isHealthy);
      if (isHealthy) {
        loadNotebooks();
      }
    });
    
    return () => {
      unsubscribeHealth();
    };
  }, []);
  
  // Handle configuration changes
  const handleConfigChange = (key: string, value: any) => {
    const updates = { [key]: value };
    
    switch (key) {
      case 'selectedNotebook':
        setSelectedNotebook(value);
        break;
      case 'documentTitle':
        setDocumentTitle(value);
        break;
      case 'contentType':
        setContentType(value);
        break;
    }
    
    // Always update the node data immediately
    if (data.onUpdate) {
      data.onUpdate({ 
        data: { 
          ...data, 
          ...updates
        } 
      });
    }
    
    console.log('📝 NotebookWriter config updated:', { key, value, newData: { ...data, ...updates } });
  };
  
  // Write text to notebook
  const handleWriteToNotebook = async (textToWrite?: string) => {
    const textContent = textToWrite || inputText;
    
    if (!textContent.trim()) {
      setLastError('No input text provided');
      setLastSuccess(false);
      return;
    }
    
    if (!selectedNotebook) {
      setLastError('Please select a notebook');
      setLastSuccess(false);
      return;
    }
    
    if (!notebookServiceHealthy) {
      setLastError('Notebook service is not available');
      setLastSuccess(false);
      return;
    }
    
    setIsWriting(true);
    setLastError(null);
    
    try {
      // Generate title if not provided
      let finalTitle = documentTitle.trim();
      if (!finalTitle) {
        const firstLine = textContent.split('\n')[0].trim();
        finalTitle = firstLine.length > 50 
          ? firstLine.substring(0, 47) + '...'
          : firstLine || 'Untitled Document';
      }
      
      console.log('📝 Writing to notebook:', {
        notebookId: selectedNotebook,
        title: finalTitle,
        contentLength: textContent.length,
        contentType
      });
      
      // Call Clara notebook service to create document
      // Create a text file from the input content
      const fileName = finalTitle.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase() + 
                      (contentType === 'markdown' ? '.md' : '.txt');
      const mimeType = contentType === 'markdown' ? 'text/markdown' : 'text/plain';
      
      const textFile = new File([textContent], fileName, { type: mimeType });
      
      const results = await claraNotebookService.uploadDocuments(
        selectedNotebook,
        [textFile]
      );
      
      if (results && results.length > 0 && results[0].id) {
        const document = results[0];
        setLastDocumentId(document.id);
        setLastSuccess(true);
        setLastError(null);
        
        // Update node outputs
        if (data.onUpdate) {
          data.onUpdate({
            data: {
              ...data,
              outputs: {
                documentId: document.id,
                success: true
              }
            }
          });
        }
        
        console.log('✅ Document created successfully');
      } else {
        throw new Error('Failed to create document - no result returned');
      }
    } catch (error) {
      console.error('❌ Notebook write failed:', error);
      setLastError(error instanceof Error ? error.message : 'Notebook write failed');
      setLastSuccess(false);
      
      // Update node outputs with error
      if (data.onUpdate) {
        data.onUpdate({
          data: {
            ...data,
            outputs: {
              documentId: null,
              success: false
            }
          }
        });
      }
    } finally {
      setIsWriting(false);
    }
  };
  
  // Helper functions
  const getStatusColor = () => {
    if (isWriting) return 'text-blue-500';
    if (lastSuccess === true) return 'text-green-500';
    if (lastSuccess === false) return 'text-red-500';
    return 'text-gray-500';
  };
  
  const getStatusText = () => {
    if (!notebookServiceHealthy) return 'Notebook Service Offline';
    if (isWriting) return 'Writing to Notebook...';
    if (lastSuccess === true) return 'Document Created';
    if (lastError) return lastError;
    return 'Ready';
  };

  const selectedNotebookName = availableNotebooks.find(nb => nb.id === selectedNotebook)?.name || 'None selected';

  return (
    <BaseNode 
      {...props} 
      title="Notebook Writer"
      category="data"
      icon={<BookOpen className="w-4 h-4" />}
      inputs={data.inputs || []}
      outputs={data.outputs || []}
    >
      <div className="space-y-3">
        {/* Notebook Selection */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Target Notebook</label>
            {/* Service Health Indicator */}
            <div className={`w-2 h-2 rounded-full ${
              notebookServiceHealthy 
                ? 'bg-green-500 animate-pulse' 
                : 'bg-red-500'
            }`} title={notebookServiceHealthy ? 'Service Online' : 'Service Offline'} />
          </div>
          <select
            value={selectedNotebook}
            onChange={(e) => handleConfigChange('selectedNotebook', e.target.value)}
            disabled={!notebookServiceHealthy || availableNotebooks.length === 0}
            className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          >
            <option value="">Select a notebook...</option>
            {availableNotebooks.map((notebook) => (
              <option key={notebook.id} value={notebook.id}>
                {notebook.name} ({notebook.document_count} docs)
              </option>
            ))}
          </select>
          {selectedNotebook && (
            <div className="text-xs text-gray-500">
              Selected: {selectedNotebookName}
            </div>
          )}
        </div>

        {/* Document Title */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Document Title</label>
          <input
            type="text"
            value={documentTitle}
            onChange={(e) => handleConfigChange('documentTitle', e.target.value)}
            placeholder="Auto-generated if empty"
            className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          />
        </div>

        {/* Content Type */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Content Type</label>
          <select
            value={contentType}
            onChange={(e) => handleConfigChange('contentType', e.target.value)}
            className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          >
            <option value="text">Plain Text</option>
            <option value="markdown">Markdown</option>
          </select>
        </div>

        {/* Input Preview */}
        <div className="text-xs text-gray-600 dark:text-gray-400">
          <div className="flex items-center gap-2 mb-1">
            <FileText className="w-3 h-3" />
            <span>Content: {inputText ? `${inputText.length} characters` : 'No input'}</span>
          </div>
        </div>

        {/* Status */}
        <div className="flex items-center gap-2 text-xs">
          {isWriting ? (
            <Loader2 className="w-3 h-3 animate-spin text-blue-500" />
          ) : lastSuccess === true ? (
            <CheckCircle className="w-3 h-3 text-green-500" />
          ) : lastSuccess === false ? (
            <AlertCircle className="w-3 h-3 text-red-500" />
          ) : null}
          <span className={getStatusColor()}>{getStatusText()}</span>
        </div>

        {/* Write Button */}
        <button
          onClick={() => handleWriteToNotebook()}
          disabled={!inputText.trim() || !selectedNotebook || isWriting || !notebookServiceHealthy}
          className="w-full px-3 py-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded text-sm font-medium transition-colors flex items-center justify-center gap-2"
        >
          {isWriting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Writing...
            </>
          ) : (
            <>
              <Send className="w-4 h-4" />
              Write to Notebook
            </>
          )}
        </button>

        {/* Last Document Info */}
        {lastDocumentId && lastSuccess && (
          <div className="text-xs p-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded">
            <div className="font-medium text-green-800 dark:text-green-300">Document Created</div>
            <div className="text-green-600 dark:text-green-400">ID: {lastDocumentId}</div>
          </div>
        )}
      </div>
    </BaseNode>
  );
});

NotebookWriterNode.displayName = 'NotebookWriterNode';

export default NotebookWriterNode;