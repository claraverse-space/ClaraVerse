# Clara First-Time Setup Feature

## Overview

Clara now includes a first-time setup flow that appears on the initial launch of the application. This feature allows users to configure Docker services (ComfyUI, n8n, TTS) during their first experience with the application.

## Features

### 🎯 **First-Time Detection**
- Automatically detects if this is the user's first launch
- Configuration stored in `clara-setup.yaml` in the user data directory
- No setup required for subsequent launches

### 🐳 **Docker Service Configuration**
- **ComfyUI**: AI Image Generation with Stable Diffusion
- **n8n**: Workflow Automation platform
- **TTS**: Text-to-Speech synthesis service

### 🎨 **User Experience**
- Beautiful, animated splash screen with setup options
- Progress indicators for each service installation
- Option to skip setup and configure later
- Graceful fallback if Docker is not available

## How It Works

### 1. **Setup Detection**
When Clara starts, it checks for the existence of `clara-setup.yaml`:
- If the file doesn't exist or `firstTimeSetup: true`, the setup flow is triggered
- If setup is complete, normal application startup continues

### 2. **Service Selection**
Users can choose which Docker services to enable:
- Each service includes a description and category badge
- Services can be enabled/disabled individually
- Docker availability is automatically detected

### 3. **Installation Process**
- Selected services are downloaded and configured automatically
- Real-time progress updates with visual indicators
- Error handling with user-friendly messages
- Background installation doesn't block the UI

### 4. **Configuration Storage**
Settings are stored in `clara-setup.yaml`:
```yaml
version: "1.0.0"
firstTimeSetup: false
dockerAvailable: true
services:
  comfyui:
    enabled: true
    autoStart: true
  n8n:
    enabled: false
    autoStart: false
  tts:
    enabled: true
    autoStart: true
userPreferences:
  theme: "default"
  language: "en"
```

## Files Modified

### Core Files
- `electron/setupConfigService.cjs` - Configuration management service
- `electron/splash.html` - Enhanced splash screen with setup UI
- `electron/splash.cjs` - Splash screen logic with setup integration
- `electron/main.cjs` - Main process integration

### Key Components

#### SetupConfigService
- Manages YAML configuration file
- Provides methods for setup state management
- Handles service configuration updates
- Includes default configuration templates

#### Enhanced Splash Screen
- Modern, responsive design with animations
- Service selection with checkboxes and descriptions
- Progress tracking with visual indicators
- Docker availability detection and warnings

## User Interface

### Setup Screen Elements
- **Welcome Message**: Friendly introduction to Clara
- **Service Options**: Checkboxes with descriptions and badges
- **Docker Warning**: Shown when Docker is not available
- **Action Buttons**: "Skip for Now" and "Continue Setup"
- **Progress Indicators**: Real-time installation progress

### Visual Design
- Gradient backgrounds with floating particles
- Smooth animations and transitions
- Responsive design for different screen sizes
- Accessibility considerations with reduced motion support

## Error Handling

- **Docker Not Available**: Graceful degradation with warning message
- **Service Installation Failures**: Individual service error states
- **Configuration Errors**: Fallback to default settings
- **Network Issues**: Retry mechanisms and user feedback

## Future Enhancements

- Additional service options (Ollama, Jupyter, etc.)
- Custom Docker image selection
- Resource allocation settings
- Import/export of configuration
- Multi-language support

## Developer Notes

### Adding New Services
To add a new service to the setup flow:

1. Update `setupConfigService.cjs` default configuration
2. Add service option to `splash.html`
3. Implement service setup in `splash.cjs`
4. Add corresponding Docker setup method

### Configuration Schema
The YAML configuration follows a structured schema for easy extension and backward compatibility.

### Testing
- Test with and without Docker installed
- Verify setup skip functionality
- Check service installation progress
- Validate configuration persistence 