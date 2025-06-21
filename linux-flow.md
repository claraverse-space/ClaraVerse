# ClaraVerse Linux Platform Startup Flow

## Overview
ClaraVerse on Linux runs as an Electron desktop application with multiple backend services. The application can operate in two modes: **Docker Mode** (full features) or **Lightweight Mode** (core features only).

## Architecture Components

### Core Components
- **Electron Main Process** (`main.cjs`) - Desktop application container
- **React Frontend** (`src/App.tsx`) - User interface (TypeScript/React)
- **LlamaSwap Service** - Local LLM model management using llama.cpp
- **Python Backend** (`py_backend/main.py`) - RAG, TTS, STT services
- **Docker Services** - Containerized AI services (optional)
- **MCP Service** - Model Context Protocol for external tools
- **Watchdog Service** - System monitoring and health checks

### Platform-Specific Binaries
- **llama.cpp binaries** in `electron/llamacpp-binaries/linux-x64/`
- **GPU Support**: CUDA 12.6 libraries for NVIDIA acceleration
- **Dynamic Libraries**: `.so` files for optimized CPU/GPU execution

## Application Startup Flow

```mermaid
graph TD
    A[Application Start] --> B{Check System Requirements}
    B --> C{Docker Available?}
    
    C -->|Yes| D[Docker Mode Initialization]
    C -->|No| E[Ask User: Start Docker?]
    
    E -->|Start Docker| F[Launch Docker Desktop]
    E -->|Continue Without| G[Lightweight Mode]
    E -->|Cancel| H[Exit Application]
    
    F --> I{Docker Started?}
    I -->|Yes| D
    I -->|No| G
    
    D --> J[Full Service Initialization]
    G --> K[Core Service Initialization]
    
    J --> L[Create Main Window]
    K --> L
    
    L --> M[Background Service Setup]
    M --> N[Application Ready]
```

## Docker Mode Services

```mermaid
graph LR
    subgraph "Docker Mode Services"
        A[Clara Core<br/>Electron App] --> B[Python Backend<br/>Port 5001]
        A --> C[N8N Workflows<br/>Port 5678]
        A --> D[ComfyUI Image Gen<br/>Port 8188]
        A --> E[LlamaSwap LLM<br/>Port 8091/9999]
        
        B --> F[FastAPI Server<br/>RAG, TTS, STT]
        C --> G[Workflow Automation<br/>1000+ Templates]
        D --> H[Stable Diffusion<br/>GPU Accelerated]
        E --> I[Local Model Management<br/>llama.cpp Engine]
    end
    
    subgraph "Docker Containers"
        J[clara_python:5001] --> B
        K[clara_n8n:5678] --> C
        L[clara_comfyui:8188] --> D
    end
```

## Lightweight Mode Services

```mermaid
graph LR
    subgraph "Lightweight Mode"
        A[Clara Core<br/>Electron App] --> B[LlamaSwap Service<br/>Port 8091/9999]
        A --> C[MCP Service<br/>External Tools]
        A --> D[Watchdog Service<br/>Health Monitoring]
        
        B --> E[Local LLM Models<br/>llama.cpp]
        C --> F[Model Context Protocol<br/>Tool Integration]
        D --> G[Service Health Checks<br/>Auto-restart]
    end
```

## Detailed Service Startup Sequence

```mermaid
sequenceDiagram
    participant U as User
    participant E as Electron Main
    participant L as Loading Screen
    participant D as Docker Setup
    participant LS as LlamaSwap
    participant MCP as MCP Service
    participant W as Watchdog
    participant MW as Main Window
    
    U->>E: Launch Application
    E->>L: Show Loading Screen
    E->>E: Check Docker Availability
    
    alt Docker Mode
        E->>D: Initialize Docker Setup
        D->>D: Pull/Start Containers
        D-->>L: Progress Updates
        E->>LS: Initialize LlamaSwap
        E->>MCP: Initialize MCP Service
        E->>W: Initialize Watchdog (with Docker)
        
        par Background Services
            D->>D: Start Python Backend
            D->>D: Start N8N Service
            D->>D: Start ComfyUI Service
        end
        
    else Lightweight Mode
        E->>LS: Initialize LlamaSwap
        E->>MCP: Initialize MCP Service
        E->>W: Initialize Watchdog (no Docker)
    end
    
    E->>MW: Create Main Window
    MW->>MW: Load React App
    MW-->>L: DOM Ready
    L->>L: Fade Out
    MW->>U: Show Application
    
    par Background Initialization
        LS->>LS: Start Model Server
        MCP->>MCP: Restore Previous Servers
        W->>W: Begin Health Monitoring
    end
```

## Linux-Specific Configuration

### Binary Management
```yaml
Platform: linux-x64
Binaries:
  - llama-swap-linux (8.6MB)
  - llama-server (4.8MB)
  - llama-cli (2.2MB)
  
Libraries:
  - libggml.so (53KB)
  - libllama.so (2.0MB)
  - libggml-cpu*.so (various CPU optimizations)
  - libggml-vulkan.so (27MB GPU acceleration)

Environment:
  LD_LIBRARY_PATH: /path/to/llamacpp-binaries/linux-x64
  CUDA_VISIBLE_DEVICES: 0 (if GPU available)
```

### GPU Acceleration
```mermaid
graph TD
    A[GPU Detection] --> B{NVIDIA GPU?}
    B -->|Yes| C[Check nvidia-smi]
    B -->|No| D[CPU-only Mode]
    
    C --> E{CUDA Libraries?}
    E -->|Yes| F[GPU Acceleration Enabled]
    E -->|No| G[Download CUDA Libraries]
    
    F --> H[Configure GPU Layers]
    G --> H
    
    H --> I[Optimal Performance]
    D --> J[CPU Fallback]
```

## Service Health Monitoring

```mermaid
graph TD
    subgraph "Watchdog Service"
        A[Health Check Timer<br/>30 seconds] --> B{Check Services}
        
        B --> C[Clara's Core<br/>LlamaSwap Health]
        B --> D[Python Backend<br/>Port 5001]
        B --> E[N8N Service<br/>Port 5678]
        B --> F[ComfyUI Service<br/>Port 8188]
        
        C --> G{Healthy?}
        D --> H{Healthy?}
        E --> I{Healthy?}
        F --> J{Healthy?}
        
        G -->|No| K[Restart LlamaSwap]
        H -->|No| L[Restart Python Container]
        I -->|No| M[Restart N8N Container]
        J -->|No| N[Restart ComfyUI Container]
        
        K --> O[Send Notification]
        L --> O
        M --> O
        N --> O
    end
```

## File System Structure

```
~/.clara/                          # User data directory
├── llama-models/                  # Local LLM models
│   ├── *.gguf files              # Quantized models
│   └── config.yaml               # Model configuration
├── comfyui_models/               # ComfyUI models
├── comfyui_output/               # Generated images
├── n8n/                          # N8N workflow data
├── lightrag_storage/             # RAG database
├── pull_timestamps.json         # Docker update tracking
└── settings.json                # Application settings

/tmp/clara-electron-*             # Temporary files
/usr/local/cuda-12.6/            # CUDA libraries (if GPU)
```

## Networking & Ports

```mermaid
graph LR
    subgraph "Internal Services"
        A[LlamaSwap: 8091] --> B[Model Proxy: 9999]
        C[Python Backend: 5001] --> D[FastAPI Server]
        E[N8N: 5678] --> F[Workflow Engine]
        G[ComfyUI: 8188] --> H[Image Generation]
    end
    
    subgraph "External Access"
        I[Main App] --> A
        I --> C
        I --> E
        I --> G
        
        J[Web Browser] --> E
        J --> G
    end
```

## Security & Permissions

```mermaid
graph TD
    A[Application Start] --> B[Check Permissions]
    B --> C{GPU Access?}
    C -->|Yes| D[Enable CUDA]
    C -->|No| E[CPU Only]
    
    B --> F{Docker Access?}
    F -->|Yes| G[Enable Container Services]
    F -->|No| H[Lightweight Mode]
    
    B --> I{Network Access?}
    I -->|Yes| J[Enable External Tools]
    I -->|No| K[Local Only]
    
    D --> L[Full GPU Acceleration]
    G --> M[Complete Feature Set]
    J --> N[MCP Integration]
```

## Error Handling & Recovery

```mermaid
graph TD
    A[Service Failure] --> B{Critical Service?}
    B -->|Yes| C[Immediate Restart]
    B -->|No| D[Scheduled Restart]
    
    C --> E{Restart Successful?}
    E -->|Yes| F[Service Restored]
    E -->|No| G[Try Alternative]
    
    D --> H[Retry After Delay]
    H --> E
    
    G --> I{Fallback Available?}
    I -->|Yes| J[Switch to Fallback]
    I -->|No| K[Disable Feature]
    
    F --> L[Log Success]
    J --> L
    K --> M[Notify User]
```

## Performance Optimization

### CPU Optimization
- **Architecture Detection**: Automatic selection of optimized binaries
- **Thread Management**: Configurable thread count based on CPU cores
- **Memory Management**: Smart allocation and garbage collection

### GPU Optimization (NVIDIA)
- **Layer Offloading**: Automatic GPU layer calculation
- **Memory Management**: VRAM usage optimization
- **Batch Processing**: Optimized batch sizes for throughput

### Storage Optimization
- **Model Caching**: Intelligent model loading/unloading
- **Temporary Cleanup**: Automatic cleanup of temporary files
- **Database Optimization**: Efficient RAG storage and retrieval

## Troubleshooting Common Issues

### GPU Not Detected
1. Check NVIDIA drivers: `nvidia-smi`
2. Verify CUDA installation: `/usr/local/cuda-12.6/`
3. Check library paths in config.yaml

### Docker Services Failing
1. Check Docker daemon: `systemctl status docker`
2. Verify container status: `docker ps -a`
3. Check port conflicts: `netstat -tulpn`

### LlamaSwap Not Starting
1. Check binary permissions: `chmod +x llama-swap-linux`
2. Verify model paths: `~/.clara/llama-models/`
3. Review logs: `~/.clara/llama-swap.log`

## Summary

ClaraVerse on Linux provides a comprehensive AI development environment with intelligent service management, automatic fallbacks, and optimized performance. The dual-mode architecture ensures both maximum functionality (Docker mode) and reliable operation (lightweight mode) based on system capabilities. 