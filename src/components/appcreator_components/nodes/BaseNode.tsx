import React from 'react';
import { registerNodeType } from './NodeRegistry';

export interface BaseNodeProps {
  type: string;
  component: React.ComponentType<any>;
  metadata: {
    name: string;
    description: string;
    category: 'input' | 'process' | 'output' | 'function';
    icon: React.ElementType;
    inputs?: string[];
    outputs?: string[];
    color: string;
    // ...other metadata
  };
}

// A decorator that automatically registers the node
export function RegisterNode(options: BaseNodeProps) {
  return function(Component: React.ComponentType<any>) {
    // Register the node with the registry
    registerNodeType(options.type, Component);
    
    // Attach metadata to the component for discovery
    (Component as any).nodeMetadata = options.metadata;
    
    // Return the component
    return Component;
  };
}
