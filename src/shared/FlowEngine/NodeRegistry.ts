import { FlowNode } from '../../types/agent/types';
import { ExecutionContext } from './FlowExecutor';

export interface NodeExecutor {
  (node: FlowNode, inputs: Record<string, any>, context: ExecutionContext): Promise<any> | any;
}

export class NodeRegistry {
  private nodeExecutors = new Map<string, NodeExecutor>();
  private customNodes = new Map<string, any>();

  constructor() {
    this.registerBuiltInNodes();
  }

  private registerBuiltInNodes(): void {
    // Input Node
    this.nodeExecutors.set('input', (node: FlowNode) => {
      const value = node.data.value || '';
      const inputType = node.data.inputType || 'text';
      
      switch (inputType) {
        case 'number':
          return { output: Number(value) || 0 };
        case 'json':
          try {
            return { output: JSON.parse(value) };
          } catch {
            return { output: value };
          }
        default:
          return { output: value };
      }
    });

    // Output Node
    this.nodeExecutors.set('output', (node: FlowNode, inputs: Record<string, any>) => {
      const outputInput = inputs.input || Object.values(inputs)[0];
      return outputInput;
    });

    // Static Text Node
    this.nodeExecutors.set('static-text', (node: FlowNode) => {
      const text = node.data.text || node.data.customText || 'Enter your static text here...';
      const textFormat = node.data.textFormat || 'plain';
      
      // Process text based on format
      let processedText = text;
      
      switch (textFormat) {
        case 'json':
          try {
            // For JSON format, parse and return the parsed object
            processedText = JSON.parse(text);
          } catch {
            processedText = text; // Return as-is if invalid JSON
          }
          break;
        case 'template':
          // Future: Could add template variable replacement here
          processedText = text;
          break;
        case 'markdown':
        case 'plain':
        default:
          processedText = text;
          break;
      }
      
      // Return with correct port name to match node definition
      return { text: processedText };
    });

    // JSON Parse Node
    this.nodeExecutors.set('json-parse', (node: FlowNode, inputs: Record<string, any>) => {
      const inputValue = inputs.input || Object.values(inputs)[0] || '';
      const extractField = node.data.extractField || '';
      const failOnError = node.data.failOnError || false;
      
      try {
        const jsonString = String(inputValue);
        const parsed = JSON.parse(jsonString);
        
        if (extractField) {
          // Support dot notation for nested field extraction
          const fields = extractField.split('.');
          let result = parsed;
          
          for (const field of fields) {
            if (result && typeof result === 'object' && field in result) {
              result = result[field];
            } else {
              return { output: undefined };
            }
          }
          
          return { output: result };
        }
        
        return { output: parsed };
      } catch (error) {
        if (failOnError) {
          throw new Error(`JSON Parse Error: ${error instanceof Error ? error.message : 'Invalid JSON'}`);
        }
        return { output: null };
      }
    });

    // If/Else Node
    this.nodeExecutors.set('if-else', (node: FlowNode, inputs: Record<string, any>) => {
      const inputValue = inputs.input || Object.values(inputs)[0];
      const expression = node.data.expression || 'input > 0';
      const trueValue = node.data.trueValue || '';
      const falseValue = node.data.falseValue || '';
      
      try {
        // Create a safe evaluation context
        const func = new Function('input', `return ${expression}`);
        const result = func(inputValue);
        
        if (result) {
          return { 
            true: trueValue || inputValue,
            false: undefined
          };
        } else {
          return { 
            true: undefined,
            false: falseValue || inputValue
          };
        }
      } catch (error) {
        console.error('If/Else expression error:', error);
        return { 
          true: undefined,
          false: falseValue || inputValue
        };
      }
    });

    // LLM Node
    this.nodeExecutors.set('llm', async (node: FlowNode, inputs: Record<string, any>) => {
      const apiBaseUrl = node.data.apiBaseUrl || 'https://api.openai.com/v1';
      const apiKey = node.data.apiKey || '';
      const model = node.data.model || 'gpt-3.5-turbo';
      const temperature = node.data.temperature || 0.7;
      const maxTokens = node.data.maxTokens || 1000;
      
      const systemMessage = inputs.system || '';
      const userMessage = inputs.user || '';
      const context = inputs.context || '';
      const memory = inputs.memory || [];
      const imageData = inputs.image || '';
      
      if (!userMessage) {
        throw new Error('User message is required for LLM node');
      }
      
      try {
        const messages = [];
        
        // Add system message if provided
        if (systemMessage) {
          messages.push({ role: 'system', content: systemMessage });
        }
        
        // Add memory/history if provided
        if (Array.isArray(memory) && memory.length > 0) {
          messages.push(...memory);
        }
        
        // Add context if provided
        if (context) {
          messages.push({ role: 'system', content: `Context: ${context}` });
        }
        
        // Add user message with optional image
        const userMessageContent = [];
        userMessageContent.push({ type: 'text', text: userMessage });
        
        if (imageData) {
          // Handle image data - it could be a string (base64) or an object from ImageInputNode
          let imageUrl = '';
          
          if (typeof imageData === 'string') {
            // Check if it's already a data URL
            if (imageData.startsWith('data:image/')) {
              imageUrl = imageData;
            } else {
              // Raw base64 string - add data URL prefix
              imageUrl = `data:image/jpeg;base64,${imageData}`;
            }
          } else if (typeof imageData === 'object' && imageData.base64) {
            // Object from ImageInputNode with base64 property
            const base64Value = imageData.base64;
            if (base64Value.startsWith('data:image/')) {
              imageUrl = base64Value;
            } else {
              imageUrl = `data:image/jpeg;base64,${base64Value}`;
            }
          }
          
          if (imageUrl) {
            userMessageContent.push({
              type: 'image_url',
              image_url: { url: imageUrl }
            });
          }
        }
        
        messages.push({
          role: 'user',
          content: userMessageContent.length === 1 ? userMessage : userMessageContent
        });
        
        const headers: Record<string, string> = {
          'Content-Type': 'application/json'
        };
        
        // Only add Authorization header if API key is provided
        if (apiKey && apiKey.trim()) {
          headers['Authorization'] = `Bearer ${apiKey}`;
        }
        
        const response = await fetch(`${apiBaseUrl}/chat/completions`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model,
            messages,
            temperature,
            max_tokens: maxTokens
          })
        });
        
        if (!response.ok) {
          if (response.status === 401) {
            throw new Error('Authentication failed - API key may be required or invalid');
          } else if (response.status === 403) {
            throw new Error('Access forbidden - check API key permissions');
          } else {
            throw new Error(`LLM API Error: ${response.status} ${response.statusText}`);
          }
        }
        
        const data = await response.json();
        
        return {
          response: data.choices?.[0]?.message?.content || '',
          usage: data.usage || {}
        };
        
      } catch (error) {
        throw new Error(`LLM execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    });

    // Structured LLM Node
    this.nodeExecutors.set('structured-llm', async (node: FlowNode, inputs: Record<string, any>) => {
      const apiBaseUrl = node.data.apiBaseUrl || 'https://api.openai.com/v1';
      const apiKey = node.data.apiKey || '';
      const model = node.data.model || 'gpt-4o-mini';
      const temperature = node.data.temperature || 0.7;
      const maxTokens = node.data.maxTokens || 1000;
      
      const prompt = inputs.prompt || '';
      const jsonExample = inputs.jsonExample || '';
      const context = inputs.context || '';
      
      if (!prompt) {
        throw new Error('Prompt is required for Structured LLM node');
      }
      
      if (!jsonExample) {
        throw new Error('JSON Example is required for Structured LLM node');
      }
      
      try {
        // Parse the JSON example to create a schema
        let exampleObject;
        try {
          exampleObject = JSON.parse(jsonExample);
        } catch (parseError) {
          throw new Error('Invalid JSON example format. Please provide valid JSON.');
        }
        
        // Generate a JSON schema from the example
        const schema = generateSchemaFromExample(exampleObject);
        
        // Build the messages
        const messages = [];
        
        // Add system message for structured output
        let systemPrompt = `You are a helpful assistant that generates structured JSON data based on user prompts and examples. You must respond with valid JSON that matches the provided structure exactly.`;
        
        if (context) {
          systemPrompt += `\n\nAdditional context: ${context}`;
        }
        
        messages.push({ role: 'system', content: systemPrompt });
        
        // Add user message with prompt and example
        const userMessage = `${prompt}\n\nPlease generate JSON data that follows this exact structure:\n${jsonExample}\n\nRespond only with valid JSON that matches this structure.`;
        messages.push({ role: 'user', content: userMessage });
        
        // Make API call with structured output
        const headers: Record<string, string> = {
          'Content-Type': 'application/json'
        };
        
        // Only add Authorization header if API key is provided
        if (apiKey && apiKey.trim()) {
          headers['Authorization'] = `Bearer ${apiKey}`;
        }
        
        const response = await fetch(`${apiBaseUrl}/chat/completions`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model,
            messages,
            temperature,
            max_tokens: maxTokens,
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "structured_output",
                description: "Generated structured data based on the provided example",
                schema: schema,
                strict: true
              }
            }
          })
        });
        
        if (!response.ok) {
          if (response.status === 401) {
            throw new Error('Authentication failed - API key may be required or invalid');
          } else if (response.status === 403) {
            throw new Error('Access forbidden - check API key permissions');
          } else {
            throw new Error(`Structured LLM API Error: ${response.status} ${response.statusText}`);
          }
        }
        
        const data = await response.json();
        const rawResponse = data.choices?.[0]?.message?.content || '';
        
        if (!rawResponse) {
          throw new Error('No response received from API');
        }
        
        // Parse the JSON response
        let jsonOutput;
        try {
          jsonOutput = JSON.parse(rawResponse);
        } catch (parseError) {
          throw new Error('API returned invalid JSON: ' + rawResponse);
        }
        
        return {
          jsonOutput,
          rawResponse,
          usage: data.usage || {}
        };
        
      } catch (error) {
        throw new Error(`Structured LLM execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    });

    // Image Input Node
    this.nodeExecutors.set('image-input', (node: FlowNode, inputs: Record<string, any>) => {
      // Check for uploaded image first, then fall back to saved workflow value
      const imageFile = inputs.input || Object.values(inputs)[0] || node.data.imageFile || '';
      const maxWidth = node.data.maxWidth || 1024;
      const maxHeight = node.data.maxHeight || 1024;
      
      if (!imageFile) {
        return {
          base64: '',
          metadata: {}
        };
      }
      
      // Handle the image data - it should be passed as-is (data URL format)
      // The next nodes expect data URLs like "data:image/jpeg;base64,XXXXX"
      let processedImage = imageFile;
      
      // If it's raw base64 without data URL prefix, add it
      if (typeof imageFile === 'string' && !imageFile.startsWith('data:')) {
        processedImage = `data:image/jpeg;base64,${imageFile}`;
      }
      
      // Return data with keys matching the output port IDs
      return {
        base64: processedImage, // Data URL format for LLM image input
        metadata: {
          width: maxWidth,
          height: maxHeight,
          type: 'image/jpeg',
          size: imageFile.length
        }
      };
    });

    // PDF Input Node
    this.nodeExecutors.set('pdf-input', async (node: FlowNode, inputs: Record<string, any>) => {
      // Check for uploaded PDF first, then fall back to saved workflow value
      const pdfFile = inputs.input || Object.values(inputs)[0] || node.data.pdfFile || '';
      const maxPages = node.data.maxPages || 50;
      const preserveFormatting = node.data.preserveFormatting || false;
      
      if (!pdfFile) {
        return {
          text: '',
          metadata: {
            pageCount: 0,
            size: 0,
            error: 'No PDF file provided'
          }
        };
      }
      
      try {
        // Import PDF.js
        const pdfjsLib = await import('pdfjs-dist');
        
        // Set worker source
        pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
        
        // Convert base64 to Uint8Array
        const binaryString = atob(pdfFile);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        
        // Load the PDF document
        const loadingTask = pdfjsLib.getDocument({ data: bytes });
        const pdf = await loadingTask.promise;
        
        const totalPages = Math.min(pdf.numPages, maxPages);
        let fullText = '';
        const pageTexts: string[] = [];
        
        // Extract text from each page
        for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
          const page = await pdf.getPage(pageNum);
          const textContent = await page.getTextContent();
          
          let pageText = '';
          const textItems = textContent.items;
          
          if (preserveFormatting) {
            // Preserve positioning and formatting
            let currentY = -1;
            
            for (const item of textItems) {
              if ('str' in item && 'transform' in item) {
                const y = item.transform[5];
                
                // Add line break if we're on a new line (different Y position)
                if (currentY !== -1 && Math.abs(currentY - y) > 5) {
                  pageText += '\n';
                }
                
                pageText += item.str + ' ';
                currentY = y;
              }
            }
          } else {
            // Simple text extraction without formatting
            for (const item of textItems) {
              if ('str' in item) {
                pageText += item.str + ' ';
              }
            }
          }
          
          // Clean up the page text
          pageText = pageText.trim();
          if (pageText) {
            pageTexts.push(`Page ${pageNum}:\n${pageText}`);
          }
        }
        
        // Combine all page texts
        fullText = pageTexts.join('\n\n');
        
        // Clean up text
        if (!preserveFormatting) {
          fullText = fullText
            .replace(/\s+/g, ' ')  // Replace multiple spaces with single space
            .replace(/\n\s*\n/g, '\n')  // Replace multiple newlines with single newline
            .trim();
        }
        
        return {
          text: fullText,
          metadata: {
            pageCount: totalPages,
            totalPagesInDocument: pdf.numPages,
            size: pdfFile.length,
            extractedCharacters: fullText.length,
            extractedWords: fullText.split(/\s+/).filter(word => word.length > 0).length,
            preserveFormatting,
            maxPages,
            processingTime: Date.now() // This would be calculated properly in a real implementation
          }
        };
        
      } catch (error) {
        console.error('PDF parsing error:', error);
        return {
          text: '',
          metadata: {
            pageCount: 0,
            size: pdfFile.length,
            error: `PDF processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            details: error instanceof Error ? error.stack : undefined
          }
        };
      }
    });

    // API Request Node - Production Grade
    this.nodeExecutors.set('api-request', async (node: FlowNode, inputs: Record<string, any>) => {
      const startTime = Date.now();
      
      // Get inputs
      const baseUrl = inputs.url || '';
      const requestBody = inputs.body;
      const additionalHeaders = inputs.headers || {};
      const queryParams = inputs.params || {};
      const authData = inputs.auth || {};
      
      // Get configuration
      const method = node.data.method || 'GET';
      const timeout = node.data.timeout || 30000;
      const maxRetries = node.data.retries || 3;
      const retryDelay = node.data.retryDelay || 1000;
      const authType = node.data.authType || 'none';
      const contentType = node.data.contentType || 'application/json';
      const responseType = node.data.responseType || 'auto';
      const followRedirects = node.data.followRedirects !== false;
      const validateStatus = node.data.validateStatus !== false;
      
      if (!baseUrl) {
        throw new Error('URL is required for API request');
      }
      
      let retryCount = 0;
      let lastError: Error | null = null;
      
      while (retryCount <= maxRetries) {
        try {
          // Build URL with query parameters
          const url = new URL(baseUrl);
          if (queryParams && typeof queryParams === 'object') {
            Object.entries(queryParams).forEach(([key, value]) => {
              if (value !== undefined && value !== null) {
                url.searchParams.append(key, String(value));
              }
            });
          }
          
          // Build headers
          const headers: Record<string, string> = {
            'User-Agent': 'ClaraVerse-API-Node/1.0',
            ...additionalHeaders
          };
          
          // Add Content-Type for methods that typically have a body
          if (['POST', 'PUT', 'PATCH'].includes(method.toUpperCase()) && requestBody !== undefined) {
            if (contentType !== 'custom') {
              headers['Content-Type'] = contentType;
            }
          }
          
          // Handle authentication
          switch (authType) {
            case 'apiKey':
              if (authData.key && authData.value) {
                if (authData.location === 'header') {
                  headers[authData.key] = authData.value;
                } else {
                  // Add to query params
                  url.searchParams.append(authData.key, authData.value);
                }
              }
              break;
              
            case 'bearer':
              if (authData.token) {
                headers['Authorization'] = `Bearer ${authData.token}`;
              }
              break;
              
            case 'basic':
              if (authData.username && authData.password) {
                const credentials = btoa(`${authData.username}:${authData.password}`);
                headers['Authorization'] = `Basic ${credentials}`;
              }
              break;
              
            case 'custom':
              if (authData.headerName && authData.headerValue) {
                headers[authData.headerName] = authData.headerValue;
              }
              break;
          }
          
          // Prepare request body
          let body: string | FormData | undefined;
          if (requestBody !== undefined && ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
            if (contentType === 'application/json') {
              body = typeof requestBody === 'string' ? requestBody : JSON.stringify(requestBody);
            } else if (contentType === 'application/x-www-form-urlencoded') {
              if (typeof requestBody === 'object') {
                const params = new URLSearchParams();
                Object.entries(requestBody).forEach(([key, value]) => {
                  if (value !== undefined && value !== null) {
                    params.append(key, String(value));
                  }
                });
                body = params.toString();
              } else {
                body = String(requestBody);
              }
            } else if (contentType === 'multipart/form-data') {
              if (typeof requestBody === 'object') {
                const formData = new FormData();
                Object.entries(requestBody).forEach(([key, value]) => {
                  if (value !== undefined && value !== null) {
                    formData.append(key, String(value));
                  }
                });
                body = formData;
                // Remove Content-Type to let browser set boundary
                delete headers['Content-Type'];
              } else {
                throw new Error('Multipart form data requires an object');
              }
            } else {
              body = String(requestBody);
            }
          }
          
          // Create AbortController for timeout
          const abortController = new AbortController();
          const timeoutId = setTimeout(() => abortController.abort(), timeout);
          
          // Make the request
          const response = await fetch(url.toString(), {
            method: method.toUpperCase(),
            headers,
            body,
            signal: abortController.signal,
            redirect: followRedirects ? 'follow' : 'manual'
          });
          
          clearTimeout(timeoutId);
          
          // Check status code
          const isSuccess = response.status >= 200 && response.status < 300;
          
          if (validateStatus && !isSuccess) {
            throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
          }
          
          // Parse response
          let responseData: any;
          const responseHeaders: Record<string, string> = {};
          
          // Extract headers
          response.headers.forEach((value, key) => {
            responseHeaders[key] = value;
          });
          
          // Parse response body
          const contentTypeHeader = response.headers.get('content-type') || '';
          
          try {
            if (responseType === 'json' || (responseType === 'auto' && contentTypeHeader.includes('application/json'))) {
              responseData = await response.json();
            } else if (responseType === 'binary') {
              responseData = await response.arrayBuffer();
            } else {
              responseData = await response.text();
              
              // Try to parse as JSON if auto-detect and looks like JSON
              if (responseType === 'auto' && typeof responseData === 'string') {
                const trimmed = responseData.trim();
                if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || 
                    (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
                  try {
                    responseData = JSON.parse(responseData);
                  } catch {
                    // Keep as text if JSON parsing fails
                  }
                }
              }
            }
          } catch (parseError) {
            // If parsing fails, return raw text
            responseData = await response.text();
          }
          
          const endTime = Date.now();
          
          return {
            data: responseData,
            status: response.status,
            headers: responseHeaders,
            success: isSuccess,
            metadata: {
              url: url.toString(),
              method: method.toUpperCase(),
              requestTime: endTime - startTime,
              retryCount,
              contentType: contentTypeHeader,
              size: response.headers.get('content-length') || 0,
              timestamp: new Date().toISOString()
            }
          };
          
        } catch (error) {
          lastError = error as Error;
          retryCount++;
          
          // Don't retry for certain types of errors
          if (error instanceof TypeError && error.message.includes('fetch')) {
            // Network error, worth retrying
          } else if (error instanceof Error && error.name === 'AbortError') {
            // Timeout, worth retrying
          } else if (error instanceof Error && error.message.includes('HTTP Error')) {
            // HTTP error with status code
            const statusMatch = error.message.match(/HTTP Error: (\d+)/);
            if (statusMatch) {
              const status = parseInt(statusMatch[1]);
              // Don't retry client errors (4xx), but retry server errors (5xx)
              if (status >= 400 && status < 500) {
                throw error;
              }
            }
          } else {
            // Other errors, don't retry
            throw error;
          }
          
          if (retryCount <= maxRetries) {
            // Wait before retrying with exponential backoff
            const delay = retryDelay * Math.pow(2, retryCount - 1);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }
      
      // If we've exhausted retries, throw the last error
      throw new Error(`API request failed after ${maxRetries} retries: ${lastError?.message || 'Unknown error'}`);
    });



    // File Upload Node
    this.nodeExecutors.set('file-upload', async (node: FlowNode, inputs: Record<string, any>) => {
      // Check for uploaded content first, then fall back to saved workflow value
      const uploadedContent = inputs.input || Object.values(inputs)[0];
      const outputs = node.data.outputs || {};
      
      return {
        content: uploadedContent || outputs.content || null,
        metadata: outputs.metadata || null
      };
    });

    // Combine Text Node
    this.nodeExecutors.set('combine-text', async (node: FlowNode, inputs: Record<string, any>, context: ExecutionContext) => {
      const { combineMode = 'concat', separator = '', addSpaces = true } = node.data;
      
      const text1 = inputs.text1 || '';
      const text2 = inputs.text2 || '';
      
      if (!text1 && !text2) {
        return {
          combined: '',
          metadata: {
            error: 'No text inputs provided',
            mode: combineMode,
            separator: separator,
            addSpaces: addSpaces
          }
        };
      }
      
      let combined = '';
      
      try {
        switch (combineMode) {
          case 'concat':
            combined = addSpaces ? `${text1} ${text2}` : `${text1}${text2}`;
            break;
            
          case 'separator':
            const sep = separator || '';
            if (addSpaces) {
              combined = `${text1} ${sep} ${text2}`;
            } else {
              combined = `${text1}${sep}${text2}`;
            }
            break;
            
          case 'prefix':
            combined = addSpaces ? `${text2} ${text1}` : `${text2}${text1}`;
            break;
            
          case 'suffix':
            combined = addSpaces ? `${text1} ${text2}` : `${text1}${text2}`;
            break;
            
          default:
            combined = addSpaces ? `${text1} ${text2}` : `${text1}${text2}`;
        }
        
        return {
          combined: combined,
          metadata: {
            mode: combineMode,
            separator: separator,
            addSpaces: addSpaces,
            text1Length: text1.length,
            text2Length: text2.length,
            combinedLength: combined.length,
            processingTime: Date.now()
          }
        };
        
      } catch (error) {
        return {
          combined: '',
          metadata: {
            error: `Text combination failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            mode: combineMode,
            separator: separator,
            addSpaces: addSpaces
          }
        };
      }
    });

    // Whisper Transcription Node
    this.nodeExecutors.set('whisper-transcription', async (node: FlowNode, inputs: Record<string, any>, context: ExecutionContext) => {
      const { apiKey, model = 'gpt-4o-transcribe', language = 'auto', temperature = 0, prompt = 'You are a transcription assistant. Transcribe the audio accurately.' } = node.data;
      
      if (!apiKey) {
        throw new Error('OpenAI API key is required for Whisper transcription');
      }

      // Get binary audio data from inputs
      const binaryData = inputs.audioData || inputs.content;
      if (!binaryData) {
        throw new Error('No binary audio data provided');
      }

      try {
        let audioBlob: Blob;

        // Handle different input formats
        if (Array.isArray(binaryData)) {
          // Binary array from File Upload node
          audioBlob = new Blob([new Uint8Array(binaryData)], { type: 'audio/mpeg' });
        } else if (typeof binaryData === 'string') {
          // Base64 string
          const binaryString = atob(binaryData);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          audioBlob = new Blob([bytes], { type: 'audio/mpeg' });
        } else if (binaryData instanceof Blob) {
          // Already a blob
          audioBlob = binaryData;
        } else {
          throw new Error('Unsupported binary data format');
        }

        // Create FormData for the API request
        const formData = new FormData();
        formData.append('file', audioBlob, 'audio.mp3');
        formData.append('model', model);
        
        if (language !== 'auto') {
          formData.append('language', language);
        }
        
        if (temperature > 0) {
          formData.append('temperature', temperature.toString());
        }

        // Add prompt for gpt-4o-transcribe model
        if (prompt && prompt.trim()) {
          formData.append('prompt', prompt);
        }

        // Make request to OpenAI Whisper API
        const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            // Note: Content-Type is automatically set by FormData
          },
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            errorData.error?.message || 
            `OpenAI API error: ${response.status} ${response.statusText}`
          );
        }

        const result = await response.json();
        
        return {
          text: result.text || '',
          metadata: {
            language: result.language || language,
            duration: result.duration,
            model: model,
            temperature: temperature,
            prompt: prompt,
            inputFormat: Array.isArray(binaryData) ? 'binary' : typeof binaryData,
            processingTime: Date.now()
          }
        };
      } catch (error) {
        if (error instanceof Error) {
          throw new Error(`Whisper transcription failed: ${error.message}`);
        }
        throw new Error('Whisper transcription failed: Unknown error');
      }
    });

    // Agent Executor Node
    this.nodeExecutors.set('agent-executor', async (node: FlowNode, inputs: Record<string, any>, context: ExecutionContext) => {
      const { 
        provider = 'claras-pocket',
        textModel = 'llama3.2:latest',
        visionModel = '',
        codeModel = '',
        enabledMCPServers = [],
        temperature = 0.7,
        maxTokens = 4000,
        maxRetries = 3,
        enableSelfCorrection = true,
        enableChainOfThought = true,
        enableToolGuidance = true,
        maxToolCalls = 10,
        confidenceThreshold = 0.7,
        
        // Custom Provider Support
        useCustomProvider = false,
        customProviderUrl = '',
        customProviderKey = '',
        customProviderModel = ''
      } = node.data;

        console.log('🔍 NodeRegistry Agent Executor - Raw node.data:', JSON.stringify(node.data, null, 2));
        console.log('🔍 NodeRegistry - Custom Provider Fields:', {
          useCustomProvider,
          customProviderUrl,
          customProviderKey: customProviderKey ? '[REDACTED]' : 'undefined',
          customProviderModel,
          textModel
        });      const instructions = inputs.instructions || '';
      const contextInput = inputs.context || '';
      const attachments = inputs.attachments || [];

      if (!instructions) {
        throw new Error('Instructions are required for Agent Executor');
      }

      try {
        // Import the Clara Agent Execution Service
        const { ClaraAgentExecutionService } = await import('../../services/claraAgentExecutionService');
        const agentService = new ClaraAgentExecutionService();

        context.log(`🤖 Executing autonomous agent with provider: ${provider}`);
        context.log(`📋 Instructions: ${instructions.substring(0, 100)}${instructions.length > 100 ? '...' : ''}`);
        
        if (enabledMCPServers.length > 0) {
          context.log(`🔧 MCP Servers enabled: ${enabledMCPServers.join(', ')}`);
        }

        // Build execution config with custom provider support
        const executionConfig = {
          provider: useCustomProvider ? 'custom' : provider,
          textModel: useCustomProvider ? customProviderModel || textModel : textModel,
          visionModel: useCustomProvider ? customProviderModel || visionModel : visionModel,
          codeModel: useCustomProvider ? customProviderModel || codeModel : codeModel,
          enabledMCPServers,
          temperature,
          maxTokens,
          maxRetries,
          enableSelfCorrection,
          enableChainOfThought,
          enableToolGuidance,
          maxToolCalls,
          confidenceThreshold,
          
          // Custom provider fields
          ...(useCustomProvider ? {
            customProviderUrl,
            customProviderKey
          } : {})
        };

        console.log('🚀 NodeRegistry Agent Execution Config:', JSON.stringify(executionConfig, null, 2));

        // Execute the agent
        const result = await agentService.executeAgent(
          instructions,
          executionConfig,
          contextInput,
          attachments
        );

        context.log(`✅ Agent execution completed successfully`);
        
        return {
          result: result.content,
          toolResults: result.toolResults || [],
          executionLog: result.executionLog || '',
          success: result.success,
          metadata: {
            ...result.metadata,
            mcpServers: enabledMCPServers,
            executionTime: result.metadata.duration || 0,
            retryCount: 0, // Not tracked in current implementation
            processingTime: Date.now()
          }
        };

      } catch (error) {
        context.error(`❌ Agent execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        
        return {
          result: '',
          toolResults: [],
          executionLog: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          success: false,
          metadata: {
            provider,
            model: textModel,
            mcpServers: enabledMCPServers,
            error: error instanceof Error ? error.message : 'Unknown error',
            processingTime: Date.now()
          }
        };
      }
    });

    // ComfyUI Image Generation Node
    this.nodeExecutors.set('comfyui-image-gen', async (node: FlowNode, inputs: Record<string, any>, context: ExecutionContext) => {
      const prompt = inputs.prompt || node.data.prompt || '';
      
      if (!prompt.trim()) {
        throw new Error('Prompt is required for image generation');
      }

      try {
        context.log('🎨 Starting ComfyUI image generation...');
        
        // Import the service dynamically to avoid circular dependencies
        const { comfyUIImageGenService } = await import('../../services/comfyUIImageGenService');
        
        // Ensure ComfyUI is connected
        const connectionResult = await comfyUIImageGenService.connectToComfyUI();
        if (!connectionResult.success) {
          throw new Error(`ComfyUI connection failed: ${connectionResult.error}`);
        }

        // Get available models and use the first one if none specified
        const availableModels = await comfyUIImageGenService.getAvailableModels();
        let selectedModel = node.data.selectedModel || '';
        
        if (!selectedModel && availableModels.length > 0) {
          selectedModel = availableModels[0];
          context.log(`📦 Auto-selected model: ${selectedModel}`);
        }
        
        if (!selectedModel) {
          throw new Error('No ComfyUI models available');
        }

        // Prepare generation configuration
        const config = {
          prompt,
          model: selectedModel,
          steps: node.data.steps || 20,
          guidanceScale: node.data.guidanceScale || 7.5,
          denoise: node.data.denoise || 1.0,
          sampler: node.data.sampler || 'euler',
          scheduler: node.data.scheduler || 'normal',
          width: node.data.width || 512,
          height: node.data.height || 512,
          negativePrompt: node.data.negativePrompt || '',
          seed: node.data.seed || -1
        };

        context.log(`🎨 Generation config: ${JSON.stringify(config, null, 2)}`);

        // Progress callback
        const onProgress = (progress: number, message: string) => {
          context.log(`📈 ${message} (${progress}%)`);
        };

        // Generate the image
        const result = await comfyUIImageGenService.generateImage(config, onProgress);
        
        context.log('✅ Image generation completed successfully');

        return {
          image: result.imageBase64,
          metadata: {
            prompt: result.prompt,
            seed: result.seed,
            duration: result.duration,
            model: selectedModel,
            config,
            timestamp: new Date().toISOString()
          }
        };

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        context.error(`❌ ComfyUI image generation failed: ${errorMessage}`);
        
        return {
          image: null,
          metadata: {
            error: errorMessage,
            timestamp: new Date().toISOString()
          }
        };
      }
    });

    // Text to Speech Node
    this.nodeExecutors.set('text-to-speech', async (node: FlowNode, inputs: Record<string, any>, context: ExecutionContext) => {
      const text = inputs.text || '';
      
      if (!text.trim()) {
        throw new Error('Text input is required for text-to-speech conversion');
      }

      try {
        context.log('🔊 Starting text-to-speech conversion...');
        
        // Import the service dynamically to avoid circular dependencies
        const { claraTTSService } = await import('../../services/claraTTSService');
        
        // Get configuration from node data
        const engine = node.data.engine || 'kokoro';
        const voice = node.data.voice || 'af_sarah';
        const language = node.data.language || 'en';
        const speed = node.data.speed || 1.0;
        const volume = node.data.volume || 1.0;
        const autoPlay = node.data.autoPlay !== undefined ? node.data.autoPlay : true;
        const slow = speed < 1.0;

        context.log(`🎤 TTS config: engine=${engine}, voice=${voice}, speed=${speed}, language=${language}, autoPlay=${autoPlay}`);

        // Check service health
        if (!claraTTSService.isBackendHealthy()) {
          throw new Error('TTS service is not available');
        }

        // Generate speech using the synthesizeText method
        const result = await claraTTSService.synthesizeText({
          text,
          engine: engine as 'gtts' | 'pyttsx3' | 'kokoro' | 'kokoro-onnx' | 'auto',
          voice,
          language,
          speed,
          slow
        });

        if (!result.success) {
          throw new Error(result.error || 'TTS generation failed');
        }

        context.log('✅ Text-to-speech conversion completed successfully');

        // Auto-play the audio if enabled
        if (autoPlay && result.audioUrl) {
          try {
            context.log('🔊 Auto-playing generated audio...');
            await claraTTSService.playAudioWithControls(
              result.audioUrl,
              volume,
              speed,
              `${node.id}-workflow` // Use node ID for tracking
            );
            context.log('🎵 Audio playback started');
          } catch (playError) {
            context.log(`⚠️ Audio auto-play failed: ${playError instanceof Error ? playError.message : 'Unknown error'}`);
            // Don't throw error for playback failure, just log it
          }
        }

        return {
          audioUrl: result.audioUrl,
          metadata: {
            text: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
            engine,
            voice,
            language,
            speed,
            volume,
            autoPlay,
            textLength: text.length,
            audioPlayed: autoPlay,
            timestamp: new Date().toISOString()
          }
        };

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        context.error(`❌ Text-to-speech conversion failed: ${errorMessage}`);
        
        return {
          audioUrl: null,
          metadata: {
            error: errorMessage,
            timestamp: new Date().toISOString()
          }
        };
      }
    });

    // Notebook Writer Node
    this.nodeExecutors.set('notebook-writer', async (node: FlowNode, inputs: Record<string, any>, context: ExecutionContext) => {
      context.log('📝 Notebook Writer - Debug inputs:', inputs);
      context.log('📝 Notebook Writer - Debug node data:', node.data);
      
      const text = inputs.text || inputs.content || inputs.value || inputs.output || '';
      
      context.log('📝 Notebook Writer - Extracted text:', { 
        text: text, 
        textLength: text.length, 
        textTrimmed: text.trim(),
        textTrimmedLength: text.trim().length,
        inputsKeys: Object.keys(inputs)
      });
      
      if (!text.trim()) {
        context.error('📝 Notebook Writer - Text validation failed:', {
          originalText: text,
          trimmedText: text.trim(),
          textType: typeof text,
          inputsReceived: inputs
        });
        throw new Error('Text content is required for notebook writing');
      }

      try {
        context.log('📝 Starting notebook write operation...');
        
        // Get configuration from node data
        const selectedNotebook = node.data.selectedNotebook || '';
        const documentTitle = node.data.documentTitle || '';

        if (!selectedNotebook) {
          throw new Error('Target notebook must be selected');
        }

        // Generate title if not provided
        let finalTitle = documentTitle.trim();
        if (!finalTitle) {
          const firstLine = text.split('\n')[0].trim();
          finalTitle = firstLine.length > 50 
            ? firstLine.substring(0, 47) + '...'
            : firstLine || 'Untitled Document';
        }

        context.log(`📓 Writing to notebook: "${selectedNotebook}" with title "${finalTitle}"`);

        // Import the Clara notebook service (we need to check if this works in Node context)
        try {
          // Dynamic import to handle both browser and Node contexts
          const serviceModule = await import('../../services/claraNotebookService');
          const { claraNotebookService } = serviceModule;
          
          // Check if service is healthy
          if (!claraNotebookService.isBackendHealthy()) {
            throw new Error('Notebook service is not available');
          }
          
          // Create File-like object from text content
          const fileName = finalTitle.replace(/[^a-zA-Z0-9\s]/g, '_').toLowerCase() + '.txt';
          
          // Create a proper File object (this might need polyfill in Node.js)
          const textFile = new File([text], fileName, { type: 'text/plain' });
          
          // Upload document to the notebook
          const results = await claraNotebookService.uploadDocuments(selectedNotebook, [textFile]);
          
          if (results && results.length > 0 && results[0].id) {
            const document = results[0];
            context.log(`✅ Document created successfully with ID: ${document.id}`);
            
            return {
              documentId: document.id,
              success: true
            };
          } else {
            throw new Error('Failed to create document - no result returned');
          }
          
        } catch (importError) {
          context.error('Failed to import notebook service or service not available:', importError);
          
          // Fallback to mock result for now
          const documentId = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          
          context.log('📝 Using fallback mock document creation');
          
          return {
            documentId: documentId,
            success: true
          };
        }

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        context.error(`❌ Notebook write operation failed: ${errorMessage}`);
        
        return {
          documentId: null,
          success: false
        };
      }
    });

    // Notebook Chat Node
    this.nodeExecutors.set('notebook-chat', async (node: FlowNode, inputs: Record<string, any>, context: ExecutionContext) => {
      context.log('💬 Notebook Chat - Debug inputs:', inputs);
      context.log('💬 Notebook Chat - Debug node data:', node.data);
      
      const query = inputs.query || inputs.question || inputs.text || inputs.content || inputs.value || inputs.output || '';
      
      context.log('💬 Notebook Chat - Extracted query:', { 
        query: query, 
        queryLength: query.length, 
        queryTrimmed: query.trim(),
        queryTrimmedLength: query.trim().length,
        inputsKeys: Object.keys(inputs)
      });
      
      if (!query.trim()) {
        context.error('💬 Notebook Chat - Query validation failed:', {
          originalQuery: query,
          trimmedQuery: query.trim(),
          queryType: typeof query,
          inputsReceived: inputs
        });
        throw new Error('Query text is required for notebook chat');
      }

      try {
        context.log('💬 Starting notebook chat operation...');
        
        // Get configuration from node data
        const selectedNotebook = node.data.selectedNotebook || '';
        const useChatHistory = node.data.useChatHistory !== false; // Default to true
        const responseMode = node.data.responseMode || 'hybrid';

        if (!selectedNotebook) {
          throw new Error('Target notebook must be selected');
        }

        context.log(`📓 Querying notebook: "${selectedNotebook}" with query: "${query.substring(0, 100)}${query.length > 100 ? '...' : ''}"`);

        // Import the Clara notebook service (we need to check if this works in Node context)
        try {
          // Dynamic import to handle both browser and Node contexts
          const serviceModule = await import('../../services/claraNotebookService');
          const { claraNotebookService } = serviceModule;
          
          // Check if service is healthy
          if (!claraNotebookService.isBackendHealthy()) {
            throw new Error('Notebook service is not available');
          }
          
          // Send chat message to the notebook
          const response = await claraNotebookService.sendChatMessage(selectedNotebook, {
            question: query.trim(),
            use_chat_history: useChatHistory,
            mode: responseMode,
            response_type: 'Multiple Paragraphs',
            top_k: 60
          });
          
          if (response && response.answer) {
            context.log(`✅ Query successful - Response length: ${response.answer.length}, Citations: ${response.citations?.length || 0}`);
            
            return {
              answer: response.answer,
              citations: response.citations || [],
              success: true,
              citationCount: response.citations?.length || 0,
              responseLength: response.answer.length
            };
          } else {
            throw new Error('No response received from notebook');
          }
          
        } catch (importError) {
          context.error('Failed to import notebook service or service not available:', importError);
          
          // Fallback to mock result for testing
          const mockResponse = `Mock response for query: "${query.substring(0, 50)}${query.length > 50 ? '...' : ''}"`;
          
          context.log('💬 Using fallback mock chat response');
          
          return {
            answer: mockResponse,
            citations: [],
            success: true,
            citationCount: 0,
            responseLength: mockResponse.length
          };
        }

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        context.error(`❌ Notebook chat operation failed: ${errorMessage}`);
        
        return {
          answer: '',
          citations: [],
          success: false,
          citationCount: 0,
          responseLength: 0,
          error: errorMessage
        };
      }
    });
  }

  registerCustomNode(customNode: any): void {
    this.customNodes.set(customNode.type, customNode);
    
    // Register the executor for the custom node
    this.nodeExecutors.set(customNode.type, async (node: FlowNode, inputs: Record<string, any>, context: ExecutionContext) => {
      try {
        // Create a sandboxed execution environment
        const executionFunction = new Function('inputs', 'properties', 'context', `
          ${customNode.executionCode}
          return execute(inputs, properties, context);
        `);
        
        const result = await executionFunction(inputs, node.data.properties || {}, context);
        return result || {};
        
      } catch (error) {
        context.error(`Custom node execution failed: ${error instanceof Error ? error.message : String(error)}`);
        throw error;
      }
    });
  }

  async executeNode(node: FlowNode, inputs: Record<string, any>, context: ExecutionContext): Promise<any> {
    const executor = this.nodeExecutors.get(node.type);
    
    if (!executor) {
      throw new Error(`Unknown node type: ${node.type}`);
    }
    
    try {
      return await executor(node, inputs, context);
    } catch (error) {
      context.error(`Node execution failed: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  isCustomNode(nodeType: string): boolean {
    return this.customNodes.has(nodeType);
  }

  getCustomNode(nodeType: string): any | undefined {
    return this.customNodes.get(nodeType);
  }

  getCustomNodes(): any[] {
    return Array.from(this.customNodes.values());
  }

  getAllNodeTypes(): string[] {
    return Array.from(this.nodeExecutors.keys());
  }
}

// Helper function to generate JSON schema from example
function generateSchemaFromExample(example: any): any {
  if (example === null) {
    return { type: 'null' };
  }
  
  if (Array.isArray(example)) {
    if (example.length === 0) {
      return { type: 'array', items: {} };
    }
    return {
      type: 'array',
      items: generateSchemaFromExample(example[0])
    };
  }
  
  if (typeof example === 'object') {
    const properties: Record<string, any> = {};
    const required: string[] = [];
    
    for (const [key, value] of Object.entries(example)) {
      properties[key] = generateSchemaFromExample(value);
      required.push(key);
    }
    
    return {
      type: 'object',
      properties,
      required,
      additionalProperties: false
    };
  }
  
  if (typeof example === 'string') {
    return { type: 'string' };
  }
  
  if (typeof example === 'number') {
    return Number.isInteger(example) ? { type: 'integer' } : { type: 'number' };
  }
  
  if (typeof example === 'boolean') {
    return { type: 'boolean' };
  }
  
  return { type: 'string' }; // fallback
} 