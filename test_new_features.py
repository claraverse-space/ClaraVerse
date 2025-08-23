#!/usr/bin/env python3
"""
Test script for the new high-impact features:
1. Chat History
2. Document Summaries 
3. Query Templates
4. Better Citations
"""

import requests
import json
import time
from datetime import datetime

# Configuration
BASE_URL = "http://localhost:8000"

def test_query_templates():
    """Test the query templates feature"""
    print("\n🧪 Testing Query Templates")
    print("=" * 40)
    
    try:
        # Get all available templates
        response = requests.get(f"{BASE_URL}/query-templates")
        if response.status_code == 200:
            templates = response.json()
            print(f"✅ Found {len(templates)} query templates:")
            
            for template in templates[:3]:  # Show first 3
                print(f"   📋 {template['name']} ({template['category']})")
                print(f"      💡 {template['use_case']}")
                print(f"      ❓ {template['question_template'][:80]}...")
                print()
        else:
            print(f"❌ Failed to get templates: {response.text}")
            
    except Exception as e:
        print(f"❌ Error testing templates: {e}")

def test_chat_history(notebook_id):
    """Test chat history functionality"""
    print(f"\n🧪 Testing Chat History for notebook {notebook_id}")
    print("=" * 50)
    
    try:
        # First, check if there's existing history
        response = requests.get(f"{BASE_URL}/notebooks/{notebook_id}/chat/history")
        if response.status_code == 200:
            history = response.json()
            print(f"✅ Retrieved chat history: {history['total_messages']} messages")
            
            if history['messages']:
                latest = history['messages'][-1]
                print(f"   📝 Latest: {latest['role']} - {latest['content'][:50]}...")
        else:
            print(f"ℹ️ No chat history yet or notebook not found: {response.status_code}")
            
        # Test sending a chat message (if notebook exists)
        chat_data = {
            "question": "What are the main topics in these documents?",
            "mode": "hybrid",
            "response_type": "Multiple Paragraphs",
            "top_k": 60,
            "llm_provider": None,
            "use_chat_history": True
        }
        
        response = requests.post(f"{BASE_URL}/notebooks/{notebook_id}/chat", json=chat_data)
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Chat response received")
            print(f"   🤖 Answer: {result['answer'][:100]}...")
            print(f"   💬 Used chat context: {result['chat_context_used']}")
        else:
            print(f"⚠️ Chat request failed: {response.status_code} - {response.text}")
            
    except Exception as e:
        print(f"❌ Error testing chat history: {e}")

def test_detailed_summary(notebook_id):
    """Test detailed summary functionality"""
    print(f"\n🧪 Testing Detailed Summary for notebook {notebook_id}")
    print("=" * 50)
    
    try:
        # Test different summary lengths
        for length in ["short", "medium", "long"]:
            summary_data = {
                "include_details": True,
                "max_length": length
            }
            
            response = requests.post(f"{BASE_URL}/notebooks/{notebook_id}/summary/detailed", json=summary_data)
            if response.status_code == 200:
                result = response.json()
                print(f"✅ {length.title()} summary generated")
                print(f"   📊 Answer length: {len(result['answer'])} characters")
                print(f"   📚 Source documents: {len(result.get('source_documents', []))}")
                print(f"   🔗 Citations: {len(result.get('citations', []))}")
                if result.get('source_documents'):
                    print(f"   📄 Documents: {[doc['filename'] for doc in result['source_documents'][:2]]}")
                print()
            else:
                print(f"⚠️ {length.title()} summary failed: {response.status_code}")
                
    except Exception as e:
        print(f"❌ Error testing detailed summary: {e}")

def test_template_execution(notebook_id):
    """Test executing a query template"""
    print(f"\n🧪 Testing Template Execution for notebook {notebook_id}")
    print("=" * 50)
    
    try:
        # Try executing the "summarize_all" template
        template_id = "summarize_all"
        response = requests.post(f"{BASE_URL}/notebooks/{notebook_id}/query/template/{template_id}")
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Template '{template_id}' executed successfully")
            print(f"   📊 Answer: {result['answer'][:150]}...")
            print(f"   🎯 Mode: {result['mode']}")
            print(f"   💬 Used chat context: {result['chat_context_used']}")
        else:
            print(f"⚠️ Template execution failed: {response.status_code} - {response.text}")
            
    except Exception as e:
        print(f"❌ Error testing template execution: {e}")

def create_test_notebook():
    """Create a test notebook for testing"""
    print("\n🧪 Creating Test Notebook")
    print("=" * 30)
    
    notebook_data = {
        "name": "Feature Test Notebook",
        "description": "Testing new chat history, summaries, and templates",
        "llm_provider": {
            "type": "openai",
            "name": "OpenAI GPT-4",
            "model": "gpt-4o-mini",
            "baseUrl": "https://api.openai.com/v1",
            "apiKey": "your-api-key"
        },
        "embedding_provider": {
            "type": "openai", 
            "name": "OpenAI Embeddings",
            "model": "text-embedding-ada-002",
            "baseUrl": "https://api.openai.com/v1",
            "apiKey": "your-api-key"
        }
    }
    
    try:
        response = requests.post(f"{BASE_URL}/notebooks", json=notebook_data)
        if response.status_code == 200:
            notebook = response.json()
            notebook_id = notebook['id']
            print(f"✅ Created test notebook: {notebook_id}")
            return notebook_id
        else:
            print(f"❌ Failed to create notebook: {response.text}")
            return None
    except Exception as e:
        print(f"❌ Error creating notebook: {e}")
        return None

def main():
    """Main test function"""
    print("📋 New Features Test Suite")
    print("=" * 60)
    
    # Check if backend is running
    try:
        response = requests.get(f"{BASE_URL}/health")
        if response.status_code == 200:
            print("✅ Backend is running")
        else:
            print("❌ Backend health check failed")
            return
    except Exception as e:
        print(f"❌ Cannot connect to backend: {e}")
        return
    
    # Test 1: Query Templates (doesn't need a notebook)
    test_query_templates()
    
    # Get or create a test notebook
    notebook_id = None
    
    # Try to get existing notebooks first
    try:
        response = requests.get(f"{BASE_URL}/notebooks")
        if response.status_code == 200:
            notebooks = response.json()
            if notebooks:
                notebook_id = notebooks[0]['id']
                print(f"ℹ️ Using existing notebook: {notebook_id}")
            else:
                print("ℹ️ No existing notebooks found")
    except Exception as e:
        print(f"⚠️ Error getting notebooks: {e}")
    
    # Create test notebook if none exist
    if not notebook_id:
        notebook_id = create_test_notebook()
    
    if notebook_id:
        # Test 2: Chat History
        test_chat_history(notebook_id)
        
        # Test 3: Detailed Summary
        test_detailed_summary(notebook_id)
        
        # Test 4: Template Execution
        test_template_execution(notebook_id)
    else:
        print("⚠️ Skipping notebook-specific tests (no notebook available)")
    
    print(f"\n✅ Feature testing completed!")
    print("\n📝 Summary of New Features:")
    print("1. 💬 Chat History - Maintains conversation context across queries")
    print("2. 📊 Document Summaries - One-click detailed overviews with custom length")
    print("3. 📋 Query Templates - Pre-built questions for common scenarios")
    print("4. 🔗 Better Citations - Enhanced source tracking and document references")
    print("\n🎯 These features solve key user pain points:")
    print("   • Eliminates need to repeat context in conversations")
    print("   • Provides quick document overviews without manual reading")
    print("   • Guides users with expert-crafted questions")
    print("   • Shows exactly where information comes from")

if __name__ == "__main__":
    main()
