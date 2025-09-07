---
title: "ImageGen"
description: "Professional AI image generation without the subscription trap"
category: "features"
order: 7
lastUpdated: "2025-09-06"
contributors: ["badboysm890"]
---

<img src="https://raw.githubusercontent.com/badboysm890/ClaraVerse/203bdcbe08ee6644378e1fc4cfcb88b0c6dc95f4/public/mascot/ImageGen.png" alt="Clara creating AI-generated images" width="400" />

# ImageGen

Local AI image generation using ComfyUI.

## What ImageGen Is

ImageGen wraps ComfyUI (the standard for local Stable Diffusion) into ClaraVerse. Generate unlimited images on your hardware with no credits or subscriptions.

## System Requirements

- **Minimum**: 4GB VRAM GPU
- **Recommended**: 8GB+ VRAM GPU  
- **Storage**: 10-50GB for models
- **RAM**: 16GB recommended

Without GPU: Possible but extremely slow (2-10 minutes per image)

## Setup Options

### Option 1: Windows CUDA Container
Easiest setup for Windows users with NVIDIA GPUs:
1. Download container from ClaraVerse
2. Auto-installs with CUDA support
3. Includes basic models
4. Ready to use

### Option 2: Bring Your Own ComfyUI
Already have ComfyUI? Just point ClaraVerse to it:
```
Settings → ImageGen → ComfyUI URL
Default: http://localhost:8188
```

### Option 3: Manual Setup
Install ComfyUI yourself and configure.

## Two Interfaces

### Simple UI (Clara's Interface)
Best for quick generation:
- Model selection dropdown
- Basic LoRA support
- Prompt enhancement via Clara
- Built-in gallery
- Batch generation

### ComfyUI Interface
Full ComfyUI power:
- Complex workflows
- All parameters exposed
- Custom nodes
- Advanced techniques

## Models

### Getting Models

**From CivitAI:**
1. Browse models in Model Manager
2. Click download
3. Auto-installs to correct folder

**NSFW Models:**
- Need CivitAI API key
- Add in Settings → ImageGen
- Respects age verification

**Manual Installation:**
```
Place models in:
ComfyUI/models/checkpoints/
```

### Recommended Models

**For Beginners:**
- SD 1.5 base (fast, reliable)
- DreamShaper (good all-around)

**For Quality:**
- SDXL models (need 8GB+ VRAM)
- Juggernaut XL

**For Speed:**
- LCM models (5-10 steps)
- Turbo models

## Common Workflows

### Basic Generation
```
1. Select model
2. Enter prompt
3. Click generate
4. Wait 20-60 seconds
5. Image appears in gallery
```

### With LoRA
```
1. Download LoRA model
2. Select in LoRA dropdown
3. Adjust weight (0.5-1.0)
4. Generate as normal
```

### Batch Generation
```
Simple UI:
- Set batch count
- Generates variations

ComfyUI:
- Use batch nodes
- More control
```

## Clara Integration

### Natural Language
```
You: "Generate a sunset over mountains"
Clara: [Enhances prompt, triggers generation]
```

### In Agent Workflows
```
Text Input → LLM (create prompt) → 
ComfyUI Node → Image Output
```

## Performance

### Generation Times (512x512)
- **4GB VRAM**: 30-60 seconds
- **8GB VRAM**: 15-30 seconds
- **12GB+ VRAM**: 10-20 seconds

### VRAM Usage
- **SD 1.5**: 3-4GB
- **SDXL**: 6-8GB
- **With LoRAs**: +0.5-1GB each

## Common Issues

### Out of Memory (VRAM)
```
Solutions:
1. Use smaller models (SD 1.5 instead of SDXL)
2. Reduce batch size to 1
3. Lower resolution
4. Close other GPU applications
```

### LoRA Problems
```
Issues:
- Too many LoRAs = crashes
- Incompatible LoRAs = artifacts
- High weights = distorted images

Fix:
- Use 1-2 LoRAs max
- Keep weights under 1.0
- Match LoRA to base model version
```

### Flux Models
```
Known issue: LoRAs don't work with Flux
Workaround: Use Flux without LoRAs
Status: Fix in development
```

### Slow Generation
```
Check:
1. GPU being used (not CPU)
2. Model size appropriate for VRAM
3. No other GPU tasks running
4. Sampling steps (20-30 is enough)
```

## Quality Tips

### Better Prompts
```
Good: "photograph of mountain landscape at golden hour, 
       professional photography, high detail"

Bad: "mountain"
```

### Negative Prompts
```
Always include: "low quality, blurry, distorted, 
                deformed, ugly, bad anatomy"
```

### Settings
- **Steps**: 20-30 (more isn't always better)
- **CFG Scale**: 6-8 (too high = fried)
- **Sampler**: DPM++ 2M Karras (reliable)

## Advanced Features

### Custom Workflows
In ComfyUI interface:
- Build complex pipelines
- Save/load workflows
- Share with community

### Upscaling
```
Generate at 512x512 → Upscale to 2048x2048
Saves VRAM, improves quality
```

### Img2Img
```
Upload image → Modify with prompt
Great for variations
```

## Storage Management

Models take space:
- **SD 1.5 models**: 2-4GB each
- **SDXL models**: 6-7GB each
- **LoRAs**: 10-200MB each

Clean up:
```
Settings → ImageGen → Manage Models
Delete unused models
```

## Integration Examples

### Content Pipeline
```
Notebook (article) → Clara (extract key points) → 
ImageGen (create illustrations) → Save to project
```

### Social Media Automation
```
Agent scheduled daily:
Generate prompt → Create image → 
Post to social platforms
```

### Design Variations
```
Upload logo → Generate variations → 
Save best to gallery
```

## Limitations

1. **Hardware Dependent**: Quality/speed depends on GPU
2. **Model Size**: Good models are large (2-7GB)
3. **Learning Curve**: ComfyUI can be complex
4. **VRAM Limits**: Bigger isn't always possible
5. **Consistency**: Hard to get exact same image twice

## Getting Started

1. Ensure GPU drivers updated
2. Download SD 1.5 model (start small)
3. Try simple prompt: "cat sitting on desk"
4. Experiment with settings
5. Download LoRAs for style
6. Try ComfyUI interface for advanced work

## Pro Tips

1. **Start with SD 1.5** - Faster and easier
2. **Learn prompting** - Makes huge difference
3. **Save good prompts** - Reuse what works
4. **Batch generate** - Then pick best
5. **Use Clara** - For prompt enhancement
6. **Monitor VRAM** - Stay within limits

Remember: Local generation means no censorship, no credits, no limits - but requires patience and good hardware.