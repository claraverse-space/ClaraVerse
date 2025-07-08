# ComfyUI Integration for ClaraVerse

ClaraVerse now includes a fully integrated ComfyUI instance that runs locally in a Docker container, providing powerful image generation capabilities with complete privacy and control.

## 🎨 Features

### **Bundled ComfyUI Container**
- **Complete ComfyUI Installation**: Latest ComfyUI with all essential dependencies
- **Custom Nodes Included**: ComfyUI-Manager, ControlNet Auxiliary, Essentials, Custom Scripts
- **GPU/CPU Support**: Automatic detection and optimization for both GPU and CPU systems
- **Model Management**: Pre-configured paths for checkpoints, LoRAs, VAEs, ControlNet models
- **Easy Management**: Built-in UI for starting, stopping, and monitoring ComfyUI

### **Clara Integration**
- **Seamless Connection**: ImageGen component automatically detects and connects to bundled ComfyUI
- **Fallback Support**: Falls back to user-configured external ComfyUI if bundled version unavailable
- **Management Interface**: ComfyUI Manager accessible through Image Generation page
- **Health Monitoring**: Real-time status checking and container management

## 🚀 Quick Start

### **1. Build ComfyUI Image**

**Windows:**
```bash
.\scripts\build-comfyui.bat
```

**Linux/macOS:**
```bash
./scripts/build-comfyui.sh
```

### **2. Start Clara**
When you start ClaraVerse, the ComfyUI container will be automatically detected and started when you access the Image Generation page.

### **3. Access ComfyUI Manager**
- Go to **Image Generation** page
- Click the **"ComfyUI Manager"** button in the header
- Start/stop ComfyUI, view logs, and manage models

## 🔧 Technical Details

### **Docker Image: `clara17verse/clara-comfyui:with-custom-nodes`**
- **Base**: Ubuntu 22.04
- **Size**: ~13.6GB (includes PyTorch, ComfyUI, and custom nodes)
- **Python**: 3.10.12
- **PyTorch**: CPU version (upgrades to CUDA if GPU available)

### **Container Configuration**
```yaml
Container Name: clara_comfyui
Port: 8188
Volumes: /app/ComfyUI/models (for model storage)
Health Check: HTTP check on port 8188
Auto-restart: Yes
```

### **Included Custom Nodes**
1. **ComfyUI-Manager**: Easy installation and management of additional nodes
2. **ControlNet Auxiliary**: Advanced ControlNet preprocessing
3. **ComfyUI Essentials**: Essential utility nodes
4. **Custom Scripts**: Additional workflow enhancements

### **Model Paths**
```
/app/ComfyUI/models/
├── checkpoints/     # Stable Diffusion models
├── vae/            # VAE models
├── loras/          # LoRA models
├── controlnet/     # ControlNet models
├── clip/           # CLIP models
├── unet/           # UNet models
├── upscale_models/ # Upscaling models
├── embeddings/     # Text embeddings
└── hypernetworks/  # Hypernetwork models
```

## 🎯 Usage

### **Image Generation Integration**
The ImageGen component automatically:
1. **Detects** bundled ComfyUI container
2. **Starts** container if not running
3. **Connects** using ComfyUI client library
4. **Falls back** to user-configured external ComfyUI if needed

### **ComfyUI Manager Features**
- **Container Control**: Start, stop, restart ComfyUI
- **Status Monitoring**: Real-time status, GPU support, memory usage
- **Model Management**: View installed models by type
- **Custom Nodes**: Manage and install additional nodes
- **Logs**: View container logs for debugging
- **Direct Access**: Open ComfyUI web interface in new tab

### **Model Management**
- **Automatic Detection**: Models are automatically detected when placed in model directories
- **Type Classification**: Models are categorized by type (checkpoint, LoRA, VAE, etc.)
- **Size Information**: File sizes displayed for storage management
- **Format Support**: SafeTensors and Pickle formats supported

## 🔄 GPU vs CPU Mode

### **GPU Mode (Automatic)**
- **Detection**: Automatically detects NVIDIA GPU with `nvidia-smi`
- **PyTorch**: Upgrades to CUDA-enabled PyTorch
- **Performance**: Significantly faster image generation
- **Memory**: Uses GPU VRAM for model loading

### **CPU Mode (Fallback)**
- **Activation**: Automatically enabled when no GPU detected
- **PyTorch**: Uses CPU-optimized PyTorch
- **Performance**: Slower but functional image generation
- **Memory**: Uses system RAM for model loading

## 🛠️ Advanced Configuration

### **Environment Variables**
```bash
CUDA_VISIBLE_DEVICES=0    # GPU selection (GPU mode)
COMFYUI_ARGS=--cpu        # Force CPU mode
```

### **Custom Model Installation**
1. **Access Container**: `docker exec -it clara_comfyui bash`
2. **Navigate to Models**: `cd /app/ComfyUI/models/checkpoints`
3. **Download Models**: Use `wget` or copy files
4. **Restart ComfyUI**: Models will be automatically detected

### **Volume Mounting (Optional)**
```bash
docker run -d \
  --name clara_comfyui \
  -p 8188:8188 \
  -v /path/to/models:/app/ComfyUI/models \
  clara17verse/clara-comfyui:with-custom-nodes
```

## 🐛 Troubleshooting

### **Container Won't Start**
```bash
# Check Docker status
docker ps -a

# View container logs
docker logs clara_comfyui

# Restart container
docker restart clara_comfyui
```

### **ComfyUI Not Accessible**
1. **Check Port**: Ensure port 8188 is not in use
2. **Firewall**: Check firewall settings for port 8188
3. **Container Status**: Verify container is running and healthy
4. **Logs**: Check container logs for startup errors

### **GPU Not Detected**
1. **NVIDIA Drivers**: Ensure NVIDIA drivers are installed
2. **Docker GPU Support**: Install `nvidia-docker2`
3. **Container Runtime**: Use `--gpus all` flag when running manually

### **Models Not Loading**
1. **File Permissions**: Ensure model files have correct permissions
2. **File Format**: Use SafeTensors format when possible
3. **File Location**: Verify models are in correct directories
4. **Container Restart**: Restart container after adding models

## 📊 Performance Tips

### **For GPU Systems**
- **Use CUDA**: Ensure GPU mode is enabled
- **Model Format**: Prefer SafeTensors over Pickle
- **Memory Management**: Monitor GPU VRAM usage
- **Batch Size**: Adjust based on available VRAM

### **For CPU Systems**
- **Memory**: Ensure sufficient RAM (8GB+ recommended)
- **Patience**: CPU generation takes significantly longer
- **Model Size**: Use smaller models for better performance
- **Concurrent Tasks**: Avoid running other intensive tasks

## 🔗 Integration with Clara

### **ImageGen Component**
- **Auto-Detection**: Automatically finds and uses bundled ComfyUI
- **Seamless Switching**: Falls back to external ComfyUI if needed
- **Model Sync**: Automatically syncs available models
- **Error Handling**: Graceful error handling and user feedback

### **Settings Integration**
- **Provider Selection**: ComfyUI appears as image generation provider
- **Model Selection**: Available models populated from ComfyUI API
- **Configuration**: Settings stored in Clara's database

### **Future Enhancements**
- **Model Download**: Direct model downloading through Clara UI
- **Workflow Templates**: Pre-built ComfyUI workflows
- **Batch Processing**: Queue multiple image generations
- **Cloud Sync**: Optional cloud model synchronization

## 📝 API Reference

### **Electron IPC Methods**
```typescript
// ComfyUI status
window.electronAPI.comfyuiStatus(): Promise<{
  running: boolean;
  port?: number;
  containerName?: string;
  error?: string;
}>

// Container control
window.electronAPI.comfyuiStart(): Promise<{ success: boolean; error?: string }>
window.electronAPI.comfyuiStop(): Promise<{ success: boolean; error?: string }>
window.electronAPI.comfyuiRestart(): Promise<{ success: boolean; error?: string }>

// Logs
window.electronAPI.comfyuiLogs(): Promise<{ 
  success: boolean; 
  logs?: string; 
  error?: string 
}>
```

### **ComfyUI API Endpoints**
```
GET  http://localhost:8188/           # Web interface
GET  http://localhost:8188/system_stats # System information
GET  http://localhost:8188/object_info  # Available models and nodes
POST http://localhost:8188/prompt       # Queue generation
GET  http://localhost:8188/queue        # Queue status
```

## 🎉 Success!

You now have a fully integrated ComfyUI instance running within ClaraVerse! This provides:

- **Complete Privacy**: All image generation happens locally
- **No Dependencies**: No need to install ComfyUI separately
- **Easy Management**: Built-in UI for all ComfyUI operations
- **Seamless Integration**: Works perfectly with Clara's ImageGen component
- **Extensible**: Easy to add custom nodes and models

Enjoy creating amazing images with your local ComfyUI setup! 🎨✨ 