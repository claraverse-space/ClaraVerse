import React, { useEffect, useState, useRef } from 'react';
import { Save, User, Globe, Server, Image, Settings as SettingsIcon, Trash2, HardDrive, Plus, Check, X, Edit3, Zap, Router, Bot, Wrench, Download, RotateCcw, AlertCircle, ExternalLink, HelpCircle, Brain, Puzzle, Hammer, RefreshCw, Power, Code, Monitor, FileText } from 'lucide-react';
import { db, type PersonalInfo, type APIConfig, type Provider } from '../db';
import { useTheme, ThemeMode } from '../hooks/useTheme';
import { useProviders } from '../contexts/ProvidersContext';
import MCPSettings from './MCPSettings';
import ModelManager from './ModelManager';
import ToolBelt from './ToolBelt';
import GPUDiagnostics from './GPUDiagnostics';

// Type for llama.cpp update info
interface LlamacppUpdateInfo {
  hasUpdate: boolean;
  error?: string;
  currentVersion: string;
  latestVersion?: string;
  platform: string;
  downloadSize?: string;
  releaseUrl?: string;
  publishedAt?: string;
}

// Add interface for Docker services status
interface DockerServicesStatus {
  dockerAvailable: boolean;
  n8nAvailable: boolean;
  pythonAvailable: boolean;
  comfyuiAvailable: boolean;
  message?: string;
  ports?: {
    python: number;
    n8n: number;
    ollama: number;
    comfyui: number;
  };
}

// Add interface for startup configuration
interface StartupConfig {
  autoStart: boolean;
  startMinimized: boolean;
  startFullscreen: boolean;
  checkForUpdates: boolean;
  restoreLastSession: boolean;
}

const Settings = () => {
  const [activeTab, setActiveTab] = useState<'personal' | 'api' | 'preferences' | 'models' | 'mcp' | 'toolbelt' | 'updates' | 'sdk-demo' | 'servers' >('api');
  const [activeModelTab, setActiveModelTab] = useState<'models' | 'gpu-diagnostics'>('models');
  const [personalInfo, setPersonalInfo] = useState<PersonalInfo>({
    name: '',
    email: '',
    avatar_url: '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    theme_preference: 'system',
    startup_settings: {
      autoStart: false,
      startMinimized: false,
      startFullscreen: false,
      checkForUpdates: true,
      restoreLastSession: true
    }
  });

  const [apiConfig, setApiConfig] = useState<APIConfig>({
    ollama_base_url: '',
    comfyui_base_url: '',
    openai_api_key: '',
    openai_base_url: '',
    api_type: 'ollama'
  });

  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  // const [showApiKey, setShowApiKey] = useState(false);
  const [wallpaperUrl, setWallpaperUrl] = useState<string | null>(null);

  // Update state
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [checkingUpdates, setCheckingUpdates] = useState(false);
  const [lastUpdateCheck, setLastUpdateCheck] = useState<Date | null>(null);

  // Add llama.cpp binary update state
  const [llamacppUpdateInfo, setLlamacppUpdateInfo] = useState<LlamacppUpdateInfo | null>(null);
  const [checkingLlamacppUpdates, setCheckingLlamacppUpdates] = useState(false);
  const [updatingLlamacppBinaries, setUpdatingLlamacppBinaries] = useState(false);
  const [lastLlamacppUpdateCheck, setLastLlamacppUpdateCheck] = useState<Date | null>(null);

  // Add Docker services status state
  const [dockerServices, setDockerServices] = useState<DockerServicesStatus>({
    dockerAvailable: false,
    n8nAvailable: false,
    pythonAvailable: false,
    comfyuiAvailable: false
  });

  // Add Python backend info state
  const [pythonBackendInfo, setPythonBackendInfo] = useState<any>(null);

  // Add startup configuration state
  const [startupConfig, setStartupConfig] = useState<StartupConfig>({
    autoStart: false,
    startMinimized: false,
    startFullscreen: false,
    checkForUpdates: true,
    restoreLastSession: true
  });

  // Add feature configuration state
  const [featureConfig, setFeatureConfig] = useState({
    comfyUI: true,
    n8n: true,
    ragAndTts: true,
    claraCore: true
  });
  const [featureConfigLoaded, setFeatureConfigLoaded] = useState(false);
  const [savingFeatureConfig, setSavingFeatureConfig] = useState(false);

  // Type for update info to fix TypeScript errors
  interface UpdateInfo {
    hasUpdate: boolean;
    error?: string;
    currentVersion: string;
    latestVersion?: string;
    platform: string;
    isOTASupported: boolean;
    releaseUrl?: string;
    downloadUrl?: string;
    releaseNotes?: string;
    publishedAt?: string;
  }

  const { setTheme } = useTheme();
  const { providers, addProvider, updateProvider, deleteProvider, setPrimaryProvider, loading: providersLoading } = useProviders();
  // const { theme } = useTheme();
  const saveTimeout = useRef<NodeJS.Timeout | null>(null);

  // Add provider modal state
  const [showAddProviderModal, setShowAddProviderModal] = useState(false);
  const [editingProvider, setEditingProvider] = useState<Provider | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [testingProvider, setTestingProvider] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<{ [key: string]: 'success' | 'error' | null }>({});
  const [newProviderForm, setNewProviderForm] = useState({
    name: '',
    type: 'openai' as Provider['type'],
    baseUrl: '',
    apiKey: '',
    isEnabled: true
  });

  // Add enhanced service status state
  const [enhancedServiceStatus, setEnhancedServiceStatus] = useState<any>({});
  const [serviceConfigs, setServiceConfigs] = useState<any>({});
  const [platformCompatibility, setPlatformCompatibility] = useState<any>({});
  const [loadingServiceConfigs, setLoadingServiceConfigs] = useState(false);
  const [testingServices, setTestingServices] = useState<{ [key: string]: boolean }>({});
  const [serviceTestResults, setServiceTestResults] = useState<{ [key: string]: any }>({});
  const [savingServiceConfig, setSavingServiceConfig] = useState<{ [key: string]: boolean }>({});
  const [tempServiceUrls, setTempServiceUrls] = useState<{ [key: string]: string }>({});

  // Current platform detection
  const [currentPlatform, setCurrentPlatform] = useState<string>('');

  useEffect(() => {
    const loadSettings = async () => {
      const savedPersonalInfo = await db.getPersonalInfo();
      const savedApiConfig = await db.getAPIConfig();

      if (savedPersonalInfo) {
        setPersonalInfo(savedPersonalInfo);
        setTheme(savedPersonalInfo.theme_preference as ThemeMode);
      }

      if (savedApiConfig) {
        setApiConfig({
          ...savedApiConfig,
          openai_base_url: savedApiConfig.openai_base_url || 'https://api.openai.com/v1',
        });
      }

      // Load startup configuration
      await loadStartupConfig();

      // Load feature configuration
      await loadFeatureConfig();
    };

    loadSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load startup configuration from personal info
  const loadStartupConfig = async () => {
    try {
      const personalInfo = await db.getPersonalInfo();
      if (personalInfo?.startup_settings) {
        setStartupConfig(personalInfo.startup_settings);
      }
    } catch (error) {
      console.error('Failed to load startup configuration:', error);
    }
  };

  // Load feature configuration
  const loadFeatureConfig = async () => {
    try {
      if ((window as any).featureConfig?.getFeatureConfig) {
        const config = await (window as any).featureConfig.getFeatureConfig();
        if (config) {
          setFeatureConfig(config);
        }
      }
      setFeatureConfigLoaded(true);
    } catch (error) {
      console.error('Failed to load feature configuration:', error);
      setFeatureConfigLoaded(true);
    }
  };

  // Update startup configuration
  const updateStartupConfig = async (updates: Partial<StartupConfig>) => {
    try {
      const newConfig = { ...startupConfig, ...updates };
      setStartupConfig(newConfig);
      
      // Update personal info with new startup settings (for database persistence)
      const currentPersonalInfo = await db.getPersonalInfo();
      const updatedPersonalInfo = {
        ...currentPersonalInfo,
        name: currentPersonalInfo?.name || '',
        email: currentPersonalInfo?.email || '',
        avatar_url: currentPersonalInfo?.avatar_url || '',
        timezone: currentPersonalInfo?.timezone || 'UTC',
        theme_preference: currentPersonalInfo?.theme_preference || 'system' as const,
        startup_settings: newConfig
      };
      
      await db.updatePersonalInfo(updatedPersonalInfo);
      
      // Also update the electron main process settings
      if ((window as any).electron?.setStartupSettings) {
        const result = await (window as any).electron.setStartupSettings(newConfig);
        if (!result.success) {
          throw new Error(result.error || 'Failed to update startup settings in electron');
        }
      }
      
    } catch (error) {
      console.error('Failed to update startup configuration:', error);
      // Revert on error
      setStartupConfig(startupConfig);
    }
  };

  // Update feature configuration
  const updateFeatureConfig = async (updates: Partial<typeof featureConfig>) => {
    try {
      setSavingFeatureConfig(true);
      const newConfig = { ...featureConfig, ...updates };
      
      // Clara Core is always enabled
      newConfig.claraCore = true;
      
      setFeatureConfig(newConfig);
      
      // Save to electron backend
      if ((window as any).featureConfig?.updateFeatureConfig) {
        const success = await (window as any).featureConfig.updateFeatureConfig(newConfig);
        if (!success) {
          throw new Error('Failed to save feature configuration');
        }
      }
      
    } catch (error) {
      console.error('Failed to update feature configuration:', error);
      // Revert on error
      setFeatureConfig(featureConfig);
      alert('❌ Failed to save feature configuration. Please try again.');
    } finally {
      setSavingFeatureConfig(false);
    }
  };

  // Reset first-time setup
  const resetFirstTimeSetup = async () => {
    try {
      // For now, just show a message - this would need to be implemented in electron
      alert('✅ First-time setup reset functionality will be implemented in a future update.');
    } catch (error) {
      console.error('Failed to reset first-time setup:', error);
      alert('❌ Failed to reset first-time setup. Please try again.');
    }
  };

  // Load wallpaper from IndexedDB on mount
  useEffect(() => {
    const loadWallpaper = async () => {
      try {
        const wallpaper = await db.getWallpaper();
        if (wallpaper) {
          setWallpaperUrl(wallpaper);
        }
      } catch (error) {
        console.error('Error loading wallpaper:', error);
      }
    };
    loadWallpaper();
  }, []);

  // Check for updates when updates tab is first opened
  useEffect(() => {
    if (activeTab === 'updates' && !updateInfo && !checkingUpdates) {
      checkForUpdates();
    }
  }, [activeTab]);

  // Auto-check for llama.cpp updates when updates tab is opened
  useEffect(() => {
    if (activeTab === 'updates' && !llamacppUpdateInfo && !checkingLlamacppUpdates) {
      // Small delay to avoid overwhelming the UI
      setTimeout(() => {
        checkForLlamacppUpdates();
      }, 500);
    }
  }, [activeTab]);

  // Add auto-detection when API tab is opened
  useEffect(() => {
    if (activeTab === 'api' && !providersLoading) {
      // Only auto-detect if no providers exist or only Clara's Core exists
      const nonCoreProviders = providers.filter(p => p.type !== 'claras-pocket');
      if (nonCoreProviders.length === 0) {
        autoDetectOllamaProvider();
      }
    }
  }, [activeTab, providersLoading, providers]);

  // Check URL parameters on mount to set initial tab
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tabParam = urlParams.get('tab');
    if (tabParam && ['personal', 'api', 'preferences', 'models', 'mcp', 'toolbelt', 'updates', 'sdk-demo', 'servers'].includes(tabParam)) {
      setActiveTab(tabParam as any);
    }
  }, []);

  // Check Docker services status
  useEffect(() => {
    const checkDockerServices = async () => {
      try {
        if ((window.electron as any)?.checkDockerServices) {
          const status = await (window.electron as any).checkDockerServices();
          setDockerServices(status);
        }
      } catch (error) {
        console.error('Failed to check Docker services:', error);
        setDockerServices({
          dockerAvailable: false,
          n8nAvailable: false,
          pythonAvailable: false,
          comfyuiAvailable: false,
          message: 'Failed to check Docker services'
        });
      }
    };

    checkDockerServices();
    // Check periodically every 30 seconds
    const interval = setInterval(checkDockerServices, 30000);
    return () => clearInterval(interval);
  }, []);

  // Load Python backend information
  useEffect(() => {
    const loadPythonBackendInfo = async () => {
      try {
        if ((window.electron as any)?.getPythonBackendInfo) {
          const info = await (window.electron as any).getPythonBackendInfo();
          setPythonBackendInfo(info);
        }
      } catch (error) {
        console.error('Failed to load Python backend info:', error);
      }
    };

    if (activeTab === 'servers') {
      loadPythonBackendInfo();
    }
  }, [activeTab]);

  // Update checking functionality - Enhanced with bulletproof error handling
  const checkForUpdates = async () => {
    const electron = window.electron as any;

    // Validate electron availability
    if (!electron) {
      console.error('Electron API not available');
      setUpdateInfo({
        error: 'Application API not available. Please restart the application.',
        hasUpdate: false,
        currentVersion: '1.0.0',
        platform: 'unknown',
        isOTASupported: false
      });
      setCheckingUpdates(false);
      return;
    }

    if (!electron.getUpdateInfo) {
      console.error('Update functionality not available');
      setUpdateInfo({
        error: 'Update functionality is not available in this version.',
        hasUpdate: false,
        currentVersion: '1.0.0',
        platform: 'unknown',
        isOTASupported: false
      });
      setCheckingUpdates(false);
      return;
    }

    // Prevent concurrent checks
    if (checkingUpdates) {
      console.warn('Update check already in progress');
      return;
    }

    setCheckingUpdates(true);
    setUpdateInfo(null); // Clear previous results

    try {
      console.log('Starting update check...');
      const info = await electron.getUpdateInfo();

      // Validate response structure
      if (!info || typeof info !== 'object') {
        throw new Error('Invalid update information received');
      }

      // Ensure required fields exist
      const safeInfo = {
        hasUpdate: Boolean(info.hasUpdate),
        currentVersion: info.currentVersion || '1.0.0',
        latestVersion: info.latestVersion || info.currentVersion || '1.0.0',
        platform: info.platform || 'unknown',
        isOTASupported: Boolean(info.isOTASupported),
        releaseUrl: info.releaseUrl || '',
        downloadUrl: info.downloadUrl || '',
        releaseNotes: info.releaseNotes || 'No release notes available.',
        publishedAt: info.publishedAt || null,
        error: info.error || null
      };

      setUpdateInfo(safeInfo);
      setLastUpdateCheck(new Date());

      console.log('Update check completed successfully:', {
        hasUpdate: safeInfo.hasUpdate,
        currentVersion: safeInfo.currentVersion,
        latestVersion: safeInfo.latestVersion,
        error: safeInfo.error
      });

    } catch (error) {
      console.error('Error checking for updates:', error);

      // Create safe error response
      const errorMessage = error instanceof Error
        ? error.message
        : 'An unexpected error occurred while checking for updates';

      const errorInfo: UpdateInfo = {
        hasUpdate: false,
        error: errorMessage,
        currentVersion: '1.0.0',
        platform: 'unknown',
        isOTASupported: false
      };

      setUpdateInfo(errorInfo);
      setLastUpdateCheck(new Date());

      // Log additional context for debugging
      console.error('Update check error details:', {
        message: errorMessage,
        stack: error instanceof Error ? error.stack : 'No stack trace',
        timestamp: new Date().toISOString()
      });
    } finally {
      setCheckingUpdates(false);
    }
  };

  const handleManualUpdateCheck = async () => {
    const electron = window.electron as any;

    // Validate electron availability
    if (!electron) {
      console.error('Electron API not available');
      return;
    }

    if (!electron.checkForUpdates) {
      console.error('Manual update check not available');
      return;
    }

    // Prevent concurrent manual checks
    if (checkingUpdates) {
      console.warn('Update check already in progress');
      return;
    }

    try {
      console.log('Starting manual update check...');

      // Call the manual update check (may show dialogs)
      await electron.checkForUpdates();

      console.log('Manual update check initiated successfully');

      // Refresh update info after manual check with delay
      setTimeout(() => {
        if (!checkingUpdates) { // Only refresh if not already checking
          checkForUpdates();
        }
      }, 1500);

    } catch (error) {
      console.error('Error during manual update check:', error);

      // Show user-friendly error
      const errorMessage = error instanceof Error
        ? error.message
        : 'Failed to check for updates manually';

      setUpdateInfo((prev: UpdateInfo | null) => ({
        hasUpdate: false,
        error: errorMessage,
        currentVersion: prev?.currentVersion || '1.0.0',
        platform: prev?.platform || 'unknown',
        isOTASupported: prev?.isOTASupported || false
      }));
    }
  };

  const openReleaseNotes = () => {
    if (updateInfo?.releaseUrl) {
      window.open(updateInfo.releaseUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const downloadUpdate = () => {
    if (updateInfo?.downloadUrl) {
      window.open(updateInfo.downloadUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const getPlatformName = (platform: string) => {
    if (!platform || typeof platform !== 'string') {
      return 'Unknown Platform';
    }

    switch (platform.toLowerCase()) {
      case 'darwin': return 'macOS';
      case 'win32': return 'Windows';
      case 'linux': return 'Linux';
      default: return platform.charAt(0).toUpperCase() + platform.slice(1);
    }
  };

  // Auto-save effect for personalInfo and apiConfig
  useEffect(() => {
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    setIsSaving(true);
    setSaveStatus('idle');
    saveTimeout.current = setTimeout(async () => {
      try {
        await db.updatePersonalInfo(personalInfo);
        await db.updateAPIConfig(apiConfig);
        setSaveStatus('success');
        // Hide success message after 2 seconds
        setTimeout(() => {
          setSaveStatus('idle');
          setIsSaving(false);
        }, 2000);
      } catch {
        setSaveStatus('error');
        // Hide error message after 3 seconds
        setTimeout(() => {
          setSaveStatus('idle');
          setIsSaving(false);
        }, 3000);
      }
    }, 600); // debounce 600ms
    return () => {
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
    };
  }, [personalInfo, apiConfig]);

  // When theme_preference changes, update the theme immediately
  const handleThemeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value as ThemeMode;
    setPersonalInfo(prev => ({ ...prev, theme_preference: value }));
    setTheme(value);
  };

  // Handle setting wallpaper
  const handleSetWallpaper = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        try {
          // Convert file to base64
          const reader = new FileReader();
          reader.onload = async (e) => {
            const base64String = e.target?.result as string;
            // Store in IndexedDB
            await db.setWallpaper(base64String);
            // Update state
            setWallpaperUrl(base64String);
          };
          reader.readAsDataURL(file);
        } catch (error) {
          console.error('Error setting wallpaper:', error);
        }
      }
    };
    input.click();
  };

  // Handle clearing wallpaper
  const handleClearWallpaper = async () => {
    try {
      await db.setWallpaper('');
      setWallpaperUrl(null);
    } catch (error) {
      console.error('Error clearing wallpaper:', error);
    }
  };

  // Timezone options helper
  let timezoneOptions: string[] = [];
  try {
    // @ts-expect-error - Intl.supportedValuesOf may not be available in all environments
    timezoneOptions = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : [];
  } catch {
    timezoneOptions = [];
  }
  if (!timezoneOptions.length) {
    timezoneOptions = [
      'UTC', 'America/New_York', 'Europe/London', 'Asia/Tokyo', 'Asia/Kolkata',
      'Europe/Paris', 'Europe/Berlin', 'America/Los_Angeles', 'Australia/Sydney'
    ];
  }

  // Tab component
  const TabItem = ({ id, label, icon, isActive }: { id: typeof activeTab, label: string, icon: React.ReactNode, isActive: boolean }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`flex items-center gap-3 px-4 py-3 w-full rounded-lg transition-colors ${isActive
          ? 'bg-sakura-500 text-white'
          : 'text-gray-700 dark:text-gray-200 hover:bg-sakura-100 dark:hover:bg-gray-800'
        }`}
    >
      {icon}
      <span className="font-medium">{label}</span>
    </button>
  );

  // Model sub-tab component
  const ModelTabItem = ({ id, label, isActive }: { id: typeof activeModelTab, label: string, isActive: boolean }) => (
    <button
      onClick={() => setActiveModelTab(id)}
      className={`px-4 py-2 rounded-lg transition-colors font-medium ${isActive
          ? 'bg-sakura-500 text-white'
          : 'text-gray-700 dark:text-gray-200 hover:bg-sakura-100 dark:hover:bg-gray-800'
        }`}
    >
      {label}
    </button>
  );

  // Provider management functions
  const handleAddProvider = async () => {
    try {
      await addProvider({
        name: newProviderForm.name,
        type: newProviderForm.type,
        baseUrl: newProviderForm.baseUrl,
        apiKey: newProviderForm.apiKey,
        isEnabled: newProviderForm.isEnabled,
        isPrimary: false
      });

      setShowAddProviderModal(false);
      setNewProviderForm({
        name: '',
        type: 'openai',
        baseUrl: '',
        apiKey: '',
        isEnabled: true
      });
    } catch (error) {
      console.error('Error adding provider:', error);
      if (error instanceof Error && error.message.includes("Clara's Pocket provider already exists")) {
        alert("⚠️ Clara's Pocket provider already exists. Only one instance is allowed.");
      } else {
        alert('❌ Failed to add provider. Please try again.');
      }
    }
  };

  const handleEditProvider = (provider: Provider) => {
    setEditingProvider(provider);
    setNewProviderForm({
      name: provider.name,
      type: provider.type,
      baseUrl: provider.baseUrl || '',
      apiKey: provider.apiKey || '',
      isEnabled: provider.isEnabled
    });
    setShowAddProviderModal(true);
  };

  const handleUpdateProvider = async () => {
    if (!editingProvider) return;

    try {
      await updateProvider(editingProvider.id, {
        name: newProviderForm.name,
        type: newProviderForm.type,
        baseUrl: newProviderForm.baseUrl,
        apiKey: newProviderForm.apiKey,
        isEnabled: newProviderForm.isEnabled
      });

      setShowAddProviderModal(false);
      setEditingProvider(null);
      setNewProviderForm({
        name: '',
        type: 'openai',
        baseUrl: '',
        apiKey: '',
        isEnabled: true
      });
    } catch (error) {
      console.error('Error updating provider:', error);
    }
  };

  const handleDeleteProvider = async (providerId: string) => {
    try {
      await deleteProvider(providerId);
      setShowDeleteConfirm(null);
    } catch (error) {
      console.error('Error deleting provider:', error);
    }
  };

  const testOllamaConnection = async (providerId: string, baseUrl: string) => {
    setTestingProvider(providerId);
    setTestResults(prev => ({ ...prev, [providerId]: null }));

    try {
      // Remove /v1 from baseUrl for the tags endpoint since Ollama's tags endpoint is at /api/tags, not /v1/api/tags
      const testUrl = baseUrl.replace('/v1', '');
      const response = await fetch(`${testUrl}/api/tags`);
      if (response.ok) {
        setTestResults(prev => ({ ...prev, [providerId]: 'success' }));
      } else {
        setTestResults(prev => ({ ...prev, [providerId]: 'error' }));
      }
    } catch (error) {
      setTestResults(prev => ({ ...prev, [providerId]: 'error' }));
      console.error('Ollama connection test failed:', error);
    } finally {
      setTestingProvider(null);

      // Clear test results after 3 seconds
      setTimeout(() => {
        setTestResults(prev => ({ ...prev, [providerId]: null }));
      }, 3000);
    }
  };

  const handleSetPrimary = async (providerId: string, isPrimary: boolean) => {
    try {
      if (isPrimary) {
        await setPrimaryProvider(providerId);
      } else {
        // If unchecking primary, we need to ensure at least one provider remains primary
        const enabledProviders = providers.filter(p => p.isEnabled && p.id !== providerId);
        if (enabledProviders.length > 0) {
          await setPrimaryProvider(enabledProviders[0].id);
        }
      }
    } catch (error) {
      console.error('Error setting primary provider:', error);
    }
  };

  const getProviderIcon = (type: Provider['type']) => {
    switch (type) {
      case 'claras-pocket':
        return Bot;
      case 'openai':
        return Zap;
      case 'openrouter':
        return Router;
      case 'ollama':
        return Server;
      default:
        return Globe;
    }
  };

  const getDefaultProviderConfig = (type: Provider['type']) => {
    switch (type) {
      case 'openai':
        return { baseUrl: 'https://api.openai.com/v1', name: 'OpenAI' };
      case 'openrouter':
        return { baseUrl: 'https://openrouter.ai/api/v1', name: 'OpenRouter' };
      case 'ollama':
        return { baseUrl: 'http://localhost:11434/v1', name: 'Ollama' };
      case 'claras-pocket':
        return { baseUrl: 'http://localhost:8091/v1', name: "Clara's Core" };
      default:
        return { baseUrl: '', name: '' };
    }
  };

  // Auto-detect Ollama installation
  const detectOllamaInstallation = async () => {
    try {
      const response = await fetch('http://localhost:11434/api/tags', {
        method: 'GET',
        signal: AbortSignal.timeout(3000)
      });
      return response.ok;
    } catch (error) {
      return false;
    }
  };

  // Auto-detect Ollama installation
  const autoDetectOllamaProvider = async () => {
    try {
      // Check if Ollama provider already exists
      const ollamaExists = providers.some(p => p.type === 'ollama');
      if (ollamaExists) {
        return; // Don't add duplicate
      }

      const isRunning = await detectOllamaInstallation();
      if (isRunning) {
        console.log('Auto-detected Ollama installation, adding provider...');
        await addProvider({
          name: 'Ollama (Local)',
          type: 'ollama',
          baseUrl: 'http://localhost:11434/v1',
          apiKey: 'ollama',
          isEnabled: true,
          isPrimary: false
        });
      }
    } catch (error) {
      console.log('Auto-detection error:', error);
    }
  };

  // Llama.cpp binary update functions
  const checkForLlamacppUpdates = async () => {
    const electron = window.electron as any;

    if (!electron?.checkLlamacppUpdates) {
      console.error('Llama.cpp update functionality not available');
      setLlamacppUpdateInfo({
        error: 'Llama.cpp update functionality is not available in this version.',
        hasUpdate: false,
        currentVersion: 'Unknown',
        platform: 'unknown'
      });
      setCheckingLlamacppUpdates(false);
      return;
    }

    if (checkingLlamacppUpdates) {
      console.warn('Llama.cpp update check already in progress');
      return;
    }

    setCheckingLlamacppUpdates(true);
    setLlamacppUpdateInfo(null);

    try {
      console.log('Starting llama.cpp binary update check...');
      const info = await electron.checkLlamacppUpdates();

      const safeInfo = {
        hasUpdate: Boolean(info.hasUpdate),
        currentVersion: info.currentVersion || 'Unknown',
        latestVersion: info.latestVersion || info.currentVersion || 'Unknown',
        platform: info.platform || 'unknown',
        downloadSize: info.downloadSize || 'Unknown size',
        releaseUrl: info.releaseUrl || '',
        publishedAt: info.publishedAt || null,
        error: info.error || null
      };

      setLlamacppUpdateInfo(safeInfo);
      setLastLlamacppUpdateCheck(new Date());

      console.log('Llama.cpp update check completed:', {
        hasUpdate: safeInfo.hasUpdate,
        currentVersion: safeInfo.currentVersion,
        latestVersion: safeInfo.latestVersion,
        error: safeInfo.error
      });

    } catch (error) {
      console.error('Error checking for llama.cpp updates:', error);

      const errorMessage = error instanceof Error
        ? error.message
        : 'An unexpected error occurred while checking for llama.cpp updates';

      setLlamacppUpdateInfo({
        hasUpdate: false,
        error: errorMessage,
        currentVersion: 'Unknown',
        platform: 'unknown'
      });
      setLastLlamacppUpdateCheck(new Date());
    } finally {
      setCheckingLlamacppUpdates(false);
    }
  };

  const updateLlamacppBinaries = async () => {
    const electron = window.electron as any;

    if (!electron?.updateLlamacppBinaries) {
      console.error('Llama.cpp binary update functionality not available');
      return;
    }

    if (updatingLlamacppBinaries) {
      console.warn('Llama.cpp binary update already in progress');
      return;
    }

    setUpdatingLlamacppBinaries(true);

    try {
      console.log('Starting llama.cpp binary update...');
      const result = await electron.updateLlamacppBinaries();

      if (result.success) {
        // Refresh update info
        await checkForLlamacppUpdates();
        
        // Show success message
        console.log('Official Llama.cpp Binaries Updated:', result.message || `Successfully updated official binaries to version ${result.version}. Clara's custom binaries were preserved.`);
      } else {
        console.error('Binary update failed:', result.error);
      }

    } catch (error) {
      console.error('Error updating llama.cpp binaries:', error);
      const errorMessage = error instanceof Error
        ? error.message
        : 'Failed to update llama.cpp binaries';

      setLlamacppUpdateInfo(prev => prev ? {
        ...prev,
        error: errorMessage
      } : null);
    } finally {
      setUpdatingLlamacppBinaries(false);
    }
  };

  useEffect(() => {
    // Detect current platform
    const platform = navigator.platform.toLowerCase();
    if (platform.includes('mac')) setCurrentPlatform('darwin');
    else if (platform.includes('win')) setCurrentPlatform('win32'); 
    else setCurrentPlatform('linux');
  }, []);

  // Load service configurations when Services tab is opened
  useEffect(() => {
    if (activeTab === 'servers') {
      loadServiceConfigurations();
    }
  }, [activeTab]);

  // Load service configurations
  const loadServiceConfigurations = async () => {
    setLoadingServiceConfigs(true);
    try {
      // Load platform compatibility
      if ((window as any).electronAPI?.invoke) {
        const compatibility = await (window as any).electronAPI.invoke('service-config:get-platform-compatibility');
        setPlatformCompatibility(compatibility);

        // Load current service configurations
        const configs = await (window as any).electronAPI.invoke('service-config:get-all-configs');
        setServiceConfigs(configs);

                                // Load enhanced service status
                        const status = await (window as any).electronAPI.invoke('service-config:get-enhanced-status');
                        console.log('🔍 Enhanced service status received by UI:', status);
                        setEnhancedServiceStatus(status);

                        // Clear temp URLs to show the saved URLs properly
                        setTempServiceUrls({});
      }
    } catch (error) {
      console.error('Failed to load service configurations:', error);
    } finally {
      setLoadingServiceConfigs(false);
    }
  };

  // Update service configuration
  const updateServiceConfig = async (serviceName: string, mode: string, url?: string) => {
    setSavingServiceConfig(prev => ({ ...prev, [serviceName]: true }));
    try {
      const result = await (window as any).electronAPI.invoke('service-config:set-config', serviceName, mode, url);
      if (result.success) {
        // Reload configurations
        await loadServiceConfigurations();
        console.log(`✅ ${serviceName} configured as ${mode}${url ? ` with URL: ${url}` : ''}`);
        
        // Clear temp URL since it's now saved
        setTempServiceUrls(prev => ({ ...prev, [serviceName]: '' }));
        
        // Show success feedback
        setServiceTestResults(prev => ({ 
          ...prev, 
          [serviceName]: { 
            success: true, 
            message: 'Configuration saved successfully!',
            timestamp: Date.now()
          }
        }));
        
        // Clear success message after 3 seconds
        setTimeout(() => {
          setServiceTestResults(prev => ({ ...prev, [serviceName]: null }));
        }, 3000);
      } else {
        console.error(`Failed to configure ${serviceName}:`, result.error);
        setServiceTestResults(prev => ({ 
          ...prev, 
          [serviceName]: { 
            success: false, 
            error: result.error || 'Failed to save configuration',
            timestamp: Date.now()
          }
        }));
      }
    } catch (error) {
      console.error(`Error configuring ${serviceName}:`, error);
      setServiceTestResults(prev => ({ 
        ...prev, 
        [serviceName]: { 
          success: false, 
          error: error instanceof Error ? error.message : String(error),
          timestamp: Date.now()
        }
      }));
    } finally {
      setSavingServiceConfig(prev => ({ ...prev, [serviceName]: false }));
    }
  };

  // Save manual service URL
  const saveManualServiceUrl = async (serviceName: string) => {
    let url = tempServiceUrls[serviceName] || serviceConfigs[serviceName]?.url || '';
    if (!url.trim()) {
      setServiceTestResults(prev => ({ 
        ...prev, 
        [serviceName]: { 
          success: false, 
          error: 'Please enter a valid URL',
          timestamp: Date.now()
        }
      }));
      return;
    }
    
    // Auto-detect and fix protocol for HTTPS URLs
    url = url.trim();
    if (url.includes('login.badboysm890.in') && !url.startsWith('https://')) {
      // This domain requires HTTPS
      url = url.replace(/^http:\/\//, 'https://');
      if (!url.startsWith('https://')) {
        url = 'https://' + url;
      }
      console.log(`🔒 Auto-corrected URL to use HTTPS: ${url}`);
    } else if (!url.startsWith('http://') && !url.startsWith('https://')) {
      // Add http:// for localhost and other URLs without protocol
      url = 'http://' + url;
    }
    
    // Save the configuration
    await updateServiceConfig(serviceName, 'manual', url);
    
    // Clear temp URL after successful save so saved URL shows in input
    setTimeout(() => {
      setTempServiceUrls(prev => ({ ...prev, [serviceName]: '' }));
    }, 500);
  };

  // Test manual service connectivity
  const testManualService = async (serviceName: string, inputUrl: string) => {
    setTestingServices(prev => ({ ...prev, [serviceName]: true }));
    setServiceTestResults(prev => ({ ...prev, [serviceName]: null }));

    // Apply the same URL correction logic as save function
    let url = inputUrl.trim();
    if (url.includes('login.badboysm890.in') && !url.startsWith('https://')) {
      // This domain requires HTTPS
      url = url.replace(/^http:\/\//, 'https://');
      if (!url.startsWith('https://')) {
        url = 'https://' + url;
      }
      console.log(`🔒 Auto-corrected URL for test to use HTTPS: ${url}`);
    } else if (!url.startsWith('http://') && !url.startsWith('https://')) {
      // Add http:// for localhost and other URLs without protocol
      url = 'http://' + url;
    }

    try {
      const result = await (window as any).electronAPI.invoke('service-config:test-manual-service', serviceName, url);
      setServiceTestResults(prev => ({ ...prev, [serviceName]: result }));
      
      // Auto-save URL if test is successful
      if (result.success) {
        console.log(`✅ ${serviceName} connection test successful, auto-saving corrected URL: ${url}`);
        await updateServiceConfig(serviceName, 'manual', url);
        
        // Clear temp URL since it's now saved
        setTempServiceUrls(prev => ({ ...prev, [serviceName]: '' }));
        
        // Show success message with auto-save info
        setServiceTestResults(prev => ({ 
          ...prev, 
          [serviceName]: { 
            ...result,
            message: 'Connection successful! Configuration auto-saved.',
            timestamp: Date.now()
          }
        }));
      }
      
      // Clear result after 5 seconds
      setTimeout(() => {
        setServiceTestResults(prev => ({ ...prev, [serviceName]: null }));
      }, 5000);
    } catch (error) {
      console.error(`Failed to test ${serviceName}:`, error);
      setServiceTestResults(prev => ({ 
        ...prev, 
        [serviceName]: { 
          success: false, 
          error: error instanceof Error ? error.message : String(error),
          timestamp: Date.now()
        }
      }));
    } finally {
      setTestingServices(prev => ({ ...prev, [serviceName]: false }));
    }
  };

  // Reset service configuration to defaults
  const resetServiceConfig = async (serviceName: string) => {
    try {
      const result = await (window as any).electronAPI.invoke('service-config:reset-config', serviceName);
      if (result.success) {
        await loadServiceConfigurations();
        console.log(`✅ ${serviceName} configuration reset to defaults`);
      }
    } catch (error) {
      console.error(`Failed to reset ${serviceName} configuration:`, error);
    }
  };

  return (
    <>
      {/* Wallpaper */}
      {wallpaperUrl && (
        <div
          className="fixed top-0 left-0 right-0 bottom-0 z-0"
          style={{
            backgroundImage: `url(${wallpaperUrl})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            opacity: 0.1,
            filter: 'blur(1px)',
            pointerEvents: 'none'
          }}
        />
      )}

      <div className="p-6 flex max-w-7xl mx-auto gap-6 relative z-10 h-[calc(100vh-3rem)]">
        {/* Sidebar with tabs */}
        <div className="w-64 shrink-0">
          <div className="glassmorphic rounded-xl p-4 space-y-2 sticky top-4">
            <h2 className="flex items-center gap-2 px-4 py-3 text-lg font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 mb-2">
              <SettingsIcon className="w-5 h-5 text-sakura-500" />
              Settings
            </h2>

            <TabItem
              id="api"
              label="AI Services"
              icon={<Bot className="w-5 h-5" />}
              isActive={activeTab === 'api'}
            />

            <TabItem
              id="models"
              label="Local Models"
              icon={<Brain className="w-5 h-5" />}
              isActive={activeTab === 'models'}
            />

            <TabItem
              id="mcp"
              label="MCP Servers"
              icon={<Puzzle className="w-5 h-5" />}
              isActive={activeTab === 'mcp'}
            />

            <TabItem
              id="toolbelt"
              label="Tools"
              icon={<Hammer className="w-5 h-5" />}
              isActive={activeTab === 'toolbelt'}
            />

            <TabItem
              id="servers"
              label="Services"
              icon={<Server className="w-5 h-5" />}
              isActive={activeTab === 'servers'}
            />

            <TabItem
              id="preferences"
              label="General"
              icon={<SettingsIcon className="w-5 h-5" />}
              isActive={activeTab === 'preferences'}
            />

            <TabItem
              id="personal"
              label="Profile"
              icon={<User className="w-5 h-5" />}
              isActive={activeTab === 'personal'}
            />

            <TabItem
              id="updates"
              label="Updates"
              icon={<RefreshCw className="w-5 h-5" />}
              isActive={activeTab === 'updates'}
            />

            {/* Save Status - Only visible when saving/saved/error */}
            {(isSaving || saveStatus !== 'idle') && (
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <span className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-white transition-colors w-full ${saveStatus === 'success'
                    ? 'bg-green-500'
                    : saveStatus === 'error'
                      ? 'bg-red-500'
                      : 'bg-gray-400'
                  }`}>
                  <Save className="w-4 h-4" />
                  {saveStatus === 'success' ? 'Saved!' : saveStatus === 'error' ? 'Error!' : 'Saving...'}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Content area */}
        <div className={`flex-1 space-y-6 py-2 pb-6 overflow-y-auto overflow-x-hidden ${activeTab === 'models' ? '' : 'max-w-4xl'
          }`}>
          {/* Profile Tab */}
          {activeTab === 'personal' && (
            <div className="glassmorphic rounded-xl p-6">
              <div className="flex items-center gap-3 mb-6">
                <User className="w-6 h-6 text-sakura-500" />
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Profile
                </h2>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Name
                  </label>
                  <input
                    type="text"
                    value={personalInfo.name}
                    onChange={(e) => setPersonalInfo(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-4 py-2 rounded-lg bg-white/50 border border-gray-200 focus:outline-none focus:border-sakura-300 dark:bg-gray-800/50 dark:border-gray-700 dark:text-gray-100"
                    placeholder="Your name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={personalInfo.email}
                    onChange={(e) => setPersonalInfo(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full px-4 py-2 rounded-lg bg-white/50 border border-gray-200 focus:outline-none focus:border-sakura-300 dark:bg-gray-800/50 dark:border-gray-700 dark:text-gray-100"
                    placeholder="your.email@example.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Avatar URL
                  </label>
                  <input
                    type="url"
                    value={personalInfo.avatar_url}
                    onChange={(e) => setPersonalInfo(prev => ({ ...prev, avatar_url: e.target.value }))}
                    className="w-full px-4 py-2 rounded-lg bg-white/50 border border-gray-200 focus:outline-none focus:border-sakura-300 dark:bg-gray-800/50 dark:border-gray-700 dark:text-gray-100"
                    placeholder="https://example.com/avatar.jpg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Wallpaper
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleSetWallpaper}
                      className="px-4 py-2 bg-sakura-500 text-white rounded-lg flex items-center gap-2"
                    >
                      <Image className="w-4 h-4" />
                      {wallpaperUrl ? 'Change Wallpaper' : 'Set Wallpaper'}
                    </button>
                    {wallpaperUrl && (
                      <button
                        onClick={handleClearWallpaper}
                        className="px-4 py-2 bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200 rounded-lg"
                      >
                        Clear Wallpaper
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* AI Services Tab */}
          {activeTab === 'api' && (
            <div className="space-y-6">
              {/* Providers Section */}
              <div className="glassmorphic rounded-xl p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <Bot className="w-6 h-6 text-sakura-500" />
                    <div>
                      <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                        AI Services
                      </h2>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Connect and manage your AI service providers
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setEditingProvider(null);
                        setNewProviderForm({
                          name: '',
                          type: 'openai',
                          baseUrl: '',
                          apiKey: '',
                          isEnabled: true
                        });
                        setShowAddProviderModal(true);
                      }}
                      className="px-4 py-2 bg-sakura-500 text-white rounded-lg hover:bg-sakura-600 transition-colors flex items-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Add Service
                    </button>
                  </div>
                </div>

                {/* Providers List */}
                {providersLoading ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-sakura-500"></div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {providers.map((provider) => {
                      const ProviderIcon = getProviderIcon(provider.type);
                      return (
                        <div
                          key={provider.id}
                          className={`group relative p-5 rounded-xl border transition-all duration-300 ${provider.isPrimary
                              ? 'border-sakura-200 dark:border-sakura-700 bg-gradient-to-br from-sakura-50/50 to-white/50 dark:from-sakura-900/20 dark:to-gray-800/50 shadow-lg shadow-sakura-100/50 dark:shadow-sakura-900/20'
                              : 'border-gray-200/60 dark:border-gray-700/60 bg-white/40 dark:bg-gray-800/40 hover:border-gray-300/80 dark:hover:border-gray-600/80'
                            } hover:shadow-lg hover:shadow-gray-100/50 dark:hover:shadow-gray-900/20 backdrop-blur-sm`}
                        >
                          {/* Primary indicator - subtle glow */}
                          {provider.isPrimary && (
                            <div className="absolute -inset-0.5 bg-gradient-to-r from-sakura-400/20 to-sakura-600/20 rounded-xl blur-sm -z-10"></div>
                          )}

                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4 flex-1">
                              <div className={`relative w-14 h-14 rounded-xl flex items-center justify-center transition-all duration-300 ${provider.isEnabled
                                  ? provider.isPrimary
                                    ? 'bg-sakura-100/80 dark:bg-sakura-900/40 border-2 border-sakura-200 dark:border-sakura-700'
                                    : 'bg-sakura-50/60 dark:bg-sakura-900/20 border border-sakura-200/50 dark:border-sakura-700/50'
                                  : 'bg-gray-100/80 dark:bg-gray-700/80 border border-gray-200 dark:border-gray-600'
                                }`}>
                                <ProviderIcon className={`w-7 h-7 ${provider.isEnabled
                                    ? 'text-sakura-600 dark:text-sakura-400'
                                    : 'text-gray-500 dark:text-gray-400'
                                  }`} />
                                {provider.isPrimary && (
                                  <div className="absolute -top-1 -right-1 w-5 h-5 bg-gradient-to-br from-emerald-400 to-emerald-500 rounded-full flex items-center justify-center shadow-lg">
                                    <Check className="w-3 h-3 text-white" />
                                  </div>
                                )}
                              </div>

                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-3 mb-1">
                                  <h4 className={`font-semibold transition-colors ${provider.isPrimary
                                      ? 'text-gray-900 dark:text-white'
                                      : 'text-gray-800 dark:text-gray-200'
                                    }`}>
                                    {provider.name}
                                  </h4>
                                  {provider.isPrimary && (
                                    <span className="px-2.5 py-1 bg-gradient-to-r from-emerald-100 to-emerald-50 dark:from-emerald-900/30 dark:to-emerald-800/30 text-emerald-700 dark:text-emerald-300 text-xs font-medium rounded-full border border-emerald-200/50 dark:border-emerald-700/50">
                                      Default
                                    </span>
                                  )}
                                  {!provider.isEnabled && (
                                    <span className="px-2.5 py-1 bg-gray-100/80 dark:bg-gray-800/80 text-gray-600 dark:text-gray-400 text-xs font-medium rounded-full">
                                      Disabled
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm text-gray-600 dark:text-gray-400 font-mono truncate">
                                  {provider.baseUrl || 'No URL configured'}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-500 capitalize font-medium">
                                  {provider.type.replace('-', ' ')}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-4 ml-4">
                              {/* Elegant Default Toggle */}
                              <div className="flex flex-col items-center gap-1">
                                <button
                                  onClick={() => handleSetPrimary(provider.id, !provider.isPrimary)}
                                  disabled={!provider.isEnabled}
                                  className={`relative w-12 h-6 rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-sakura-300 focus:ring-offset-2 dark:focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed ${provider.isPrimary
                                      ? 'bg-gradient-to-r from-emerald-400 to-emerald-500 shadow-lg shadow-emerald-500/25'
                                      : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600'
                                    }`}
                                >
                                  <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-all duration-300 flex items-center justify-center ${provider.isPrimary ? 'translate-x-6' : 'translate-x-0'
                                    }`}>
                                    {provider.isPrimary && (
                                      <Check className="w-3 h-3 text-emerald-500" />
                                    )}
                                  </div>
                                </button>
                                <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                                  Default
                                </span>
                              </div>

                              {/* Test Button for Ollama */}
                              {provider.type === 'ollama' && provider.baseUrl && (
                                <button
                                  onClick={() => testOllamaConnection(provider.id, provider.baseUrl!)}
                                  disabled={testingProvider === provider.id}
                                  className={`px-3 py-2 text-sm rounded-lg transition-all duration-200 disabled:opacity-50 flex items-center gap-2 font-medium ${testResults[provider.id] === 'success'
                                      ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700/50 shadow-sm'
                                      : testResults[provider.id] === 'error'
                                        ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-700/50 shadow-sm'
                                        : 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 border border-blue-200 dark:border-blue-700/50'
                                    }`}
                                >
                                  {testingProvider === provider.id ? (
                                    <>
                                      <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                                      Testing...
                                    </>
                                  ) : testResults[provider.id] === 'success' ? (
                                    <>
                                      <Check className="w-3 h-3" />
                                      Connected
                                    </>
                                  ) : testResults[provider.id] === 'error' ? (
                                    <>
                                      <X className="w-3 h-3" />
                                      Failed
                                    </>
                                  ) : (
                                    <>
                                      <Server className="w-3 h-3" />
                                      Test
                                    </>
                                  )}
                                </button>
                              )}

                              <button
                                onClick={() => handleEditProvider(provider)}
                                className="p-2.5 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors rounded-lg hover:bg-gray-100/50 dark:hover:bg-gray-700/50"
                                title="Edit provider"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>

                              {provider.type !== 'claras-pocket' && (
                                <button
                                  onClick={() => setShowDeleteConfirm(provider.id)}
                                  className="p-2.5 text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400 transition-colors rounded-lg hover:bg-red-50/50 dark:hover:bg-red-900/20"
                                  title="Delete provider"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Image Generation Section */}
              <div className="glassmorphic rounded-xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <Image className="w-6 h-6 text-sakura-500" />
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                    Image Generation
                  </h2>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    ComfyUI Server URL
                  </label>
                  <input
                    type="url"
                    value={apiConfig.comfyui_base_url}
                    onChange={(e) => setApiConfig(prev => ({ ...prev, comfyui_base_url: e.target.value }))}
                    className="w-full px-4 py-2 rounded-lg bg-white/50 border border-gray-200 focus:outline-none focus:border-sakura-300 dark:bg-gray-800/50 dark:border-gray-700 dark:text-gray-100"
                    placeholder="http://localhost:8188"
                  />
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Connect to your ComfyUI instance for AI image generation
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* General Preferences Tab */}
          {activeTab === 'preferences' && (
            <div className="space-y-6">
              {/* General Settings */}
              <div className="glassmorphic rounded-xl p-6">
                <div className="flex items-center gap-3 mb-6">
                  <SettingsIcon className="w-6 h-6 text-sakura-500" />
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                    General Settings
                  </h2>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Theme
                    </label>
                    <select
                      value={personalInfo.theme_preference}
                      onChange={handleThemeChange}
                      className="w-full px-4 py-2 rounded-lg bg-white/50 border border-gray-200 focus:outline-none focus:border-sakura-300 dark:bg-gray-800/50 dark:border-gray-700 dark:text-gray-100"
                    >
                      <option value="light">Light</option>
                      <option value="dark">Dark</option>
                      <option value="system">System</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Timezone
                    </label>
                    <select
                      value={personalInfo.timezone}
                      onChange={(e) => setPersonalInfo(prev => ({ ...prev, timezone: e.target.value }))}
                      className="w-full px-4 py-2 rounded-lg bg-white/50 border border-gray-200 focus:outline-none focus:border-sakura-300 dark:bg-gray-800/50 dark:border-gray-700 dark:text-gray-100"
                    >
                      {timezoneOptions.map((tz: string) => (
                        <option key={tz} value={tz}>{tz}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Feature Configuration */}
              <div className="glassmorphic rounded-xl p-6">
                <div className="flex items-center gap-3 mb-6">
                  <Puzzle className="w-6 h-6 text-purple-500" />
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                      Feature Configuration
                    </h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Enable or disable features to optimize performance and resource usage
                    </p>
                  </div>
                </div>

                {featureConfigLoaded ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between py-2">
                      <div>
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          🤖 Clara Core
                        </label>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Core AI assistant functionality (Always enabled)
                        </p>
                      </div>
                      <div className="relative w-11 h-6 bg-green-500 rounded-full">
                        <div className="absolute top-0.5 right-0.5 w-5 h-5 bg-white rounded-full shadow-md flex items-center justify-center">
                          <Check className="w-3 h-3 text-green-500" />
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between py-2">
                      <div>
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          🎨 ComfyUI - Image Generation
                        </label>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          AI image generation with Stable Diffusion
                        </p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={featureConfig.comfyUI}
                          onChange={(e) => updateFeatureConfig({ comfyUI: e.target.checked })}
                          disabled={savingFeatureConfig}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300/20 dark:peer-focus:ring-purple-800/20 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-purple-600"></div>
                      </label>
                    </div>

                    <div className="flex items-center justify-between py-2">
                      <div>
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          ⚡ N8N - Workflow Automation
                        </label>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Visual workflow builder and automation
                        </p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={featureConfig.n8n}
                          onChange={(e) => updateFeatureConfig({ n8n: e.target.checked })}
                          disabled={savingFeatureConfig}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300/20 dark:peer-focus:ring-purple-800/20 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-purple-600"></div>
                      </label>
                    </div>

                    <div className="flex items-center justify-between py-2">
                      <div>
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          🧠 RAG & TTS - Advanced AI
                        </label>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Document analysis and text-to-speech capabilities
                        </p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={featureConfig.ragAndTts}
                          onChange={(e) => updateFeatureConfig({ ragAndTts: e.target.checked })}
                          disabled={savingFeatureConfig}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300/20 dark:peer-focus:ring-purple-800/20 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-purple-600"></div>
                      </label>
                    </div>

                    {savingFeatureConfig && (
                      <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-3">
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                          <span className="text-sm text-purple-700 dark:text-purple-300">
                            Saving feature configuration...
                          </span>
                        </div>
                      </div>
                    )}

                    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                        <div className="text-sm text-amber-700 dark:text-amber-300">
                          <strong>Note:</strong> Changes will take effect after restarting the application. 
                          Disabled features won't be loaded during startup, saving system resources.
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                      <button
                        onClick={async () => {
                          try {
                            if ((window as any).featureConfig?.resetFeatureConfig) {
                              const success = await (window as any).featureConfig.resetFeatureConfig();
                              if (success) {
                                // Reset to defaults
                                setFeatureConfig({
                                  comfyUI: true,
                                  n8n: true,
                                  ragAndTts: true,
                                  claraCore: true
                                });
                                alert('✅ Feature configuration reset to defaults. The feature selection screen will appear on next startup.');
                              } else {
                                alert('❌ No feature configuration found to reset.');
                              }
                            }
                          } catch (error) {
                            console.error('Failed to reset feature configuration:', error);
                            alert('❌ Failed to reset feature configuration.');
                          }
                        }}
                        className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors flex items-center gap-2"
                      >
                        <RotateCcw className="w-4 h-4" />
                        Reset to First-Time Setup
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500"></div>
                  </div>
                )}
              </div>

              {/* Startup Options */}
              <div className="glassmorphic rounded-xl p-6">
                <div className="flex items-center gap-3 mb-6">
                  <Power className="w-6 h-6 text-blue-500" />
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                    Startup Options
                  </h2>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between py-2">
                    <div>
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Auto Start Application
                      </label>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Start ClaraVerse automatically when system boots
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={startupConfig.autoStart}
                        onChange={(e) => updateStartupConfig({ autoStart: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300/20 dark:peer-focus:ring-blue-800/20 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between py-2">
                    <div>
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Start Minimized
                      </label>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Start the application in system tray
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={startupConfig.startMinimized}
                        onChange={(e) => updateStartupConfig({ startMinimized: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300/20 dark:peer-focus:ring-blue-800/20 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between py-2">
                    <div>
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Start Fullscreen
                      </label>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Launch application in fullscreen mode
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={startupConfig.startFullscreen}
                        onChange={(e) => updateStartupConfig({ startFullscreen: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300/20 dark:peer-focus:ring-blue-800/20 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between py-2">
                    <div>
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Check for Updates
                      </label>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Automatically check for application updates
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={startupConfig.checkForUpdates}
                        onChange={(e) => updateStartupConfig({ checkForUpdates: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300/20 dark:peer-focus:ring-blue-800/20 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between py-2">
                    <div>
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Restore Last Session
                      </label>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Restore previous session on startup
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={startupConfig.restoreLastSession}
                        onChange={(e) => updateStartupConfig({ restoreLastSession: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300/20 dark:peer-focus:ring-blue-800/20 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Local Models Tab */}
          {activeTab === 'models' && (
            <div className="space-y-6">
              {/* Model Manager Header with Sub-tabs */}
              <div className="glassmorphic rounded-xl p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <Brain className="w-6 h-6 text-sakura-500" />
                    <div>
                      <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                        Local Models
                      </h2>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Manage your locally installed AI models and hardware acceleration
                      </p>
                    </div>
                  </div>
                </div>

                {/* Sub-tabs */}
                <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700 -mb-6 pb-4">
                  <ModelTabItem
                    id="models"
                    label="Models"
                    isActive={activeModelTab === 'models'}
                  />
                  <ModelTabItem
                    id="gpu-diagnostics"
                    label="Hardware Acceleration"
                    isActive={activeModelTab === 'gpu-diagnostics'}
                  />
                </div>
              </div>

              {/* Model Tab Content */}
              {activeModelTab === 'models' && (
                <ModelManager />
              )}

              {/* GPU Diagnostics Tab Content */}
              {activeModelTab === 'gpu-diagnostics' && (
                <div className="glassmorphic rounded-xl p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <Zap className="w-6 h-6 text-amber-500" />
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        Hardware Acceleration
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Monitor GPU detection and optimize performance for faster inference
                      </p>
                    </div>
                  </div>

                  <GPUDiagnostics />
                </div>
              )}
            </div>
          )}

          {/* Extensions Tab */}
          {activeTab === 'mcp' && (
            <MCPSettings />
          )}

          {/* Tools Tab */}
          {activeTab === 'toolbelt' && (
            <ToolBelt />
          )}

          {/* Services Tab */}
          {activeTab === 'servers' && (
            <div className="space-y-6">
              {/* Service Management Header */}
              <div className="glassmorphic rounded-xl p-6">
                <div className="flex items-center gap-3 mb-6">
                  <Server className="w-6 h-6 text-blue-500" />
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                      Service Management
                    </h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Monitor and configure all ClaraVerse services
                    </p>
                  </div>
                </div>

                {/* Platform Info */}
                <div className="bg-blue-50/50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
                  <div className="flex items-center gap-3">
                    <Monitor className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    <div>
                      <h4 className="font-medium text-blue-900 dark:text-blue-100">
                        Platform: {getPlatformName(currentPlatform)}
                      </h4>
                      <p className="text-sm text-blue-700 dark:text-blue-300">
                        {currentPlatform === 'win32' 
                          ? 'All services support both Docker and Manual deployment modes'
                          : 'ComfyUI requires manual setup on macOS/Linux for optimal performance'
                        }
                      </p>
                    </div>
                  </div>
                </div>

                                {loadingServiceConfigs ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Clara Core Service - Always running */}
                    <div className="p-6 bg-gradient-to-r from-emerald-50/50 to-green-50/50 dark:from-emerald-900/20 dark:to-green-900/20 rounded-xl border border-emerald-200 dark:border-emerald-700">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-4">
                          <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-900/40 border-2 border-emerald-200 dark:border-emerald-700 rounded-xl flex items-center justify-center">
                            <Bot className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                              Clara Core
                              <span className="px-2 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-xs font-medium rounded-full">
                                Built-in
                              </span>
                            </h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              AI engine with local model management and llama.cpp
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="px-3 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-xs font-medium rounded-full">
                            Always Running
                          </span>
                          <span className="px-3 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-xs font-medium rounded-full">
                            Built-in
                          </span>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                            <span className="text-sm text-gray-600 dark:text-gray-400">
                              Status: Running on <span className="font-mono text-xs">localhost:8091</span>
                            </span>
                          </div>
                          <button
                            onClick={() => window.open('http://localhost:8091', '_blank')}
                            className="px-3 py-1 bg-emerald-500 text-white rounded text-sm hover:bg-emerald-600 transition-colors flex items-center gap-1"
                          >
                            <ExternalLink className="w-3 h-3" />
                            Open
                          </button>
                        </div>
                        
                        {/* Configuration Details */}
                        <div className="pt-3 border-t border-emerald-200 dark:border-emerald-700">
                          <div className="grid grid-cols-2 gap-4 text-xs">
                            <div>
                              <span className="text-gray-500 dark:text-gray-400">Deployment:</span>
                              <span className="ml-1 text-emerald-700 dark:text-emerald-300 font-medium">Native Binary</span>
                            </div>
                            <div>
                              <span className="text-gray-500 dark:text-gray-400">Engine:</span>
                              <span className="ml-1 text-emerald-700 dark:text-emerald-300 font-medium">llama.cpp</span>
                            </div>
                            <div>
                              <span className="text-gray-500 dark:text-gray-400">Auto-Start:</span>
                              <span className="ml-1 text-emerald-700 dark:text-emerald-300 font-medium">Yes</span>
                            </div>
                            <div>
                              <span className="text-gray-500 dark:text-gray-400">Configurable:</span>
                              <span className="ml-1 text-gray-500 dark:text-gray-400 font-medium">No</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Python Backend Service */}
                    <div className={`p-6 rounded-xl border ${
                      enhancedServiceStatus?.['python-backend']?.state === 'running' || dockerServices?.pythonAvailable 
                        ? 'bg-gradient-to-r from-blue-50/50 to-indigo-50/50 dark:from-blue-900/20 dark:to-indigo-900/20 border-blue-200 dark:border-blue-700'
                        : 'bg-gradient-to-r from-gray-50/50 to-gray-50/50 dark:from-gray-800/50 dark:to-gray-800/50 border-gray-200 dark:border-gray-700'
                    }`}>
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-4">
                          <div className={`w-14 h-14 rounded-xl flex items-center justify-center border-2 ${
                            enhancedServiceStatus?.['python-backend']?.state === 'running' || dockerServices?.pythonAvailable
                              ? 'bg-blue-100 dark:bg-blue-900/40 border-blue-200 dark:border-blue-700'
                              : 'bg-gray-100 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600'
                          }`}>
                            <Code className={`w-7 h-7 ${
                              enhancedServiceStatus?.['python-backend']?.state === 'running' || dockerServices?.pythonAvailable 
                                ? 'text-blue-600 dark:text-blue-400' 
                                : 'text-gray-500 dark:text-gray-400'
                            }`} />
                          </div>
                          <div>
                            <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                              Python Backend
                              <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-medium rounded-full">
                                Critical
                              </span>
                            </h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              RAG, TTS, STT, and document processing services
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                            enhancedServiceStatus?.['python-backend']?.state === 'running' || dockerServices?.pythonAvailable 
                              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                              : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                          }`}>
                            {enhancedServiceStatus?.['python-backend']?.state === 'running' || dockerServices?.pythonAvailable ? 'Running' : 'Stopped'}
                          </span>
                          <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-medium rounded-full">
                            Docker
                          </span>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${
                              enhancedServiceStatus?.['python-backend']?.state === 'running' || dockerServices?.pythonAvailable ? 'bg-green-500' : 'bg-red-500'
                            }`}></div>
                            <span className="text-sm text-gray-600 dark:text-gray-400">
                              Status: {enhancedServiceStatus?.['python-backend']?.state === 'running' || dockerServices?.pythonAvailable ? 'Running' : 'Stopped'}
                              {(enhancedServiceStatus?.['python-backend']?.state === 'running' || dockerServices?.pythonAvailable) && (
                                <span className="ml-2 font-mono text-xs">
                                  {enhancedServiceStatus?.['python-backend']?.serviceUrl || 'localhost:5001'}
                                </span>
                              )}
                            </span>
                          </div>
                          {(enhancedServiceStatus?.['python-backend']?.state === 'running' || dockerServices?.pythonAvailable) && (
                            <button
                              onClick={() => window.open(enhancedServiceStatus?.['python-backend']?.serviceUrl || 'http://localhost:5001', '_blank')}
                              className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 transition-colors flex items-center gap-1"
                            >
                              <ExternalLink className="w-3 h-3" />
                              Open
                            </button>
                          )}
                        </div>
                        
                        {/* Configuration Details */}
                        <div className="pt-3 border-t border-blue-200 dark:border-blue-700">
                          <div className="grid grid-cols-2 gap-4 text-xs">
                            <div>
                              <span className="text-gray-500 dark:text-gray-400">Deployment:</span>
                              <span className="ml-1 text-blue-700 dark:text-blue-300 font-medium">Docker Container</span>
                            </div>
                            <div>
                              <span className="text-gray-500 dark:text-gray-400">Services:</span>
                              <span className="ml-1 text-blue-700 dark:text-blue-300 font-medium">RAG, TTS, STT</span>
                            </div>
                            <div>
                              <span className="text-gray-500 dark:text-gray-400">Auto-Start:</span>
                              <span className="ml-1 text-blue-700 dark:text-blue-300 font-medium">Yes</span>
                            </div>
                            <div>
                              <span className="text-gray-500 dark:text-gray-400">Configurable:</span>
                              <span className="ml-1 text-gray-500 dark:text-gray-400 font-medium">No</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* All Configurable Services: N8N and ComfyUI */}
                    {['n8n', 'comfyui'].map((serviceName) => {
                      const config = serviceConfigs[serviceName] || { mode: 'docker', url: null };
                      const compatibility = platformCompatibility[serviceName] || {};
                      const status = enhancedServiceStatus[serviceName] || {};
                      const testResult = serviceTestResults[serviceName];
                      const isComfyUI = serviceName === 'comfyui';
                      const isManualOnly = isComfyUI && currentPlatform !== 'win32';
                      
                      // Debug logging for each service
                      console.log(`🔍 Service ${serviceName}:`, { status, config, serviceUrl: status.serviceUrl });

                                                return (
                        <div key={serviceName} className="p-6 bg-white/50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700">
                          {/* Service Header */}
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                                status.state === 'running' 
                                  ? 'bg-green-100 dark:bg-green-900/30 border-2 border-green-200 dark:border-green-700'
                                  : 'bg-gray-100 dark:bg-gray-700/50 border-2 border-gray-200 dark:border-gray-600'
                              }`}>
                                {isComfyUI ? (
                                  <Image className={`w-6 h-6 ${status.state === 'running' ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`} />
                                ) : (
                                  <Zap className={`w-6 h-6 ${status.state === 'running' ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`} />
                                )}
                              </div>
                              <div>
                                <h3 className="font-semibold text-gray-900 dark:text-white">
                                  {serviceName === 'comfyui' ? 'ComfyUI Image Generation' : 'N8N Workflow Automation'}
                                </h3>
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                  {serviceName === 'comfyui' 
                                    ? 'AI image generation with Stable Diffusion'
                                    : 'Visual workflow builder and automation platform'
                                  }
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                                status.state === 'running' 
                                  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                              }`}>
                                {status.state === 'running' ? 'Running' : 'Stopped'}
                              </span>
                              {config.mode && (
                                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                                  config.mode === 'docker' 
                                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                                    : 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                                }`}>
                                  {config.mode === 'docker' ? 'Docker' : 'Manual'}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Platform Restriction Warning for ComfyUI */}
                          {isManualOnly && (
                            <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                              <div className="flex items-center gap-2">
                                <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                                <p className="text-sm text-amber-700 dark:text-amber-300">
                                  <strong>Platform Limitation:</strong> ComfyUI Docker mode is only supported on Windows. 
                                  {currentPlatform === 'darwin' ? ' On macOS, please use manual setup.' : ' On Linux, please use manual setup.'}
                                </p>
                              </div>
                            </div>
                          )}

                          {/* Service Configuration */}
                          <div className="space-y-4">
                            {/* Deployment Mode Selection */}
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Deployment Mode
                              </label>
                              <div className="flex gap-3">
                                {/* Docker Mode */}
                                <button
                                  onClick={() => {
                                    if (!isManualOnly) {
                                      // Docker mode can be saved immediately since it doesn't need a URL
                                      updateServiceConfig(serviceName, 'docker');
                                    }
                                  }}
                                  disabled={isManualOnly}
                                  className={`flex-1 p-3 rounded-lg border transition-all ${
                                    config.mode === 'docker'
                                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                                      : isManualOnly
                                        ? 'border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800/50 text-gray-400 dark:text-gray-600 cursor-not-allowed'
                                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-700 dark:text-gray-300'
                                  }`}
                                >
                                  <div className="flex items-center gap-2">
                                    <HardDrive className="w-4 h-4" />
                                    <span className="font-medium">Docker</span>
                                  </div>
                                  <p className="text-xs mt-1 text-left">
                                    Managed containers with automatic setup
                                  </p>
                                </button>

                                {/* Manual Mode */}
                                <button
                                  onClick={() => {
                                    // Update local state to show manual mode UI and prefill existing URL
                                    setServiceConfigs((prev: any) => ({
                                      ...prev,
                                      [serviceName]: { ...prev[serviceName], mode: 'manual' }
                                    }));
                                    
                                    // Prefill temp URL with existing saved URL if it exists
                                    if (config.url && !tempServiceUrls[serviceName]) {
                                      setTempServiceUrls(prev => ({
                                        ...prev,
                                        [serviceName]: config.url
                                      }));
                                    }
                                  }}
                                  className={`flex-1 p-3 rounded-lg border transition-all ${
                                    config.mode === 'manual'
                                      ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300'
                                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-700 dark:text-gray-300'
                                  }`}
                                >
                                  <div className="flex items-center gap-2">
                                    <ExternalLink className="w-4 h-4" />
                                    <span className="font-medium">Manual</span>
                                  </div>
                                  <p className="text-xs mt-1 text-left">
                                    External service with custom URL
                                  </p>
                                </button>
                              </div>
                            </div>

                            {/* Manual Service URL Configuration */}
                            {config.mode === 'manual' && (
                              <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                  Service URL
                                  {config.url ? (
                                    <span className="ml-2 text-xs text-green-600 dark:text-green-400 font-normal">
                                      ✓ Saved: <span className="font-mono">{config.url}</span>
                                    </span>
                                  ) : (
                                    <span className="ml-2 text-xs text-orange-600 dark:text-orange-400 font-normal">
                                      (Required - Enter URL and click Save)
                                    </span>
                                  )}
                                </label>
                                
                                {/* URL Input */}
                                <div className="space-y-3">
                                  <div className="flex gap-2">
                                    <input
                                      type="url"
                                      value={tempServiceUrls[serviceName] !== undefined && tempServiceUrls[serviceName] !== '' 
                                        ? tempServiceUrls[serviceName] 
                                        : config.url || ''
                                      }
                                      onChange={(e) => {
                                        setTempServiceUrls(prev => ({
                                          ...prev,
                                          [serviceName]: e.target.value
                                        }));
                                      }}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          saveManualServiceUrl(serviceName);
                                        }
                                      }}
                                      className="flex-1 px-3 py-2 rounded-lg bg-white/50 border border-gray-200 focus:outline-none focus:border-purple-300 dark:bg-gray-800/50 dark:border-gray-700 dark:text-gray-100"
                                      placeholder={serviceName === 'comfyui' 
                                        ? 'http://localhost:8188' 
                                        : serviceName === 'n8n' 
                                          ? 'http://localhost:5678'
                                          : 'http://localhost:8080'
                                      }
                                    />
                                    
                                    {/* Save Button */}
                                    <button
                                      onClick={() => saveManualServiceUrl(serviceName)}
                                      disabled={savingServiceConfig[serviceName] || 
                                        !(tempServiceUrls[serviceName] !== undefined 
                                          ? tempServiceUrls[serviceName].trim()
                                          : config.url?.trim()
                                        )
                                      }
                                      className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 font-medium ${
                                        tempServiceUrls[serviceName] && tempServiceUrls[serviceName] !== config.url
                                          ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-700 hover:bg-orange-200 dark:hover:bg-orange-900/50'
                                          : 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-700 hover:bg-purple-200 dark:hover:bg-purple-900/50'
                                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                                    >
                                      {savingServiceConfig[serviceName] ? (
                                        <>
                                          <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                                          Saving...
                                        </>
                                      ) : tempServiceUrls[serviceName] && tempServiceUrls[serviceName] !== config.url ? (
                                        <>
                                          <Save className="w-4 h-4" />
                                          Save Changes
                                        </>
                                      ) : (
                                        <>
                                          <Save className="w-4 h-4" />
                                          Save URL
                                        </>
                                      )}
                                    </button>
                                  </div>

                                  {/* Action Buttons */}
                                  <div className="flex gap-2">
                                    {/* Test Connection Button */}
                                    {(config.url || tempServiceUrls[serviceName]) && (
                                      <button
                                        onClick={() => {
                                          const urlToTest = tempServiceUrls[serviceName] || config.url;
                                          testManualService(serviceName, urlToTest);
                                        }}
                                        disabled={testingServices[serviceName]}
                                        className={`flex-1 px-3 py-2 rounded-lg transition-all flex items-center justify-center gap-2 font-medium ${
                                          testResult?.success === true
                                            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-700'
                                            : testResult?.success === false
                                              ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-700'
                                              : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/50 border border-blue-200 dark:border-blue-700'
                                        } disabled:opacity-50`}
                                      >
                                        {testingServices[serviceName] ? (
                                          <>
                                            <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                                            Testing Connection...
                                          </>
                                        ) : testResult?.success === true ? (
                                          <>
                                            <Check className="w-4 h-4" />
                                            Connection Successful
                                          </>
                                        ) : testResult?.success === false ? (
                                          <>
                                            <X className="w-4 h-4" />
                                            Connection Failed
                                          </>
                                        ) : (
                                          <>
                                            <Server className="w-4 h-4" />
                                            Test Connection
                                          </>
                                        )}
                                      </button>
                                    )}

                                    {/* Clear Button */}
                                    {(tempServiceUrls[serviceName] || config.url) && (
                                      <button
                                        onClick={async () => {
                                          // Clear both temp URL and saved configuration
                                          setTempServiceUrls(prev => ({ ...prev, [serviceName]: '' }));
                                          await updateServiceConfig(serviceName, 'manual', '');
                                          
                                          // Show feedback
                                          setServiceTestResults(prev => ({ 
                                            ...prev, 
                                            [serviceName]: { 
                                              success: true, 
                                              message: 'URL cleared successfully',
                                              timestamp: Date.now()
                                            }
                                          }));
                                          
                                          // Clear feedback after 3 seconds
                                          setTimeout(() => {
                                            setServiceTestResults(prev => ({ ...prev, [serviceName]: null }));
                                          }, 3000);
                                        }}
                                        className="px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex items-center gap-2"
                                      >
                                        <X className="w-3 h-3" />
                                        Clear
                                      </button>
                                    )}
                                  </div>

                                  {/* Status Messages */}
                                  {testResult && (
                                    <div className={`p-2 rounded-lg text-sm ${
                                      testResult.success === true
                                        ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-700'
                                        : testResult.success === false
                                          ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-700'
                                          : 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700'
                                    }`}>
                                      {testResult.success === true ? (
                                        <div className="flex items-center gap-2">
                                          <Check className="w-4 h-4" />
                                          <span>{testResult.message || 'Service is accessible and responding correctly!'}</span>
                                        </div>
                                      ) : testResult.success === false ? (
                                        <div className="flex items-center gap-2">
                                          <X className="w-4 h-4" />
                                          <span>Error: {testResult.error}</span>
                                        </div>
                                      ) : null}
                                    </div>
                                  )}

                                  {/* URL Format Help */}
                                  <div className="text-xs text-gray-500 dark:text-gray-400">
                                    <p><strong>Expected format:</strong> http://localhost:port or https://your-domain.com</p>
                                    <p><strong>Default ports:</strong> ComfyUI (8188), N8N (5678)</p>
                                    <p><strong>Tip:</strong> Press Enter to save quickly</p>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Service Status and Controls */}
                            {config.mode && (
                              <div className="pt-3 border-t border-gray-200 dark:border-gray-700 space-y-3">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <div className={`w-2 h-2 rounded-full ${status.state === 'running' ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                                    <span className="text-sm text-gray-600 dark:text-gray-400">
                                      Status: {status.state === 'running' ? 'Running' : 'Stopped'}
                                      {(status.serviceUrl || (config.mode === 'manual' && config.url)) && (
                                        <span className="ml-2 font-mono text-xs">
                                          {status.serviceUrl || config.url}
                                        </span>
                                      )}
                                    </span>
                                  </div>
                                  <div className="flex gap-2">
                                    {status.serviceUrl && status.state === 'running' && (
                                      <button
                                        onClick={() => window.open(status.serviceUrl, '_blank')}
                                        className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 transition-colors flex items-center gap-1"
                                      >
                                        <ExternalLink className="w-3 h-3" />
                                        Open
                                      </button>
                                    )}
                                    {/* Restart Button for Restartable Services */}
                                    {status.canRestart && (
                                      <button
                                        onClick={async () => {
                                          try {
                                            setTestingServices(prev => ({ ...prev, [`${serviceName}_restart`]: true }));
                                            
                                            // Call restart service
                                            const result = await (window as any).electron?.restartDockerService?.(
                                              serviceName === 'comfyui' ? 'comfyui' : 
                                              serviceName === 'n8n' ? 'n8n_workflowmanager' : serviceName
                                            );
                                            
                                            if (result?.success) {
                                              setServiceTestResults(prev => ({ 
                                                ...prev, 
                                                [serviceName]: { 
                                                  success: true, 
                                                  message: `${serviceName.toUpperCase()} restarted successfully!`,
                                                  timestamp: Date.now()
                                                }
                                              }));
                                              
                                              // Reload service status after restart
                                              setTimeout(() => {
                                                loadServiceConfigurations();
                                              }, 2000);
                                            } else {
                                              throw new Error(result?.error || 'Restart failed');
                                            }
                                          } catch (error) {
                                            console.error(`Failed to restart ${serviceName}:`, error);
                                            setServiceTestResults(prev => ({ 
                                              ...prev, 
                                              [serviceName]: { 
                                                success: false, 
                                                error: error instanceof Error ? error.message : String(error),
                                                timestamp: Date.now()
                                              }
                                            }));
                                          } finally {
                                            setTestingServices(prev => ({ ...prev, [`${serviceName}_restart`]: false }));
                                            
                                            // Clear result after 5 seconds
                                            setTimeout(() => {
                                              setServiceTestResults(prev => ({ ...prev, [serviceName]: null }));
                                            }, 5000);
                                          }
                                        }}
                                        disabled={testingServices[`${serviceName}_restart`]}
                                        className={`px-3 py-1 rounded text-sm transition-colors flex items-center gap-1 ${
                                          status.state === 'running'
                                            ? 'bg-orange-500 text-white hover:bg-orange-600'
                                            : 'bg-green-500 text-white hover:bg-green-600'
                                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                                      >
                                        {testingServices[`${serviceName}_restart`] ? (
                                          <>
                                            <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                            Restarting...
                                          </>
                                        ) : (
                                          <>
                                            <Power className="w-3 h-3" />
                                            {status.state === 'running' ? 'Restart' : 'Start'}
                                          </>
                                        )}
                                      </button>
                                    )}
                                    <button
                                      onClick={() => resetServiceConfig(serviceName)}
                                      className="px-3 py-1 bg-gray-500 text-white rounded text-sm hover:bg-gray-600 transition-colors flex items-center gap-1"
                                    >
                                      <RotateCcw className="w-3 h-3" />
                                      Reset
                                    </button>
                                  </div>
                                </div>
                                
                                {/* Configuration Details */}
                                <div className="grid grid-cols-2 gap-4 text-xs">
                                  <div>
                                    <span className="text-gray-500 dark:text-gray-400">Deployment:</span>
                                    <span className={`ml-1 font-medium ${
                                      config.mode === 'docker' 
                                        ? 'text-blue-700 dark:text-blue-300' 
                                        : 'text-purple-700 dark:text-purple-300'
                                    }`}>
                                      {config.mode === 'docker' ? 'Docker Container' : 'Manual Setup'}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-gray-500 dark:text-gray-400">Service Type:</span>
                                    <span className="ml-1 text-gray-700 dark:text-gray-300 font-medium">
                                      {serviceName === 'comfyui' ? 'Image Generation' : 'Workflow Automation'}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-gray-500 dark:text-gray-400">URL Source:</span>
                                    <span className="ml-1 text-gray-700 dark:text-gray-300 font-medium">
                                      {config.mode === 'docker' ? 'Auto-detected' : (config.url ? `Manual: ${config.url}` : 'Not set')}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-gray-500 dark:text-gray-400">Configurable:</span>
                                    <span className="ml-1 text-green-700 dark:text-green-300 font-medium">Yes</span>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>


            </div>
          )}

          {/* SDK Code Export Demo Tab */}
          {activeTab === 'sdk-demo' && (
            <div className="glassmorphic rounded-xl p-6">
              <div className="flex items-center gap-3 mb-6">
                <Zap className="w-6 h-6 text-purple-500" />
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                    Export as Code
                  </h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Generate ready-to-use JavaScript code from your flows
                  </p>
                </div>
              </div>

              {/* Feature Overview */}
              <div className="bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 rounded-lg p-6 mb-6">
                <h3 className="text-lg font-semibold text-purple-900 dark:text-purple-100 mb-3">
                  🚀 Export Your Flows as JavaScript Code
                </h3>
                <p className="text-purple-700 dark:text-purple-300 mb-4">
                  Transform your Clara flows into ready-to-use JavaScript modules that can be directly integrated into any application using the Clara Flow SDK.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white/50 dark:bg-gray-800/50 rounded-lg p-4">
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-2">✨ What You Get</h4>
                    <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-1">
                      <li>• Complete JavaScript class</li>
                      <li>• Embedded flow definition</li>
                      <li>• Custom node implementations</li>
                      <li>• Ready-to-use methods</li>
                      <li>• TypeScript-friendly</li>
                    </ul>
                  </div>

                  <div className="bg-white/50 dark:bg-gray-800/50 rounded-lg p-4">
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-2">🎯 Use Cases</h4>
                    <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-1">
                      <li>• Embed in web applications</li>
                      <li>• Server-side processing</li>
                      <li>• Microservices integration</li>
                      <li>• Batch processing scripts</li>
                      <li>• Custom workflow engines</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Usage Example */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                  📝 Generated Code Example
                </h3>
                <div className="bg-gray-900 dark:bg-gray-950 rounded-lg p-4 text-sm font-mono overflow-x-auto">
                  <pre className="text-green-400">
                    {`// Generated by Clara Agent Studio
import { ClaraFlowRunner } from 'clara-flow-sdk';

export class MyAwesomeFlow {
  constructor(options = {}) {
    this.runner = new ClaraFlowRunner({
      enableLogging: true,
      logLevel: 'info',
      ...options
    });
    
    this.flowData = {
      // Complete flow definition embedded here
      nodes: [...],
      connections: [...],
      customNodes: [...]
    };
    
    this.registerCustomNodes();
  }

  async execute(inputs = {}) {
    return await this.runner.executeFlow(this.flowData, inputs);
  }

  async executeBatch(inputSets, options = {}) {
    // Batch processing with concurrency control
    const results = [];
    for (const inputs of inputSets) {
      results.push(await this.execute(inputs));
    }
    return results;
  }
}

// Export for direct use
export const myAwesomeFlow = new MyAwesomeFlow();
export default MyAwesomeFlow;`}
                  </pre>
                </div>
              </div>

              {/* How to Use */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                  🛠️ How to Export as Code
                </h3>
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
                  <ol className="text-sm text-blue-800 dark:text-blue-200 space-y-2">
                    <li><strong>1.</strong> Create your flow in Agent Studio</li>
                    <li><strong>2.</strong> Click the Export dropdown in the toolbar</li>
                    <li><strong>3.</strong> Select "Export as Code" (JavaScript)</li>
                    <li><strong>4.</strong> Save the generated .js file</li>
                    <li><strong>5.</strong> Install the SDK: <code className="bg-blue-100 dark:bg-blue-900/50 px-2 py-1 rounded">npm install clara-flow-sdk</code></li>
                    <li><strong>6.</strong> Import and use in your application!</li>
                  </ol>
                </div>
              </div>

              {/* Integration Examples */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Node.js Server</h4>
                  <div className="bg-gray-900 dark:bg-gray-950 rounded-lg p-3 text-xs font-mono overflow-x-auto">
                    <pre className="text-yellow-400">
                      {`import { myFlow } from './my-flow.js';

app.post('/process', async (req, res) => {
  const result = await myFlow.execute({
    input: req.body.message
  });
  res.json(result);
});`}
                    </pre>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-3">React Component</h4>
                  <div className="bg-gray-900 dark:bg-gray-950 rounded-lg p-3 text-xs font-mono overflow-x-auto">
                    <pre className="text-cyan-400">
                      {`import { myFlow } from './my-flow.js';

const ProcessButton = () => {
  const handleClick = async () => {
    const result = await myFlow.execute({
      userInput: "Hello World"
    });
    console.log(result);
  };
  
  return <button onClick={handleClick}>
    Process
  </button>;
};`}
                    </pre>
                  </div>
                </div>
              </div>

              {/* Benefits */}
              <div className="mt-6 bg-green-50 dark:bg-green-900/20 rounded-lg p-4 border border-green-200 dark:border-green-800">
                <h4 className="font-semibold text-green-900 dark:text-green-100 mb-2">
                  ✅ Why Export as Code?
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-green-800 dark:text-green-200">
                  <div>
                    <strong>🚀 Zero Dependencies</strong><br />
                    Everything embedded in the generated code
                  </div>
                  <div>
                    <strong>⚡ High Performance</strong><br />
                    No JSON parsing or flow loading overhead
                  </div>
                  <div>
                    <strong>🔧 Easy Integration</strong><br />
                    Drop into any JavaScript project
                  </div>
                </div>
              </div>

              {/* View Integration Examples */}
              <div className="mt-6">
                <button
                  onClick={() => window.open('/settings?tab=sdk-demo', '_blank')}
                  className="flex items-center gap-2 text-purple-700 dark:text-purple-300 hover:text-purple-900 dark:hover:text-purple-100 transition-colors"
                >
                  <ExternalLink className="w-3 h-3" />
                  View integration examples
                </button>
              </div>
            </div>
          )}

          {/* Updates Tab */}
          {activeTab === 'updates' && (
            <div className="glassmorphic rounded-xl p-6">
              <div className="flex items-center gap-3 mb-6">
                <Download className="w-6 h-6 text-sakura-500" />
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                    Updates
                  </h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Keep Clara up to date with the latest features and improvements
                  </p>
                </div>
              </div>

              {/* Current Version Info */}
              <div className="bg-white/50 dark:bg-gray-800/50 rounded-lg p-4 mb-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-white mb-1">
                      Current Version
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Clara {updateInfo?.currentVersion || '1.0.0'} on {updateInfo ? getPlatformName(updateInfo.platform) : 'Unknown Platform'}
                    </p>
                  </div>
                  <button
                    onClick={handleManualUpdateCheck}
                    disabled={checkingUpdates}
                    className="px-4 py-2 bg-sakura-500 text-white rounded-lg hover:bg-sakura-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                  >
                    {checkingUpdates ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Checking...
                      </>
                    ) : (
                      <>
                        <RotateCcw className="w-4 h-4" />
                        Check for Updates
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Update Status */}
              {updateInfo && (
                <div className="space-y-4">
                  {updateInfo.error ? (
                    <div className="bg-red-50/50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                      <div className="flex items-center gap-3">
                        <AlertCircle className="w-5 h-5 text-red-500" />
                        <div>
                          <h4 className="font-medium text-red-900 dark:text-red-100">
                            Update Check Failed
                          </h4>
                          <p className="text-sm text-red-700 dark:text-red-300">
                            {updateInfo.error}
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : updateInfo.hasUpdate ? (
                    <div className="bg-blue-50/50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/40 rounded-full flex items-center justify-center">
                          <Download className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                            New Version Available: Clara {updateInfo.latestVersion || 'Unknown'}
                          </h4>

                          {/* Platform-specific messaging */}
                          {updateInfo.isOTASupported ? (
                            <div className="space-y-3">
                              <p className="text-sm text-blue-700 dark:text-blue-300">
                                🍎 Automatic updates are supported on macOS. Click "Download & Install" to update Clara automatically.
                              </p>
                              <div className="flex gap-3">
                                <button
                                  onClick={handleManualUpdateCheck}
                                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2"
                                >
                                  <Download className="w-4 h-4" />
                                  Download & Install
                                </button>
                                {updateInfo.releaseUrl && (
                                  <button
                                    onClick={openReleaseNotes}
                                    className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex items-center gap-2"
                                  >
                                    <ExternalLink className="w-4 h-4" />
                                    Release Notes
                                  </button>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-3">
                              <p className="text-sm text-blue-700 dark:text-blue-300">
                                🔒 On {getPlatformName(updateInfo.platform)}, updates need to be installed manually for security reasons.
                                Click "Download Now" to get the latest version.
                              </p>
                              <div className="flex gap-3">
                                <button
                                  onClick={downloadUpdate}
                                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2"
                                >
                                  <ExternalLink className="w-4 h-4" />
                                  Download Now
                                </button>
                                {updateInfo.releaseUrl && (
                                  <button
                                    onClick={openReleaseNotes}
                                    className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex items-center gap-2"
                                  >
                                    <ExternalLink className="w-4 h-4" />
                                    Release Notes
                                  </button>
                                )}
                              </div>
                            </div>
                          )}

                          {updateInfo.releaseNotes && updateInfo.releaseNotes !== 'No release notes available.' && (
                            <div className="mt-4 pt-4 border-t border-blue-200 dark:border-blue-800">
                              <h5 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
                                What's New:
                              </h5>
                              <div className="text-sm text-blue-700 dark:text-blue-300 bg-blue-50/50 dark:bg-blue-950/30 rounded p-3 max-h-32 overflow-y-auto">
                                <pre className="whitespace-pre-wrap font-sans">
                                  {updateInfo.releaseNotes.length > 500
                                    ? updateInfo.releaseNotes.substring(0, 500) + '...'
                                    : updateInfo.releaseNotes}
                                </pre>
                              </div>
                            </div>
                          )}

                          {updateInfo.publishedAt && (
                            <p className="text-xs text-blue-600 dark:text-blue-400 mt-3">
                              Released {new Date(updateInfo.publishedAt).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-green-50/50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-green-100 dark:bg-green-900/40 rounded-full flex items-center justify-center">
                          <Check className="w-5 h-5 text-green-600 dark:text-green-400" />
                        </div>
                        <div>
                          <h4 className="font-medium text-green-900 dark:text-green-100">
                            You're Up to Date!
                          </h4>
                          <p className="text-sm text-green-700 dark:text-green-300">
                            Clara {updateInfo.currentVersion || 'Unknown'} is the latest version.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {lastUpdateCheck && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                      Last checked: {lastUpdateCheck.toLocaleString()}
                    </p>
                  )}
                </div>
              )}

              {/* Update Information */}
              <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
                <h3 className="font-medium text-gray-900 dark:text-white mb-4">
                  Update Information
                </h3>
                <div className="space-y-3 text-sm text-gray-600 dark:text-gray-400">
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 bg-sakura-400 rounded-full mt-2 flex-shrink-0"></div>
                    <div>
                      <strong>macOS:</strong> Supports automatic over-the-air (OTA) updates with code signing verification for security.
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 bg-blue-400 rounded-full mt-2 flex-shrink-0"></div>
                    <div>
                      <strong>Windows & Linux:</strong> Manual updates ensure security. Download links point to the official GitHub releases.
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 bg-green-400 rounded-full mt-2 flex-shrink-0"></div>
                    <div>
                      <strong>Release Notes:</strong> View detailed information about new features, improvements, and bug fixes.
                    </div>
                  </div>
                </div>
              </div>

              {/* Llama.cpp Binary Updates Section */}
              {/* TEMPORARILY HIDDEN - Causes issues on some systems */}
              {false && (
              <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-3 mb-6">
                  <HardDrive className="w-6 h-6 text-orange-500" />
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      Llama.cpp Binary Updates
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Keep official llama.cpp inference binaries up to date (Clara's custom binaries are preserved)
                    </p>
                  </div>
                </div>

                {/* Current Binary Version Info */}
                <div className="bg-white/50 dark:bg-gray-800/50 rounded-lg p-4 mb-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-gray-900 dark:text-white mb-1">
                        Current Llama.cpp Version
                      </h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Version {llamacppUpdateInfo?.currentVersion || 'Unknown'} on {llamacppUpdateInfo ? getPlatformName(llamacppUpdateInfo.platform) : 'Unknown Platform'}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                        Updates official binaries only (llama-server, llama-cli, etc.)
                      </p>
                    </div>
                    <button
                      onClick={checkForLlamacppUpdates}
                      disabled={checkingLlamacppUpdates}
                      className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                    >
                      {checkingLlamacppUpdates ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          Checking...
                        </>
                      ) : (
                        <>
                          <RotateCcw className="w-4 h-4" />
                          Check for Updates
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Llama.cpp Update Status */}
                {llamacppUpdateInfo && (
                  <div className="space-y-4">
                    {llamacppUpdateInfo.error ? (
                      <div className="bg-red-50/50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                        <div className="flex items-center gap-3">
                          <AlertCircle className="w-5 h-5 text-red-500" />
                          <div>
                            <h4 className="font-medium text-red-900 dark:text-red-100">
                              Binary Update Check Failed
                            </h4>
                            <p className="text-sm text-red-700 dark:text-red-300">
                              {llamacppUpdateInfo.error}
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : llamacppUpdateInfo.hasUpdate ? (
                      <div className="bg-orange-50/50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-6">
                        <div className="flex items-start gap-4">
                          <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/40 rounded-full flex items-center justify-center">
                            <HardDrive className="w-6 h-6 text-orange-600 dark:text-orange-400" />
                          </div>
                          <div className="flex-1">
                            <h4 className="font-semibold text-orange-900 dark:text-orange-100 mb-2">
                              🚀 New Llama.cpp Binaries Available: {llamacppUpdateInfo.latestVersion || 'Latest Version'}
                            </h4>
                            
                            <div className="space-y-3">
                              <p className="text-sm text-orange-700 dark:text-orange-300">
                                ⚡ Updated official binaries provide better performance, bug fixes, and new features for local AI inference.
                                Download size: <strong>{llamacppUpdateInfo.downloadSize}</strong>
                              </p>
                              
                              <div className="bg-orange-100/60 dark:bg-orange-900/30 rounded-lg p-3 text-sm">
                                <p className="text-orange-800 dark:text-orange-200">
                                  <strong>📋 What will be updated:</strong> Official llama.cpp binaries (llama-server, llama-cli, etc.)
                                </p>
                                <p className="text-orange-700 dark:text-orange-300 mt-1">
                                  <strong>🔒 What stays untouched:</strong> Clara's custom binaries (llama-swap and others)
                                </p>
                              </div>
                              
                              <div className="flex gap-3">
                                <button
                                  onClick={updateLlamacppBinaries}
                                  disabled={updatingLlamacppBinaries}
                                  className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                                >
                                  {updatingLlamacppBinaries ? (
                                    <>
                                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                      Updating...
                                    </>
                                  ) : (
                                    <>
                                      <Download className="w-4 h-4" />
                                      Update Official Binaries
                                    </>
                                  )}
                                </button>
                                
                                {llamacppUpdateInfo.releaseUrl && (
                                  <button
                                    onClick={openReleaseNotes}
                                    className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex items-center gap-2"
                                  >
                                    <ExternalLink className="w-4 h-4" />
                                    Release Notes
                                  </button>
                                )}
                              </div>

                              {llamacppUpdateInfo.publishedAt && (
                                <p className="text-xs text-orange-600 dark:text-orange-400 mt-3">
                                  Released {new Date(llamacppUpdateInfo.publishedAt).toLocaleDateString()}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-green-50/50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-green-100 dark:bg-green-900/40 rounded-full flex items-center justify-center">
                            <Check className="w-5 h-5 text-green-600 dark:text-green-400" />
                          </div>
                          <div>
                            <h4 className="font-medium text-green-900 dark:text-green-100">
                              Official Binaries Up to Date!
                            </h4>
                            <p className="text-sm text-green-700 dark:text-green-300">
                              Llama.cpp binaries {llamacppUpdateInfo.currentVersion || 'Unknown'} are the latest version.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {lastLlamacppUpdateCheck && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                        Binaries last checked: {lastLlamacppUpdateCheck.toLocaleString()}
                      </p>
                    )}
                  </div>
                )}

                {/* Binary Update Information */}
                <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <h4 className="font-medium text-gray-900 dark:text-white mb-3">
                    🔧 Binary Update Information
                  </h4>
                  <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                    <div className="flex items-start gap-3">
                      <div className="w-2 h-2 bg-orange-400 rounded-full mt-2 flex-shrink-0"></div>
                      <div>
                        <strong>Official Binaries Only:</strong> Updates llama-server, llama-cli, and other official tools from ggerganov/llama.cpp.
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-2 h-2 bg-blue-400 rounded-full mt-2 flex-shrink-0"></div>
                      <div>
                        <strong>Clara's Custom Binaries:</strong> llama-swap and other Clara-specific tools remain untouched and preserved.
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-2 h-2 bg-green-400 rounded-full mt-2 flex-shrink-0"></div>
                      <div>
                        <strong>Safe Updates:</strong> Your existing setup continues working, only official tools get performance improvements.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              )}

              {/* Llama.cpp Binary Updates Section - TEMPORARILY HIDDEN */}
              {/* This section has been temporarily hidden due to system compatibility issues */}
              {/* To re-enable, replace the above comment with the complete llama.cpp update UI */}
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md mx-4 shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
                <Trash2 className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Delete Provider
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  This action cannot be undone.
                </p>
              </div>
            </div>

            <div className="mb-6">
              <p className="text-gray-700 dark:text-gray-300">
                Are you sure you want to delete this provider? All associated configurations will be permanently removed.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="flex-1 px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteProvider(showDeleteConfirm)}
                className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors flex items-center justify-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Delete Provider
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Provider Modal */}
      {showAddProviderModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md mx-4 shadow-xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {editingProvider ? 'Edit Provider' : 'Add Provider'}
              </h3>
              <button
                onClick={() => {
                  setShowAddProviderModal(false);
                  setEditingProvider(null);
                }}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Provider Type
                </label>
                <select
                  value={newProviderForm.type}
                  onChange={(e) => {
                    const type = e.target.value as Provider['type'];
                    const defaultConfig = getDefaultProviderConfig(type);
                    setNewProviderForm(prev => ({
                      ...prev,
                      type,
                      name: defaultConfig.name || prev.name,
                      baseUrl: defaultConfig.baseUrl || prev.baseUrl,
                      apiKey: type === 'ollama' ? 'ollama' : prev.apiKey
                    }));
                  }}
                  className="w-full px-4 py-2 rounded-lg bg-white/50 border border-gray-200 focus:outline-none focus:border-sakura-300 dark:bg-gray-800/50 dark:border-gray-700 dark:text-gray-100"
                >
                  <option value="openai">OpenAI</option>
                  <option value="openrouter">OpenRouter</option>
                  <option value="ollama">Ollama</option>
                  <option value="custom">Custom</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Provider Name
                </label>
                <input
                  type="text"
                  value={newProviderForm.name}
                  onChange={(e) => setNewProviderForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-4 py-2 rounded-lg bg-white/50 border border-gray-200 focus:outline-none focus:border-sakura-300 dark:bg-gray-800/50 dark:border-gray-700 dark:text-gray-100"
                  placeholder="Enter provider name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Base URL
                </label>
                <input
                  type="url"
                  value={newProviderForm.baseUrl}
                  onChange={(e) => setNewProviderForm(prev => ({ ...prev, baseUrl: e.target.value }))}
                  className="w-full px-4 py-2 rounded-lg bg-white/50 border border-gray-200 focus:outline-none focus:border-sakura-300 dark:bg-gray-800/50 dark:border-gray-700 dark:text-gray-100"
                  placeholder="https://api.example.com/v1"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  API Key
                </label>
                <input
                  type="password"
                  value={newProviderForm.apiKey}
                  onChange={(e) => setNewProviderForm(prev => ({ ...prev, apiKey: e.target.value }))}
                  className="w-full px-4 py-2 rounded-lg bg-white/50 border border-gray-200 focus:outline-none focus:border-sakura-300 dark:bg-gray-800/50 dark:border-gray-700 dark:text-gray-100"
                  placeholder="Enter API key (optional)"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isEnabled"
                  checked={newProviderForm.isEnabled}
                  onChange={(e) => setNewProviderForm(prev => ({ ...prev, isEnabled: e.target.checked }))}
                  className="w-4 h-4 text-sakura-500 rounded border-gray-300 focus:ring-sakura-500"
                />
                <label htmlFor="isEnabled" className="text-sm text-gray-700 dark:text-gray-300">
                  Enable this provider
                </label>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowAddProviderModal(false);
                  setEditingProvider(null);
                }}
                className="flex-1 px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={editingProvider ? handleUpdateProvider : handleAddProvider}
                disabled={!newProviderForm.name.trim()}
                className="flex-1 px-4 py-2 bg-sakura-500 text-white rounded-lg hover:bg-sakura-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                <Check className="w-4 h-4" />
                {editingProvider ? 'Update' : 'Add'} Provider
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Settings;