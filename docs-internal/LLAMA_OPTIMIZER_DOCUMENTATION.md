# LLaMA Optimizer Documentation

## Overview

The **LLaMA Optimizer** is a sophisticated CLI tool built in Go that automatically optimizes llama.cpp model configurations based on your system's hardware capabilities and performance requirements. It intelligently configures GPU layers, memory settings, context sizes, and advanced parameters to achieve optimal performance across different use cases.

## Table of Contents

1. [Installation & Building](#installation--building)
2. [Command Line Arguments](#command-line-arguments)
3. [Optimization Presets](#optimization-presets)
4. [System Detection](#system-detection)
5. [Configuration Format](#configuration-format)
6. [Usage Examples](#usage-examples)
7. [Advanced Features](#advanced-features)
8. [Architecture Overview](#architecture-overview)
9. [Troubleshooting](#troubleshooting)

## Installation & Building

### Build Scripts (npm)

```bash
# Build for current platform (Windows)
npm run llama-optimizer:build

# Build for all platforms (Windows, macOS, Linux)
npm run llama-optimizer:build-all

# Test the built binary
npm run llama-optimizer:test
```

### Manual Build

```bash
cd clara-core-optimiser

# Windows
go build -ldflags="-s -w" -o llama-optimizer-windows.exe llama_optimizer.go

# Cross-compile for other platforms
cross-env GOOS=darwin GOARCH=amd64 go build -ldflags="-s -w" -o llama-optimizer-darwin-amd64 llama_optimizer.go
cross-env GOOS=darwin GOARCH=arm64 go build -ldflags="-s -w" -o llama-optimizer-darwin-arm64 llama_optimizer.go
cross-env GOOS=linux GOARCH=amd64 go build -ldflags="-s -w" -o llama-optimizer-linux llama_optimizer.go
```

## Command Line Arguments

### Basic Usage
```bash
llama-optimizer.exe [OPTIONS]
```

### Arguments

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `-config` | string | `llama-swap.yaml` | Path to YAML configuration file |
| `-preset` | string | `balanced` | Optimization preset (see [Presets](#optimization-presets)) |
| `-output` | string | `""` | Output path for optimized config (default: overwrites input) |
| `-model` | string | `""` | Optimize specific model only (optional) |
| `-specs` | bool | `false` | Show detected system specifications |
| `-verbose` | bool | `false` | Show detailed optimization process |
| `-backup` | bool | `true` | Create backup before overwriting config |

### Preset Options
- `high_speed` - Speed-optimized configuration
- `more_context` - Context-maximizing configuration
- `balanced` - **Default** - Balanced performance/stability
- `system_safe` - Conservative, stability-focused
- `ultra_performance` - Maximum performance settings
- `moe_optimized` - Specialized for MoE (Mixture of Experts) models

## Optimization Presets

### 1. **High Speed** (`high_speed`)
**Best For:** Fast inference, short conversations, API usage

**Characteristics:**
- Maximum GPU layer allocation
- Small context window (4096 tokens)
- Large batch sizes (512/256)
- Aggressive KV cache quantization (Q8_0)
- Parallel processing up to 8 sequences
- Flash attention enabled (when supported)

**Trade-offs:** Limited context length, higher memory usage

---

### 2. **More Context** (`more_context`)
**Best For:** Long conversations, document analysis, research tasks

**Characteristics:**
- Maximized context length (up to model's full capability)
- Aggressive KV cache quantization (Q4_0) to save memory
- Conservative GPU layer allocation to reserve VRAM for context
- KV cache offloading when needed
- Optimized for large context windows

**Trade-offs:** Slower inference speed, complex memory management

---

### 3. **Balanced** (`balanced`) - **DEFAULT**
**Best For:** General use, mixed workloads, development

**Characteristics:**
- Smart GPU layer allocation (80% multiplier)
- Dynamic context sizing (4K-16K based on model)
- Moderate KV cache quantization (Q8_0, Q4_0 for large models)
- Balanced parallelism (CPU_cores/3)
- Conservative settings for large models (>25B params)

**Trade-offs:** Good all-around performance without extremes

---

### 4. **System Safe** (`system_safe`)
**Best For:** Unstable systems, shared resources, production stability

**Characteristics:**
- Very conservative resource allocation (50% multiplier)
- Small context windows (2048-4096 tokens)
- No KV cache quantization by default
- Limited threading (max 4 threads)
- Extra conservative for Vulkan backend
- Memory protection enabled

**Trade-offs:** Lower performance, guaranteed stability

---

### 5. **Ultra Performance** (`ultra_performance`)
**Best For:** High-end systems, maximum throughput, batch processing

**Characteristics:**
- Maximum GPU offloading (110% multiplier)
- Large batch sizes (1024/512)
- High context limits (up to 32K tokens)
- All available CPU cores (cores-1)
- NUMA distribution for large systems
- Layer-based tensor splitting

**Trade-offs:** High resource usage, potential instability on weaker systems

---

### 6. **MoE Optimized** (`moe_optimized`)
**Best For:** Mixtral, A3B, and other Mixture of Experts models

**Characteristics:**
- Specialized expert routing optimization
- Row-based tensor splitting for experts
- Selective expert offloading (only when necessary)
- Conservative micro-batching (64 ubatch)
- MoE-aware threading based on active experts
- Advanced memory calculations for sparse activation

**Trade-offs:** Optimized specifically for MoE architectures

## System Detection

The optimizer automatically detects your system capabilities:

### Hardware Detection
```bash
# View detected specifications
llama-optimizer.exe -specs
```

**Detected Properties:**
- **GPU Information**: Name, VRAM, compute capability
- **Backend Detection**: CUDA, Vulkan, Metal, ROCm, CPU
- **CPU Cores**: Physical and logical core count
- **System Memory**: Available RAM
- **Platform**: Windows, Linux, macOS

### Backend-Specific Optimizations

#### CUDA
- Full feature set with flash attention
- Compute capability-based optimizations
- Advanced memory management
- KV cache quantization support

#### Vulkan
- Conservative memory allocation (OOM protection)
- Reduced parallelism and context limits
- No flash attention support
- Extra memory overhead compensation

#### Metal (Apple Silicon)
- Unified memory awareness
- Flash attention enabled
- macOS-specific memory handling
- ARM64 optimizations

#### CPU
- No GPU offloading
- Conservative batching
- System RAM utilization
- Multi-threading optimization

## Configuration Format

The optimizer works with YAML configuration files containing model definitions:

### Input Configuration Structure
```yaml
healthCheckTimeout: 30
logLevel: info
models:
  model-name:
    proxy: http://127.0.0.1:9999
    cmd: |
      "path/to/llama-server" -m "model.gguf" --port 9999 [parameters]
    ttl: 300
groups:
  group-name:
    swap: true
    exclusive: true
    persistent: false
    members:
      - model-name
```

### Generated Parameters

The optimizer generates and optimizes these llama-server parameters:

| Parameter | Description | Preset Impact |
|-----------|-------------|---------------|
| `--n-gpu-layers` | GPU layer allocation | Varies by preset and VRAM |
| `--threads` | CPU thread count | Based on preset and CPU cores |
| `--ctx-size` | Context window size | Preset-dependent (2K-32K+) |
| `--batch-size` | Batch processing size | Speed vs stability trade-off |
| `--ubatch-size` | Micro-batch size | Fine-tuned per preset |
| `--keep` | Cache retention | Context-dependent |
| `--defrag-thold` | Memory defrag threshold | Performance optimization |
| `--parallel` | Parallel sequences | CPU and preset dependent |
| `--cache-type-k` | KV cache K quantization | Memory optimization |
| `--cache-type-v` | KV cache V quantization | Must match K type |
| `--flash-attn` | Flash attention | Backend capability dependent |
| `--cont-batching` | Continuous batching | Generally enabled |
| `--mlock` | Memory locking | System dependent |

### Advanced Parameters (Conditional)
- `--numa distribute` - NUMA awareness for large systems
- `--split-mode` - Tensor splitting strategy
- `--override-tensor` - MoE expert offloading
- `--rope-scaling` - Context scaling
- `--embeddings` - Embedding model support

## Usage Examples

### Basic Optimization
```bash
# Optimize with default balanced preset
llama-optimizer.exe -config config.yaml

# Use system-safe preset for stability
llama-optimizer.exe -config config.yaml -preset system_safe

# Speed-optimized for inference
llama-optimizer.exe -config config.yaml -preset high_speed
```

### Advanced Usage
```bash
# Optimize single model with verbose output
llama-optimizer.exe -config config.yaml -model "gemma3:4b" -preset ultra_performance -verbose

# Output to different file without backup
llama-optimizer.exe -config input.yaml -output optimized.yaml -backup=false

# Show system specifications
llama-optimizer.exe -specs
```

### Integration Examples

#### Clara Integration
```bash
# Optimize Clara's llama-swap configuration
llama-optimizer.exe -config "C:\Users\Admin\AppData\Roaming\clara-verse\llama-swap-config.yaml" -preset system_safe
```

#### Batch Processing
```bash
# Optimize multiple configurations
for config in *.yaml; do
    llama-optimizer.exe -config "$config" -preset balanced -output "optimized_$config"
done
```

## Advanced Features

### KV Cache Quantization
**Purpose:** Reduces memory usage for large contexts by 50-75%

**Types:**
- `f16` - Default, full precision (2 bytes per element)
- `q8_0` - 8-bit quantization (1 byte per element)
- `q4_0` - 4-bit quantization (0.5 bytes per element)
- `q2_k` - 2-bit quantization (0.25 bytes per element)

**Critical Rule:** K and V cache types must match for stability

### MoE (Mixture of Experts) Optimization

**Expert Offloading Logic:**
```
IF model_size > usable_VRAM * 1.5:
    percent_to_offload = (model_size - usable_VRAM) / model_size
    IF percent_to_offload > 0.3:
        offload_last_N_expert_layers()
    ELSE:
        fit_all_on_gpu()
```

**MoE-Specific Optimizations:**
- Row-based tensor splitting
- Active expert threading
- Conservative micro-batching
- Sparse activation awareness

### Memory Calculations

#### Model Size Estimation
```go
base_size = total_params * quantization_multiplier
if isMoE:
    base_size *= 1.3  // MoE overhead
final_size = base_size * 1.1  // Structure overhead
```

#### VRAM Allocation Strategy
```
available_vram = gpu_memory * 0.95
if backend == "vulkan":
    available_vram *= 0.85  // Extra overhead

usable_for_model = available_vram - kv_cache_reserve - system_overhead
```

### Backend-Specific Adjustments

#### Vulkan Limitations
- No flash attention support
- Conservative layer allocation (60% multiplier for large models)
- Reduced batch sizes (max 256)
- Limited context (max 8K for large models)
- No KV cache quantization

#### Apple Silicon Optimizations
- Unified memory utilization
- Metal performance shaders
- ARM64-specific optimizations
- No memory locking (handled by macOS)

## Architecture Overview

### Core Components

1. **System Detection Engine**
   - Hardware capability detection
   - Backend identification
   - Memory profiling

2. **Model Metadata Analyzer**
   - Filename parsing for parameters
   - Quantization detection
   - MoE architecture identification

3. **Optimization Engine**
   - Preset-based parameter generation
   - Memory-aware allocation
   - Backend-specific adjustments

4. **Configuration Manager**
   - YAML parsing and generation
   - Backup management
   - Command generation

### Optimization Flow
```
Input Config → System Detection → Model Analysis → Preset Application → Backend Adjustment → Output Generation
```

## Troubleshooting

### Common Issues

#### Out of Memory (OOM) Errors
**Symptoms:** Models crash or fail to load
**Solutions:**
- Use `system_safe` preset
- Reduce context size manually
- Try Vulkan backend (more conservative)
- Enable KV cache quantization

#### Slow Performance
**Symptoms:** High latency, low throughput
**Solutions:**
- Use `high_speed` preset
- Check GPU utilization
- Verify flash attention is enabled
- Increase batch sizes

#### Vulkan-Specific Issues
**Symptoms:** Crashes on AMD/Intel GPUs
**Solutions:**
- Use extra conservative settings
- Reduce context to 4K or lower
- Disable parallel processing
- Use CPU fallback if necessary

#### MoE Model Issues
**Symptoms:** Expert routing errors, memory issues
**Solutions:**
- Use `moe_optimized` preset
- Enable expert offloading
- Reduce ubatch size
- Use row-based splitting

### Debug Commands

```bash
# Check system detection
llama-optimizer.exe -specs -verbose

# Test single model optimization
llama-optimizer.exe -config config.yaml -model "test-model" -verbose

# Validate configuration
llama-optimizer.exe -config config.yaml -output /dev/null -verbose
```

### Performance Tuning Tips

1. **For Speed:** Use `high_speed` preset with large VRAM
2. **For Stability:** Use `system_safe` preset with conservative settings
3. **For Context:** Use `more_context` with KV quantization
4. **For MoE:** Always use `moe_optimized` preset
5. **For Mixed Use:** Stick with `balanced` preset

### Memory Optimization Guidelines

- **Small Models (<7B):** Can run most presets safely
- **Medium Models (7B-13B):** Use `balanced` or `system_safe`
- **Large Models (20B-30B):** Require careful tuning, consider `system_safe`
- **Extra Large (70B+):** May need CPU offloading or specialized hardware

---

## Version Information

- **Version:** Integrated with Clara v0.1.26
- **Go Version:** 1.21+
- **Supported Platforms:** Windows, macOS (Intel/ARM), Linux
- **Backend Support:** CUDA, Vulkan, Metal, ROCm, CPU

## Contributing

The optimizer is part of the Clara ecosystem. For issues or improvements:

1. Check system specifications with `-specs`
2. Test with `-verbose` flag for detailed output
3. Report hardware-specific issues with system info
4. Suggest preset improvements based on use cases

---

*This documentation covers the complete functionality of the LLaMA Optimizer tool integrated within the Clara ecosystem.*
