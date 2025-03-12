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
      return JSON.stringify({
        input: textInput,
        output: "No API endpoint specified"
      });
    }

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
    
    const options: RequestInit = {
      method,
      headers: headers.reduce((acc: any, header: any) => {
        if (header.key && header.value) {
          acc[header.key] = header.value;
        }
        return acc;
      }, {} as Record<string, string>)
    };
    
    if ((method === 'POST' || method === 'PUT') && requestBody) {
      try {
        let processedBody = requestBody;
        if (processedBody.includes('{{input}}')) {
          processedBody = processedBody.replace(/\{\{input\}\}/g, textInput);
        }
        
        const jsonBody = JSON.parse(processedBody);
        options.body = JSON.stringify(jsonBody);
      } catch (e) {
        options.body = requestBody;
      }
    }
    
    console.log(`Executing ${method} request to ${url}`);
    const response = await fetch(url, options);
    
    config.responseStatus = response.status;
    
    if (!response.ok) {
      const errorText = await response.clone().text();
      config.responseData = errorText;
      return JSON.stringify({
        input: textInput,
        output: `Error ${response.status}: ${errorText}`
      });
    }
    
    const contentType = response.headers.get('content-type');
    let apiResponse;

    if (contentType && contentType.includes('application/json')) {
      const responseClone = response.clone();
      try {
        const jsonResponse = await response.json();
        config.responseData = JSON.stringify(jsonResponse);
        apiResponse = jsonResponse; // Store as object to avoid double-stringifying
      } catch {
        const textResponse = await responseClone.text();
        config.responseData = textResponse;
        apiResponse = textResponse;
      }
    } else {
      const textResponse = await response.text();
      config.responseData = textResponse;
      apiResponse = textResponse;
    }

    // Return both input and output as a JSON string
    return JSON.stringify({
      input: textInput,
      output: apiResponse
    });
  } catch (error) {
    console.error("Error in API Call node execution:", error);
    return JSON.stringify({
      input: textInput || "",
      output: `Error: ${error instanceof Error ? error.message : String(error)}`
    });
  }
};

registerNodeExecutor('apiCallNode', {
  execute: executeApiCall
});
