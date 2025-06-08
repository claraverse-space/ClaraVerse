# Clara Flow SDK

Lightweight JavaScript SDK for running Clara agent flows with comprehensive node support including AI, data processing, API operations, file handling, and audio transcription.

## Features

- 🚀 **Production-Ready**: Enterprise-grade execution engine with error handling and retry logic
- 🧠 **AI Integration**: Support for LLM nodes with OpenAI-compatible APIs
- 📊 **Structured Data**: Generate JSON outputs with schema validation
- 🌐 **API Operations**: Full-featured HTTP client with authentication and retries
- 📄 **PDF Processing**: Extract text from PDF documents with formatting preservation
- 📁 **File Handling**: Universal file upload with multiple output formats and validation
- 🎙️ **Audio Transcription**: OpenAI Whisper integration for speech-to-text
- 📝 **Text Processing**: Advanced text combination and manipulation tools
- ⚡ **High Performance**: Optimized for fast execution and low memory usage
- 🔧 **Extensible**: Support for custom nodes and validation rules

## Installation

### Node.js / npm

```bash
npm install clara-flow-sdk
```

### CDN / Browser

```html
<!-- Latest version -->
<script src="https://unpkg.com/clara-flow-sdk@latest/dist/clara-flow-sdk.umd.js"></script>

<!-- Minified version -->
<script src="https://unpkg.com/clara-flow-sdk@latest/dist/clara-flow-sdk.umd.min.js"></script>

<!-- Specific version -->
<script src="https://unpkg.com/clara-flow-sdk@1.4.0/dist/clara-flow-sdk.umd.js"></script>
```

## Quick Start

### Node.js / ES Modules

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

### Browser / CDN

```html
<!DOCTYPE html>
<html>
<head>
    <title>Clara Flow SDK Example</title>
</head>
<body>
    <!-- Load the SDK -->
    <script src="https://unpkg.com/clara-flow-sdk@latest/dist/clara-flow-sdk.umd.js"></script>
    
    <script>
        // Initialize the flow runner
        const runner = new ClaraFlowSDK.ClaraFlowRunner({
            enableLogging: true,
            timeout: 30000
        });
        
        // Execute a flow
        runner.executeFlow(flowData, { inputValue: "Hello, World!" })
            .then(result => {
                console.log('Flow result:', result);
            })
            .catch(error => {
                console.error('Flow error:', error);
            });
    </script>
</body>
</html>
```

### Browser-Specific Features

The browser version includes additional utilities for web applications:

```javascript
// File upload handling
const fileInput = document.getElementById('file-input');
const file = fileInput.files[0];

// Upload as base64
runner.handleFileUpload(file, { outputFormat: 'base64' })
    .then(base64Data => console.log('File as base64:', base64Data));

// Browser utilities
const browserInfo = ClaraFlowSDK.BrowserUtils.getBrowserInfo();
const isBrowser = ClaraFlowSDK.BrowserUtils.isBrowser();

// Flow import/export
ClaraFlowSDK.BrowserUtils.downloadFlow(flowData, 'my-flow.json');
ClaraFlowSDK.BrowserUtils.loadFlowFromFileInput(fileInput)
    .then(flowData => console.log('Loaded flow:', flowData));
```

## Supported Node Types

The SDK supports all built-in node types from Clara Studio:

### Input & Output
- **`input`** - Handles text, number, JSON, and boolean inputs with type conversion
- **`output`** - Displays results with various formatting options
- **`image-input`** - Processes image files and converts to base64
- **`pdf-input`** - Extracts text from PDF documents with formatting options
- **`file-upload`** - Universal file upload with configurable output formats and validation

### AI & Intelligence
- **`llm`** - Large Language Model interface with multi-modal support
- **`structured-llm`** - Generate structured JSON outputs using OpenAI's structured response format
- **`whisper-transcription`** - Audio transcription using OpenAI Whisper API

### Data Processing
- **`json-parse`** - Parse JSON strings and extract nested fields with dot notation
- **`api-request`** - Production-grade HTTP client with comprehensive features
- **`combine-text`** - Combines two text inputs with configurable separation for prompt building

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

### Combine Text Node

Combine two text inputs with configurable separation:

```javascript
const result = await runner.executeFlow(flowData, {
  text1: "Hello",
  text2: "World"
});

// With different modes:
// mode: "concatenate" -> "Hello World"
// mode: "newline" -> "Hello\nWorld"
// mode: "comma" -> "Hello, World"
// mode: "custom" -> "Hello[separator]World"
```

**Features:**
- Multiple combination modes (concatenate, newline, space, comma, custom)
- Configurable separators and spacing
- Optimized for prompt building and text processing
- Handles empty inputs gracefully

### File Upload Node

Universal file handling with multiple output formats:

```javascript
const result = await runner.executeFlow(flowData, {
  file: base64FileData  // File as base64 string or binary data
});

console.log('File info:', result.fileName, result.mimeType, result.size);
console.log('File data:', result.data);
```

**Configuration Options:**
- `outputFormat`: "base64", "base64_raw", "binary", "text", "metadata"
- `maxSize`: Maximum file size in bytes (default: 10MB)
- `allowedTypes`: Array of allowed MIME types

**Features:**
- Universal file format support
- Multiple output formats for different use cases
- File size and type validation
- Metadata extraction (name, type, size, timestamp)
- Binary and text data handling

### Whisper Transcription Node

Transcribe audio using OpenAI's Whisper API:

```javascript
const result = await runner.executeFlow(flowData, {
  audio: audioData  // Audio as base64, binary, or Blob
});

console.log('Transcription:', result.text);
console.log('Language:', result.language);
console.log('Duration:', result.duration);
```

**Configuration Options:**
- `model`: Whisper model to use (default: "whisper-1")
- `language`: Target language (optional, auto-detected if not specified)
- `prompt`: Context prompt to improve accuracy
- `responseFormat`: "text", "json", "verbose_json"
- `temperature`: Sampling temperature (0-1)

**Features:**
- Multiple audio format support (WAV, MP3, M4A, etc.)
- Language detection and specification
- Context prompts for improved accuracy
- Detailed metadata and timing information
- Robust error handling and validation

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