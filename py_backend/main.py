import os
import sys
import socket
import logging
import signal
import sqlite3
import traceback
from datetime import datetime
from contextlib import contextmanager
from fastapi import FastAPI, HTTPException, Request, File, UploadFile, Form, Depends, Query
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import tempfile
import shutil
from pathlib import Path
from typing import List, Optional, Dict, Any
import json
from pydantic import BaseModel

# Import our DocumentAI class
from ragDbClara import DocumentAI
from langchain_core.documents import Document
from langchain_community.document_loaders import PyPDFLoader
from langchain_community.document_loaders import CSVLoader
from langchain_community.document_loaders import TextLoader  # Fixed import

# Import Speech2Text
from Speech2Text import Speech2Text

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
            
            # Create documents table to track uploaded files
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS documents (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    filename TEXT,
                    file_type TEXT,
                    collection_name TEXT,
                    metadata TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            
            # Create collections table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS collections (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT UNIQUE,
                    description TEXT,
                    document_count INTEGER DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            
            # Create document_chunks table to track individual chunks from a document
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS document_chunks (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    document_id INTEGER,
                    chunk_id TEXT,
                    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
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

# Create a persistent directory for vector databases
vectordb_dir = os.path.join(os.path.expanduser("~"), ".clara", "vectordb")
os.makedirs(vectordb_dir, exist_ok=True)

# Initialize DocumentAI singleton cache
doc_ai_cache = {}

def get_doc_ai(collection_name: str = "default_collection"):
    """Create or retrieve the DocumentAI instance from cache"""
    global doc_ai_cache
    
    # Return cached instance if it exists
    if collection_name in doc_ai_cache:
        return doc_ai_cache[collection_name]
    
    # Create new instance if not in cache
    persist_dir = os.path.join(vectordb_dir, collection_name)
    os.makedirs(persist_dir, exist_ok=True)
    
    # Create new instance and cache it
    doc_ai_cache[collection_name] = DocumentAI(
        persist_directory=persist_dir,
        collection_name=collection_name
    )
    
    return doc_ai_cache[collection_name]

# Speech2Text instance cache
speech2text_instance = None

def get_speech2text():
    """Create or retrieve the Speech2Text instance from cache"""
    global speech2text_instance
    
    if speech2text_instance is None:
        # Use tiny model with CPU for maximum compatibility
        speech2text_instance = Speech2Text(
            model_size="tiny",
            device="cpu",
            compute_type="int8"
        )
    
    return speech2text_instance

# Pydantic models for request/response
class ChatRequest(BaseModel):
    query: str
    collection_name: str = "default_collection"
    system_template: Optional[str] = None
    k: int = 4
    filter: Optional[Dict[str, Any]] = None

class SearchRequest(BaseModel):
    query: str
    collection_name: str = "default_collection"
    k: int = 4
    filter: Optional[Dict[str, Any]] = None

class CollectionCreate(BaseModel):
    name: str
    description: Optional[str] = None

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

@app.get("/health")
def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "port": port,
        "uptime": str(datetime.now() - datetime.fromisoformat(START_TIME))
    }

# Document management endpoints
@app.post("/collections")
def create_collection(collection: CollectionCreate):
    """Create a new document collection"""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "INSERT INTO collections (name, description) VALUES (?, ?)",
                (collection.name, collection.description)
            )
            conn.commit()
            
            # Create directory for this collection's vector store
            persist_dir = os.path.join(vectordb_dir, collection.name)
            os.makedirs(persist_dir, exist_ok=True)
            
            return {"status": "success", "message": f"Collection '{collection.name}' created"}
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=400, detail=f"Collection '{collection.name}' already exists")
    except Exception as e:
        logger.error(f"Error creating collection: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/collections")
def list_collections():
    """List all available document collections"""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT name, description, document_count, created_at FROM collections")
            collections = [dict(row) for row in cursor.fetchall()]
            return {"collections": collections}
    except Exception as e:
        logger.error(f"Error listing collections: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/collections/{collection_name}")
async def delete_collection(collection_name: str):
    """Delete a collection and all its associated documents"""
    try:
        # Get DocumentAI instance for this collection
        doc_ai = get_doc_ai(collection_name)
        
        # Get all document chunks for this collection
        with get_db_connection() as conn:
            cursor = conn.cursor()
            
            # Get all chunk IDs for this collection
            cursor.execute("""
                SELECT dc.chunk_id 
                FROM document_chunks dc
                JOIN documents d ON dc.document_id = d.id
                WHERE d.collection_name = ?
            """, (collection_name,))
            chunks = [row['chunk_id'] for row in cursor.fetchall()]
            
            # Delete chunks from vector store if any exist
            if chunks:
                doc_ai.delete_documents(chunks)
            
            # Delete all documents and chunks from database
            cursor.execute("DELETE FROM documents WHERE collection_name = ?", (collection_name,))
            
            # Delete the collection itself
            cursor.execute("DELETE FROM collections WHERE name = ?", (collection_name,))
            conn.commit()
            
        # Remove from DocumentAI cache
        if collection_name in doc_ai_cache:
            del doc_ai_cache[collection_name]
            
        # Delete the vector store directory
        persist_dir = os.path.join(vectordb_dir, collection_name)
        if os.path.exists(persist_dir):
            shutil.rmtree(persist_dir)
            
        return {
            "status": "success",
            "message": f"Collection '{collection_name}' and its {len(chunks)} chunks deleted"
        }
    except Exception as e:
        logger.error(f"Error deleting collection: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Error deleting collection: {str(e)}")

@app.post("/documents/upload")
async def upload_document(
    file: UploadFile = File(...),
    collection_name: str = Form("default_collection"),
    metadata: str = Form("{}")
):
    """Upload a document file (PDF, CSV, or plain text) and add it to the vector store"""
    # Check if collection exists, create if not
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT name FROM collections WHERE name = ?", (collection_name,))
            if not cursor.fetchone():
                cursor.execute(
                    "INSERT INTO collections (name, description) VALUES (?, ?)",
                    (collection_name, f"Auto-created for {file.filename}")
                )
                conn.commit()
    except Exception as e:
        logger.error(f"Error checking/creating collection: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    
    # Create a temporary directory to save the uploaded file
    with tempfile.TemporaryDirectory() as temp_dir:
        file_path = Path(temp_dir) / file.filename
        
        # Save uploaded file
        try:
            with open(file_path, "wb") as f:
                shutil.copyfileobj(file.file, f)
        except Exception as e:
            logger.error(f"Error saving file: {e}")
            raise HTTPException(status_code=500, detail=f"Could not save file: {str(e)}")
        
        # Process the file based on extension
        file_extension = file.filename.lower().split('.')[-1]
        documents = []
        file_type = file_extension
        
        try:
            if file_extension == 'pdf':
                loader = PyPDFLoader(str(file_path))
                documents = loader.load()
            elif file_extension == 'csv':
                loader = CSVLoader(file_path=str(file_path))
                documents = loader.load()
            elif file_extension in ['txt', 'md', 'html']:
                loader = TextLoader(str(file_path))
                documents = loader.load()
            else:
                raise HTTPException(status_code=400, detail=f"Unsupported file type: {file_extension}")
            
            # Get or create DocumentAI with specific collection - use cache
            doc_ai = get_doc_ai(collection_name)
            
            # Parse metadata if provided
            try:
                meta_dict = json.loads(metadata)
                
                # Add file metadata to each document
                for doc in documents:
                    doc.metadata.update(meta_dict)
                    doc.metadata["source_file"] = file.filename
                    doc.metadata["file_type"] = file_extension
            except json.JSONDecodeError:
                logger.warning(f"Invalid metadata JSON: {metadata}")
            
            # Add documents to vector store
            doc_ids = doc_ai.add_documents(documents)
            
            # Update database
            with get_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    "INSERT INTO documents (filename, file_type, collection_name, metadata) VALUES (?, ?, ?, ?)",
                    (file.filename, file_type, collection_name, metadata)
                )
                document_id = cursor.lastrowid
                
                # Store the relationship between document and its chunks
                for chunk_id in doc_ids:
                    cursor.execute(
                        "INSERT INTO document_chunks (document_id, chunk_id) VALUES (?, ?)",
                        (document_id, chunk_id)
                    )
                
                # Update document count in collection
                cursor.execute(
                    "UPDATE collections SET document_count = document_count + ? WHERE name = ?",
                    (1, collection_name)  # Only count the original document, not chunks
                )
                conn.commit()
            
            return {
                "status": "success",
                "filename": file.filename,
                "collection": collection_name,
                "document_count": len(documents),
                "document_ids": doc_ids[:5] + ['...'] if len(doc_ids) > 5 else doc_ids
            }
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error processing document: {str(e)}")
            logger.error(traceback.format_exc())
            raise HTTPException(status_code=500, detail=f"Error processing document: {str(e)}")

@app.get("/documents")
async def list_documents(collection_name: Optional[str] = None):
    """List all documents, optionally filtered by collection"""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            
            query = """
                SELECT d.id, d.filename, d.file_type, d.collection_name, d.metadata, 
                       d.created_at, COUNT(dc.id) as chunk_count 
                FROM documents d
                LEFT JOIN document_chunks dc ON d.id = dc.document_id
            """
            
            params = []
            if collection_name:
                query += " WHERE d.collection_name = ?"
                params.append(collection_name)
                
            query += " GROUP BY d.id"
            
            cursor.execute(query, params)
            documents = [dict(row) for row in cursor.fetchall()]
            
            return {"documents": documents}
    except Exception as e:
        logger.error(f"Error listing documents: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Error listing documents: {str(e)}")

@app.delete("/documents/{document_id}")
async def delete_document(document_id: int):
    """Delete a document and all its chunks from the database and vector store"""
    try:
        # Get document details and chunk IDs
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT collection_name FROM documents WHERE id = ?", 
                (document_id,)
            )
            document = cursor.fetchone()
            
            if not document:
                raise HTTPException(status_code=404, detail=f"Document with ID {document_id} not found")
                
            collection_name = document['collection_name']
            
            # Get all chunks related to this document
            cursor.execute(
                "SELECT chunk_id FROM document_chunks WHERE document_id = ?", 
                (document_id,)
            )
            chunks = [row['chunk_id'] for row in cursor.fetchall()]
            
            # Get DocumentAI instance for this collection
            doc_ai = get_doc_ai(collection_name)
            
            # Delete chunks from vector store
            if chunks:
                doc_ai.delete_documents(chunks)
            
            # Delete document chunks first (in case CASCADE doesn't work)
            cursor.execute(
                "DELETE FROM document_chunks WHERE document_id = ?", 
                (document_id,)
            )
            
            # Delete the document itself
            cursor.execute(
                "DELETE FROM documents WHERE id = ?", 
                (document_id,)
            )
            
            # Update document count in collection
            cursor.execute(
                "UPDATE collections SET document_count = document_count - 1 WHERE name = ? AND document_count > 0",
                (collection_name,)
            )
            conn.commit()
            
        return {
            "status": "success", 
            "message": f"Document {document_id} and its {len(chunks)} chunks deleted"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting document: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Error deleting document: {str(e)}")

# Improved helper function to validate and format filters
def format_chroma_filter(filter_dict: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """Format a filter dictionary to be compatible with Chroma"""
    if not filter_dict:
        return None
        
    chroma_filter = {}
    for key, value in filter_dict.items():
        # Skip empty values
        if value is None or (isinstance(value, dict) and not value):
            continue
            
        if isinstance(value, dict):
            # Check if it has valid operators
            if not any(op.startswith('$') for op in value.keys()):
                # Convert to $eq if no operators
                chroma_filter[key] = {"$eq": value}
            else:
                # Already has operators
                chroma_filter[key] = value
        else:
            # Simple value, convert to $eq
            chroma_filter[key] = {"$eq": value}
    
    # Return None if the filter ended up empty
    return chroma_filter if chroma_filter else None

@app.post("/documents/search")
async def search_documents(request: SearchRequest):
    """Search documents in the vector store for ones similar to the query"""
    try:
        # Get DocumentAI with specific collection from cache
        doc_ai = get_doc_ai(request.collection_name)
        
        # Format the filter if provided, otherwise pass None
        formatted_filter = format_chroma_filter(request.filter)
        
        # Perform similarity search
        results = doc_ai.similarity_search(
            query=request.query,
            k=request.k,
            filter=formatted_filter
        )
        
        # Format results
        formatted_results = []
        for doc in results:
            formatted_results.append({
                "content": doc.page_content,
                "metadata": doc.metadata,
                "score": doc.metadata.get("score", None)  # Some vector stores return scores
            })
        
        return {
            "query": request.query,
            "collection": request.collection_name,
            "results": formatted_results
        }
    except Exception as e:
        logger.error(f"Error searching documents: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Error searching documents: {str(e)}")

@app.post("/chat")
async def chat_with_documents(request: ChatRequest):
    """Chat with the AI using documents as context"""
    try:
        # Get DocumentAI with specific collection from cache
        doc_ai = get_doc_ai(request.collection_name)
        
        # Use default or custom system template
        system_template = request.system_template
        
        # Format the filter if provided, otherwise pass None
        formatted_filter = format_chroma_filter(request.filter)
        
        # Get response from AI
        if system_template:
            response = doc_ai.chat_with_context(
                query=request.query,
                k=request.k,
                filter=formatted_filter,
                system_template=system_template
            )
        else:
            response = doc_ai.chat_with_context(
                query=request.query,
                k=request.k,
                filter=formatted_filter
            )
        
        return {
            "query": request.query,
            "collection": request.collection_name,
            "response": response
        }
    except Exception as e:
        logger.error(f"Error in chat: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Error in chat: {str(e)}")

# Direct chat without documents
@app.post("/chat/direct")
async def direct_chat(query: str, system_prompt: Optional[str] = None):
    """Chat directly with the AI without document context"""
    try:
        # Get DocumentAI instance
        doc_ai = get_doc_ai()
        
        # Use default or custom system prompt
        system_prompt = system_prompt or "You are a helpful assistant."
        
        # Get response from AI
        response = doc_ai.chat(
            user_message=query,
            system_prompt=system_prompt
        )
        
        return {
            "query": query,
            "response": response
        }
    except Exception as e:
        logger.error(f"Error in direct chat: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Error in direct chat: {str(e)}")

# Audio transcription endpoint
@app.post("/transcribe")
async def transcribe_audio(
    file: UploadFile = File(...),
    language: Optional[str] = Form(None),
    beam_size: int = Form(5),
    initial_prompt: Optional[str] = Form(None)
):
    """Transcribe an audio file using faster-whisper (CPU mode)"""
    # Validate file extension
    supported_formats = ['mp3', 'wav', 'flac', 'm4a', 'ogg', 'opus']
    file_extension = file.filename.lower().split('.')[-1]
    
    if file_extension not in supported_formats:
        raise HTTPException(
            status_code=400, 
            detail=f"Unsupported audio format: {file_extension}. Supported formats: {', '.join(supported_formats)}"
        )
    
    # Read file content
    try:
        content = await file.read()
        if not content:
            raise HTTPException(status_code=400, detail="Empty audio file")
    except Exception as e:
        logger.error(f"Error reading audio file: {e}")
        raise HTTPException(status_code=500, detail=f"Error reading audio file: {str(e)}")
    
    # Get Speech2Text instance
    try:
        s2t = get_speech2text()
    except Exception as e:
        logger.error(f"Error initializing Speech2Text: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to initialize Speech2Text: {str(e)}")
    
    # Transcribe the audio
    try:
        result = s2t.transcribe_bytes(
            content,
            language=language,
            beam_size=beam_size,
            initial_prompt=initial_prompt
        )
        
        return {
            "status": "success",
            "filename": file.filename,
            "transcription": result
        }
    except Exception as e:
        logger.error(f"Error transcribing audio: {e}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Error transcribing audio: {str(e)}")

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
