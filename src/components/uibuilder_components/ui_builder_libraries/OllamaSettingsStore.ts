import { OllamaConnection } from './OllamaTypes';

// Default connection settings
const DEFAULT_CONNECTION: OllamaConnection = {
  host: 'localhost',
  port: 11434,
  secure: false
};

/**
 * Store for managing Ollama connection settings
 */
class OllamaSettingsStore {
  private static readonly STORAGE_KEY = 'ollama_ui_builder_settings';
  private connection: OllamaConnection;
  private listeners: Array<(connection: OllamaConnection) => void> = [];

  constructor() {
    // Load settings from localStorage or use defaults
    const savedSettings = localStorage.getItem(OllamaSettingsStore.STORAGE_KEY);
    
    if (savedSettings) {
      try {
        this.connection = JSON.parse(savedSettings);
      } catch (e) {
        console.warn('Failed to parse saved Ollama settings, using defaults', e);
        this.connection = { ...DEFAULT_CONNECTION };
      }
    } else {
      this.connection = { ...DEFAULT_CONNECTION };
    }
  }

  /**
   * Get the current connection settings
   */
  getConnection(): OllamaConnection {
    return { ...this.connection };
  }

  /**
   * Update the connection settings
   */
  updateConnection(connection: Partial<OllamaConnection>): void {
    this.connection = {
      ...this.connection,
      ...connection
    };
    
    // Save to localStorage
    localStorage.setItem(
      OllamaSettingsStore.STORAGE_KEY,
      JSON.stringify(this.connection)
    );
    
    // Notify listeners
    this.notifyListeners();
  }

  /**
   * Reset connection settings to defaults
   */
  resetToDefaults(): void {
    this.connection = { ...DEFAULT_CONNECTION };
    
    // Save to localStorage
    localStorage.setItem(
      OllamaSettingsStore.STORAGE_KEY,
      JSON.stringify(this.connection)
    );
    
    // Notify listeners
    this.notifyListeners();
  }

  /**
   * Subscribe to changes in connection settings
   */
  subscribe(listener: (connection: OllamaConnection) => void): () => void {
    this.listeners.push(listener);
    
    // Return unsubscribe function
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  /**
   * Notify all listeners about connection changes
   */
  private notifyListeners(): void {
    const connection = this.getConnection();
    this.listeners.forEach(listener => listener(connection));
  }
}

// Export a singleton instance
export const ollamaSettingsStore = new OllamaSettingsStore();

export default ollamaSettingsStore; 