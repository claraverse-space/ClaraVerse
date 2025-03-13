Creating a GetClipboardText Node: Step-by-Step Guide
I'll walk you through creating a node that retrieves text from the system clipboard. This is a practical node that can be useful in many workflows.

1. Create the Node Component
First, create a React component for the visual representation of your node:

/src/components/appcreator_components/nodes/GetClipboardTextNode.tsx

```tsx

import React, { useState } from 'react';
import { Handle, Position } from 'reactflow';
import { Clipboard, RefreshCw } from 'lucide-react';

interface GetClipboardTextNodeProps {
  data: any;
  isConnectable: boolean;
}

const GetClipboardTextNode: React.FC<GetClipboardTextNodeProps> = ({ data, isConnectable }) => {
  const [clipboardText, setClipboardText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Function to preview clipboard content during design time
  const handleRefreshClipboard = async () => {
    setIsLoading(true);
    try {
      const text = await navigator.clipboard.readText();
      setClipboardText(text);
      // Update node data for preview
      if (!data.config) data.config = {};
      data.config.previewText = text;
    } catch (error) {
      console.error('Failed to read clipboard:', error);
      setClipboardText('Error: Could not access clipboard');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="node-container min-w-[200px] rounded-md shadow-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
      {/* Node header */}
      <div className="node-header flex items-center p-2 border-b border-gray-200 dark:border-gray-700 rounded-t-md" 
           style={{ backgroundColor: data.tool?.lightColor || '#10B981' }}>
        <Clipboard className="w-4 h-4 mr-2 text-white" />
        <div className="text-sm font-medium text-white truncate">{data.label || 'Get Clipboard Text'}</div>
      </div>
      
      {/* Node content */}
      <div className="p-3 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-600 dark:text-gray-300">Get text from clipboard</span>
          <button 
            onClick={handleRefreshClipboard}
            disabled={isLoading}
            className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300"
            title="Preview clipboard content"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
        
        {/* Preview section */}
        {clipboardText && (
          <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600">
            <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Preview:</p>
            <div className="text-xs text-gray-600 dark:text-gray-400 max-h-16 overflow-y-auto">
              {clipboardText.length > 100 
                ? clipboardText.substring(0, 100) + '...' 
                : clipboardText}
            </div>
          </div>
        )}
        
        {!clipboardText && (
          <div className="text-xs text-gray-500 dark:text-gray-400 italic">
            Click refresh to preview clipboard content
          </div>
        )}
      </div>
      
      {/* Output handle for connections */}
      <Handle
        type="source"
        position={Position.Right}
        isConnectable={isConnectable}
        className="w-2 h-2 rounded-full bg-green-500 border-2 border-white dark:border-gray-800"
      />
    </div>
  );
};

export default GetClipboardTextNode;

```

2. Create the Node Executor
Create an executor for the GetClipboardText node:

/src/nodes/GetClipboardTextNode.ts

```tsx
import { registerNodeExecutor, NodeExecutionContext } from './NodeExecutorRegistry';

const executeGetClipboardText = async (context: NodeExecutionContext) => {
  const { node, updateNodeOutput } = context;
  
  try {
    // Read text from clipboard
    const clipboardText = await navigator.clipboard.readText();
    
    // Update the node's visual state
    if (updateNodeOutput) {
      updateNodeOutput(node.id, clipboardText);
    }
    
    return clipboardText;
  } catch (error) {
    console.error('Error accessing clipboard:', error);
    return 'Error: Could not access clipboard. Please ensure clipboard permissions are granted.';
  }
};

registerNodeExecutor('getClipboardTextNode', {
  execute: executeGetClipboardText
});

```

3. Register the Node Executor
Make sure the executor is loaded when the application starts:

/src/nodes/index.ts

```tsx
import './GetClipboardTextNode';
```

4. Add the Node to the Registry
Register the component in the NodeRegistry:

src/components/appcreator_components/nodes/NodeRegistry.tsx

```tsx
import TextInputNode from './TextInputNode';
// Other imports...
import GetClipboardTextNode from './GetClipboardTextNode';

// Map of all node types
const NODE_TYPES = {
  textInputNode: TextInputNode,
  // Other nodes...
  getClipboardTextNode: GetClipboardTextNode,
  // More nodes...
};

// Get all nodes as a record for ReactFlow
export const getAllNodeTypes = () => {
  return NODE_TYPES;
};

```

5. Add the Node to the Toolbar
Add your node to the ToolSidebar:

/src/components/appcreator_components/ToolSidebar.tsx

```tsx
import { Clipboard } from 'lucide-react';

const DEFAULT_TOOLS = [
  // Other tools...
  {
    id: 'getClipboardTextNode',
    name: 'Get Clipboard Text',
    description: 'Retrieve text from system clipboard',
    icon: Clipboard,
    color: 'bg-emerald-500',
    bgColor: 'bg-emerald-100',
    lightColor: '#10B981',
    darkColor: '#059669',
    category: 'input'
  },
  // More tools...
];

```

Also add it to the AppCreator component's toolItems array:

/src/components/AppCreator.tsx

```tsx
import { Clipboard } from 'lucide-react';

const toolItems: ToolItem[] = [
  // Other tools...
  {
    id: 'get_clipboard_text',
    name: 'Get Clipboard Text',
    description: 'Retrieve text from system clipboard',
    icon: Clipboard,
    color: 'bg-emerald-500',
    bgColor: 'bg-emerald-100',
    lightColor: '#10B981',
    darkColor: '#059669',
    category: 'input',
    inputs: [],
    outputs: ['text']
  },
  // More tools...
];

```
6. Add Drag and Drop Support
Add support for drag and drop in the AppCreator component:

/src/components/AppCreator.tsx

```tsx
const onDrop = useCallback(
  (event: React.DragEvent<HTMLDivElement>) => {
    // Other code...
    switch(toolId) {
      // Other cases...
      case 'get_clipboard_text': 
        nodeType = 'getClipboardTextNode'; 
        break;
      // More cases...
    }
    // More code...
  },
  [/* dependencies */]
);

```

7. Update the Execution Engine
Add support for your node type in the ExecutionEngine:

/src/ExecutionEngine.ts

```tsx
async function executeNode(node: Node, context: ExecutionContext): Promise<any> {
  switch (node.type) {
    // Other cases...
    
    case 'getClipboardTextNode': {
      try {
        // Read text from clipboard
        const clipboardText = await navigator.clipboard.readText();
        return clipboardText;
      } catch (error) {
        console.error('Error accessing clipboard:', error);
        return 'Error: Could not access clipboard. Please ensure permissions are granted.';
      }
    }
    
    // More cases...
  }
}

```

8. Add App Runner Support
Update the AppCreator to handle saving and testing your node:

/src/components/AppCreator.tsx

```tsx
// For saving apps with your node
const internalSaveApp = async (name: string, description: string, icon: string, color: string) => {
  try {
    const processedNodes = nodes.map((node) => {
      const processedNode = { ...node };
      
      // Don't save preview data for clipboard node
      if (node.type === 'getClipboardTextNode') {
        processedNode.data = {
          ...node.data,
          config: {
            ...node.data.config,
            previewText: undefined // Don't save preview text
          }
        };
      }
      // Other node types...
      
      return processedNode;
    });
    // More code...
  } catch (error) {
    // Error handling...
  }
};
```

10. Test Your Node
Start the application
Drag the "Get Clipboard Text" node onto the canvas
Connect it to another node (e.g., TextOutput)
Copy some text to your clipboard
Click the test button in the app
The node should read from your clipboard and pass the text to the connected node
Additional Considerations
Browser Permissions: Clipboard access requires permissions in modern browsers. Users will be prompted to allow clipboard access when the node runs.
Error Handling: The code includes error handling for cases where clipboard access fails.
Preview Feature: The refresh button allows previewing clipboard content during design time.
Complete Implementation Flow
User drags the "Get Clipboard Text" node onto the canvas
When the app is tested or run:
The node executor requests clipboard access
The clipboard text is read
The text is passed to connected nodes
The UI is updated to show the result
This implementation provides a useful node that can be part of more complex workflows, allowing users to easily bring clipboard content into their applications.






