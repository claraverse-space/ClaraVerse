#!/bin/bash
# Production optimized Docker build for Clara Backend
set -e

echo "Building Production Optimized Clara Backend Image..."

# Change to the backend directory
cd "$(dirname "$0")/../py_backend"

# Check if Docker is running
if ! docker info >/dev/null 2>&1; then
    echo "Error: Docker is not running. Please start Docker."
    exit 1
fi

# Check if user is logged in to Docker Hub
if ! docker info 2>/dev/null | grep -q "Username: clara17verse"; then
    echo "Please log in to Docker Hub first"
    docker login -u clara17verse
    if [ $? -ne 0 ]; then
        echo "Login failed. Exiting."
        exit 1
    fi
fi

# Create and use buildx builder if it doesn't exist
if ! docker buildx ls | grep -q "clarabuilder"; then
    echo "Creating buildx builder..."
    docker buildx create --name clarabuilder --use
    if [ $? -ne 0 ]; then
        echo "Failed to create buildx builder. Exiting."
        exit 1
    fi
fi

# Build optimized images for both architectures and push
echo "Building and pushing optimized Docker images..."
docker buildx build --platform linux/amd64,linux/arm64 \
    -f Dockerfile.gpu \
    -t clara17verse/clara-backend:latest \
    -t clara17verse/clara-backend:latest-amd64 \
    -t clara17verse/clara-backend:latest-arm64 \
    --push .

echo ""
echo "===================================="
echo "Production optimized Docker image built and pushed successfully!"
echo "===================================="
echo ""
echo "Images pushed to Docker Hub:"
echo "- clara17verse/clara-backend:latest (multi-arch optimized)"
echo "- clara17verse/clara-backend:latest-amd64 (AMD64 optimized)"
echo "- clara17verse/clara-backend:latest-arm64 (ARM64 optimized)"
echo ""
echo "Production images are ready for deployment with GPU support!"
echo "dockerSetup.cjs will automatically handle GPU enable/disable based on target system."
echo "" 