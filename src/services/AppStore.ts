import { indexedDBService } from './indexedDB';
import { v4 as uuidv4 } from 'uuid';

// Define types
export interface AppData {
  id: string;
  name: string;
  description: string;
  icon?: string;
  color?: string;
  nodes: any[];
  edges: any[];
  createdAt: string;
  updatedAt: string;
  version: string;
}

class AppStore {
  private readonly STORE_NAME = 'apps';
  private readonly APP_VERSION = '1.0.0';

  constructor() {
    // Initialize the store if needed
    this.initializeStore();
  }
  
  private async initializeStore(): Promise<void> {
    try {
      // Just try to access the store to ensure it's initialized
      await indexedDBService.getAll(this.STORE_NAME);
    } catch (error) {
      console.error('Error initializing app store:', error);
    }
  }

  /**
   * Create a new app with basic information
   */
  async createApp(name: string, description: string): Promise<string> {
    const id = uuidv4();
    const now = new Date().toISOString();
    
    const newApp: AppData = {
      id,
      name,
      description,
      icon: 'Activity', // Default icon
      color: '#3B82F6', // Default color
      nodes: [],
      edges: [],
      createdAt: now,
      updatedAt: now,
      version: this.APP_VERSION
    };
    
    await indexedDBService.put(this.STORE_NAME, newApp);
    console.log(`Created new app with ID: ${id}`);
    return id;
  }

  /**
   * Update an existing app with new data
   */
  async updateApp(id: string, data: Partial<AppData>): Promise<void> {
    const existingApp = await indexedDBService.get<AppData>(this.STORE_NAME, id);
    
    if (!existingApp) {
      throw new Error(`App with ID ${id} not found`);
    }
    
    // Ensure that all node configurations are properly saved
    // This is critical for LLM prompts and other node settings
    const updatedApp: AppData = {
      ...existingApp,
      ...data,
      updatedAt: new Date().toISOString(),
      // Ensure nested data is properly stored by creating deep copies
      nodes: data.nodes ? this.deepCopyNodes(data.nodes) : existingApp.nodes,
      edges: data.edges ? [...data.edges] : existingApp.edges
    };
    
    await indexedDBService.put(this.STORE_NAME, updatedApp);
    console.log(`Updated app ${id} successfully`);
  }

  /**
   * Create a deep copy of nodes to ensure all configurations are saved
   * This is especially important for LLM prompts and other complex settings
   */
  private deepCopyNodes(nodes: any[]): any[] {
    return nodes.map(node => {
      try {
        // Create a sanitized version of the node data
        const sanitizedNode = {
          ...node,
          data: {
            ...node.data,
            // Save only the tool properties we need, not the actual component references
            tool: node.data.tool ? {
              id: node.data.tool.id,
              name: node.data.tool.name,
              description: node.data.tool.description,
              color: node.data.tool.color,
              bgColor: node.data.tool.bgColor,
              lightColor: node.data.tool.lightColor,
              darkColor: node.data.tool.darkColor,
              category: node.data.tool.category,
              inputs: node.data.tool.inputs,
              outputs: node.data.tool.outputs,
              // The icon property is a React component and can't be stored directly
              // Store the name instead, which we can use to recreate the component later
              iconName: node.data.tool.icon?.displayName || 'Activity',
            } : undefined,
            // Make sure config is deeply copied as it contains all the node settings
            config: node.data.config ? JSON.parse(JSON.stringify(node.data.config)) : {}
          }
        };

        // Remove any other non-serializable properties
        return JSON.parse(JSON.stringify(sanitizedNode));
      } catch (error) {
        console.error('Error sanitizing node for storage:', error);
        // If there's an error, try a more aggressive approach
        // First serialize to JSON (which strips functions and non-serializable objects)
        // Then parse it back to an object
        return JSON.parse(JSON.stringify({
          id: node.id,
          type: node.type,
          position: node.position,
          data: {
            label: node.data.label,
            config: node.data.config || {}
          }
        }));
      }
    });
  }

  /**
   * Get a specific app by ID
   */
  async getApp(id: string): Promise<AppData | undefined> {
    return await indexedDBService.get<AppData>(this.STORE_NAME, id);
  }

  /**
   * List all apps
   */
  async listApps(): Promise<AppData[]> {
    const apps = await indexedDBService.getAll<AppData>(this.STORE_NAME);
    // Sort by most recently updated
    return apps.sort((a, b) => 
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }

  /**
   * Delete an app by ID
   */
  async deleteApp(id: string): Promise<void> {
    await indexedDBService.delete(this.STORE_NAME, id);
    console.log(`Deleted app ${id}`);
  }
  
  /**
   * Duplicate an existing app
   */
  async duplicateApp(id: string): Promise<string> {
    const app = await this.getApp(id);
    
    if (!app) {
      throw new Error(`App with ID ${id} not found`);
    }
    
    const newId = uuidv4();
    const now = new Date().toISOString();
    
    const duplicatedApp: AppData = {
      ...app,
      id: newId,
      name: `${app.name} (Copy)`,
      createdAt: now,
      updatedAt: now
    };
    
    await indexedDBService.put(this.STORE_NAME, duplicatedApp);
    console.log(`Duplicated app ${id} to new ID: ${newId}`);
    return newId;
  }
}

export const appStore = new AppStore();
