# Clara Backend Docker Build Script (PowerShell)
# Builds optimized Docker images for CPU and GPU deployments

param(
    [switch]$Push,
    [switch]$GpuOnly,
    [string]$Platform = "linux/amd64,linux/arm64"
)

# Configuration
$ImageName = "clara17verse/clara-backend"
$DateTag = Get-Date -Format "yyyyMMdd"

Write-Host "🚀 Clara Backend Docker Build Script" -ForegroundColor Blue
Write-Host "=================================================="

function Build-Image {
    param(
        [string]$Dockerfile,
        [string]$TagSuffix,
        [string]$Description,
        [string]$RequirementsFile = "requirements.txt"
    )
    
    Write-Host "📦 Building $Description..." -ForegroundColor Yellow
    
    # Copy the appropriate requirements file
    if ($RequirementsFile -ne "requirements.txt") {
        Write-Host "Using optimized requirements: $RequirementsFile"
        Copy-Item $RequirementsFile requirements-build.txt
    } else {
        Copy-Item requirements.txt requirements-build.txt
    }
    
    # Build for local platform first (faster testing)
    Write-Host "Building for local platform..." -ForegroundColor Blue
    docker build `
        -f $Dockerfile `
        -t "${ImageName}:${TagSuffix}" `
        -t "${ImageName}:${TagSuffix}-${DateTag}" `
        .
    
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to build $Description"
        return $false
    }
    
    # Build multi-platform if pushing
    if ($Push) {
        Write-Host "Building multi-platform and pushing..." -ForegroundColor Blue
        docker buildx build `
            --platform $Platform `
            -f $Dockerfile `
            -t "${ImageName}:${TagSuffix}" `
            -t "${ImageName}:${TagSuffix}-${DateTag}" `
            --push `
            .
        
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Failed to push $Description"
            return $false
        }
    }
    
    # Cleanup
    Remove-Item requirements-build.txt -ErrorAction SilentlyContinue
    
    Write-Host "✅ $Description build complete!" -ForegroundColor Green
    return $true
}

function Show-ImageInfo {
    Write-Host "📊 Image Information:" -ForegroundColor Blue
    Write-Host "=================================================="
    docker images $ImageName --format "table {{.Repository}}:{{.Tag}}\t{{.Size}}\t{{.CreatedAt}}"
    Write-Host ""
}

function Test-Image {
    param([string]$Tag)
    
    Write-Host "🧪 Testing ${ImageName}:${Tag}..." -ForegroundColor Yellow
    
    # Test basic container startup
    docker run --rm -d `
        --name clara-backend-test `
        -p 5099:5000 `
        "${ImageName}:${Tag}"
    
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to start container"
        return $false
    }
    
    # Wait a moment for startup
    Start-Sleep -Seconds 5
    
    # Test health endpoint
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:5099/health" -TimeoutSec 10
        if ($response.StatusCode -eq 200) {
            Write-Host "✅ Health check passed" -ForegroundColor Green
            docker stop clara-backend-test | Out-Null
            return $true
        }
    }
    catch {
        Write-Host "❌ Health check failed" -ForegroundColor Red
        docker logs clara-backend-test
        docker stop clara-backend-test | Out-Null
        return $false
    }
}

# Main build process
function Main {
    Write-Host "Build Configuration:"
    Write-Host "  - Platform: $Platform"
    Write-Host "  - Push to registry: $Push"
    Write-Host "  - GPU only: $GpuOnly"
    Write-Host ""
    
    $success = $true
    
    if ($GpuOnly) {
        Write-Host "Building GPU-optimized version only..." -ForegroundColor Yellow
        $success = Build-Image "Dockerfile.gpu" "latest-gpu" "GPU-optimized Clara Backend" "requirements-optimized.txt"
        if ($success) {
            $success = Test-Image "latest-gpu"
        }
    } else {
        # Build standard version
        $success = Build-Image "Dockerfile" "latest" "Standard Clara Backend" "requirements.txt"
        
        # Build GPU-optimized version
        if ($success -and (Test-Path "Dockerfile.gpu")) {
            $success = Build-Image "Dockerfile.gpu" "latest-gpu" "GPU-optimized Clara Backend" "requirements-optimized.txt"
            
            # Test both images
            if ($success) {
                Write-Host "🧪 Testing images..." -ForegroundColor Yellow
                $success = (Test-Image "latest") -and (Test-Image "latest-gpu")
            }
        }
    }
    
    Show-ImageInfo
    
    if ($success) {
        Write-Host "🎉 Build process complete!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Usage examples:"
        Write-Host "  CPU version:  docker run -p 5000:5000 ${ImageName}:latest"
        Write-Host "  GPU version:  docker run --gpus all -p 5000:5000 ${ImageName}:latest-gpu"
        Write-Host ""
        Write-Host "To push images: .\build-docker.ps1 -Push"
        Write-Host "To build GPU only: .\build-docker.ps1 -GpuOnly"
    } else {
        Write-Error "Build process failed!"
        exit 1
    }
}

# Run main function
Main
