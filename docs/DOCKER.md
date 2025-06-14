# Clara Ollama Docker Guide

Clara Ollama is now available as a Docker container. You can run it without installing anything except Docker.

## Quick Start

```bash
docker pull claraverse/clara-ollama:latest
docker run -p 8069:8069 claraverse/clara-ollama:latest
```

Then open http://localhost:8069 in your browser.

## For Developers

To build and publish:

1. Set your Docker Hub username:
```bash
export DOCKER_USERNAME=your-username
```

2. Run the publish script:
```bash
npm run docker:publish
```

## Environment Variables

None required - Clara runs completely client-side!

## Port

The application runs on port 8069 by default.
