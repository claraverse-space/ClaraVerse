#!/bin/bash
echo "Building Widget Service..."

cd "$(dirname "$0")"

# Build for current platform
echo "Building for current platform..."
go build -ldflags="-s -w" -o widgets-service main.go

# Build for multiple platforms
echo "Building for Windows..."
GOOS=windows GOARCH=amd64 go build -ldflags="-s -w" -o widgets-service-windows.exe main.go

echo "Building for Linux..."
GOOS=linux GOARCH=amd64 go build -ldflags="-s -w" -o widgets-service-linux main.go

echo "Building for macOS..."
GOOS=darwin GOARCH=amd64 go build -ldflags="-s -w" -o widgets-service-macos main.go

echo "All builds completed!"
echo "Files created:"
echo "- widgets-service (current platform)"
echo "- widgets-service-windows.exe"
echo "- widgets-service-linux"
echo "- widgets-service-macos"
