FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first to leverage Docker cache
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create data directory
RUN mkdir -p /app/data

# Set environment variables
ENV HOST="0.0.0.0"
ENV PORT=5000

# Expose port
EXPOSE 5000

# Run the application with environment variables
CMD ["sh", "-c", "python main.py --host $HOST --port $PORT"] 