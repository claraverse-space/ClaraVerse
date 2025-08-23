# Document Retry Functionality

## Overview

The Clara backend now includes robust retry functionality for failed document processing, addressing the common issue of LLM timeouts and transient errors during document ingestion.

## How It Works

### Automatic Content Storage
- When documents are uploaded, the extracted text content is automatically stored in the database
- This enables retry functionality without requiring re-upload of the original file

### Intelligent Resume Capability
- LightRAG's built-in caching mechanism automatically skips chunks that were already processed
- When you retry a failed document, it resumes from where it left off
- No duplicate processing of successfully completed chunks

### Error State Management
- Documents track detailed error information including timestamps and error messages
- Only documents in "failed" state can be retried
- Previous error information is cleared when retry is initiated

## API Endpoint

### Retry Failed Document
```
POST /notebooks/{notebook_id}/documents/{document_id}/retry
```

**Response:**
```json
{
  "message": "Document retry initiated successfully",
  "document_id": "doc_123",
  "status": "processing"
}
```

**Error Cases:**
- `404`: Document not found
- `400`: Document not in retryable state (only "failed" documents can be retried)
- `400`: Original content not available (rare edge case)
- `500`: Error initiating retry

## Usage Examples

### Using curl
```bash
# Retry a failed document
curl -X POST http://localhost:8000/notebooks/my-notebook/documents/doc_123/retry
```

### Using Python requests
```python
import requests

response = requests.post(
    "http://localhost:8000/notebooks/my-notebook/documents/doc_123/retry"
)

if response.status_code == 200:
    result = response.json()
    print(f"Retry initiated: {result['message']}")
else:
    print(f"Retry failed: {response.text}")
```

### Using JavaScript/fetch
```javascript
const response = await fetch(
    `/notebooks/${notebookId}/documents/${documentId}/retry`,
    { method: 'POST' }
);

if (response.ok) {
    const result = await response.json();
    console.log('Retry initiated:', result.message);
} else {
    console.error('Retry failed:', await response.text());
}
```

## Workflow

1. **Document Upload**: Content is extracted and stored
2. **Processing Starts**: Document status becomes "processing"
3. **Failure Occurs**: Status becomes "failed" with error details
4. **Retry Request**: POST to retry endpoint
5. **Status Reset**: Document status returns to "processing"
6. **Resume Processing**: LightRAG cache skips completed chunks
7. **Completion**: Status becomes "completed" on success

## Benefits

- **No Re-upload Required**: Original content is preserved for retry
- **Efficient Processing**: Only failed chunks are reprocessed
- **Detailed Error Tracking**: Full error information available for debugging
- **Transient Error Recovery**: Automatic recovery from temporary failures
- **Production Ready**: Comprehensive error handling and validation

## Integration with Frontend

The retry functionality can be easily integrated into the Clara frontend:

1. **Monitor Document Status**: Poll document status to detect failures
2. **Show Retry Button**: Display retry option for failed documents
3. **Handle Retry Response**: Update UI based on retry success/failure
4. **Progress Tracking**: Monitor retry progress like initial processing

## Error Recovery Strategies

### Automatic Retry (Future Enhancement)
```python
# Potential enhancement for auto-retry logic
def should_auto_retry(error_type, retry_count):
    if retry_count >= 3:
        return False
    
    # Auto-retry for transient errors
    transient_errors = ['timeout', 'connection_error', 'rate_limit']
    return error_type in transient_errors
```

### Manual Retry (Current Implementation)
- User-initiated retry through API endpoint
- Suitable for all error types after user investigation
- Provides control over when and how documents are retried

## Monitoring and Logging

The retry functionality includes comprehensive logging:
- Retry initiation events
- Error state transitions
- Processing resumption
- Success/failure outcomes

This enables monitoring of retry patterns and success rates for operational insights.

## Related GitHub Discussion

This functionality addresses the community request in [LightRAG Discussion #1821](https://github.com/HKUDS/LightRAG/discussions/1821) for retry/resume processing of files interrupted by LLM timeouts.
