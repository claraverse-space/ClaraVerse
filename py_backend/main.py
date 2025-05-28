import os
import sys
import socket
import logging
import signal
import sqlite3
import traceback
import time
import argparse
from datetime import datetime
from contextlib import contextmanager
from fastapi import FastAPI, HTTPException, Request, File, UploadFile, Form, Depends, Query
from fastapi.responses import JSONResponse, Response
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

# Import Text2Speech
from Text2Speech import Text2Speech

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler()]
)
logger = logging.getLogger("clara-backend")

# Store start time
START_TIME = datetime.now().isoformat()

# Parse command line arguments
parser = argparse.ArgumentParser(description='Clara Backend Server')
parser.add_argument('--host', type=str, default='127.0.0.1', help='Host to bind to')
parser.add_argument('--port', type=int, default=5000, help='Port to bind to')
args = parser.parse_args()

# Use the provided host and port
HOST = args.host
PORT = args.port

logger.info(f"Starting server on {HOST}:{PORT}")

# Setup FastAPI
app = FastAPI(title="Clara Backend API", version="1.0.0")

# Import and include the diffusers API router
try:
    from diffusers_api import router as diffusers_router
    app.include_router(diffusers_router, prefix="/diffusers")
except Exception as e:
    logger.warning(f"Diffusers API not loaded: {e}")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"]
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

# Maximum number of retries for database operations
MAX_RETRIES = 3
RETRY_DELAY = 0.1  # seconds

@contextmanager
def get_db_connection(timeout=20):
    """Context manager for database connections with retry logic"""
    conn = None
    retries = 0
    last_error = None
    
    while retries < MAX_RETRIES:
        try:
            conn = sqlite3.connect(DATABASE, timeout=timeout)
            conn.row_factory = sqlite3.Row
            # Enable WAL mode for better concurrency
            conn.execute('PRAGMA journal_mode=WAL')
            # Set busy timeout
            conn.execute(f'PRAGMA busy_timeout={timeout * 1000}')
            yield conn
            return
        except sqlite3.Error as e:
            last_error = e
            if conn:
                try:
                    conn.close()
                except:
                    pass
            retries += 1
            if retries < MAX_RETRIES:
                time.sleep(RETRY_DELAY * (2 ** retries))  # Exponential backoff
            logger.warning(f"Database retry {retries}/{MAX_RETRIES}: {str(e)}")
    
    logger.error(f"Database error after {MAX_RETRIES} retries: {last_error}")
    raise HTTPException(
        status_code=500,
        detail=f"Database error: {str(last_error)}"
    )

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
            
            # Create clara-assistant collection if it doesn't exist
            cursor.execute("""
                INSERT OR IGNORE INTO collections (name, description)
                VALUES ('clara-assistant', 'Default collection for Clara Assistant')
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
        logger.error(traceback.format_exc())
        raise

# Initialize the database
init_db()

# Create a persistent directory for vector databases
vectordb_dir = os.path.join(os.path.expanduser("~"), ".clara", "vectordb")
temp_vectordb_dir = os.path.join(vectordb_dir, "temp")  # Add directory for temporary collections
os.makedirs(vectordb_dir, exist_ok=True)
os.makedirs(temp_vectordb_dir, exist_ok=True)  # Create temp directory

# Initialize DocumentAI singleton cache
doc_ai_cache = {}

def get_doc_ai(collection_name: str = "default_collection"):
    """Create or retrieve the DocumentAI instance from cache"""
    global doc_ai_cache
    
    # Return cached instance if it exists
    if collection_name in doc_ai_cache:
        return doc_ai_cache[collection_name]
    
    # Create new instance if not in cache
    if collection_name.startswith("temp_collection_"):
        # Use temp directory for temporary collections
        persist_dir = os.path.join(temp_vectordb_dir, collection_name)
    else:
        # Use regular directory for permanent collections
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

# Text2Speech instance cache
text2speech_instance = None

def get_text2speech():
    """Create or retrieve the Text2Speech instance from cache"""
    global text2speech_instance
    
    if text2speech_instance is None:
        # Initialize with auto engine selection (will prefer Kokoro if available)
        text2speech_instance = Text2Speech(
            engine="auto",
            language="en",
            slow=False,
            voice="af_sarah",
            speed=1.0
        )
    
    return text2speech_instance

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

class TTSRequest(BaseModel):
    text: str
    language: Optional[str] = "en"
    engine: Optional[str] = None  # "gtts", "pyttsx3", "kokoro", "kokoro-onnx", or None for current engine
    slow: Optional[bool] = False
    voice: Optional[str] = "af_sarah"  # Voice for Kokoro engines
    speed: Optional[float] = 1.0  # Speed for Kokoro engines (0.5-2.0)

@app.get("/")
def read_root():
    """Root endpoint for basic health check"""
    return {
        "status": "ok", 
        "service": "Clara Backend", 
        "port": PORT,
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
            return JSONResponse(content={"id": row[0], "value": row[1], "port": PORT})
        return JSONResponse(content={"error": "No data found", "port": PORT})
    except Exception as e:
        logger.error(f"Error in /test endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "port": PORT,
        "uptime": str(datetime.now() - datetime.fromisoformat(START_TIME))
    }

# Document management endpoints
@app.post("/collections")
async def create_collection(collection: CollectionCreate):
    """Create a new collection"""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            
            # First check if collection exists
            cursor.execute(
                "SELECT name FROM collections WHERE name = ?",
                (collection.name,)
            )
            existing = cursor.fetchone()
            
            if existing:
                return JSONResponse(
                    status_code=409,
                    content={"detail": f"Collection '{collection.name}' already exists"}
                )
            
            # Create the collection
            try:
                cursor.execute(
                    """
                    INSERT INTO collections (name, description)
                    VALUES (?, ?)
                    """,
                    (collection.name, collection.description or "")
                )
                conn.commit()
            except sqlite3.IntegrityError:
                # Handle race condition where collection was created between our check and insert
                return JSONResponse(
                    status_code=409,
                    content={"detail": f"Collection '{collection.name}' already exists"}
                )
            
            # Initialize vector store for the collection
            get_doc_ai(collection.name)
            
            return {"message": f"Collection '{collection.name}' created successfully"}
            
    except Exception as e:
        logger.error(f"Error creating collection: {e}")
        logger.error(traceback.format_exc())
        raise HTTPException(
            status_code=500,
            detail=f"Database error: {str(e)}"
        )

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
    """Delete a collection and all its documents"""
    try:
        # Delete from vector store first
        doc_ai = get_doc_ai(collection_name)
        
        # Get all document chunks for this collection
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT dc.chunk_id
                FROM document_chunks dc
                JOIN documents d ON d.id = dc.document_id
                WHERE d.collection_name = ?
            """, (collection_name,))
            chunk_ids = [row[0] for row in cursor.fetchall()]
            
            if chunk_ids:
                # Delete chunks from vector store
                doc_ai.delete_documents(chunk_ids)
            
            # Delete all documents and chunks from SQLite
            cursor.execute("DELETE FROM documents WHERE collection_name = ?", (collection_name,))
            
            # Delete collection record
            cursor.execute("DELETE FROM collections WHERE name = ?", (collection_name,))
            conn.commit()
            
        # Remove from cache to force recreation
        if collection_name in doc_ai_cache:
            del doc_ai_cache[collection_name]
            
        return {"message": f"Collection {collection_name} deleted successfully"}
        
    except Exception as e:
        logger.error(f"Error deleting collection: {e}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/collections/recreate")
async def recreate_collection(collection_name: str = "default_collection"):
    """Recreate a collection by deleting and reinitializing it"""
    try:
        # Get persist directory path
        persist_dir = os.path.join(vectordb_dir, collection_name)
        if collection_name.startswith("temp_collection_"):
            persist_dir = os.path.join(temp_vectordb_dir, collection_name)

        # Remove from cache first to ensure we don't have any lingering instances
        if collection_name in doc_ai_cache:
            del doc_ai_cache[collection_name]

        # Delete the directory completely if it exists
        if os.path.exists(persist_dir):
            try:
                shutil.rmtree(persist_dir)
                logger.info(f"Deleted persist directory: {persist_dir}")
            except Exception as e:
                logger.error(f"Error deleting directory: {e}")
                # Even if directory deletion fails, continue with recreation

        # Delete all documents from the database
        with get_db_connection() as conn:
            cursor = conn.cursor()
            # Delete all documents and chunks from SQLite
            cursor.execute("DELETE FROM document_chunks WHERE document_id IN (SELECT id FROM documents WHERE collection_name = ?)", (collection_name,))
            cursor.execute("DELETE FROM documents WHERE collection_name = ?", (collection_name,))
            cursor.execute("DELETE FROM collections WHERE name = ?", (collection_name,))
            conn.commit()

        # Create directory for new collection
        os.makedirs(persist_dir, exist_ok=True)
        
        # Get a fresh DocumentAI instance
        doc_ai = DocumentAI(
            persist_directory=persist_dir,
            collection_name=collection_name
        )
        
        # Store in cache
        doc_ai_cache[collection_name] = doc_ai
        
        # Create new collection record
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "INSERT INTO collections (name, description) VALUES (?, ?)",
                (collection_name, f"Recreated collection {collection_name}")
            )
            conn.commit()
        
        return {
            "message": f"Collection {collection_name} recreated successfully",
            "collection_name": collection_name
        }
        
    except Exception as e:
        logger.error(f"Error recreating collection: {e}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

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

# Text-to-Speech endpoints
@app.post("/synthesize")
async def synthesize_text(request: TTSRequest):
    """
    Synthesize text to speech and return audio data.
    Supports multiple TTS engines including Kokoro for high-quality neural TTS.
    """
    try:
        logger.info(f"TTS request: text='{request.text[:50]}...', engine={request.engine}, voice={request.voice}, speed={request.speed}")
        
        # Get Text2Speech instance
        t2s = get_text2speech()
        
        # If specific engine requested, create new instance with those settings
        if request.engine and request.engine != t2s.engine:
            logger.info(f"Creating new TTS instance with engine: {request.engine}")
            t2s = Text2Speech(
                engine=request.engine,
                language=request.language or "en",
                slow=request.slow or False,
                voice=request.voice or "af_sarah",
                speed=request.speed or 1.0
            )
        
        # Generate speech
        audio_bytes = t2s.synthesize_to_bytes(request.text)
        
        # Determine content type based on engine
        if request.engine in ["kokoro", "kokoro-onnx"]:
            content_type = "audio/wav"
        else:
            content_type = "audio/mpeg"
        
        return Response(
            content=audio_bytes,
            media_type=content_type,
            headers={
                "Content-Disposition": "attachment; filename=speech.wav" if request.engine in ["kokoro", "kokoro-onnx"] else "attachment; filename=speech.mp3"
            }
        )
        
    except Exception as e:
        logger.error(f"Error in TTS synthesis: {e}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"TTS synthesis failed: {str(e)}")

@app.post("/synthesize/file")
async def synthesize_text_to_file(
    text: str = Form(...),
    language: Optional[str] = Form("en"),
    engine: Optional[str] = Form(None),
    slow: Optional[bool] = Form(False),
    voice: Optional[str] = Form("af_sarah"),
    speed: Optional[float] = Form(1.0),
    filename: Optional[str] = Form("speech.mp3")
):
    """
    Synthesize text to speech and return as downloadable file.
    Supports multiple TTS engines including Kokoro for high-quality neural TTS.
    """
    try:
        logger.info(f"TTS file request: text='{text[:50]}...', engine={engine}, voice={voice}, speed={speed}")
        
        # Get Text2Speech instance
        t2s = get_text2speech()
        
        # If a specific engine is requested and different from current
        if engine and engine != t2s.engine:
            logger.info(f"Creating new TTS instance with engine: {engine}")
            t2s = Text2Speech(
                engine=engine,
                language=language or "en",
                slow=slow or False,
                voice=voice or "af_sarah",
                speed=speed or 1.0
            )
        
        # Determine file extension based on engine
        if engine in ["kokoro", "kokoro-onnx"]:
            file_ext = ".wav"
            content_type = "audio/wav"
        else:
            file_ext = ".mp3"
            content_type = "audio/mpeg"
        
        # Ensure filename has correct extension
        if not filename.endswith(file_ext):
            filename = os.path.splitext(filename)[0] + file_ext
        
        # Create temporary file
        with tempfile.NamedTemporaryFile(delete=False, suffix=file_ext) as temp_file:
            temp_path = temp_file.name
        
        try:
            # Generate speech to file
            output_path = t2s.synthesize_to_file(text, temp_path)
            
            # Read the file
            with open(output_path, 'rb') as f:
                audio_data = f.read()
            
            return Response(
                content=audio_data,
                media_type=content_type,
                headers={
                    "Content-Disposition": f"attachment; filename={filename}",
                    "Content-Length": str(len(audio_data))
                }
            )
            
        finally:
            # Clean up temp file
            try:
                os.unlink(temp_path)
            except:
                pass
        
    except Exception as e:
        logger.error(f"Error in TTS file synthesis: {e}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"TTS file synthesis failed: {str(e)}")

@app.get("/tts/languages")
async def get_tts_languages():
    """Get available languages for text-to-speech"""
    try:
        t2s = get_text2speech()
        languages = t2s.get_available_languages()
        
        return {
            "engine": t2s.engine,
            "current_language": t2s.language,
            "available_languages": languages
        }
    except Exception as e:
        logger.error(f"Error getting TTS languages: {e}")
        raise HTTPException(status_code=500, detail=f"Error getting TTS languages: {str(e)}")

@app.get("/tts/status")
async def get_tts_status():
    """Get current TTS engine status and configuration"""
    try:
        t2s = get_text2speech()
        
        return {
            "engine": t2s.engine,
            "language": t2s.language,
            "slow": t2s.slow,
            "available_engines": []
        }
    except Exception as e:
        logger.error(f"Error getting TTS status: {e}")
        raise HTTPException(status_code=500, detail=f"Error getting TTS status: {str(e)}")

@app.get("/tts/voices")
async def get_tts_voices():
    """Get available voices for TTS engines"""
    try:
        voices = {
            "kokoro_voices": {
                "af_sarah": "American Female - Sarah (warm, friendly)",
                "af_nicole": "American Female - Nicole (professional)",
                "af_sky": "American Female - Sky (energetic)",
                "am_adam": "American Male - Adam (deep, authoritative)",
                "am_michael": "American Male - Michael (casual)",
                "bf_emma": "British Female - Emma (elegant)",
                "bf_isabella": "British Female - Isabella (sophisticated)",
                "bm_george": "British Male - George (distinguished)",
                "bm_lewis": "British Male - Lewis (modern)"
            },
            "pyttsx3_voices": "System dependent - use /tts/status to see available voices",
            "gtts_languages": [
                "en", "es", "fr", "de", "it", "pt", "ru", "ja", "ko", "zh", "hi", "ar"
            ]
        }
        
        # Try to get actual pyttsx3 voices if available
        try:
            import pyttsx3
            engine = pyttsx3.init()
            system_voices = engine.getProperty('voices')
            if system_voices:
                voices["pyttsx3_voices"] = [
                    {
                        "id": voice.id,
                        "name": voice.name,
                        "languages": getattr(voice, 'languages', []),
                        "gender": getattr(voice, 'gender', 'unknown')
                    }
                    for voice in system_voices
                ]
            engine.stop()
        except:
            pass
        
        return voices
        
    except Exception as e:
        logger.error(f"Error getting TTS voices: {e}")
        raise HTTPException(status_code=500, detail=f"Error getting TTS voices: {str(e)}")

# Handle graceful shutdown
def handle_exit(signum, frame):
    logger.info(f"Received signal {signum}, shutting down gracefully")
    sys.exit(0)

# Register signal handlers
signal.signal(signal.SIGINT, handle_exit)
signal.signal(signal.SIGTERM, handle_exit)

if __name__ == "__main__":
    import uvicorn
    logger.info(f"Starting server on {HOST}:{PORT}")
    
    # Start the server with reload=False to prevent duplicate processes
    uvicorn.run(
        "main:app",
        host=HOST,
        port=PORT,
        log_level="info",
        reload=False  # Change this to false to prevent multiple processes
    )
