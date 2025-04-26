import { openDB, IDBPDatabase } from 'idb';
import type { Workflow } from '../Store';
import { supabase } from '../../../supabaseClient';

declare global {
  interface Window {
    electron: {
      getWorkflowsPath: () => Promise<string>;
    };
  }
}

interface WorkflowsCache {
  id: 'workflows';
  data: Workflow[];
  lastFetched: number;
}

const DB_NAME = 'claraverse_n8n';
const WORKFLOWS_STORE = 'workflows';
const CACHE_STORE = 'cache';
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds

let db: IDBPDatabase | null = null;

// Add a debug mode flag at the top
const DEBUG = false;

// Helper function for controlled logging
function log(message: string, type: 'info' | 'error' | 'debug' = 'info') {
  if (type === 'error') {
    console.error(message);
  } else if (type === 'debug' && DEBUG) {
    console.log(`[Debug] ${message}`);
  } else if (type === 'info') {
    console.log(message);
  }
}

export async function initDB() {
  try {
    if (db) {
      log('Using existing database connection', 'debug');
      return db;
    }

    log('Initializing database', 'debug');
    db = await openDB(DB_NAME, 1, {
      upgrade(database, oldVersion, newVersion, transaction) {
        log(`Upgrading database from v${oldVersion} to v${newVersion}`, 'info');
        
        if (!database.objectStoreNames.contains(WORKFLOWS_STORE)) {
          database.createObjectStore(WORKFLOWS_STORE, { keyPath: 'jsonLink' });
        }

        if (!database.objectStoreNames.contains(CACHE_STORE)) {
          database.createObjectStore(CACHE_STORE, { keyPath: 'id' });
        }
      },
      blocked() {
        log('Database upgrade was blocked', 'error');
      },
      blocking() {
        log('Database is blocking a version upgrade', 'error');
      },
      terminated() {
        log('Database connection was terminated', 'error');
        db = null;
      }
    });

    return db;
  } catch (error) {
    log(`Database initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    db = null;
    throw error;
  }
}

export async function getWorkflowsFromCache(): Promise<Workflow[] | null> {
  try {
    const db = await initDB();
    const cache = await db.get(CACHE_STORE, 'workflows');

    if (!cache) {
      log('No workflows found in cache', 'debug');
      return null;
    }

    if (Date.now() - cache.lastFetched > CACHE_DURATION) {
      log('Cache expired', 'debug');
      return null;
    }

    return cache.data;
  } catch (error) {
    log(`Error reading from cache: ${error}`, 'error');
    return null;
  }
}

export async function saveWorkflowsToCache(workflows: Workflow[]) {
  try {
    const db = await initDB();
    await db.put(CACHE_STORE, {
      id: 'workflows',
      data: workflows,
      lastFetched: Date.now(),
    });
    log(`Cached ${workflows.length} workflows`, 'debug');
  } catch (error) {
    log(`Error saving workflows to cache: ${error}`, 'error');
    throw error;
  }
}

export async function getWorkflowJson(jsonLink: string): Promise<string | null> {
  try {
    const db = await initDB();
    const workflow = await db.get(WORKFLOWS_STORE, jsonLink);
    return workflow?.jsonData || null;
  } catch (error) {
    log(`Error reading workflow JSON: ${error}`, 'error');
    return null;
  }
}

export async function saveWorkflowJson(jsonLink: string, jsonData: string) {
  try {
    const db = await initDB();
    await db.put(WORKFLOWS_STORE, {
      jsonLink,
      jsonData,
      lastFetched: Date.now(),
    });
    log(`Saved workflow JSON: ${jsonLink}`, 'debug');
  } catch (error) {
    log(`Error saving workflow JSON: ${error}`, 'error');
    throw error;
  }
}

export async function prefetchAndStoreWorkflows() {
  try {
    log('Starting workflow prefetch', 'info');
    
    // Only fetch from Supabase
    const workflowsData = await fetchWorkflowsFromSupabase();
    
    if (!workflowsData || workflowsData.length === 0) {
      throw new Error('No workflows available from Supabase');
    }

    const db = await initDB();
    
    // Store workflows in parallel but limit concurrency
    const batchSize = 5;
    for (let i = 0; i < workflowsData.length; i += batchSize) {
      const batch = workflowsData.slice(i, i + batchSize);
      await Promise.all(batch.map(async (workflow) => {
        if (workflow.jsonLink) {
          try {
            const existing = await getWorkflowJson(workflow.jsonLink);
            if (!existing) {
              await saveWorkflowJson(workflow.jsonLink, 
                typeof workflow.jsonLink === 'string' ? workflow.jsonLink : JSON.stringify(workflow.jsonLink)
              );
            }
          } catch (error) {
            log(`Failed to save workflow JSON for ${workflow.name}`, 'error');
          }
        }
      }));
    }

    await saveWorkflowsToCache(workflowsData);
    log('Workflow prefetch complete', 'info');
    return workflowsData;
  } catch (error) {
    log(`Error in prefetchAndStoreWorkflows: ${error}`, 'error');
    
    // If Supabase fetch fails, try to get from cache
    const cached = await getWorkflowsFromCache();
    if (cached) {
      log('Using cached workflows data', 'info');
      return cached;
    }
    
    throw error;
  }
}

export async function fetchWorkflows(forceFresh: boolean = false): Promise<Workflow[]> {
  try {
    if (!forceFresh) {
      const cached = await getWorkflowsFromCache();
      if (cached) return cached.map(w => ({
        ...w,
        id: w.jsonLink, // Use jsonLink as id for backward compatibility
        likes: 0,
        downloads: 0
      }));
    }

    return await prefetchAndStoreWorkflows();
  } catch (error) {
    log(`Error in fetchWorkflows: ${error}`, 'error');
    
    const cached = await getWorkflowsFromCache();
    if (cached) return cached.map(w => ({
      ...w,
      id: w.jsonLink, // Use jsonLink as id for backward compatibility
      likes: 0,
      downloads: 0
    }));
    
    throw error;
  }
}

export async function fetchAndCacheWorkflowJson(jsonLink: string, force: boolean = false): Promise<string> {
  try {
    if (!force) {
      const cached = await getWorkflowJson(jsonLink);
      if (cached) return cached;
    }

    // If jsonLink is already a JSON string/object, use it directly
    if (typeof jsonLink === 'string' && (jsonLink.startsWith('{') || jsonLink.startsWith('['))) {
      await saveWorkflowJson(jsonLink, jsonLink);
      return jsonLink;
    }

    // Otherwise, assume it's a URL and fetch it
    const response = await fetch(jsonLink);
    if (!response.ok) {
      throw new Error(`Failed to fetch workflow JSON: ${response.status} ${response.statusText}`);
    }

    const jsonData = await response.text();
    
    try {
      JSON.parse(jsonData); // Validate JSON
    } catch (e) {
      throw new Error('Invalid JSON data received');
    }

    await saveWorkflowJson(jsonLink, jsonData);
    return jsonData;
  } catch (error) {
    log(`Error in fetchAndCacheWorkflowJson: ${error}`, 'error');
    
    const cached = await getWorkflowJson(jsonLink);
    if (cached) return cached;
    
    throw error;
  }
}

export async function clearCache() {
  try {
    const db = await initDB();
    await Promise.all([
      db.clear(CACHE_STORE),
      db.clear(WORKFLOWS_STORE)
    ]);
    log('Cache cleared', 'info');
  } catch (error) {
    log(`Error clearing cache: ${error}`, 'error');
    throw error;
  }
}

export async function fetchWorkflowsFromSupabase(): Promise<Workflow[]> {
  try {
    log('Fetching workflows from Supabase', 'info');
    const { data, error } = await supabase
      .from('shared_workflows')
      .select('*')
      .eq('is_prebuilt', true);
    
    if (error) {
      throw new Error(`Supabase error: ${error.message}`);
    }
    
    if (!data || data.length === 0) {
      log('No workflows found in Supabase', 'info');
      return [];
    }
    
    log(`Fetched ${data.length} workflows from Supabase`, 'info');
    
    // Transform Supabase data to match Workflow interface
    return data.map(item => {
      // Handle workflow_json based on its type
      let workflowJson;
      let jsonLink;
      
      try {
        if (typeof item.workflow_json === 'string') {
          // If it's a string, try to parse it as JSON
          workflowJson = JSON.parse(item.workflow_json);
          jsonLink = item.workflow_json; // Keep the JSON string as the link
        } else if (item.workflow_json) {
          // If it's already an object
          workflowJson = item.workflow_json;
          jsonLink = JSON.stringify(workflowJson);
        } else {
          // If no workflow_json, use workflow_json_url
          workflowJson = {};
          jsonLink = item.workflow_json_url || '';
        }
      } catch (e) {
        log(`Error parsing workflow JSON for ${item.title || 'unknown workflow'}`, 'error');
        workflowJson = {};
        jsonLink = item.workflow_json_url || item.workflow_json || '';
      }

      // Extract nodes from workflow JSON
      const nodes = workflowJson?.nodes || [];
      
      return {
        id: item.id,
        category: item.category || workflowJson?.category || 'uncategorized',
        name: item.title || workflowJson?.name,
        description: item.description || workflowJson?.description,
        nodeCount: nodes.length,
        tags: item.tags || workflowJson?.tags || [],
        jsonLink: jsonLink,
        nodeNames: nodes.map((n: any) => n.type || n.name),
        readmeLink: item.readme_url || '',
        likes: item.likes || 0,
        downloads: item.downloads || 0,
        is_prebuilt: item.is_prebuilt
      };
    });
  } catch (error) {
    log(`Error fetching from Supabase: ${error}`, 'error');
    return [];
  }
} 