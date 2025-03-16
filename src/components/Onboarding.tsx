import { useState } from 'react';
import { User, Mail, Globe, Check, AlertCircle, Loader } from 'lucide-react';
import { db } from '../db';
import { OllamaClient } from '../utils/OllamaClient';

interface OnboardingProps {
  onComplete: () => void;
}

const Onboarding = ({ onComplete }: OnboardingProps) => {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    theme_preference: 'system' as const,
    avatar_url: '',
    ollama_url: 'http://localhost:11434',
    comfyui_url: 'http://localhost:8188'
  });
  const [loading, setLoading] = useState(false);
  const [pingStatus, setPingStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const pingOllamaServer = async (url: string) => {
    setLoading(true);
    setPingStatus('idle');
    try {
      const client = new OllamaClient(url);
      const isAvailable = await client.ping();
      if (isAvailable) {
        setPingStatus('success');
      } else {
        setPingStatus('error');
      }
    } catch (error) {
      console.error('Error pinging Ollama server:', error);
      setPingStatus('error');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    // Save personal info to database
    await db.updatePersonalInfo({
      name: formData.name,
      email: formData.email,
      timezone: formData.timezone,
      theme_preference: formData.theme_preference,
      avatar_url: formData.avatar_url
    });
    
    // Initialize API config with Ollama URL and ComfyUI URL
    await db.updateAPIConfig({
      ollama_base_url: formData.ollama_url,
      comfyui_base_url: formData.comfyui_url
    });

    onComplete();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (step < 3) {
        if ((step === 1 && formData.name) || 
            (step === 2 && formData.email) ||
            (step === 3 && formData.timezone)) {
          setStep(step + 1);
        }
      } else {
        if (formData.timezone) {
          handleSubmit();
        }
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="glassmorphic rounded-2xl p-8 max-w-md w-full mx-4 space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
            Welcome to Clara
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Let's get to know each other a little better
          </p>
        </div>

        <div className="space-y-6">
          {step === 1 && (
            <div className="space-y-4 animate-fadeIn">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-sakura-100 dark:bg-sakura-100/10 rounded-lg">
                  <User className="w-6 h-6 text-sakura-500" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  What should I call you?
                </h3>
              </div>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                onKeyDown={handleKeyDown}
                className="w-full px-4 py-2 rounded-lg bg-white/50 border border-gray-200 focus:outline-none focus:border-sakura-300 dark:bg-gray-800/50 dark:border-gray-700 dark:text-gray-100"
                placeholder="Your name"
                autoFocus
              />
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4 animate-fadeIn">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-sakura-100 dark:bg-sakura-100/10 rounded-lg">
                  <Mail className="w-6 h-6 text-sakura-500" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  How can I reach you?
                </h3>
              </div>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                onKeyDown={handleKeyDown}
                className="w-full px-4 py-2 rounded-lg bg-white/50 border border-gray-200 focus:outline-none focus:border-sakura-300 dark:bg-gray-800/50 dark:border-gray-700 dark:text-gray-100"
                placeholder="your.email@example.com"
                autoFocus
              />
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4 animate-fadeIn">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-sakura-100 dark:bg-sakura-100/10 rounded-lg">
                  <Globe className="w-6 h-6 text-sakura-500" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  API Configuration
                </h3>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Ollama API URL
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={formData.ollama_url}
                      onChange={(e) => {
                        setFormData(prev => ({ ...prev, ollama_url: e.target.value }));
                        setPingStatus('idle');
                      }}
                      className="flex-1 px-4 py-2 rounded-lg bg-white/50 border border-gray-200 focus:outline-none focus:border-sakura-300 dark:bg-gray-800/50 dark:border-gray-700 dark:text-gray-100"
                      placeholder="http://localhost:11434"
                    />
                    <button 
                      onClick={() => pingOllamaServer(formData.ollama_url)}
                      disabled={loading}
                      className="px-3 py-2 rounded-lg bg-sakura-500 text-white hover:bg-sakura-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
                    >
                      {loading ? <Loader className="w-4 h-4 animate-spin" /> : 'Test'}
                    </button>
                  </div>
                  <div className="mt-1">
                    {pingStatus === 'success' && (
                      <div className="flex items-center gap-1 text-green-600 text-xs">
                        <Check className="w-4 h-4" /> Connection successful! Ollama server is reachable.
                      </div>
                    )}
                    {pingStatus === 'error' && (
                      <div className="text-xs">
                        <div className="flex items-center gap-1 text-red-600">
                          <AlertCircle className="w-4 h-4" /> Unable to connect to Ollama server
                        </div>
                        <a 
                          href="https://ollama.com/download" 
                          target="_blank" 
                          rel="noreferrer"
                          className="text-sakura-500 hover:underline mt-1 inline-block"
                        >
                          Download Ollama
                        </a>
                        <p className="text-gray-500 dark:text-gray-400 mt-1">
                          You can continue setup and configure Ollama later
                        </p>
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    ComfyUI URL (Optional)
                  </label>
                  <input
                    type="url"
                    value={formData.comfyui_url}
                    onChange={(e) => setFormData(prev => ({ ...prev, comfyui_url: e.target.value }))}
                    className="w-full px-4 py-2 rounded-lg bg-white/50 border border-gray-200 focus:outline-none focus:border-sakura-300 dark:bg-gray-800/50 dark:border-gray-700 dark:text-gray-100"
                    placeholder="http://localhost:8188"
                  />
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    The URL where your ComfyUI instance is running
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Timezone
                  </label>
                  <select
                    value={formData.timezone}
                    onChange={(e) => setFormData(prev => ({ ...prev, timezone: e.target.value }))}
                    onKeyDown={handleKeyDown}
                    className="w-full px-4 py-2 rounded-lg bg-white/50 border border-gray-200 focus:outline-none focus:border-sakura-300 dark:bg-gray-800/50 dark:border-gray-700 dark:text-gray-100"
                  >
                    {Intl.supportedValuesOf('timeZone').map(tz => (
                      <option key={tz} value={tz}>{tz}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-between pt-4">
          {step > 1 && (
            <button
              onClick={() => setStep(step - 1)}
              className="px-6 py-2 rounded-lg text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors"
            >
              Back
            </button>
          )}
          <button
            onClick={() => {
              if (step < 3) {
                setStep(step + 1);
              } else {
                handleSubmit();
              }
            }}
            disabled={
              (step === 1 && !formData.name) ||
              (step === 2 && !formData.email)
            }
            className="ml-auto px-6 py-2 rounded-lg bg-sakura-500 text-white hover:bg-sakura-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {step === 3 ? 'Get Started' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Onboarding;