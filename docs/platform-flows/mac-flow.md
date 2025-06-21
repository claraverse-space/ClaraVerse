# ClaraVerse macOS Platform Startup Flow

## Overview

ClaraVerse on macOS leverages Apple's unified architecture with optimizations for both Apple Silicon (M-series) and Intel processors. The macOS version includes specialized Metal GPU acceleration and tight integration with macOS security features.

## System Architecture

```mermaid
graph TB
    subgraph "macOS System Environment"
        subgraph "Hardware Layer"
            CPU[CPU: Apple Silicon M-series / Intel x64]
            GPU[GPU: Apple Silicon Unified Memory / Intel+AMD]
            MEM[Unified Memory / DDR4-DDR5]
            STORAGE[Storage: ~/Library/Application Support/clara-verse/]
        end
        
        subgraph "macOS System Services"
            LAUNCHD[LaunchD Services]
            DOCKER[Docker Desktop for Mac]
            METAL[Metal GPU Framework]
            SECURITY[macOS Security Layer]
        end
        
        subgraph "ClaraVerse Application"
            ELECTRON[Electron Main Process]
            REACT[React Frontend UI]
            SERVICES[Background Services]
        end
    end
    
    CPU --> ELECTRON
    GPU --> METAL
    METAL --> SERVICES
    DOCKER --> SERVICES
    SECURITY --> ELECTRON
    ELECTRON --> REACT
    ELECTRON --> SERVICES
```

## Platform Detection & Binary Selection

```mermaid
flowchart TD
    START[Application Start]
    
    START --> PLATFORM_DETECT[Detect macOS Platform]
    PLATFORM_DETECT --> ARCH_CHECK{Architecture?}
    
    ARCH_CHECK -->|arm64| APPLE_SILICON[Apple Silicon M-series]
    ARCH_CHECK -->|x64| INTEL_MAC[Intel Mac]
    
    APPLE_SILICON --> M_BINARY[Load darwin-arm64 binaries]
    INTEL_MAC --> INTEL_BINARY[Load darwin-x64 binaries]
    
    M_BINARY --> M_OPTIMIZE[Enable Metal Acceleration]
    INTEL_BINARY --> INTEL_OPTIMIZE[Enable AVX Optimization]
    
    M_OPTIMIZE --> SECURITY_CHECK[macOS Security Validation]
    INTEL_OPTIMIZE --> SECURITY_CHECK
    
    SECURITY_CHECK --> GATEKEEPER{Gatekeeper Check}
    GATEKEEPER -->|Approved| NOTARIZATION{Notarization Check}
    GATEKEEPER -->|Blocked| SECURITY_PROMPT[Security Prompt]
    
    SECURITY_PROMPT --> USER_ALLOW{User Allows?}
    USER_ALLOW -->|Yes| NOTARIZATION
    USER_ALLOW -->|No| SECURITY_ERROR[Security Error]
    
    NOTARIZATION -->|Valid| CONTINUE[Continue Startup]
    NOTARIZATION -->|Invalid| SECURITY_WARNING[Security Warning]
    
    SECURITY_WARNING --> CONTINUE
    CONTINUE --> SERVICE_INIT[Initialize Services]
```

## Startup Sequence Flow

```mermaid
sequenceDiagram
    participant User
    participant Electron as Electron Main
    participant Security as macOS Security
    participant Docker as Docker Desktop
    participant LlamaSwap as LlamaSwap Service
    participant PyBackend as Python Backend
    participant N8N as N8N Service
    participant ComfyUI as ComfyUI Service
    participant Watchdog as Watchdog Service
    participant MCP as MCP Service
    participant Frontend as React UI

    User->>Electron: Launch Application (Double-click/Spotlight)
    
    Note over Security: Phase 1: macOS Security Validation
    Electron->>Security: Gatekeeper Security Check
    Security->>Security: Validate Code Signature
    Security->>Security: Check Notarization
    alt Security Approved
        Security-->>Electron: Launch Approved
    else Security Blocked
        Security-->>User: Security Warning Dialog
        User->>Security: User Override (System Preferences)
        Security-->>Electron: Launch Approved
    end
    
    Note over Electron: Phase 2: Platform & Hardware Detection
    Electron->>Electron: Detect Platform (darwin-arm64/darwin-x64)
    Electron->>Electron: Hardware Capabilities (Metal/OpenGL)
    Electron->>Electron: Memory Configuration (Unified/Discrete)
    Electron->>Electron: Display Loading Screen
    
    Note over Electron: Phase 3: Docker Desktop Detection
    Electron->>Docker: Check Docker Desktop Status
    alt Docker Desktop Running
        Docker-->>Electron: Available (VM Engine)
        Electron->>Electron: Full Docker Mode
    else Docker Desktop Not Running
        Electron->>Docker: Attempt Docker Desktop Start
        alt Auto-start Success
            Docker-->>Electron: Docker Started
            Electron->>Electron: Full Docker Mode
        else Auto-start Failed
            Electron->>Electron: Lightweight Mode
        end
    end
    
    Note over Electron: Phase 4: Native Services Initialization
    par Background Service Startup
        Electron->>LlamaSwap: Initialize LlamaSwap Service
        alt Apple Silicon
            LlamaSwap->>LlamaSwap: Load Metal Acceleration
            LlamaSwap->>LlamaSwap: Configure Unified Memory
        else Intel Mac
            LlamaSwap->>LlamaSwap: Load AVX Optimization
            LlamaSwap->>LlamaSwap: Configure Discrete Memory
        end
        LlamaSwap->>LlamaSwap: Start on Port 8091
        LlamaSwap-->>Electron: Service Ready
    and
        Electron->>Watchdog: Initialize Watchdog Service
        Watchdog->>Watchdog: Start Process Monitoring
        Watchdog-->>Electron: Monitoring Active
    and
        Electron->>MCP: Initialize MCP Service
        MCP->>MCP: Start Model Context Protocol
        MCP-->>Electron: MCP Ready
    end
    
    Note over Electron: Phase 5: Docker Services (If Available)
    alt Docker Mode
        Electron->>Docker: Start clara_python container
        Docker->>PyBackend: Container Start (Port 5001)
        PyBackend->>PyBackend: Initialize RAG/TTS/STT
        PyBackend-->>Docker: Backend Ready
        
        Electron->>Docker: Start clara_n8n container
        Docker->>N8N: Container Start (Port 5678)
        N8N->>N8N: Initialize Workflow Engine
        N8N-->>Docker: N8N Ready
        
        Electron->>Docker: Start clara_comfyui container
        Docker->>ComfyUI: Container Start (Port 8188)
        alt Apple Silicon
            ComfyUI->>ComfyUI: Load Metal GPU Acceleration
        else Intel Mac
            ComfyUI->>ComfyUI: Load OpenGL/CPU Fallback
        end
        ComfyUI-->>Docker: ComfyUI Ready
        
        Docker-->>Electron: All Containers Running
    else
        Note over Electron: Lightweight Mode - Native Services Only
    end
    
    Note over Electron: Phase 6: Frontend & Menu Integration
    Electron->>Electron: Create Native Menu Bar
    Electron->>Frontend: Load React Application
    Frontend->>Frontend: Initialize UI Components
    Frontend->>Frontend: Connect to Services
    Frontend-->>Electron: UI Ready
    
    Note over Electron: Phase 7: macOS Integration
    Electron->>Electron: Register URL Scheme (clara://)
    Electron->>Electron: Setup Dock Integration
    Electron->>Electron: Configure Window Management
    Electron->>Electron: Hide Loading Screen
    Electron->>Frontend: Show Main Window
    Frontend-->>User: Application Ready
```

## Apple Silicon vs Intel Architecture

```mermaid
graph LR
    subgraph "Apple Silicon (M-series)"
        M_CPU[Apple Silicon CPU<br/>8-16 Performance Cores]
        M_GPU[Apple GPU<br/>Metal Acceleration]
        M_MEMORY[Unified Memory<br/>16-128GB Shared]
        M_NEURAL[Neural Engine<br/>AI Acceleration]
        
        M_CPU --- M_MEMORY
        M_GPU --- M_MEMORY
        M_NEURAL --- M_MEMORY
    end
    
    subgraph "Intel Mac"
        I_CPU[Intel CPU<br/>4-28 Cores]
        I_GPU[Intel/AMD GPU<br/>OpenGL/Metal]
        I_MEMORY[DDR4/DDR5<br/>8-128GB]
        I_STORAGE[SSD Storage]
        
        I_CPU --- I_MEMORY
        I_GPU --- I_MEMORY
    end
    
    subgraph "Binary Selection"
        DARWIN_ARM64[darwin-arm64/<br/>Metal Optimized]
        DARWIN_X64[darwin-x64/<br/>AVX Optimized]
    end
    
    M_CPU --> DARWIN_ARM64
    I_CPU --> DARWIN_X64
```

## Service Architecture (macOS Specific)

```mermaid
graph TD
    subgraph "Application Layer"
        MAIN[Electron Main Process<br/>Native macOS App<br/>Role: Orchestration]
        FRONTEND[React Frontend<br/>Native Window<br/>Role: User Interface]
        MENU[Native Menu Bar<br/>macOS Integration<br/>Role: System Integration]
    end
    
    subgraph "Native Services Layer"
        LLAMASWAP[LlamaSwap Service<br/>Ports: 8091, 9999<br/>Metal/AVX Optimized]
        WATCHDOG[Watchdog Service<br/>LaunchD Integration<br/>Role: Process Monitoring]
        MCP[MCP Service<br/>Native Process<br/>Role: Context Protocol]
    end
    
    subgraph "Docker Services Layer (Optional)"
        PYTHON[Python Backend<br/>Port: 5001<br/>Linux Container on VM]
        N8N[N8N Automation<br/>Port: 5678<br/>Linux Container on VM]
        COMFYUI[ComfyUI Studio<br/>Port: 8188<br/>GPU-Accelerated Container]
    end
    
    subgraph "macOS System Resources"
        METAL[Metal GPU Framework<br/>Hardware Acceleration]
        MODELS[Model Storage<br/>~/Library/ApplicationSupport/clara-verse/]
        KEYCHAIN[macOS Keychain<br/>Secure Credential Storage]
        NOTIFICATIONS[Notification Center<br/>System Notifications]
    end
    
    MAIN --> FRONTEND
    MAIN --> MENU
    MAIN --> LLAMASWAP
    MAIN --> WATCHDOG
    MAIN --> MCP
    MAIN --> PYTHON
    MAIN --> N8N
    MAIN --> COMFYUI
    
    LLAMASWAP --> METAL
    LLAMASWAP --> MODELS
    COMFYUI --> METAL
    MAIN --> KEYCHAIN
    MAIN --> NOTIFICATIONS
```

## macOS-Specific Implementation Details

### Binary Management
- **Apple Silicon Location**: `electron/llamacpp-binaries/darwin-arm64/`
- **Intel Location**: `electron/llamacpp-binaries/darwin-x64/`
- **Key Binaries**:
  - `llama-swap-darwin`: Model swapping orchestrator
  - `llama-server`: Model inference server
  - Metal-optimized libraries for Apple Silicon
  - AVX-optimized libraries for Intel

### Code Signing & Notarization
```xml
<!-- Entitlements (assets/entitlements.mac.plist) -->
<dict>
    <key>com.apple.security.network.server</key>
    <true/>
    <key>com.apple.security.network.client</key>
    <true/>
    <key>com.apple.security.device.audio-input</key>
    <true/>
    <key>com.apple.security.device.camera</key>
    <true/>
    <key>com.apple.security.files.user-selected.read-write</key>
    <true/>
</dict>
```

### Environment Variables (macOS)
```bash
# Apple Silicon Optimizations
METAL_DEVICE_WRAPPER_TYPE=1
PYTORCH_ENABLE_MPS_FALLBACK=1

# Intel Mac Optimizations  
OMP_NUM_THREADS=8
VECLIB_MAXIMUM_THREADS=8

# Application Data Directory
CLARA_DATA_DIR=~/Library/Application\ Support/clara-verse

# Docker Desktop Integration
DOCKER_HOST=unix:///var/run/docker.sock
```

### File System Structure (macOS)
```
~/Library/Application Support/clara-verse/     # Main application data
├── llama-models/                             # Local model storage
│   ├── *.gguf                               # GGUF model files
│   └── embeddings/                          # Embedding models
├── python/                                  # Python backend data
├── n8n/                                    # N8N workflow data
├── comfyui_models/                         # ComfyUI model storage
├── comfyui_output/                         # Generated images
├── pull_timestamps.json                   # Docker pull tracking
└── lightrag_storage/                      # RAG system data

~/Library/Logs/clara-verse/                # Application logs
├── main.log                               # Main process logs
├── renderer.log                           # Frontend logs
└── services/                              # Service-specific logs
    ├── llamaswap.log
    ├── watchdog.log
    └── mcp.log

~/Library/Preferences/com.clara-ai.app.plist  # Application preferences
```

## Apple Silicon Optimizations

### Metal GPU Acceleration
```mermaid
sequenceDiagram
    participant App as Application
    participant Metal as Metal Framework
    participant GPU as Apple GPU
    participant Memory as Unified Memory
    participant LlamaSwap as LlamaSwap

    App->>Metal: Initialize Metal Device
    Metal->>GPU: Query GPU Capabilities
    GPU-->>Metal: Capabilities (Compute Units, Memory)
    Metal-->>App: Metal Device Ready
    
    App->>LlamaSwap: Start with Metal Acceleration
    LlamaSwap->>Metal: Create Metal Buffers
    Metal->>Memory: Allocate Unified Memory
    Memory-->>Metal: Memory Allocated
    Metal-->>LlamaSwap: Metal Buffers Ready
    
    LlamaSwap->>Metal: Load Model to GPU
    Metal->>Memory: Load Model Data
    Memory->>GPU: Transfer to GPU Cores
    GPU-->>LlamaSwap: Model Ready for Inference
    
    Note over LlamaSwap: Inference Loop
    LlamaSwap->>GPU: Execute Inference (Metal Shaders)
    GPU->>Memory: Read/Write Unified Memory
    GPU-->>LlamaSwap: Inference Results
```

### Unified Memory Architecture
- **Shared Memory Pool**: CPU and GPU share the same memory space
- **Zero-Copy Operations**: No data transfer between CPU/GPU
- **Dynamic Allocation**: Memory allocated as needed
- **Bandwidth**: 400-800 GB/s memory bandwidth

### Performance Optimizations (Apple Silicon)
```yaml
# LlamaSwap Configuration for Apple Silicon
apple_silicon_optimizations:
  metal_gpu: true
  unified_memory: true
  memory_pressure_handling: adaptive
  thread_count: performance_cores * 2
  batch_size: 512  # Higher due to unified memory
  context_length: 65536  # Larger context possible
```

## Intel Mac Optimizations

### CPU Optimizations
- **AVX2/AVX-512**: Advanced vector extensions
- **Hyper-Threading**: Logical cores utilization
- **Turbo Boost**: Dynamic frequency scaling
- **Cache Optimization**: L1/L2/L3 cache efficiency

### GPU Acceleration Options
1. **Intel Integrated Graphics**:
   - OpenGL compute shaders
   - Limited compute capability
   - Power efficient

2. **AMD Discrete Graphics**:
   - Metal compute shaders
   - Higher performance
   - External GPU support

3. **NVIDIA eGPU** (Legacy):
   - CUDA acceleration
   - Deprecated in macOS 12+

## Docker Desktop Integration

```mermaid
graph TB
    subgraph "Docker Desktop for Mac"
        VM[HyperKit Virtual Machine]
        DOCKER_ENGINE[Docker Engine (Linux)]
        VOLUME_MOUNT[Volume Mounting]
        NETWORK[Port Forwarding]
    end
    
    subgraph "macOS Host"
        CLARA[ClaraVerse App]
        HOST_FS[Host File System]
        HOST_NETWORK[Host Network]
    end
    
    subgraph "Container Services"
        PYTHON_CONTAINER[Python Backend Container]
        N8N_CONTAINER[N8N Container]
        COMFYUI_CONTAINER[ComfyUI Container]
    end
    
    CLARA --> VM
    VM --> DOCKER_ENGINE
    DOCKER_ENGINE --> PYTHON_CONTAINER
    DOCKER_ENGINE --> N8N_CONTAINER
    DOCKER_ENGINE --> COMFYUI_CONTAINER
    
    HOST_FS --> VOLUME_MOUNT
    VOLUME_MOUNT --> PYTHON_CONTAINER
    VOLUME_MOUNT --> N8N_CONTAINER
    VOLUME_MOUNT --> COMFYUI_CONTAINER
    
    HOST_NETWORK --> NETWORK
    NETWORK --> PYTHON_CONTAINER
    NETWORK --> N8N_CONTAINER
    NETWORK --> COMFYUI_CONTAINER
```

### Docker Desktop Requirements
- **Minimum**: Docker Desktop 4.0+
- **Recommended**: Docker Desktop 4.25+
- **VM Resources**:
  - CPU: 4-8 cores allocated
  - Memory: 8-16GB allocated
  - Disk: 64GB+ available

## macOS Security Integration

### Gatekeeper Integration
```mermaid
flowchart TD
    APP_LAUNCH[App Launch Attempt]
    
    APP_LAUNCH --> GATEKEEPER[Gatekeeper Check]
    GATEKEEPER --> SIGNATURE{Code Signature Valid?}
    
    SIGNATURE -->|Valid| NOTARIZATION{Notarized?}
    SIGNATURE -->|Invalid| BLOCK[Block Launch]
    
    NOTARIZATION -->|Yes| ALLOW[Allow Launch]
    NOTARIZATION -->|No| WARN[Show Warning Dialog]
    
    WARN --> USER_CHOICE{User Override?}
    USER_CHOICE -->|Allow| ALLOW
    USER_CHOICE -->|Block| BLOCK
    
    BLOCK --> SECURITY_PREFS[System Preferences > Security]
    SECURITY_PREFS --> MANUAL_ALLOW[Manual Allow]
    MANUAL_ALLOW --> ALLOW
    
    ALLOW --> APP_START[Application Starts]
```

### Keychain Integration
```javascript
// Secure credential storage using macOS Keychain
const keychain = require('keychain');

// Store API keys securely
await keychain.setPassword({
  account: 'clara-openai-key',
  service: 'com.clara-ai.app',
  password: userApiKey
});

// Retrieve API keys
const apiKey = await keychain.getPassword({
  account: 'clara-openai-key',
  service: 'com.clara-ai.app'
});
```

## Network Configuration (macOS)

### Port Management
| Service | Internal Port | External Port | Protocol | Firewall Rule |
|---------|---------------|---------------|----------|---------------|
| React Frontend | N/A | N/A | Internal | N/A |
| Python Backend | 5000 | 5001 | HTTP | Allow Incoming |
| N8N Automation | 5678 | 5678 | HTTP | Allow Incoming |
| ComfyUI Studio | 8188 | 8188 | HTTP/WS | Allow Incoming |
| LlamaSwap Main | N/A | 8091 | HTTP | Allow Incoming |
| LlamaSwap Proxy | 9999 | 9999 | HTTP | Allow Incoming |

### Firewall Configuration
```bash
# macOS Application Firewall (GUI: System Preferences > Security & Privacy > Firewall)
# Command line configuration:
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --setglobalstate on
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --setallowsigned on
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --add /Applications/Clara.app
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --unblockapp /Applications/Clara.app
```

## Performance Monitoring

```mermaid
graph LR
    subgraph "Performance Metrics"
        CPU_USAGE[CPU Usage<br/>Activity Monitor]
        MEMORY_PRESSURE[Memory Pressure<br/>Unified/Discrete]
        GPU_USAGE[GPU Usage<br/>Metal/OpenGL]
        THERMAL_STATE[Thermal State<br/>Throttling Detection]
        POWER_USAGE[Power Usage<br/>Battery Impact]
    end
    
    subgraph "Monitoring Tools"
        ACTIVITY_MONITOR[Activity Monitor]
        INSTRUMENTS[Instruments.app]
        CONSOLE[Console.app]
        SYSTEM_INFO[System Information]
    end
    
    CPU_USAGE --> ACTIVITY_MONITOR
    MEMORY_PRESSURE --> ACTIVITY_MONITOR
    GPU_USAGE --> ACTIVITY_MONITOR
    THERMAL_STATE --> SYSTEM_INFO
    POWER_USAGE --> ACTIVITY_MONITOR
    
    ACTIVITY_MONITOR --> INSTRUMENTS
    CONSOLE --> INSTRUMENTS
```

## Troubleshooting Guide (macOS)

### Common Issues

1. **Gatekeeper Blocking Launch**
   ```bash
   # Check quarantine status
   xattr -l /Applications/Clara.app
   
   # Remove quarantine (if safe)
   sudo xattr -rd com.apple.quarantine /Applications/Clara.app
   
   # Allow in System Preferences
   # System Preferences > Security & Privacy > General > Allow apps downloaded from: App Store and identified developers
   ```

2. **Docker Desktop Not Starting**
   ```bash
   # Check Docker Desktop status
   docker version
   
   # Restart Docker Desktop
   osascript -e 'quit app "Docker Desktop"'
   open -a "Docker Desktop"
   
   # Reset Docker Desktop (if needed)
   rm -rf ~/Library/Group\ Containers/group.com.docker
   ```

3. **Metal GPU Not Detected (Apple Silicon)**
   ```bash
   # Check Metal support
   system_profiler SPDisplaysDataType | grep -i metal
   
   # Check GPU usage
   sudo powermetrics -n 1 -s gpu_power
   
   # Activity Monitor > GPU tab
   ```

4. **Port Conflicts**
   ```bash
   # Check port usage
   lsof -i :5001
   lsof -i :8091
   lsof -i :8188
   
   # Kill conflicting processes
   sudo lsof -ti:5001 | xargs kill -9
   ```

5. **Model Loading Issues**
   ```bash
   # Check model directory
   ls -la ~/Library/Application\ Support/clara-verse/llama-models/
   
   # Check permissions
   chmod 644 ~/Library/Application\ Support/clara-verse/llama-models/*.gguf
   
   # Check disk space
   df -h ~/Library/Application\ Support/clara-verse/
   ```

### Log Locations (macOS)
- Application logs: `~/Library/Logs/clara-verse/`
- System logs: `Console.app` or `log show --predicate 'process == "Clara"'`
- Docker logs: `docker logs <container_name>`
- Crash reports: `~/Library/Logs/DiagnosticReports/`

### System Information Commands
```bash
# System overview
system_profiler SPSoftwareDataType SPHardwareDataType

# CPU information
sysctl -n machdep.cpu.brand_string
sysctl -n hw.ncpu
sysctl -n hw.logicalcpu

# Memory information
sysctl -n hw.memsize
vm_stat

# GPU information (Apple Silicon)
system_profiler SPDisplaysDataType

# Network information
ifconfig
netstat -rn
```

This comprehensive documentation covers the complete macOS startup flow, platform-specific optimizations, and integration with macOS system services for ClaraVerse. 