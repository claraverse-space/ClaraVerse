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

## 🔒 Enterprise-Ready Security

- **On-Premise Execution**: All AI models and automation workflows run entirely on your infrastructure
- **Zero Data Leakage**: Your business data never leaves your network. No cloud dependencies, no external APIs
- **Complete Control**: Built on open-source technology stack, giving you full control over your automation infrastructure

# ✨ Key Features

<h3 align="center">
🔄  Workflow Automation
</h3>
<p align="center">
  Leverage embedded N8N workflow engine to create sophisticated business processes with AI integration:
</p>

<p align="center">
  <img src="/public/screenshots/n8n_ScreenShot.png" alt="Clara N8N Workflow" width="800"/>
</p>

<h3 align="center">
  🤖 AI-Powered Process Builder
</h3>
<p align="center">
  Design intelligent business processes that combine N8N workflows with custom AI agents - all from a single interface:
</p>

<p align="center">
  <img src="/public/screenshots/Appstore.png" alt="Clara N8N Integration" width="800"/>
</p>

<h3 align="center">
  🏗️ Intelligent Agent Builder
</h3>
<p align="center">
  Design custom AI agents with a node-based editor, then convert them into standalone business applications:
</p>

<p align="center">
  <img src="/public/screenshots/app-builder-screenshot.png" alt="Clara Agent Builder" width="800"/>
</p>

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
🖼️ Image Gallery
</h3>
<p align="center">
  Browse, search, and manage all generated images in one convenient gallery:
</p>

<p align="center">
  <img src="/public/screenshots/gallery-screenshot.png" alt="Clara Gallery" width="800"/>
</p>

## 🚀 Installation Options

### 1. Native Desktop Apps

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
- Requires local Ollama installation - limited to just chat and needed remote ollama config

### Prerequisites
1. **Install Ollama** (Required for all versions except Docker)
   Download from [Ollama's website](https://ollama.ai/download)
2. **Connect**
   Default Ollama endpoint: `http://localhost:11434`

## 📱 Download Desktop App

For faster performance and offline convenience, download the native desktop version:

- [Windows Installer (.exe)](https://github.com/badboysm890/ClaraVerse/releases)
- [macOS Installer (.dmg)](https://github.com/badboysm890/ClaraVerse/releases)
- [Linux AppImage (.AppImage)](https://github.com/badboysm890/ClaraVerse/releases)

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

## 📋 N8N Setup & Troubleshooting

### Prerequisites

Before using Clara's N8N integration, ensure you have the following installed:

#### 1. Install NVM (Node Version Manager)

**macOS & Linux:**
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
```
Then add to your shell configuration (~/.bash_profile, ~/.zshrc, ~/.bashrc):
```bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
```

**Windows:**
1. Download and install [nvm-windows](https://github.com/coreybutler/nvm-windows/releases)
2. Run installer as administrator
3. Restart terminal after installation

#### 2. Install Node.js via NVM

```bash
# Install latest LTS version
nvm install --lts

# Use the installed version
nvm use --lts
```

#### 3. Install N8N Globally

```bash
npm install n8n -g
```

### Starting N8N

Clara automatically manages N8N processes, but you can also run it manually:

```bash
# Start N8N
n8n start

# Start in tunnel mode (for remote access)
n8n start --tunnel
```

### Troubleshooting

#### Common Issues & Solutions

1. **N8N Doesn't Start**
   ```bash
   # Check if port 5678 is in use
   lsof -i :5678    # macOS/Linux
   netstat -ano | findstr :5678    # Windows
   
   # Kill existing process if needed
   kill -9 <PID>    # macOS/Linux
   taskkill /PID <PID> /F    # Windows
   ```

2. **Permission Issues**
   ```bash
   # macOS/Linux
   sudo chown -R $USER ~/.n8n
   
   # Windows (Run PowerShell as Administrator)
   takeown /F "%USERPROFILE%\.n8n" /R
   ```

3. **Database Errors**
   ```bash
   # Clear N8N cache
   rm -rf ~/.n8n/database.sqlite    # macOS/Linux
   del "%USERPROFILE%\.n8n\database.sqlite"    # Windows
   ```

4. **Node Version Conflicts**
   ```bash
   # Ensure correct Node version
   nvm install 16
   nvm use 16
   npm install n8n -g
   ```

#### OS-Specific Notes

**macOS:**
- If installation fails, ensure Xcode Command Line Tools are installed:
  ```bash
  xcode-select --install
  ```
- For M1/M2 Macs, you might need Rosetta:
  ```bash
  softwareupdate --install-rosetta
  ```

**Linux:**
- Ensure build essentials are installed:
  ```bash
  sudo apt-get update
  sudo apt-get install -y build-essential
  ```
- For Ubuntu/Debian, you might need additional dependencies:
  ```bash
  sudo apt-get install -y python3 make gcc g++
  ```

**Windows:**
- Run PowerShell as Administrator when installing global packages
- Ensure Windows Build Tools are installed:
  ```powershell
  npm install --global windows-build-tools
  ```
- If you encounter path issues:
  1. Check System Environment Variables
  2. Ensure Node and npm paths are correctly set
  3. Restart PowerShell/CMD after path changes

### Verifying Installation

```bash
# Check N8N version
n8n --version

# Check if N8N service is running
curl http://localhost:5678    # macOS/Linux
Invoke-WebRequest -Uri http://localhost:5678    # Windows
```
