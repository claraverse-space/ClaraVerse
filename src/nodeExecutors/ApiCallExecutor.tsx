import { registerNodeExecutor, NodeExecutionContext } from './NodeExecutorRegistry';

const executeApiCall = async (context: NodeExecutionContext) => {
  const { node, inputs } = context;
  
  try {
    const textInput = inputs.text || inputs['text-in'] || inputs.default || '';
    const config = node.data.config || {};
    const endpoint = config.endpoint || '';
    const method = config.method || 'GET';
    
    if (!endpoint) {
      return "No API endpoint specified";
    }
    
    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
      }
    };
    
    // For methods that have a body
    if (method !== 'GET' && method !== 'HEAD') {
      options.body = textInput;
    }
    
    const response = await fetch(endpoint, options);
    
    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }
    
    const contentType = response.headers.get('content-type');
    
    if (contentType && contentType.includes('application/json')) {
      const jsonResponse = await response.json();
      return JSON.stringify(jsonResponse, null, 2);
    } else {
      return await response.text();
    }
  } catch (error) {
    console.error("Error in API Call node execution:", error);
    return `Error: ${error instanceof Error ? error.message : String(error)}`;
  }
};

registerNodeExecutor('apiCallNode', {
  execute: executeApiCall
});
