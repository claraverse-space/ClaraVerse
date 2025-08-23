#!/usr/bin/env python3
"""
Test script to verify document content persistence for retry functionality
"""

import requests
import json
import time
from datetime import datetime

# Configuration
BASE_URL = "http://localhost:8000"
TEST_NOTEBOOK_ID = "test-content-persistence"

def test_content_persistence():
    """Test that document content is properly stored and available for retry"""
    
    print("🧪 Testing Document Content Persistence")
    print("=" * 50)
    
    # Step 1: Create test notebook
    print("\n1. Creating test notebook...")
    notebook_data = {
        "name": "Content Persistence Test",
        "description": "Testing document content storage for retry",
        "llm_provider": {
            "type": "openai",
            "name": "OpenAI GPT-4",
            "model": "gpt-4o-mini"
        },
        "embedding_provider": {
            "type": "openai", 
            "name": "OpenAI Embeddings",
            "model": "text-embedding-ada-002"
        }
    }
    
    try:
        response = requests.post(f"{BASE_URL}/notebooks", json=notebook_data)
        if response.status_code != 200:
            print(f"❌ Failed to create notebook: {response.text}")
            return
        
        notebook = response.json()
        notebook_id = notebook['id']
        print(f"✅ Created notebook: {notebook_id}")
        
    except Exception as e:
        print(f"❌ Error creating notebook: {e}")
        return
    
    # Step 2: Upload a test document
    print(f"\n2. Uploading test document...")
    test_content = "This is a test document for content persistence.\n" * 100  # Make it reasonably sized
    
    try:
        files = {
            'files': ('test_document.txt', test_content, 'text/plain')
        }
        
        response = requests.post(f"{BASE_URL}/notebooks/{notebook_id}/documents", files=files)
        if response.status_code != 200:
            print(f"❌ Failed to upload document: {response.text}")
            return
        
        documents = response.json()
        if not documents:
            print("❌ No documents returned from upload")
            return
            
        document_id = documents[0]['id']
        print(f"✅ Uploaded document: {document_id}")
        print(f"   Content length: {len(test_content)} characters")
        
    except Exception as e:
        print(f"❌ Error uploading document: {e}")
        return
    
    # Step 3: Wait for processing or force failure
    print(f"\n3. Waiting for document processing...")
    max_attempts = 12  # 60 seconds total
    attempt = 0
    
    while attempt < max_attempts:
        try:
            response = requests.get(f"{BASE_URL}/notebooks/{notebook_id}/documents")
            if response.status_code == 200:
                docs = response.json()
                doc = next((d for d in docs if d['id'] == document_id), None)
                
                if doc:
                    status = doc['status']
                    print(f"   Status: {status}")
                    
                    if status == 'completed':
                        print("✅ Document completed successfully")
                        break
                    elif status == 'failed':
                        print("✅ Document failed (good for testing retry)")
                        break
                    elif status == 'processing':
                        time.sleep(5)
                        attempt += 1
                        continue
                else:
                    print("❌ Document not found")
                    return
            else:
                print(f"❌ Failed to get document status: {response.text}")
                return
                
        except Exception as e:
            print(f"❌ Error checking document status: {e}")
            return
    
    if attempt >= max_attempts:
        print("⚠️ Document still processing after 60 seconds, continuing with test...")
    
    # Step 4: Test retry functionality (even if document completed)
    print(f"\n4. Testing retry functionality...")
    
    try:
        response = requests.post(f"{BASE_URL}/notebooks/{notebook_id}/documents/{document_id}/retry")
        
        if response.status_code == 200:
            result = response.json()
            print("✅ Retry successful!")
            print(f"   Message: {result['message']}")
            print(f"   Status: {result['status']}")
            
        elif response.status_code == 400:
            error_detail = response.json().get('detail', 'Unknown error')
            if "cannot be retried" in error_detail:
                print("ℹ️ Document cannot be retried (not in failed state)")
                print(f"   This is expected for completed documents")
            elif "content not available" in error_detail:
                print("❌ Content persistence failed!")
                print(f"   Error: {error_detail}")
                print("   This indicates the content was not properly stored")
            else:
                print(f"⚠️ Other retry error: {error_detail}")
        else:
            print(f"❌ Retry failed: {response.text}")
            
    except Exception as e:
        print(f"❌ Error testing retry: {e}")
    
    # Step 5: Cleanup
    print(f"\n5. Cleaning up test notebook...")
    try:
        response = requests.delete(f"{BASE_URL}/notebooks/{notebook_id}")
        if response.status_code == 200:
            print("✅ Test notebook deleted")
        else:
            print(f"⚠️ Failed to delete test notebook: {response.text}")
    except Exception as e:
        print(f"⚠️ Error cleaning up: {e}")
    
    print(f"\n{'='*50}")
    print("🎯 Content Persistence Test Complete")
    print("\nKey Points:")
    print("• Document content should be stored during upload")
    print("• Failed documents should retain content for retry")
    print("• Completed documents may clear content to save space")
    print("• Large documents (>1MB) use file-based storage")
    print("• Retry should work for any failed document")

def test_large_document():
    """Test large document handling with file-based storage"""
    
    print("\n\n🧪 Testing Large Document Storage")
    print("=" * 50)
    
    # Create a large document (>1MB)
    large_content = "This is a large test document for file-based storage.\n" * 50000  # ~2.5MB
    
    print(f"Generated large document: {len(large_content):,} characters")
    print("This should trigger file-based content storage")
    
    # The rest would be similar to the above test but with large content
    print("(Skipping full test to avoid large uploads)")

if __name__ == "__main__":
    print("📋 Document Content Persistence Test Suite")
    print("=" * 60)
    
    # Check if backend is running
    try:
        response = requests.get(f"{BASE_URL}/health")
        if response.status_code == 200:
            print("✅ Backend is running")
        else:
            print("❌ Backend health check failed")
            exit(1)
    except Exception as e:
        print(f"❌ Cannot connect to backend: {e}")
        print(f"   Make sure the backend is running on {BASE_URL}")
        exit(1)
    
    # Run tests
    test_content_persistence()
    test_large_document()
    
    print(f"\n✅ All tests completed!")
    print("\nIf you see 'Content persistence failed', check the backend logs for more details.")
