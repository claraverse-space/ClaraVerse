---
title: "Agents"
description: "Visual automation that runs 24/7 on your schedule"
category: "features"
order: 3
lastUpdated: "2025-09-06"
contributors: ["badboysm890"]
---

# 🤖 Agents

<img src="https://raw.githubusercontent.com/badboysm890/ClaraVerse/203bdcbe08ee6644378e1fc4cfcb88b0c6dc95f4/public/mascot/Agents.png" alt="Clara with LEGO blocks representing agent nodes" width="400" />

**What if you could build enterprise-grade automation workflows with the simplicity of playing with LEGO blocks?**

Agents transform complex automation into visual, drag-and-drop simplicity. While companies pay thousands for automation platforms like Zapier Enterprise or Microsoft Power Automate, you get unlimited workflow creation that runs locally, privately, and completely free.

**This isn't just automation—it's automation that works exactly how you think.**

## ✨ New in v0.1.45: Task Scheduling

Every agent can now become a scheduled task! As long as ClaraVerse is running on your PC, your agents will execute automatically based on your schedule. This means you can:

- **Set up recurring workflows**: Daily reports, weekly data processing, monthly cleanup tasks
- **Background automation**: Let agents work while you focus on other things
- **Reliable execution**: Agents run exactly when you need them to

**How it works:**
1. **Schedule in Agents**: When creating or editing an agent, set up its schedule directly in Agent Studio
2. **Manage in Tasks**: Head to the Tasks feature (located above Settings) to view and manage all your scheduled agents
3. **Monitor execution**: Track when tasks run, see their results, and adjust schedules as needed

This transforms your agents from manual tools into true automation powerhouses that work around the clock.

## Two Main Parts

### 🎨 Agent Studio
This is where the magic happens. Agent Studio is your visual workspace for creating, testing, and managing agents.

**What you can do:**
- **Create agents**: Drag and drop nodes to build workflows
- **Test everything**: Run your agents safely to see how they work
- **Manage your creations**: Keep track of all your agents in one place

### ⚡ Agent Runner SDK
The execution engine that brings your agents to life. It provides standalone apps you can use directly from the UI, plus SDK structure for building your own web applications with Clara SDK. 

**Important note**: This isn't meant for frontend use since the JSON outputs contain your API keys — keep it backend only.

## How Agents Work: Nodes and Acyclic Graphs

The real power comes from the massive collection of nodes you can use. Think of each node as a specialized tool that does one thing really well. Here's what you've got to work with:

### Available Node Types

**Basic Building Blocks:**
- **Input/Output**: Get data in and send results out
- **Static Text**: Store and format text content
- **JSON Parse**: Handle JSON data like a pro
- **If/Else**: Add smart decision-making to your flows

**AI-Powered Nodes:**
- **LLM**: Tap into language models for text generation
- **Structured LLM**: Get properly formatted JSON responses
- **Agent Executor**: Run autonomous AI agents within your workflow
- **Whisper Transcription**: Convert audio to text

**Media Processing:**
- **Image Input**: Work with images and visual data
- **PDF Input**: Extract text from PDF documents
- **ComfyUI Image Gen**: Generate images using ComfyUI
- **Text-to-Speech**: Convert text to natural-sounding audio

**Integration & Automation:**
- **API Request**: Connect to any web service
- **File Upload**: Handle file operations
- **Combine Text**: Merge and format text from multiple sources
- **Notebook Writer**: Save results to your knowledge base

### Why Acyclic Graphs?

All these nodes connect using Directed Acyclic Graphs (DAGs). Here's why this matters:

**No Loops = No Problems**
- Your workflows flow in one direction only
- No risk of infinite loops eating your resources
- Predictable execution every single time

**Rock-Solid Reliability**
- Workflows always finish (no getting stuck forever)
- Easy to debug when something goes wrong
- Clear data flow from start to finish

**Scales Like Crazy**
- Add more nodes without worrying about complexity
- Build massive workflows that stay manageable
- Perfect for enterprise-level automation

**Resource Friendly**
- No memory leaks from circular dependencies
- Efficient execution paths
- Optimal performance even with complex flows

## Getting Started

**Step 1: Open Agent Studio**
Jump into the visual builder and start experimenting.

**Step 2: Pick Your Nodes**
Choose from the huge library of available nodes based on what you want to accomplish.

**Step 3: Connect the Dots**
Drag connections between nodes to create your workflow logic.

**Step 4: Test and Deploy**
Run your agent to make sure it works, then set it loose.

## Real Power Examples

**Data Processing Pipeline:**
PDF Input → Extract text → LLM analysis → Structured output → API request to save results

**Content Generation Workflow:**
Static text prompt → LLM generation → Text formatting → Combine with templates → File output

**Media Processing Chain:**
Image input → AI analysis → Text description → Text-to-speech → Audio output

**Research Automation:**
User query → API requests → Data aggregation → LLM summarization → Notebook storage

The beauty is in the combinations — each node does one thing well, but together they can handle incredibly complex tasks automatically.

## 🔗 Integration with ClaraVerse Ecosystem

Agents aren't just standalone automation—they're the connective tissue that makes your entire ClaraVerse workspace intelligent and responsive.

### 🤖 **Clara Assistant Integration**
- **Agent Executor Node**: Run Clara's full AI capabilities within your workflows
- **Natural Language Control**: Ask Clara to "run my daily report agent" and watch it execute
- **Context Sharing**: Agents can access Clara's memory and conversation history for smarter automation

### 📚 **Notebooks Integration** 
- **Notebook Writer Node**: Automatically save agent results to your knowledge base
- **Research Workflows**: Agents can query your notebooks, extract insights, and generate reports
- **Auto-Documentation**: Set up agents to process new documents and update your notebooks automatically

### 🎨 **ImageGen Integration**
- **ComfyUI Image Gen Node**: Generate images as part of larger workflows
- **Batch Processing**: Create agents that generate multiple images with different prompts
- **Content Pipelines**: Combine text generation, image creation, and document formatting in one flow

### 💻 **LumaUI Integration**
- **Backend Automation**: Use agents as the backend for your LumaUI applications
- **Content Generation**: Automatically generate website content, images, and data for your projects
- **Deployment Workflows**: Create agents that build, test, and deploy your web applications

### ⚡ **N8N Integration**
- **Hybrid Workflows**: Combine Agent nodes with N8N's extensive integration library
- **Tool Creation**: Turn agent workflows into Clara Assistant tools through N8N webhooks
- **Complex Automation**: Use N8N for external integrations, Agents for AI processing

### 🔄 **Real Ecosystem Examples**

**Content Creation Pipeline:**
1. **N8N** monitors your RSS feeds for new articles
2. **Agent** processes articles, extracts key insights using LLM nodes
3. **Notebook Writer** saves insights to your research notebook
4. **ImageGen Node** creates relevant illustrations
5. **LumaUI** displays everything in a beautiful dashboard
6. **Clara** can reference all this data in conversations

**Automated Research Assistant:**
1. **Agent** queries your notebooks for existing research
2. **API Request nodes** gather new data from external sources
3. **LLM nodes** analyze and synthesize findings
4. **ComfyUI node** generates visual summaries
5. **N8N integration** sends results to your team via Slack
6. **Clara** remembers everything for future questions

This is the power of true integration—every feature amplifies every other feature.

Ready to build something amazing? Dive into Agent Studio and start connecting those nodes!
