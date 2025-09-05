---
title: "Clara Assistant"
description: "Your portal to everything in ClaraVerse"
category: "features"
order: 2
lastUpdated: "2025-09-05"
contributors: ["badboysm890"]
---

# Clara Assistant

<img width="399" height="599" alt="ChatGPT Image Sep 5, 2025, 10_38_33 PM (1)" src="https://github.com/user-attachments/assets/ab0c92ab-6b23-48c6-b592-9050153ea532" />

Clara Assistant is your portal to everything in ClaraVerse. It's not just a chatbot — it's the central hub that connects all features, tools, and capabilities to give you maximum customization and power.

## What Makes Clara Special

Clara connects to every part of ClaraVerse: Tools, MCP, Agents, Notebooks, ImageGen, Memories, and Clara Core. This integration means you get a unified experience where everything works together seamlessly.

## Two Modes of Operation

Clara operates in two distinct modes depending on what you need:

### 💬 **Chat Mode**
- **Pure conversation**: Focus on discussion, explanation, and guidance
- **No tool access**: Clara can't modify files, run code, or access external systems
- **Fast responses**: Lightweight interactions for quick questions and learning
- **Perfect for**: Code explanations, learning concepts, planning, and brainstorming

### 🛠️ **Agent Mode**
- **Full tool access**: Clara can execute code, modify files, and use all available tools
- **Autonomous work**: Can complete complex tasks independently
- **MCP integration**: Automatically activates Clara's MCP server for enhanced capabilities
- **Perfect for**: Building projects, file operations, research, and hands-on development

**Switching modes**: Toggle between Chat and Agent mode anytime based on whether you need Clara to take action or just provide guidance.

## Connected Features

### 🛠️ **Tools**
Create your own custom tools to extend Clara's capabilities.

**How it works:**
- Go to Settings and generate your own tools
- Any webhook-based workflow in N8N can become your tool
- Connect email systems, dashboard data, sales data, or any custom service
- Clara automatically uses these tools when needed

**Examples:**
- "Check my email for urgent messages" (uses your email tool)
- "Get today's sales numbers" (uses your sales dashboard tool)
- "Send a notification to Slack" (uses your custom Slack tool)

### 🔌 **MCP (Model Context Protocol)**
Connect Clara to any MCP tools running on your system.

**Clara's Built-in MCP Server:**
When you switch to Agent mode, Clara automatically activates its built-in MCP server with powerful capabilities:

- **🐍 Python Environment**: Execute Python code in an isolated virtual environment
- **📁 Workspace Management**: Create, read, write, and organize files in a dedicated workspace
- **📄 Document Processing**: Read PDFs, Word docs, Excel files, PowerPoint, and more
- **🔍 Web Search Engine**: Docker-powered SearXNG for unlimited, free web research
- **🌐 Web Scraping**: Extract content from any website using Playwright automation
- **📊 PDF Creation**: Generate professional PDFs from your content

**Free Unlimited Web Research:**
If you have Docker installed, Clara's MCP automatically spawns a private SearXNG search engine:
- **No API keys needed**: Completely free and unlimited searches
- **Privacy-focused**: Your searches stay private, no tracking
- **Multiple engines**: Searches across Google, Bing, DuckDuckGo, Wikipedia, and more
- **Research-ready**: Perfect for gathering information, fact-checking, and exploration

**External MCP Tools:**
- Works with local MCP tools only (HTTP-based coming soon)
- Quick access through Clara Command Center (your input box)
- Seamlessly integrates external tools into conversations

**Usage:**
- **Agent mode**: Clara's MCP tools activate automatically
- **External tools**: Type `/` in the chat to see available MCP tools

### 📁 **Files & Context**
Upload any file and Clara will use it as context for better answers.

**Supported formats:**
- PDFs, CSVs, text files, code files
- Images (for analysis and description)
- Documents of any type

**How it works:**
- Drag and drop files into the chat
- Clara reads and understands the content
- Uses file information to provide more accurate responses

### 📓 **Notebooks**
Create knowledge bases for Clara to reference while working.

**Use cases:**
- Attach coding style guides for consistent code generation
- Add project documentation for better context
- Create reference materials for specific domains
- Build custom RAG (Retrieval Augmented Generation) systems

**Example:**
"Here's my company's API documentation. Help me build a client library following these patterns."

### 🎨 **ImageGen**
Generate images directly through Clara when ComfyUI is configured.

**Requirements:**
- ComfyUI server must be configured
- Feature automatically enables when server is detected

**Usage:**
"Generate an image of a sunset over mountains"
Clara will use your ComfyUI setup to create the image.

### 🧠 **Memories**
Clara's adaptive memory system that learns about you over time.

**How it's different:**
- Stores facts about you, not random conversation snippets
- Intelligently injects relevant context when needed
- Adapts and improves the more you use Clara
- Focuses on meaningful information that enhances future interactions

**Examples of what Clara remembers:**
- Your preferred coding style and frameworks
- Project patterns you commonly use
- Tools and workflows you rely on
- Domain-specific knowledge relevant to your work

### ⚡ **Clara Core**
Local LLM engine powered by llama.cpp with intelligent optimization.

**Features:**
- Runs completely local models for privacy
- Built-in optimizer manages models based on your hardware
- Automatically selects the best model configuration
- No internet required once models are downloaded

**Benefits:**
- Complete privacy — nothing leaves your machine
- No API costs or rate limits
- Works offline
- Optimized performance for your specific setup

### 🎤 **Voice**
Live voice interactions with Clara (available with RAG container).

**Requirements:**
- Download the RAG container to enable voice features
- Once installed, voice interactions become available

**Capabilities:**
- Talk to Clara naturally
- Get spoken responses
- Hands-free coding assistance
- Real-time voice conversations

## Command Center

Clara's input box is your command center. Use it to:
- Access MCP tools with `/` commands
- Upload files by dragging and dropping
- Start voice interactions
- Connect to any integrated feature

## Getting Started

1. **Choose your mode**: Start in Chat mode for questions, switch to Agent mode for hands-on work
2. **Start simple**: "Hello Clara, what can you help me with?"
3. **Try Agent mode**: Switch to Agent mode and ask Clara to "create a Python script that analyzes data"
4. **Upload files**: Drag documents into the chat for context
5. **Research anything**: In Agent mode, ask Clara to "search for the latest developments in AI"
6. **Create tools**: Go to Settings → Tools to add custom capabilities
7. **Add notebooks**: Create reference materials for better assistance
8. **Configure voice**: Download RAG container for voice interactions

### Quick Mode Comparison

**Chat Mode Examples:**
- "Explain how React hooks work"
- "What's the best approach for this architecture?"
- "Help me understand this error message"

**Agent Mode Examples:**
- "Create a Python script to analyze this CSV file"
- "Search for recent papers on machine learning and summarize the findings"
- "Build a simple web scraper to extract product prices"
- "Generate a PDF report from this data"

## The Power of Integration

Clara becomes more powerful as you connect more features. Your custom tools, uploaded files, notebooks, and memories all work together to create a personalized AI assistant that truly understands your workflow and preferences.

This isn't just AI chat — it's your complete AI-powered workspace that grows with you.
