import React, { useState, useEffect, useRef } from 'react';
import { Bot, Terminal, X, FileText, Image, Calculator, Upload, Info } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { agentWorkflowStorage } from '../services/agentWorkflowStorage';
import { customNodeManager } from './AgentBuilder/NodeCreator/CustomNodeManager';

// Import Clara Flow SDK
import { ClaraFlowRunner } from '../../sdk/src/ClaraFlowRunner';

interface ChatMessage {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface InputValue {
  nodeId: string;
  nodeName: string;
  value: string | File | null;
  type: 'text' | 'file' | 'number';
}

interface AgentRunnerProps {
  agentId: string;
  onClose: () => void;
}

interface SDKExecutionLog {
  id: string;
  level: 'info' | 'success' | 'warning' | 'error';
  message: string;
  timestamp: string;
  nodeId?: string;
  nodeName?: string;
  duration?: number;
  data?: any;
}

const formatMessage = (content: string) => {
  return (
    <ReactMarkdown
      className="prose prose-sm max-w-none dark:prose-invert"
      components={{
        p: ({ children }) => <p className="text-gray-800 dark:text-purple-100 mb-2 last:mb-0">{children}</p>,
        h1: ({ children }) => <h1 className="text-gray-900 dark:text-purple-100 text-lg font-bold mb-2">{children}</h1>,
        h2: ({ children }) => <h2 className="text-gray-900 dark:text-purple-100 text-base font-bold mb-2">{children}</h2>,
        h3: ({ children }) => <h3 className="text-gray-900 dark:text-purple-100 text-sm font-bold mb-1">{children}</h3>,
        ul: ({ children }) => <ul className="text-gray-800 dark:text-purple-100 list-disc list-inside mb-2 space-y-1">{children}</ul>,
        ol: ({ children }) => <ol className="text-gray-800 dark:text-purple-100 list-decimal list-inside mb-2 space-y-1">{children}</ol>,
        li: ({ children }) => <li className="text-gray-800 dark:text-purple-100">{children}</li>,
        strong: ({ children }) => <strong className="text-gray-900 dark:text-purple-100 font-semibold">{children}</strong>,
        em: ({ children }) => <em className="text-gray-800 dark:text-purple-100 italic">{children}</em>,
        code: ({ children }) => (
          <code className="bg-gray-100 dark:bg-purple-800/40 text-gray-800 dark:text-purple-200 px-2 py-1 rounded text-xs font-mono border border-gray-300 dark:border-purple-600/30">
            {children}
          </code>
        ),
        pre: ({ children }) => (
          <pre className="bg-gray-100 dark:bg-purple-800/40 text-gray-800 dark:text-purple-200 p-3 rounded-lg overflow-x-auto text-xs font-mono mb-2 border border-gray-300 dark:border-purple-600/30">
            {children}
          </pre>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
};

const AgentRunnerSDK: React.FC<AgentRunnerProps> = ({ agentId, onClose }) => {
  // State management - completely independent from AgentBuilderContext
  const [agentFlow, setAgentFlow] = useState<any>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValues, setInputValues] = useState<InputValue[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [agentLoading, setAgentLoading] = useState(true);
  const [showLogs, setShowLogs] = useState(false);
  const [executionLogs, setExecutionLogs] = useState<SDKExecutionLog[]>([]);
  const [showTooltip, setShowTooltip] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load the agent workflow on component mount
  useEffect(() => {
    const loadAgent = async () => {
      try {
        setAgentLoading(true);
        console.log('🔄 Loading agent workflow:', agentId);
        
        const agent = await agentWorkflowStorage.getWorkflow(agentId);
        if (agent) {
          console.log('✅ Agent loaded successfully:', agent);
          setAgentFlow(agent);
          
          // Extract input nodes for UI
          const inputNodes = agent.nodes.filter((node: any) => 
            node.type === 'input' || 
            node.type === 'image-input' || 
            node.type === 'pdf-input' || 
            node.type === 'file-upload'
          );
          
          console.log('📥 Found input nodes:', inputNodes);
          
          // Initialize input values
          const initialValues = inputNodes.map((node: any) => ({
            nodeId: node.id,
            nodeName: node.name || `Input ${node.id}`,
            value: '',
            type: getInputTypeFromNodeType(node.type)
          }));
          
          setInputValues(initialValues);
        } else {
          console.error('❌ Agent not found:', agentId);
        }
      } catch (error) {
        console.error('❌ Failed to load agent:', error);
      } finally {
        setAgentLoading(false);
      }
    };

    if (agentId) {
      loadAgent();
    }
  }, [agentId]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const getInputTypeFromNodeType = (nodeType: string): 'text' | 'file' | 'number' => {
    if (nodeType.includes('image') || nodeType.includes('pdf') || nodeType.includes('file')) {
      return 'file';
    }
    if (nodeType.includes('number')) {
      return 'number';
    }
    return 'text';
  };

  const convertToSDKFormat = (agentFlow: any): any => {
    // Get custom nodes from the agent flow or fetch them from the custom node manager
    let customNodes = agentFlow.customNodes || [];
    
    // Check if any nodes in the flow are custom nodes and collect their definitions
    const customNodeTypes = new Set<string>();
    
    console.log('🔍 Analyzing nodes for custom types:', agentFlow.nodes.map((n: any) => `${n.name || 'Unnamed'} (${n.type})`));
    
    // Get all known node types from custom node manager first
    let knownCustomNodeTypes = new Set<string>();
    if (customNodeManager && customNodeManager.getCustomNodes) {
      try {
        const allCustomNodes = customNodeManager.getCustomNodes();
        allCustomNodes.forEach((customNode: any) => {
          knownCustomNodeTypes.add(customNode.type);
        });
        console.log('📋 Known custom node types:', Array.from(knownCustomNodeTypes));
      } catch (error) {
        console.warn('⚠️ Error getting all custom nodes:', error);
      }
    }
    
    // Identify custom node types in the flow - check against known types AND use isCustomNode if available
    agentFlow.nodes.forEach((node: any) => {
      let isCustom = false;
      
      // Method 1: Check against known custom node types
      if (knownCustomNodeTypes.has(node.type)) {
        isCustom = true;
        console.log(`✅ Found custom node by type match: ${node.name || node.id} (${node.type})`);
      }
      
      // Method 2: Use isCustomNode method if available
      if (!isCustom && customNodeManager && customNodeManager.isCustomNode && typeof customNodeManager.isCustomNode === 'function') {
        try {
          isCustom = customNodeManager.isCustomNode(node.type);
          if (isCustom) {
            console.log(`✅ Found custom node by isCustomNode method: ${node.name || node.id} (${node.type})`);
          }
        } catch (error) {
          console.warn(`⚠️ Error checking if ${node.type} is custom node:`, error);
        }
      }
      
      // Method 3: Fallback - check if it's not a built-in node type
      if (!isCustom) {
        const builtInTypes = [
          'input', 'output', 'text-input', 'number-input', 'image-input', 'file-input', 'pdf-input', 'file-upload',
          'text-processor', 'math-calculator', 'image-processor', 'pdf-processor', 'llm-text', 'llm-chat',
          'data-formatter', 'conditional', 'loop', 'delay', 'http-request', 'database-query',
          'email-sender', 'file-writer', 'code-executor', 'webhook', 'scheduler'
        ];
        
        if (!builtInTypes.includes(node.type)) {
          isCustom = true;
          console.log(`✅ Found custom node by exclusion: ${node.name || node.id} (${node.type}) - not in built-in types`);
        }
      }
      
      if (isCustom) {
        customNodeTypes.add(node.type);
      }
    });
    
    // If there are custom nodes in the flow, get their full definitions from the manager
    if (customNodeTypes.size > 0 && customNodeManager && customNodeManager.getCustomNode) {
      const customNodeDefinitions = Array.from(customNodeTypes).map(nodeType => {
        const customNode = customNodeManager.getCustomNode(nodeType);
        if (customNode) {
          console.log(`✅ Found custom node definition: ${customNode.name} (${customNode.type})`);
          return {
            id: customNode.id,
            type: customNode.type,
            name: customNode.name,
            description: customNode.description,
            category: customNode.category,
            icon: customNode.icon,
            inputs: customNode.inputs,
            outputs: customNode.outputs,
            properties: customNode.properties,
            executionCode: customNode.executionCode,
            metadata: customNode.metadata
          };
        } else {
          console.warn(`⚠️ Missing custom node definition for type: ${nodeType}`);
        }
        return null;
      }).filter(Boolean);
      
      // Merge with any existing custom nodes in the flow data
      const existingCustomNodeTypes = new Set((customNodes || []).map((node: any) => node.type));
      const newCustomNodes = customNodeDefinitions.filter(node => node && !existingCustomNodeTypes.has(node.type));
      customNodes = [...(customNodes || []), ...newCustomNodes];
    }

    return {
      format: 'clara-sdk',
      version: '1.0.0',
      flow: {
        id: agentFlow.id,
        name: agentFlow.name,
        description: agentFlow.description,
        nodes: agentFlow.nodes,
        connections: agentFlow.connections || []
      },
      customNodes: customNodes,
      metadata: {
        exportedAt: new Date().toISOString(),
        exportedFrom: 'Clara Agent Runner SDK',
        hasCustomNodes: customNodes.length > 0
      }
    };
  };

  const handleInputChange = (nodeId: string, value: string | File) => {
    setInputValues(prev => prev.map(iv => 
      iv.nodeId === nodeId ? { ...iv, value } : iv
    ));
  };

  const handleRunAgent = async () => {
    if (!agentFlow || isLoading) return;

    setIsLoading(true);
    setExecutionLogs([]); // Clear previous logs
    setMessages([]); // Clear previous messages

    console.log('🚀 STARTING AGENT EXECUTION - Clara Flow SDK Approach');
    console.log('📋 Agent Flow:', agentFlow);
    console.log('📥 Input Values:', inputValues);
    
    // 🔍 DEBUG: Check custom node manager state
    console.log('🔧 Custom Node Manager Debug:');
    console.log('  - Manager available:', !!customNodeManager);
    if (customNodeManager) {
      console.log('  - Has isCustomNode method:', typeof customNodeManager.isCustomNode === 'function');
      console.log('  - Has getCustomNode method:', typeof customNodeManager.getCustomNode === 'function');
      console.log('  - Has getCustomNodes method:', typeof customNodeManager.getCustomNodes === 'function');
      
      try {
        const allCustomNodes = customNodeManager.getCustomNodes ? customNodeManager.getCustomNodes() : [];
        console.log('  - Total custom nodes in manager:', allCustomNodes.length);
        if (allCustomNodes.length > 0) {
          console.log('  - Available custom nodes:', allCustomNodes.map((n: any) => `${n.name} (${n.type})`));
          
          // Check specifically for the uppercase-converter
          const uppercaseConverter = allCustomNodes.find((n: any) => n.type === 'uppercase-converter');
          if (uppercaseConverter) {
            console.log('  - ✅ uppercase-converter found in manager:', {
              name: uppercaseConverter.name,
              type: uppercaseConverter.type,
              hasExecutionCode: !!uppercaseConverter.executionCode,
              codeLength: uppercaseConverter.executionCode?.length || 0
            });
          } else {
            console.log('  - ❌ uppercase-converter NOT found in manager');
          }
        }
      } catch (error) {
        console.warn('  - Error getting custom nodes:', error);
      }
      
      // Try to get the uppercase-converter directly
      if (customNodeManager.getCustomNode) {
        try {
          const uppercaseNode = customNodeManager.getCustomNode('uppercase-converter');
          if (uppercaseNode) {
            console.log('  - ✅ Direct getCustomNode for uppercase-converter succeeded:', {
              name: uppercaseNode.name,
              type: uppercaseNode.type,
              hasCode: !!uppercaseNode.executionCode
            });
          } else {
            console.log('  - ❌ Direct getCustomNode for uppercase-converter returned null/undefined');
          }
        } catch (error) {
          console.log('  - ❌ Direct getCustomNode for uppercase-converter failed:', error);
        }
      }
    }

    try {
      // 🆕 Create Clara Flow SDK Runner - completely isolated
      const runner = new ClaraFlowRunner({
        enableLogging: true,
        timeout: 30000
      });

      console.log('✅ Clara Flow SDK Runner created');

      // Convert agent flow to SDK format
      const sdkFlowData = convertToSDKFormat(agentFlow);
      console.log('🔄 Converted to SDK format:', sdkFlowData);
      console.log('🎨 Custom nodes in flow:', sdkFlowData.customNodes);
      
      // 🔧 EXPLICITLY REGISTER CUSTOM NODES WITH THE SDK RUNNER
      if (sdkFlowData.customNodes && sdkFlowData.customNodes.length > 0) {
        console.log('🔧 Registering custom nodes with SDK Runner:');
        for (const customNode of sdkFlowData.customNodes) {
          console.log(`  - Registering: ${customNode.name} (${customNode.type})`);
          console.log(`    Has execution code: ${!!customNode.executionCode}`);
          if (customNode.executionCode) {
            console.log(`    Code preview: ${customNode.executionCode.substring(0, 100)}...`);
          }
          
          // Register each custom node with the runner
          try {
            runner.registerCustomNode(customNode);
            console.log(`  ✅ Successfully registered: ${customNode.type}`);
          } catch (error) {
            console.error(`  ❌ Failed to register ${customNode.type}:`, error);
          }
        }
      } else {
        console.log('⚠️ No custom nodes found in SDK flow data, checking for fallback registration...');
        
        // 🔍 FALLBACK: Check if there are custom nodes in the workflow that weren't found
        const customNodeTypesInFlow = agentFlow.nodes
          .map((n: any) => n.type)
          .filter((type: string) => {
            // Use the same detection logic as in convertToSDKFormat
            let isCustom = false;
            
            // Check if it's a known custom node type
            if (customNodeManager && customNodeManager.getCustomNodes) {
              try {
                const allCustomNodes = customNodeManager.getCustomNodes();
                isCustom = allCustomNodes.some((cn: any) => cn.type === type);
              } catch (error) {
                console.warn('Error checking custom nodes:', error);
              }
            }
            
            // Fallback: check if it's not a built-in type
            if (!isCustom) {
              const builtInTypes = [
                'input', 'output', 'text-input', 'number-input', 'image-input', 'file-input', 'pdf-input', 'file-upload',
                'text-processor', 'math-calculator', 'image-processor', 'pdf-processor', 'llm-text', 'llm-chat',
                'data-formatter', 'conditional', 'loop', 'delay', 'http-request', 'database-query',
                'email-sender', 'file-writer', 'code-executor', 'webhook', 'scheduler'
              ];
              isCustom = !builtInTypes.includes(type);
            }
            
            return isCustom;
          });
        
        console.log('🔍 Custom node types found in flow for fallback:', customNodeTypesInFlow);
        
        if (customNodeTypesInFlow.length > 0) {
          console.warn('⚠️ Found custom nodes in workflow but no definitions loaded. Attempting direct registration...');
          for (const nodeType of customNodeTypesInFlow) {
            if (customNodeManager && customNodeManager.getCustomNode) {
              const customNode = customNodeManager.getCustomNode(nodeType);
              if (customNode) {
                console.log(`  - Fallback registering: ${customNode.name} (${customNode.type})`);
                try {
                  runner.registerCustomNode({
                    id: customNode.id,
                    type: customNode.type,
                    name: customNode.name,
                    description: customNode.description,
                    category: customNode.category,
                    icon: customNode.icon,
                    inputs: customNode.inputs,
                    outputs: customNode.outputs,
                    properties: customNode.properties,
                    executionCode: customNode.executionCode,
                    metadata: customNode.metadata
                  });
                  console.log(`  ✅ Fallback registration successful: ${customNode.type}`);
                } catch (error) {
                  console.error(`  ❌ Fallback registration failed for ${nodeType}:`, error);
                }
              } else {
                console.error(`  ❌ Custom node definition not found for type: ${nodeType}`);
                
                // Try to get more info about available custom nodes
                if (customNodeManager.getCustomNodes) {
                  try {
                    const available = customNodeManager.getCustomNodes();
                    console.log(`  📋 Available custom nodes: ${available.map((cn: any) => cn.type).join(', ')}`);
                  } catch (error) {
                    console.warn('  ⚠️ Error listing available custom nodes:', error);
                  }
                }
              }
            }
          }
        }
      }

      // Prepare inputs for SDK execution
      const sdkInputs: Record<string, any> = {};
      
      for (const inputValue of inputValues) {
        if (inputValue.value) {
          if (inputValue.type === 'file' && inputValue.value instanceof File) {
            // Handle file inputs
            const file = inputValue.value;
            let processedContent: string;
            
            if (file.type.startsWith('image/')) {
              // Convert image to base64
              processedContent = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.readAsDataURL(file);
              });
            } else if (file.type === 'application/pdf') {
              // Convert PDF to base64
              processedContent = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.readAsDataURL(file);
              });
            } else {
              // Read text files as text
              processedContent = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.readAsText(file);
              });
            }
            
            sdkInputs[inputValue.nodeName] = processedContent;
          } else {
            // Handle text/number inputs
            sdkInputs[inputValue.nodeName] = inputValue.value;
          }
        }
      }

      console.log('📤 SDK Inputs prepared:', sdkInputs);

      // 🎯 Execute using Clara Flow SDK - COMPLETELY ISOLATED
      console.log('⚡ Executing flow with Clara Flow SDK...');
      const executionResult = await runner.executeFlow(sdkFlowData, sdkInputs);
      
      console.log('🎉 SDK Execution completed!');
      console.log('📊 Raw SDK Results:', executionResult);

      // Extract results from SDK output
      const outputNodes = agentFlow.nodes.filter((node: any) => node.type === 'output');
      console.log('📤 Output nodes found:', outputNodes);

      let responseContent = '';
      
      if (Object.keys(executionResult).length === 0) {
        responseContent = '✅ **Execution Complete!**\n\nNo output results generated. Make sure your workflow has output nodes connected to the data flow.';
      } else {
        // Process SDK results
        const outputResults: Array<{label: string, content: string}> = [];
        
        for (const outputNode of outputNodes) {
          const nodeResult = executionResult[outputNode.id];
          
          if (nodeResult !== undefined && nodeResult !== null) {
            let processedContent = '';
            
            // Process the result based on its type
            if (typeof nodeResult === 'object') {
              // Try to unwrap common result formats
              if (nodeResult.output !== undefined) {
                processedContent = String(nodeResult.output);
              } else if (nodeResult.result !== undefined) {
                processedContent = String(nodeResult.result);
              } else if (nodeResult.text !== undefined) {
                processedContent = String(nodeResult.text);
              } else if (nodeResult.content !== undefined) {
                processedContent = String(nodeResult.content);
              } else if (nodeResult.value !== undefined) {
                processedContent = String(nodeResult.value);
              } else {
                // Display as JSON if it's a complex object
                processedContent = `\`\`\`json\n${JSON.stringify(nodeResult, null, 2)}\n\`\`\``;
              }
            } else {
              // Simple value - use as string
              processedContent = String(nodeResult);
            }
            
            if (processedContent.trim()) {
              outputResults.push({
                label: outputNode.name || `Output ${outputNode.id}`,
                content: processedContent
              });
            }
          }
        }
        
        // Format response
        if (outputResults.length === 0) {
          responseContent = '✅ **Execution Complete!**\n\nFlow execution completed but no output results found.';
        } else if (outputResults.length === 1) {
          // Single output - just show the content
          responseContent = `✅ **Execution Complete!**\n\n${outputResults[0].content}`;
        } else {
          // Multiple outputs - show with labels
          responseContent = '✅ **Execution Complete!**\n\n' + outputResults
            .map(result => `**${result.label}:**\n${result.content}`)
            .join('\n\n---\n\n');
        }
      }

      console.log('🎯 Final Response Content:', responseContent);

      // Create user message
      const userMessage: ChatMessage = {
        id: Date.now() + '_user',
        type: 'user',
        content: `Running agent with ${inputValues.filter(iv => iv.value).length} input(s)`,
        timestamp: new Date().toISOString()
      };

      // Create assistant message with results
      const assistantMessage: ChatMessage = {
        id: Date.now() + '_assistant',
        type: 'assistant',
        content: responseContent,
        timestamp: new Date().toISOString()
      };

      setMessages([userMessage, assistantMessage]);
      
      // Get execution logs from SDK
      const sdkLogs = runner.getLogs();
      console.log('📝 Final SDK logs:', sdkLogs);
      
      // Convert SDK logs to our format
      const convertedLogs = sdkLogs.map((log: any) => ({
        id: `${Date.now()}-${Math.random()}`,
        level: log.level || 'info',
        message: log.message,
        timestamp: log.timestamp || new Date().toISOString(),
        nodeId: log.nodeId,
        nodeName: log.nodeName,
        duration: log.duration,
        data: log.data
      }));
      
      setExecutionLogs(convertedLogs);
      
    } catch (error) {
      console.error('❌ Clara Flow SDK execution failed:', error);
      
      let errorMessage = 'Execution failed: ';
      
      if (error instanceof Error) {
        if (error.message.includes('Unknown node type:')) {
          const nodeType = error.message.split('Unknown node type: ')[1];
          errorMessage = `Custom node type "${nodeType}" is not registered. This usually means:\n\n• The custom node was not found in the custom node manager\n• The custom node definition is missing execution code\n• There was an error during custom node registration\n\nCheck the console logs for more details.`;
        } else {
          errorMessage += error.message;
        }
      } else {
        errorMessage += 'Unknown error';
      }
      
      const errorMessage_obj: ChatMessage = {
        id: Date.now() + '_error',
        type: 'assistant',
        content: `❌ **Execution Failed**\n\n${errorMessage}`,
        timestamp: new Date().toISOString()
      };
      
      setMessages([errorMessage_obj]);
    } finally {
      setIsLoading(false);
    }
  };

  const clearInputs = () => {
    setInputValues(prev => prev.map(input => ({ ...input, value: '' })));
  };

  const hasAllInputs = inputValues.length === 0 || inputValues.every(input => input.value !== '' && input.value !== null);

  if (agentLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-blue-50 dark:from-[#1a1625] dark:to-[#2d1b3d]">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-500 dark:border-purple-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-700 dark:text-purple-200">Loading agent...</p>
        </div>
      </div>
    );
  }

  if (!agentFlow) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-blue-50 dark:from-[#1a1625] dark:to-[#2d1b3d]">
        <div className="text-center">
          <p className="text-gray-700 dark:text-purple-200">Agent not found</p>
          <button
            onClick={onClose}
            className="mt-4 px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 dark:from-purple-500 dark:to-pink-500 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 dark:hover:from-purple-600 dark:hover:to-pink-600 transition-all duration-200 shadow-lg"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-gradient-to-br from-gray-50 to-blue-50 dark:from-[#1a1625] dark:to-[#2d1b3d]">
      <div className="bg-gradient-to-r from-white/80 to-blue-50/80 dark:from-[#2d1b3d]/80 dark:to-[#1a1625]/80 backdrop-blur-sm border-b border-gray-200 dark:border-purple-500/20 p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-blue-600 dark:from-purple-500 dark:to-pink-500 rounded-full flex items-center justify-center shadow-lg shadow-blue-500/25 dark:shadow-purple-500/25">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-purple-100">
              {agentFlow.name}
            </h2>
            <p className="text-sm text-gray-600 dark:text-purple-300">
              {agentFlow.description || 'AI Agent Ready to Execute'}
            </p>
          </div>
          <div className="flex items-center gap-2">

            <div className="relative">
              <span 
                className="text-xs px-3 py-1 bg-gradient-to-r from-emerald-100/80 to-green-100/80 dark:from-emerald-400/20 dark:to-green-400/20 text-emerald-700 dark:text-emerald-300 rounded-full border border-emerald-300 dark:border-emerald-400/30 cursor-help"
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
              >
                <small>Powered by</small> ClaraFlow SDK
              </span>
              {showTooltip && (
                <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 px-3 py-2 bg-white/95 dark:bg-purple-900/95 backdrop-blur-sm text-gray-800 dark:text-purple-100 text-xs rounded-lg border border-gray-300 dark:border-purple-500/30 whitespace-nowrap z-50 shadow-lg">
                  Using Clara SDK, you can integrate this in your own apps and projects
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-b-4 border-transparent border-b-white/95 dark:border-b-purple-900/95"></div>
                </div>
              )}
            </div>
            <button
              onClick={() => setShowLogs(!showLogs)}
              className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-all duration-200 ${
                showLogs
                  ? 'bg-gradient-to-r from-blue-100 to-blue-200 dark:from-purple-500/30 dark:to-pink-500/30 text-blue-700 dark:text-purple-200 border border-blue-300 dark:border-purple-400/40'
                  : 'bg-gray-100 dark:bg-purple-800/30 text-gray-700 dark:text-purple-300 hover:bg-gray-200 dark:hover:bg-purple-700/40 border border-gray-300 dark:border-purple-600/30'
              }`}
            >
              <Terminal className="w-4 h-4" />
              {showLogs ? 'Hide Logs' : 'Show Logs'}
              {executionLogs.length > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${
                  showLogs ? 'bg-blue-500 dark:bg-purple-400 text-white dark:text-purple-50' : 'bg-blue-500 dark:bg-pink-500 text-white'
                }`}>
                  {executionLogs.length}
                </span>
              )}
            </button>
            <button onClick={onClose} className="p-2 text-gray-600 dark:text-purple-400 hover:text-gray-800 dark:hover:text-purple-200 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Execution Logs Panel */}
        {showLogs && (
          <div className="mt-3 p-3 bg-gray-50/90 dark:bg-purple-900/20 backdrop-blur-sm rounded-lg border border-gray-200 dark:border-purple-500/30">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-gray-800 dark:text-purple-100">Clara Flow SDK Logs</h4>
              <span className="text-xs text-gray-600 dark:text-purple-300">{executionLogs.length} entries</span>
            </div>
            {executionLogs.length === 0 ? (
              <p className="text-sm text-gray-600 dark:text-purple-300 italic">No logs yet. Run your agent to see execution details.</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {executionLogs.map((log) => (
                  <div key={log.id} className={`p-2 rounded text-xs font-mono ${
                    log.level === 'error' 
                      ? 'bg-red-500/20 text-red-300 border border-red-400/30'
                      : log.level === 'warning'
                      ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-400/30'
                      : log.level === 'success'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30'
                      : 'bg-purple-500/20 text-purple-200 border border-purple-400/30'
                  }`}>
                    <div className="flex items-start gap-2">
                      <span className="text-purple-400 flex-shrink-0">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                      <span className="flex-1">{log.message}</span>
                    </div>
                    {log.data && (
                      <details className="mt-1">
                        <summary className="cursor-pointer text-purple-300 hover:text-purple-100">
                          Details
                        </summary>
                        <pre className="mt-1 text-xs bg-purple-800/30 p-2 rounded overflow-x-auto">
                          {JSON.stringify(log.data, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Input Panel */}
        <div className="w-[30%] bg-gradient-to-b from-gray-50/80 to-gray-100/80 dark:from-purple-900/20 dark:to-purple-800/30 border-r border-gray-200 dark:border-purple-500/20 flex flex-col">
          <div className="p-4 border-b border-gray-200 dark:border-purple-500/20">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-purple-100 mb-2">Agent Inputs</h3>
            <p className="text-sm text-gray-600 dark:text-purple-300">
              Configure the inputs for your agent execution
            </p>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {inputValues.length === 0 ? (
              <div className="text-center py-8">
                <Calculator className="w-12 h-12 text-gray-400 dark:text-purple-400 mx-auto mb-3" />
                <p className="text-gray-700 dark:text-purple-200">No inputs required</p>
                <p className="text-xs text-gray-500 dark:text-purple-300 mt-1">
                  This agent runs without input parameters
                </p>
              </div>
            ) : (
              inputValues.map((input) => (
                <div key={input.nodeId} className="space-y-2">
                  <label className="block text-sm font-medium text-gray-800 dark:text-purple-200">
                    {input.nodeName}
                  </label>
                  
                  {input.type === 'file' ? (
                    <div className="space-y-2">
                      <input
                        type="file"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            handleInputChange(input.nodeId, file);
                          }
                        }}
                        className="block w-full text-sm text-gray-700 dark:text-purple-300
                          file:mr-4 file:py-2 file:px-4
                          file:rounded-lg file:border-0
                          file:text-sm file:font-medium
                          file:bg-gradient-to-r file:from-blue-500 file:to-blue-600 dark:file:from-purple-500 dark:file:to-pink-500
                          file:text-white
                          hover:file:from-blue-600 hover:file:to-blue-700 dark:hover:file:from-purple-600 dark:hover:file:to-pink-600
                          file:cursor-pointer file:transition-all file:duration-200
                          file:shadow-lg file:shadow-blue-500/25 dark:file:shadow-purple-500/25"
                        accept={
                          input.nodeName.toLowerCase().includes('image') ? 'image/*' :
                          input.nodeName.toLowerCase().includes('pdf') ? '.pdf' :
                          '*/*'
                        }
                      />
                      {input.value && input.value instanceof File && (
                        <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-purple-300">
                          {input.value.type.startsWith('image/') ? (
                            <Image className="w-4 h-4" />
                          ) : input.value.type === 'application/pdf' ? (
                            <FileText className="w-4 h-4" />
                          ) : (
                            <Upload className="w-4 h-4" />
                          )}
                          <span>{input.value.name}</span>
                          <span>({(input.value.size / 1024).toFixed(1)} KB)</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <input
                      type={input.type === 'number' ? 'number' : 'text'}
                      value={input.value as string || ''}
                      onChange={(e) => handleInputChange(input.nodeId, e.target.value)}
                      placeholder={`Enter ${input.nodeName.toLowerCase()}...`}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-purple-500/30 rounded-lg 
                        focus:ring-2 focus:ring-blue-400 dark:focus:ring-purple-400 focus:border-blue-400 dark:focus:border-purple-400 
                        bg-white dark:bg-purple-800/20 text-gray-800 dark:text-purple-100
                        placeholder-gray-500 dark:placeholder-purple-400 transition-all duration-200"
                    />
                  )}
                </div>
              ))
            )}
          </div>

          <div className="p-4 border-t border-gray-200 dark:border-purple-500/20 space-y-3">
            <button
              onClick={handleRunAgent}
              disabled={!hasAllInputs || isLoading}
              className={`w-full py-3 px-4 rounded-lg font-medium transition-all duration-200 ${
                hasAllInputs && !isLoading
                  ? 'bg-gradient-to-r from-blue-500 to-blue-600 dark:from-purple-500 dark:to-pink-500 hover:from-blue-600 hover:to-blue-700 dark:hover:from-purple-600 dark:hover:to-pink-600 text-white shadow-lg shadow-blue-500/25 dark:shadow-purple-500/25'
                  : 'bg-gray-200 dark:bg-purple-800/30 text-gray-500 dark:text-purple-400 cursor-not-allowed border border-gray-300 dark:border-purple-600/30'
              }`}
            >
              {isLoading ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-purple-300 border-t-purple-500 rounded-full animate-spin"></div>
                  Executing with Clara Flow SDK...
                </div>
              ) : (
                `🚀 Run Agent (${inputValues.filter(iv => iv.value).length}/${inputValues.length} inputs)`
              )}
            </button>

            {inputValues.length > 0 && (
              <button
                onClick={clearInputs}
                disabled={isLoading}
                className="w-full py-2 px-4 rounded-lg border border-gray-300 dark:border-purple-500/30 text-gray-700 dark:text-purple-200 hover:bg-gray-100 dark:hover:bg-purple-700/30 transition-all duration-200 disabled:opacity-50"
              >
                Clear All Inputs
              </button>
            )}
          </div>
        </div>

        {/* Results Panel */}
        <div className="flex-1 bg-gradient-to-b from-gray-50/50 to-gray-100/50 dark:from-purple-900/10 dark:to-purple-800/20 flex flex-col">
          <div className="p-5">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-purple-100">Agent Results</h3>
            <p className="text-sm text-gray-600 dark:text-purple-300">
              View the output from your agent execution using Clara Flow SDK
            </p>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {messages.length === 0 ? (
              <div className="h-full flex items-center justify-center">
                <div className="text-center">
                  <Bot className="w-16 h-16 text-gray-400 dark:text-purple-400 mx-auto mb-4" />
                  <h4 className="text-lg font-medium text-gray-700 dark:text-purple-200 mb-2">
                    Ready to Execute
                  </h4>
                  <p className="text-gray-600 dark:text-purple-300">
                    Configure your inputs and click "Run Agent" to see results here
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex gap-3 ${
                      message.type === 'user' ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    {message.type === 'assistant' && (
                      <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-blue-600 dark:from-purple-500 dark:to-pink-500 rounded-full flex items-center justify-center flex-shrink-0 shadow-lg shadow-blue-500/25 dark:shadow-purple-500/25">
                        <Bot className="w-4 h-4 text-white" />
                      </div>
                    )}
                    
                    <div
                      className={`max-w-[85%] p-4 rounded-lg ${
                        message.type === 'user'
                          ? 'bg-gradient-to-r from-blue-500 to-blue-600 dark:from-purple-500 dark:to-pink-500 text-white shadow-lg shadow-blue-500/25 dark:shadow-purple-500/25'
                          : 'bg-white/90 dark:bg-purple-800/30 border border-gray-200 dark:border-purple-500/30 shadow-sm'
                      }`}
                    >
                      {message.type === 'user' ? (
                        <p className="text-white">{message.content}</p>
                      ) : (
                        formatMessage(message.content)
                      )}
                      
                      <div className={`mt-2 text-xs opacity-70 ${
                        message.type === 'user' ? 'text-white' : 'text-gray-500 dark:text-purple-300'
                      }`}>
                        {new Date(message.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                    
                    {message.type === 'user' && (
                      <div className="w-8 h-8 bg-purple-600/50 rounded-full flex items-center justify-center flex-shrink-0 border border-purple-400/30">
                        <span className="text-sm font-medium text-purple-200">U</span>
                      </div>
                    )}
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AgentRunnerSDK; 