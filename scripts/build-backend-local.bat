@echo off
REM Simple optimized Docker build for Clara Backend
setlocal enabledelayedexpansion

echo Building Optimized Clara Backend Image...

REM Change to the backend directory
cd /d "%~dp0\..\py_backend"

REM Check if Docker is running
docker info >nul 2>&1
if errorlevel 1 (
    echo Error: Docker is not running. Please start Docker Desktop.
    pause
    exit /b 1
)

REM Build optimized image with the tag dockerSetup.cjs expects
echo Building optimized Docker image...
docker build -f Dockerfile.gpu -t clara17verse/clara-backend:latest-amd64 .

if errorlevel 1 (
    echo Docker build failed!
    pause
    exit /b 1
)

echo.
echo ====================================
echo Optimized Docker image built successfully!
echo ====================================
echo.
echo Image size comparison:
docker images | findstr "clara.*backend"
echo.
echo The image is now ready for use with GPU support and 500MB size reduction!
echo dockerSetup.cjs will automatically handle GPU enable/disable based on your system.
echo.
pause
pause
