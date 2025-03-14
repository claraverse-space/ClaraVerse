// src/components/appcreator_components/nodes/NodeRegistry.tsx
import React from 'react';

export interface NodeMetadata {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  lightColor: string;
  darkColor: string;
  category: 'input' | 'process' | 'output' | 'function';
  inputs?: string[];
  outputs?: string[];
}

export interface NodeTypeDefinition {
  type: string;
  component: React.ComponentType<any>;
  metadata?: NodeMetadata;
}

// Use Vite's dynamic import to eagerly import all files matching *Node.tsx
const modules = import.meta.glob('./*Node.tsx', { eager: true }) as Record<
  string,
  { default: React.ComponentType<any>; metadata?: NodeMetadata }
>;

// Registry for node types
const NODE_TYPES: Record<string, NodeTypeDefinition> = {};
// Array to collect metadata from each node (tool items)
const TOOL_ITEMS: NodeMetadata[] = [];

// Loop through each module entry and register nodes with metadata
Object.entries(modules).forEach(([path, module]) => {
  // Skip this file and any BaseNode if it's not a concrete node
  if (path.includes('NodeRegistry') || path.includes('BaseNode')) return;

  // Get the file name (e.g., "ImageTextLlmNode.tsx")
  const fileName = path.split('/').pop();
  if (!fileName) return;

  // Remove the extension to get the component name (e.g., "ImageTextLlmNode")
  const componentName = fileName.replace('.tsx', '');
  // Generate a key by lowercasing the first letter (e.g., "ImageTextLlmNode" → "imageTextLlmNode")
  const key = componentName.charAt(0).toLowerCase() + componentName.slice(1);

  // Prefer the metadata from the named export (make sure each node file exports 'metadata')
  const meta = module.metadata;
  NODE_TYPES[key] = {
    type: key,
    component: module.default,
    metadata: meta,
  };

  if (meta) {
    TOOL_ITEMS.push(meta);
  }
});

console.log("Registered node types:", Object.keys(NODE_TYPES));

export const getNodeType = (type: string) => NODE_TYPES[type];

export const getAllNodeTypes = () => {
  const all: Record<string, React.ComponentType<any>> = {};
  Object.entries(NODE_TYPES).forEach(([key, value]) => {
    all[key] = value.component;
  });
  return all;
};

export const registerNodeType = (
  type: string,
  component: React.ComponentType<any>,
  metadata?: NodeMetadata
) => {
  NODE_TYPES[type] = { type, component, metadata };
  if (metadata) {
    TOOL_ITEMS.push(metadata);
  }
};

export const getToolItems = (): NodeMetadata[] => TOOL_ITEMS;
