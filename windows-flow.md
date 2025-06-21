# ClaraVerse Windows Platform Startup Flow

## Overview
ClaraVerse on Windows runs as a native desktop application with enhanced Windows integration. The application provides comprehensive support for Windows-specific features including Docker Desktop, Windows Services, and GPU acceleration.

## Architecture Components

### Core Components
- **Electron Main Process** (`main.cjs`) - Windows desktop application container
- **React Frontend** (`src/App.tsx`) - User interface with Windows theming
- **LlamaSwap Service** - Local LLM management with Windows optimization
- **Python Backend** (`py_backend/main.py`) - RAG, TTS, STT services
- **Docker Desktop Integration** - Containerized AI services (WSL2 backend)
- **MCP Service** - Model Context Protocol for external tools
- **Watchdog Service** - System monitoring with Windows services integration

### Platform-Specific Features
- **Windows Services Integration** - Background service management
- **WSL2 Support** - Docker backend via Windows Subsystem for Linux
- **GPU Acceleration** - NVIDIA CUDA and DirectX support
- **Windows Registry Integration** - System settings and startup management
- **PowerShell Integration** - Administrative operations and service management

## Application Startup Flow

```mermaid
graph TD
    A[Application Launch] --> B[Windows Security Check]
    B --> C[Administrator Rights Check]
    C --> D{Docker Desktop Available?}
    
    D -->|Yes| E[Check WSL2 Status]
    D -->|No| F[Prompt: Install Docker Desktop?]
    
    E --> G{WSL2 Running?}
    G -->|Yes| H[Docker Mode Initialization]
    G -->|No| I[Start WSL2 Engine]
    
    F -->|Install| J[Download Docker Desktop]
    F -->|Continue Without| K[Lightweight Mode]
    F -->|Cancel| L[Exit Application]
    
    I --> H
    J --> M[User Installs Docker]
    M --> H
    
    H --> N[Full Service Initialization]
    K --> O[Core Service Initialization]
    
    N --> P[Create Main Window]
    O --> P
    
    P --> Q[Background Service Setup]
    Q --> R[Application Ready]
```

## Windows Security & Permissions

```mermaid
graph TD
    subgraph "Windows Security Layer"
        A[App Launch] --> B[Windows Defender Check]
        B --> C[User Account Control]
        C --> D[Execution Policy Check]
        D --> E[Firewall Configuration]
        
        E --> F{Network Access?}
        F -->|Granted| G[Enable Network Services]
        F -->|Blocked| H[Local Only Mode]
        
        E --> I{Admin Rights?}
        I -->|Granted| J[Full System Access]
        I -->|Denied| K[Limited User Mode]
        
        G --> L[Full Functionality]
        H --> M[Limited Functionality]
    end
```

## Docker Desktop Integration (Windows)

```mermaid
graph LR
    subgraph "Docker Desktop (Windows)"
        A[Clara App] --> B[Docker Desktop]
        B --> C[WSL2 Backend]
        
        C --> D[Linux Containers]
        D --> E[clara_python<br/>Port 5001]
        D --> F[clara_n8n<br/>Port 5678]
        D --> G[clara_comfyui<br/>Port 8188]
        
        E --> H[FastAPI Server<br/>RAG, TTS, STT]
        F --> I[Workflow Automation<br/>Windows Integration]
        G --> J[Stable Diffusion<br/>CUDA Acceleration]
    end
    
    subgraph "Native Windows Services"
        A --> K[LlamaSwap Service<br/>Port 8091/9999]
        K --> L[Windows Native LLMs<br/>CUDA Support]
    end
```

## Lightweight Mode Services (Windows)

```mermaid
graph LR
    subgraph "Native Windows Services"
        A[Clara Core<br/>Win32 App] --> B[LlamaSwap Service<br/>Port 8091/9999]
        A --> C[MCP Service<br/>External Tools]
        A --> D[Watchdog Service<br/>Windows Integration]
        
        B --> E[Local LLM Models<br/>CUDA Acceleration]
        B --> F[Model Management<br/>Registry Storage]
        
        C --> G[PowerShell Integration<br/>CLI Tools]
        C --> H[Node.js Detection<br/>chocolatey, npm]
        
        D --> I[Windows Event Log<br/>Service Monitoring]
        D --> J[Auto-recovery<br/>Service Restart]
    end
```

## Windows-Specific Service Management

```mermaid
graph TD
    subgraph "Service Management"
        A[Application Start] --> B[Check Running Services]
        B --> C{Docker Service?}
        C -->|Running| D[Docker Mode]
        C -->|Stopped| E[Start Docker Service]
        
        E --> F{Start Successful?}
        F -->|Yes| D
        F -->|No| G[Lightweight Mode]
        
        D --> H[Initialize All Services]
        G --> I[Initialize Core Services]
        
        H --> J[Background Monitoring]
        I --> J
    end
```

## Detailed Startup Sequence (Windows)

```mermaid
sequenceDiagram
    participant U as User
    participant UAC as User Account Control
    participant E as Electron Main
    participant L as Loading Screen
    participant WSL as WSL2
    participant DD as Docker Desktop
    participant LS as LlamaSwap
    participant MCP as MCP Service
    participant W as Watchdog
    participant MW as Main Window
    
    U->>UAC: Launch Clara.exe
    UAC->>UAC: Check Admin Rights
    UAC->>E: Grant Execution
    
    E->>L: Show Loading Screen
    E->>E: Check Windows Firewall
    E->>E: Check Docker Desktop
    
    alt Docker Mode
        E->>DD: Check Docker Status
        DD->>WSL: Check WSL2 Backend
        WSL->>WSL: Start Linux Kernel
        E->>LS: Initialize LlamaSwap (CUDA)
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
    
    E->>MW: Create Windows Window
    MW->>MW: Load React App
    MW-->>L: DOM Ready
    L->>L: Fade Out
    MW->>U: Show Application
    
    par Background Initialization
        LS->>LS: Load CUDA Models
        MCP->>MCP: Detect Windows Tools
        W->>W: Start Event Monitoring
    end
```

## Windows-Specific Binary Management

### Platform Configuration
```yaml
Platform: win32-x64
Binaries:
  - llama-swap-win32-x64.exe (Windows executable)
  - llama-server.exe (CUDA optimized)
  - llama-cli.exe (Console interface)

Libraries:
  - *.dll (Dynamic Link Libraries)
  - CUDA runtime libraries
  - DirectX dependencies

GPU Support:
  - NVIDIA CUDA 12.6 runtime
  - DirectX 12 acceleration
  - Windows GPU scheduling

Environment:
  PATH: %USERPROFILE%\.clara\llamacpp-binaries\win32-x64
  CUDA_PATH: C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v12.6
```

### Registry Integration
```mermaid
graph TD
    A[Application Start] --> B[Read Registry Settings]
    B --> C[HKEY_CURRENT_USER\Software\Clara]
    C --> D[Startup Settings]
    C --> E[Model Paths]
    C --> F[Service Configuration]
    
    D --> G[Auto-start with Windows]
    E --> H[Custom Model Locations]
    F --> I[Service Port Configuration]
```

## GPU Acceleration (Windows)

```mermaid
graph TD
    A[GPU Detection] --> B{NVIDIA GPU?}
    B -->|Yes| C[Check CUDA Installation]
    B -->|No| D[DirectX Fallback]
    
    C --> E{CUDA Available?}
    E -->|Yes| F[CUDA Acceleration]
    E -->|No| G[Install CUDA Runtime]
    
    F --> H[Optimal GPU Performance]
    G --> I[Download CUDA 12.6]
    I --> F
    
    D --> J[DirectX 12 Support]
    J --> K[Limited GPU Acceleration]
    
    H --> L[Configure GPU Layers]
    K --> M[Basic GPU Features]
```

## Service Health Monitoring (Windows)

```mermaid
graph TD
    subgraph "Watchdog Service (Windows)"
        A[Windows Timer<br/>30 seconds] --> B{Check Services}
        
        B --> C[LlamaSwap<br/>Process Status]
        B --> D[Docker Desktop<br/>Service Status]
        B --> E[WSL2<br/>Kernel Status]
        B --> F[Container Health<br/>via Docker API]
        
        C --> G{Healthy?}
        D --> H{Healthy?}
        E --> I{Healthy?}
        F --> J{Healthy?}
        
        G -->|No| K[Restart Process]
        H -->|No| L[Restart Docker Service]
        I -->|No| M[Restart WSL2]
        J -->|No| N[Restart Containers]
        
        K --> O[Windows Event Log]
        L --> O
        M --> O
        N --> O
    end
```

## File System Structure (Windows)

```
%USERPROFILE%\.clara\                 # User data directory
├── llama-models\                     # Local LLM models
│   ├── *.gguf files                 # Quantized models
│   └── config.yaml                  # Model configuration
├── comfyui_models\                  # ComfyUI models
├── comfyui_output\                  # Generated images
├── n8n\                             # N8N workflow data
├── lightrag_storage\                # RAG database
├── pull_timestamps.json            # Docker update tracking
└── settings.json                   # Application settings

%TEMP%\clara-electron-*              # Temporary files
%PROGRAMFILES%\NVIDIA GPU Computing Toolkit\CUDA\v12.6\  # CUDA
%PROGRAMDATA%\Docker\               # Docker Desktop data
```

## WSL2 Integration

```mermaid
graph LR
    subgraph "WSL2 Integration"
        A[Windows Host] --> B[WSL2 Kernel]
        B --> C[Linux Environment]
        
        C --> D[Docker Engine]
        D --> E[Container Runtime]
        
        E --> F[Python Backend]
        E --> G[N8N Service]
        E --> H[ComfyUI Service]
        
        F --> I[\\wsl$\docker-desktop-data]
        G --> I
        H --> I
    end
    
    subgraph "Windows Services"
        A --> J[LlamaSwap.exe]
        J --> K[Native Performance]
    end
```

## PowerShell Integration

```mermaid
graph TD
    A[MCP Service] --> B[PowerShell Detection]
    B --> C{PowerShell Available?}
    
    C -->|Yes| D[Enable PowerShell Tools]
    C -->|No| E[Download PowerShell Core]
    
    D --> F[Administrative Commands]
    D --> G[System Information]
    D --> H[Service Management]
    
    E --> I[Install PowerShell 7+]
    I --> D
    
    F --> J[Docker Management]
    G --> K[Hardware Detection]
    H --> L[Restart Services]
```

## Networking & Security (Windows)

```mermaid
graph TD
    subgraph "Windows Network Security"
        A[Application Start] --> B[Windows Firewall Check]
        B --> C{Firewall Rules?}
        
        C -->|Configured| D[Enable All Services]
        C -->|Blocked| E[Create Firewall Rules]
        
        E --> F{Admin Rights?}
        F -->|Yes| G[Auto-configure Firewall]
        F -->|No| H[Manual Configuration]
        
        D --> I[LlamaSwap: localhost:8091]
        D --> J[Python Backend: localhost:5001]
        D --> K[N8N: localhost:5678]
        D --> L[ComfyUI: localhost:8188]
        
        G --> D
        H --> M[Limited Access]
    end
```

## Auto-Updates (Windows)

```mermaid
graph TD
    A[Auto-Update Check] --> B{New Version Available?}
    B -->|Yes| C[Download Update]
    B -->|No| D[Continue Normal Operation]
    
    C --> E[Verify Digital Signature]
    E --> F[Install Update (.exe)]
    F --> G[Registry Update]
    G --> H[Restart Application]
    
    H --> I[Migration Check]
    I --> J[Update Complete]
    
    subgraph "Update Sources"
        K[GitHub Releases]
        L[Electron Updater]
        M[Windows Code Signing]
    end
    
    C --> K
    C --> L
    E --> M
```

## Windows Services Integration

```mermaid
graph TD
    subgraph "Service Installation"
        A[Admin Installation] --> B[Register Windows Service]
        B --> C[Service Control Manager]
        C --> D[Clara Background Service]
        
        D --> E[Auto-start with Windows]
        D --> F[Background Model Loading]
        D --> G[System Tray Integration]
        
        E --> H[Boot-time Service]
        F --> I[Pre-warmed Models]
        G --> J[Always Available]
    end
```

## Error Handling & Recovery (Windows)

```mermaid
graph TD
    A[Service Failure] --> B{Critical Service?}
    B -->|Yes| C[Immediate Restart]
    B -->|No| D[Scheduled Restart]
    
    C --> E{Restart Successful?}
    E -->|Yes| F[Service Restored]
    E -->|No| G[Event Log Entry]
    
    D --> H[Retry After Delay]
    H --> E
    
    G --> I{Admin Rights?}
    I -->|Yes| J[Reinstall Service]
    I -->|No| K[User Notification]
    
    F --> L[Log Success]
    J --> L
    K --> M[Request Admin Access]
```

## Performance Optimization (Windows)

### CPU Optimization
```mermaid
graph LR
    A[CPU Detection] --> B[Architecture Check]
    B --> C{AVX Support?}
    C -->|Yes| D[AVX Optimization]
    C -->|No| E[SSE Fallback]
    
    D --> F[High Performance]
    E --> G[Basic Performance]
    
    H[Thread Count] --> I[CPU Cores * 0.75]
    I --> J[Optimal Threading]
```

### Memory Management
```mermaid
graph TD
    A[Memory Detection] --> B[Available RAM Check]
    B --> C{RAM Amount?}
    
    C -->|8GB| D[Conservative Models]
    C -->|16GB| E[Standard Models]
    C -->|32GB+| F[Large Models]
    
    D --> G[4GB Model Limit]
    E --> H[8GB Model Limit]
    F --> I[No Model Limits]
```

## Troubleshooting (Windows)

### Common Issues

#### Docker Desktop Not Starting
1. Check Windows version (Windows 10 2004+ or Windows 11)
2. Enable WSL2: `wsl --install`
3. Enable Hyper-V: `Enable-WindowsOptionalFeature -Online -FeatureName Microsoft-Hyper-V -All`
4. Check BIOS virtualization settings

#### CUDA Not Detected
1. Install NVIDIA drivers: Download from nvidia.com
2. Install CUDA Toolkit 12.6: `winget install NVIDIA.CUDA`
3. Verify installation: `nvcc --version`
4. Check PATH environment variable

#### Permission Denied Errors
1. Run as Administrator: Right-click → "Run as administrator"
2. Check Windows Firewall settings
3. Verify antivirus exclusions
4. Add Clara to Windows Defender exclusions

#### PowerShell Execution Policy
1. Open PowerShell as Administrator
2. Set execution policy: `Set-ExecutionPolicy RemoteSigned`
3. Verify: `Get-ExecutionPolicy`
4. Restart application

#### WSL2 Issues
1. Update WSL: `wsl --update`
2. Check WSL status: `wsl --status`
3. Restart WSL: `wsl --shutdown` then restart
4. Check Windows version compatibility

## Windows Registry Configuration

```mermaid
graph TD
    A[Registry Configuration] --> B[HKEY_CURRENT_USER\Software\Clara]
    B --> C[Installation Settings]
    B --> D[User Preferences]
    B --> E[Service Configuration]
    
    C --> F[InstallPath: %LOCALAPPDATA%\Clara]
    C --> G[Version: Current Version]
    C --> H[UpdateChannel: stable/beta]
    
    D --> I[AutoStart: true/false]
    D --> J[MinimizeToTray: true/false]
    D --> K[CheckUpdates: true/false]
    
    E --> L[ModelPath: Custom model directory]
    E --> M[ServicePorts: Port configurations]
    E --> N[GPUAcceleration: true/false]
```

## System Requirements

### Minimum Requirements
- **OS**: Windows 10 version 2004 (Build 19041) or Windows 11
- **CPU**: Intel i5-8th gen / AMD Ryzen 5 2600 or equivalent
- **RAM**: 8GB RAM (16GB recommended)
- **Storage**: 10GB free space (50GB for full Docker mode)
- **GPU**: Optional NVIDIA GTX 1060 or newer for acceleration

### Recommended Requirements
- **OS**: Windows 11 with latest updates
- **CPU**: Intel i7-10th gen / AMD Ryzen 7 3700X or newer
- **RAM**: 16GB+ RAM (32GB for large models)
- **Storage**: SSD with 100GB+ free space
- **GPU**: NVIDIA RTX 3070 or newer with 8GB+ VRAM

## Summary

ClaraVerse on Windows provides a comprehensive AI development platform with:

- **Native Windows Integration**: Full support for Windows services, registry, and system features
- **Docker Desktop Support**: Complete containerized services via WSL2 backend
- **CUDA Acceleration**: Optimized NVIDIA GPU support for maximum performance
- **PowerShell Integration**: Administrative and system management capabilities
- **Enterprise Features**: Windows service installation, registry management, and enterprise deployment
- **Robust Error Handling**: Comprehensive error recovery and system integration

The Windows implementation prioritizes performance, security, and enterprise compatibility while maintaining the full feature set across both lightweight and Docker deployment modes. 