<div align="center">
  <img src="/public/logo.png" alt="Clara Logo" width="90" height="90" />
  <h1>Clara</h1>
  <img src="/public/header.png" alt="Clara Banner" />
  <p><strong>Privacy-First AI Assistant & Agent Builder</strong></p>
  <p>Chat with AI, create intelligent agents, and turn them into fully functional apps—powered entirely by open-source models running on your own device.</p>
  <br/>
  <a href="https://clara-ollama.netlify.app/"><img src="https://img.shields.io/badge/Clara-1.2.41-FFD700.svg" alt="Clara Version Badge"></a>
  <br/><br/>
  <a href="https://clara.badboysm890.in/" target="_blank"><strong>🌐 Try Clara Online</strong></a> | 
  <a href="https://github.com/badboysm890/ClaraVerse/releases" target="_blank"><strong>⬇️ Download Desktop App</strong></a>
  <br/><br/>
  <a href="https://www.producthunt.com/posts/clara-433c5291-7639-4271-b246-8df30cbc449f" target="_blank">
    <img src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=942765&theme=light" alt="Clara on Product Hunt" width="250" height="54" />
  </a>
</div>

---

> 🛠️ **Note**: Clara originally required separate installation of Ollama, N8N, and backend. After feedback from users, we've made it super simple. **Now it needs only Docker Desktop — everything else is auto-configured.**

---

## 🔒 Enterprise-Ready Security

- ✅ **On-Premise Execution** – All AI models & workflows run on your local setup
- 🔐 **Zero Data Leakage** – No cloud APIs, no tracking, fully local
- 🧠 **Full Control** – Powered by open-source; own every part of your stack

---

# ✨ Key Features

## 🔄 Quick Look widgets
<p align="center"><img src="/public/screenshots/desktop_widgets.png" alt="Workflow" width="800"/></p>
<p align="center">Use the Built-in N8N for automating have custom widgets.</p>

## 🧠 AI Assistant
<p align="center"><img src="/public/screenshots/assistant-screenshot.png" alt="Assistant" width="800"/></p>
<p align="center">Chat with local Ollama models — including image understanding.</p>

## 🧠 AI Interpreter 
<p align="center"><img src="/public/screenshots/clara_interpreter.png" alt="Assistant" width="800"/></p>
<p align="center">Make your local models do things for you, Eg- Conversion of docs, Basic Model Training and much more like chat gpt - Powered by OpenInterpreter.</p>

## 🔄 Workflow Automation
<p align="center"><img src="/public/screenshots/n8n_ScreenShot.png" alt="Workflow" width="800"/></p>
<p align="center">Built-in N8N for automating anything with drag & drop workflows.</p>

## 🔄 Workflow Automation made easy with 1000+ templates
<p align="center"><img src="/public/screenshots/Workflows" alt="Workflow" width="800"/></p>
<p align="center">Store with lots of workflows in your disposal with sources where it is from and you can add yours too.</p>

## 🤖 AI-Powered Process Builder
<p align="center"><img src="/public/screenshots/Appstore.png" alt="Process Builder" width="800"/></p>
<p align="center">Combine automation and AI agents into complete processes.</p>

## 🏗️ Intelligent Agent Builder
<p align="center"><img src="/public/screenshots/app-builder-screenshot.png" alt="Agent Builder" width="800"/></p>
<p align="center">No-code node editor to build, test, and deploy agents as apps.</p>

## 🎨 Image Generation
<p align="center"><img src="/public/screenshots/image-gen-screenshot.png" alt="Image Gen" width="800"/></p>
<p align="center">Generate stunning images with Stable Diffusion + ComfyUI.</p>

## 🖼️ Image Gallery
<p align="center"><img src="/public/screenshots/gallery-screenshot.png" alt="Gallery" width="800"/></p>
<p align="center">Easily manage your image creations in one place.</p>

---

## 🚀 Installation (Docker-Based)

> ✅ **Only Requirement:** [Install Docker Desktop](https://www.docker.com/products/docker-desktop)

### How It Works

1. Launch Clara (Desktop/Web)
2. Clara detects Docker and boots:
   - Ollama
   - N8N
   - Clara Backend
3. You're ready to roll! 🛠️

### Services Launched

- Ollama for model inference
- N8N for workflow automation
- Clara's assistant, UI, image tools

---

## 📥 Download Desktop App

- 💻 [Windows Installer (.exe)](https://github.com/badboysm890/ClaraVerse/releases)
- 🍏 [macOS Installer (.dmg)](https://github.com/badboysm890/ClaraVerse/releases)
- 🐧 [Linux AppImage (.AppImage)](https://github.com/badboysm890/ClaraVerse/releases)

---

## 🍎 macOS Users

If you see a "damaged app" warning:

1. Right-click the `.app` and choose **Open**
2. Allow in *System Preferences → Security & Privacy*
3. Safe to use. Just unsigned.

---

## 👩‍💻 Developer Setup

```bash
git clone https://github.com/badboysm890/ClaraVerse.git
cd ClaraVerse
npm install
npm run dev           # Start web version
npm run electron:dev  # Start desktop app
```

### Build for Production

```bash
npm run build              # Web build
npm run electron:build     # Desktop build
```

---

## ⭐ GitHub Star History


[![Star History Chart](https://api.star-history.com/svg?repos=badboysm890/ClaraVerse&type=Date)](https://www.star-history.com/#badboysm890/ClaraVerse&Date)

---

## 🤝 Support & Contact

Need help? Reach out via 📧 **praveensm890@gmail.com**

---

## 🔐 Environment Variables & Security

For developers who want to use external services like Supabase, you'll need to set up environment variables:

1. Create a `.env` file at the root of the project
2. Add your environment variables following this structure:

```
# Supabase Configuration (if using Supabase)
VITE_SUPABASE_URL=your_supabase_url_here
VITE_SUPABASE_ANON_KEY=your_anon_key_here

# Only for server-side usage, not for client-side code
VITE_SUPABASE_SERVICE_KEY=your_service_key_here_server_only
```

**⚠️ Security Note:**
- Never commit your `.env` file to version control
- Don't store API keys directly in your code
- The `.gitignore` file is configured to exclude sensitive files like `.env`
