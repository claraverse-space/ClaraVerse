@echo off
REM Exit on any error
setlocal enabledelayedexpansion

echo Building Clara Backend Docker Image...

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

REM Build and push for both architectures
echo Building and pushing Docker image...
docker buildx build --platform linux/amd64,linux/arm64 ^
    -t clara17verse/clara-backend:latest ^
    -t clara17verse/clara-backend:1.0.0 ^
    --push .

if errorlevel 1 (
    echo Docker build failed!
    pause
    exit /b 1
)

echo.
echo ====================================
echo Docker image built and pushed successfully!
echo ====================================
echo.
echo Images pushed:
echo - clara17verse/clara-backend:latest
echo - clara17verse/clara-backend:1.0.0
echo.
pause
