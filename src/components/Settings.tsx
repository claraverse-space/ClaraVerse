import React, { useEffect, useState, useRef } from 'react';
import { Save, User, Globe, Server, Image, Settings as SettingsIcon, Trash2, HardDrive, Plus, Check, X, Edit3, Zap, Router, Bot, Wrench, Download, RotateCcw, AlertCircle, ExternalLink } from 'lucide-react';
import { db, type PersonalInfo, type APIConfig, type Provider } from '../db';
import { useTheme, ThemeMode } from '../hooks/useTheme';
import { useProviders } from '../contexts/ProvidersContext';
import MCPSettings from './MCPSettings';
import ModelManager from './ModelManager';
import ToolBelt from './ToolBelt';

const Settings = () => {
  const [activeTab, setActiveTab] = useState<'personal' | 'api' | 'preferences' | 'models' | 'mcp' | 'toolbelt' | 'updates'>('api');
  const [personalInfo, setPersonalInfo] = useState<PersonalInfo>({
    name: '',
    email: '',
    avatar_url: '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    theme_preference: 'system'
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
    };

    loadSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    try {
      if (!updateInfo?.releaseUrl) {
        console.warn('No release URL available');
        return;
      }
      
      // Validate URL format
      try {
        new URL(updateInfo.releaseUrl);
      } catch (urlError) {
        console.error('Invalid release URL:', updateInfo.releaseUrl);
        return;
      }
      
      console.log('Opening release notes:', updateInfo.releaseUrl);
      window.open(updateInfo.releaseUrl, '_blank', 'noopener,noreferrer');
      
    } catch (error) {
      console.error('Error opening release notes:', error);
    }
  };

  const downloadUpdate = () => {
    try {
      if (!updateInfo?.downloadUrl) {
        console.warn('No download URL available');
        return;
      }
      
      // Validate URL format
      try {
        new URL(updateInfo.downloadUrl);
      } catch (urlError) {
        console.error('Invalid download URL:', updateInfo.downloadUrl);
        return;
      }
      
      console.log('Opening download URL:', updateInfo.downloadUrl);
      window.open(updateInfo.downloadUrl, '_blank', 'noopener,noreferrer');
      
    } catch (error) {
      console.error('Error opening download URL:', error);
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
      className={`flex items-center gap-3 px-4 py-3 w-full rounded-lg transition-colors ${
        isActive 
          ? 'bg-sakura-500 text-white' 
          : 'text-gray-700 dark:text-gray-200 hover:bg-sakura-100 dark:hover:bg-gray-800'
      }`}
    >
      {icon}
      <span className="font-medium">{label}</span>
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
      
      <div className="flex max-w-7xl mx-auto gap-6 relative z-10 h-[calc(100vh-3rem)]">
        {/* Sidebar with tabs */}
        <div className="w-64 shrink-0">
          <div className="glassmorphic rounded-xl p-4 space-y-2 sticky top-4">
            <h2 className="flex items-center gap-2 px-4 py-3 text-lg font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 mb-2">
              <SettingsIcon className="w-5 h-5 text-sakura-500" />
              Settings
            </h2>
            
            <TabItem 
              id="api" 
              label="AI Providers" 
              icon={<Globe className="w-5 h-5" />} 
              isActive={activeTab === 'api'} 
            />

            <TabItem 
              id="models" 
              label="Model Manager" 
              icon={<HardDrive className="w-5 h-5" />} 
              isActive={activeTab === 'models'} 
            />

            <TabItem 
              id="mcp" 
              label="MCP" 
              icon={<Server className="w-5 h-5" />} 
              isActive={activeTab === 'mcp'} 
            />
            
            <TabItem 
              id="toolbelt" 
              label="Tool Belt" 
              icon={<Wrench className="w-5 h-5" />} 
              isActive={activeTab === 'toolbelt'} 
            />

            <TabItem 
              id="updates" 
              label="Updates" 
              icon={<Download className="w-5 h-5" />} 
              isActive={activeTab === 'updates'} 
            />

            <TabItem 
              id="preferences" 
              label="Preferences" 
              icon={<SettingsIcon className="w-5 h-5" />} 
              isActive={activeTab === 'preferences'} 
            />

            <TabItem 
              id="personal" 
              label="Personal Information" 
              icon={<User className="w-5 h-5" />} 
              isActive={activeTab === 'personal'} 
            />
            
            

            
            {/* Save Status - Only visible when saving/saved/error */}
            {(isSaving || saveStatus !== 'idle') && (
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <span className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-white transition-colors w-full ${
                  saveStatus === 'success'
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
        <div className={`flex-1 space-y-6 py-2 pb-6 overflow-y-auto overflow-x-hidden ${
          activeTab === 'models' ? '' : 'max-w-4xl'
        }`}>
          {/* Personal Information Tab */}
          {activeTab === 'personal' && (
            <div className="glassmorphic rounded-xl p-6">
              <div className="flex items-center gap-3 mb-6">
                <User className="w-6 h-6 text-sakura-500" />
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Personal Information
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

          {/* API Configuration Tab */}
          {activeTab === 'api' && (
            <div className="space-y-6">
              {/* Providers Section */}
              <div className="glassmorphic rounded-xl p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <Bot className="w-6 h-6 text-sakura-500" />
                    <div>
                      <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                        AI Providers
                      </h2>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Manage your AI service providers for chat and agents
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
                      Add Provider
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
                          className={`group relative p-5 rounded-xl border transition-all duration-300 ${
                            provider.isPrimary 
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
                              <div className={`relative w-14 h-14 rounded-xl flex items-center justify-center transition-all duration-300 ${
                                provider.isEnabled 
                                  ? provider.isPrimary
                                    ? 'bg-sakura-100/80 dark:bg-sakura-900/40 border-2 border-sakura-200 dark:border-sakura-700' 
                                    : 'bg-sakura-50/60 dark:bg-sakura-900/20 border border-sakura-200/50 dark:border-sakura-700/50'
                                  : 'bg-gray-100/80 dark:bg-gray-700/80 border border-gray-200 dark:border-gray-600'
                              }`}>
                                <ProviderIcon className={`w-7 h-7 ${
                                  provider.isEnabled 
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
                                  <h4 className={`font-semibold transition-colors ${
                                    provider.isPrimary 
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
                                  className={`relative w-12 h-6 rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-sakura-300 focus:ring-offset-2 dark:focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed ${
                                    provider.isPrimary
                                      ? 'bg-gradient-to-r from-emerald-400 to-emerald-500 shadow-lg shadow-emerald-500/25'
                                      : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600'
                                  }`}
                                >
                                  <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-all duration-300 flex items-center justify-center ${
                                    provider.isPrimary ? 'translate-x-6' : 'translate-x-0'
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
                                  className={`px-3 py-2 text-sm rounded-lg transition-all duration-200 disabled:opacity-50 flex items-center gap-2 font-medium ${
                                    testResults[provider.id] === 'success' 
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

              {/* ComfyUI Configuration */}
              <div className="glassmorphic rounded-xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <Image className="w-6 h-6 text-sakura-500" />
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                    ComfyUI Configuration
                  </h2>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    ComfyUI Base URL
                  </label>
                  <input
                    type="url"
                    value={apiConfig.comfyui_base_url}
                    onChange={(e) => setApiConfig(prev => ({ ...prev, comfyui_base_url: e.target.value }))}
                    className="w-full px-4 py-2 rounded-lg bg-white/50 border border-gray-200 focus:outline-none focus:border-sakura-300 dark:bg-gray-800/50 dark:border-gray-700 dark:text-gray-100"
                    placeholder="http://localhost:8188"
                  />
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    URL for your ComfyUI instance for image generation
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Preferences Tab */}
          {activeTab === 'preferences' && (
            <div className="glassmorphic rounded-xl p-6">
              <div className="flex items-center gap-3 mb-6">
                <SettingsIcon className="w-6 h-6 text-sakura-500" />
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Preferences
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
          )}

          {/* Model Manager Tab */}
          {activeTab === 'models' && (
            <ModelManager />
          )}

          {/* MCP Tab */}
          {activeTab === 'mcp' && (
            <MCPSettings />
          )}

          {/* Tool Belt Tab */}
          {activeTab === 'toolbelt' && (
            <ToolBelt />
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