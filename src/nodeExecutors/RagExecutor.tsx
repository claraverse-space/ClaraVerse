import { registerNodeExecutor, NodeExecutionContext } from './NodeExecutorRegistry';

const executeRag = async (context: NodeExecutionContext) => {
  const { node, inputs, updateNodeOutput } = context;
  const config = node.data.config || {};
  
  try {
    // Get the query and collection name from inputs
    const query = inputs.text || inputs['text-in'] || '';
    const customCollection = inputs.collection || config.collectionName || '';
    
    if (!query) {
      throw new Error('No query provided. Please connect a text input to this node.');
    }
    
    // Get Python port for backend communication
    const pythonPort = await window.electron?.getPythonPort?.() || 8099;
    
    // Use custom collection if provided, otherwise use default
    const collectionName = customCollection ? customCollection : 'default_collection';
    
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
    node.data.config.collectionName = collectionName;
    
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

// Check if collection exists
const checkCollectionExists = async (collectionName: string, pythonPort: number): Promise<boolean> => {
  try {
    const response = await fetch(`http://0.0.0.0:${pythonPort}/collections`);
    if (!response.ok) {
      throw new Error(`Failed to fetch collections: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.collections?.some((c: any) => c.name === collectionName) || false;
  } catch (error) {
    console.error('Error checking collection:', error);
    return false;
  }
};

// Create a new collection
const createCollection = async (collectionName: string, description: string, pythonPort: number): Promise<void> => {
  const response = await fetch(`http://0.0.0.0:${pythonPort}/collections`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: collectionName,
      description
    }),
  });
  
  if (!response.ok) {
    const errorData = await response.json();
    if (response.status === 409) {
      // Collection already exists, which is fine
      return;
    }
    throw new Error(`Failed to create collection: ${errorData.detail || response.statusText}`);
  }
};

// Handle file upload functionality
const handleFileUpload = async (file: File, collectionName: string): Promise<string> => {
  try {
    const pythonPort = await window.electron?.getPythonPort?.() || 8099;
    
    // Check if collection exists first
    const exists = await checkCollectionExists(collectionName, pythonPort);
    
    // Create collection if it doesn't exist
    if (!exists) {
      try {
        await createCollection(
          collectionName,
          `Collection created by RAG node for ${file.name}`,
          pythonPort
        );
      } catch (error) {
        // If creation fails, check one more time if it exists (in case of race condition)
        const doubleCheck = await checkCollectionExists(collectionName, pythonPort);
        if (!doubleCheck) {
          throw error;
        }
      }
    }
    
    // Prepare upload
    const formData = new FormData();
    formData.append('file', file);
    formData.append('collection_name', collectionName);
    formData.append('metadata', JSON.stringify({
      source: 'rag_node_upload',
      source_file: file.name,
      timestamp: new Date().toISOString()
    }));
    
    // Upload file
    const response = await fetch(`http://0.0.0.0:${pythonPort}/documents/upload`, {
      method: 'POST',
      body: formData,
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Upload failed: ${errorData.detail || response.statusText}`);
    }
    
    await response.json(); // Consume the response
    return `Successfully uploaded ${file.name} to collection ${collectionName}`;
  } catch (error) {
    console.error('Upload error:', error);
    throw error;
  }
};

registerNodeExecutor('ragNode', {
  execute: executeRag,
  // Expose the upload handler for the React component to use
  uploadFile: handleFileUpload
});
