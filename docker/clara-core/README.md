# Clara Core Docker Containerization

This guide explains how to run the Clara Core (LlamaSwap) service in a Docker container with GPU support, replacing the Electron-based IPC communication with HTTP API calls.

## Overview

The Clara Core service has been containerized to provide:
- GPU acceleration (NVIDIA CUDA) when available
- CPU fallback for non-GPU systems
- HTTP API replacing IPC communication
- OpenAI-compatible endpoints
- Proper model management and scanning
- Health monitoring and logging

## Quick Start

### 1. Using Docker Compose (Recommended)

```bash
# Start the service
cd docker/clara-core
docker-compose up -d

# Check logs
docker-compose logs -f clara-core

# Stop the service
docker-compose down
```

### 2. Using Management Scripts

**Windows:**
```cmd
cd docker\clara-core
clara-core.bat start
clara-core.bat status
clara-core.bat stop
```

**Linux/macOS:**
```bash
cd docker/clara-core
./clara-core.sh start
./clara-core.sh status
./clara-core.sh stop
```

### 3. Manual Docker Commands

```bash
# Build the image
docker build -t clara-core:latest .

# Run with GPU support (if available)
docker run -d --name clara-core \
  --gpus all \
  -p 8091:8091 \
  -v ~/models:/app/models \
  clara-core:latest

# Run CPU-only
docker run -d --name clara-core \
  -p 8091:8091 \
  -v ~/models:/app/models \
  clara-core:latest
```

## Configuration

### Environment Variables

- `CLARA_GPU_ENABLED`: Enable GPU support (default: auto-detect)
- `CLARA_MODEL_PATH`: Path to models directory (default: `/app/models`)
- `CLARA_PORT`: HTTP server port (default: `8091`)
- `CLARA_LOG_LEVEL`: Log level (default: `info`)

### Volume Mounts

- `/app/models`: Mount your local models directory
- `/app/config`: Mount custom configuration files (optional)
- `/app/logs`: Mount for persistent logs (optional)

## API Endpoints

### Service Management

- `GET /health` - Health check
- `GET /status` - Service status
- `POST /start` - Start the service
- `POST /stop` - Stop the service
- `POST /restart` - Restart the service

### Model Management

- `GET /models` - List available models
- `POST /models/scan` - Scan for new models
- `GET /models/{id}` - Get model information

### Configuration

- `GET /config` - Get current configuration
- `POST /config` - Update configuration
- `POST /config/generate` - Generate new configuration

### GPU Information

- `GET /gpu` - Get GPU information and diagnostics

### Logs

- `GET /logs` - Get service logs

### OpenAI-Compatible Endpoints

- `GET /v1/models` - List models (OpenAI format)
- `POST /v1/completions` - Text completions
- `POST /v1/chat/completions` - Chat completions
- `POST /v1/embeddings` - Generate embeddings

## Client Integration

### Using the HTTP Client

```typescript
import { ClaraCoreClient } from '../src/services/claraCoreClient';

const client = new ClaraCoreClient('http://localhost:8091');

// Start the service
await client.startService();

// Get status
const status = await client.getStatus();

// List models
const models = await client.getModels();

// Create chat completion
const response = await client.createChatCompletion({
  model: 'your-model',
  messages: [{ role: 'user', content: 'Hello!' }]
});
```

### Using the IPC Compatibility Layer

For gradual migration from IPC to HTTP:

```typescript
import { claraCoreIPCAdapter } from '../src/services/claraCoreClient';

// These work exactly like the old IPC calls
const status = await claraCoreIPCAdapter.getLlamaSwapStatus();
const models = await claraCoreIPCAdapter.getLlamaSwapModels();
await claraCoreIPCAdapter.startLlamaSwap();
```

## Migrating from IPC

### Step 1: Start the Docker Service

Ensure the Clara Core Docker service is running before starting your Electron app.

### Step 2: Update Electron Main Process

Replace IPC handlers with HTTP client calls:

```typescript
// Before (IPC)
ipcMain.handle('llamaSwap:getStatus', async () => {
  return llamaSwapService.getStatus();
});

// After (HTTP)
ipcMain.handle('llamaSwap:getStatus', async () => {
  return claraCoreIPCAdapter.getLlamaSwapStatus();
});
```

### Step 3: Update Frontend Components

The frontend components don't need changes - they still use the same IPC calls through the renderer process.

### Step 4: Remove Old Service (Optional)

Once everything is working, you can remove the old `llamaSwapService.cjs` and related IPC handlers.

## GPU Support

### Requirements

- NVIDIA GPU with CUDA support
- Docker with GPU support (`nvidia-docker2`)
- NVIDIA Container Toolkit

### Verification

```bash
# Check if GPU is detected
curl http://localhost:8091/gpu

# Expected response:
{
  "gpu": {
    "available": true,
    "vendor": "NVIDIA",
    "memory": "8GB",
    "compute": "8.6"
  }
}
```

### Troubleshooting GPU

1. **GPU not detected:**
   ```bash
   # Check NVIDIA Docker support
   docker run --rm --gpus all nvidia/cuda:11.8-base-ubuntu20.04 nvidia-smi
   ```

2. **Service falls back to CPU:**
   - Check container logs: `docker logs clara-core`
   - Verify GPU memory availability
   - Ensure model fits in GPU memory

## Health Monitoring

### Health Check Endpoint

```bash
curl http://localhost:8091/health
```

Expected responses:
- `{ "status": "healthy", "service": "running" }` - Service is ready
- `{ "status": "starting", "service": "initializing" }` - Service is starting
- `{ "status": "unhealthy", "error": "..." }` - Service has issues

### Docker Health Checks

The container includes built-in health checks:

```bash
# Check container health
docker ps
# HEALTH column shows: healthy, unhealthy, or starting
```

## Logging

### Container Logs

```bash
# View logs
docker logs clara-core

# Follow logs
docker logs -f clara-core

# Get last 100 lines
docker logs --tail 100 clara-core
```

### Log Levels

- `error`: Only errors
- `warn`: Warnings and errors
- `info`: General information (default)
- `debug`: Detailed debugging information

Set via environment variable:
```bash
docker run -e CLARA_LOG_LEVEL=debug clara-core:latest
```

## Troubleshooting

### Common Issues

1. **Port already in use:**
   ```bash
   # Change port
   docker run -p 8092:8091 clara-core:latest
   ```

2. **Models not found:**
   ```bash
   # Check volume mount
   docker run -v /path/to/your/models:/app/models clara-core:latest
   ```

3. **Permission errors:**
   ```bash
   # Fix permissions
   sudo chown -R $USER:$USER /path/to/models
   ```

4. **Service not starting:**
   ```bash
   # Check logs
   docker logs clara-core
   
   # Check health
   curl http://localhost:8091/health
   ```

### Debug Mode

Run with debug logging:

```bash
docker run -e CLARA_LOG_LEVEL=debug clara-core:latest
```

### Manual Testing

```bash
# Test all endpoints
curl http://localhost:8091/health
curl http://localhost:8091/status
curl http://localhost:8091/models
curl http://localhost:8091/gpu
curl http://localhost:8091/v1/models
```

## Performance Optimization

### GPU Memory Management

The service automatically manages GPU memory:
- Loads models on-demand
- Unloads unused models
- Falls back to CPU if GPU memory is full

### CPU Performance

For CPU-only deployments:
- Increase container CPU limits
- Use models optimized for CPU inference
- Consider using quantized models

### Container Resources

```yaml
# docker-compose.yml
services:
  clara-core:
    deploy:
      resources:
        limits:
          cpus: '4.0'
          memory: 8G
        reservations:
          cpus: '2.0'
          memory: 4G
```

## Security Considerations

### Network Security

- The service runs on localhost by default
- For remote access, use proper authentication
- Consider using reverse proxy with SSL

### File System Security

- Models directory should have appropriate permissions
- Container runs as non-root user
- Use read-only volumes when possible

### API Security

The current implementation doesn't include authentication. For production use:

1. Add API key authentication
2. Use HTTPS/TLS encryption
3. Implement rate limiting
4. Add request validation

## Development

### Building Custom Images

```bash
# Build with custom tag
docker build -t clara-core:custom .

# Build for specific platform
docker buildx build --platform linux/amd64,linux/arm64 -t clara-core:multi .
```

### Development Mode

```bash
# Mount source code for development
docker run -v $(pwd):/app/src clara-core:latest
```

### Testing

```bash
# Run tests in container
docker run --rm clara-core:latest npm test

# Run specific test
docker run --rm clara-core:latest npm run test:gpu
```

This completes the Clara Core containerization setup. The service is now ready to replace the Electron-based IPC communication with HTTP API calls while maintaining all the original functionality including GPU support, model management, and health monitoring.
