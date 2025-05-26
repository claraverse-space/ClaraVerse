# MCP Tool Execution Troubleshooting Guide

## Issues Identified and Fixed

### 1. **Tool Name Mismatch** ❌ → ✅
**Problem**: The brave-search server was reporting "Unknown tool: web_search" because the `claraMCPService.ts` was defining incorrect tool names.

**Root Cause**: The brave-search MCP server actually provides tools named:
- `brave_web_search` (not `web_search`)
- `brave_local_search`

**Fix Applied**: Updated `addSearchTools()` method in `src/services/claraMCPService.ts` to use the correct tool names and schemas:

```typescript
// Before (incorrect)
name: 'web_search'

// After (correct)
name: 'brave_web_search'
name: 'brave_local_search'
```

### 2. **JSON Parsing Errors** ❌ → ✅
**Problem**: "Unexpected end of JSON input" errors were occurring when parsing MCP server responses.

**Root Cause**: The MCP server responses were sometimes incomplete or malformed, causing JSON.parse() to fail.

**Fix Applied**: Added robust error handling in `electron/mcpService.cjs`:

```javascript
// Added try-catch for individual line parsing
try {
  const response = JSON.parse(line);
  // ... process response
} catch (lineParseError) {
  // Skip malformed lines and continue
  log.debug(`Skipping malformed JSON line from ${serverName}:`, line);
  continue;
}
```

### 3. **Empty Tool Names** ❌ → ✅
**Problem**: Some tool calls had empty or undefined function names, causing "Tool '' not found" errors.

**Root Cause**: Malformed tool calls from the AI model where `toolCall.function?.name` was empty.

**Fix Applied**: Added validation in `src/services/claraApiService.ts`:

```typescript
// Check for malformed tool calls
if (!functionName || functionName.trim() === '') {
  console.warn('⚠️ Skipping malformed tool call with empty function name:', toolCall);
  const result = {
    toolName: 'unknown',
    success: false,
    error: 'Tool call has empty or missing function name'
  };
  results.push(result);
  continue;
}
```

### 4. **Tool Call Parsing Robustness** ❌ → ✅
**Problem**: The `parseOpenAIToolCalls` method could fail on malformed tool calls.

**Root Cause**: No error handling for JSON parsing of tool arguments or invalid tool name formats.

**Fix Applied**: Added comprehensive error handling in `src/services/claraMCPService.ts`:

```typescript
// Safe argument parsing
let parsedArguments = {};
try {
  parsedArguments = JSON.parse(toolCall.function.arguments || '{}');
} catch (parseError) {
  console.warn(`⚠️ Failed to parse tool arguments for ${toolCall.function.name}:`, parseError);
  parsedArguments = {};
}
```

### 5. **Hardcoded Tool Discovery** ❌ → ✅
**Problem**: Tools were hardcoded for specific server types, preventing dynamic discovery of external MCP servers.

**Root Cause**: The `discoverServerCapabilities` method used hardcoded tool lists instead of querying servers.

**Fix Applied**: Implemented dynamic tool discovery using the MCP protocol:
- Added `tools/list` request handling in `electron/mcpService.cjs`
- Updated `discoverServerCapabilities` to query servers dynamically
- Fallback to hardcoded tools only if dynamic discovery fails

### 6. **Streaming Tool Call Parsing** ❌ → ✅
**Problem**: Tool call arguments were being streamed in chunks, causing incomplete or malformed tool calls.

**Root Cause**: The streaming parser wasn't properly accumulating tool call arguments across multiple chunks.

**Fix Applied**: Enhanced streaming tool call parsing in `src/services/claraApiService.ts`:
- Proper accumulation of tool call arguments across chunks
- Validation to filter out incomplete tool calls
- JSON parsing validation before execution

## Current Status

✅ **Fixed**: Tool name mismatches for brave-search server
✅ **Fixed**: JSON parsing errors in MCP backend
✅ **Fixed**: Empty tool name handling
✅ **Fixed**: Robust tool call parsing
✅ **Fixed**: Dynamic tool discovery implementation
✅ **Fixed**: Streaming tool call argument accumulation

## Testing the Fixes

1. **Restart the application** to ensure all changes are loaded
2. **Try a search query** like "search for recent AI developments"
3. **Check the console logs** for proper tool execution:
   - Should see dynamic tool discovery messages
   - Should see `mcp_brave-search_brave_web_search` being called
   - Should not see "Unknown tool" errors
   - Should not see "Unexpected end of JSON input" errors
   - Should not see empty tool name errors

## Expected Behavior

When working correctly, you should see logs like:
```
🔍 Starting tool and resource discovery...
✅ Dynamically discovered 2 tools from MCP server 'brave-search'
🔧 Executing tool: mcp_brave-search_brave_web_search with args: {query: 'AI developments', count: 5}
✅ MCP tool mcp_brave-search_brave_web_search result: {...}
```

## Dynamic Tool Discovery

The system now supports true dynamic tool discovery:
- When any MCP server is added and started, it will be queried for available tools
- Tools are registered automatically without code changes
- External/custom MCP servers will work out of the box
- Hardcoded tools are only used as fallback for legacy servers

## Additional Recommendations

1. **Ensure MCP servers are running** with proper API keys
2. **Check server logs** in the Electron console for any startup issues
3. **Verify tool discovery** by checking the available tools list
4. **Monitor network connectivity** for external API calls
5. **Test with external MCP servers** to verify dynamic discovery

## Future Improvements

- [ ] Add retry logic for failed MCP server communications
- [ ] Add health checks for MCP servers
- [ ] Improve error messages for better debugging
- [ ] Add UI feedback for tool discovery progress
- [ ] Implement resource discovery alongside tool discovery 