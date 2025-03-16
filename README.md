<div align="center">
  <img src="/public/logo-clara.png" alt="Clara Logo" width="180" height="180" />
  <h1>Clara</h1>
  <p><strong>Privacy-First AI Assistant & App Builder</strong></p>
  <p>Create, chat, and build with AI - all running locally on your device</p>

  [![Clara](https://img.shields.io/badge/Clara-0.1.2-FFD700.svg)](https://clara-ollama.netlify.app/)
  [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

  <a href="https://clara-ollama.netlify.app/" target="_blank">Try Clara Online</a> | <a href="#download-desktop-app">Download Desktop App</a>
</div>

## 🔒 Privacy First

Clara connects directly to your Ollama instance with **no data ever leaving your device**. Zero tracking, zero telemetry, all data stored locally.

## ✨ Key Features

### Intelligent Assistant
Chat with any Ollama model including multimodal models that understand images.

<img src="/public/screenshots/assistant-screenshot.png" alt="Clara Assistant" width="800" />

### Image Generation
Create stunning images with text prompts using Stable Diffusion models through ComfyUI.

<img src="/public/screenshots/image-gen-screenshot.png" alt="Clara Image Generation" width="800" />

### Custom App Builder
Build your own AI apps visually with our intuitive node-based editor.

<img src="/public/screenshots/app-builder-screenshot.png" alt="Clara App Builder" width="800" />

### Image Gallery
Browse, search and manage your generated images in the integrated gallery.

<img src="/public/screenshots/gallery-screenshot.png" alt="Clara Gallery" width="800" />

## 🚀 Getting Started

1. **Install Ollama** - [Download here](https://ollama.ai/download)
2. **Run Clara** - [Launch the web app](https://clara-ollama.netlify.app/) or download the desktop version
3. **Connect** - Enter your Ollama URL (default: http://localhost:11434)

## 📱 Download Desktop App

Clara is available as a native desktop application for enhanced performance:

- [Windows Installer (.exe)](https://github.com/Clara-AI/clara-ollama/releases/latest)
- [macOS Installer (.dmg)](https://github.com/Clara-AI/clara-ollama/releases/latest)
- [Linux AppImage (.AppImage)](https://github.com/Clara-AI/clara-ollama/releases/latest)

## 👩‍💻 Dev Zone

### Development Setup

```bash
# Clone repository
git clone https://github.com/Clara-AI/clara-ollama.git
cd clara-ollama

# Install dependencies
npm install

# Start development server (web)
npm run dev

# Start development server (desktop)
npm run electron:dev
```

### Remote Ollama Connection

To connect to Ollama running on another machine:

1. Configure CORS in Ollama (`~/.ollama/config.json`):
   ```json
   {
     "origins": ["*"]
   }
   ```
2. Enter the remote URL in Clara settings: `http://{IP_ADDRESS}:11434`

### Building for Production

```bash
# Build web version
npm run build

# Build desktop app
npm run electron:build
```

## 🤝 Support & Contact

- Website: [claraai.com](https://claraai.com)
- Email: support@claraai.com
- Twitter: [@ClaraAIAssist](https://twitter.com/ClaraAIAssist)

---

<div align="center">
  <p>© 2023 Clara AI Technologies, Inc. - <a href="https://claraai.com/privacy">Privacy Policy</a></p>
</div>