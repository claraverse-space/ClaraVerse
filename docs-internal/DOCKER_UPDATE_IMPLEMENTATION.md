# Docker Container Update System Implementation

## Overview

This implementation adds comprehensive container update checking and architecture-aware image pulling to ClaraVerse. The system automatically detects your system architecture and pulls the correct container images, while providing user-friendly update prompts during startup.

## Key Features

### 🏗️ Architecture Detection
- **Automatic Detection**: Detects system platform and architecture (e.g., `darwin/arm64`, `linux/amd64`)
- **Multi-arch Support**: Pulls correct images for Apple Silicon, Intel, ARM, etc.
- **Platform Mapping**: Maps Node.js architecture to Docker platform specifications

### 🔄 Update Checking
- **Startup Checks**: Automatically checks for container updates during app startup
- **Manual Checks**: Users can manually check for updates anytime
- **Smart Detection**: Compares local images with remote registry to detect updates
- **Progress Tracking**: Real-time progress updates during image pulls

### 🎯 User Experience
- **Update Dialog**: Shows available updates with clear descriptions
- **User Choice**: Users can choose to update now, skip, or cancel
- **Progress Feedback**: Visual progress indicators during downloads
- **Architecture Display**: Shows which architecture images are being pulled

## Implementation Details

### Core Files Modified

#### 1. `electron/dockerSetup.cjs`
**New Methods Added:**
- `getSystemArchitecture()` - Detects and maps system architecture
- `getArchSpecificImage()` - Returns architecture-specific image names
- `checkForImageUpdates()` - Checks if container images have updates
- `showUpdateDialog()` - Shows user-friendly update dialog
- `pullImageWithProgress()` - Pulls images with progress tracking
- `checkForUpdates()` - Manual update check API
- `updateContainers()` - Update specific containers

**Enhanced Methods:**
- `setup()` - Now includes update checking workflow
- `pullImage()` - Uses architecture-aware pulling
- `startContainer()` - Uses architecture-specific image pulling

#### 2. `electron/main.cjs`
**New IPC Handlers:**
- `docker-check-updates` - Check for container updates
- `docker-update-containers` - Update specific containers
- `docker-get-system-info` - Get system architecture info

#### 3. `electron/preload.cjs`
**New API Methods:**
- `checkDockerUpdates()` - Check for updates from renderer
- `updateDockerContainers()` - Update containers from renderer
- `getSystemInfo()` - Get system info from renderer

#### 4. `src/components/DockerUpdateManager.tsx`
**React Component Features:**
- System information display
- Update checking interface
- Progress tracking
- Individual and bulk container updates

## Usage Examples

### Automatic Startup Updates
```javascript
// During app startup, the system automatically:
// 1. Detects architecture (e.g., darwin/arm64)
// 2. Checks for container updates
// 3. Shows dialog if updates available
// 4. Pulls updated images if user agrees
```

### Manual Update Check
```javascript
// From React component
const checkUpdates = async () => {
  try {
    const updateInfo = await window.electron.checkDockerUpdates();
    if (updateInfo.updatesAvailable) {
      // Show update UI
    }
  } catch (error) {
    console.error('Update check failed:', error);
  }
};
```

### Update Specific Containers
```javascript
// Update only specific containers
await window.electron.updateDockerContainers(['python', 'n8n']);

// Update all containers
await window.electron.updateDockerContainers();
```

## Architecture Support

### Supported Platforms
- **macOS**: `darwin/arm64` (Apple Silicon), `darwin/amd64` (Intel)
- **Windows**: `windows/amd64`
- **Linux**: `linux/amd64`, `linux/arm64`, `linux/arm/v7`

### Container Images
- **Clara Backend**: `clara17verse/clara-backend:latest`
- **N8N**: `n8nio/n8n:latest`

Both images support multi-architecture and will automatically pull the correct variant.

## User Workflow

### Startup Process
1. **App Starts** → Loading screen appears
2. **Docker Check** → Verifies Docker is running
3. **Architecture Detection** → Detects system architecture
4. **Update Check** → Checks for container updates
5. **User Dialog** → Shows update dialog if updates available
6. **User Choice**:
   - **Update Now** → Downloads and installs updates
   - **Skip Updates** → Continues with existing containers
   - **Cancel** → Exits setup (app continues without Docker)
7. **Container Start** → Starts containers with latest images

### Manual Update Process
1. **Open Docker Manager** → Navigate to Docker settings/manager
2. **Check Updates** → Click "Check for Updates" button
3. **Review Updates** → See which containers have updates
4. **Update Choice**:
   - **Update All** → Updates all containers at once
   - **Update Individual** → Update specific containers
5. **Progress Tracking** → Watch real-time update progress
6. **Completion** → Containers restart with new versions

## Error Handling

### Common Scenarios
- **Docker Not Running**: Graceful fallback, app continues without Docker
- **Network Issues**: Retry logic with user feedback
- **Update Failures**: Individual container update failures don't block others
- **Architecture Mismatch**: Automatic platform specification prevents issues

### User Feedback
- **Progress Messages**: Real-time status updates during operations
- **Error Messages**: Clear, actionable error descriptions
- **Success Confirmation**: Visual confirmation when updates complete

## Configuration

### Environment Variables
```bash
# Skip Docker setup entirely (for CI/build environments)
SKIP_DOCKER_SETUP=true
```

### Container Configuration
```javascript
// In dockerSetup.cjs
this.containers = {
  python: {
    name: 'clara_python',
    image: this.getArchSpecificImage('clara17verse/clara-backend', 'latest'),
    // ... other config
  }
};
```

## Benefits

### For Users
- **Automatic Updates**: No manual container management needed
- **Architecture Awareness**: Always get the right images for your system
- **User Control**: Choose when to update with clear information
- **Progress Visibility**: See exactly what's happening during updates

### For Developers
- **Maintainable**: Clean separation of concerns
- **Extensible**: Easy to add new containers or update logic
- **Debuggable**: Comprehensive logging and error handling
- **Cross-platform**: Works consistently across all supported platforms

## Future Enhancements

### Potential Improvements
- **Update Scheduling**: Allow users to schedule automatic updates
- **Rollback Support**: Ability to rollback to previous container versions
- **Update Notifications**: Background update checking with notifications
- **Bandwidth Management**: Throttle download speeds for large updates
- **Delta Updates**: Only download changed layers for faster updates

### Integration Opportunities
- **Settings UI**: Add update preferences to main settings
- **Dashboard Widget**: Show update status in main dashboard
- **Notification System**: Integrate with app notification system
- **Health Monitoring**: Combine with container health monitoring

## Testing

### Test Scenarios
1. **Fresh Install**: No local images, should download all
2. **Up-to-date System**: No updates available, should skip gracefully
3. **Mixed Updates**: Some containers need updates, others don't
4. **Network Failure**: Handle network issues during update check/download
5. **User Cancellation**: Respect user choice to skip or cancel
6. **Architecture Variants**: Test on different system architectures

### Manual Testing
```bash
# Force update check
docker rmi clara17verse/clara-backend:latest
# Restart app - should detect missing image and offer to download

# Test architecture detection
# Check logs for "Detected system architecture: platform/arch"

# Test update dialog
# Modify image locally to trigger update detection
```

This implementation provides a robust, user-friendly container update system that handles the complexity of multi-architecture Docker environments while giving users full control over when and how updates are applied. 