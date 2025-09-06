---
title: "ImageGen"
description: "AI image generation with ComfyUI"
category: "features"
order: 7
lastUpdated: "2025-09-06"
contributors: ["badboysm890"]
---

# ImageGen

<img src="https://raw.githubusercontent.com/badboysm890/ClaraVerse/203bdcbe08ee6644378e1fc4cfcb88b0c6dc95f4/public/mascot/ImageGen.png" alt="Clara creating AI-generated images" width="400" />

ImageGen is basically a wrapper around ComfyUI that makes AI image generation incredibly simple and accessible.

## What You Get

ImageGen brings the power of ComfyUI directly into ClaraVerse without the usual setup headaches. Whether you're creating art, designing concepts, or generating visual content for your projects, ImageGen has you covered.

## Windows CUDA Container

If you're on Windows, you're in luck! We provide a ready-to-go container with Windows CUDA support. This means:

- **One-click setup**: Download and you're ready to generate images
- **Optimized performance**: Built specifically for Windows with CUDA acceleration
- **No configuration hassles**: Everything works out of the box
- **Full feature access**: All the power of ComfyUI without the complexity

## Bring Your Own ComfyUI

Not using Windows or prefer your own setup? No problem! You can always bring your own ComfyUI instance:

- **Use your existing setup**: Connect to your current ComfyUI installation
- **Custom configurations**: Keep your preferred models and workflows
- **Flexible deployment**: Local, remote, or cloud instances all work
- **Easy integration**: Just modify the settings to point to your ComfyUI endpoint

## How to Get Started

**Option 1: Use Our Container (Windows)**
1. Download the Windows CUDA container from the interface
2. Let it install and configure automatically
3. Start generating images immediately

**Option 2: Connect Your Own ComfyUI**
1. Make sure your ComfyUI instance is running
2. Go to Settings in ClaraVerse
3. Update the ComfyUI endpoint URL
4. Test the connection and you're good to go

## Two UI Options

You get to choose how you want to create images:

### Clara's Simple UI
Perfect for getting started and everyday use:
- **Basic controls**: Model selection, LoRA, and essential settings
- **Smart prompting**: Uses Clara Core to enhance your prompts automatically
- **Built-in gallery**: Store and organize all your generated images
- **Beginner-friendly**: Clean interface that doesn't overwhelm

### ComfyUI Interface
For power users who want full control:
- **Advanced workflows**: Build complex generation pipelines
- **Complete customization**: Access every parameter and node
- **Professional features**: Perfect for heavy workflow users
- **Full ComfyUI power**: Everything you love about ComfyUI, integrated

## Model Manager

When you use our packaged container, you get access to a powerful model manager:

### Direct Downloads from CivitAI
- **Browse and download**: Get models directly from CivitAI without leaving ClaraVerse
- **Automatic installation**: Models are installed and ready to use immediately
- **Community models**: Access thousands of community-created models

### NSFW Content Access
- **API key required**: Add your CivitAI API key in settings to download uncensored models
- **Age verification**: Respects CivitAI's content policies
- **Optional feature**: Only needed if you want access to mature content

### Settings & Management
The ImageGen settings give you complete control:
- **Model management**: Add, remove, and organize your models
- **Storage options**: Choose where to store downloaded models
- **Performance tuning**: Adjust settings for your hardware
- **Connection settings**: Configure ComfyUI endpoints

## Known Issues & Tips

### LoRA Limitations
- **Don't overload**: Adding too many LoRAs can cause stability issues
- **Start simple**: Use 1-2 LoRAs at first, then experiment
- **Monitor performance**: Watch for memory issues with multiple LoRAs

### Flux Model Compatibility
- **No LoRA support**: Flux models don't work with LoRAs currently
- **Use base models**: Stick to base Flux models without LoRA combinations
- **Future updates**: We're working on better Flux integration

## Integration with Clara

ImageGen works seamlessly with other ClaraVerse features:

- **Clara Assistant**: Ask Clara to generate images through natural conversation
- **Agents**: Use the ComfyUI node in your automated workflows
- **File handling**: Generated images integrate with your project files
- **Batch processing**: Generate multiple images through agent workflows

## What Makes It Special

Unlike standalone ComfyUI setups, ImageGen gives you:

- **Visual integration**: Images appear directly in your ClaraVerse interface
- **Workflow automation**: Generate images as part of larger processes
- **Easy sharing**: Generated content integrates with your projects
- **No terminal commands**: Everything happens through the UI

Ready to create some amazing images? Download the container or connect your ComfyUI instance and start generating!
