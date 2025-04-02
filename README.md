
<div align="center">
  <img src="/public/logo.png" alt="Clara Logo" width="90" height="90" />
  <h1>Clara</h1>
  <img src="/public/header.png" alt="Clara Logo" />
  <br>
   <br>
  <p><strong>Privacy-First AI Assistant & Agent Builder</strong></p>
  <p>Chat with AI, create intelligent agents, and turn them into fully functional apps—powered entirely by open-source models running on your own device.</p>

  [![Clara](https://img.shields.io/badge/Clara-1.2.1-FFD700.svg)](https://clara-ollama.netlify.app/)
  
  <a href="https://clara.badboysm890.in/" target="_blank">Try Clara Online</a> | <a href="https://github.com/badboysm890/ClaraVerse/releases/tag/v1.2.1">Download Desktop App</a>

  <a href="https://www.producthunt.com/posts/clara-433c5291-7639-4271-b246-8df30cbc449f?embed=true&utm_source=badge-featured&utm_medium=badge&utm_souce=badge-clara&#0045;433c5291&#0045;7639&#0045;4271&#0045;b246&#0045;8df30cbc449f" target="_blank"><img src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=942765&theme=light&t=1742154003625" alt="Clara - Browser&#0045;Based&#0032;AI&#0032;for&#0032;Chat&#0044;&#0032;Agents&#0032;&#0038;&#0032;Image&#0032;Generation&#0032;Locally | Product Hunt" style="width: 250px; height: 54px;" width="250" height="54" /></a>

</div>



## 🔒 Privacy First

- **Local Execution**: Clara connects directly to Ollama and uses open-source language and image generation models—**all running on your device**.  
- **No Third-Party Clouds**: Your data never leaves your machine. Zero telemetry, zero tracking.  
- **Open-Source Technology**: Built to leverage community-driven innovations, giving you full control over your AI stack.

# ✨ Key Features
<h3 align="center">
AI Assistant
</h3>
<p align="center">
  Chat with any Ollama-compatible model, including multimodal models that understand images:
</p>

<p align="center">
  <img src="/public/screenshots/assistant-screenshot.png" alt="Clara Assistant" width="800"/>
</p>


<h3 align="center">
🎨 Image Generation
</h3>
<p align="center">
  Create amazing images from text prompts using Stable Diffusion models with ComfyUI integration:
</p>

<p align="center">
  <img src="/public/screenshots/image-gen-screenshot.png" alt="Clara Image Generation" width="800"/>
</p>


<h3 align="center">
  🏗️ Intelligent Agent Builder
</h3>
<p align="center">
  Design custom AI agents with a node-based editor, then convert them into standalone apps without leaving Clara:
</p>

<p align="center">
  <img src="/public/screenshots/app-builder-screenshot.png" alt="Clara Agent Builder" width="800"/>
</p>


<h3 align="center">
🖼️ Image Gallery
</h3>
<p align="center">
  Browse, search, and manage all generated images in one convenient gallery:
</p>

<p align="center">
  <img src="/public/screenshots/gallery-screenshot.png" alt="Clara Gallery" width="800"/>
</p>


## 🚀 Installation Options

### 1. Docker (Recommended for Windows & Linux)
```bash
# Pull the image
docker pull claraverse/clara-ollama:latest

# Run with auto-restart
docker run -d --restart always -p 8069:8069 claraverse/clara-ollama:latest
```
Then visit http://localhost:8069 in your browser.

### 2. Native Desktop Apps

#### macOS (Signed)
- [Download .dmg installer](https://github.com/badboysm890/ClaraVerse/releases/tag/v1.2.1)
- Universal binary (works on both Intel and Apple Silicon)
- Fully signed and notarized for enhanced security

#### Linux (Signed)
- [Download .AppImage](https://github.com/badboysm890/ClaraVerse/releases/tag/v0.2.0)
- Runs on most Linux distributions
- No installation required

#### Windows
- We recommend using the Docker version for best performance and security
- If you need the native app: [Download .exe installer](https://github.com/badboysm890/ClaraVerse/releases/tag/v1.0.4)
- **I dont have money for signing it 😢**

### 3. Web Version
- [Try Clara Online](https://clara-ollama.netlify.app/)
- Requires local Ollama installation

### Prerequisites
1. **Install Ollama** (Required for all versions except Docker)
   Download from [Ollama's website](https://ollama.ai/download)
2. **Connect**
   Default Ollama endpoint: `http://localhost:11434`

## 📱 Download Desktop App

For faster performance and offline convenience, download the native desktop version:

- [Windows Installer (.exe)](https://github.com/badboysm890/ClaraVerse/releases/tag/v1.0.4)
- [macOS Installer (.dmg)](https://github.com/badboysm890/ClaraVerse/releases/tag/v1.0.4)
- [Linux AppImage (.AppImage)](https://github.com/badboysm890/ClaraVerse/releases/tag/v0.2.0)

## Mac Distribution Note

### For Mac Users Installing This App

If you see a message that the app is damaged or can't be opened:

1. Right-click (or Control+click) on the app in Finder
2. Select "Open" from the context menu
3. Click "Open" on the security dialog
4. If still blocked, go to System Preferences > Security & Privacy > General and click "Open Anyway"

This happens because the app is not notarized with Apple. This is perfectly safe, but macOS requires this extra step for unsigned applications.

### For Developers

Building for macOS:

- **Development build** (no notarization): `npm run electron:build-mac-dev`
- **Production build** (with notarization, requires Apple Developer Program): 
  1. Set environment variables `APPLE_ID`, `APPLE_ID_PASSWORD` (app-specific password), and `APPLE_TEAM_ID` 
  2. Run `npm run electron:build-mac`

To get an Apple Team ID, join the [Apple Developer Program](https://developer.apple.com/programs/).

## 👩‍💻 Dev Zone

### Development Setup

```bash
# Clone the repository
git clone https://github.com/badboysm890/ClaraVerse.git
cd clara-ollama

# Install dependencies
npm install

# Start development server (web)
npm run dev

# Start development server (desktop)
npm run electron:dev
```

### Remote Ollama Connection

If Ollama runs on another machine:

1. Enable CORS in Ollama (`~/.ollama/config.json`):
   ```json
   {
     "origins": ["*"]
   }
   ```
2. In Clara settings, specify: `http://{IP_ADDRESS}:11434`

### Building for Production

```bash
# Build web version
npm run build

# Build desktop app
npm run electron:build
```

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=badboysm890/ClaraVerse&type=Date)](https://www.star-history.com/#badboysm890/ClaraVerse&Date)

## 🤝 Support & Contact

Have questions or need help? Reach out via **praveensm890@gmail.com**.
