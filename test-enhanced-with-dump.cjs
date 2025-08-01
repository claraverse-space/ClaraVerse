const fs = require('fs');
const path = require('path');

// Copy the enhanced extractGGUFMetadata method from llamaSwapService.cjs
async function extractGGUFMetadata(modelPath) {
  try {
    const fileName = path.basename(modelPath);
    
    console.log(`🔍 Analyzing GGUF metadata for: ${fileName}`);
    
    // Read a larger chunk to parse metadata properly (64KB should be enough for most metadata)
    const bufferSize = 65536;
    const buffer = Buffer.alloc(bufferSize);
    
    const fd = fs.openSync(modelPath, 'r');
    const bytesRead = fs.readSync(fd, buffer, 0, bufferSize, 0);
    fs.closeSync(fd);
    
    console.log(`${fileName}: Read ${bytesRead} bytes for metadata analysis`);
    
    // GGUF magic number check
    const magic = buffer.readUInt32LE(0);
    if (magic !== 0x46554747) { // 'GGUF' in little endian
      console.warn(`${fileName}: Not a valid GGUF file (magic: 0x${magic.toString(16)})`);
      return null;
    }
    
    // Read version
    const version = buffer.readUInt32LE(4);
    console.info(`${fileName}: GGUF version ${version}`);
    
    let offset = 8;
    const tensorCount = buffer.readBigUInt64LE(offset);
    offset += 8;
    const metadataCount = buffer.readBigUInt64LE(offset);
    offset += 8;
    
    console.info(`${fileName}: ${Number(tensorCount)} tensors, ${Number(metadataCount)} metadata entries`);
    
    // Parse metadata key-value pairs
    const metadata = {};
    let parsedCount = 0;
    
    for (let i = 0; i < Number(metadataCount) && offset < bytesRead - 16; i++) {
      try {
        // Read key length and key
        if (offset + 8 >= bytesRead) {
          console.log(`${fileName}: Reached end of buffer while reading key length at entry ${i}`);
          break;
        }
        
        const keyLength = buffer.readBigUInt64LE(offset);
        offset += 8;
        
        if (Number(keyLength) > 1000 || offset + Number(keyLength) >= bytesRead) {
          console.log(`${fileName}: Invalid key length ${keyLength} at entry ${i}, stopping parse`);
          break;
        }
        
        const key = buffer.subarray(offset, offset + Number(keyLength)).toString('utf-8');
        offset += Number(keyLength);
        
        // Read value type
        if (offset + 4 >= bytesRead) {
          console.log(`${fileName}: Reached end of buffer while reading value type for key '${key}'`);
          break;
        }
        
        const valueType = buffer.readUInt32LE(offset);
        offset += 4;
        
        let value = null;
        
        // Parse value based on type
        switch (valueType) {
          case 4: // GGUF_TYPE_UINT32
            if (offset + 4 <= bytesRead) {
              value = buffer.readUInt32LE(offset);
              offset += 4;
            }
            break;
          case 5: // GGUF_TYPE_INT32
            if (offset + 4 <= bytesRead) {
              value = buffer.readInt32LE(offset);
              offset += 4;
            }
            break;
          case 6: // GGUF_TYPE_FLOAT32
            if (offset + 4 <= bytesRead) {
              value = buffer.readFloatLE(offset);
              offset += 4;
            }
            break;
          case 7: // GGUF_TYPE_BOOL
            if (offset + 1 <= bytesRead) {
              value = buffer.readUInt8(offset) !== 0;
              offset += 1;
            }
            break;
          case 8: // GGUF_TYPE_STRING
            if (offset + 8 <= bytesRead) {
              const strLength = buffer.readBigUInt64LE(offset);
              offset += 8;
              if (Number(strLength) <= 10000 && offset + Number(strLength) <= bytesRead) {
                value = buffer.subarray(offset, offset + Number(strLength)).toString('utf-8');
                offset += Number(strLength);
              } else {
                console.log(`${fileName}: String too long or exceeds buffer: ${strLength}`);
                break;
              }
            }
            break;
          case 9: // GGUF_TYPE_ARRAY
            // Skip arrays for now - they're complex to parse
            if (offset + 12 <= bytesRead) {
              const arrayType = buffer.readUInt32LE(offset);
              offset += 4;
              const arrayLength = buffer.readBigUInt64LE(offset);
              offset += 8;
              
              const arrayLen = Number(arrayLength);
              if (arrayLen > 10000) {
                console.log(`${fileName}: Array too large: ${arrayLen}, skipping`);
                break;
              }
              
              // Skip the array data based on type
              if (arrayType === 4 || arrayType === 5 || arrayType === 6) { // uint32, int32, float32
                offset += arrayLen * 4;
              } else if (arrayType === 7) { // bool
                offset += arrayLen;
              } else if (arrayType === 8) { // string array
                for (let j = 0; j < arrayLen && offset < bytesRead - 8; j++) {
                  if (offset + 8 > bytesRead) break;
                  const strLen = buffer.readBigUInt64LE(offset);
                  offset += 8;
                  if (offset + Number(strLen) > bytesRead) break;
                  offset += Number(strLen);
                }
              } else {
                console.log(`${fileName}: Unknown array type ${arrayType}, skipping`);
                break;
              }
            }
            break;
          default:
            console.log(`${fileName}: Unknown value type ${valueType} for key '${key}', skipping`);
            break;
        }
        
        if (value !== null) {
          metadata[key] = value;
          parsedCount++;
          
          // Log interesting keys for debugging
          if (key.includes('context') || key.includes('ctx') || key.includes('length') || 
              key.includes('embedding') || key.includes('hidden') || key.includes('max_position')) {
            console.info(`${fileName}: Found metadata: ${key} = ${value}`);
          }
        }
        
      } catch (parseError) {
        console.log(`${fileName}: Error parsing metadata entry ${i}:`, parseError.message);
        break;
      }
    }
    
    console.info(`${fileName}: Successfully parsed ${parsedCount} metadata entries`);
    
    // Print ALL metadata for debugging
    console.info(`${fileName}: === ALL METADATA DUMP ===`);
    const sortedKeys = Object.keys(metadata).sort();
    for (const key of sortedKeys) {
      const value = metadata[key];
      const valueType = typeof value;
      const valueStr = valueType === 'string' && value.length > 100 ? 
        value.substring(0, 100) + '...' : 
        String(value);
      console.info(`${fileName}: ${key} (${valueType}) = ${valueStr}`);
    }
    console.info(`${fileName}: === END METADATA DUMP ===`);
    
    // Extract context size from metadata (still do this for the result)
    let contextSize = null;
    const contextKeys = [
      'llama.context_length',
      'llama.context_size', 
      'context_length',
      'n_ctx',
      'max_position_embeddings',
      // Model-specific context keys
      'qwen3moe.context_length',
      'qwen2.context_length', 
      'qwen.context_length',
      'gemma3.context_length',
      'gemma2.context_length',
      'gemma.context_length',
      'mistral.context_length',
      'phi3.context_length',
      'phi.context_length',
      'deepseek.context_length',
      'codellama.context_length',
      'bert.context_length',
      'gpt.context_length'
    ];
    
    for (const key of contextKeys) {
      if (metadata[key] && typeof metadata[key] === 'number') {
        contextSize = metadata[key];
        console.info(`${fileName}: Found context size from ${key}: ${contextSize}`);
        break;
      }
    }
    
    // Extract embedding size
    let embeddingSize = null;
    const embeddingKeys = [
      'llama.embedding_length',
      'llama.embedding_size',
      'embedding_length',
      'hidden_size',
      'n_embd',
      // Model-specific embedding keys
      'qwen3moe.embedding_length',
      'qwen2.embedding_length',
      'qwen.embedding_length', 
      'gemma3.embedding_length',
      'gemma2.embedding_length',
      'gemma.embedding_length',
      'mistral.embedding_length',
      'phi3.embedding_length',
      'phi.embedding_length',
      'deepseek.embedding_length',
      'codellama.embedding_length',
      'bert.embedding_length',
      'gpt.embedding_length'
    ];
    
    for (const key of embeddingKeys) {
      if (metadata[key] && typeof metadata[key] === 'number') {
        embeddingSize = metadata[key];
        console.info(`${fileName}: Found embedding size from ${key}: ${embeddingSize}`);
        break;
      }
    }
    
    const result = {
      version,
      tensorCount: Number(tensorCount),
      metadataCount: Number(metadataCount),
      contextSize,
      embeddingSize,
      parsedMetadataCount: parsedCount,
      availableKeys: Object.keys(metadata) // Include for debugging
    };
    
    console.info(`${fileName}: Metadata extraction result - Context: ${contextSize || 'unknown'}, Embedding: ${embeddingSize}`);
    
    return result;
    
  } catch (error) {
    console.error(`Failed to extract GGUF metadata from ${path.basename(modelPath)}:`, error.message);
    return {
      contextSize: null,
      error: error.message
    };
  }
}

async function testSpecificModel() {
  const modelPath = "C:\\Users\\Admin\\.clara\\llama-models\\Qwen3-30B-A3B-Thinking-2507.i1-Q4_K_M.gguf";
  
  console.log("🚀 Testing enhanced metadata extraction with full dump...\n");
  
  const result = await extractGGUFMetadata(modelPath);
  
  console.log("\n📊 Final Result:", result);
}

testSpecificModel().catch(console.error);
