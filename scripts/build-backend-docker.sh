#!/bin/bash

# Exit on any error
set -e

# Change to the backend directory
cd "$(dirname "$0")/../py_backend"

# Check if user is logged in to Docker Hub
if ! docker info 2>/dev/null | grep -q "Username: clara17verse"; then
    echo "Please log in to Docker Hub first"
    docker login -u clara17verse
fi

# Create and use buildx builder if it doesn't exist
if ! docker buildx ls | grep -q "clarabuilder"; then
    echo "Creating buildx builder..."
    docker buildx create --name clarabuilder --use
fi

# Build and push for both architectures
echo "Building and pushing Docker image..."
docker buildx build --platform linux/amd64,linux/arm64 \
    -t clara17verse/clara-backend:latest \
    -t clara17verse/clara-backend:1.0.0 \
    --push .

echo "Docker image built and pushed successfully!" 