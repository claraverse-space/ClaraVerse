FROM python:3.11-slim

# Add labels for the image
LABEL org.opencontainers.image.title="Clara Backend"
LABEL org.opencontainers.image.description="Clara AI Assistant Backend Service"
LABEL org.opencontainers.image.authors="Clara Team"
LABEL org.opencontainers.image.source="https://github.com/clara17verse/clara"
LABEL org.opencontainers.image.licenses="MIT"
LABEL org.opencontainers.image.vendor="Clara"
LABEL org.opencontainers.image.version="1.0.0"

WORKDIR /app

# Install system dependencies
RUN apt-get update \
    && apt-get install -y \
        build-essential \
        curl \
    && rm -rf /var/lib/apt/lists/*

# install uv for pip
RUN pip install uv

# Copy requirements first to leverage Docker cache
COPY requirements.txt .

# Install dependencies with platform-specific optimizations
RUN uv pip install -r requirements.txt --system && \
    rm -rf /root/.cache/pip/*

# Copy application code first
COPY . .

# Create data directory
RUN mkdir -p /app/data

# Create startup script that downloads spaCy model if needed
RUN echo '#!/bin/bash\n\
if ! python -c "import spacy; spacy.load(\"en_core_web_sm\")" 2>/dev/null; then\n\
    echo "Downloading spaCy model..."\n\
    python -m spacy download en_core_web_sm || echo "SpaCy model download failed, continuing anyway..."\n\
fi\n\
exec "$@"' > /app/entrypoint.sh && chmod +x /app/entrypoint.sh

# Set environment variables
ENV HOST="0.0.0.0" \
    PORT=5000 \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    NUMPY_ALLOCATE_DEFAULT=0

# Create a non-root user
RUN useradd -m -r -u 1000 clara && \
    chown -R clara:clara /app

# Switch to non-root user
USER clara

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:${PORT}/health || exit 1

# Run the application with environment variables
ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["sh", "-c", "python main.py --host $HOST --port $PORT"] 