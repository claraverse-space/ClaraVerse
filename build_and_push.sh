#!/bin/bash
set -e

# Configuration
IMAGE_NAME="clara17verse/clara-interpreter"
TAG="latest"
DOCKERFILE_PATH="./Dockerfile"  # Path to your Dockerfile

# Login to Docker Hub - uncomment and run manually if not logged in
# docker login -u clara17verse

# Create and use a new builder that supports multi-arch builds
docker buildx create --name multiarch-builder --use

# Build for multiple platforms and push to Docker Hub
echo "Building and pushing multi-architecture image: ${IMAGE_NAME}:${TAG}"
docker buildx build --platform linux/amd64,linux/arm64 \
  -t ${IMAGE_NAME}:${TAG} \
  --push \
  -f ${DOCKERFILE_PATH} .

echo "Successfully built and pushed ${IMAGE_NAME}:${TAG} for multiple architectures"

# Optional: List the supported architectures of the pushed image
echo "Listing supported architectures:"
docker buildx imagetools inspect ${IMAGE_NAME}:${TAG}

# Clean up
docker buildx rm multiarch-builder

echo "Build and push completed successfully!" 