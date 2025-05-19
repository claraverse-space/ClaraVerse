import { useEffect, useState, useRef } from 'react';
import { Save, User, Globe, Server, Key, Lock, Image, Settings as SettingsIcon } from 'lucide-react';
import { db, type PersonalInfo, type APIConfig } from '../db';
import { useTheme, ThemeMode } from '../hooks/useTheme';

const Settings = () => {
  const [activeTab, setActiveTab] = useState<'personal' | 'api' | 'preferences'>('personal');
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
  const [showApiKey, setShowApiKey] = useState(false);
  const [wallpaperUrl, setWallpaperUrl] = useState<string | null>(null);

  const { setTheme } = useTheme();
  const saveTimeout = useRef<NodeJS.Timeout | null>(null);

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
      } catch (error) {
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
    // @ts-ignore
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
      
      <div className="flex max-w-6xl mx-auto gap-6 relative z-10 h-full">
        {/* Sidebar with tabs */}
        <div className="w-64 shrink-0">
          <div className="glassmorphic rounded-xl p-4 space-y-2 sticky top-4">
            <h2 className="flex items-center gap-2 px-4 py-3 text-lg font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 mb-2">
              <SettingsIcon className="w-5 h-5 text-sakura-500" />
              Settings
            </h2>
            
            <TabItem 
              id="personal" 
              label="Personal Information" 
              icon={<User className="w-5 h-5" />} 
              isActive={activeTab === 'personal'} 
            />
            
            <TabItem 
              id="api" 
              label="API Configuration" 
              icon={<Globe className="w-5 h-5" />} 
              isActive={activeTab === 'api'} 
            />
            
            <TabItem 
              id="preferences" 
              label="Preferences" 
              icon={<SettingsIcon className="w-5 h-5" />} 
              isActive={activeTab === 'preferences'} 
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
        <div className="flex-1 space-y-6 py-2 max-w-4xl">
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
            <div className="glassmorphic rounded-xl p-6">
              <div className="flex items-center gap-3 mb-6">
                <Globe className="w-6 h-6 text-sakura-500" />
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  API Configuration
                </h2>
              </div>

              <div className="space-y-6">
                <div className="space-y-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    API Type
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      onClick={() => setApiConfig(prev => ({ ...prev, api_type: 'ollama' }))}
                      className={`flex flex-col items-center p-4 rounded-lg border-2 transition-all ${
                        apiConfig.api_type === 'ollama'
                          ? 'border-sakura-500 bg-sakura-50 dark:bg-sakura-500/10'
                          : 'border-gray-200 hover:border-sakura-200 dark:border-gray-700'
                      }`}
                    >
                      <div className="text-center">
                        <h3 className="font-medium text-gray-900 dark:text-white">Ollama</h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Local AI models</p>
                      </div>
                    </button>
                    <button
                      onClick={() => setApiConfig(prev => ({ ...prev, api_type: 'openai' }))}
                      className={`flex flex-col items-center p-4 rounded-lg border-2 transition-all ${
                        apiConfig.api_type === 'openai'
                          ? 'border-sakura-500 bg-sakura-50 dark:bg-sakura-500/10'
                          : 'border-gray-200 hover:border-sakura-200 dark:border-gray-700'
                      }`}
                    >
                      <div className="text-center">
                        <h3 className="font-medium text-gray-900 dark:text-white">OpenAI-like API</h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Compatible with OpenAI API format</p>
                      </div>
                    </button>
                  </div>
                </div>

                {apiConfig.api_type === 'ollama' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Ollama Base URL
                    </label>
                    <input
                      type="url"
                      value={apiConfig.ollama_base_url}
                      onChange={(e) => setApiConfig(prev => ({ ...prev, ollama_base_url: e.target.value }))}
                      className="w-full px-4 py-2 rounded-lg bg-white/50 border border-gray-200 focus:outline-none focus:border-sakura-300 dark:bg-gray-800/50 dark:border-gray-700 dark:text-gray-100"
                      placeholder="http://localhost:11434"
                    />
                  </div>
                )}

                {apiConfig.api_type === 'openai' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        API Base URL <span className="text-xs text-gray-500 dark:text-gray-400">(Optional - uses OpenAI if blank)</span>
                      </label>
                      <input
                        type="url"
                        value={apiConfig.openai_base_url}
                        onChange={(e) => setApiConfig(prev => ({ ...prev, openai_base_url: e.target.value }))}
                        className="w-full px-4 py-2 rounded-lg bg-white/50 border border-gray-200 focus:outline-none focus:border-sakura-300 dark:bg-gray-800/50 dark:border-gray-700 dark:text-gray-100"
                        placeholder="https://api.openai.com/v1 or your custom endpoint"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        API Key <span className="text-xs text-gray-500 dark:text-gray-400">(Optional for some API providers)</span>
                      </label>
                      <input
                        type="password"
                        value={apiConfig.openai_api_key}
                        onChange={(e) => setApiConfig(prev => ({ ...prev, openai_api_key: e.target.value }))}
                        className="w-full px-4 py-2 rounded-lg bg-white/50 border border-gray-200 focus:outline-none focus:border-sakura-300 dark:bg-gray-800/50 dark:border-gray-700 dark:text-gray-100"
                        placeholder="sk-..."
                      />
                    </div>
                  </div>
                )}
                
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
                </div>

                {/* n8n Configuration Section */}
                <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <Server className="w-5 h-5 text-sakura-500" />
                    n8n Configuration
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        n8n Base URL
                      </label>
                      <input
                        type="url"
                        value={apiConfig.n8n_base_url || ''}
                        onChange={(e) => setApiConfig(prev => ({ ...prev, n8n_base_url: e.target.value }))}
                        className="w-full px-4 py-2 rounded-lg bg-white/50 border border-gray-200 focus:outline-none focus:border-sakura-300 dark:bg-gray-800/50 dark:border-gray-700 dark:text-gray-100"
                        placeholder="http://localhost:5678"
                      />
                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">The URL where your n8n instance is running</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        n8n API Key
                      </label>
                      <div className="relative">
                        <input
                          type={showApiKey ? "text" : "password"}
                          value={apiConfig.n8n_api_key || ''}
                          onChange={(e) => setApiConfig(prev => ({ ...prev, n8n_api_key: e.target.value }))}
                          className="w-full px-4 py-2 rounded-lg bg-white/50 border border-gray-200 focus:outline-none focus:border-sakura-300 dark:bg-gray-800/50 dark:border-gray-700 dark:text-gray-100"
                          placeholder="Your n8n API key"
                        />
                        <button
                          type="button"
                          onClick={() => setShowApiKey(!showApiKey)}
                          className="absolute right-2 top-1/2 transform -translate-y-1/2"
                        >
                          {showApiKey ? (
                            <Lock className="h-4 w-4 text-gray-500" />
                          ) : (
                            <Key className="h-4 w-4 text-gray-500" />
                          )}
                        </button>
                      </div>
                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">API key for authenticating with your n8n instance</p>
                    </div>
                  </div>
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
        </div>
      </div>
    </>
  );
};

export default Settings;