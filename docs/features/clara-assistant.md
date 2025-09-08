---
title: "Clara Assistant"
description: "Your AI-powered command center that connects everything"
category: "features"
order: 2
lastUpdated: "2025-09-06"
contributors: ["badboysm890"]
---

<img width="399" height="599" alt="Assistant" src="https://github.com/user-attachments/assets/ab0c92ab-6b23-48c6-b592-9050153ea532" />

# Clara Assistant

Your local AI assistant that orchestrates your entire workspace.

## What Clara Actually Does

Clara is an AI assistant that runs on your computer and connects to everything else in ClaraVerse. Think of it as your command center - you can chat, research, generate content, and automate tasks all from one interface.

## System Requirements

- **Minimum**: 8GB RAM, any GPU helps
- **Recommended**: 16GB RAM, 4GB+ VRAM GPU
- **Best Experience**: 32GB RAM, 8GB+ VRAM GPU

## Two Operating Modes

### Chat Mode (Default)
Fast, lightweight conversations without system access.

**Use for:**
- Code explanations
- Planning and brainstorming  
- General questions
- Learning concepts

**Example:**
```
You: How do React hooks work?
Clara: [Explains hooks without accessing any tools]
```

### Agent Mode
Full system access with MCP tools. Slower but can actually do things.

**Use for:**
- Web research
- File operations
- Code generation and execution
- Document processing

**Example:**
```
You: Research the latest AI papers and create a summary PDF
Clara: [Searches web, analyzes papers, generates PDF]
```

## Core Features

### Web Research (Agent Mode + Docker)
If you have Docker installed, Clara gets unlimited web search through SearXNG:
- No API keys needed
- Searches Google, Bing, DuckDuckGo simultaneously
- Completely private

**Setup:** Just have Docker running. Clara handles the rest.

### File Processing
Drag and drop any file into chat:
- PDFs, Word docs, Excel sheets
- Code files (any language)
- Images for analysis
- CSVs for data work

**Limitation:** Large files (>10MB) may be slow to process.

### Custom Tools via N8N
Create webhooks in N8N, convert them to Clara tools:
1. Build workflow in N8N
2. Create webhook trigger
3. Go to Settings → Tools
4. Add webhook URL as new tool

**Example tools users have built:**
- Email checker
- Database queries  
- Slack notifications
- Calendar management

### Notebooks Integration
Attach notebooks for Clara to reference:
```
You: [Attach company_guidelines notebook]
You: Write code following our standards
Clara: [Uses notebook context for accurate responses]
```

### Memory System
Clara remembers facts about you between conversations:
- Your tech stack preferences
- Project patterns
- Common workflows

**Note:** Memory is stored in browser IndexedDB. Clearing browser data loses memories.

## Model Recommendations

### Starter Model
**JanNano128K-4B**: Fast, runs on most hardware, good for basic tasks

### Power User Models  
**GPT-OSS-20B**: Balanced performance and quality
**SeedOSS-ByteDance-36B**: Best quality, needs beefy hardware

### Vision Model
**InterVL-14B**: For image understanding tasks

## Common Workflows

### Daily Email Summary
```
1. Switch to Agent Mode
2. "Check my email and create a summary"
3. Clara uses email tool to fetch messages
4. Generates summary and saves to notebook
```

### Research Task
```
1. Agent Mode
2. "Research [topic] and create a report"
3. Clara searches web, analyzes sources
4. Creates formatted report
5. Optional: Save to notebook for future reference
```

### Code Project
```
1. Upload project files for context
2. "Help me add authentication to this app"
3. Clara analyzes code, suggests implementation
4. Agent Mode: Can write and test code directly
```

## Performance Expectations

- **Chat Mode**: Instant to 5 seconds depending on model
- **Agent Mode with search**: 10-30 seconds per search
- **File processing**: 5-20 seconds depending on size
- **Code execution**: 2-10 seconds

## Limitations & Known Issues

1. **Model Quality**: Clara is only as good as your chosen model
2. **Local Processing**: Slower than cloud services like ChatGPT
3. **Memory Limits**: Long conversations may hit context limits
4. **MCP Tools**: Currently only local MCP tools work (HTTP support coming)
5. **Voice**: Requires RAG container (additional 8GB download)

## Troubleshooting

**Clara not responding?**
- Check if model is loaded in Settings
- Verify Clara Core service is running
- Try refreshing the page

**Agent Mode not working?**
- Ensure Docker is running for web search
- Check MCP server status in logs
- Switch to Chat Mode and back

**Memory issues?**
- Use smaller models (4B or 7B)
- Close other applications
- Restart Clara Core service

## Pro Tips

1. Start with Chat Mode to plan, switch to Agent for execution
2. Use notebooks for any reference material you'll need repeatedly
3. Create N8N tools for repetitive tasks
4. Upload files rather than pasting long content
5. Use specific models for specific tasks (small for chat, large for complex reasoning)

## Getting Started

1. Install ClaraVerse and Docker
2. Download JanNano128K-4B model
3. Start with Chat Mode - ask anything
4. Try Agent Mode - "search for Python tutorials"
5. Create your first N8N tool
6. Build a notebook for your project

Remember: Clara runs entirely on your machine. No data leaves your computer unless you explicitly configure external services.