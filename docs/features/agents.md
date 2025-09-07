---
title: "Agents"
description: "Visual automation that runs 24/7 on your schedule"
category: "features"
order: 3
lastUpdated: "2025-09-06"
contributors: ["badboysm890"]
---

<img src="https://raw.githubusercontent.com/badboysm890/ClaraVerse/203bdcbe08ee6644378e1fc4cfcb88b0c6dc95f4/public/mascot/Agents.png" alt="Clara with LEGO blocks representing agent nodes" width="400" />

# Agents

Visual workflow automation using node-based programming.

## What Agents Are

Agents are automated workflows you build by connecting nodes (think visual programming). Each node does one specific task, and you chain them together to create complex automations. No coding required, but you need to understand basic logic flow.

## System Requirements

- Same as base ClaraVerse (8GB RAM minimum)
- Additional services may increase requirements
- ComfyUI node needs GPU with 4GB+ VRAM

## How It Works

### Node System
Agents use Directed Acyclic Graphs (DAGs) - fancy term meaning "no loops allowed". This prevents infinite loops and makes workflows predictable.

**Why no loops?** 
- Prevents system crashes
- Guarantees workflows complete
- Makes debugging possible
- Resource-efficient

### Available Nodes

**Input/Output**
- Input: Get data into your workflow
- Output: Send results somewhere
- Static Text: Store text templates
- File Upload: Process files

**AI Nodes**
- LLM: Generate text using your chosen model
- Structured LLM: Get JSON responses
- Agent Executor: Run Clara Assistant within workflow
- Whisper: Speech-to-text (requires model download)

**Processing**
- JSON Parse: Handle JSON data
- Combine Text: Merge multiple text sources
- If/Else: Conditional logic
- API Request: Call external services

**Integration Nodes**
- Notebook Writer: Save to your knowledge base
- ComfyUI: Generate images
- Text-to-Speech: Create audio output
- PDF Input: Extract text from PDFs

## Building Your First Agent

### Example: Email Summary Agent
```
1. API Request (fetch emails)
   ↓
2. JSON Parse (extract content)
   ↓
3. LLM Node (summarize)
   ↓
4. Notebook Writer (save summary)
```

### Step-by-Step:
1. Open Agent Studio
2. Drag nodes from sidebar
3. Connect outputs to inputs
4. Configure each node (click to edit)
5. Test with "Run Agent"
6. Save when it works

## Scheduling (v0.1.45+)

Agents can run automatically on schedules:
1. Create agent in Agent Studio
2. Set schedule (hourly, daily, weekly)
3. Manage in Tasks tab (above Settings)
4. ClaraVerse must be running for scheduled tasks

**Common Schedules:**
- Daily email summary at 9 AM
- Weekly report generation
- Hourly data backups

## Real Use Cases

### Document Processor
```
PDF Input → Extract Text → LLM (analyze) → Structured Output → API (save to database)
```

### Content Pipeline
```
Static Prompt → LLM (generate) → ComfyUI (create image) → Combine → File Output
```

### Research Automation
```
Input Query → API (search) → LLM (summarize) → Notebook Writer
```

## Node Configuration Tips

### LLM Nodes
- **Model**: Use smaller models for simple tasks
- **Temperature**: 0.7 for creative, 0.1 for factual
- **Max Tokens**: Limit to what you need (saves time)

### API Request Node
- **Method**: GET for reading, POST for sending data
- **Headers**: Include authentication if needed
- **Timeout**: Set reasonable limits (default 30s)

### Notebook Writer
- **Notebook**: Must exist before using
- **Append vs Replace**: Choose wisely
- **Format**: Markdown recommended

## Performance Expectations

- Simple workflow (3-4 nodes): 5-10 seconds
- Complex workflow (10+ nodes): 30-60 seconds
- Image generation: 30-120 seconds depending on GPU
- API calls: Depends on external service

## Common Issues & Solutions

**Agent Won't Run**
- Check all nodes are connected
- Verify required services running (ComfyUI for image nodes)
- Look for red error indicators on nodes

**Slow Performance**
- Use smaller models where possible
- Reduce parallel API calls
- Check system resources

**Output Not As Expected**
- Test each node individually
- Check data formatting between nodes
- Verify LLM prompts are clear

## Integration with Other Features

### With Clara Assistant
Clara can trigger agents: "Run my daily summary agent"

### With N8N
- Use N8N for external integrations
- Trigger agents from N8N webhooks
- Combine for complex automations

### With Notebooks
- Read from notebooks for context
- Write results back to notebooks
- Build knowledge over time

## Limitations

1. **No Loops**: Can't do "for each" or "while" operations
2. **Memory**: Large workflows may hit memory limits
3. **Error Handling**: Limited - workflow stops on error
4. **Debugging**: No step-through debugging yet
5. **Version Control**: No built-in versioning

## Pro Tips

1. Start simple - test with 2-3 nodes first
2. Name your nodes clearly
3. Test after adding each node
4. Save working versions before major changes
5. Use Static Text nodes for prompt templates
6. Keep LLM prompts concise and specific

## Export Options

Agents can be exported as JavaScript code:
1. Settings → Export as Code
2. Select your agent
3. Get standalone JS module
4. Note: Contains API keys - backend use only

## Getting Started

1. Open Agent Studio
2. Create "Hello World" agent:
   - Static Text ("Hello")
   - Combine Text (add "World")
   - Output node
3. Run and verify output
4. Build from there

Remember: Agents are powerful but require logical thinking. Start simple, test often, and gradually increase complexity.