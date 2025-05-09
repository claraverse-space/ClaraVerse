# PDF Implementation Guide

## Overview
This document outlines the implementation of offline PDF handling in the Electron/React application while maintaining knowledge base functionality. The solution enables local PDF file reading without CDN dependencies while preserving the existing knowledge base search capabilities.

## Key Changes

### 1. PDF.js Integration
- **Package Version**: Installed `pdfjs-dist` version 3.11.174
  ```bash
  npm install pdfjs-dist@3.11.174
  ```

### 2. Vite Configuration
#### 2.1 PDF Worker File Handling
Created a custom Vite plugin to handle PDF worker file copying:

```javascript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs-extra';

function copyPdfWorker() {
  return {
    name: 'copy-pdf-worker',
    buildStart() {
      const workerSrc = path.resolve(
        __dirname,
        'node_modules/pdfjs-dist/build/pdf.worker.min.js'
      );
      const workerDest = path.resolve(
        __dirname,
        'public/pdf.worker.min.js'
      );
      fs.copySync(workerSrc, workerDest);
    }
  };
}

export default defineConfig({
  plugins: [react(), copyPdfWorker()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          pdfjs: ['pdfjs-dist']
        }
      }
    }
  }
});
```

### 3. Document Utils Configuration
Updated `documentUtils.ts` to properly initialize the PDF worker:

```typescript
import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker
const pdfWorkerSrc = '/pdf.worker.min.js';
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;

export async function readPdfContent(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let fullText = '';
  
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item: any) => item.str)
      .join(' ');
    fullText += pageText + '\n';
  }
  
  return fullText;
}
```

### 4. Knowledge Base Integration
To maintain both local document reading and knowledge base functionality:

```typescript
// Handling both local and server-based content
async function getCombinedContext(userQuery: string) {
  let combinedContext = '';

  // 1. Local document handling
  if (temporaryDocs.length > 0) {
    const localContext = temporaryDocs
      .map(doc => `Content from ${doc.name}:\n${doc.content}`)
      .join('\n\n');
    combinedContext += localContext;
  }

  // 2. Knowledge base search
  if (ragEnabled && pythonPort) {
    try {
      const results = await searchDocuments(userQuery, pythonPort, [], ragEnabled);
      if (results?.results?.length > 0) {
        const serverContext = results.results
          .map(r => {
            const source = r.metadata?.source_file 
              ? ` (from ${r.metadata.source_file})` 
              : '';
            return `${r.content}${source}`;
          })
          .join('\n\n');
        
        if (combinedContext) {
          combinedContext += '\n\n--- Knowledge Base Content ---\n\n';
        }
        combinedContext += serverContext;
      }
    } catch (error) {
      console.error('Error fetching knowledge base content:', error);
    }
  }

  return combinedContext;
}
```

## Important Considerations

### 1. File Size and Performance
- PDF processing is done client-side
- Consider implementing file size limits for large PDFs
- Monitor memory usage when processing multiple documents

### 2. Error Handling
- Implement proper error handling for PDF processing failures
- Add user feedback for processing status
- Handle network errors gracefully when knowledge base is unavailable

### 3. Security
- Validate file types before processing
- Implement proper sanitization of extracted text
- Consider implementing file access restrictions if needed

### 4. Maintenance
- Keep `pdfjs-dist` version updated while ensuring compatibility
- Monitor worker file copying during builds
- Regularly test both local and knowledge base functionality

## Testing Checklist

- [ ] PDF loading works offline
- [ ] Multiple PDF documents can be loaded simultaneously
- [ ] Knowledge base search still functions
- [ ] Combined results are properly formatted
- [ ] Error handling works as expected
- [ ] Memory usage remains stable
- [ ] Build process completes successfully
- [ ] Worker file is properly copied to public directory

## Troubleshooting

### Common Issues

1. **Worker Not Found**
   - Verify worker file is in public directory
   - Check worker path configuration
   - Ensure build process copies worker file

2. **Memory Issues**
   - Implement pagination for large PDFs
   - Add file size limits
   - Clean up document objects after processing

3. **Knowledge Base Integration**
   - Verify Python backend connection
   - Check RAG configuration
   - Validate search endpoint responses

## Future Improvements

1. **Performance Optimization**
   - Implement worker pooling for multiple PDFs
   - Add caching for frequently accessed documents
   - Optimize text extraction process

2. **Feature Enhancements**
   - Add PDF preview capability
   - Implement text highlighting
   - Add document management interface

3. **Integration Improvements**
   - Better error reporting
   - Progress indicators for large documents
   - Enhanced context merging algorithms 