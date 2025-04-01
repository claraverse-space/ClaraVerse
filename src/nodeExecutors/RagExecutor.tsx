import { registerNodeExecutor, NodeExecutionContext } from './NodeExecutorRegistry';

const executeRag = async (context: NodeExecutionContext) => {
  const { node, inputs, updateNodeOutput } = context;
  const config = node.data.config || {};
  
  try {
    // Get the query from input
    const query = inputs.text || inputs['text-in'] || '';
    
    if (!query) {
      throw new Error('No query provided. Please connect a text input to this node.');
    }
    
    // Get Python port for backend communication
    const pythonPort = await window.electron?.getPythonPort?.() || 8099;
    
    // If no collection is selected, use the default
    const collectionName = config.collectionName || 'default_collection';
    
    if (updateNodeOutput) {
      updateNodeOutput(node.id, { 
        type: 'status', 
        message: `Querying collection: ${collectionName}...` 
      });
    }
    
    // Search documents with the query
    const searchResponse = await fetch(`http://0.0.0.0:${pythonPort}/documents/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        collection_name: collectionName,
        k: config.resultCount || 3,
      }),
    });
    
    if (!searchResponse.ok) {
      throw new Error(`Search request failed: ${searchResponse.statusText}`);
    }
    
    const searchData = await searchResponse.json();
    
    // Format the results
    let resultText = '';
    
    if (searchData.results && searchData.results.length > 0) {
      resultText = searchData.results.map((result: any, index: number) => {
        return `[${index + 1}] ${result.content}\n\nSource: ${result.metadata?.source_file || 'Unknown'}\n`;
      }).join('\n---\n\n');
    } else {
      resultText = "No relevant documents found.";
    }
    
    // Save to node for visualization
    if (!node.data.config) node.data.config = {};
    node.data.config.resultText = resultText;
    
    if (updateNodeOutput) {
      updateNodeOutput(node.id, resultText);
    }
    
    return resultText;
  } catch (error) {
    console.error('Error in RAG node:', error);
    const errorMsg = `Error: ${error instanceof Error ? error.message : String(error)}`;
    
    if (updateNodeOutput) {
      updateNodeOutput(node.id, {
        type: 'error',
        message: errorMsg
      });
    }
    
    return errorMsg;
  }
};

// Handle file upload functionality
const handleFileUpload = async (file: File, collectionName: string): Promise<string> => {
  try {
    const pythonPort = await window.electron?.getPythonPort?.() || 8099;
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('collection_name', collectionName);
    formData.append('metadata', JSON.stringify({
      source: 'rag_node_upload',
      timestamp: new Date().toISOString()
    }));
    
    const response = await fetch(`http://0.0.0.0:${pythonPort}/documents/upload`, {
      method: 'POST',
      body: formData,
    });
    
    if (!response.ok) {
      throw new Error(`Upload failed: ${response.statusText}`);
    }
    
    const data = await response.json();
    return `Successfully uploaded ${file.name} to collection ${collectionName}`;
  } catch (error) {
    console.error('Upload error:', error);
    return `Error uploading file: ${error instanceof Error ? error.message : String(error)}`;
  }
};

registerNodeExecutor('ragNode', {
  execute: executeRag,
  // Expose the upload handler for the React component to use
  uploadFile: handleFileUpload
});
