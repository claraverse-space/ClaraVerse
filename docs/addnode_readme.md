# Adding New Nodes to Clara-Ollama

This document provides a comprehensive guide on how to add new node types to the Clara-Ollama application.

## Table of Contents
1. [Introduction](#introduction)
2. [Node Architecture](#node-architecture)
3. [Step-by-Step Guide](#step-by-step-guide)
4. [Testing and Debugging](#testing-and-debugging)
5. [Example: Adding an Image+Text LLM Node](#example-adding-an-imagetext-llm-node)
6. [Working with Images](#working-with-images)
7. [Common Pitfalls](#common-pitfalls)
8. [Troubleshooting](#troubleshooting)

## Introduction

Nodes are the fundamental building blocks of workflows in Clara-Ollama. Each node represents a specific operation or functionality, such as input handling, AI processing, or output display. Adding new node types allows you to extend the application's capabilities with custom functionality.

## Node Architecture

The node system in Clara-Ollama consists of three main components:

1. **Visual Component**: React component that renders the node UI in the flow editor
2. **Node Executor**: Logic that handles the node's execution during workflow runs
3. **Registration**: System that connects the component to the application

Key concepts:
- **Node Types**: Unique identifiers for each kind of node (e.g., `textInputNode`, `imageTextLlmNode`)
- **Tools**: UI representation of nodes in the sidebar
- **Executors**: Backend logic for processing node operations

## Step-by-Step Guide

### 1. Create the Node Visual Component

Create a new file in `/src/components/appcreator_components/nodes/` named after your node (e.g., `MyCustomNode.tsx`):

```tsx
import React, { useState } from 'react';
import { Handle, Position } from 'reactflow';
import { useTheme } from '../../../hooks/useTheme';

const MyCustomNode = ({ data, isConnectable }: any) => {
  const { isDark } = useTheme();
  const tool = data.tool;
  const Icon = tool.icon;
  const nodeColor = isDark ? tool.darkColor : tool.lightColor;
  
  // Your node-specific state and handlers
  const [someState, setSomeState] = useState('');
  
  // Event propagation handling
  const stopPropagation = (e: React.SyntheticEvent) => {
    e.stopPropagation();
    e.nativeEvent.stopImmediatePropagation();
  };
  
  return (
    <div 
      className={`p-3 rounded-lg border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} shadow-md w-64`}
      onClick={stopPropagation}
    >
      {/* Node header with icon and title */}
      <div className="flex items-center gap-2 mb-2">
        <div className="p-2 rounded-lg" style={{ background: nodeColor }}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div className="font-medium text-sm">
          {data.label}
        </div>
      </div>
      
      {/* Node content - inputs, configuration, etc. */}
      <div className="mb-2">
        {/* Your node-specific UI elements */}
      </div>
      
      {/* Input and output handles */}
      <Handle
        type="target"
        position={Position.Top}
        id="input-1"
        isConnectable={isConnectable}
        className="!bg-blue-500 !w-3 !h-3"
        style={{ top: -6 }}
      />
      
      <Handle
        type="source"
        position={Position.Bottom}
        id="output-1"
        isConnectable={isConnectable}
        className="!bg-purple-500 !w-3 !h-3"
        style={{ bottom: -6 }}
      />
    </div>
  );
};

export default MyCustomNode;
```

### 2. Create the Node Executor

Create a new file in `/src/nodeExecutors/` named after your node (e.g., `MyCustomExecutor.tsx`):

```tsx
import { registerNodeExecutor, NodeExecutionContext } from './NodeExecutorRegistry';

const executeMyCustomNode = async (context: NodeExecutionContext) => {
  const { node, inputs, updateNodeOutput } = context;
  
  try {
    // Get input from connected nodes
    const input = inputs.text || inputs['text-in'] || inputs.default || '';
    
    // Read node configuration
    const config = node.data.config || {};
    const someConfig = config.someConfig || 'default';
    
    // Process the input
    const output = `Processed: ${input} with ${someConfig}`;
    
    // Update the node's visual output if needed
    if (updateNodeOutput) {
      updateNodeOutput(node.id, output);
    }
    
    // Return the result for downstream nodes
    return output;
  } catch (error) {
    console.error("Error in MyCustomNode execution:", error);
    return `Error: ${error instanceof Error ? error.message : String(error)}`;
  }
};

// Register the executor with the unique node type ID
registerNodeExecutor('myCustomNode', {
  execute: executeMyCustomNode
});
```

### 3. Register the Node Component

Update the `/src/components/appcreator_components/nodes/NodeRegistry.tsx` file:

```tsx
import MyCustomNode from './MyCustomNode';

// Add to the NODE_TYPES object
const NODE_TYPES = {
  // ...existing node types
  myCustomNode: MyCustomNode
};
```

### 4. Register the Node Executor

Update the `/src/nodeExecutors/index.tsx` file:

```tsx
// Import all executors so they self-register
import './MyCustomExecutor';
// ...other imports
```

### 5. Add the Node to the Tool Sidebar

Update the `toolItems` array in `/src/components/AppCreator.tsx`:

```tsx
import { MyIcon } from 'lucide-react';

const toolItems: ToolItem[] = [
  // ...existing tools
  {
    id: 'my_custom',
    name: 'My Custom Node',
    description: 'Does something awesome',
    icon: MyIcon,
    color: 'bg-purple-500',
    bgColor: 'bg-purple-100',
    lightColor: '#8B5CF6',
    darkColor: '#7C3AED',
    category: 'function',
    inputs: ['text'],
    outputs: ['text']
  }
];
```

### 6. Update the onDrop Handler

Add a case to the `onDrop` handler in `/src/components/AppCreator.tsx`:

```tsx
switch(toolId) {
  // ...existing cases
  case 'my_custom': 
    nodeType = 'myCustomNode';
    break;
}
```

### 7. Add Node Handling to ExecutionEngine

If your node requires special handling beyond the standard pattern, update the `executeNode` function in `/src/ExecutionEngine.ts`:

```typescript
switch (node.type) {
  // ...existing cases
  case 'myCustomNode': {
    // Your custom execution logic
  }
}
```

## Testing and Debugging

1. **Visual Testing**: Verify your node appears in the sidebar and can be dragged onto the canvas
2. **Configuration Testing**: Test that configuration options work correctly
3. **Connection Testing**: Verify input and output connections work with other nodes
4. **Execution Testing**: Test the node in a workflow to ensure it performs its function

Debugging tools:
- Use the built-in debug panel
- Add the following component to your app during development:

```tsx
const NodeRegistryDebug = () => {
  useEffect(() => {
    // Check visual components registration
    const nodeTypes = getAllNodeTypes();
    console.log('Registered node types:', Object.keys(nodeTypes));

    // Check executor registration
    console.log('Node executors:', nodeTypeIds.map(id => 
      `${id}: ${hasNodeExecutor(id)}`
    ));
  }, []);

  return <div>Check console for debug info</div>;
};
```

## Example: Adding an Image+Text LLM Node

Here's a complete example of adding an Image+Text LLM node:

### 1. Visual Component (ImageTextLlmNode.tsx)

```tsx
import React, { useState, useEffect } from 'react';
import { Handle, Position } from 'reactflow';
import { useTheme } from '../../../hooks/useTheme';
import { ImagePlus, MessageSquare } from 'lucide-react';

const ImageTextLlmNode = ({ data, isConnectable }: any) => {
  // Component implementation...
  return (
    <div className="...">
      {/* UI implementation */}
      <Handle
        type="target"
        position={Position.Top}
        id="image-in"
        isConnectable={isConnectable}
        className="!bg-pink-500 !w-3 !h-3"
        style={{ top: -6, left: '30%' }}
      />
      <Handle
        type="target"
        position={Position.Top}
        id="text-in"
        isConnectable={isConnectable}
        className="!bg-purple-500 !w-3 !h-3"
        style={{ top: -6, left: '70%' }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="text-out"
        isConnectable={isConnectable}
        className="!bg-green-500 !w-3 !h-3"
        style={{ bottom: -6 }}
      />
    </div>
  );
};

export default ImageTextLlmNode;
```

### 2. Node Executor (ImageTextLlmExecutor.tsx)

```tsx
import { registerNodeExecutor, NodeExecutionContext } from './NodeExecutorRegistry';

const executeImageTextLlm = async (context: NodeExecutionContext) => {
  const { node, inputs, updateNodeOutput } = context;
  
  try {
    // Get image and text inputs
    const imageInput = inputs.image || inputs['image-in'] || '';
    const textInput = inputs.text || inputs['text-in'] || '';
    
    // Process inputs with Ollama
    const config = node.data.config || {};
    const model = config.model || 'llava';
    
    // Make API call and return result...
    
  } catch (error) {
    console.error("Error in Image-Text LLM node execution:", error);
    return `Error: ${error instanceof Error ? error.message : String(error)}`;
  }
};

registerNodeExecutor('imageTextLlmNode', {
  execute: executeImageTextLlm
});
```

### 3-7. Registration and Tool Setup

```tsx
// In NodeRegistry.tsx
import ImageTextLlmNode from './ImageTextLlmNode';
const NODE_TYPES = {
  // ...others
  imageTextLlmNode: ImageTextLlmNode
};

// In index.tsx
import './ImageTextLlmExecutor';

// In AppCreator.tsx
const toolItems = [
  // ...others
  {
    id: 'image_text_llm',
    name: 'Image + Text LLM',
    description: 'Process image and text with a vision model',
    icon: ImagePlus,
    category: 'function',
    inputs: ['image', 'text'],
    outputs: ['text']
  }
];

// In onDrop handler
case 'image_text_llm':
  nodeType = 'imageTextLlmNode';
  break;
```

## Working with Images

When creating nodes that work with images, there are several important considerations:

### Design-time vs. Runtime Image Handling

For nodes that handle images, you need to distinguish between design-time configuration (when building the app) and runtime user inputs:

1. **Design-time**: Images are stored in the node's `data.config.image` property
2. **Runtime**: Images should be stored in `data.runtimeImage` to allow users to replace them

Example pattern for image input nodes:

```tsx
const ImageInputNode = ({ data, isConnectable, isRunnerMode = false }) => {
  // Use runtime image if available, otherwise use config image
  const [image, setImage] = useState(data.runtimeImage || data.config?.image || null);
  
  const handleImageUpload = (e) => {
    if (e.target.files?.[0]) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const imageData = event.target.result;
        
        // Store in the appropriate location based on mode
        if (isRunnerMode) {
          data.runtimeImage = imageData; // For runtime
        } else {
          data.config.image = imageData; // For design-time
        }
        
        setImage(imageData);
      };
      reader.readAsDataURL(file);
    }
  };
  
  // Rest of the node implementation...
};
```

### Base64 Image Processing

When working with images, you'll often need to process base64 data:

1. **Handling Prefixes**: Images may include data URL prefixes (`data:image/jpeg;base64,`) 
   which need to be removed for API calls:

```typescript
// Remove data URL prefix if present
if (typeof imageData === 'string' && imageData.startsWith('data:image/')) {
  imageData = imageData.replace(/^data:image\/[a-zA-Z]+;base64,/, '');
}
```

2. **Size Considerations**: Be aware of size limitations with base64-encoded images
   - Large images may cause performance issues
   - Consider adding compression options for large images

### ExecutionEngine Integration

In the execution engine, ensure your node properly handles image data:

```typescript
case 'imageInputNode': {
  // First check for a runtime image, then fall back to the configured image
  return node.data.runtimeImage || node.data.config.image || null;
}
```

## Common Pitfalls

When developing custom nodes, be aware of these common issues:

### 1. Configuration Storage Issues

**Problem**: Node configuration not being properly saved or restored.

**Solution**: Save configuration in multiple locations:

```typescript
// Store configuration in multiple places to ensure robustness
if (!data.config) data.config = {};
data.config.yourSetting = value;

// Also store at root level for direct access (useful for critical data)
data.yourSetting = value;
```

### 2. Event Propagation Issues

**Problem**: Clicking on node inputs triggers node selection or dragging.

**Solution**: Use comprehensive event stopping:

```typescript
const stopPropagation = (e: React.SyntheticEvent) => {
  e.stopPropagation();
  e.nativeEvent.stopImmediatePropagation();
};

// Apply to interactive elements
<input onClick={stopPropagation} onMouseDown={stopPropagation} />
```

### 3. Hardcoded URLs or Configuration

**Problem**: Using hardcoded values instead of configuration data.

**Solution**: Always use configuration with graceful fallbacks:

```typescript
// Avoid hardcoded fallbacks for critical configuration
const serverUrl = config.serverUrl; 
if (!serverUrl) {
  return "Error: No server URL configured. Please set the URL in settings.";
}

// Only use hardcoded defaults for non-critical styling or text
const labelText = config.label || "Default Label";
```

### 4. Image Node Runtime Issues

**Problem**: Image inputs can't be replaced at runtime.

**Solution**: Implement runtime image handling:

```typescript
// In AppRunner.tsx
const handleImageUpload = (nodeId, file) => {
  const reader = new FileReader();
  reader.onload = (event) => {
    // Update app data with runtime image
    setAppData(prev => ({
      ...prev,
      nodes: prev.nodes.map(node => 
        node.id === nodeId 
          ? {...node, data: {...node.data, runtimeImage: event.target.result}} 
          : node
      )
    }));
  };
  reader.readAsDataURL(file);
};
```

## Troubleshooting

### Common Issues

1. **Node doesn't appear in sidebar:**
   - Check that the tool is correctly added to `toolItems` array
   - Verify the tool is being passed to `ToolSidebar` component

2. **Node appears but doesn't work when dropped:**
   - Check the `onDrop` handler includes your node type
   - Ensure the node type matches between component and executor

3. **Node doesn't execute:**
   - Verify the executor is registered with the correct type
   - Check console for errors during execution
   - Ensure the node is imported in `nodeExecutors/index.tsx`

4. **Node connections don't work:**
   - Check that input/output handle IDs are correct
   - Verify the tool definition includes correct input/output types
   - Look at the `isValidConnection` function in AppCreator.tsx

5. **Node configuration not saving:**
   - Make sure you're updating both `data.config` and the component state
   - Check if the object structure matches what's expected in other code

6. **Images not displaying or processing:**
   - Check image format and encoding (base64, data URL, etc.)
   - Verify that image data is being stored correctly in node state
   - Ensure the correct properties are being accessed during execution
   - Consider size limitations and possible need for compression

### Additional Resources

For more detailed debugging, add the debug components to App.tsx:

```tsx
{import.meta.env.DEV && (
  <>
    <NodeRegistryDebug />
    <ToolbarDebug />
  </>
)}
```

If all else fails, try the following:
1. Clear browser cache and reload
2. Check all console logs for errors
3. Verify type names are consistent across all files (camelCase is standard)
4. Restart the development server
