---
title: "Getting Started with ClaraVerse"
description: "Requirements and installation only"
category: "getting-started"
order: 1
lastUpdated: "2025-09-05"
contributors: ["badboysm890"]
---



# 🚀 Getting Started

<img width="399" height="599" alt="Hello Welcome Clara" src="https://raw.githubusercontent.com/badboysm890/ClaraVerse/main/public/mascot/Hi_Welcome_Clara.png" />

This page only covers what you need and how to install ClaraVerse.

## 📋 Requirements

- **OS**: macOS, Windows, or Linux
- **RAM**: 8 GB minimum (16 GB recommended)
- **Disk space**:
  - **Base app + basic model**: ~3 GB
  - **Optional RAG**:
    - macOS: +2 GB
    - Windows: +8 GB (CUDA assets)
- **GPU (optional)**: Recommended for image generation; not required for core features

## ⬇️ Download & Install

1. Go to the releases page:
   - `https://github.com/badboysm890/claraverse/releases`
2. Download the installer for your OS:
   - Windows: `ClaraVerse-win-x64.exe`
   - macOS: `ClaraVerse-mac-universal.dmg`
   - Linux: `ClaraVerse-linux-x64.AppImage`
3. Install and launch:
   - Windows: run the `.exe`
   - macOS: open the `.dmg` and drag to Applications
   - Linux: `chmod +x` the AppImage, then run it

That’s it — ClaraVerse is ready.
Note: You will need to install Docker if you want to use the bundled N8N, RAG and ComfyUI.

## 🖼️ ComfyUI (Image Generation)

- **Bundled instance**: Windows only (optimized CUDA build)
- **Bring your own**: You can point ClaraVerse to any external ComfyUI server (all OSes)

## N8N (Automation)

- **Bundled instance**: Windows, macOS, Linux (Docker 2GB+)
- **Bring your own**: You can point ClaraVerse to any external N8N server (all OSes)

## 🧠 RAG (Local Knowledge)

- Additional storage: macOS +2 GB, Windows +8 GB (due to CUDA assets)
- Optional — only install if you need local document search/augmentation

## 🛠️ Under Active Work

- **Remote/server mode**: Planned for the future with a peer‑to‑peer approach. For now, focus is stability and polish. This is a single‑developer effort — thank you for your patience and support.
- If you need a pure server UI today, consider: OpenWebUI, LobeChat, LibreChat.
- Cross‑platform ComfyUI packaging improvements.
- Ongoing performance and GPU enhancements.

## 💡 Why Clara?

Your computer deserves to be more than just a tool — it should be your creative partner. Clara transforms your machine into a living AI studio where you can automate the mundane, have meaningful conversations that remember your context, create stunning visuals, and build amazing things. Everything stays private, everything stays yours, and everything stays local. 

This is computing that feels personal and fun again..

I might not resonate with you but that's okay no worries claraverse will continue to grow to your liking soon. 
