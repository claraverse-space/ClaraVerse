import { registerNodeExecutor, NodeExecutionContext } from './NodeExecutorRegistry';

const executeApiCall = async (context: NodeExecutionContext): Promise<string> => {
  const { node, inputs } = context;
  
  // Get input from various possible sources
  let inputValue = inputs.text || inputs['text-in'] || inputs.default || '';
  
  try {
    // Try to parse input as JSON if it's a string
    let parsedInput: any = inputValue;
    if (typeof inputValue === 'string') {
      try {
        parsedInput = JSON.parse(inputValue);
      } catch (e) {
        // If parsing fails, use the string as is
        parsedInput = inputValue;
      }
    }

    // Log the parsed input for debugging
    console.log('Parsed input:', parsedInput);

    const config = node.data.config || {};
    const endpoint = config.endpoint || '';
    const method = config.method || 'GET';
    const queryParams = config.queryParams || [];
    const headers = config.headers || [{ key: 'Content-Type', value: 'application/json' }];
    const requestBody = config.requestBody || '';
    
    if (!endpoint) {
      return JSON.stringify({
        input: parsedInput,
        output: "No API endpoint specified"
      });
    }

    let url = endpoint;
    if (method === 'GET') {
      // Extract query parameters from the URL if they exist
      const urlParams = new URLSearchParams();
      const [baseUrl, urlQueryString] = endpoint.split('?');
      if (urlQueryString) {
        const existingParams = new URLSearchParams(urlQueryString);
        existingParams.forEach((value, key) => {
          urlParams.append(key, value);
        });
      }

      // Add any additional query parameters from the config
      queryParams.forEach((param: any) => {
        if (param.key && param.value) {
          urlParams.append(param.key, param.value);
        }
      });

      // Process all parameters for field replacements
      const processedParams = new URLSearchParams();
      urlParams.forEach((value, key) => {
        let processedValue = value;
        
        // Replace {{input}} with stringified input if it's an object
        if (value.includes('{{input}}')) {
          processedValue = value.replace('{{input}}', typeof parsedInput === 'object' ? JSON.stringify(parsedInput) : String(parsedInput));
        }
        // Replace individual field placeholders like {{fieldName}}
        else if (typeof parsedInput === 'object') {
          processedValue = value.replace(/\{\{(\w+)\}\}/g, (match: string, field: string) => {
            console.log('Replacing field:', field, 'with value:', parsedInput[field]);
            return parsedInput[field] !== undefined ? String(parsedInput[field]) : match;
          });
        }
        
        processedParams.append(key, processedValue);
      });

      const finalQueryString = processedParams.toString();
      if (finalQueryString) {
        url = `${baseUrl}?${finalQueryString}`;
      }
      console.log('Final URL:', url);
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
        // Replace {{input}} with stringified input if it's an object
        if (processedBody.includes('{{input}}')) {
          processedBody = processedBody.replace('{{input}}', typeof parsedInput === 'object' ? JSON.stringify(parsedInput) : String(parsedInput));
        }
        
        // If the processed body is a valid JSON string, parse it
        try {
          const jsonBody = JSON.parse(processedBody);
          options.body = JSON.stringify(jsonBody);
        } catch (e) {
          // If not valid JSON, use the processed body as is
          options.body = processedBody;
        }
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
        input: parsedInput,
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
        apiResponse = jsonResponse;
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
      input: parsedInput,
      output: apiResponse
    });
  } catch (error) {
    console.error("Error in API Call node execution:", error);
    return JSON.stringify({
      input: inputValue,
      output: `Error: ${error instanceof Error ? error.message : String(error)}`
    });
  }
};

registerNodeExecutor('apiCallNode', {
  execute: executeApiCall
});
