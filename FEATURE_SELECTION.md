# ClaraVerse Feature Selection System

## Overview

The Feature Selection System allows users to choose which ClaraVerse features they want to enable during their first launch. This is a one-time setup that optimizes resource usage by only initializing selected services.

## How It Works

### 1. First-Time Launch Detection
- On the very first launch, before the splash screen appears
- A feature selection window is displayed
- User selections are saved to `clara-features.yaml` in the user data directory

### 2. Feature Selection Screen
The system presents four main feature categories:

#### **🤖 Clara Core** (Always Enabled)
- Core AI assistant functionality
- LlamaSwap service for local model management
- Basic chat and AI capabilities

#### **🎨 ComfyUI - Image Generation**
- Local Stable Diffusion image generation
- Advanced workflow-based image creation
- GPU-accelerated processing (when available)

#### **🔄 N8N - Workflow Automation**
- Visual workflow builder
- 1000+ integration nodes
- Webhook and API automation

#### **🧠 RAG & TTS - Advanced AI**
- Retrieval Augmented Generation (RAG)
- Text-to-Speech capabilities
- Document processing and embeddings
- Python backend services

### 3. Service Initialization
Based on user selections, only the chosen services are:
- Downloaded (if not already present)
- Initialized during startup
- Monitored by the watchdog service

## Technical Implementation

### Files Created
- **`electron/featureSelection.cjs`** - Main feature selection screen component
- **`electron/featureSelection.html`** - UI for the feature selection screen

### Files Modified
- **`electron/main.cjs`** - Integration with startup sequence
- **`electron/dockerSetup.cjs`** - Container filtering based on selections
- **`electron/watchdogService.cjs`** - Service monitoring based on selections

### Configuration File
**Location:** `{userData}/clara-features.yaml`

**Structure:**
```yaml
version: 1.0.0
firstTimeSetup: false
selectedFeatures:
  comfyUI: true
  n8n: true
  ragAndTts: true
  claraCore: true  # Always true
setupTimestamp: '2024-06-25T03:47:19.885Z'
```

## User Experience

### Startup Flow
1. **First Launch:** Feature Selection Screen → Splash Screen → Main Window
2. **Subsequent Launches:** Splash Screen → Main Window

### Feature Selection UI
- **Modern Design:** Gradient background with card-based selection
- **Clear Descriptions:** Each feature explains its purpose and resource requirements
- **Visual Feedback:** Hover effects and selection states
- **Continue Button:** Saves selections and proceeds to normal startup

### Benefits
- **Faster Startup:** Only selected services are initialized
- **Resource Optimization:** Reduced memory and CPU usage
- **Customizable Experience:** Users only get features they want
- **One-Time Setup:** Configuration persists across app restarts

## Service Mapping

| Feature | Docker Services | Watchdog Monitoring |
|---------|----------------|-------------------|
| Clara Core | - | ✅ Clara's Core |
| RAG & TTS | `python` | ✅ Python Backend |
| N8N | `n8n` | ✅ N8N Workflow Engine |
| ComfyUI | `comfyui` | ✅ ComfyUI Image Generation |

## Development Notes

### Testing
Run the configuration test:
```bash
node -e "
const yaml = require('js-yaml');
const fs = require('fs');
const config = {
  version: '1.0.0',
  firstTimeSetup: false,
  selectedFeatures: { comfyUI: false, n8n: true, ragAndTts: true, claraCore: true },
  setupTimestamp: new Date().toISOString()
};
console.log('YAML Output:');
console.log(yaml.dump(config));
"
```

### Resetting Configuration
To force the feature selection screen to appear again:
```javascript
// In renderer process
window.electronAPI.resetFeatureConfig();
```

### Getting Current Configuration
```javascript
// In renderer process
const config = await window.electronAPI.getFeatureConfig();
console.log('Selected features:', config.selectedFeatures);
```

## Future Enhancements

1. **Settings Integration:** Allow users to modify feature selections from the settings panel
2. **Resource Estimation:** Show estimated disk space and memory usage for each feature
3. **Dependency Management:** Automatic handling of feature dependencies
4. **Progressive Download:** Download services on-demand when first accessed
5. **Usage Analytics:** Track which features are most commonly selected

## Troubleshooting

### Feature Selection Screen Not Appearing
- Check if `clara-features.yaml` exists in user data directory
- Delete the file to force feature selection on next launch

### Services Not Starting
- Verify feature selections in the YAML configuration
- Check Docker Desktop is running (for Docker-based features)
- Review application logs for initialization errors

### Configuration Issues
- Ensure `js-yaml` package is available
- Verify file permissions in user data directory
- Check for YAML syntax errors in configuration file 