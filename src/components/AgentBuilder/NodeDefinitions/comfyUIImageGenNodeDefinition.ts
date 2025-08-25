import { NodeDefinition } from '../../../types/agent/types';

export const comfyUIImageGenNodeDefinition: NodeDefinition = {
  id: 'comfyui-image-gen',
  name: 'ComfyUI Image Generator',
  type: 'comfyui-image-gen',
  description: 'Generate images using ComfyUI with customizable parameters',
  category: 'ai',
  icon: 'Image',
  version: '1.0.0',
  author: 'ClaraVerse',
  
  inputs: [
    {
      id: 'prompt',
      name: 'Prompt',
      type: 'input',
      dataType: 'string',
      required: true,
      description: 'Text prompt describing the image to generate'
    }
  ],
  
  outputs: [
    {
      id: 'image',
      name: 'Generated Image',
      type: 'output',
      dataType: 'string',
      description: 'Base64 encoded generated image'
    },
    {
      id: 'metadata',
      name: 'Generation Metadata',
      type: 'output',
      dataType: 'object',
      description: 'Metadata about the generation process'
    }
  ],
  
  properties: [
    {
      id: 'selectedModel',
      name: 'Model',
      type: 'select',
      required: true,
      description: 'ComfyUI model to use for generation',
      options: []
    },
    {
      id: 'steps',
      name: 'Steps',
      type: 'number',
      defaultValue: 20,
      description: 'Number of denoising steps',
      validation: { min: 1, max: 100 }
    },
    {
      id: 'guidanceScale',
      name: 'Guidance Scale',
      type: 'number',
      defaultValue: 7.5,
      description: 'How closely to follow the prompt',
      validation: { min: 1, max: 20 }
    },
    {
      id: 'width',
      name: 'Width',
      type: 'number',
      defaultValue: 512,
      description: 'Image width in pixels',
      validation: { min: 64, max: 2048 }
    },
    {
      id: 'height',
      name: 'Height',
      type: 'number',
      defaultValue: 512,
      description: 'Image height in pixels',
      validation: { min: 64, max: 2048 }
    }
  ],
  
  executionHandler: 'comfyui-image-gen-node-handler',
  
  metadata: {
    tags: ['ai', 'image', 'generation', 'comfyui', 'art', 'creative'],
    documentation: 'Generate high-quality images using ComfyUI with full control over generation parameters.',
    examples: [
      {
        title: 'Basic Image Generation',
        description: 'Generate a simple image with default settings',
        config: {
          prompt: 'A beautiful sunset over mountains, oil painting style',
          steps: 20,
          guidanceScale: 7.5
        }
      }
    ]
  }
};

export default comfyUIImageGenNodeDefinition;
