# ClaraVerse macOS Platform Startup Flow

## Overview
ClaraVerse on macOS runs as a native Electron desktop application with full Apple Silicon and Intel support. The application provides enhanced integration with macOS security, permissions, and performance features.

## Architecture Components

### Core Components
- **Electron Main Process** (`main.cjs`) - Native macOS desktop container
- **React Frontend** (`src/App.tsx`) - User interface with macOS styling
- **LlamaSwap Service** - Optimized llama.cpp for Apple Silicon/Intel
- **Python Backend** (`py_backend/main.py`) - RAG, TTS, STT services
- **Docker Services** - Containerized AI services (Docker Desktop required)
- **MCP Service** - Model Context Protocol for external tools
- **Watchdog Service** - System monitoring with macOS integration

### Platform-Specific Features
- **Apple Silicon Optimization** - Native ARM64 binaries with Metal acceleration
- **Intel Compatibility** - x64 binaries with AVX optimization
- **Security Integration** - Notarization, hardened runtime, entitlements
- **GPU Acceleration** - Metal Performance Shaders for Apple Silicon

## Application Startup Flow

```mermaid
graph TD
    A[Application Launch] --> B[Security Check: Notarization]
    B --> C[Permission Requests: Network/Microphone]
    C --> D{Docker Desktop Available?}
    
    D -->|Yes| E[Docker Mode Initialization]
    D -->|No| F[Prompt: Install Docker Desktop?]
    
    F -->|Install| G[Open Docker Desktop Download]
    F -->|Continue Without| H[Lightweight Mode]
    F -->|Cancel| I[Exit Application]
    
    G --> J[User Installs Docker]
    J --> E
    
    E --> K[Full Service Initialization]
    H --> L[Core Service Initialization]
    
    K --> M[Create Main Window]
    L --> M
    
    M --> N[Background Service Setup]
    N --> O[Application Ready]
```

## macOS Security & Permissions

```mermaid
graph TD
    subgraph "macOS Security Layer"
        A[App Launch] --> B[Gatekeeper Check]
        B --> C[Notarization Verification]
        C --> D[Hardened Runtime]
        D --> E[Entitlements Check]
        
        E --> F{Network Access?}
        F -->|Granted| G[Enable Network Services]
        F -->|Denied| H[Local Only Mode]
        
        E --> I{Microphone Access?}
        I -->|Granted| J[Enable Speech Recognition]
        I -->|Denied| K[Disable STT Features]
        
        G --> L[Full Functionality]
        H --> M[Limited Functionality]
    end
```

## Apple Silicon vs Intel Architecture

```mermaid
graph LR
    subgraph "Platform Detection"
        A[System Architecture] --> B{Apple Silicon?}
        B -->|Yes| C[ARM64 darwin-arm64]
        B -->|No| D[Intel x64 darwin-x64]
        
        C --> E[Metal GPU Acceleration]
        C --> F[Native ARM Binaries]
        C --> G[Enhanced Performance]
        
        D --> H[AVX Optimization]
        D --> I[Intel GPU Support]
        D --> J[Rosetta2 Compatibility]
    end
```

## Docker Mode Services (macOS)

```mermaid
graph LR
    subgraph "Docker Desktop Integration"
        A[Clara Core<br/>Native App] --> B[Docker Desktop<br/>VM Engine]
        
        B --> C[Python Backend<br/>Port 5001]
        B --> D[N8N Workflows<br/>Port 5678]
        B --> E[ComfyUI Image Gen<br/>Port 8188]
        
        C --> F[FastAPI Server<br/>LightRAG, TTS, STT]
        D --> G[Workflow Automation<br/>macOS Integrations]
        E --> H[Stable Diffusion<br/>Metal Acceleration]
    end
    
    subgraph "Native Services"
        A --> I[LlamaSwap Service<br/>Port 8091/9999]
        I --> J[Apple Silicon LLMs<br/>Metal Optimization]
    end
```

## Lightweight Mode Services (macOS)

```mermaid
graph LR
    subgraph "Native macOS Services"
        A[Clara Core<br/>Native App] --> B[LlamaSwap Service<br/>Port 8091/9999]
        A --> C[MCP Service<br/>External Tools]
        A --> D[Watchdog Service<br/>macOS Integration]
        
        B --> E[Apple Silicon LLMs<br/>Metal GPU Support]
        B --> F[Model Management<br/>Optimized Storage]
        
        C --> G[CLI Tool Integration<br/>Terminal Access]
        C --> H[Node.js Detection<br/>nvm, Homebrew]
        
        D --> I[System Monitoring<br/>macOS Notifications]
        D --> J[Auto-recovery<br/>Launch Services]
    end
```

## Detailed Startup Sequence (macOS)

```mermaid
sequenceDiagram
    participant U as User
    participant G as Gatekeeper
    participant E as Electron Main
    participant L as Loading Screen
    participant DD as Docker Desktop
    participant LS as LlamaSwap
    participant MCP as MCP Service
    participant W as Watchdog
    participant MW as Main Window
    
    U->>G: Launch Clara.app
    G->>G: Verify Notarization
    G->>E: Grant Execution
    
    E->>L: Show Loading Screen
    E->>E: Request Network Permissions
    E->>E: Check Docker Desktop
    
    alt Docker Available
        E->>DD: Check Docker Status
        DD->>DD: Start VM Engine
        E->>LS: Initialize LlamaSwap (Metal)
        E->>MCP: Initialize MCP Service
        E->>W: Initialize Watchdog (with Docker)
        
        par Docker Services
            DD->>DD: Start Python Container
            DD->>DD: Start N8N Container
            DD->>DD: Start ComfyUI Container
        end
        
    else Lightweight Mode
        E->>LS: Initialize LlamaSwap (Native)
        E->>MCP: Initialize MCP Service
        E->>W: Initialize Watchdog (Native)
    end
    
    E->>MW: Create Native Window
    MW->>MW: Load React App
    MW-->>L: DOM Ready
    L->>L: Fade Out with Animation
    MW->>U: Show Application
    
    par Background Initialization
        LS->>LS: Load Apple Silicon Models
        MCP->>MCP: Detect Node.js Tools
        W->>W: Start System Monitoring
    end
```

## macOS-Specific Binary Management

### Apple Silicon (ARM64)
```yaml
Platform: darwin-arm64
Binaries:
  - llama-swap-darwin-arm64 (Optimized for M1/M2/M3)
  - llama-server (Metal acceleration)
  - llama-cli (Native ARM performance)

Libraries:
  - *.dylib (Dynamic libraries)
  - *.metal (Metal shaders)
  - *.h (Headers for compilation)

Metal Support:
  - GPU Acceleration via Metal Performance Shaders
  - Unified Memory Architecture optimization
  - Low-power inference modes

Environment:
  DYLD_LIBRARY_PATH: /path/to/llamacpp-binaries/darwin-arm64
  METAL_DEVICE_WRAPPER_TYPE: 1
```

### Intel x64 (Legacy)
```yaml
Platform: darwin-x64
Binaries:
  - llama-swap-darwin-x64 (Intel optimization)
  - llama-server (AVX/AVX2 support)
  - llama-cli (x64 performance)

Libraries:
  - *.dylib (Intel dynamic libraries)
  - OpenCL support for discrete GPUs

Environment:
  DYLD_LIBRARY_PATH: /path/to/llamacpp-binaries/darwin-x64
  OMP_NUM_THREADS: auto (based on CPU cores)
```

## GPU Acceleration (Apple Silicon)

```mermaid
graph TD
    A[GPU Detection] --> B{Apple Silicon?}
    B -->|Yes| C[Metal Detection]
    B -->|No| D[Intel/AMD GPU]
    
    C --> E[Unified Memory Check]
    E --> F[Metal Performance Shaders]
    F --> G[Optimal GPU Layers]
    G --> H[Enhanced Performance]
    
    D --> I[OpenCL Support]
    I --> J[Discrete GPU Mode]
    J --> K[Limited Acceleration]
    
    H --> L[Low Power Mode Available]
    K --> M[Standard Performance]
```

## Service Health Monitoring (macOS)

```mermaid
graph TD
    subgraph "Watchdog Service (macOS)"
        A[NSTimer Health Check<br/>30 seconds] --> B{Check Services}
        
        B --> C[LlamaSwap<br/>Metal Status]
        B --> D[Docker Desktop<br/>VM Status]
        B --> E[Python Backend<br/>Container Health]
        B --> F[N8N Service<br/>Workflow Status]
        
        C --> G{Healthy?}
        D --> H{Healthy?}
        E --> I{Healthy?}
        F --> J{Healthy?}
        
        G -->|No| K[Restart with Metal]
        H -->|No| L[Restart Docker VM]
        I -->|No| M[Restart Container]
        J -->|No| N[Restart N8N]
        
        K --> O[NSNotification to User]
        L --> O
        M --> O
        N --> O
    end
```

## File System Structure (macOS)

```
~/Library/Application Support/Clara/   # Application data
├── llama-models/                      # Local LLM models
│   ├── *.gguf files                  # Quantized models
│   └── config.yaml                   # Model configuration
├── comfyui_models/                   # ComfyUI models
├── comfyui_output/                   # Generated images
├── n8n/                              # N8N workflow data
├── lightrag_storage/                 # RAG database
└── settings.json                     # Application settings

~/Downloads/                          # Model downloads
/Applications/Docker.app              # Docker Desktop
/tmp/clara-electron-*                 # Temporary files
```

## Docker Desktop Integration

```mermaid
graph LR
    subgraph "Docker Desktop (macOS)"
        A[Clara App] --> B[Docker Desktop]
        B --> C[Linux VM]
        
        C --> D[clara_python<br/>FastAPI]
        C --> E[clara_n8n<br/>Workflows]
        C --> F[clara_comfyui<br/>Stable Diffusion]
        
        D --> G[Port 5001<br/>localhost]
        E --> H[Port 5678<br/>localhost]
        F --> I[Port 8188<br/>localhost]
    end
    
    subgraph "Native Services"
        A --> J[LlamaSwap<br/>Metal Native]
        J --> K[Port 8091/9999<br/>localhost]
    end
```

## Networking & Security (macOS)

```mermaid
graph TD
    subgraph "macOS Network Security"
        A[Application Start] --> B[Network Permission Request]
        B --> C{User Grants Access?}
        
        C -->|Yes| D[Enable All Services]
        C -->|No| E[Local Only Mode]
        
        D --> F[LlamaSwap: localhost:8091]
        D --> G[Python Backend: localhost:5001]
        D --> H[N8N: localhost:5678]
        D --> I[ComfyUI: localhost:8188]
        
        E --> J[LlamaSwap Only]
        J --> K[No External Services]
    end
```

## App Store & Notarization

```mermaid
graph TD
    A[App Build] --> B[Code Signing]
    B --> C[Hardened Runtime]
    C --> D[Entitlements]
    D --> E[Notarization]
    E --> F[Stapling]
    F --> G[Distribution]
    
    subgraph "Required Entitlements"
        H[com.apple.security.network.client]
        I[com.apple.security.network.server]
        J[com.apple.security.device.microphone]
        K[com.apple.security.files.user-selected.read-write]
    end
    
    D --> H
    D --> I
    D --> J
    D --> K
```

## Performance Optimization (Apple Silicon)

### Memory Management
```mermaid
graph LR
    A[Unified Memory] --> B[Model Loading Strategy]
    B --> C[Memory Pressure Detection]
    C --> D[Adaptive Model Sizing]
    D --> E[Optimal Performance]
    
    F[8GB RAM] --> G[Lightweight Models]
    H[16GB+ RAM] --> I[Full-size Models]
    J[24GB+ RAM] --> K[Multiple Models]
```

### Power Management
```mermaid
graph TD
    A[Power State Detection] --> B{On Battery?}
    B -->|Yes| C[Power Saving Mode]
    B -->|No| D[Performance Mode]
    
    C --> E[Reduce GPU Layers]
    C --> F[Lower Thread Count]
    C --> G[Model Swapping]
    
    D --> H[Maximum GPU Usage]
    D --> I[Full Thread Count]
    D --> J[Keep Models in Memory]
```

## Troubleshooting (macOS)

### Common Issues

#### Docker Desktop Not Starting
1. Check macOS version compatibility (Big Sur 11.0+)
2. Verify virtualization framework access
3. Reset Docker Desktop to factory defaults
4. Check available disk space (minimum 4GB)

#### LlamaSwap Metal Issues
1. Verify Metal support: `system_profiler SPDisplaysDataType`
2. Check for Metal framework updates
3. Reset GPU preferences in Energy Saver settings
4. Update to latest macOS version

#### Permission Denied Errors
1. Open System Settings → Privacy & Security
2. Grant network access to Clara
3. Allow microphone access for STT features
4. Add Clara to Full Disk Access if needed

#### Node.js/MCP Detection Issues
1. Check PATH in Terminal: `echo $PATH`
2. Verify Node.js installation: `node --version`
3. Check nvm configuration: `nvm list`
4. Restart Terminal and retry

## Auto-Updates (macOS)

```mermaid
graph TD
    A[Auto-Update Check] --> B{New Version Available?}
    B -->|Yes| C[Download Update]
    B -->|No| D[Continue Normal Operation]
    
    C --> E[Verify Signature]
    E --> F[Install Update]
    F --> G[Restart Application]
    
    G --> H[Migration Check]
    H --> I[Update Complete]
    
    subgraph "Update Sources"
        J[GitHub Releases]
        K[Electron Updater]
        L[Code Signing Verification]
    end
    
    C --> J
    C --> K
    E --> L
```

## Summary

ClaraVerse on macOS provides a premium AI development experience with:

- **Native Performance**: Optimized for both Apple Silicon and Intel Macs
- **Security Integration**: Full notarization and sandboxing support  
- **Metal Acceleration**: GPU optimization for Apple Silicon
- **Seamless Updates**: Automatic updates with code signing verification
- **Docker Integration**: Full containerized services via Docker Desktop
- **Intelligent Fallbacks**: Graceful degradation when services are unavailable

The application leverages macOS-specific features while maintaining cross-platform compatibility, ensuring optimal performance and user experience on Apple hardware. 