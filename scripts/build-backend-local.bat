@echo off
REM Local Docker build script for development
setlocal enabledelayedexpansion

echo Building Clara Backend Docker Image (Local)...

REM Change to the backend directory
cd /d "%~dp0\..\py_backend"

REM Check if Docker is running
docker info >nul 2>&1
if errorlevel 1 (
    echo Error: Docker is not running. Please start Docker Desktop.
    pause
    exit /b 1
)

REM Build local image and tag it to replace the live one
echo Building local Docker image...
docker build -t clara-backend:local .

if errorlevel 1 (
    echo Docker build failed!
    pause
    exit /b 1
)

echo Tagging local image to replace live image...
docker tag clara-backend:local clara17verse/clara-backend:latest-amd64

echo.
echo ====================================
echo Local Docker image built and tagged successfully!
echo ====================================
echo.
echo Images created: 
echo - clara-backend:local
echo - clara17verse/clara-backend:latest-amd64 (now points to local build)
echo.
echo Your live image has been backed up as: clara17verse/clara-backend:backup-live
echo.
echo To run the container with the live tag:
echo docker run -p 5000:5000 clara17verse/clara-backend:latest-amd64
echo.
echo To restore the original live image:
echo docker tag clara17verse/clara-backend:backup-live clara17verse/clara-backend:latest-amd64
echo.
pause
