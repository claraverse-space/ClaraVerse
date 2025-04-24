<div align="center">
  <img src="/public/logo.png" alt="Clara Logo" width="90" height="90" />
  <h1>Clara</h1>
  <img src="/public/header.png" alt="Clara Logo" />
  <br>
   <br>
  <p><strong>Privacy-First AI Assistant & Agent Builder</strong></p>
  <p>Chat with AI, create intelligent agents, and turn them into fully functional apps—powered entirely by open-source models running on your own device.</p>

  [![Clara](https://img.shields.io/badge/Clara-1.2.1-FFD700.svg)](https://clara-ollama.netlify.app/)
  
  <a href="https://clara.badboysm890.in/" target="_blank">Try Clara Online</a> | <a href="https://github.com/badboysm890/ClaraVerse/releases">Download Desktop App</a>

  <a href="https://www.producthunt.com/posts/clara-433c5291-7639-4271-b246-8df30cbc449f?embed=true&utm_source=badge-featured&utm_medium=badge&utm_souce=badge-clara&#0045;433c5291&#0045;7639&#0045;4271&#0045;b246&#0045;8df30cbc449f" target="_blank"><img src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=942765&theme=light&t=1742154003625" alt="Clara - Browser&#0045;Based&#0032;AI&#0032;for&#0032;Chat&#0044;&#0032;Agents&#0032;&#0038;&#0032;Image&#0032;Generation&#0032;Locally | Product Hunt" style="width: 250px; height: 54px;" width="250" height="54" /></a>
</div>

---

> **Note:** Initially, Clara required individual installations of Ollama, N8N, and its own backend. After realizing the setup complexity for end users, we moved to a Docker-only solution. Now, the only requirement is Docker Desktop. Clara will handle the rest.

---

## 🔒 Enterprise-Ready Security

- **On-Premise Execution**: All AI models and automation workflows run entirely on your infrastructure
- **Zero Data Leakage**: Your business data never leaves your network. No cloud dependencies, no external APIs
- **Complete Control**: Built on open-source technology stack, giving you full control over your automation infrastructure

# ✨ Key Features

<h3 align="center">🔄  Workflow Automation</h3>
<p align="center">Leverage embedded N8N workflow engine to create sophisticated business processes with AI integration:</p>
<p align="center"><img src="/public/screenshots/n8n_ScreenShot.png" alt="Clara N8N Workflow" width="800"/></p>

<h3 align="center">🤖 AI-Powered Process Builder</h3>
<p align="center">Design intelligent business processes that combine N8N workflows with custom AI agents - all from a single interface:</p>
<p align="center"><img src="/public/screenshots/Appstore.png" alt="Clara N8N Integration" width="800"/></p>

<h3 align="center">🏗️ Intelligent Agent Builder</h3>
<p align="center">Design custom AI agents with a node-based editor, then convert them into standalone business applications:</p>
<p align="center"><img src="/public/screenshots/app-builder-screenshot.png" alt="Clara Agent Builder" width="800"/></p>

<h3 align="center">AI Assistant</h3>
<p align="center">Chat with any Ollama-compatible model, including multimodal models that understand images:</p>
<p align="center"><img src="/public/screenshots/assistant-screenshot.png" alt="Clara Assistant" width="800"/></p>

<h3 align="center">🎨 Image Generation</h3>
<p align="center">Create amazing images from text prompts using Stable Diffusion models with ComfyUI integration:</p>
<p align="center"><img src="/public/screenshots/image-gen-screenshot.png" alt="Clara Image Generation" width="800"/></p>

<h3 align="center">🖼️ Image Gallery</h3>
<p align="center">Browse, search, and manage all generated images in one convenient gallery:</p>
<p align="center"><img src="/public/screenshots/gallery-screenshot.png" alt="Clara Gallery" width="800"/></p>

## 🚀 Installation (Docker-Based)

> **Only Requirement: [Docker Desktop](https://www.docker.com/products/docker-desktop/)**

Once Docker is installed and running, Clara will automatically spin up everything — Ollama, N8N, and its own backend.

### 🔧 How It Works

- Run Clara Desktop or Web version
- It detects Docker
- Starts required containers (Ollama, N8N, Backend)
- Done. You’re live.

### 💡 What Gets Deployed

- Ollama server (for local model inference)
- N8N (for automation workflows)
- Clara backend (agent orchestration, assistant, image gen)
- UI served locally

## 📱 Download Desktop App

For offline-first experience:

- [Windows Installer (.exe)](https://github.com/badboysm890/ClaraVerse/releases)
- [macOS Installer (.dmg)](https://github.com/badboysm890/ClaraVerse/releases)
- [Linux AppImage (.AppImage)](https://github.com/badboysm890/ClaraVerse/releases)

## Mac Distribution Note

If macOS complains app is damaged or can’t be opened:

1. Right-click the app in Finder
2. Click “Open”
3. Confirm in dialog
4. Or go to *System Preferences → Security & Privacy → Open Anyway*

## 👩‍💻 Dev Zone

### Development Setup

```bash
git clone https://github.com/badboysm890/ClaraVerse.git
cd clara-ollama
npm install
npm run dev         # For Web
npm run electron:dev  # For Desktop
```

### Building for Production

```bash
npm run build            # Build web
npm run electron:build   # Build desktop
```

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=badboysm890/ClaraVerse&type=Date)](https://www.star-history.com/#badboysm890/ClaraVerse&Date)

## 🤝 Support & Contact

Questions? Ping me at **praveensm890@gmail.com**
