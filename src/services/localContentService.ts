// Service to detect and manage local user content for Community sharing
import { db } from '../db';
import { indexedDBService } from '../services/indexedDB';

// Extend db with fallback methods if not available
if (!(db as any).getStorageItems) {
  (db as any).getStorageItems = async () => {
    try {
      return await indexedDBService.getAll('storage');
    } catch (error) {
      console.error('IndexedDB retrieval failed, falling back to localStorage', error);
      const data = localStorage.getItem('clara_db_storage');
      return data ? JSON.parse(data) : [];
    }
  };
}

export interface LocalContent {
  id: string;
  title: string;
  description: string;
  category: 'custom-node' | 'image' | 'tool'; // TODO: Add back 'prompt' | 'wallpaper' | 'workflow' | 'template' | 'mcp-server' | 'tutorial' when ready
  content?: string;
  metadata?: any;
  lastModified: string;
  isShared: boolean;
  thumbnailUrl?: string;
}

export interface CustomNode {
  type: string;
  title: string;
  description: string;
  category: string;
  inputs: any[];
  outputs: any[];
  properties: any[];
  implementation?: string; // Legacy field
  executionCode?: string; // New field
  version: string;
  author: string;
  createdAt: string;
  updatedAt: string;
}

class LocalContentDetectionService {
  constructor() {
    // No initialization needed - using db service directly
  }

  /**
   * Get all local content that can be shared to the community
   */
  async getAllLocalContent(): Promise<LocalContent[]> {
    const content: LocalContent[] = [];

    try {
      // 1. Get Custom Nodes
      const customNodes = await this.getCustomNodes();
      content.push(...customNodes);

      // 2. Get Tools
      const tools = await this.getTools();
      content.push(...tools);

      // 3. Get Generated Images
      const images = await this.getGeneratedImages();
      content.push(...images);

      // Sort by last modified (newest first)
      content.sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime());

      return content;
    } catch (error) {
      console.error('Error getting local content:', error);
      return [];
    }
  }

  /**
   * Get custom nodes from localStorage
   */
  private async getCustomNodes(): Promise<LocalContent[]> {
    try {
      const stored = localStorage.getItem('custom_nodes');
      if (!stored) return [];

      const nodes: any[] = JSON.parse(stored);
      console.log('Custom nodes from localStorage:', nodes);
      
      const customNodeContent = await Promise.all(nodes.map(async (node) => {
        const id = `custom-node-${node.type}`;
        
        // Handle both CustomNodeDefinition format (new) and CustomNode format (legacy)
        let content = '';
        if (node.executionCode) {
          // New format: CustomNodeDefinition
          content = JSON.stringify({
            ...node,
            // Ensure all required fields are present
            implementation: node.executionCode // Add legacy field for compatibility
          }, null, 2);
        } else if (node.implementation) {
          // Legacy format: CustomNode
          content = node.implementation;
        }
        
        console.log(`Processing custom node ${node.name || node.title}:`, { content: content.substring(0, 100) + '...', node });
        
        return {
          id,
          title: node.name || node.title || node.type || 'Untitled Custom Node',
          description: node.description || 'Custom node for agent builder',
          category: 'custom-node' as const,
          content: content,
          metadata: {
            type: node.type,
            category: node.category,
            inputs: node.inputs || [],
            outputs: node.outputs || [],
            properties: node.properties || [],
            version: node.version || '1.0.0',
            author: node.author || node.customMetadata?.createdBy || 'Unknown'
          },
          lastModified: this.getValidDate(node.customMetadata?.createdAt || node.updatedAt || node.createdAt),
          isShared: await this.isShared(id)
        };
      }));
      
      return customNodeContent;
    } catch (error) {
      console.error('Error getting custom nodes:', error);
      return [];
    }
  }

  /**
   * Get tools from database
   */
  private async getTools(): Promise<LocalContent[]> {
    try {
      const tools = await db.getAllTools();
      console.log('Tools from database:', tools);
      
      const toolContent = await Promise.all(tools.map(async (tool) => {
        const id = `tool-${tool.id}`;
        
        // Convert tool to shareable content
        const content = JSON.stringify({
          id: tool.id,
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
          implementation: tool.implementation,
          isEnabled: tool.isEnabled
        }, null, 2);
        
        console.log(`Processing tool ${tool.name}:`, { content: content.substring(0, 100) + '...', tool });
        
        return {
          id,
          title: tool.name || 'Untitled Tool',
          description: tool.description || 'Custom tool for Clara',
          category: 'tool' as const,
          content: content,
          metadata: {
            parameters: tool.parameters,
            isEnabled: tool.isEnabled,
            parameterCount: tool.parameters?.length || 0,
            type: 'custom-tool'
          },
          lastModified: new Date().toISOString(), // Tools don't have timestamps, use current time
          isShared: await this.isShared(id)
        };
      }));
      
      return toolContent;
    } catch (error) {
      console.error('Error getting tools:', error);
      return [];
    }
  }

  /**
   * Get saved prompts from various sources
   * TODO: Uncomment when prompt sharing is ready
   */
  /* 
  private async getSavedPrompts(): Promise<LocalContent[]> {
    const prompts: LocalContent[] = [];

    try {
      // System prompts
      const systemPrompt = await this.db.getSystemPrompt();
      if (systemPrompt && systemPrompt !== this.getDefaultSystemPrompt()) {
        prompts.push({
          id: 'system-prompt',
          title: 'Custom System Prompt',
          description: 'Your personalized AI assistant system prompt',
          category: 'prompt',
          content: systemPrompt,
          lastModified: this.getValidDate(),
          isShared: false
        });
      }

      // LumaUI Lite system prompt
      const lumaPrompt = localStorage.getItem('lumaui-lite-system-prompt');
      if (lumaPrompt && lumaPrompt.trim()) {
        prompts.push({
          id: 'lumaui-lite-prompt',
          title: 'LumaUI Lite System Prompt',
          description: 'Custom system prompt for LumaUI Lite interface',
          category: 'prompt',
          content: lumaPrompt,
          lastModified: this.getValidDate(),
          isShared: false
        });
      }

      // Image generation prompts (from recent history)
      const imageGenHistory = this.getImageGenerationHistory();
      imageGenHistory.forEach((prompt, index) => {
        if (prompt.trim()) {
          prompts.push({
            id: `image-prompt-${index}`,
            title: `Image Generation Prompt ${index + 1}`,
            description: prompt.substring(0, 100) + (prompt.length > 100 ? '...' : ''),
            category: 'prompt',
            content: prompt,
            metadata: { type: 'image-generation' },
            lastModified: this.getValidDate(),
            isShared: false
          });
        }
      });

    } catch (error) {
      console.error('Error getting saved prompts:', error);
    }

    return prompts;
  }
  */

  /**
   * Get wallpapers from storage
   * TODO: Uncomment when wallpaper sharing is ready
   */
  /* 
  private async getWallpapers(): Promise<LocalContent[]> {
    try {
      const wallpaper = await this.db.getWallpaper();
      if (!wallpaper) return [];

      return [{
        id: 'current-wallpaper',
        title: 'Current Wallpaper',
        description: 'Your current ClaraVerse wallpaper',
        category: 'wallpaper',
        content: wallpaper,
        thumbnailUrl: wallpaper,
        lastModified: new Date().toISOString(),
        isShared: false
      }];
    } catch (error) {
      console.error('Error getting wallpapers:', error);
      return [];
    }
  }
  */

  /**
   * Get generated images from recent sessions
   */
  private async getGeneratedImages(): Promise<LocalContent[]> {
    const images: LocalContent[] = [];

    try {
      // Use the same approach as Gallery.tsx - get items from db storage
      const storedItems = await (db as any).getStorageItems();
      const imageItems = storedItems.filter((item: any) => item.type === 'image');
      
      // Process each image item asynchronously to check shared status
      const processedImages = await Promise.all(imageItems.map(async (item: any, idx: number) => {
        let finalPrompt = item.description ?? '';
        if (finalPrompt.startsWith('Prompt:')) {
          finalPrompt = finalPrompt.replace(/^Prompt:\s*/, '');
        }
        
        // Ensure thumbnailUrl is valid - should be base64 data URL
        let thumbnailUrl = item.data;
        if (thumbnailUrl && !thumbnailUrl.startsWith('data:')) {
          // If it's not a data URL, assume it's base64 and add prefix
          thumbnailUrl = `data:image/png;base64,${thumbnailUrl}`;
        }
        
        const id = item.id ?? `img-${idx}`;
        
        console.log('Processing image item:', {
          id,
          hasData: !!item.data,
          dataLength: item.data?.length,
          thumbnailUrl: thumbnailUrl?.substring(0, 50) + '...'
        });
        
        return {
          id,
          title: item.title || `Generated Image ${idx + 1}`,
          description: finalPrompt || 'AI generated image',
          category: 'image' as const,
          content: item.data,
          metadata: {
            prompt: finalPrompt,
            model: item.model || 'SD-Model',
            resolution: item.resolution || '1024x1024',
            timestamp: item.timestamp
          },
          thumbnailUrl: thumbnailUrl,
          lastModified: this.getValidDate(item.timestamp),
          isShared: await this.isShared(id)
        };
      }));
      
      images.push(...processedImages);

      // Also check ImageGen gallery in localStorage as fallback
      const galleryImages = localStorage.getItem('imageGenGallery');
      if (galleryImages) {
        try {
          const gallery = JSON.parse(galleryImages);
          if (Array.isArray(gallery)) {
            gallery.forEach((image: any, index: number) => {
              if (image.imageData || image.url || image.base64) {
                // Check if we already have this image to avoid duplicates
                const existingImage = images.find(img => 
                  img.content === (image.imageData || image.url || image.base64)
                );
                
                if (!existingImage) {
                  // Ensure thumbnailUrl is valid - should be base64 data URL
                  let thumbnailUrl = image.imageData || image.url || image.base64;
                  if (thumbnailUrl && !thumbnailUrl.startsWith('data:')) {
                    // If it's not a data URL, assume it's base64 and add prefix
                    thumbnailUrl = `data:image/png;base64,${thumbnailUrl}`;
                  }
                  
                  images.push({
                    id: `gallery-image-${index}`,
                    title: image.filename || image.title || `Generated Image ${index + 1}`,
                    description: image.prompt || 'AI generated image from ImageGen',
                    category: 'image',
                    content: image.imageData || image.url || image.base64,
                    metadata: {
                      prompt: image.prompt,
                      model: image.model,
                      settings: image.settings,
                      dimensions: image.dimensions
                    },
                    thumbnailUrl: thumbnailUrl,
                    lastModified: this.getValidDate(image.timestamp || image.createdAt),
                    isShared: false
                  });
                }
              }
            });
          }
        } catch (e) {
          console.error('Error parsing gallery images:', e);
        }
      }
      const storageKeys = [
        'comfyui_generated_images',
        'image_generation_history', 
        'generated_images_cache',
        'clara_generated_images'
      ];

      for (const key of storageKeys) {
        const stored = localStorage.getItem(key);
        if (stored) {
          try {
            const data = JSON.parse(stored);
            if (Array.isArray(data)) {
              data.forEach((item, index) => {
                if (item.image || item.base64 || item.url || item.imageData) {
                  images.push({
                    id: `generated-image-${key}-${index}`,
                    title: item.title || item.filename || `Generated Image ${index + 1}`,
                    description: item.prompt || item.description || 'AI generated image',
                    category: 'image',
                    content: item.image || item.base64 || item.url || item.imageData,
                    metadata: {
                      prompt: item.prompt,
                      model: item.model,
                      settings: item.settings
                    },
                    thumbnailUrl: item.image || item.base64 || item.url || item.imageData,
                    lastModified: this.getValidDate(item.createdAt || item.timestamp),
                    isShared: false
                  });
                }
              });
            }
          } catch (e) {
            // Skip invalid JSON
          }
        }
      }
    } catch (error) {
      console.error('Error getting generated images:', error);
    }

    return images;
  }

  /**
   * Get saved workflows
   * TODO: Uncomment when workflow sharing is ready
   */
  /* 
  private async getWorkflows(): Promise<LocalContent[]> {
    try {
      // Check for workflows in localStorage
      const workflowKeys = [
        'agent_workflows',
        'saved_workflows',
        'user_workflows'
      ];

      const workflows: LocalContent[] = [];

      for (const key of workflowKeys) {
        const stored = localStorage.getItem(key);
        if (stored) {
          try {
            const data = JSON.parse(stored);
            if (Array.isArray(data)) {
              data.forEach((workflow: any, index: number) => {
                workflows.push({
                  id: `workflow-${key}-${index}`,
                  title: workflow.name || workflow.title || `Workflow ${index + 1}`,
                  description: workflow.description || 'Custom agent workflow',
                  category: 'workflow' as const,
                  content: JSON.stringify(workflow, null, 2),
                  metadata: {
                    nodeCount: workflow.nodes?.length || 0,
                    tags: workflow.tags || []
                  },
                  lastModified: this.getValidDate(workflow.updatedAt || workflow.createdAt),
                  isShared: false
                });
              });
            } else if (typeof data === 'object' && data !== null) {
              // Single workflow object
              workflows.push({
                id: `workflow-${key}`,
                title: data.name || data.title || 'Saved Workflow',
                description: data.description || 'Custom agent workflow',
                category: 'workflow' as const,
                content: JSON.stringify(data, null, 2),
                metadata: {
                  nodeCount: data.nodes?.length || 0,
                  tags: data.tags || []
                },
                lastModified: this.getValidDate(data.updatedAt || data.createdAt),
                isShared: false
              });
            }
          } catch (e) {
            // Skip invalid JSON
          }
        }
      }

      return workflows;
    } catch (error) {
      console.error('Error getting workflows:', error);
      return [];
    }
  }
  */

  /**
   * Get recent image generation prompts from localStorage
   * TODO: Uncomment when prompt sharing is ready
   */
  /*
  private getImageGenerationHistory(): string[] {
    try {
      const history = localStorage.getItem('image_prompt_history');
      if (history) {
        const parsed = JSON.parse(history);
        return Array.isArray(parsed) ? parsed.slice(0, 10) : [];
      }
    } catch (error) {
      console.error('Error getting image prompt history:', error);
    }
    return [];
  }
  */

  /**
   * Get default system prompt for comparison
   * TODO: Uncomment when prompt sharing is ready
   */
  /*
  private getDefaultSystemPrompt(): string {
    return 'You are Clara, a helpful AI assistant.';
  }
  */

  /**
   * Get a valid date string, fallback to current date if invalid
   */
  private getValidDate(dateString?: string): string {
    if (!dateString) return new Date().toISOString();
    
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return new Date().toISOString();
    }
    
    return date.toISOString();
  }

  /**
   * Mark content as shared
   */
  async markAsShared(contentId: string, communityResourceId?: string): Promise<void> {
    try {
      const sharedContentKey = 'clara_community_shared_content';
      const sharedContent = JSON.parse(localStorage.getItem(sharedContentKey) || '{}');
      sharedContent[contentId] = {
        resourceId: communityResourceId || '',
        sharedAt: new Date().toISOString()
      };
      localStorage.setItem(sharedContentKey, JSON.stringify(sharedContent));
    } catch (error) {
      console.error('Error marking content as shared:', error);
    }
  }

  /**
   * Check if content is already shared
   */
  async isShared(contentId: string): Promise<boolean> {
    try {
      const sharedContentKey = 'clara_community_shared_content';
      const sharedContent = JSON.parse(localStorage.getItem(sharedContentKey) || '{}');
      return contentId in sharedContent;
    } catch (error) {
      console.error('Error checking if content is shared:', error);
      return false;
    }
  }

  /**
   * Remove content from shared list (unshare)
   */
  async unmarkAsShared(contentId: string): Promise<void> {
    try {
      const sharedContentKey = 'clara_community_shared_content';
      const sharedContent = JSON.parse(localStorage.getItem(sharedContentKey) || '{}');
      delete sharedContent[contentId];
      localStorage.setItem(sharedContentKey, JSON.stringify(sharedContent));
    } catch (error) {
      console.error('Error unmarking content as shared:', error);
    }
  }

  /**
   * Get the community resource ID for a local content item
   */
  async getCommunityResourceId(contentId: string): Promise<string | null> {
    try {
      const sharedContentKey = 'clara_community_shared_content';
      const sharedContent = JSON.parse(localStorage.getItem(sharedContentKey) || '{}');
      return sharedContent[contentId]?.resourceId || null;
    } catch (error) {
      console.error('Error getting community resource ID:', error);
      return null;
    }
  }

  /**
   * Get content by ID for sharing
   */
  async getContentById(contentId: string): Promise<LocalContent | null> {
    const allContent = await this.getAllLocalContent();
    return allContent.find(item => item.id === contentId) || null;
  }
}

export const localContentService = new LocalContentDetectionService();
