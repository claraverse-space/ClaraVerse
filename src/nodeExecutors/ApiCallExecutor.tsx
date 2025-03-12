import { registerNodeExecutor, NodeExecutionContext } from './NodeExecutorRegistry';

const executeApiCall = async (context: NodeExecutionContext) => {
  const { node, inputs } = context;
  
  try {
    const textInput = inputs.text || inputs['text-in'] || inputs.default || '';
    const config = node.data.config || {};
    const endpoint = config.endpoint || '';
    const method = config.method || 'GET';
    const queryParams = config.queryParams || [];
    const headers = config.headers || [{ key: 'Content-Type', value: 'application/json' }];
    const requestBody = config.requestBody || '';
    
    if (!endpoint) {
      return "No API endpoint specified";
    }

    // Build URL with query parameters for GET requests
    let url = endpoint;
    if (method === 'GET' && queryParams.length > 0) {
      const params = new URLSearchParams();
      queryParams.forEach((param: any) => {
        if (param.key && param.value) {
          let value = param.value;
          if (value.includes('{{input}}')) {
            value = value.replace('{{input}}', textInput);
          }
          params.append(param.key, value);
        }
      });
      
      const queryString = params.toString();
      if (queryString) {
        url = `${url}${url.includes('?') ? '&' : '?'}${queryString}`;
      }
    }
    
    // Build request options
    const options: RequestInit = {
      method,
      headers: headers.reduce((acc: any, header: any) => {
        if (header.key && header.value) {
          acc[header.key] = header.value;
        }
        return acc;
      }, {} as Record<string, string>)
    };
    
    // Add body for non-GET requests
    if ((method === 'POST' || method === 'PUT') && requestBody) {
      try {
        // Allow for template substitution with input
        let processedBody = requestBody;
        if (processedBody.includes('{{input}}')) {
          processedBody = processedBody.replace(/\{\{input\}\}/g, textInput);
        }
        
        // Try to parse as JSON first to validate
        const jsonBody = JSON.parse(processedBody);
        options.body = JSON.stringify(jsonBody);
      } catch (e) {
        // If not valid JSON, use as is
        options.body = requestBody;
      }
    }
    
    console.log(`Executing ${method} request to ${url}`);
    const response = await fetch(url, options);
    
    // Store response status in node config
    config.responseStatus = response.status;
    
    // Following the approach used in LlmPromptExecutor, which works:
    if (!response.ok) {
      const errorText = await response.text();
      config.responseData = errorText;
      return `Error ${response.status}: ${errorText}`;
    }
    
    // Check if response is likely to be JSON based on Content-Type
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      // Parse as JSON
      const jsonResponse = await response.json();
      // Store the JSON string in config
      config.responseData = JSON.stringify(jsonResponse);
      // Return the parsed JSON object or its string form depending on needs
      return JSON.stringify(jsonResponse);
    } else {
      // Handle text responses
      const textResponse = await response.text();
      config.responseData = textResponse;
      return textResponse;
    }
  } catch (error) {
    console.error("Error in API Call node execution:", error);
    return `Error: ${error instanceof Error ? error.message : String(error)}`;
  }
};

registerNodeExecutor('apiCallNode', {
  execute: executeApiCall
});
