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
  }
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