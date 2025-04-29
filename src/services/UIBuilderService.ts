import { v4 as uuidv4 } from 'uuid';
import { Message } from '../db';

/**
 * UIBuilderProject interface to define the structure of a UI project
 */
export interface UIBuilderProject {
  id: string;
  name: string;
  description: string;
  htmlCode: string;
  cssCode: string;
  jsCode: string;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
  isArchived?: boolean;
  isDeleted?: boolean;
  version: number;
  tags?: string[];
  category?: string;
  isPublic?: boolean;
}

/**
 * UIBuilderService class to manage UI Builder projects
 */
export class UIBuilderService {
  private static instance: UIBuilderService;
  private readonly DB_NAME = 'clara_uibuilder_db';
  private readonly DB_VERSION = 1;
  private db: IDBDatabase | null = null;
  private isInitializing = false;
  private initPromise: Promise<void> | null = null;

  private constructor() {
    // Initialize the database
    this.initDB();
  }

  /**
   * Get the singleton instance of UIBuilderService
   */
  public static getInstance(): UIBuilderService {
    if (!UIBuilderService.instance) {
      UIBuilderService.instance = new UIBuilderService();
    }
    return UIBuilderService.instance;
  }

  /**
   * Initialize the IndexedDB database
   */
  private async initDB(): Promise<void> {
    if (this.db) return;
    if (this.isInitializing && this.initPromise) {
      return this.initPromise;
    }

    this.isInitializing = true;
    this.initPromise = new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

      request.onerror = (event) => {
        console.error('Error opening UI Builder database:', event);
        this.isInitializing = false;
        reject(new Error('Could not open database'));
      };

      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        this.isInitializing = false;
        console.log('UI Builder database opened successfully');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        console.log('Creating UI Builder database stores');

        // Create projects store
        if (!db.objectStoreNames.contains('projects')) {
          const projectsStore = db.createObjectStore('projects', { keyPath: 'id' });
          projectsStore.createIndex('name_index', 'name', { unique: false });
          projectsStore.createIndex('createdAt_index', 'createdAt', { unique: false });
          projectsStore.createIndex('updatedAt_index', 'updatedAt', { unique: false });
          projectsStore.createIndex('category_index', 'category', { unique: false });
        }

        // Create project versions store
        if (!db.objectStoreNames.contains('project_versions')) {
          const versionsStore = db.createObjectStore('project_versions', { keyPath: 'id' });
          versionsStore.createIndex('projectId_index', 'projectId', { unique: false });
          versionsStore.createIndex('version_index', 'version', { unique: false });
        }

        // Create templates store
        if (!db.objectStoreNames.contains('templates')) {
          const templatesStore = db.createObjectStore('templates', { keyPath: 'id' });
          templatesStore.createIndex('name_index', 'name', { unique: false });
          templatesStore.createIndex('category_index', 'category', { unique: false });
        }
      };
    });

    return this.initPromise;
  }

  /**
   * Get a transaction for the specified store
   */
  private async getTransaction(storeName: string, mode: IDBTransactionMode = 'readonly'): Promise<IDBTransaction> {
    await this.initDB();
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    return this.db.transaction(storeName, mode);
  }

  /**
   * Get all projects
   */
  public async getAllProjects(): Promise<UIBuilderProject[]> {
    try {
      const transaction = await this.getTransaction('projects');
      const store = transaction.objectStore('projects');
      
      return new Promise<UIBuilderProject[]>((resolve, reject) => {
        const request = store.getAll();
        
        request.onsuccess = () => {
          resolve(request.result);
        };
        
        request.onerror = () => {
          reject(new Error('Failed to get projects'));
        };
      });
    } catch (error) {
      console.error('Error getting all projects:', error);
      return [];
    }
  }

  /**
   * Get project by ID
   */
  public async getProjectById(id: string): Promise<UIBuilderProject | null> {
    try {
      const transaction = await this.getTransaction('projects');
      const store = transaction.objectStore('projects');
      
      return new Promise<UIBuilderProject | null>((resolve, reject) => {
        const request = store.get(id);
        
        request.onsuccess = () => {
          resolve(request.result || null);
        };
        
        request.onerror = () => {
          reject(new Error(`Failed to get project with ID: ${id}`));
        };
      });
    } catch (error) {
      console.error(`Error getting project with ID ${id}:`, error);
      return null;
    }
  }

  /**
   * Create a new project
   */
  public async createProject(project: Omit<UIBuilderProject, 'id' | 'createdAt' | 'updatedAt' | 'version'>): Promise<UIBuilderProject> {
    try {
      const newProject: UIBuilderProject = {
        ...project,
        id: uuidv4(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1
      };
      
      const transaction = await this.getTransaction('projects', 'readwrite');
      const store = transaction.objectStore('projects');
      
      return new Promise<UIBuilderProject>((resolve, reject) => {
        const request = store.add(newProject);
        
        request.onsuccess = () => {
          resolve(newProject);
        };
        
        request.onerror = () => {
          reject(new Error('Failed to create project'));
        };
      });
    } catch (error) {
      console.error('Error creating project:', error);
      throw error;
    }
  }

  /**
   * Update an existing project
   */
  public async updateProject(project: UIBuilderProject): Promise<UIBuilderProject> {
    try {
      const updatedProject: UIBuilderProject = {
        ...project,
        updatedAt: new Date().toISOString(),
        version: project.version + 1
      };
      
      const transaction = await this.getTransaction('projects', 'readwrite');
      const store = transaction.objectStore('projects');
      
      return new Promise<UIBuilderProject>((resolve, reject) => {
        const request = store.put(updatedProject);
        
        request.onsuccess = () => {
          resolve(updatedProject);
        };
        
        request.onerror = () => {
          reject(new Error(`Failed to update project with ID: ${project.id}`));
        };
      });
    } catch (error) {
      console.error(`Error updating project with ID ${project.id}:`, error);
      throw error;
    }
  }

  /**
   * Delete a project
   */
  public async deleteProject(id: string): Promise<void> {
    try {
      const transaction = await this.getTransaction('projects', 'readwrite');
      const store = transaction.objectStore('projects');
      
      return new Promise<void>((resolve, reject) => {
        const request = store.delete(id);
        
        request.onsuccess = () => {
          resolve();
        };
        
        request.onerror = () => {
          reject(new Error(`Failed to delete project with ID: ${id}`));
        };
      });
    } catch (error) {
      console.error(`Error deleting project with ID ${id}:`, error);
      throw error;
    }
  }

  /**
   * Export a project to JSON
   */
  public exportProjectToJSON(project: UIBuilderProject): string {
    try {
      return JSON.stringify(project, null, 2);
    } catch (error) {
      console.error('Error exporting project to JSON:', error);
      throw new Error('Failed to export project to JSON');
    }
  }

  /**
   * Import a project from JSON
   */
  public async importProjectFromJSON(jsonString: string): Promise<UIBuilderProject> {
    try {
      const project = JSON.parse(jsonString) as UIBuilderProject;
      
      // Generate a new ID to avoid conflicts
      const importedProject: UIBuilderProject = {
        ...project,
        id: uuidv4(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1
      };
      
      await this.createProject(importedProject);
      return importedProject;
    } catch (error) {
      console.error('Error importing project from JSON:', error);
      throw new Error('Failed to import project from JSON');
    }
  }

  /**
   * Create a project version (snapshot)
   */
  public async createProjectVersion(projectId: string, version: number, description: string): Promise<void> {
    try {
      const project = await this.getProjectById(projectId);
      if (!project) {
        throw new Error(`Project with ID ${projectId} not found`);
      }
      
      const versionData = {
        id: uuidv4(),
        projectId,
        version,
        htmlCode: project.htmlCode,
        cssCode: project.cssCode,
        jsCode: project.jsCode,
        description,
        createdAt: new Date().toISOString()
      };
      
      const transaction = await this.getTransaction('project_versions', 'readwrite');
      const store = transaction.objectStore('project_versions');
      
      return new Promise<void>((resolve, reject) => {
        const request = store.add(versionData);
        
        request.onsuccess = () => {
          resolve();
        };
        
        request.onerror = () => {
          reject(new Error('Failed to create project version'));
        };
      });
    } catch (error) {
      console.error('Error creating project version:', error);
      throw error;
    }
  }

  /**
   * Get recent projects (sorted by updated date)
   */
  public async getRecentProjects(limit: number = 10): Promise<UIBuilderProject[]> {
    try {
      const projects = await this.getAllProjects();
      
      // Sort by updated date (newest first) and limit
      return projects
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, limit);
    } catch (error) {
      console.error('Error getting recent projects:', error);
      return [];
    }
  }
}

// Export singleton instance
export const uiBuilderService = UIBuilderService.getInstance(); 