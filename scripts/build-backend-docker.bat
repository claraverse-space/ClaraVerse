@echo off
REM Production optimized Docker build for Clara Backend
setlocal enabledelayedexpansion

echo Building Production Optimized Clara Backend Image...

REM Change to the backend directory
cd /d "%~dp0\..\py_backend"

REM Check if Docker is running
docker info >nul 2>&1
if errorlevel 1 (
    echo Error: Docker is not running. Please start Docker Desktop.
    pause
    exit /b 1
)

REM Check if user is logged in to Docker Hub
docker info 2>nul | findstr /i "Username: clara17verse" >nul
if errorlevel 1 (
    echo Please log in to Docker Hub first
    docker login -u clara17verse
    if errorlevel 1 (
        echo Login failed. Exiting.
        pause
        exit /b 1
    )
)

REM Create and use buildx builder if it doesn't exist
docker buildx ls | findstr /i "clarabuilder" >nul
if errorlevel 1 (
    echo Creating buildx builder...
    docker buildx create --name clarabuilder --use
    if errorlevel 1 (
        echo Failed to create buildx builder. Exiting.
        pause
        exit /b 1
    )
)

REM Build optimized images for both architectures and push
echo Building and pushing optimized Docker images...
docker buildx build --platform linux/amd64,linux/arm64 ^
    -f Dockerfile.gpu ^
    -t clara17verse/clara-backend:latest ^
    -t clara17verse/clara-backend:latest-amd64 ^
    -t clara17verse/clara-backend:latest-arm64 ^
    --push .

if errorlevel 1 (
    echo Docker build failed!
    pause
    exit /b 1
)

echo.
echo ====================================
echo Production optimized Docker image built and pushed successfully!
echo ====================================
echo.
echo Images pushed to Docker Hub:
echo - clara17verse/clara-backend:latest (multi-arch optimized)
echo - clara17verse/clara-backend:latest-amd64 (AMD64 optimized)
echo - clara17verse/clara-backend:latest-arm64 (ARM64 optimized)
echo.
echo Production images are ready for deployment with GPU support!
echo dockerSetup.cjs will automatically handle GPU enable/disable based on target system.
echo.
pause
