#!/usr/bin/env python3
import os
import sys
import socket
import logging
import signal
import sqlite3
import traceback
from datetime import datetime
from contextlib import contextmanager
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler()]
)
logger = logging.getLogger("clara-backend")

# Default port configuration - check environment first, then try to find available port
DEFAULT_PORT = int(os.environ.get("CLARA_PORT", "8099"))
PORT_RANGE_MIN = 8090
PORT_RANGE_MAX = 8199
START_TIME = datetime.now().isoformat()

def find_available_port(start_port=DEFAULT_PORT, max_port=PORT_RANGE_MAX):
    """Find an available port between start_port and max_port."""
    for port in range(start_port, max_port + 1):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind(('127.0.0.1', port))
                return port
            except socket.error:
                continue
    return None

# Find an available port (use environment-provided port first)
port = DEFAULT_PORT
if port:
    # Test if the provided port is available
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        try:
            s.bind(('127.0.0.1', port))
        except socket.error:
            # Port is in use, find another one
            logger.warning(f"Port {port} is in use, finding another one")
            port = find_available_port(PORT_RANGE_MIN, PORT_RANGE_MAX)
else:
    # No port specified, find one
    port = find_available_port(PORT_RANGE_MIN, PORT_RANGE_MAX)

if port is None:
    logger.error(f"No available ports found in range {PORT_RANGE_MIN}-{PORT_RANGE_MAX}")
    sys.exit(1)

# Print port info in a structured format that Electron can parse
print(f"CLARA_PORT:{port}")
logger.info(f"Selected port: {port}")

# Setup FastAPI
app = FastAPI(title="Clara Backend API", version="1.0.0")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add global exception middleware
@app.middleware("http")
async def catch_exceptions_middleware(request: Request, call_next):
    try:
        return await call_next(request)
    except Exception as e:
        logger.error(f"Request to {request.url} failed: {str(e)}")
        logger.error(traceback.format_exc())
        return JSONResponse(
            status_code=500,
            content={"error": str(e), "detail": traceback.format_exc()}
        )

# Database path in user's home directory for persistence
home_dir = os.path.expanduser("~")
data_dir = os.path.join(home_dir, ".clara")
os.makedirs(data_dir, exist_ok=True)
DATABASE = os.path.join(data_dir, "clara.db")

@contextmanager
def get_db_connection():
    """Context manager for database connections"""
    conn = None
    try:
        conn = sqlite3.connect(DATABASE)
        conn.row_factory = sqlite3.Row
        yield conn
    except sqlite3.Error as e:
        logger.error(f"Database error: {e}")
        raise HTTPException(status_code=500, detail="Database error")
    finally:
        if conn:
            conn.close()

def init_db():
    """Initialize the database with tables"""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            # Create test table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS test (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    value TEXT
                )
            """)
            
            # Check if test data exists
            cursor.execute("SELECT COUNT(*) FROM test")
            count = cursor.fetchone()[0]
            if count == 0:
                cursor.execute("INSERT INTO test (value) VALUES ('Hello from SQLite')")
                conn.commit()
                
        logger.info("Database initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize database: {e}")
        raise

# Initialize the database
init_db()

@app.get("/")
def read_root():
    """Root endpoint for basic health check"""
    return {
        "status": "ok", 
        "service": "Clara Backend", 
        "port": port,
        "uptime": str(datetime.now() - datetime.fromisoformat(START_TIME)),
        "start_time": START_TIME
    }

@app.get("/test")
def read_test():
    """Test endpoint that returns data from the database"""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT id, value FROM test LIMIT 1")
            row = cursor.fetchone()
            
        if row:
            return JSONResponse(content={"id": row[0], "value": row[1], "port": port})
        return JSONResponse(content={"error": "No data found", "port": port})
    except Exception as e:
        logger.error(f"Error in /test endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Health check endpoint
@app.get("/health")
def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "port": port,
        "uptime": str(datetime.now() - datetime.fromisoformat(START_TIME))
    }

# Handle graceful shutdown
def handle_exit(signum, frame):
    logger.info(f"Received signal {signum}, shutting down gracefully")
    sys.exit(0)

# Register signal handlers
signal.signal(signal.SIGINT, handle_exit)
signal.signal(signal.SIGTERM, handle_exit)

if __name__ == "__main__":
    import uvicorn
    logger.info(f"Starting server on port {port}")
    
    # Start the server with reload=False to prevent duplicate processes
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        log_level="info",
        reload=False  # Change this to false to prevent multiple processes
    )
