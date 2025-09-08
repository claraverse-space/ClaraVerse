---
title: "RAG"
description: "Your intelligent knowledge canvas with 3D visualization"
category: "features"
order: 5
lastUpdated: "2025-09-06"
contributors: ["badboysm890"]
---


<img src="https://raw.githubusercontent.com/badboysm890/ClaraVerse/935d0659b468f2d896f7acf2878725c35500cbe6/public/mascot/Rag.png" alt="Clara with notebooks and knowledge visualization" width="400" />

# Notebooks (RAG)

Document storage with AI-powered search and conversation capabilities.

## What Notebooks Are

Notebooks are your knowledge management system. Upload documents, and then chat with them using RAG (Retrieval Augmented Generation). It's like having a research assistant who's read everything you've uploaded and can answer questions about it.

## Technical Stack

- **LightRAG**: The RAG engine (runs in Docker container)
- **Embedding Model**: mxbai-embed-large
- **Storage**: Browser IndexedDB + mounted Docker volumes
- **Visualization**: 3D knowledge graph using Three.js

## System Requirements

- Base ClaraVerse requirements
- Additional 8GB storage for RAG container
- Docker required for backend
- 2GB+ RAM for embedding operations

## Setup

1. Start Docker
2. Go to Notebooks tab
3. First launch downloads RAG container (~8GB)
4. Wait for health check to pass
5. Create your first notebook

## How It Works

### Document Processing Pipeline
```
Upload Document → Extract Text → Generate Embeddings → 
Store in Vector DB → Build Knowledge Graph → Ready for Chat
```

### Supported File Types
- PDF (recommended)
- Word documents (.docx)
- Text files (.txt, .md)
- Web clippings
- Email exports

### Processing Times
- Small document (1-10 pages): 10-30 seconds
- Medium document (10-50 pages): 1-2 minutes
- Large document (50+ pages): 3-5 minutes
- Batch upload: Processes sequentially

## Using Notebooks

### Creating & Organizing
```
1. Click "New Notebook"
2. Name it descriptively (e.g., "Project_Alpha_Docs")
3. Set category/tags for organization
4. Optional: Set custom wallpaper
```

### Uploading Documents
- Drag and drop files
- Or click upload button
- Monitor status indicator
- Green = processed, Yellow = processing, Red = error

### Chatting with Documents
```
You: What does the contract say about payment terms?
Notebook: [Searches documents, provides relevant answer with sources]
```

## Integration with Clara

### As Clara's Memory
```
1. Attach notebook to Clara Assistant
2. Clara references it automatically
Example: "According to your project docs, the deadline is..."
```

### Automatic Updates via Agents
```
Agent Workflow:
Email → Extract → Convert to PDF → Save to Notebook
Result: Self-updating knowledge base
```

## The 3D Visualization

Shows how your documents connect:
- **Nodes**: Documents or concepts
- **Edges**: Relationships/references
- **Clusters**: Related topics
- **Size**: Importance/frequency

**Navigation**:
- Click and drag to rotate
- Scroll to zoom
- Click nodes for details

## Real Use Cases

### Research Project
```
Structure:
- Papers_Notebook: Academic papers
- Notes_Notebook: Your observations
- Data_Notebook: Raw data files

Workflow:
1. Upload papers as you find them
2. Chat to find connections
3. Clara references for writing
```

### Company Knowledge Base
```
Structure:
- Policies_Notebook: HR and procedures
- Projects_Notebook: Active project docs
- Archives_Notebook: Historical data

Usage:
- New employees query policies
- Project teams find decisions
- Audit trail of information
```

### Personal Assistant
```
Daily Workflow:
1. Agent fetches emails
2. Converts to PDFs
3. Stores in Daily_Notebook
4. Clara can answer: "What did John say about the budget?"
```

## Performance Optimization

### For Better RAG Results
1. **Quality Documents**: Clean PDFs work better than scanned images
2. **Logical Organization**: One topic per notebook
3. **Clear Naming**: Descriptive filenames help retrieval
4. **Regular Cleanup**: Remove outdated documents

### For Faster Processing
1. Upload during off-hours
2. Process large batches overnight
3. Split huge documents if possible
4. Restart container if sluggish

## Limitations

1. **OCR Quality**: Scanned documents may have issues
2. **Language**: Best with English (other languages experimental)
3. **Context Window**: Very long documents may be truncated
4. **Graph Complexity**: 100+ documents can make visualization cluttered
5. **Storage**: Everything in browser storage (clear cache = lose data)

## Troubleshooting

**Backend Not Starting**
```bash
# Check Docker is running
docker ps

# Restart container
docker restart claraverse-rag

# Check logs
docker logs claraverse-rag
```

**Documents Not Processing**
- Check file format is supported
- Verify file size < 50MB
- Look for special characters in filename
- Try re-uploading

**Chat Not Working**
- Ensure documents are fully processed (green status)
- Check backend health in settings
- Refresh the page
- Restart RAG container

## Advanced Features

### Custom Embeddings
```python
# In settings, configure embedding model
{
  "model": "mxbai-embed-large",
  "dimensions": 1024,
  "batch_size": 32
}
```

### Knowledge Graph Tuning
- Adjust similarity threshold
- Configure clustering algorithm
- Set visualization parameters

## Data Privacy

- All processing happens locally
- Documents never leave your machine
- Embeddings stored in Docker volume
- No external API calls for RAG

## Backup Strategy

```bash
# Backup notebook data
docker cp claraverse-rag:/data ./backup

# Backup browser storage
# Export from browser DevTools
```

## Pro Tips

1. **One notebook per project** - Keeps context focused
2. **PDF over everything** - Most reliable format
3. **Update regularly** - Use agents for automatic updates
4. **Name consistently** - "YYYY-MM-DD_description" works well
5. **Test retrieval** - Ask questions to verify RAG is working

## Getting Started

1. Create notebook: "Test_Knowledge"
2. Upload a PDF you know well
3. Wait for processing to complete
4. Ask: "Summarize this document"
5. Try: "What are the key points about [specific topic]?"
6. Attach to Clara for enhanced conversations

Remember: Notebooks are only as good as the documents you feed them. Quality in, quality out.