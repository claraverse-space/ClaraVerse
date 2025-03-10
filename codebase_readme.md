# Clara AI Assistant - Code Documentation

## Project Overview

Clara is a modern AI assistant web application built with React, TypeScript, and Tailwind CSS. It provides a chat interface for interacting with various AI models through the Ollama API, with support for both text and image inputs.

## Core Components

### 1. Main Application Structure

- `src/App.tsx`: Main application component that handles routing between different views (Dashboard, Assistant, Settings, Debug)
- `src/main.tsx`: Application entry point
- `src/index.css`: Global styles and Tailwind CSS configuration

### 2. Database Layer (`src/db/index.ts`)

Local storage-based database implementation with the following key features:

- Chat management (create, read, update)
- Message storage
- Usage statistics
- Settings storage
- Model usage tracking

Key interfaces:
```typescript
interface Chat {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  is_archived: boolean;
  is_starred: boolean;
  is_deleted: boolean;
}

interface Message {
  id: string;
  chat_id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: string;
  tokens: number;
  images?: string[];
}
```

### 3. Assistant Component (`src/components/Assistant.tsx`)

The main chat interface component that handles:

- Chat session management
- Message streaming
- Image handling
- Model selection
- Context management

Key features:
- Maximum context window of 20 messages
- Support for image uploads (max 10MB per image)
- Streaming and non-streaming response modes
- Automatic model selection for image processing

### 4. Chat Components

#### AssistantHeader (`src/components/assistant_components/AssistantHeader.tsx`)
- Model selection dropdown
- Connection status indicator
- Theme toggle
- Navigation controls

#### ChatInput (`src/components/assistant_components/ChatInput.tsx`)
- Text input with auto-resize
- Image upload support
- Voice input placeholder
- File attachment placeholder
- Send button with loading state

#### ChatWindow (`src/components/assistant_components/ChatWindow.tsx`)
- Message display
- Auto-scroll functionality
- Empty state handling
- Scroll-to-bottom button

#### ChatMessage (`src/components/assistant_components/ChatMessage.tsx`)
- Message rendering with Markdown support
- Code block handling with syntax highlighting
- Image gallery for uploaded images
- Thinking process expansion
- Message copying
- Token count display

### 5. Settings Management

#### AssistantSettings (`src/components/assistant_components/AssistantSettings.tsx`)
- Streaming toggle
- Model image support configuration
- Model search functionality

#### ImageWarning (`src/components/assistant_components/ImageWarning.tsx`)
- Warning display for image processing capabilities

#### ModelWarning (`src/components/assistant_components/ModelWarning.tsx`)
- Model compatibility warning for image processing

### 6. Utility Components

#### Debug Console (`src/components/Debug.tsx`)
- API testing interface
- Model testing
- Response streaming testing
- Troubleshooting guides

#### Dashboard (`src/components/Dashboard.tsx`)
- Usage statistics display
- API configuration status
- Recent activity tracking

### 7. Ollama Integration (`src/utils/OllamaClient.ts`)

API client for Ollama with support for:
- Chat completions
- Image processing
- Model management
- Response streaming

## Chat Flow

1. **Message Sending**:
   ```typescript
   const handleSend = async () => {
     // Create chat if none exists
     const chatId = activeChat || await db.createChat(input.slice(0, 30));
     
     // Create user message
     const userMessage = {
       id: crypto.randomUUID(),
       chat_id: chatId,
       content: input,
       role: 'user',
       timestamp: new Date().toISOString(),
       tokens: 0,
       images: images.map(img => img.preview)
     };

     // Get context messages
     const contextMessages = getContextMessages([...messages, userMessage]);
     
     // Generate response
     if (images.length > 0) {
       // Handle image generation
       const response = await client.generateWithImages(
         selectedModel,
         input,
         images.map(img => img.base64)
       );
     } else if (isStreaming) {
       // Handle streaming response
       for await (const chunk of client.streamChat(selectedModel, formattedMessages)) {
         // Update UI with chunks
       }
     } else {
       // Handle regular response
       const response = await client.sendChat(selectedModel, formattedMessages);
     }

     // Save messages to database
     await db.addMessage(chatId, userMessage.content, userMessage.role, tokens, images);
     await db.addMessage(chatId, response, 'assistant', tokens);
   };
   ```

2. **Response Processing**:
   - Streaming responses are displayed chunk by chunk
   - Non-streaming responses are displayed all at once
   - Images are processed using image-capable models (llava, bakllava)
   - Thinking process is separated using `<think>` tags

3. **Context Management**:
   - Maximum of 20 messages kept in context
   - Messages are formatted for model consumption
   - Images are converted to base64 for API requests

## Database Operations

1. **Chat Management**:
   ```typescript
   // Create chat
   const chatId = await db.createChat(title);
   
   // Update chat
   await db.updateChat(chatId, { title: 'New Title' });
   
   // Get recent chats
   const chats = await db.getRecentChats();
   ```

2. **Message Management**:
   ```typescript
   // Add message
   await db.addMessage(chatId, content, role, tokens, images);
   
   // Get chat messages
   const messages = await db.getChatMessages(chatId);
   ```

3. **Usage Tracking**:
   ```typescript
   // Update model usage
   await db.updateModelUsage(model, duration);
   
   // Get usage statistics
   const tokensUsed = await db.getTokensUsed();
   const avgResponseTime = await db.getAverageResponseTime();
   ```

## Hooks

### useDatabase (`src/hooks/useDatabase.ts`)
- Manages database statistics
- Formats numbers and bytes
- Provides real-time updates

### useTheme (`src/hooks/useTheme.tsx`)
- Manages theme state (light/dark)
- Syncs with localStorage
- Handles system preference

## Styling

The application uses Tailwind CSS with a custom color scheme:
```css
:root {
  --sakura-50: #fef6f9;
  --sakura-100: #fee3ec;
  --sakura-200: #ffc6da;
  --sakura-300: #ff9dc1;
  --sakura-400: #ff669d;
  --sakura-500: #ff1a75;
}
```

Common utility classes:
- `glassmorphic`: Glass-like effect with backdrop blur
- `scrollbar-thin`: Custom scrollbar styling
- `animate-fadeIn`: Smooth fade-in animation

## Best Practices

1. **Error Handling**:
   - All API calls are wrapped in try-catch blocks
   - User-friendly error messages
   - Fallback UI states

2. **Performance**:
   - Message streaming for faster responses
   - Efficient context management
   - Optimized image handling

3. **Security**:
   - Input sanitization
   - Image size limits
   - Secure API communication

4. **Accessibility**:
   - ARIA labels
   - Keyboard navigation
   - Color contrast compliance

## Configuration

Key configuration options:
- `MAX_CONTEXT_MESSAGES`: 20 messages
- `MAX_IMAGE_SIZE`: 10MB
- Model image support configuration in localStorage