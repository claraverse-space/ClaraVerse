# ===============================
# Imports
# ===============================
from langchain_ollama.chat_models import ChatOllama
from langchain_community.embeddings import OllamaEmbeddings
from langchain_chroma import Chroma
from langchain_core.messages import AIMessage
from langchain_core.documents import Document
import chromadb
from uuid import uuid4
from typing import List, Dict, Any, Optional, Union, Tuple
import requests
import time
import logging
import traceback
import os

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class DocumentAI:
    """
    A library for document storage, retrieval, and chat interactions with LLMs.
    """
    
    # Class-level cache for available models
    _available_models_cache = set()
    _last_cache_update = 0
    _cache_ttl = 300  # Cache TTL in seconds (5 minutes)
    
    def __init__(
        self,
        embedding_model: str = "mxbai-embed-large",
        llm_model: str = "gemma3:4b",
        temperature: float = 0,
        collection_name: str = "document_collection",
        persist_directory: Optional[str] = None,
        client: Optional[chromadb.Client] = None,
        ollama_base_url: str = "http://localhost:11434"
    ):
        """
        Initialize the DocumentAI with configurable models and storage options.
        
        Args:
            embedding_model: Name of the embedding model to use
            llm_model: Name of the LLM to use for chat
            temperature: Creativity level for the LLM (0-1)
            collection_name: Name for the vector store collection
            persist_directory: Directory to save vector DB (None for in-memory)
            client: Optional existing chromadb client
            ollama_base_url: Base URL for Ollama API
        """
        self.ollama_base_url = ollama_base_url
        
        # Ensure embedding model is available
        self._ensure_model_available(embedding_model)
        
        # Initialize language model
        self.llm = ChatOllama(
            model=llm_model,
            temperature=temperature,
        )
        
        # Initialize embedding model
        self.embeddings = OllamaEmbeddings(model=embedding_model)
        
        # Set up vector store based on provided parameters
        if client:
            self.vector_store = Chroma(
                client=client,
                collection_name=collection_name,
                embedding_function=self.embeddings,
            )
        else:
            params = {
                "collection_name": collection_name,
                "embedding_function": self.embeddings,
            }
            if persist_directory:
                params["persist_directory"] = persist_directory
            
            self.vector_store = Chroma(**params)
    
    def _update_models_cache(self):
        """Update the class-level cache of available models"""
        try:
            current_time = time.time()
            # Only update cache if TTL has expired
            if current_time - self._last_cache_update > self._cache_ttl:
                response = requests.get(f"{self.ollama_base_url}/api/tags")
                if response.status_code == 200:
                    self.__class__._available_models_cache = set(
                        model["name"] for model in response.json().get("models", [])
                    )
                    self.__class__._last_cache_update = current_time
                    logger.debug("Updated models cache")
        except Exception as e:
            logger.warning(f"Failed to update models cache: {e}")

    def _ensure_model_available(self, model_name: str):
        """
        Check if the model is available in Ollama, if not, pull it.
        Uses a class-level cache to avoid frequent API calls.
        
        Args:
            model_name: Name of the model to ensure is available
        """
        # Update cache if needed
        self._update_models_cache()
        
        # Check cache first
        if model_name in self.__class__._available_models_cache:
            logger.debug(f"Model {model_name} found in cache, skipping pull")
            return
            
        # If not in cache, check API directly
        try:
            response = requests.get(f"{self.ollama_base_url}/api/tags")
            if response.status_code == 200:
                available_models = [model["name"] for model in response.json().get("models", [])]
                
                if model_name not in available_models:
                    logger.info(f"Model {model_name} not found. Downloading now...")
                    self._pull_model(model_name)
                    # Update cache after successful pull
                    self.__class__._available_models_cache.add(model_name)
                else:
                    logger.debug(f"Model {model_name} is available, updating cache")
                    self.__class__._available_models_cache.add(model_name)
            else:
                logger.warning(f"Failed to get model list. Status code: {response.status_code}")
                # Only attempt to pull if we couldn't verify availability
                self._pull_model(model_name)
                
        except requests.RequestException as e:
            logger.error(f"Error checking for model availability: {e}")
            # Only pull if we couldn't verify availability
            self._pull_model(model_name)
    
    def _pull_model(self, model_name: str):
        """
        Pull a model from Ollama.
        
        Args:
            model_name: Name of the model to pull
        """
        try:
            logger.info(f"Pulling model {model_name}. This may take a while...")
            
            # Start the pull request
            response = requests.post(
                f"{self.ollama_base_url}/api/pull",
                json={"name": model_name},
                stream=True
            )
            
            if response.status_code == 200:
                # Process streaming response to show progress
                for line in response.iter_lines():
                    if line:
                        update = line.decode('utf-8')
                        logger.info(f"Download progress: {update}")
                
                logger.info(f"Successfully pulled model {model_name}")
            else:
                logger.error(f"Failed to pull model {model_name}. Status code: {response.status_code}")
                logger.error(f"Response: {response.text}")
        except requests.RequestException as e:
            logger.error(f"Error pulling model {model_name}: {e}")
            raise RuntimeError(f"Failed to pull model {model_name}: {e}")

    def chat(
        self,
        user_message: str,
        system_prompt: str = "You are a helpful assistant.",
    ) -> str:
        """
        Chat with the LLM using specified prompts.
        
        Args:
            user_message: Message from the user
            system_prompt: Instructions for the LLM
            
        Returns:
            LLM's response
        """
        prompt_messages = [
            ("system", system_prompt),
            ("human", user_message),
        ]
        
        response = self.llm.invoke(prompt_messages)
        return response.content
    
    def add_documents(
        self,
        documents: List[Document],
        custom_ids: Optional[List[str]] = None
    ) -> List[str]:
        """
        Add documents to the vector store.
        
        Args:
            documents: List of documents to add
            custom_ids: Optional custom IDs (uses UUIDs if not provided)
            
        Returns:
            List of document IDs
        """
        document_ids = custom_ids or [str(uuid4()) for _ in documents]
        self.vector_store.add_documents(documents=documents, ids=document_ids)
        return document_ids
    
    def delete_documents(self, document_ids: List[str]) -> None:
        """
        Delete documents from the vector store by their IDs.
        
        Args:
            document_ids: List of document IDs to delete
        """
        try:
            if not document_ids:
                logger.warning("No document IDs provided for deletion")
                return
                
            # Delete documents from the vector store
            logger.info(f"Deleting {len(document_ids)} document chunks from vector store")
            self.vector_store.delete(ids=document_ids)
            
            # Ensure changes are persisted by getting the underlying ChromaDB collection
            if hasattr(self.vector_store, '_collection'):
                # Force a persist by resetting the collection
                collection_name = self.vector_store._collection.name
                persist_directory = getattr(self.vector_store._client, '_persist_directory', None)
                if persist_directory:
                    self._recreate_vector_store(collection_name, persist_directory)
                    logger.info("Persisted changes to disk by recreating store")
            
            logger.info(f"Successfully deleted {len(document_ids)} document chunks")
        except Exception as e:
            logger.error(f"Error deleting documents from vector store: {e}")
            logger.error(traceback.format_exc())
            raise RuntimeError(f"Failed to delete documents: {e}")
    
    def _recreate_vector_store(self, collection_name: str, persist_directory: Optional[str] = None):
        """
        Recreate the vector store with the current embedding model.
        
        Args:
            collection_name: Name for the vector store collection
            persist_directory: Optional directory to persist the store
        """
        logger.info(f"Recreating vector store for collection: {collection_name}")
        
        # If persist_directory exists, try to delete it
        if persist_directory and os.path.exists(persist_directory):
            try:
                import shutil
                shutil.rmtree(persist_directory)
                logger.info(f"Deleted existing persist directory: {persist_directory}")
            except Exception as e:
                logger.warning(f"Failed to delete persist directory: {e}")

        # Create new vector store
        params = {
            "collection_name": collection_name,
            "embedding_function": self.embeddings,
        }
        if persist_directory:
            params["persist_directory"] = persist_directory
            os.makedirs(persist_directory, exist_ok=True)
        
        self.vector_store = Chroma(**params)
        logger.info("Vector store recreated successfully")

    def similarity_search(
        self,
        query: str,
        k: int = 8,
        filter: Optional[Dict[str, Any]] = None,
        min_similarity: float = 0.5
    ) -> List[Document]:
        """
        Find documents similar to the query.
        
        Args:
            query: Search query text
            k: Number of results to return
            filter: Optional metadata filter
            min_similarity: Minimum similarity threshold
            
        Returns:
            List of matching documents with scores
        """
        try:
            # Format the filter for Chroma if provided
            chroma_filter = None
            if filter:
                chroma_filter = {}
                for key, value in filter.items():
                    if value is None or (isinstance(value, dict) and not value):
                        continue
                    if isinstance(value, dict):
                        chroma_filter[key] = value
                    else:
                        chroma_filter[key] = {"$eq": value}
                
                if not chroma_filter:
                    chroma_filter = None

            # Get embeddings for the query
            query_embedding = self.embeddings.embed_query(query)

            # Use ChromaDB's native search
            raw_results = self.vector_store._collection.query(
                query_embeddings=[query_embedding],
                n_results=k,
                where=chroma_filter,
                include=['documents', 'metadatas', 'distances']
            )

            # Convert distances to similarity scores (1 - normalized_distance)
            if raw_results['distances'] and len(raw_results['distances']) > 0:
                max_distance = max(raw_results['distances'][0])
                scores = [1 - (dist / max_distance) if max_distance > 0 else 1 
                         for dist in raw_results['distances'][0]]
            else:
                scores = []

            # Combine documents with their scores
            documents = []
            for i, (doc, metadata) in enumerate(zip(raw_results['documents'][0], raw_results['metadatas'][0])):
                if i < len(scores):
                    metadata['score'] = scores[i]
                documents.append(Document(
                    page_content=doc,
                    metadata=metadata
                ))

            return documents
            
        except chromadb.errors.InvalidDimensionException as e:
            logger.warning(f"Dimension mismatch detected: {e}")
            
            # Extract collection name and persist directory from vector store
            collection_name = self.vector_store._collection.name
            persist_directory = getattr(self.vector_store._client, '_persist_directory', None)
            
            # Recreate vector store
            self._recreate_vector_store(collection_name, persist_directory)
            
            # Retry the search
            logger.info("Retrying search with recreated vector store")
            return self.similarity_search(
                query,
                k=k,
                filter=chroma_filter,
            )
            
        except Exception as e:
            logger.error(f"Error during similarity search: {e}")
            logger.error(traceback.format_exc())
            raise
    
    def chat_with_context(
        self,
        query: str,
        k: int = 4,
        filter: Optional[Dict[str, Any]] = None,
        system_template: str = "Use the following context to answer the question:\n\n{context}\n\nQuestion: {question}"
    ) -> str:
        """
        Retrieve relevant documents and chat based on them.
        
        Args:
            query: User's question
            k: Number of documents to retrieve
            filter: Optional filter criteria
            system_template: Template with {context} and {question} placeholders
            
        Returns:
            LLM's response based on retrieved documents
        """
        # Retrieve relevant documents
        docs = self.similarity_search(query, k=k, filter=filter)
        
        # Build context from documents
        context = "\n\n".join([doc.page_content for doc in docs])
        
        # Format system prompt with context
        system_prompt = system_template.format(context=context, question=query)
        
        # Get response from LLM
        return self.chat(query, system_prompt)


# Example usage
# if __name__ == "__main__":
#     # Create DocumentAI instance
#     doc_ai = DocumentAI(
#         embedding_model="nomic-embed-text",
#         llm_model="gemma3:4b",
#         temperature=0,
#         collection_name="example_collection",
#         persist_directory="./chroma_langchain_db"
#     )
    
#     # Test translation
#     translation = doc_ai.chat(
#         user_message="I love programming.",
#         system_prompt="You are a helpful assistant that translates English to French. Translate the user sentence."
#     )
#     print("Translated Output:\n", translation)
    
#     # Add example documents
#     documents = [
#         Document(
#             page_content="I had chocolate chip pancakes and scrambled eggs for breakfast this morning.",
#             metadata={"source": "tweet"},
#         ),
#         Document(
#             page_content="The weather forecast for tomorrow is cloudy and overcast, with a high of 62 degrees.",
#             metadata={"source": "news"},
#         ),
#         Document(
#             page_content="Building an exciting new project with LangChain - come check it out!",
#             metadata={"source": "tweet"},
#         ),
#         Document(
#             page_content="Robbers broke into the city bank and stole $1 million in cash.",
#             metadata={"source": "news"},
#         ),
#         Document(
#             page_content="Wow! That was an amazing movie. I can't wait to see it again.",
#             metadata={"source": "tweet"},
#         ),
#         Document(
#             page_content="Is the new iPhone worth the price? Read this review to find out.",
#             metadata={"source": "website"},
#         ),
#         Document(
#             page_content="The top 10 soccer players in the world right now.",
#             metadata={"source": "website"},
#         ),
#         Document(
#             page_content="LangGraph is the best framework for building stateful, agentic applications!",
#             metadata={"source": "tweet"},
#         ),
#         Document(
#             page_content="The stock market is down 500 points today due to fears of a recession.",
#             metadata={"source": "news"},
#         ),
#         Document(
#             page_content="I have a bad feeling I am going to get deleted :(",
#             metadata={"source": "tweet"},
#         ),
#     ]
    
#     # Add documents to vector store
#     doc_ai.add_documents(documents)
    
#     # Test similarity search
#     query = "LangChain provides abstractions to make working with LLMs easy"
#     search_results = doc_ai.similarity_search(
#         query,
#         k=2,
#     )
    
#     # Print search results
#     print("\nSimilarity Search Results:")
#     for result in search_results:
#         print(f"* {result.page_content} [{result.metadata}]")
    
#     # Test chat with context
#     context_response = doc_ai.chat_with_context(
#         query="Tell me about LangChain projects",
#         k=2,
#         filter={"source": "tweet"}
#     )
#     print("\nChat with Context Response:")
#     print(context_response)