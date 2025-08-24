#!/bin/bash

# Clara Backend Docker Build Script
# Builds optimized Docker images for CPU and GPU deployments

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
IMAGE_NAME="clara17verse/clara-backend"
PLATFORM="linux/amd64,linux/arm64"
PUSH=${PUSH:-false}
GPU_ONLY=${GPU_ONLY:-false}

echo -e "${BLUE}🚀 Clara Backend Docker Build Script${NC}"
echo "=================================================="

# Function to build and tag image
build_image() {
    local dockerfile=$1
    local tag_suffix=$2
    local description=$3
    local requirements_file=${4:-requirements.txt}
    
    echo -e "${YELLOW}📦 Building $description...${NC}"
    
    # Copy the appropriate requirements file
    if [ "$requirements_file" != "requirements.txt" ]; then
        echo "Using optimized requirements: $requirements_file"
        cp "$requirements_file" requirements-build.txt
    else
        cp requirements.txt requirements-build.txt
    fi
    
    # Build for local platform first (faster testing)
    echo -e "${BLUE}Building for local platform...${NC}"
    docker build \
        -f "$dockerfile" \
        -t "${IMAGE_NAME}:${tag_suffix}" \
        -t "${IMAGE_NAME}:${tag_suffix}-$(date +%Y%m%d)" \
        --build-arg REQUIREMENTS_FILE=requirements-build.txt \
        .
    
    # Build multi-platform if pushing
    if [ "$PUSH" = "true" ]; then
        echo -e "${BLUE}Building multi-platform and pushing...${NC}"
        docker buildx build \
            --platform "$PLATFORM" \
            -f "$dockerfile" \
            -t "${IMAGE_NAME}:${tag_suffix}" \
            -t "${IMAGE_NAME}:${tag_suffix}-$(date +%Y%m%d)" \
            --build-arg REQUIREMENTS_FILE=requirements-build.txt \
            --push \
            .
    fi
    
    # Cleanup
    rm -f requirements-build.txt
    
    echo -e "${GREEN}✅ $description build complete!${NC}"
}

# Function to show image sizes
show_image_info() {
    echo -e "${BLUE}📊 Image Information:${NC}"
    echo "=================================================="
    docker images "${IMAGE_NAME}" --format "table {{.Repository}}:{{.Tag}}\t{{.Size}}\t{{.CreatedAt}}"
    echo ""
}

# Function to test image
test_image() {
    local tag=$1
    echo -e "${YELLOW}🧪 Testing ${IMAGE_NAME}:${tag}...${NC}"
    
    # Test basic container startup
    docker run --rm -d \
        --name clara-backend-test \
        -p 5099:5000 \
        "${IMAGE_NAME}:${tag}" || {
        echo -e "${RED}❌ Failed to start container${NC}"
        return 1
    }
    
    # Wait a moment for startup
    sleep 5
    
    # Test health endpoint
    if curl -f http://localhost:5099/health >/dev/null 2>&1; then
        echo -e "${GREEN}✅ Health check passed${NC}"
        docker stop clara-backend-test
        return 0
    else
        echo -e "${RED}❌ Health check failed${NC}"
        docker logs clara-backend-test
        docker stop clara-backend-test
        return 1
    fi
}

# Main build process
main() {
    echo "Build Configuration:"
    echo "  - Platform: $PLATFORM"
    echo "  - Push to registry: $PUSH"
    echo "  - GPU only: $GPU_ONLY"
    echo ""
    
    if [ "$GPU_ONLY" = "true" ]; then
        echo -e "${YELLOW}Building GPU-optimized version only...${NC}"
        build_image "Dockerfile.gpu" "latest-gpu" "GPU-optimized Clara Backend" "requirements-optimized.txt"
        test_image "latest-gpu"
    else
        # Build standard version
        build_image "Dockerfile" "latest" "Standard Clara Backend" "requirements.txt"
        
        # Build GPU-optimized version
        if [ -f "Dockerfile.gpu" ]; then
            build_image "Dockerfile.gpu" "latest-gpu" "GPU-optimized Clara Backend" "requirements-optimized.txt"
            
            # Test both images
            echo -e "${YELLOW}🧪 Testing images...${NC}"
            test_image "latest"
            test_image "latest-gpu"
        fi
    fi
    
    show_image_info
    
    echo -e "${GREEN}🎉 Build process complete!${NC}"
    echo ""
    echo "Usage examples:"
    echo "  CPU version:  docker run -p 5000:5000 ${IMAGE_NAME}:latest"
    echo "  GPU version:  docker run --gpus all -p 5000:5000 ${IMAGE_NAME}:latest-gpu"
    echo ""
    echo "To push images: PUSH=true ./build-docker.sh"
    echo "To build GPU only: GPU_ONLY=true ./build-docker.sh"
}

# Run main function
main "$@"
