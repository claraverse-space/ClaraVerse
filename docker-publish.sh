#!/bin/bash

# Check if DOCKER_USERNAME is set
if [ -z "$DOCKER_USERNAME" ]; then
    echo "Please set DOCKER_USERNAME environment variable"
    echo "Usage: DOCKER_USERNAME=yourusername ./docker-publish.sh"
    exit 1
fi

# Build the image
docker build -t $DOCKER_USERNAME/clara-ollama:latest .

# Login to Docker Hub
docker login

# Push the image
docker push $DOCKER_USERNAME/clara-ollama:latest

echo "Successfully published to Docker Hub as $DOCKER_USERNAME/clara-ollama:latest"
echo "Users can now pull and run using:"
echo "docker pull $DOCKER_USERNAME/clara-ollama:latest"
echo "docker run -p 8069:8069 $DOCKER_USERNAME/clara-ollama:latest"
