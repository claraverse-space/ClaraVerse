@echo off
echo Building Widget Service for Windows...

cd /d "%~dp0"
set GOOS=windows
set GOARCH=amd64
go build -ldflags="-s -w" -o widgets-service-windows.exe main.go

if %ERRORLEVEL% EQU 0 (
    echo Build successful: widgets-service-windows.exe
) else (
    echo Build failed!
    exit /b 1
)

echo.
echo Building for other platforms...

set GOOS=linux
go build -ldflags="-s -w" -o widgets-service-linux main.go

set GOOS=darwin
go build -ldflags="-s -w" -o widgets-service-macos main.go

echo.
echo All builds completed!
echo Files created:
echo - widgets-service-windows.exe
echo - widgets-service-linux  
echo - widgets-service-macos
