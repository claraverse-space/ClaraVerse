import React, { useState } from 'react';
import { XCircle, Bot, Info, Star, Webhook, LayoutGrid, Mail, Briefcase } from 'lucide-react';

interface WidgetOption {
  id: string;
  type: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  category: 'system' | 'data' | 'productivity' | 'custom';
  preview: React.ReactNode;
}

interface AddWidgetModalProps {
  onClose: () => void;
  onAddWidget: (type: string) => void;
  onAddWebhookWidget?: (name: string, url: string) => void;
  onAddEmailWidget?: (name: string, url: string, refreshInterval: number) => void;
}

const AVAILABLE_WIDGETS: WidgetOption[] = [
  {
    id: 'welcome',
    type: 'welcome',
    name: 'Welcome',
    description: 'Introduction and quick actions for Clara',
    icon: <Bot className="w-5 h-5" />,
    category: 'system',
    preview: (
      <div className="p-3 bg-gray-500/5 dark:bg-gray-300/5 rounded-lg">
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-sakura-500" />
          <h3 className="text-sm font-medium text-gray-900 dark:text-white">Welcome to Clara</h3>
        </div>
        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1.5">Your AI assistant powered by Ollama...</p>
      </div>
    )
  },
  {
    id: 'privacy',
    type: 'privacy',
    name: 'Privacy Notice',
    description: 'Information about Clara\'s privacy and security',
    icon: <Info className="w-5 h-5" />,
    category: 'system',
    preview: (
      <div className="p-3 bg-gray-500/5 dark:bg-gray-300/5 rounded-lg">
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-sakura-500" />
          <h3 className="text-sm font-medium text-gray-900 dark:text-white">Private & Secure</h3>
        </div>
        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1.5">Clara runs locally on your machine...</p>
      </div>
    )
  },
  {
    id: 'whats-new',
    type: 'whats-new',
    name: 'What\'s New',
    description: 'Latest updates and features in Clara',
    icon: <Star className="w-5 h-5" />,
    category: 'system',
    preview: (
      <div className="p-3 bg-gray-500/5 dark:bg-gray-300/5 rounded-lg">
        <div className="flex items-center gap-2">
          <Star className="w-4 h-4 text-sakura-500" />
          <h3 className="text-sm font-medium text-gray-900 dark:text-white">What's New in Clara</h3>
        </div>
        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1.5">Latest updates and improvements...</p>
      </div>
    )
  },
  {
    id: 'webhook',
    type: 'webhook',
    name: 'Custom Webhook',
    description: 'Display data from external APIs',
    icon: <Webhook className="w-5 h-5" />,
    category: 'data',
    preview: (
      <div className="p-3 bg-gray-500/5 dark:bg-gray-300/5 rounded-lg">
        <div className="flex items-center gap-2">
          <Webhook className="w-4 h-4 text-sakura-500" />
          <h3 className="text-sm font-medium text-gray-900 dark:text-white">Webhook Data</h3>
        </div>
        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1.5">Display real-time data from APIs...</p>
      </div>
    )
  },
  {
    id: 'email',
    type: 'email',
    name: 'Email Inbox',
    description: 'View your recent emails at a glance',
    icon: <Mail className="w-5 h-5" />,
    category: 'productivity',
    preview: (
      <div className="p-3 bg-gray-500/5 dark:bg-gray-300/5 rounded-lg">
        <div className="flex items-center gap-2">
          <Mail className="w-4 h-4 text-sakura-500" />
          <h3 className="text-sm font-medium text-gray-900 dark:text-white">Email Inbox</h3>
        </div>
        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1.5">Connect to your email API endpoint...</p>
      </div>
    )
  }
];

const AddWidgetModal: React.FC<AddWidgetModalProps> = ({ 
  onClose, 
  onAddWidget, 
  onAddWebhookWidget,
  onAddEmailWidget
}) => {
  const [selectedCategory, setSelectedCategory] = React.useState<'system' | 'data' | 'productivity' | 'custom'>('system');
  const [selectedWidget, setSelectedWidget] = React.useState<string | null>(null);
  
  // Webhook form state
  const [webhookName, setWebhookName] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookError, setWebhookError] = useState<string | null>(null);
  
  // Email widget form state
  const [emailName, setEmailName] = useState('');
  const [emailUrl, setEmailUrl] = useState('');
  const [refreshInterval, setRefreshInterval] = useState(5);
  const [emailError, setEmailError] = useState<string | null>(null);

  const filteredWidgets = AVAILABLE_WIDGETS.filter(widget => widget.category === selectedCategory);
  
  const isWebhookSelected = selectedWidget === 'webhook';
  const isEmailSelected = selectedWidget === 'email';
  const isWebhookFormValid = webhookName.trim() !== '' && webhookUrl.trim() !== '';
  const isEmailFormValid = emailName.trim() !== '' && emailUrl.trim() !== '';

  const handleAddWidget = () => {
    if (selectedWidget) {
      const widget = AVAILABLE_WIDGETS.find(w => w.id === selectedWidget);
      if (widget) {
        if (widget.id === 'webhook' && onAddWebhookWidget) {
          if (!isWebhookFormValid) {
            setWebhookError('Please enter both name and URL');
            return;
          }
          onAddWebhookWidget(webhookName, webhookUrl);
        } else if (widget.id === 'email' && onAddEmailWidget) {
          if (!isEmailFormValid) {
            setEmailError('Please enter both name and URL');
            return;
          }
          onAddEmailWidget(emailName, emailUrl, refreshInterval);
        } else {
          onAddWidget(widget.type);
        }
        onClose();
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="glassmorphic rounded-2xl shadow-lg w-full max-w-4xl max-h-[80vh] overflow-hidden">
        <div className="flex h-full">
          {/* Sidebar */}
          <div className="w-48 border-r border-gray-200/10 dark:border-gray-700/10 p-4">
            <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Categories</h2>
            <div className="space-y-2">
              <button
                className={`w-full px-3 py-2 rounded-lg text-left text-sm flex items-center gap-2 transition-colors ${
                  selectedCategory === 'system'
                    ? 'bg-sakura-500/10 text-sakura-500'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-500/5 dark:hover:bg-gray-300/5'
                }`}
                onClick={() => setSelectedCategory('system')}
              >
                <LayoutGrid className="w-4 h-4" />
                System Widgets
              </button>
              <button
                className={`w-full px-3 py-2 rounded-lg text-left text-sm flex items-center gap-2 transition-colors ${
                  selectedCategory === 'data'
                    ? 'bg-sakura-500/10 text-sakura-500'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-500/5 dark:hover:bg-gray-300/5'
                }`}
                onClick={() => setSelectedCategory('data')}
              >
                <Webhook className="w-4 h-4" />
                Data Widgets
              </button>
              <button
                className={`w-full px-3 py-2 rounded-lg text-left text-sm flex items-center gap-2 transition-colors ${
                  selectedCategory === 'productivity'
                    ? 'bg-sakura-500/10 text-sakura-500'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-500/5 dark:hover:bg-gray-300/5'
                }`}
                onClick={() => setSelectedCategory('productivity')}
              >
                <Briefcase className="w-4 h-4" />
                Productivity
              </button>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 flex flex-col h-full">
            {/* Header */}
            <div className="p-4 border-b border-gray-200/10 dark:border-gray-700/10 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Add Widget</h2>
              <button
                className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                onClick={onClose}
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            {/* Widget Grid */}
            <div className="flex-1 overflow-y-auto p-4">
              <div className="grid grid-cols-2 gap-4">
                {filteredWidgets.map(widget => (
                  <div
                    key={widget.id}
                    className={`p-4 rounded-xl cursor-pointer transition-all bg-gray-500/5 dark:bg-gray-300/5 hover:bg-gray-500/10 dark:hover:bg-gray-300/10 ${
                      selectedWidget === widget.id
                        ? 'ring-1 ring-sakura-500'
                        : ''
                    }`}
                    onClick={() => setSelectedWidget(widget.id)}
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <div className="p-2 bg-gray-500/10 dark:bg-gray-300/10 rounded-lg">
                        {widget.icon}
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900 dark:text-white">{widget.name}</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{widget.description}</p>
                      </div>
                    </div>
                    <div className="mt-2">{widget.preview}</div>
                  </div>
                ))}
              </div>
              
              {/* Webhook Configuration Form */}
              {isWebhookSelected && (
                <div className="mt-6 bg-gray-500/5 dark:bg-gray-300/5 p-4 rounded-lg">
                  <h3 className="font-medium text-gray-900 dark:text-white mb-4">Webhook Configuration</h3>
                  
                  {webhookError && (
                    <div className="mb-4 text-red-500 text-sm">{webhookError}</div>
                  )}
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Display Name</label>
                      <input 
                        type="text"
                        className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg"
                        placeholder="Enter a name for this widget"
                        value={webhookName}
                        onChange={(e) => setWebhookName(e.target.value)}
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Webhook URL</label>
                      <input 
                        type="text"
                        className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg"
                        placeholder="https://api.example.com/data"
                        value={webhookUrl}
                        onChange={(e) => setWebhookUrl(e.target.value)}
                      />
                      <p className="text-xs text-gray-500 mt-1">Enter the URL that returns JSON data to display</p>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Email Widget Configuration Form */}
              {isEmailSelected && (
                <div className="mt-6 bg-gray-500/5 dark:bg-gray-300/5 p-4 rounded-lg">
                  <h3 className="font-medium text-gray-900 dark:text-white mb-4">Email Widget Configuration</h3>
                  
                  {emailError && (
                    <div className="mb-4 text-red-500 text-sm">{emailError}</div>
                  )}
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Widget Name</label>
                      <input 
                        type="text"
                        className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg"
                        placeholder="My Email Inbox"
                        value={emailName}
                        onChange={(e) => setEmailName(e.target.value)}
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Email API Endpoint</label>
                      <input 
                        type="text"
                        className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg"
                        placeholder="https://api.example.com/emails"
                        value={emailUrl}
                        onChange={(e) => setEmailUrl(e.target.value)}
                      />
                      <p className="text-xs text-gray-500 mt-1">Enter the URL that returns your email data in JSON format</p>
                    </div>
                    
                    <div>
                      <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Auto-Refresh Interval (minutes)</label>
                      <select
                        className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg"
                        value={refreshInterval}
                        onChange={(e) => setRefreshInterval(Number(e.target.value))}
                      >
                        <option value="1">1 minute</option>
                        <option value="5">5 minutes</option>
                        <option value="15">15 minutes</option>
                        <option value="30">30 minutes</option>
                        <option value="60">1 hour</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-200/10 dark:border-gray-700/10 flex justify-end">
              <button
                className="px-4 py-2 bg-sakura-500 text-white rounded-lg hover:bg-sakura-600 disabled:opacity-50 transition-colors"
                disabled={
                  !selectedWidget || 
                  (isWebhookSelected && !isWebhookFormValid) ||
                  (isEmailSelected && !isEmailFormValid)
                }
                onClick={handleAddWidget}
              >
                Add Selected Widget
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddWidgetModal; 