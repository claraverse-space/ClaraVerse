# ClaraVerse Windows GPU Setup Script
# Automatically installs and configures NVIDIA Container Toolkit for Docker Desktop

Write-Host "🚀 ClaraVerse Windows GPU Setup" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan
Write-Host ""

# Check if running as administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")

if (-not $isAdmin) {
    Write-Host "❌ This script must be run as Administrator" -ForegroundColor Red
    Write-Host "Right-click PowerShell and select 'Run as Administrator'" -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "✅ Running as Administrator" -ForegroundColor Green

# Check if Docker Desktop is installed
try {
    $dockerVersion = docker --version
    Write-Host "✅ Docker Desktop found: $dockerVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Docker Desktop not found. Please install Docker Desktop first." -ForegroundColor Red
    Write-Host "Download from: https://www.docker.com/products/docker-desktop/" -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

# Check if Docker Desktop is running
try {
    docker info | Out-Null
    Write-Host "✅ Docker Desktop is running" -ForegroundColor Green
} catch {
    Write-Host "❌ Docker Desktop is not running. Please start Docker Desktop first." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# Check NVIDIA GPU
try {
    $gpuInfo = nvidia-smi --query-gpu=name,memory.total --format=csv,noheader,nounits 2>$null
    if ($gpuInfo) {
        Write-Host "✅ NVIDIA GPU detected: $($gpuInfo.Split(',')[0].Trim())" -ForegroundColor Green
        $vramGB = [math]::Round([int]$gpuInfo.Split(',')[1].Trim() / 1024, 1)
        Write-Host "✅ VRAM: ${vramGB}GB" -ForegroundColor Green
    } else {
        throw "No NVIDIA GPU found"
    }
} catch {
    Write-Host "❌ NVIDIA GPU not detected or drivers not installed" -ForegroundColor Red
    Write-Host "Please install NVIDIA drivers from: https://www.nvidia.com/drivers/" -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""
Write-Host "🔧 Installing NVIDIA Container Toolkit..." -ForegroundColor Yellow

# Method 1: Try using Windows Package Manager (winget)
Write-Host "Attempting installation via winget..." -ForegroundColor Cyan
try {
    winget install --id=NVIDIA.ContainerToolkit -e --silent
    Write-Host "✅ NVIDIA Container Toolkit installed via winget" -ForegroundColor Green
    $installSuccess = $true
} catch {
    Write-Host "⚠️ winget installation failed, trying alternative method..." -ForegroundColor Yellow
    $installSuccess = $false
}

# Method 2: Manual installation if winget fails
if (-not $installSuccess) {
    Write-Host "Downloading NVIDIA Container Toolkit manually..." -ForegroundColor Cyan
    
    # Create temp directory
    $tempDir = "$env:TEMP\nvidia-container-toolkit"
    New-Item -ItemType Directory -Path $tempDir -Force | Out-Null
    
    try {
        # Download the installer
        $downloadUrl = "https://developer.download.nvidia.com/compute/cuda/repos/wsl-ubuntu/x86_64/nvidia-container-toolkit_1.14.3-1_amd64.deb"
        $installerPath = "$tempDir\nvidia-container-toolkit.deb"
        
        Write-Host "Downloading from NVIDIA..." -ForegroundColor Cyan
        Invoke-WebRequest -Uri $downloadUrl -OutFile $installerPath -UseBasicParsing
        
        Write-Host "✅ Downloaded NVIDIA Container Toolkit" -ForegroundColor Green
        
        # For Windows, we need to enable WSL2 backend and configure Docker
        Write-Host "Configuring Docker Desktop for GPU support..." -ForegroundColor Cyan
        
    } catch {
        Write-Host "❌ Failed to download NVIDIA Container Toolkit" -ForegroundColor Red
        Write-Host "Error: $_" -ForegroundColor Red
    }
    
    # Clean up temp directory
    Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue
}

# Configure Docker Desktop for GPU support
Write-Host ""
Write-Host "🔧 Configuring Docker Desktop..." -ForegroundColor Yellow

# Stop Docker Desktop
Write-Host "Stopping Docker Desktop..." -ForegroundColor Cyan
try {
    Stop-Process -Name "Docker Desktop" -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 5
} catch {
    # Docker Desktop might not be running as a process we can stop
}

# Configure Docker daemon for GPU support
$dockerConfigPath = "$env:APPDATA\Docker\settings.json"
$dockerConfigDir = Split-Path $dockerConfigPath -Parent

# Create Docker config directory if it doesn't exist
if (-not (Test-Path $dockerConfigDir)) {
    New-Item -ItemType Directory -Path $dockerConfigDir -Force | Out-Null
}

# Read existing config or create new one
$dockerConfig = @{}
if (Test-Path $dockerConfigPath) {
    try {
        $dockerConfig = Get-Content $dockerConfigPath | ConvertFrom-Json -AsHashtable
    } catch {
        Write-Host "⚠️ Could not read existing Docker config, creating new one" -ForegroundColor Yellow
        $dockerConfig = @{}
    }
}

# Add GPU support configuration
$dockerConfig["exposeDockerAPIOnTCP2375"] = $false
$dockerConfig["useWindowsContainers"] = $false
$dockerConfig["useWSL2"] = $true
$dockerConfig["wslEngineEnabled"] = $true

# Enable GPU support
if (-not $dockerConfig.ContainsKey("features")) {
    $dockerConfig["features"] = @{}
}
$dockerConfig["features"]["buildkit"] = $true

# Save updated config
try {
    $dockerConfig | ConvertTo-Json -Depth 10 | Set-Content $dockerConfigPath -Encoding UTF8
    Write-Host "✅ Docker Desktop configuration updated" -ForegroundColor Green
} catch {
    Write-Host "⚠️ Could not update Docker Desktop config: $_" -ForegroundColor Yellow
}

# Start Docker Desktop
Write-Host "Starting Docker Desktop..." -ForegroundColor Cyan
try {
    Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe" -WindowStyle Hidden
    Write-Host "✅ Docker Desktop started" -ForegroundColor Green
} catch {
    Write-Host "⚠️ Could not start Docker Desktop automatically" -ForegroundColor Yellow
    Write-Host "Please start Docker Desktop manually" -ForegroundColor Yellow
}

# Wait for Docker to be ready
Write-Host "Waiting for Docker to be ready..." -ForegroundColor Cyan
$maxWait = 60
$waited = 0
do {
    Start-Sleep -Seconds 2
    $waited += 2
    try {
        docker info | Out-Null
        $dockerReady = $true
        break
    } catch {
        $dockerReady = $false
    }
} while ($waited -lt $maxWait)

if ($dockerReady) {
    Write-Host "✅ Docker is ready" -ForegroundColor Green
} else {
    Write-Host "⚠️ Docker is taking longer than expected to start" -ForegroundColor Yellow
}

# Test GPU support
Write-Host ""
Write-Host "🧪 Testing GPU support..." -ForegroundColor Yellow

try {
    # Try to run a simple NVIDIA container
    Write-Host "Testing NVIDIA runtime..." -ForegroundColor Cyan
    $testResult = docker run --rm --gpus all nvidia/cuda:11.8-base-ubuntu20.04 nvidia-smi 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ GPU support is working!" -ForegroundColor Green
        Write-Host "GPU Test Output:" -ForegroundColor Cyan
        Write-Host $testResult -ForegroundColor Gray
    } else {
        Write-Host "❌ GPU test failed" -ForegroundColor Red
        Write-Host "Error output:" -ForegroundColor Red
        Write-Host $testResult -ForegroundColor Gray
        
        # Provide troubleshooting steps
        Write-Host ""
        Write-Host "🔧 Troubleshooting Steps:" -ForegroundColor Yellow
        Write-Host "1. Ensure Docker Desktop is using WSL2 backend" -ForegroundColor White
        Write-Host "2. In Docker Desktop Settings → General → Use WSL 2 based engine" -ForegroundColor White
        Write-Host "3. In Docker Desktop Settings → Resources → WSL Integration → Enable integration" -ForegroundColor White
        Write-Host "4. Restart Docker Desktop completely" -ForegroundColor White
        Write-Host "5. Update NVIDIA drivers to latest version" -ForegroundColor White
    }
} catch {
    Write-Host "❌ Could not test GPU support: $_" -ForegroundColor Red
}

# Final instructions
Write-Host ""
Write-Host "🎉 Setup Complete!" -ForegroundColor Green
Write-Host "==================" -ForegroundColor Green
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Cyan
Write-Host "1. Restart Docker Desktop if GPU test failed" -ForegroundColor White
Write-Host "2. Run the ClaraVerse optimizer again:" -ForegroundColor White
Write-Host "   node electron/optimize-comfyui.cjs" -ForegroundColor Gray
Write-Host "3. Start ClaraVerse and test ComfyUI performance" -ForegroundColor White
Write-Host ""
Write-Host "If you encounter issues:" -ForegroundColor Yellow
Write-Host "- Check Docker Desktop Settings → Resources → WSL Integration" -ForegroundColor White
Write-Host "- Ensure WSL2 backend is enabled" -ForegroundColor White
Write-Host "- Update NVIDIA drivers if needed" -ForegroundColor White
Write-Host ""

Read-Host "Press Enter to exit" 