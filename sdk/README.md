# Clara Flow SDK

Lightweight JavaScript SDK for running Clara agent flows with comprehensive node support including AI, data processing, and API operations.

## Features

- 🚀 **Production-Ready**: Enterprise-grade execution engine with error handling and retry logic
- 🧠 **AI Integration**: Support for LLM nodes with OpenAI-compatible APIs
- 📊 **Structured Data**: Generate JSON outputs with schema validation
- 🌐 **API Operations**: Full-featured HTTP client with authentication and retries
- 📄 **PDF Processing**: Extract text from PDF documents with formatting preservation
- ⚡ **High Performance**: Optimized for fast execution and low memory usage
- 🔧 **Extensible**: Support for custom nodes and validation rules

## Installation

```bash
npm install clara-flow-sdk
```

## Quick Start

```javascript
import { ClaraFlowRunner } from 'clara-flow-sdk';

const runner = new ClaraFlowRunner({
  enableLogging: true,
  timeout: 30000
});

// Execute a flow exported from Clara Studio
const result = await runner.executeFlow(flowData, {
  inputValue: "Hello, World!"
});

console.log('Flow result:', result);
```

## Supported Node Types

The SDK supports all built-in node types from Clara Studio:

### Input & Output
- **`input`** - Handles text, number, JSON, and boolean inputs with type conversion
- **`output`** - Displays results with various formatting options
- **`image-input`** - Processes image files and converts to base64
- **`pdf-input`** - Extracts text from PDF documents with formatting options

### AI & Intelligence
- **`llm`** - Large Language Model interface with multi-modal support
- **`structured-llm`** - Generate structured JSON outputs using OpenAI's structured response format

### Data Processing
- **`json-parse`** - Parse JSON strings and extract nested fields with dot notation
- **`api-request`** - Production-grade HTTP client with comprehensive features

### Logic & Control
- **`if-else`** - Conditional logic with JavaScript expression evaluation

### Custom Nodes
- Support for registering and executing custom node types
- Sandboxed execution environment for security

## Advanced Usage

### API Request Node

The `api-request` node provides enterprise-grade HTTP functionality:

```javascript
// Example flow with API request node
const flowData = {
  name: "API Example",
  nodes: [
    {
      id: "api1",
      type: "api-request",
      data: {
        method: "POST",
        timeout: 30000,
        retries: 3,
        authType: "bearer",
        contentType: "application/json",
        responseType: "auto",
        validateStatus: true,
        followRedirects: true
      }
    }
  ],
  connections: []
};

const result = await runner.executeFlow(flowData, {
  url: "https://api.example.com/data",
  body: { key: "value" },
  headers: { "X-Custom": "header" },
  auth: { token: "your-bearer-token" }
});
```

**Features:**
- All HTTP methods (GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS)
- Multiple authentication types (API key, Bearer token, Basic auth, Custom headers)
- Content type handling (JSON, form data, multipart, text, XML)
- Auto-retry with exponential backoff
- Configurable timeouts and redirect handling
- Intelligent response parsing

### Structured LLM Node

Generate structured JSON outputs with any OpenAI-compatible API:

```javascript
const flowData = {
  name: "Structured Output",
  nodes: [
    {
      id: "structured1",
      type: "structured-llm",
      data: {
        apiBaseUrl: "http://localhost:11434/v1", // Ollama, OpenAI, or any compatible API
        model: "llama3", // Works with any model
        temperature: 0.7,
        apiKey: "your-api-key",
        useStructuredOutput: "auto" // auto, force, or disable
      }
    }
  ]
};

const result = await runner.executeFlow(flowData, {
  prompt: "Generate a user profile",
  jsonExample: JSON.stringify({
    name: "John Doe",
    age: 30,
    skills: ["JavaScript", "Python"],
    active: true
  }),
  context: "For a software developer"
});

// result.jsonOutput will match the structure exactly
```

**Features:**
- **Universal Compatibility**: Works with OpenAI, Ollama, and any OpenAI-compatible API
- **Smart Fallback**: Automatically detects API capabilities and falls back to prompt-based JSON generation
- **Robust Parsing**: Handles various response formats including markdown-wrapped JSON
- **Schema Validation**: Uses OpenAI's structured output when available for guaranteed accuracy

### PDF Input Node

Extract text from PDF documents:

```javascript
const result = await runner.executeFlow(flowData, {
  pdfFile: base64PdfData,  // PDF as base64 string
  maxPages: 10,
  preserveFormatting: true
});

console.log('Extracted text:', result.text);
console.log('Metadata:', result.metadata);
```

**Features:**
- Page-by-page text extraction
- Formatting preservation options
- Comprehensive metadata (page count, word count, etc.)
- Error handling and validation

## Error Handling

The SDK provides comprehensive error handling:

```javascript
try {
  const result = await runner.executeFlow(flowData, inputs);
} catch (error) {
  console.error('Flow execution failed:', error.message);
  
  // Get detailed logs
  const logs = runner.getLogs();
  console.log('Execution logs:', logs);
}
```

## Configuration Options

```javascript
const runner = new ClaraFlowRunner({
  enableLogging: true,        // Enable detailed logging
  timeout: 60000,             // Global timeout in milliseconds
  sandbox: true,              // Sandbox custom node execution
  maxNodes: 1000,             // Maximum nodes per flow
  maxDepth: 100               // Maximum execution depth
});
```

## Custom Nodes

Register custom node types:

```javascript
await runner.registerCustomNode({
  type: 'custom-transform',
  name: 'Custom Transform',
  inputs: [{ id: 'input', name: 'Input', type: 'any' }],
  outputs: [{ id: 'output', name: 'Output', type: 'any' }],
  executionCode: `
    function execute(inputs, properties, context) {
      return { output: inputs.input.toUpperCase() };
    }
  `
});
```

## Flow Format Compatibility

The SDK supports multiple flow formats:

```javascript
// Agent Studio export format
const agentStudioExport = {
  format: "clara-sdk",
  version: "1.0.0",
  flow: {
    id: "flow-1",
    name: "My Flow",
    nodes: [...],
    connections: [...]
  },
  customNodes: [...],
  metadata: {...}
};

// Direct flow format
const directFlow = {
  id: "flow-1",
  name: "My Flow", 
  nodes: [...],
  connections: [...]
};

// Both formats work seamlessly
await runner.executeFlow(agentStudioExport);
await runner.executeFlow(directFlow);
```

## Performance

- **Fast Execution**: Optimized node execution pipeline
- **Memory Efficient**: Minimal memory footprint
- **Concurrent Execution**: Support for parallel node execution
- **Streaming Support**: Handle large data sets efficiently

## Browser Support

The SDK works in both Node.js and browser environments:

```html
<!-- Browser usage -->
<script type="module">
  import { ClaraFlowRunner } from 'clara-flow-sdk';
  
  const runner = new ClaraFlowRunner();
  // Use as normal
</script>
```

## License

MIT License - see LICENSE file for details.

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

## Support

- 📖 Documentation: [Full API Documentation](docs/)
- 🐛 Issues: [GitHub Issues](https://github.com/clara-ai/clara-sdk/issues)
- 💬 Community: [Clara Community](https://community.clara.ai) 