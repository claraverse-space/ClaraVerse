import { NodeDefinition } from '../../types/agent/types';

// Comprehensive Node Definitions for AI Agent Builder
export const simpleNodeDefinitions: NodeDefinition[] = [
  // INPUT NODE - supports text, json, number
  {
    id: 'input-node',
    name: 'Input',
    type: 'input',
    category: 'basic',
    description: 'Provides input values to the workflow - supports text, JSON, and numbers',
    icon: 'input',
    version: '1.0.0',
    author: 'Clara',
    inputs: [],
    outputs: [
      {
        id: 'output',
        name: 'Value',
        type: 'output',
        dataType: 'any',
        description: 'Input value'
      }
    ],
    properties: [
      {
        id: 'inputType',
        name: 'Input Type',
        type: 'select',
        defaultValue: 'text',
        options: [
          { label: 'Text', value: 'text' },
          { label: 'Number', value: 'number' },
          { label: 'JSON', value: 'json' }
        ],
        description: 'Type of input value'
      },
      {
        id: 'value',
        name: 'Value',
        type: 'string',
        defaultValue: '',
        description: 'The input value'
      },
      {
        id: 'label',
        name: 'Label',
        type: 'string',
        defaultValue: 'Input',
        description: 'Display label for this input'
      }
    ],
    executionHandler: 'input-node-handler',
    metadata: {
      tags: ['input', 'basic', 'source'],
      documentation: 'Provides input values to start or feed the workflow. Supports text, numbers, and JSON objects.'
    }
  },

  // JSON PARSE NODE
  {
    id: 'json-parse-node',
    name: 'JSON Parser',
    type: 'json-parse',
    category: 'data',
    description: 'Parse JSON data and optionally extract specific fields',
    icon: 'braces',
    version: '1.0.0',
    author: 'Clara',
    inputs: [
      {
        id: 'input',
        name: 'JSON Data',
        type: 'input',
        dataType: 'string',
        required: true,
        description: 'JSON string to parse'
      }
    ],
    outputs: [
      {
        id: 'output',
        name: 'Parsed Data',
        type: 'output',
        dataType: 'any',
        description: 'Parsed JSON object or extracted field value'
      }
    ],
    properties: [
      {
        id: 'extractField',
        name: 'Extract Field',
        type: 'string',
        defaultValue: '',
        description: 'Optional: specific field to extract (use dot notation for nested fields, e.g. user.name)'
      },
      {
        id: 'failOnError',
        name: 'Fail on Parse Error',
        type: 'boolean',
        defaultValue: false,
        description: 'Whether to fail execution if JSON parsing fails'
      }
    ],
    executionHandler: 'json-parse-node-handler',
    metadata: {
      tags: ['json', 'parser', 'data'],
      documentation: 'Parses JSON strings and optionally extracts specific fields using dot notation.'
    }
  },

  // OUTPUT NODE
  {
    id: 'output-node',
    name: 'Output',
    type: 'output',
    category: 'basic',
    description: 'Displays the final result of the workflow',
    icon: 'external-link',
    version: '1.0.0',
    author: 'Clara',
    inputs: [
      {
        id: 'input',
        name: 'Value',
        type: 'input',
        dataType: 'any',
        required: true,
        description: 'Value to output'
      }
    ],
    outputs: [],
    properties: [
      {
        id: 'outputLabel',
        name: 'Output Label',
        type: 'string',
        defaultValue: 'Result',
        description: 'Label for the output'
      },
      {
        id: 'format',
        name: 'Output Format',
        type: 'select',
        defaultValue: 'auto',
        options: [
          { label: 'Auto', value: 'auto' },
          { label: 'Text', value: 'text' },
          { label: 'JSON', value: 'json' },
          { label: 'Raw', value: 'raw' }
        ],
        description: 'How to format the output display'
      }
    ],
    executionHandler: 'output-node-handler',
    metadata: {
      tags: ['output', 'basic', 'sink'],
      documentation: 'Displays the final result with various formatting options.'
    }
  },

  // IF/ELSE NODE
  {
    id: 'if-else-node',
    name: 'If/Else',
    type: 'if-else',
    category: 'logic',
    description: 'Conditional logic based on expression evaluation',
    icon: 'git-branch',
    version: '1.0.0',
    author: 'Clara',
    inputs: [
      {
        id: 'input',
        name: 'Input Variable',
        type: 'input',
        dataType: 'any',
        required: true,
        description: 'Input value to evaluate'
      }
    ],
    outputs: [
      {
        id: 'true',
        name: 'True',
        type: 'output',
        dataType: 'any',
        description: 'Output when condition is true'
      },
      {
        id: 'false',
        name: 'False',
        type: 'output',
        dataType: 'any',
        description: 'Output when condition is false'
      }
    ],
    properties: [
      {
        id: 'expression',
        name: 'Expression',
        type: 'string',
        defaultValue: 'input > 0',
        description: 'JavaScript expression to evaluate (use "input" as variable name)'
      },
      {
        id: 'trueValue',
        name: 'True Value',
        type: 'string',
        defaultValue: '',
        description: 'Value to output when true (empty = pass input through)'
      },
      {
        id: 'falseValue',
        name: 'False Value',
        type: 'string',
        defaultValue: '',
        description: 'Value to output when false (empty = pass input through)'
      }
    ],
    executionHandler: 'if-else-node-handler',
    metadata: {
      tags: ['logic', 'conditional', 'control-flow'],
      documentation: 'Evaluates JavaScript expressions and routes data based on the result.'
    }
  },

  // LLM NODE
  {
    id: 'llm-node',
    name: 'LLM Chat',
    type: 'llm',
    category: 'ai',
    description: 'Large Language Model chat interface with multiple inputs and image support',
    icon: 'brain',
    version: '1.0.0',
    author: 'Clara',
    inputs: [
      {
        id: 'system',
        name: 'System Message',
        type: 'input',
        dataType: 'string',
        required: false,
        description: 'System prompt for the LLM'
      },
      {
        id: 'user',
        name: 'User Message',
        type: 'input',
        dataType: 'string',
        required: true,
        description: 'User message/prompt'
      },
      {
        id: 'context',
        name: 'Pre-context',
        type: 'input',
        dataType: 'string',
        required: false,
        description: 'Additional context to prepend'
      },
      {
        id: 'memory',
        name: 'Memory',
        type: 'input',
        dataType: 'array',
        required: false,
        description: 'Conversation history array (messages with role and content)'
      },
      {
        id: 'image',
        name: 'Image',
        type: 'input',
        dataType: 'string',
        required: false,
        description: 'Base64 encoded image data'
      }
    ],
    outputs: [
      {
        id: 'response',
        name: 'Response',
        type: 'output',
        dataType: 'string',
        description: 'LLM response text'
      },
      {
        id: 'usage',
        name: 'Usage Stats',
        type: 'output',
        dataType: 'object',
        description: 'Token usage and cost information'
      }
    ],
    properties: [
      {
        id: 'apiBaseUrl',
        name: 'API Base URL',
        type: 'string',
        defaultValue: 'https://api.openai.com/v1',
        description: 'OpenAI-compatible API base URL'
      },
      {
        id: 'apiKey',
        name: 'API Key',
        type: 'string',
        defaultValue: '',
        description: 'API key for authentication'
      },
      {
        id: 'model',
        name: 'Model',
        type: 'select',
        defaultValue: 'gpt-3.5-turbo',
        options: [
          { label: 'GPT-3.5 Turbo', value: 'gpt-3.5-turbo' },
          { label: 'GPT-4', value: 'gpt-4' },
          { label: 'GPT-4 Vision', value: 'gpt-4-vision-preview' },
          { label: 'Claude 3 Haiku', value: 'claude-3-haiku-20240307' },
          { label: 'Claude 3 Sonnet', value: 'claude-3-sonnet-20240229' },
          { label: 'Claude 3 Opus', value: 'claude-3-opus-20240229' }
        ],
        description: 'AI model to use'
      },
      {
        id: 'temperature',
        name: 'Temperature',
        type: 'number',
        defaultValue: 0.7,
        description: 'Temperature for response generation (0.0 - 2.0)'
      },
      {
        id: 'maxTokens',
        name: 'Max Tokens',
        type: 'number',
        defaultValue: 1000,
        description: 'Maximum tokens in response'
      }
    ],
    executionHandler: 'llm-node-handler',
    metadata: {
      tags: ['ai', 'llm', 'chat', 'openai'],
      documentation: 'Interfaces with OpenAI-compatible APIs for text and vision tasks.'
    }
  },

  // STRUCTURED LLM NODE
  {
    id: 'structured-llm-node',
    name: 'Structured LLM',
    type: 'structured-llm',
    category: 'ai',
    description: 'Generate structured JSON outputs using OpenAI structured response format',
    icon: 'chart',
    version: '1.0.0',
    author: 'Clara',
    inputs: [
      {
        id: 'prompt',
        name: 'Prompt',
        type: 'input',
        dataType: 'string',
        required: true,
        description: 'The prompt describing what to generate'
      },
      {
        id: 'jsonExample',
        name: 'JSON Example',
        type: 'input',
        dataType: 'string',
        required: true,
        description: 'Example JSON structure that defines the output format'
      },
      {
        id: 'context',
        name: 'Context',
        type: 'input',
        dataType: 'string',
        required: false,
        description: 'Additional context for generation'
      }
    ],
    outputs: [
      {
        id: 'jsonOutput',
        name: 'JSON Output',
        type: 'output',
        dataType: 'object',
        description: 'Generated JSON object matching the example structure'
      },
      {
        id: 'rawResponse',
        name: 'Raw Response',
        type: 'output',
        dataType: 'string',
        description: 'Raw JSON string response'
      },
      {
        id: 'usage',
        name: 'Usage Stats',
        type: 'output',
        dataType: 'object',
        description: 'Token usage and cost information'
      }
    ],
    properties: [
      {
        id: 'apiBaseUrl',
        name: 'API Base URL',
        type: 'string',
        defaultValue: 'https://api.openai.com/v1',
        description: 'OpenAI API base URL'
      },
      {
        id: 'apiKey',
        name: 'API Key',
        type: 'string',
        defaultValue: '',
        description: 'OpenAI API key for authentication'
      },
      {
        id: 'model',
        name: 'Model',
        type: 'select',
        defaultValue: 'gpt-4o-mini',
        options: [
          { label: 'GPT-4o Mini', value: 'gpt-4o-mini' },
          { label: 'GPT-4o', value: 'gpt-4o' },
          { label: 'GPT-4 Turbo', value: 'gpt-4-turbo-preview' }
        ],
        description: 'OpenAI model to use (structured outputs require GPT-4 models)'
      },
      {
        id: 'temperature',
        name: 'Temperature',
        type: 'number',
        defaultValue: 0.7,
        description: 'Temperature for response generation (0.0 - 2.0)'
      },
      {
        id: 'maxTokens',
        name: 'Max Tokens',
        type: 'number',
        defaultValue: 1000,
        description: 'Maximum tokens in response'
      }
    ],
    executionHandler: 'structured-llm-node-handler',
    metadata: {
      tags: ['ai', 'llm', 'structured', 'json', 'openai'],
      documentation: 'Uses OpenAI structured output feature to generate JSON that matches a provided example format.'
    }
  },

  // IMAGE INPUT NODE
  {
    id: 'image-input-node',
    name: 'Image Input',
    type: 'image-input',
    category: 'media',
    description: 'Accepts image files and outputs base64 encoded data',
    icon: 'image',
    version: '1.0.0',
    author: 'Clara',
    inputs: [],
    outputs: [
      {
        id: 'base64',
        name: 'Base64 Data',
        type: 'output',
        dataType: 'string',
        description: 'Base64 encoded image data'
      },
      {
        id: 'metadata',
        name: 'Image Metadata',
        type: 'output',
        dataType: 'object',
        description: 'Image information (size, type, etc.)'
      }
    ],
    properties: [
      {
        id: 'imageFile',
        name: 'Image File',
        type: 'string',
        defaultValue: '',
        description: 'Image file or URL'
      },
      {
        id: 'maxWidth',
        name: 'Max Width',
        type: 'number',
        defaultValue: 1024,
        description: 'Maximum width for image resize'
      },
      {
        id: 'maxHeight',
        name: 'Max Height',
        type: 'number',
        defaultValue: 1024,
        description: 'Maximum height for image resize'
      },
      {
        id: 'quality',
        name: 'Quality',
        type: 'number',
        defaultValue: 0.8,
        description: 'Image compression quality (0.1 - 1.0)'
      }
    ],
    executionHandler: 'image-input-node-handler',
    metadata: {
      tags: ['image', 'input', 'base64', 'media'],
      documentation: 'Processes image files and converts them to base64 for AI model consumption.'
    }
  },

  // PDF INPUT NODE
  {
    id: 'pdf-input-node',
    name: 'Load PDF',
    type: 'pdf-input',
    category: 'input',
    description: 'Upload PDF files and extract text content',
    icon: 'file-text',
    version: '1.0.0',
    author: 'Clara',
    inputs: [],
    outputs: [
      {
        id: 'text',
        name: 'Extracted Text',
        type: 'output',
        dataType: 'string',
        required: true,
        description: 'Text content extracted from the PDF'
      },
      {
        id: 'metadata',
        name: 'Metadata',
        type: 'output',
        dataType: 'object',
        required: false,
        description: 'PDF metadata including page count, file size, etc.'
      }
    ],
    properties: [
      {
        id: 'maxPages',
        name: 'Max Pages',
        type: 'number',
        defaultValue: 50,
        description: 'Maximum number of pages to process',
        validation: {
          min: 1,
          max: 200
        }
      },
      {
        id: 'preserveFormatting',
        name: 'Preserve Formatting',
        type: 'boolean',
        defaultValue: false,
        description: 'Attempt to preserve text formatting and layout'
      }
    ],
    executionHandler: 'pdf-input-node-handler',
    metadata: {
      examples: [
        {
          name: 'Basic PDF Text Extraction',
          description: 'Extract all text from a PDF document',
          config: {
            maxPages: 50,
            preserveFormatting: false
          }
        }
      ]
    }
  },

  // API REQUEST NODE
  {
    id: 'api-request-node',
    name: 'API Request',
    type: 'api-request',
    category: 'data',
    description: 'Production-grade HTTP/REST API client with comprehensive features',
    icon: 'globe',
    version: '1.0.0',
    author: 'Clara',
    inputs: [
      {
        id: 'url',
        name: 'URL',
        type: 'input',
        dataType: 'string',
        required: true,
        description: 'API endpoint URL'
      },
      {
        id: 'body',
        name: 'Request Body',
        type: 'input',
        dataType: 'any',
        required: false,
        description: 'Request body data (JSON object, string, etc.)'
      },
      {
        id: 'headers',
        name: 'Headers',
        type: 'input',
        dataType: 'object',
        required: false,
        description: 'Additional HTTP headers as JSON object'
      },
      {
        id: 'params',
        name: 'Query Params',
        type: 'input',
        dataType: 'object',
        required: false,
        description: 'URL query parameters as JSON object'
      },
      {
        id: 'auth',
        name: 'Auth Data',
        type: 'input',
        dataType: 'object',
        required: false,
        description: 'Authentication data (API key, token, etc.)'
      }
    ],
    outputs: [
      {
        id: 'data',
        name: 'Response Data',
        type: 'output',
        dataType: 'any',
        required: true,
        description: 'Parsed response data (JSON object or raw text)'
      },
      {
        id: 'status',
        name: 'Status Code',
        type: 'output',
        dataType: 'number',
        required: true,
        description: 'HTTP status code (200, 404, 500, etc.)'
      },
      {
        id: 'headers',
        name: 'Response Headers',
        type: 'output',
        dataType: 'object',
        required: true,
        description: 'HTTP response headers'
      },
      {
        id: 'success',
        name: 'Success',
        type: 'output',
        dataType: 'boolean',
        required: true,
        description: 'Whether the request was successful (2xx status)'
      },
      {
        id: 'metadata',
        name: 'Metadata',
        type: 'output',
        dataType: 'object',
        required: false,
        description: 'Request metadata (timing, retries, etc.)'
      }
    ],
    properties: [
      {
        id: 'method',
        name: 'HTTP Method',
        type: 'select',
        defaultValue: 'GET',
        options: [
          { label: 'GET', value: 'GET' },
          { label: 'POST', value: 'POST' },
          { label: 'PUT', value: 'PUT' },
          { label: 'PATCH', value: 'PATCH' },
          { label: 'DELETE', value: 'DELETE' },
          { label: 'HEAD', value: 'HEAD' },
          { label: 'OPTIONS', value: 'OPTIONS' }
        ],
        description: 'HTTP method for the request'
      },
      {
        id: 'timeout',
        name: 'Timeout (ms)',
        type: 'number',
        defaultValue: 30000,
        description: 'Request timeout in milliseconds'
      },
      {
        id: 'retries',
        name: 'Max Retries',
        type: 'number',
        defaultValue: 3,
        description: 'Maximum number of retry attempts'
      },
      {
        id: 'retryDelay',
        name: 'Retry Delay (ms)',
        type: 'number',
        defaultValue: 1000,
        description: 'Delay between retry attempts'
      },
      {
        id: 'authType',
        name: 'Authentication Type',
        type: 'select',
        defaultValue: 'none',
        options: [
          { label: 'None', value: 'none' },
          { label: 'API Key', value: 'apiKey' },
          { label: 'Bearer Token', value: 'bearer' },
          { label: 'Basic Auth', value: 'basic' },
          { label: 'Custom Header', value: 'custom' }
        ],
        description: 'Type of authentication to use'
      },
      {
        id: 'contentType',
        name: 'Content Type',
        type: 'select',
        defaultValue: 'application/json',
        options: [
          { label: 'JSON', value: 'application/json' },
          { label: 'Form Data', value: 'application/x-www-form-urlencoded' },
          { label: 'Multipart', value: 'multipart/form-data' },
          { label: 'Plain Text', value: 'text/plain' },
          { label: 'XML', value: 'application/xml' },
          { label: 'Custom', value: 'custom' }
        ],
        description: 'Content-Type header for request body'
      },
      {
        id: 'responseType',
        name: 'Response Type',
        type: 'select',
        defaultValue: 'auto',
        options: [
          { label: 'Auto Detect', value: 'auto' },
          { label: 'JSON', value: 'json' },
          { label: 'Text', value: 'text' },
          { label: 'Binary', value: 'binary' }
        ],
        description: 'How to parse the response'
      },
      {
        id: 'followRedirects',
        name: 'Follow Redirects',
        type: 'boolean',
        defaultValue: true,
        description: 'Follow HTTP redirects automatically'
      },
      {
        id: 'validateStatus',
        name: 'Validate Status',
        type: 'boolean',
        defaultValue: true,
        description: 'Throw error for non-2xx status codes'
      }
    ],
    executionHandler: 'api-request-node-handler',
    metadata: {
      tags: ['data', 'api', 'http', 'rest'],
      documentation: 'Handles HTTP/REST API requests with comprehensive features.'
    }
  },

  // TEXT PROCESSING NODE
];

// Helper functions
export const getSimpleNodeDefinitionsByCategory = (category: string): NodeDefinition[] => {
  return simpleNodeDefinitions.filter(def => def.category === category);
};

export const getSimpleNodeCategories = (): string[] => {
  const categories = simpleNodeDefinitions.map(def => def.category);
  return [...new Set(categories)];
};

export const searchSimpleNodeDefinitions = (query: string): NodeDefinition[] => {
  const lowercaseQuery = query.toLowerCase();
  return simpleNodeDefinitions.filter(def => 
    def.name.toLowerCase().includes(lowercaseQuery) ||
    def.description.toLowerCase().includes(lowercaseQuery) ||
    def.metadata?.tags?.some(tag => tag.toLowerCase().includes(lowercaseQuery))
  );
}; 