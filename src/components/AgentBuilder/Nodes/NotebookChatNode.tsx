import { memo, useState, useEffect } from 'react';
import { NodeProps } from 'reactflow';
import { 
  MessageSquare, Send, 
  CheckCircle, AlertCircle, Loader2, Bot
} from 'lucide-react';
import BaseNode from './BaseNode';
import { claraNotebookService } from '../../../services/claraNotebookService';

interface NotebookChatNodeProps extends NodeProps {
  // Inherit all standard node props
}

const NotebookChatNode = memo<NotebookChatNodeProps>((props) => {
  const { data, id } = props;
  
  // Configuration state from properties
  const [selectedNotebook, setSelectedNotebook] = useState(data.selectedNotebook || '');
  const [useChatHistory, setUseChatHistory] = useState(data.useChatHistory !== false); // Default to true
  const [responseMode, setResponseMode] = useState(data.responseMode || 'hybrid');
  
  // Ensure the initial configuration is saved to node data
  useEffect(() => {
    if (data.onUpdate && (!data.selectedNotebook || data.useChatHistory === undefined || !data.responseMode)) {
      data.onUpdate({
        data: {
          ...data,
          selectedNotebook: selectedNotebook || data.selectedNotebook || '',
          useChatHistory: useChatHistory !== undefined ? useChatHistory : true,
          responseMode: responseMode || data.responseMode || 'hybrid'
        }
      });
    }
  }, []); // Run once on mount
  
  // UI state
  const [isQuerying, setIsQuerying] = useState(false);
  const [availableNotebooks, setAvailableNotebooks] = useState<any[]>([]);
  
  // Status and error state
  const [lastError, setLastError] = useState<string | null>(null);
  const [lastSuccess, setLastSuccess] = useState<boolean | null>(null);
  const [lastResponseLength, setLastResponseLength] = useState<number>(0);
  const [notebookServiceHealthy, setNotebookServiceHealthy] = useState(false);
  
  // Input query from connected node - handle various input formats
  const inputQuery = data.inputValue || data.query || data.question || data.inputs?.query || data.inputs?.question || data.text || '';
  
  // Listen for execution events from the workflow engine
  useEffect(() => {
    const handleWorkflowExecution = (event: CustomEvent) => {
      const { nodeId, inputs } = event.detail;
      
      // Check if this execution is for our node
      if (nodeId === id) {
        console.log('💬 NotebookChat received workflow execution:', { nodeId, inputs });
        
        const executionQuery = inputs.query || inputs.question || inputs.text || inputs.content || inputs.value || inputs.output || '';
        
        if (executionQuery.trim() && selectedNotebook && notebookServiceHealthy) {
          console.log('💬 NotebookChat executing query from workflow');
          handleSendQuery(executionQuery);
        }
      }
    };
    
    // Listen for custom workflow execution events
    window.addEventListener('workflowNodeExecution', handleWorkflowExecution as EventListener);
    
    return () => {
      window.removeEventListener('workflowNodeExecution', handleWorkflowExecution as EventListener);
    };
  }, [id, selectedNotebook, notebookServiceHealthy]);
  
  // Auto-execute when input query changes and configuration is valid
  useEffect(() => {
    console.log('💬 NotebookChat auto-execute check:', {
      inputQuery: inputQuery,
      inputQueryLength: inputQuery.length,
      selectedNotebook: selectedNotebook,
      notebookServiceHealthy: notebookServiceHealthy,
      isQuerying: isQuerying,
      allData: data
    });
    
    const shouldAutoExecute = inputQuery.trim() && 
                             selectedNotebook && 
                             notebookServiceHealthy && 
                             !isQuerying;
    
    if (shouldAutoExecute) {
      console.log('💬 NotebookChat triggering auto-execution');
      // Small delay to ensure state is settled
      const timeoutId = setTimeout(() => {
        handleSendQuery();
      }, 100);
      
      return () => clearTimeout(timeoutId);
    }
  }, [inputQuery, selectedNotebook, notebookServiceHealthy]);
  
  // Load notebooks and check service health
  useEffect(() => {
    const checkHealth = async () => {
      const isHealthy = claraNotebookService.isBackendHealthy();
      setNotebookServiceHealthy(isHealthy);
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
      case 'useChatHistory':
        setUseChatHistory(value);
        break;
      case 'responseMode':
        setResponseMode(value);
        break;
    }
    
    // Update node data
    if (data.onUpdate) {
      data.onUpdate({
        data: {
          ...data,
          ...updates
        }
      });
    }
  };
  
  // Main query function
  const handleSendQuery = async (queryText?: string) => {
    const queryToSend = queryText || inputQuery;
    
    if (!queryToSend.trim()) {
      setLastError('Query text is required');
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
    
    console.log('💬 Starting notebook query operation...', {
      notebook: selectedNotebook,
      query: queryToSend.substring(0, 100) + (queryToSend.length > 100 ? '...' : ''),
      useChatHistory,
      responseMode
    });
    
    setIsQuerying(true);
    setLastError(null);
    setLastSuccess(null);
    
    try {
      // Send chat message to the selected notebook
      const response = await claraNotebookService.sendChatMessage(selectedNotebook, {
        question: queryToSend.trim(),
        use_chat_history: useChatHistory,
        mode: responseMode,
        response_type: 'Multiple Paragraphs',
        top_k: 60
      });
      
      console.log('💬 Query successful:', {
        responseLength: response.answer?.length || 0,
        citationsCount: response.citations?.length || 0,
        hasAnswer: !!response.answer
      });
      
      setLastSuccess(true);
      setLastResponseLength(response.answer?.length || 0);
      
      // Emit outputs to connected nodes
      if (data.onUpdate) {
        data.onUpdate({
          data: {
            ...data,
            outputs: {
              answer: response.answer || '',
              citations: response.citations || [],
              success: true,
              citationCount: response.citations?.length || 0,
              responseLength: response.answer?.length || 0
            }
          }
        });
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Query failed';
      console.error('💬 Query failed:', error);
      
      setLastError(errorMessage);
      setLastSuccess(false);
      
      // Emit error outputs
      if (data.onUpdate) {
        data.onUpdate({
          data: {
            ...data,
            outputs: {
              answer: '',
              citations: [],
              success: false,
              citationCount: 0,
              responseLength: 0,
              error: errorMessage
            }
          }
        });
      }
    } finally {
      setIsQuerying(false);
    }
  };
  
  // Status indicator
  const getStatusIcon = () => {
    if (isQuerying) {
      return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />;
    }
    if (lastSuccess === true) {
      return <CheckCircle className="w-4 h-4 text-green-500" />;
    }
    if (lastSuccess === false) {
      return <AlertCircle className="w-4 h-4 text-red-500" />;
    }
    return <MessageSquare className="w-4 h-4 text-gray-400" />;
  };
  
  // Status text
  const getStatusText = () => {
    if (isQuerying) return 'Querying...';
    if (lastSuccess === true) return `Response: ${lastResponseLength} chars`;
    if (lastError) return lastError;
    if (!notebookServiceHealthy) return 'Service offline';
    if (!selectedNotebook) return 'Select notebook';
    if (!inputQuery.trim()) return 'Waiting for query';
    return 'Ready';
  };
  
  return (
    <BaseNode 
      {...props}
      title="Notebook Chat"
      category="data"
      icon={<MessageSquare className="w-4 h-4" />}
      inputs={data.inputs || []}
      outputs={data.outputs || []}
    >
      <div className="p-4 min-w-[280px]">
        {/* Header */}
        <div className="flex items-center gap-2 mb-3">
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-blue-500" />
            <span className="font-medium text-gray-900 dark:text-white">Notebook Chat</span>
          </div>
          {getStatusIcon()}
        </div>
        
        {/* Configuration */}
        <div className="space-y-3 mb-4">
          {/* Notebook Selection */}
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Target Notebook
            </label>
            <select
              value={selectedNotebook}
              onChange={(e) => handleConfigChange('selectedNotebook', e.target.value)}
              disabled={!notebookServiceHealthy}
              className="w-full px-2 py-1.5 text-sm border rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
            >
              <option value="">Select notebook...</option>
              {availableNotebooks.map((notebook) => (
                <option key={notebook.id} value={notebook.id}>
                  {notebook.name} ({notebook.document_count} docs)
                </option>
              ))}
            </select>
          </div>
          
          {/* Response Mode */}
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Response Mode
            </label>
            <select
              value={responseMode}
              onChange={(e) => handleConfigChange('responseMode', e.target.value)}
              className="w-full px-2 py-1.5 text-sm border rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
            >
              <option value="hybrid">Hybrid (Global + Local)</option>
              <option value="global">Global Knowledge</option>
              <option value="local">Local Context</option>
            </select>
          </div>
          
          {/* Chat History Toggle */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id={`chatHistory-${id}`}
              checked={useChatHistory}
              onChange={(e) => handleConfigChange('useChatHistory', e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
            />
            <label htmlFor={`chatHistory-${id}`} className="text-xs font-medium text-gray-700 dark:text-gray-300">
              Use Chat History
            </label>
          </div>
        </div>
        
        {/* Input Preview */}
        {inputQuery.trim() && (
          <div className="mb-3">
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Query Preview
            </label>
            <div className="p-2 bg-gray-50 dark:bg-gray-900 rounded text-xs text-gray-600 dark:text-gray-400 max-h-20 overflow-y-auto">
              {inputQuery.length > 150 ? inputQuery.substring(0, 147) + '...' : inputQuery}
            </div>
          </div>
        )}
        
        {/* Manual Query Button */}
        <button
          onClick={() => handleSendQuery()}
          disabled={isQuerying || !selectedNotebook || !inputQuery.trim() || !notebookServiceHealthy}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded text-sm font-medium transition-colors disabled:cursor-not-allowed"
        >
          {isQuerying ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Querying...
            </>
          ) : (
            <>
              <Send className="w-4 h-4" />
              Send Query
            </>
          )}
        </button>
        
        {/* Status */}
        <div className="mt-3 text-xs text-center">
          <span className={`${
            lastSuccess === true ? 'text-green-600 dark:text-green-400' : 
            lastSuccess === false ? 'text-red-600 dark:text-red-400' : 
            'text-gray-500 dark:text-gray-400'
          }`}>
            {getStatusText()}
          </span>
        </div>
        
        {/* Service Status */}
        <div className="mt-2 flex items-center justify-center gap-2 text-xs">
          <div className={`w-2 h-2 rounded-full ${notebookServiceHealthy ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="text-gray-500 dark:text-gray-400">
            {notebookServiceHealthy ? 'Service Online' : 'Service Offline'}
          </span>
        </div>
      </div>
    </BaseNode>
  );
});

NotebookChatNode.displayName = 'NotebookChatNode';

export default NotebookChatNode;
