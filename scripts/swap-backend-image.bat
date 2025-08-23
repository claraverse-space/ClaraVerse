@echo off
REM Script to swap between live and local backend images
setlocal enabledelayedexpansion

echo Clara Backend Image Swapper
echo ============================

if "%1"=="local" goto use_local
if "%1"=="live" goto use_live
if "%1"=="restore" goto restore_live

echo Usage:
echo   %0 local    - Use local image as live
echo   %0 live     - Use original live image  
echo   %0 restore  - Restore original live image from backup
echo.
echo Current images:
docker images | findstr clara17verse/clara-backend
pause
exit /b 0

:use_local
echo Switching to LOCAL image...
echo.

REM Check if we have a local image to use
docker images | findstr "clara-backend.*local" >nul
if errorlevel 1 (
    echo Error: No local image found. Please build one first with:
    echo   docker build -t clara-backend:local .
    echo   (from the py_backend directory)
    pause
    exit /b 1
)

REM Backup current live image if not already backed up
docker images | findstr "clara17verse/clara-backend.*backup-live" >nul
if errorlevel 1 (
    echo Creating backup of current live image...
    docker tag clara17verse/clara-backend:latest-amd64 clara17verse/clara-backend:backup-live
)

REM Tag local image as live
echo Tagging local image as live...
docker tag clara-backend:local clara17verse/clara-backend:latest-amd64

echo ✅ Successfully switched to LOCAL image!
echo The tag 'clara17verse/clara-backend:latest-amd64' now points to your local build.
goto end

:use_live
echo Switching to original LIVE image...
echo.

REM Check if we have a backup
docker images | findstr "clara17verse/clara-backend.*backup-live" >nul
if errorlevel 1 (
    echo Warning: No backup found. The current live image is already the original.
    goto end
)

REM Restore from backup
docker tag clara17verse/clara-backend:backup-live clara17verse/clara-backend:latest-amd64
echo ✅ Successfully switched to original LIVE image!
goto end

:restore_live
echo Restoring original LIVE image...
echo.

REM Check if we have a backup
docker images | findstr "clara17verse/clara-backend.*backup-live" >nul
if errorlevel 1 (
    echo Error: No backup found to restore from.
    pause
    exit /b 1
)

REM Restore from backup
docker tag clara17verse/clara-backend:backup-live clara17verse/clara-backend:latest-amd64
echo ✅ Successfully restored original LIVE image!

REM Clean up local tags if desired
set /p cleanup="Remove local image tags? (y/n): "
if /i "%cleanup%"=="y" (
    docker rmi clara-backend:local 2>nul
    echo Local tags cleaned up.
)
goto end

:end
echo.
echo Current clara-backend images:
docker images | findstr clara
echo.
pause
