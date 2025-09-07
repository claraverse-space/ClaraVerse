---
title: "Getting Started with ClaraVerse"
description: "Requirements and installation only"
category: "getting-started"
order: 1
lastUpdated: "2025-09-05"
contributors: ["badboysm890"]
---


<img width="399" height="599" alt="Hello Welcome Clara" src="https://raw.githubusercontent.com/badboysm890/ClaraVerse/main/public/mascot/Hi_Welcome_Clara.png" />

# Getting Started

Quick setup guide to get ClaraVerse running.

## System Requirements

### Minimum
- **OS**: Windows 10+, macOS 11+, or Linux (Ubuntu 20.04+)
- **RAM**: 8GB (will be slow)
- **Storage**: 5GB for app + first model
- **CPU**: Any x64 processor

### Recommended
- **RAM**: 16GB or more
- **GPU**: 4GB+ VRAM for image generation
- **Storage**: 50GB+ for multiple models
- **Docker**: Required for N8N, RAG, and bundled services

## Installation

### Step 1: Download
Get the latest release from:
```
https://github.com/badboysm890/claraverse/releases
```

Choose your platform:
- **Windows**: `ClaraVerse-win-x64.exe`
- **macOS**: `ClaraVerse-mac-universal.dmg`  
- **Linux**: `ClaraVerse-linux-x64.AppImage`

### Step 2: Install

**Windows:**
1. Run the `.exe` installer
2. Windows Defender may warn - click "More info" → "Run anyway"
3. Launch from Start Menu

**macOS:**
1. Open the `.dmg` file
2. Drag ClaraVerse to Applications
3. First launch: Right-click → Open (bypass Gatekeeper)
4. If blocked: System Preferences → Security → "Open Anyway"

**Linux:**
```bash
chmod +x ClaraVerse-linux-x64.AppImage
./ClaraVerse-linux-x64.AppImage
```

### Step 3: First Launch
1. ClaraVerse opens in your browser
2. Download a starter model:
   - Go to Settings → Local Models
   - Download `JanNano128K-4B` (3GB)
3. Start chatting with Clara!

## Optional Services

### Docker (Highly Recommended)
Needed for N8N, RAG, and some features:

**Windows/Mac**: Download Docker Desktop from docker.com
**Linux**: 
```bash
sudo apt install docker.io docker-compose
sudo usermod -aG docker $USER
```

### N8N (Automation)
- **With Docker**: Auto-installs when you first open N8N tab
- **Without Docker**: Point to external N8N instance in Settings

### ComfyUI (Image Generation)
- **Windows**: Bundled CUDA version available (one-click install)
- **Mac/Linux**: Bring your own ComfyUI instance
- **Setup**: Settings → ImageGen → Configure endpoint

### RAG (Document Chat)
- **Storage needed**: 
  - macOS: +2GB
  - Windows: +8GB (includes CUDA)
- **Install**: Notebooks tab → Follow setup prompts

## Quick Test

1. **Test Clara Chat**:
   ```
   "Hello Clara, what can you do?"
   ```

2. **Test Agent Mode** (if Docker installed):
   ```
   Switch to Agent Mode
   "Search for Python tutorials"
   ```

3. **Test Image Generation** (if ComfyUI configured):
   ```
   "Generate an image of a sunset"
   ```

## Common First-Time Issues

### "Model not found"
→ Download a model in Settings → Local Models

### "Clara not responding"
→ Check Settings → Services → Clara Core is running

### "Docker not found"
→ Install Docker Desktop and ensure it's running

### "Permission denied" (Linux)
→ Add user to docker group and reboot

### "Windows protected your PC"
→ Click "More info" → "Run anyway" (it's not signed)

## Storage Locations

- **App config**: `~/.claraverse/`
- **Models**: `~/.claraverse/models/`
- **Docker volumes**: Managed by Docker
- **Browser data**: IndexedDB (don't clear!)

## What's Next?

1. **Explore Clara Assistant** - Your main interface
2. **Try Notebooks** - Upload PDFs and chat with them
3. **Build an Agent** - Visual automation workflows
4. **Connect N8N** - External integrations
5. **Generate Images** - If you have a GPU

## Need Help?

- **Discord**: Most active community support
- **GitHub Issues**: Bug reports and features
- **Email**: praveensm890@gmail.com (expect delays - solo dev!)

## Quick Reality Check

- This is v0.1.x software - expect rough edges
- Local AI is slower than cloud services
- You'll need patience and some technical knowledge
- But you'll own everything and pay nothing

Ready? Open ClaraVerse and let's build something cool!