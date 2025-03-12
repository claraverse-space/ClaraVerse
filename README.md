# Clara
## Privacy-First AI Assistant & App Builder that has no Docker or Backend requirement.

<div align="center">

<!-- link to clara access and we promise no data is sent anywhere other than your pc  https://clara-ollama.netlify.app/ just the link to the app-->

### 🚀 Live Demo, 
Link to the Clara App: [Clara](https://clara-ollama.netlify.app/)

[![Clara](https://img.shields.io/badge/Clara-0.1.0-FFD700.svg)](https://clara-ollama.netlify.app/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5.3-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.3.1-blue.svg)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-5.4.2-646CFF.svg)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4.1-38B2AC.svg)](https://tailwindcss.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Your local AI assistant that respects your privacy**

</div>

## 🔒 Privacy First, No Exceptions

Clara is a completely client-side AI assistant that works with Ollama running on your machine or network. Unlike cloud-based solutions:

- **No data leaves your device** without your explicit permission
- **Zero tracking or telemetry**
- **All data stored locally** in your browser's IndexedDB
- **Direct connection** to your Ollama instance

## ✨ Features

### Chat Interface
- 💬 Real-time chat with streaming responses
- 🤖 Support for all Ollama models (Llama, Mistral, Phi, etc.)
- 🖼️ Image understanding with multimodal models
- 💾 Persistent conversation history stored locally
- 📝 Rich markdown support with code highlighting

### App Builder
- 🧩 Visual node-based flow builder
- 📊 Text input/output nodes
- 🖼️ Image input nodes
- 🤖 LLM integration nodes
- ⚡ Conditional logic nodes
- 🌐 API call nodes
- ✍️ Text combiner nodes
- 🔄 Reusable app templates
- 💻 Run apps with user inputs

### System
- 🌓 Beautiful light/dark mode
- 🔍 Model management and selection
- 📱 Responsive design
- 🛠️ Custom API configurations

## 🔮 Coming Soon
- 🎨 Image generation with Stable Diffusion
- 🔊 Voice input and output
- 👥 Character personalities for chat
- 📚 Knowledge base integration 
- 📊 Data visualization nodes
- 📄 PDF document processing
- 🔌 Plugin system for extensibility
- 📱 PWA for mobile installation
- 🚀 Local RAG with vector databases

## 🚀 Getting Started

### Prerequisites
- **Node.js** (v18+ recommended)
- **Ollama** installed locally ([install instructions below](#installing-ollama))

### Installation
```bash
# Clone the repository
git clone https://github.com/yourusername/clara-ai.git
cd clara-ai

# Install dependencies
npm install

# Start development server
npm run dev
```

## 🐳 Installing Ollama

### Windows
1. Download the installer from the [official site](https://ollama.ai/download/windows)
2. Run the installer and follow the prompts
3. After installation, Ollama will be available at `http://localhost:11434`
4. Enable CORS by creating a file named `config.json` in `%USERPROFILE%\.ollama` with:
   ```json
   {
     "origins": ["*"]
   }
   ```

### macOS
1. Download Ollama from the [official site](https://ollama.ai/download/mac)
2. Install the application
3. Run Ollama from Applications folder
4. Ollama will be available at `http://localhost:11434`
5. Enable CORS by creating or editing `~/.ollama/config.json`:
   ```json
   {
     "origins": ["*"]
   }
   ```

### Linux
1. Install Ollama using the command:
   ```bash
   curl -fsSL https://ollama.ai/install.sh | sh
   ```
2. Start Ollama:
   ```bash
   ollama serve
   ```
3. Enable CORS by creating or editing `~/.ollama/config.json`:
   ```json
   {
     "origins": ["*"]
   }
   ```

### Pulling Models
Once Ollama is running, you can pull models:
```bash
# Pull a basic model
ollama pull llama3

# Pull multimodal (image understanding) model
ollama pull llava
```

## 🌐 Remote Access Options

### Using Ollama on Another Computer
If you're running Ollama on another computer on your network, just enter the IP address in Clara's settings: `http://{IP_ADDRESS}:11434`

### Using ngrok for Remote Access
To access Ollama from anywhere:

```bash
# Install ngrok
npm install -g ngrok

# Expose Ollama API
ngrok http 11434
```

Then use the provided ngrok URL in Clara's settings.

## 🏗️ Project Architecture
Clara is built with a modular architecture:
```
clara/
├── src/
│   ├── components/     # UI components
│   ├── hooks/          # Custom hooks
│   ├── utils/          # Helper functions
│   ├── db/             # Local storage (IndexedDB)
│   └── App.tsx         # Application entry
├── public/             # Static assets
└── package.json        # Dependencies
```

## 🚢 Deployment
Deploy the `dist` directory to any static host (e.g., Netlify, GitHub Pages).

## 🤝 Contribute
1. Fork repository
2. Create feature branch (`git checkout -b feature/YourFeature`)
3. Commit changes (`git commit -m 'Add YourFeature'`)
4. Push branch (`git push origin feature/YourFeature`)
5. Submit Pull Request

## 📄 License
MIT License – [LICENSE](LICENSE)

---

🌟 **Built with privacy and security at its core.** 🌟