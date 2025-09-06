# Changelog

## [2.1.0] - 2025-01-09

### 🚀 Major Features Added

#### 🔹 Advanced Node Types
- **Agent Executor Node**: Autonomous AI agent with MCP tool access and multi-step execution capabilities
- **Notebook Writer Node**: Create and manage notebook documents with structured content
- **Whisper Transcription Node**: Audio-to-text transcription using OpenAI Whisper models
- **Image Input Node**: Process and analyze image inputs with vision models
- **PDF Input Node**: Extract and process content from PDF documents
- **File Upload Node**: Handle file uploads and processing workflows

#### 🔹 Enhanced TypeScript Integration
- **Full TypeScript Support**: Complete TypeScript definitions and interfaces
- **Type-Safe Execution**: Enhanced type safety for flow execution and node management
- **Modern API Design**: Updated ClaraFlowRunner with TypeScript-first approach

#### 🔹 Advanced AI Capabilities
- **Multi-Model Support**: Support for text, vision, and code models in agent execution
- **MCP Protocol Integration**: Model Context Protocol server integration for tool access
- **Self-Correction**: AI agents with self-correction and chain-of-thought reasoning
- **Tool Guidance**: Intelligent tool selection and execution guidance

#### 🔹 Enterprise Features
- **Confidence Thresholds**: Configurable confidence levels for AI decision making
- **Advanced Retry Logic**: Sophisticated retry mechanisms with exponential backoff
- **Tool Call Limits**: Configurable limits for tool execution to prevent runaway processes
- **Comprehensive Logging**: Enhanced logging with structured execution tracking

### ✨ Technical Improvements

**Node Execution Engine:**
- Redesigned node executor with modular architecture
- Enhanced error handling and recovery mechanisms
- Support for asynchronous and synchronous node execution
- Improved input/output mapping and validation

**Flow Management:**
- Better flow validation and dependency resolution
- Enhanced custom node registration and management
- Improved execution order optimization
- Advanced debugging and monitoring capabilities

**API Enhancements:**
- Streamlined API surface with better developer experience
- Enhanced configuration options and defaults
- Improved error messages and debugging information
- Better integration with Clara ecosystem

### 🌐 Compatibility

**Maintains Full Backward Compatibility:**
- All v2.0.0 workflows continue to work unchanged
- Existing API methods preserved and enhanced
- Custom nodes from v2.0.0 fully supported
- No breaking changes to core functionality

**New Capabilities:**
- Enhanced node types for complex workflows
- Advanced AI agent capabilities
- Better integration with Clara ecosystem
- Improved TypeScript development experience

### 📦 Distribution Updates

**Enhanced Build System:**
- Updated build process for new node types
- Improved TypeScript compilation
- Better tree-shaking for smaller bundles
- Enhanced browser compatibility

**Bundle Sizes:**
- Node.js: 22KB (uncompressed) - includes new node types
- Browser: 25KB (uncompressed), 12KB (minified)
- Zero additional dependencies for core functionality

### 🎯 What's New for Developers

**Agent Workflows:**
```javascript
// New agent executor node for autonomous AI workflows
const workflow = {
  nodes: [{
    type: 'agent-executor',
    data: {
      provider: 'openai',
      textModel: 'gpt-4',
      instructions: 'Analyze the data and create a report',
      enabledMCPServers: ['filesystem', 'browser'],
      maxToolCalls: 10
    }
  }]
};
```

**TypeScript Development:**
```typescript
import { ClaraFlowRunner, FlowData } from 'clara-flow-sdk';

const runner = new ClaraFlowRunner();
const result = await runner.executeFlow(flowData, inputs);
```

**Advanced Node Types:**
```javascript
// Whisper transcription
{ type: 'whisper-transcription', data: { model: 'whisper-1' } }

// PDF processing
{ type: 'pdf-input', data: { extractImages: true, pageRange: '1-5' } }

// Notebook creation
{ type: 'notebook-writer', data: { format: 'jupyter', title: 'Analysis Report' } }
```

---

## [2.0.0] - 2024-01-26

### 🚀 Complete Rewrite

**Major Breaking Changes:**
- Complete rewrite from the ground up
- New simplified API with zero configuration
- Modern ES modules and build system
- Universal compatibility (Node.js, Browser, CDN)

### ✨ New Features

**Zero Configuration SDK:**
- Works out of the box with no setup required
- Automatic workflow validation and execution order detection
- Built-in error handling and logging

**Developer-Friendly API:**
```javascript
// Old API (complex)
const runner = new ClaraFlowRunner(complexConfig);
await runner.executeFlow(flowData, inputs);

// New API (simple)
const runner = new ClaraFlowRunner();
await runner.execute(workflow, inputs);
```

**Universal Compatibility:**
- Node.js ES modules and CommonJS
- Browser UMD bundles (minified and unminified)
- CDN-ready with global exports
- TypeScript definitions included

**Built-in Node Types:**
- `input` - User input handling
- `output` - Result display
- `static-text` - Fixed text content
- `combine-text` - Text concatenation
- `json-parse` - JSON parsing with dot notation
- `if-else` - Conditional logic with JavaScript expressions
- `llm` - AI language model integration
- `structured-llm` - Structured JSON output
- `api-request` - HTTP requests

**Custom Node System:**
- Easy custom node registration
- Sandboxed execution environment
- Full TypeScript support
- Runtime validation

**Clara Studio Integration:**
- Direct import of Clara Studio exports
- Support for `clara-sdk` and `clara-native` formats
- Custom node preservation
- Metadata handling

### 🔧 Technical Improvements

**Build System:**
- Replaced Rollup with esbuild for faster builds
- Reduced bundle size by 60%
- Eliminated complex dependency chain
- Cross-platform compatibility (Windows, macOS, Linux)

**Performance:**
- 10x faster execution for simple workflows
- Optimized topological sorting algorithm
- Minimal memory footprint
- Concurrent execution support

**Error Handling:**
- Comprehensive error messages
- Execution logging with different levels
- Node-level error isolation
- Graceful failure handling

**Testing:**
- Complete test suite with 6 test scenarios
- Integration tests for all node types
- Custom node testing
- Export format compatibility tests

### 📦 Distribution

**Package Formats:**
- `dist/index.js` - ES modules (Node.js)
- `dist/index.cjs` - CommonJS (Node.js)
- `dist/clara-flow-sdk.umd.js` - Browser UMD
- `dist/clara-flow-sdk.umd.min.js` - Minified browser

**Bundle Sizes:**
- Node.js: 16KB (uncompressed)
- Browser: 18KB (uncompressed), 9KB (minified)
- Zero dependencies in production

### 🌐 Browser Features

**Browser Utilities:**
- `BrowserUtils.downloadFlow()` - Download workflows as files
- `BrowserUtils.loadFlowFromFile()` - Load workflows from file input
- `BrowserUtils.getBrowserInfo()` - Browser environment detection
- `BrowserUtils.isBrowser()` - Runtime environment check

**CDN Usage:**
```html
<script src="https://unpkg.com/clara-flow-sdk@2.0.0/dist/clara-flow-sdk.umd.min.js"></script>
<script>
  const runner = new ClaraFlowSDK.ClaraFlowRunner();
  // Use immediately
</script>
```

### 📚 Documentation

**Complete Documentation:**
- Comprehensive README with examples
- Quick-start guide (5 lines of code)
- API reference with TypeScript definitions
- Server deployment template
- Browser integration examples

**Examples:**
- Basic text processing
- JSON data manipulation
- Custom node creation
- AI/LLM integration
- Batch processing
- Error handling

### 🚀 Deployment Ready

**Server Template:**
- Express.js server template included
- REST API endpoints for workflow execution
- Health monitoring and logging
- Batch processing support
- Production-ready error handling

**API Endpoints:**
- `POST /execute` - Execute workflows
- `POST /execute/batch` - Batch processing
- `POST /validate` - Workflow validation
- `GET /health` - Health checks
- `GET /logs` - Execution logs

### 🔄 Migration Guide

**From v1.x to v2.0:**

```javascript
// v1.x (deprecated)
import { ClaraFlowRunner } from 'clara-flow-sdk';
const runner = new ClaraFlowRunner({
  enableLogging: true,
  timeout: 30000,
  sandbox: true
});
await runner.executeFlow(flowData, inputs);

// v2.0 (current)
import { ClaraFlowRunner } from 'clara-flow-sdk';
const runner = new ClaraFlowRunner(); // Zero config!
await runner.execute(workflow, inputs); // Simplified API
```

**Breaking Changes:**
- `executeFlow()` renamed to `execute()`
- Simplified configuration options
- Removed complex validation requirements
- Changed log format and access methods

### 🎯 What's Next

**Planned for v2.1:**
- More built-in node types
- Advanced debugging tools
- Workflow templates
- Performance monitoring
- Cloud deployment integration

---

## [1.5.0] - 2024-01-15

### Legacy Version
- Original implementation with complex architecture
- Multiple dependencies and build issues
- Limited browser support
- Complex configuration requirements

**Note:** v1.x is deprecated. Please upgrade to v2.0 for the best experience. 