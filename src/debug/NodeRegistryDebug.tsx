import React, { useEffect } from 'react';
import { getAllNodeTypes } from '../components/appcreator_components/nodes/NodeRegistry';
import { getNodeExecutor, hasNodeExecutor } from '../nodeExecutors/NodeExecutorRegistry';

const NodeRegistryDebug = () => {
  useEffect(() => {
    // Check visual components registration
    const nodeTypes = getAllNodeTypes();
    console.log('Registered node types (visual components):', Object.keys(nodeTypes));

    // Check executor registration
    const nodeTypeIds = [
      'textInputNode',
      'imageInputNode',
      'llmPromptNode',
      'textOutputNode',
      'conditionalNode',
      'apiCallNode',
      'textCombinerNode', 
      'markdownOutputNode',
      'staticTextNode',
      'imageTextLlmNode'
    ];

    nodeTypeIds.forEach(id => {
      console.log(`Node '${id}' has executor: ${hasNodeExecutor(id)}`);
      if (hasNodeExecutor(id)) {
        console.log(`Node '${id}' executor:`, getNodeExecutor(id));
      }
    });

  }, []);

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Node Registry Debug</h2>
      <p>Check browser console for node registration information</p>
    </div>
  );
};

export default NodeRegistryDebug;
