# Clara Assistant - Agentic AI Chat System

Clara Assistant is a modern, agentic AI chat application built with React and TypeScript. It provides a superior alternative to OpenWebUI with advanced multi-modal capabilities, automated tool selection, and comprehensive file processing.

## 🌟 Key Features

### Core Capabilities
- **Multi-modal AI Processing**: Automatic detection and routing of text, images, PDFs, and code files
- **Agentic Tool Calling**: Always-enabled tool system with automatic selection (no manual tool picking)
- **Knowledge Base/RAG**: File storage and retrieval with vector embeddings
- **Provider Flexibility**: Support for Ollama, OpenAI, OpenRouter, and custom providers
- **Real-time Streaming**: Live response generation with typing indicators
- **Auto Model Selection**: Intelligent model routing based on task type

### Advanced Features
- **Artifact System**: Interactive rendering of code, charts, tables, and visualizations
- **File Upload & Processing**: Drag & drop support for images, PDFs, documents, and code
- **Session Management**: Persistent chat history with search and organization
- **Advanced Configuration**: Per-session model settings, temperature control, and feature toggles
- **Modern UI**: Glassmorphic design with dark/light theme support

## 🏗️ Architecture

### Frontend Components

```
src/components/Clara_Components/
├── clara_assistant_input.tsx          # Input with file upload and model selection
├── clara_assistant_chat_window.tsx    # Chat interface with message bubbles
├── clara_assistant_message_bubble.tsx # Individual message rendering
├── clara_assistant_artifact_renderer.tsx # Code/chart/table rendering
└── ClaraSidebar.tsx                   # Chat history sidebar
```

### Core Services

```
src/services/
└── claraApiService.ts                 # API communication with backend
```

### Type System

```
src/types/
└── clara_assistant_types.ts          # Complete TypeScript definitions
```

### Tools System

```
src/utils/
└── claraTools.ts                     # Default tools (math, time, file, system)
```

## 🚀 Setup Instructions

### Prerequisites

- Node.js 18+ with TypeScript
- Python 3.8+ (for backend)
- Ollama installed (for local models)

### Frontend Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Start the frontend**:
   ```bash
   npm start
   ```

### Backend Setup

1. **Navigate to backend directory**:
   ```bash
   cd py_backend
   ```

2. **Install Python dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

3. **Start the backend**:
   ```bash
   python main.py
   ```

   The backend will start on `http://localhost:5000`

### Ollama Setup (Optional)

1. **Install Ollama**:
   ```bash
   # macOS
   brew install ollama
   
   # Linux
   curl https://ollama.ai/install.sh | sh
   ```

2. **Pull models**:
   ```bash
   ollama pull llama2
   ollama pull llava      # For vision tasks
   ollama pull codellama  # For code tasks
   ```

3. **Start Ollama server**:
   ```bash
   ollama serve
   ```

## 🎯 Usage Guide

### Basic Chat
1. Open Clara Assistant
2. Type your message in the input field
3. Hit Enter or click Send
4. Clara will automatically select the best model and tools for your request

### File Upload
1. **Drag & Drop**: Simply drag files into the chat input
2. **Click Upload**: Use the image or document upload buttons
3. **Supported Types**: Images (jpg, png, gif), PDFs, text files, code files

### Advanced Configuration
1. Click the **Settings** icon in the input area
2. Configure:
   - **AI Provider**: Switch between Ollama, OpenAI, etc.
   - **Models**: Select specific models for text, vision, and code
   - **Parameters**: Adjust temperature, max tokens
   - **Features**: Toggle tools, RAG, streaming, auto-selection

### Provider Management
1. Providers are auto-detected from your database
2. Switch providers in the advanced settings
3. Models are automatically loaded for each provider

## 🛠️ Tool System

Clara includes a built-in tool system with default tools:

### Available Tools

#### Math Tools
- `calculate`: Perform mathematical calculations
- `convert_units`: Convert between units (length, weight, temperature)

#### Time Tools  
- `get_current_time`: Get current date/time with timezone support

#### File Tools
- `create_file`: Create files with specified content

#### System Tools
- `get_system_info`: Get browser and system information

### Adding Custom Tools

Tools are defined in `src/utils/claraTools.ts`:

```typescript
const customTool: ClaraTool = {
  id: 'my_tool',
  name: 'My Custom Tool',
  description: 'Description of what the tool does',
  category: 'custom',
  parameters: {
    type: 'object',
    properties: {
      input: {
        type: 'string',
        description: 'Input parameter'
      }
    },
    required: ['input']
  },
  implementation: async (params) => {
    // Tool logic here
    return { result: params.input.toUpperCase() };
  },
  isEnabled: true,
  version: '1.0.0',
  author: 'Your Name'
};
```

## 🔧 Configuration

### Environment Variables

Create a `.env` file in the project root:

```env
# Backend Configuration
CLARA_BACKEND_URL=http://localhost:5000

# Default Provider Settings
DEFAULT_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434

# OpenAI Configuration (if using)
OPENAI_API_KEY=your_openai_key

# OpenRouter Configuration (if using)
OPENROUTER_API_KEY=your_openrouter_key
```

### Backend Configuration

The Python backend (`py_backend/main.py`) handles:
- Chat completions with various providers
- File upload and processing
- RAG/vector database operations
- Tool execution

### Database

Clara uses a local SQLite database for:
- Provider configurations
- Chat history
- User preferences
- File metadata

## 🎨 UI/UX Features

### Modern Design
- **Glassmorphic**: Semi-transparent elements with backdrop blur
- **Responsive**: Works on desktop, tablet, and mobile
- **Dark/Light**: Automatic theme detection
- **Smooth Animations**: Fluid transitions and hover effects

### Message System
- **Bubble UI**: Clean message bubbles with user/assistant differentiation
- **Streaming**: Real-time response generation
- **Artifacts**: Interactive code, charts, and tables
- **Actions**: Copy, edit, retry message options

### Input System
- **Auto-resize**: Text area grows with content
- **File Preview**: Shows uploaded files with type detection
- **Model Selection**: Visual provider/model picker
- **Advanced Panel**: Collapsible configuration options

## 🔄 Comparison with OpenWebUI

| Feature | Clara Assistant | OpenWebUI |
|---------|-----------------|-----------|
| **Artifact Rendering** | ✅ Advanced (code, charts, tables, HTML) | ❌ Basic |
| **Auto Model Selection** | ✅ Intelligent routing | ❌ Manual selection |
| **Tool System** | ✅ Always-on, automatic | ❌ Manual selection |
| **File Processing** | ✅ Multi-format with preview | ✅ Basic |
| **Provider Management** | ✅ Advanced with auto-detection | ✅ Basic |
| **UI/UX** | ✅ Modern glassmorphic design | ❌ Traditional |
| **TypeScript** | ✅ Complete type safety | ❌ Limited |
| **Architecture** | ✅ Modular, isolated components | ❌ Monolithic |

## 🚀 Future Roadmap

### Phase 1: Enhanced Tools
- [ ] Web search and browsing tools
- [ ] Email and calendar integration
- [ ] Advanced file manipulation tools
- [ ] Custom tool marketplace

### Phase 2: Codebase Integration
- [ ] Git repository analysis
- [ ] Code refactoring suggestions
- [ ] Automated testing generation
- [ ] Documentation generation

### Phase 3: Advanced Features
- [ ] Voice input/output
- [ ] Real-time collaboration
- [ ] Plugin ecosystem
- [ ] API for third-party integrations

### Phase 4: Enterprise Features
- [ ] Team workspaces
- [ ] Advanced security controls
- [ ] Audit logging
- [ ] Custom model training

## 🤝 Contributing

Clara Assistant is built with modularity in mind. To contribute:

1. **Fork the repository**
2. **Create feature branch**: `git checkout -b feature/amazing-feature`
3. **Follow conventions**: Use the existing TypeScript interfaces
4. **Add tests**: Include unit tests for new components
5. **Submit PR**: Include detailed description of changes

### Development Guidelines

- All components must use the Clara type system
- Follow the isolated component architecture
- Include JSDoc comments for all functions
- Use semantic versioning for releases
- Test with multiple providers and models

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- **OpenWebUI**: Inspiration for the chat interface concept
- **Ollama**: Local model serving capabilities
- **React**: Frontend framework
- **TypeScript**: Type safety and developer experience
- **Lucide**: Icon system

---

**Clara Assistant** - Bringing agentic AI to everyone with a superior chat experience. 