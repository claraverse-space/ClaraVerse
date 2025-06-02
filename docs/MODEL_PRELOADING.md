# Model Preloading Feature

## Overview

The Model Preloading feature is designed to reduce waiting time for users, especially when using local AI models (like those served by Ollama). When users start typing, Clara automatically triggers a small "warmup" request to load the model into memory, so when they actually send their message, the model is already ready to respond.

## How It Works

### 1. Typing Detection
- When the user starts typing in the input field, Clara detects this with a debounced approach (500ms delay)
- This prevents spamming preload requests while the user is actively typing

### 2. Local Provider Detection
The preloading only occurs for local providers to avoid unnecessary cloud API calls:
- Ollama providers (`type: 'ollama'`)
- Providers with localhost URLs (`localhost`, `127.0.0.1`)

Cloud providers (OpenAI, OpenRouter, etc.) are excluded since they don't need warmup time.

### 3. Minimal Warmup Request
When triggered, Clara sends a minimal request to the model:
```typescript
const warmupMessages = [
  { role: 'system', content: 'You are Clara, a helpful AI assistant.' },
  { role: 'user', content: 'Hi' }
];

const warmupOptions = {
  temperature: 0.1,
  max_tokens: 1, // Only 1 token to minimize processing
  stream: false
};
```

### 4. Fire-and-Forget
The warmup request is sent asynchronously and errors are silently handled. The goal is just to trigger model loading, not to get a meaningful response.

## User Experience

### Silent Operation (Updated)
- **Completely Silent**: Preloading now operates entirely in the background with no visual indicators
- **No UI Glitches**: Eliminates the brief "flash" of loading indicators during preloading
- **Progress UI Only on Send**: Visual feedback appears only when the user actually sends a message (when `isLoading=true`)
- **Silent Input Focus**: Clicking on input bar or typing triggers silent preloading without any UI feedback

### Performance Benefits
- **Before**: User sends message → Model loads (3-10 seconds) → Response generated
- **After**: User types → Model loads silently in background → User sends message → Response generated immediately

## Implementation Details

### Core Components

1. **API Service** (`claraApiService.preloadModel()`)
   - Detects local vs cloud providers
   - Sends minimal warmup request
   - Handles errors gracefully

2. **Input Component** (`ClaraAssistantInput`)
   - Debounced typing detection
   - Silent background preloading (no UI feedback)
   - State management for preload status

3. **Main Component** (`ClaraAssistant`)
   - Provides preload callback to input component
   - Integrates with existing session config

### Key Features

- **Debouncing**: 500ms delay prevents excessive preload calls
- **One-time preload**: Only preloads once per typing session
- **Automatic reset**: Preload state resets when input is cleared or message is sent
- **Error resilience**: Failed preloads don't affect normal functionality
- **Silent Operation**: No visual feedback during preloading to avoid UI glitches
- **Loading State Enforcement**: Progress UI only shows when `isLoading=true` (actual message sending)
- **Console Logging**: Debug information available in browser console for monitoring

## Testing

### Manual Testing
1. Ensure you have a local Ollama server running
2. Select an Ollama model in Clara
3. Start typing in the input field (preloading happens silently in background)
4. Send your message and notice significantly faster response time
5. Console logs will show preloading activity for debugging purposes

### Debug Functions
Available in browser console:
```javascript
// Test manual preloading
testModelPreloading()

// Debug preload configuration
debugModelPreload()
```

## Configuration

No additional configuration is required. The feature:
- Automatically detects appropriate providers
- Works with existing session configurations
- Respects current model selections

## Benefits

1. **Reduced Perceived Latency**: Especially beneficial for large local models
2. **Seamless UX**: Works transparently without user intervention
3. **Resource Efficient**: Only loads models when users intend to use them
4. **Provider Aware**: Smart detection prevents unnecessary cloud API calls

## Technical Notes

- Uses the same model selection logic as regular chat requests
- Maintains compatibility with all existing Clara features
- Adds minimal overhead and complexity
- Gracefully degrades if preloading fails 