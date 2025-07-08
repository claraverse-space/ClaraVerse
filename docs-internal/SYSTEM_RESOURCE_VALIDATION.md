# ClaraVerse System Resource Validation

## Overview

ClaraVerse now includes comprehensive system resource validation that automatically detects system capabilities and gracefully degrades features based on available resources. This ensures optimal performance on any system while preventing crashes due to insufficient resources.

## Implementation Status

✅ **FULLY IMPLEMENTED** - SR-001: Insufficient System Resources

**Platforms Supported**: Linux, macOS, Windows  
**Severity**: High  
**Status**: ✅ COMPLETED

## Features

### 🔍 Comprehensive Resource Detection

The system automatically detects and validates:

- **RAM**: Total, free, and used memory
- **CPU Cores**: Number of physical/logical cores and CPU model
- **Disk Space**: Total, available, and used storage
- **Platform Information**: OS type, architecture, and version
- **System Load**: Current system load averages

### 🎯 Performance Modes

Based on system resources, ClaraVerse automatically selects the optimal performance mode:

#### 1. **Full Mode** (Recommended specs met)
- **Requirements**: ≥16GB RAM, ≥8 CPU cores, ≥50GB disk space
- **Features**: All features enabled
- **Resource Limits**: Up to 3 concurrent models, 32k context size

#### 2. **Lite Mode** (Minimum specs met)
- **Requirements**: 8-15GB RAM, 4-7 CPU cores, 10-49GB disk space
- **Features**: Clara Core, N8N, Agent Studio, LumaUI enabled
- **Disabled**: Docker services, ComfyUI
- **Resource Limits**: 1 concurrent model, 8k context size

#### 3. **Core-Only Mode** (Below minimum specs)
- **Requirements**: <8GB RAM OR <4 CPU cores OR <10GB disk space
- **Features**: Only Clara Core enabled
- **Disabled**: All advanced features
- **Resource Limits**: 1 model, 4k context, CPU-only inference

### 💾 Configuration Persistence

System configuration is automatically saved to `clara-system-config.yaml` in the user data directory:

```yaml
version: 1.0.0
lastUpdated: '2025-06-20T14:03:08.000Z'
systemInfo:
  ramGB: 63
  cpuCores: 32
  platform: linux
  arch: x64
performanceMode: full
enabledFeatures:
  claraCore: true
  dockerServices: true
  comfyUI: true
  n8nWorkflows: true
  agentStudio: true
  lumaUI: true
  advancedFeatures: true
resourceLimitations:
  maxConcurrentModels: 3
  maxContextSize: 32768
```

## Implementation Details

### Core Files Modified

1. **`electron/platformManager.cjs`**
   - Added comprehensive system resource validation
   - Implemented performance mode evaluation
   - Added YAML configuration management
   - Cross-platform disk space detection

2. **`electron/main.cjs`**
   - Integrated system validation into startup process
   - Added service initialization based on resource availability
   - Added IPC handlers for system configuration access

3. **`electron/llamaSwapService.cjs`**
   - Added resource limitation application
   - Implemented feature limitation checks
   - Applied system constraints to model operations

### IPC Handlers Available

The following IPC handlers are available for the renderer process:

```javascript
// Get current system configuration
const config = await window.electronAPI.invoke('get-system-config');

// Refresh system configuration
const refreshed = await window.electronAPI.invoke('refresh-system-config');

// Check if a feature is supported
const supported = await window.electronAPI.invoke('check-feature-requirements', 'comfyUI');

// Get performance mode info
const mode = await window.electronAPI.invoke('get-performance-mode');
```

## System Requirements

### Minimum Requirements
- **RAM**: 8GB
- **CPU**: 4 cores
- **Disk Space**: 10GB available
- **OS**: Windows 10+, macOS 10.15+, or Linux

### Recommended Requirements
- **RAM**: 16GB or more
- **CPU**: 8 cores or more
- **Disk Space**: 50GB or more available
- **GPU**: NVIDIA GPU with 8GB+ VRAM (optional)

## Feature Availability Matrix

| Feature | Full Mode | Lite Mode | Core-Only Mode |
|---------|-----------|-----------|----------------|
| Clara Core | ✅ | ✅ | ✅ |
| Docker Services | ✅ | ❌ | ❌ |
| ComfyUI | ✅ | ❌ | ❌ |
| N8N Workflows | ✅ | ✅ | ❌ |
| Agent Studio | ✅ | ✅ | ❌ |
| LumaUI | ✅ | ✅ | ❌ |
| Advanced Features | ✅ | ❌ | ❌ |

## User Experience

### Startup Process

1. **System Detection**: ClaraVerse automatically scans system resources
2. **Mode Selection**: Performance mode is automatically determined
3. **Service Initialization**: Only supported services are started
4. **User Notification**: Clear feedback about available features

### Visual Feedback

- **Loading Screen**: Shows system validation progress
- **Performance Mode**: Clearly indicates current mode
- **Feature Availability**: UI elements reflect available features
- **Resource Warnings**: Helpful recommendations for system upgrades

### Example Startup Messages

```
🔍 Validating system resources...
✅ System resources validated - Full feature mode available
💾 RAM: 32GB (Required: 8GB)
🖥️  CPU Cores: 16 (Required: 4)
💽 Available Disk Space: 120GB (Required: 10GB)
🎯 System Performance Mode: full
```

## Configuration File Location

System configuration is stored at:
- **Windows**: `%APPDATA%/ClaraVerse/clara-system-config.yaml`
- **macOS**: `~/Library/Application Support/ClaraVerse/clara-system-config.yaml`
- **Linux**: `~/.config/ClaraVerse/clara-system-config.yaml`

## Advanced Configuration

### Manual Override (Advanced Users)

You can manually edit the configuration file to override automatic detection:

```yaml
# Override performance mode (not recommended)
performanceMode: lite  # or 'full', 'core-only'

# Override specific features
enabledFeatures:
  dockerServices: false  # Force disable Docker services
  comfyUI: true         # Force enable ComfyUI (if supported)
```

**⚠️ Warning**: Manual overrides can cause stability issues if your system doesn't meet the requirements.

## Troubleshooting

### Common Issues

1. **Configuration Not Loading**
   - Check file permissions in user data directory
   - Ensure YAML syntax is valid
   - Delete config file to regenerate

2. **Incorrect Resource Detection**
   - Refresh system configuration
   - Check system monitor for actual resource usage
   - Report issue with system specifications

3. **Features Not Available**
   - Check performance mode in configuration
   - Verify system meets minimum requirements
   - Close other resource-intensive applications

### Debug Information

Enable detailed logging by setting environment variable:
```bash
export ELECTRON_LOG_LEVEL=debug
```

## Benefits

✅ **Prevents Application Crashes**: Automatically prevents overloading low-spec systems  
✅ **Optimal Performance**: Tailors resource usage to system capabilities  
✅ **Better User Experience**: Clear feedback about available features  
✅ **Graceful Degradation**: Maintains core functionality on all systems  
✅ **Automatic Configuration**: No manual setup required  
✅ **Persistent Settings**: Configuration survives application restarts  

## Future Enhancements

- [ ] GPU detection and VRAM analysis
- [ ] Dynamic resource monitoring during runtime
- [ ] User-configurable performance thresholds
- [ ] Resource usage analytics and recommendations
- [ ] Integration with system performance monitoring

---

**Implementation Complete**: All SR-001 requirements have been fully implemented and tested. ClaraVerse now provides robust system resource validation with graceful degradation for optimal performance on any system. 