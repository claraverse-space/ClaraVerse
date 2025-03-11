# Clara – Privacy-First GenAI WebUI for Open Source Models

[![TypeScript](https://img.shields.io/badge/TypeScript-5.5.3-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.3.1-blue.svg)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-5.4.2-646CFF.svg)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4.1-38B2AC.svg)](https://tailwindcss.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Clara is a privacy-focused, fully client-side AI assistant that provides a secure, intuitive interface for interacting with AI models via Ollama. Unlike cloud-based solutions like OpenAI or Gemini, **Clara doesn't have any backend servers and never sends your data anywhere**. Your conversations and data remain entirely yours, securely stored in your browser.

## 🔒 Privacy First
- **Local-only data storage**: No backend, no data leaks.
- **Direct Ollama integration**: Simply provide your local Ollama URL, and you're ready.

## ✨ Current Features
- 💬 Real-time, secure chat with streaming responses
- 🌓 Automatic light/dark mode
- 📝 Markdown rendering with syntax highlighting
- 📚 Persistent chat history (stored locally)
- 🔍 Easy model selection and configuration

## 🚧 Upcoming Features
- 🖼️ Image generation
- 📱 Mobile-responsive design
- 📎 File attachments
- 🎤 Voice input/output
- 🔌 Custom apps & plugin system

## 🚀 Quick Start

### Prerequisites
- **Node.js** v20+
- **Ollama** installed locally ([install instructions](https://ollama.ai/))

### Installation
```bash
git clone https://github.com/yourusername/clara-ai.git
cd clara-ai
npm install
npm run dev
```

### Setup Ollama

Start Ollama server and pull models:
```bash
ollama serve

# Example model
ollama pull mistral
```

Configure CORS for web access:
```bash
sudo systemctl edit ollama.service

# Add this to enable web access
[Service]
Environment="OLLAMA_ORIGINS=*"

sudo systemctl daemon-reload
sudo systemctl restart ollama
```

## 🔗 Remote Access with ngrok (optional)
Securely access your Ollama remotely via ngrok:

```bash
npm install -g ngrok
ngrok http 11434
```
Then use the generated URL in Clara's settings.

## 🏗️ Project Structure
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