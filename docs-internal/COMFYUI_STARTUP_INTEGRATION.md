# ComfyUI Startup Integration with Clara

This document explains how ComfyUI is integrated with Clara's startup process and how the UI reflects the service status.

## 🚀 Automatic Startup Process

### **1. Clara Startup Sequence**
When Clara starts, the following happens automatically:

1. **Docker Setup Initialization**: `dockerSetup.cjs` initializes with ComfyUI container configuration
2. **Watchdog Service Start**: `watchdogService.cjs` begins monitoring all services including ComfyUI
3. **Container Auto-Start**: ComfyUI container starts automatically if Docker is available
4. **Health Monitoring**: Continuous health checks every 30 seconds

### **2. ComfyUI Container Configuration**
```javascript
comfyui: {
  name: 'clara_comfyui',
  image: 'clara17verse/clara-comfyui:with-custom-nodes',
  port: 8188,
  internalPort: 8188,
  healthCheck: () => this.isComfyUIRunning(),
  volumes: [
    '${appDataPath}/comfyui:/app/ComfyUI',
    '${appDataPath}/comfyui_models:/app/ComfyUI/models',
    '${appDataPath}/comfyui_output:/app/ComfyUI/output',
    '${appDataPath}/comfyui_input:/app/ComfyUI/input',
    '${appDataPath}/comfyui_custom_nodes:/app/ComfyUI/custom_nodes'
  ],
  environment: [
    'NVIDIA_VISIBLE_DEVICES=all',
    'CUDA_VISIBLE_DEVICES=0'
  ],
  runtime: 'nvidia', // GPU support if available
  restartPolicy: 'unless-stopped'
}
```

## 🎯 UI Status Integration

### **Sidebar Status Indicators**

The **Image Gen** menu item in the sidebar shows real-time ComfyUI status:

#### **Status States:**
- **🟡 Starting** (Yellow dot, pulsing): ComfyUI container is starting or unhealthy
- **🟢 Ready** (Green dot, solid): ComfyUI is healthy and ready for image generation
- **⚫ Disabled** (Greyed out): ComfyUI is not available or failed

#### **Visual Indicators:**
```typescript
// Collapsed sidebar: Colored dot indicator
{item.id === 'image-gen' && item.status === 'starting' && (
  <div className="absolute -top-1 -right-1 w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
)}
{item.id === 'image-gen' && item.status === 'ready' && (
  <div className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full"></div>
)}

// Expanded sidebar: Text indicator
{item.id === 'image-gen' && isExpanded && (
  <span className={`ml-2 text-xs font-medium ${
    item.status === 'ready' ? 'text-green-500' : 'text-yellow-500'
  }`}>
    {item.status === 'ready' ? '●' : '○'}
  </span>
)}
```

### **Menu Item Behavior:**
- **Enabled**: When ComfyUI is healthy, clicking "Image Gen" navigates to image generation
- **Disabled**: When ComfyUI is not ready, the menu item is greyed out and non-clickable

## 🔄 Health Monitoring System

### **Watchdog Service Integration**
ComfyUI is monitored by Clara's watchdog service:

```javascript
comfyui: {
  name: 'ComfyUI Image Generation',
  status: 'unknown',
  lastCheck: null,
  failureCount: 0,
  isRetrying: false,
  healthCheck: () => this.checkComfyUIHealth(),
  restart: () => this.restartComfyUIService()
}
```

### **Health Check Process:**
1. **HTTP Check**: Verifies ComfyUI web interface responds on port 8188
2. **Container Status**: Checks Docker container is running
3. **Service Response**: Validates ComfyUI API endpoints are accessible

### **Auto-Recovery:**
- **Failure Detection**: Watchdog detects when ComfyUI becomes unhealthy
- **Automatic Restart**: Attempts to restart the container up to 3 times
- **User Notification**: Shows system notifications for service status changes
- **Silent Recovery**: After max notification attempts, works silently to avoid spam

## 📡 IPC Communication

### **Frontend ↔ Backend Communication**
The frontend communicates with ComfyUI through Electron IPC:

```typescript
// Get overall services status (including ComfyUI)
window.electronAPI.getServicesStatus(): Promise<{
  services: {
    comfyui: {
      name: string;
      status: 'healthy' | 'unhealthy' | 'failed' | 'unknown';
      lastCheck: Date | null;
      failureCount: number;
      isRetrying: boolean;
    };
  };
  overallHealth: 'healthy' | 'degraded' | 'critical';
}>

// ComfyUI-specific controls
window.electronAPI.comfyuiStatus()    // Get current status
window.electronAPI.comfyuiStart()     // Start container
window.electronAPI.comfyuiStop()      // Stop container
window.electronAPI.comfyuiRestart()   // Restart container
window.electronAPI.comfyuiLogs()      // Get container logs
```

### **Status Update Frequency:**
- **Sidebar Updates**: Every 30 seconds
- **Watchdog Checks**: Every 30 seconds
- **Manual Refresh**: Available through ComfyUI Manager

## 🛠️ Troubleshooting Integration

### **Common Scenarios:**

#### **1. ComfyUI Shows "Starting" Indefinitely**
- **Cause**: Container failed to start or is unhealthy
- **Check**: View container logs via ComfyUI Manager
- **Solution**: Restart container or check Docker resources

#### **2. Image Gen Menu Stays Greyed Out**
- **Cause**: Health check failing or watchdog not detecting ComfyUI
- **Check**: Verify container is running: `docker ps | grep clara_comfyui`
- **Solution**: Manually restart via ComfyUI Manager

#### **3. Status Not Updating**
- **Cause**: IPC communication issue or watchdog stopped
- **Check**: Browser console for errors
- **Solution**: Restart Clara application

### **Debug Information:**
```bash
# Check container status
docker ps -a | grep clara_comfyui

# View container logs
docker logs clara_comfyui

# Check if ComfyUI is responding
curl http://localhost:8188/

# View Clara logs
# Check electron-log output in app data directory
```

## 🎯 User Experience Flow

### **Typical Startup Experience:**
1. **Clara Launches**: User starts Clara application
2. **Sidebar Shows Starting**: Image Gen shows yellow pulsing dot
3. **Container Starts**: ComfyUI container begins startup (10-30 seconds)
4. **Health Check Passes**: Watchdog detects ComfyUI is healthy
5. **UI Updates**: Image Gen shows green dot and becomes clickable
6. **Ready for Use**: User can access image generation features

### **Expected Timing:**
- **Fast Systems**: 10-15 seconds from Clara start to ComfyUI ready
- **Slower Systems**: 30-60 seconds depending on Docker and system resources
- **First Run**: Additional time for image download if not cached

This integration provides a seamless experience where users can see exactly when ComfyUI is ready for use, without needing to manually start services or guess when they're available. 