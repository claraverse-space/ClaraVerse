# Clara Assistant Chat System Architecture
## Overview

Clara Assistant implements a sophisticated chat system that handles various types of interactions including text, images, tools, and RAG (Retrieval-Augmented Generation). This document outlines the system's architecture and message flow.

## System Architecture

### Core Components

```
[USER INTERFACE]
├── ChatInput
├── ChatWindow
├── MessageDisplay
└── ControlComponents
    ├── ModelSelector
    ├── ToolSelector
    └── ImageUploader
```

### Message Processing Pipeline

```
                                CHAT FLOW DIAGRAM
                                ================

[USER INPUT] ──────────────────────────────────┐
     │                                         │
     ▼                                         │
[CONTEXT CHECK]                                │
     │                                         │
     ├── Has Images? ───────┐                  │
     │                      │                  │
     ├── Has Tools? ────────┤                  │
     │                      │                  │
     └── Has RAG? ──────────┘                  │
            │                                  │
            ▼                                  │
   [MODEL SELECTION]                           │
     │    │    │                              │
     │    │    └── [MANUAL MODE]              │
     │    │         Uses selected model        │
     │    │                                   │
     │    └── [SMART MODE]                    │
     │         Based on usage patterns        │
     │                                        │
     └── [AUTO MODE]                          │
          │                                   │
          ├── Images → Vision Model           │
          ├── Tools → Tool Model              │
          └── RAG/Default → RAG Model         │
                    │                         │
                    ▼                         │
         [MESSAGE PROCESSING]                 │
                    │                         │
                    ├── Format Messages       │
                    │                         │
                    ├── Add System Prompt     │
                    │                         │
                    ├── Add RAG Context       │
                    │   (if enabled)          │
                    │                         │
                    ▼                         │
         [MODEL INTERACTION]                  │
                    │                         │
                    ├── Stream Mode           │
                    │   (if enabled)          │
                    │                         │
                    ├── Tool Execution        │
                    │   (if tool selected)    │
                    │                         │
                    ├── Image Processing      │
                    │   (if images present)   │
                    │                         │
                    ▼                         │
         [RESPONSE HANDLING]                  │
                    │                         │
                    ├── Update UI ────────────┘
                    │
                    └── Save to Database
```

## Key Features

### 1. Model Selection Modes

- **Manual Mode**: User explicitly selects the model
- **Auto Mode**: System selects appropriate model based on content type
  - Vision Model for image processing
  - Tool Model for tool execution
  - RAG Model for context-aware responses
- **Smart Mode**: Selects model based on usage patterns and performance

### 2. Context Management

The system manages several types of context:
- Chat history (limited to MAX_CONTEXT_MESSAGES)
- System prompts
- RAG context from document search
- Tool context
- Image context

### 3. Message Processing

Messages go through several processing stages:
1. **Input Processing**
   - Text normalization
   - Image processing
   - Tool parameter validation

2. **Context Building**
   - Historical message selection
   - RAG context injection
   - System prompt inclusion

3. **Model Selection**
   - Mode-based selection
   - Capability checking
   - Fallback handling

4. **Message Generation**
   - Streaming support
   - Progress updates
   - Error handling

5. **Response Handling**
   - UI updates
   - Database persistence
   - State management

## Implementation Details

### Message Structure

```typescript
interface Message {
  id: string;
  chat_id: string;
  content: string;
  role: ChatRole;
  timestamp: number;
  tokens: number;
  images?: string[];
}
```

### Context Types

```typescript
interface NodeExecutionContext {
  node: Node;
  inputs: { [key: string]: any };
  ollamaClient: OllamaClient;
  apiConfig: {
    type: 'ollama' | 'openai';
    baseUrl: string;
    apiKey?: string;
  };
  updateNodeOutput?: (nodeId: string, output: any) => void;
}
```

### Model Selection Configuration

```typescript
interface ModelSelectionConfig {
  mode: 'auto' | 'manual' | 'smart';
  visionModel: string;
  toolModel: string;
  ragModel: string;
}
```

## Best Practices

1. **Error Handling**
   - Implement graceful fallbacks
   - Provide clear error messages
   - Maintain system stability

2. **Performance**
   - Optimize context window usage
   - Implement efficient streaming
   - Manage memory usage

3. **User Experience**
   - Provide clear feedback
   - Maintain responsive UI
   - Handle edge cases gracefully

## Future Improvements

1. **Smart Mode Enhancement**
   - Implement learning from usage patterns
   - Add performance metrics
   - Optimize model selection

2. **Context Management**
   - Implement better context pruning
   - Add context relevance scoring
   - Optimize RAG integration

3. **Tool Integration**
   - Improve tool parameter handling
   - Add tool chain support
   - Enhance error recovery

4. **Performance Optimization**
   - Implement better caching
   - Optimize database operations
   - Enhance streaming efficiency 