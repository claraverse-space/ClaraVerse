import { useEffect, useState } from 'react';
import { Save, User, Globe, Server, Key, Lock } from 'lucide-react';
import { db, type PersonalInfo, type APIConfig } from '../db';
// import { useTheme } from '../hooks/useTheme';

const Settings = () => {
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
    openai_base_url: 'https://api.openai.com/v1',
    openai_api_key: '',
    preferred_server: 'ollama'
  });

  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [showApiKey, setShowApiKey] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      const savedPersonalInfo = await db.getPersonalInfo();
      const savedApiConfig = await db.getAPIConfig();

      if (savedPersonalInfo) {
        setPersonalInfo(savedPersonalInfo);
      }
      
      if (savedApiConfig) {
        setApiConfig({
          ...savedApiConfig,
          openai_base_url: savedApiConfig.openai_base_url || 'https://api.openai.com/v1',
          preferred_server: savedApiConfig.preferred_server || 'ollama'
        });
      }
    };

    loadSettings();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    setSaveStatus('idle');

    try {
      await db.updatePersonalInfo(personalInfo);
      await db.updateAPIConfig(apiConfig);
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (error) {
      console.error('Failed to save settings:', error);
      setSaveStatus('error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Personal Information Section */}
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
        </div>
      </div>

      {/* API Configuration Section with Server Selection */}
      <div className="glassmorphic rounded-xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <Globe className="w-6 h-6 text-sakura-500" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            API Configuration
          </h2>
        </div>

        <div className="space-y-6">
          {/* Server Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              AI Server Preference
            </label>
            <div className="flex flex-wrap gap-4">
              <label className={`flex items-center gap-2 p-4 border rounded-lg cursor-pointer transition-colors ${
                apiConfig.preferred_server === 'ollama' 
                  ? 'border-sakura-500 bg-sakura-50 dark:bg-sakura-500/10' 
                  : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50'
              }`}>
                <input
                  type="radio"
                  className="sr-only"
                  checked={apiConfig.preferred_server === 'ollama'}
                  onChange={() => setApiConfig(prev => ({ ...prev, preferred_server: 'ollama' }))}
                />
                <Server className={`w-5 h-5 ${apiConfig.preferred_server === 'ollama' ? 'text-sakura-500' : 'text-gray-500 dark:text-gray-400'}`} />
                <div>
                  <div className={`font-medium ${apiConfig.preferred_server === 'ollama' ? 'text-sakura-700 dark:text-sakura-300' : 'text-gray-700 dark:text-gray-300'}`}>
                    Ollama (Local)
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    For self-hosted models
                  </div>
                </div>
              </label>

              <label className={`flex items-center gap-2 p-4 border rounded-lg cursor-pointer transition-colors ${
                apiConfig.preferred_server === 'openai' 
                  ? 'border-sakura-500 bg-sakura-50 dark:bg-sakura-500/10' 
                  : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50'
              }`}>
                <input
                  type="radio"
                  className="sr-only"
                  checked={apiConfig.preferred_server === 'openai'}
                  onChange={() => setApiConfig(prev => ({ ...prev, preferred_server: 'openai' }))}
                />
                <Key className={`w-5 h-5 ${apiConfig.preferred_server === 'openai' ? 'text-sakura-500' : 'text-gray-500 dark:text-gray-400'}`} />
                <div>
                  <div className={`font-medium ${apiConfig.preferred_server === 'openai' ? 'text-sakura-700 dark:text-sakura-300' : 'text-gray-700 dark:text-gray-300'}`}>
                    OpenAI Compatible
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    OpenAI API or compatible
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* Ollama Settings */}
          <div className={apiConfig.preferred_server === 'ollama' ? 'block' : 'hidden'}>
            <h3 className="text-md font-medium text-gray-700 dark:text-gray-300 mb-4">
              Ollama Server Settings
            </h3>
            <div className="space-y-4">
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
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Default is http://localhost:11434 for local Ollama instances
                </p>
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
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Default is http://localhost:8188 for local ComfyUI instances
                </p>
              </div>
            </div>
          </div>

          {/* OpenAI Settings */}
          <div className={apiConfig.preferred_server === 'openai' ? 'block' : 'hidden'}>
            <h3 className="text-md font-medium text-gray-700 dark:text-gray-300 mb-4">
              OpenAI Compatible Settings
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  API Key
                </label>
                <div className="relative">
                  <input
                    type={showApiKey ? "text" : "password"}
                    value={apiConfig.openai_api_key || ''}
                    onChange={(e) => setApiConfig(prev => ({ ...prev, openai_api_key: e.target.value }))}
                    className="w-full px-4 py-2 rounded-lg bg-white/50 border border-gray-200 focus:outline-none focus:border-sakura-300 dark:bg-gray-800/50 dark:border-gray-700 dark:text-gray-100"
                    placeholder="sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  />
                  <button 
                    type="button"
                    className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                    onClick={() => setShowApiKey(!showApiKey)}
                  >
                    <Lock className="w-4 h-4" />
                  </button>
                </div>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Your API key is stored locally and never leaves your device
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Base URL (Optional)
                </label>
                <input
                  type="url"
                  value={apiConfig.openai_base_url || ''}
                  onChange={(e) => setApiConfig(prev => ({ ...prev, openai_base_url: e.target.value }))}
                  className="w-full px-4 py-2 rounded-lg bg-white/50 border border-gray-200 focus:outline-none focus:border-sakura-300 dark:bg-gray-800/50 dark:border-gray-700 dark:text-gray-100"
                  placeholder="https://api.openai.com/v1"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Change this for OpenAI-compatible services like LM Studio, Vllm, OpenRouter, etc.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Preferences Section */}
      <div className="glassmorphic rounded-xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <Globe className="w-6 h-6 text-sakura-500" />
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
              onChange={(e) => setPersonalInfo(prev => ({ 
                ...prev, 
                theme_preference: e.target.value as PersonalInfo['theme_preference']
              }))}
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
              {Intl.supportedValuesOf('timeZone').map(tz => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end gap-4">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className={`flex items-center gap-2 px-6 py-2 rounded-lg text-white transition-colors ${
            isSaving
              ? 'bg-gray-400 cursor-not-allowed'
              : saveStatus === 'success'
              ? 'bg-green-500'
              : saveStatus === 'error'
              ? 'bg-red-500'
              : 'bg-sakura-500 hover:bg-sakura-600'
          }`}
        >
          <Save className="w-4 h-4" />
          {isSaving ? 'Saving...' : saveStatus === 'success' ? 'Saved!' : saveStatus === 'error' ? 'Error!' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
};

export default Settings;