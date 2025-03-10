# Clara - AI Assistant 🤖

[![Netlify Status](https://api.netlify.com/api/v1/badges/f0c8f7-lustrous-stroopwafel/deploy-status)](https://lustrous-stroopwafel-f0c8f7.netlify.app)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5.3-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.3.1-blue.svg)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-5.4.2-646CFF.svg)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4.1-38B2AC.svg)](https://tailwindcss.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Clara is a modern, feature-rich AI assistant web application that provides a seamless interface for interacting with various AI models through Ollama. Built with React, TypeScript, and Tailwind CSS, it offers a beautiful and intuitive chat experience with support for both text and image inputs.

![Clara AI Assistant](https://source.unsplash.com/random/1200x630/?ai,technology)

## ✨ Features

### Core Features
- 💬 Real-time chat interface with streaming responses
- 🖼️ Image processing capabilities with compatible models
- 📝 Markdown support with syntax highlighting
- 🌓 Light/Dark mode with system preference sync
- 📊 Usage statistics and analytics
- 🔍 Advanced model selection and configuration
- 💾 Persistent storage with chat history
- 🎯 Context-aware conversations

### Chat Management
- 🔖 Star important conversations
- 📁 Archive old chats
- 🗑️ Soft delete with recovery option
- 📎 File attachment support (coming soon)
- 🎤 Voice input support (coming soon)

### Developer Features
- 🛠️ Debug console for API testing
- 📋 Code block copying
- 🔧 Comprehensive model configuration
- 📈 Response time monitoring
- 🔍 Detailed error reporting

## 🚀 Getting Started

### Prerequisites

1. **Node.js**: Version 20 or higher
2. **Ollama**: Local installation required
   ```bash
   # macOS/Linux
   curl https://ollama.ai/install.sh | sh
   
   # Windows
   # Download from https://ollama.ai/download
   ```

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/clara-ai.git
   cd clara-ai
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

### Ollama Setup

1. Start Ollama server:
   ```bash
   ollama serve
   ```

2. Pull required models:
   ```bash
   # For text-only support
   ollama pull mistral
   
   # For image support
   ollama pull llava
   ```

3. Configure CORS for web access:

   Create or modify the Ollama service configuration:
   ```bash
   sudo systemctl edit ollama.service
   ```

   Add the following:
   ```ini
   [Service]
   Environment="OLLAMA_ORIGINS=*"
   ```

   Restart Ollama:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl restart ollama
   ```

### Using ngrok for Remote Access

If you're running Ollama on a different machine or need remote access, you can use ngrok to create a secure tunnel:

1. Install ngrok:
   ```bash
   # Using npm
   npm install -g ngrok
   
   # Or download from https://ngrok.com/download
   ```

2. Start ngrok tunnel:
   ```bash
   ngrok http 11434
   ```

3. Use the provided ngrok URL in Clara's settings:
   ```
   https://your-ngrok-url.ngrok.io
   ```

> ⚠️ **Important**: The ngrok URL changes each time you restart ngrok unless you have a paid account. For persistent access, consider:
> - Using a static domain with proper CORS configuration
> - Setting up a reverse proxy with nginx
> - Using ngrok with a paid account for static URLs

## 🏗️ Project Structure

```
clara/
├── src/
│   ├── components/           # React components
│   │   ├── assistant_components/  # Chat-specific components
│   │   └── ...
│   ├── hooks/               # Custom React hooks
│   ├── utils/               # Utility functions
│   ├── db/                  # Database layer
│   └── App.tsx             # Main application
├── public/                  # Static assets
└── package.json            # Project configuration
```

## 🔄 Development Workflow

1. Make changes to the code
2. Test using the Debug console
3. Build the project:
   ```bash
   npm run build
   ```
4. Preview the production build:
   ```bash
   npm run preview
   ```

## 🚢 Deployment

The project is configured for deployment on Netlify with automatic builds and deployments.

### Manual Deployment

1. Build the project:
   ```bash
   npm run build
   ```

2. Deploy the `dist` folder to any static hosting service

### Environment Variables

No environment variables are required for the frontend as all configuration is handled through the UI.

## 🛣️ Roadmap

### Coming Soon
- 📱 Mobile-responsive design
- 🎤 Voice input/output
- 📎 File attachment support
- 🔐 Authentication system
- 🔄 Conversation branching
- 📊 Advanced analytics

### Future Updates
- 🌐 Multi-model conversations
- 🤝 Collaborative features
- 🔌 Plugin system
- 🗣️ Multi-language support
- 📱 Progressive Web App (PWA)

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Ollama](https://ollama.ai/) for the amazing AI model serving platform