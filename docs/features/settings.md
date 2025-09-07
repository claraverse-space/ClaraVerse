---
title: "Settings"
description: "Complete control center for your ClaraVerse workspace"
category: "features"
order: 8
lastUpdated: "2025-09-06"
contributors: ["badboysm890"]
---

<img src="https://raw.githubusercontent.com/badboysm890/ClaraVerse/935d0659b468f2d896f7acf2878725c35500cbe6/public/mascot/Settings.png" alt="Clara managing settings and configurations" width="400" />

# Settings

Central configuration for all ClaraVerse components.

## Overview

Settings controls everything: AI providers, local models, services, and system configuration. Most issues can be fixed here.

## Main Sections

### AI Services

Configure AI providers (local and cloud):

**Adding Providers:**
```
1. Click "Add Provider"
2. Choose type:
   - OpenAI (needs API key)
   - Anthropic/Claude (needs API key)
   - Ollama (local, no key)
   - Custom OpenAI-compatible
3. Test connection
4. Set as primary if desired
```

**Provider Priority:**
- Primary: Used by default
- Secondary: Fallback options
- Specific: Some features need specific providers

**Cost Management:**
- Local (Ollama, Clara Core): Free
- Cloud: Pay per token
- Track usage in provider dashboards

### Local Models

Manage models for Clara Core and Ollama:

**Clara Core Models:**
```
Recommended:
- JanNano128K-4B (starter, 3GB)
- GPT-OSS-20B (balanced, 12GB)
- SeedOSS-ByteDance-36B (best, 20GB)
```

**Download Process:**
1. Select model
2. Check storage space
3. Download (can take 10-60 minutes)
4. Auto-configures when complete

**GPU Diagnostics:**
Shows:
- GPU model and VRAM
- Current usage
- Recommended models for your hardware

### Services

Control Docker containers and background services:

**Core Services:**
- **Clara Core**: LLM engine (required)
- **N8N**: Workflow automation
- **Python Backend**: For notebooks/RAG
- **ComfyUI**: Image generation
- **LlamaSwap**: Model management

**Service Management:**
```bash
# Each service shows:
Status: Running/Stopped
Port: Default port
Actions: Start/Stop/Restart
Logs: View output
```

**Common Issues:**
- Port conflicts: Change ports in advanced settings
- Memory issues: Stop unused services
- Docker not running: Start Docker first

### Preferences

Personalization options:

**Appearance:**
- Theme: Light/Dark/System
- Wallpapers: Custom backgrounds
- Font size: Accessibility

**Behavior:**
- Auto-save: Interval in seconds
- Notifications: Enable/disable
- Timezone: For scheduling

**Privacy:**
- Telemetry: Always off (local-first)
- Data retention: How long to keep logs
- Export data: Backup everything

### Profile

Your information for Clara's context:

**Personal Info:**
```
Name: Used in conversations
Bio: Background for context
Preferences: Coding style, tools
```

**Usage Stats:**
- Messages sent
- Images generated
- Workflows created
- Storage used

### Updates

Keep ClaraVerse current:

**Auto-Update Check:**
- Checks daily for new versions
- Shows changelog
- One-click update

**Component Updates:**
- ClaraVerse main app
- Llama.cpp engine
- Docker containers
- Model updates

**Alpha Features:**
Enable experimental features (may be unstable)

### Export as Code

Convert agent workflows to JavaScript:

**Process:**
1. Select agent workflow
2. Choose export format:
   - JavaScript module
   - TypeScript
   - Clara Flow SDK
3. Configure options
4. Generate code

**Warning:** Exported code contains API keys - backend use only!

**Use Cases:**
- Deploy workflows as microservices
- Integrate with existing systems
- Share workflows (remove keys first)

## Quick Setup Guide

### First Time Setup
```
1. Start Docker
2. Go to Services → Start Clara Core
3. Go to Local Models → Download JanNano128K-4B
4. Go to AI Services → Set Clara Core as primary
5. Test in Clara Assistant
```

### For Power Users
```
1. Add cloud provider (OpenAI/Claude)
2. Download larger models (20B+)
3. Start all services
4. Enable alpha features
```

### For Privacy-First Users
```
1. Only use local models
2. Disable all telemetry
3. Run everything offline
4. Regular data exports for backup
```

## Performance Tuning

### Memory Management
```
Light use (8GB RAM):
- Run only Clara Core
- Use 4B models
- Stop unused services

Heavy use (32GB+ RAM):
- Run all services
- Use large models
- Multiple containers
```

### GPU Optimization
```
Check GPU diagnostics for:
- VRAM available
- Recommended model size
- Current utilization
```

## Troubleshooting

### Service Won't Start
```bash
# Check Docker
docker ps

# Check ports
netstat -an | grep PORT_NUMBER

# View logs
docker logs SERVICE_NAME
```

### Model Download Fails
- Check disk space (need 2x model size)
- Verify internet connection
- Try different download source
- Clear cache and retry

### API Provider Issues
- Test connection button
- Verify API key is correct
- Check billing/credits
- Try different endpoint

## Data Storage

### Where Everything Lives
```
Browser Storage:
- Settings
- Chat history
- Notebooks metadata

Docker Volumes:
- Models
- RAG embeddings
- Service data

Local Filesystem:
- Downloaded models
- Exported data
- Backups
```

### Backup Strategy
```bash
# Export from Settings
Settings → Preferences → Export Data

# Backup Docker volumes
docker cp claraverse:/data ./backup

# Save browser data
Browser DevTools → Application → Storage
```

## Security Considerations

- **API Keys**: Stored encrypted in browser
- **Local Models**: No data leaves machine
- **Docker**: Isolated containers
- **Network**: Services bind to localhost only

## Common Configurations

### Offline Setup
```
1. Download all models while online
2. Disable update checks
3. Use only local providers
4. Works completely offline
```

### Hybrid Setup
```
1. Local models for privacy
2. Cloud for complex tasks
3. Switch as needed
4. Best of both worlds
```

### Team Setup
```
1. Shared N8N instance
2. Common model repository
3. Exported workflows
4. Standardized configuration
```

## Pro Tips

1. **Start minimal** - Add services as needed
2. **Monitor resources** - Use task manager
3. **Regular backups** - Export weekly
4. **Test providers** - Before important work
5. **Update regularly** - But backup first

Remember: Settings is where you fix problems and optimize performance. When something doesn't work, check here first.