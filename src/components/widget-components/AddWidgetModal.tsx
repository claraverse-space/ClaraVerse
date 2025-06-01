import React, { useState, useEffect } from 'react';
import { XCircle, Bot, Info, Star, Webhook, LayoutGrid, Mail, Briefcase, MessageSquare, Loader2, RefreshCw } from 'lucide-react';

interface WidgetOption {
  id: string;
  type: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  category: 'system' | 'data' | 'productivity' | 'custom';
  preview?: React.ReactNode;
}

interface AddWidgetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddWidget?: (type: string, data?: any) => void;
  onAddWebhookWidget?: (name: string, url: string) => void;
  onAddEmailWidget?: (name: string, url: string, refreshInterval: number) => void;
  onAddQuickChatWidget?: (name: string, url: string, model: string, systemPrompt?: string, prePrompt?: string) => void;
}

interface AppData {
  id: string;
  name: string;
  description: string;
  icon?: string;
  nodes: any[];
  edges: any[];
  createdAt: string;
  updatedAt: string;
}

const AVAILABLE_WIDGETS: WidgetOption[] = [
  {
    id: 'welcome',
    type: 'welcome',
    name: 'Welcome',
    description: 'A personalized welcome message with quick actions',
    icon: <Bot className="w-5 h-5" />,
    category: 'system',
    preview: (
      <div className="bg-gradient-to-r from-sakura-50 to-pink-50 dark:from-sakura-900/20 dark:to-pink-900/20 p-3 rounded border">
        <div className="flex items-center gap-2 mb-2">
          <Bot className="w-4 h-4 text-sakura-500" />
          <h3 className="text-sm font-medium text-gray-900 dark:text-white">Welcome back!</h3>
        </div>
        <p className="text-xs text-gray-600 dark:text-gray-400">Ready to create something amazing?</p>
      </div>
    )
  },
  {
    id: 'whats-new',
    type: 'whats-new',
    name: "What's New",
    description: 'Latest updates and features in ClaraVerse',
    icon: <Star className="w-5 h-5" />,
    category: 'system',
    preview: (
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 p-3 rounded border">
        <div className="flex items-center gap-2 mb-2">
          <Star className="w-4 h-4 text-blue-500" />
          <h3 className="text-sm font-medium text-gray-900 dark:text-white">What's New</h3>
        </div>
        <p className="text-xs text-gray-600 dark:text-gray-400">Discover the latest features and improvements</p>
      </div>
    )
  },
  {
    id: 'capabilities',
    type: 'capabilities',
    name: 'Capabilities',
    description: 'Overview of ClaraVerse features and capabilities',
    icon: <Info className="w-5 h-5" />,
    category: 'system',
    preview: (
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 p-3 rounded border">
        <div className="flex items-center gap-2 mb-2">
          <Info className="w-4 h-4 text-green-500" />
          <h3 className="text-sm font-medium text-gray-900 dark:text-white">Capabilities</h3>
        </div>
        <p className="text-xs text-gray-600 dark:text-gray-400">Explore what ClaraVerse can do</p>
      </div>
    )
  },
  {
    id: 'privacy',
    type: 'privacy',
    name: 'Privacy & Security',
    description: 'Information about data privacy and security',
    icon: <LayoutGrid className="w-5 h-5" />,
    category: 'system',
    preview: (
      <div className="bg-gradient-to-r from-purple-50 to-violet-50 dark:from-purple-900/20 dark:to-violet-900/20 p-3 rounded border">
        <div className="flex items-center gap-2 mb-2">
          <LayoutGrid className="w-4 h-4 text-purple-500" />
          <h3 className="text-sm font-medium text-gray-900 dark:text-white">Privacy & Security</h3>
        </div>
        <p className="text-xs text-gray-600 dark:text-gray-400">Your data stays private and secure</p>
      </div>
    )
  },
  {
    id: 'webhook',
    type: 'webhook',
    name: 'Webhook',
    description: 'Display data from external webhooks and APIs',
    icon: <Webhook className="w-5 h-5" />,
    category: 'data',
    preview: (
      <div className="bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 p-3 rounded border">
        <div className="flex items-center gap-2 mb-2">
          <Webhook className="w-4 h-4 text-orange-500" />
          <h3 className="text-sm font-medium text-gray-900 dark:text-white">API Data</h3>
        </div>
        <p className="text-xs text-gray-600 dark:text-gray-400">Real-time data from your APIs</p>
      </div>
    )
  },
  {
    id: 'email',
    type: 'email',
    name: 'Email',
    description: 'Monitor email inboxes and display unread counts',
    icon: <Mail className="w-5 h-5" />,
    category: 'productivity',
    preview: (
      <div className="bg-gradient-to-r from-cyan-50 to-blue-50 dark:from-cyan-900/20 dark:to-blue-900/20 p-3 rounded border">
        <div className="flex items-center gap-2 mb-2">
          <Mail className="w-4 h-4 text-cyan-500" />
          <h3 className="text-sm font-medium text-gray-900 dark:text-white">Email Monitor</h3>
        </div>
        <p className="text-xs text-gray-600 dark:text-gray-400">Keep track of your inbox</p>
      </div>
    )
  },
  {
    id: 'quick-chat',
    type: 'quick-chat',
    name: 'Quick Chat',
    description: 'Quick access to AI chat with customizable prompts',
    icon: <MessageSquare className="w-5 h-5" />,
    category: 'productivity',
    preview: (
      <div className="bg-gradient-to-r from-teal-50 to-cyan-50 dark:from-teal-900/20 dark:to-cyan-900/20 p-3 rounded border">
        <div className="flex items-center gap-2 mb-2">
          <MessageSquare className="w-4 h-4 text-teal-500" />
          <h3 className="text-sm font-medium text-gray-900 dark:text-white">Quick Chat</h3>
        </div>
        <p className="text-xs text-gray-600 dark:text-gray-400">Fast AI assistance</p>
      </div>
    )
  }
];

const AddWidgetModal: React.FC<AddWidgetModalProps> = ({
  isOpen,
  onClose,
  onAddWidget,
  onAddWebhookWidget,
  onAddEmailWidget,
  onAddQuickChatWidget
}) => {
  const [selectedWidget, setSelectedWidget] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = React.useState<'system' | 'data' | 'productivity' | 'custom'>('system');
  
  // Webhook widget state
  const [webhookName, setWebhookName] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [showWebhookForm, setShowWebhookForm] = useState(false);
  
  // Email widget state
  const [emailName, setEmailName] = useState('');
  const [emailUrl, setEmailUrl] = useState('');
  const [emailRefreshInterval, setEmailRefreshInterval] = useState(300); // 5 minutes default
  const [showEmailForm, setShowEmailForm] = useState(false);
  
  // Quick Chat widget state
  const [quickChatName, setQuickChatName] = useState('');
  const [quickChatUrl, setQuickChatUrl] = useState('http://localhost:11434');
  const [quickChatModel, setQuickChatModel] = useState('');
  const [quickChatSystemPrompt, setQuickChatSystemPrompt] = useState('');
  const [quickChatPrePrompt, setQuickChatPrePrompt] = useState('');
  const [showQuickChatForm, setShowQuickChatForm] = useState(false);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);

  // Combine static widgets
  const allWidgets = AVAILABLE_WIDGETS;

  const handleAddWidget = () => {
    if (selectedWidget) {
      // For other widget types
      const widget = AVAILABLE_WIDGETS.find(w => w.id === selectedWidget);
      if (widget) {
        if (widget.id === 'webhook' && onAddWebhookWidget) {
          if (!webhookName.trim() || !webhookUrl.trim()) {
            console.error('Please enter both name and URL');
            return;
          }
          onAddWebhookWidget(webhookName, webhookUrl);
        } else if (widget.id === 'email' && onAddEmailWidget) {
          if (!emailName.trim() || !emailUrl.trim()) {
            console.error('Please enter both name and URL');
            return;
          }
          onAddEmailWidget(emailName, emailUrl, emailRefreshInterval);
        } else if (widget.id === 'quick-chat' && onAddQuickChatWidget) {
          if (!quickChatName.trim() || !quickChatUrl.trim()) {
            console.error('Please enter both name and URL');
            return;
          }
          onAddQuickChatWidget(quickChatName, quickChatUrl, quickChatModel, quickChatSystemPrompt, quickChatPrePrompt);
        } else {
          onAddWidget?.(widget.type);
        }
        onClose();
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div 
        className="glassmorphic rounded-2xl shadow-lg w-full max-w-4xl max-h-[80vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex h-full">
          {/* Sidebar */}
          <div className="w-48 flex flex-col h-full border-r border-gray-200/10 dark:border-gray-700/10">
            <div className="p-4 border-b border-gray-200/10 dark:border-gray-700/10">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Add Widget</h2>
            </div>
            
            {/* Categories */}
            <div className="flex-1 p-4 overflow-y-auto">
              <h3 className="text-sm font-semibold mb-4 text-gray-900 dark:text-white">Categories</h3>
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
                <button
                  className={`w-full px-3 py-2 rounded-lg text-left text-sm flex items-center gap-2 transition-colors ${
                    selectedCategory === 'custom'
                      ? 'bg-sakura-500/10 text-sakura-500'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-500/5 dark:hover:bg-gray-300/5'
                  }`}
                  onClick={() => setSelectedCategory('custom')}
                >
                  <LayoutGrid className="w-4 h-4" />
                  Custom Widgets
                </button>
              </div>
            </div>
            
            {/* Action Buttons in Sidebar */}
            <div className="p-4 border-t border-gray-200/10 dark:border-gray-700/10 space-y-2">
              <button
                className={`w-full px-3 py-2 rounded-lg text-white transition-colors text-sm flex items-center justify-center gap-2 ${
                  selectedWidget && 
                  !((selectedWidget === 'webhook' && !webhookName.trim()) ||
                    (selectedWidget === 'email' && !emailName.trim()) ||
                    (selectedWidget === 'quick-chat' && !quickChatName.trim()))
                    ? 'bg-sakura-500 hover:bg-sakura-600 cursor-pointer' 
                    : 'bg-gray-300 dark:bg-gray-700 cursor-not-allowed'
                }`}
                disabled={!selectedWidget || 
                  (selectedWidget === 'webhook' && !webhookName.trim()) ||
                  (selectedWidget === 'email' && !emailName.trim()) ||
                  (selectedWidget === 'quick-chat' && !quickChatName.trim())
                }
                onClick={handleAddWidget}
              >
                Add Widget
              </button>
              <button
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-sm"
                onClick={onClose}
              >
                Cancel
              </button>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 flex flex-col h-full">
            {/* Header */}
            <div className="p-4 border-b border-gray-200/10 dark:border-gray-700/10 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {selectedWidget === 'webhook' ? 'Configure Webhook Widget' : 
                 selectedWidget === 'email' ? 'Configure Email Widget' :
                 selectedWidget === 'quick-chat' ? 'Configure Quick Chat Widget' :
                 'Select Widget'}
              </h2>
              <button 
                className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                onClick={onClose}
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {/* Widget Grid */}
            <div className="flex-1 overflow-y-auto p-4">
              <div className="grid grid-cols-2 gap-4 auto-rows-max max-h-[calc(100vh-20rem)] overflow-y-auto p-1">
                {allWidgets.map(widget => (
                  <div
                    key={widget.id}
                    className={`p-3 rounded-xl cursor-pointer transition-all bg-gray-500/5 dark:bg-gray-300/5 hover:bg-gray-500/10 dark:hover:bg-gray-300/10 h-[160px] flex flex-col ${
                      selectedWidget === widget.id
                        ? 'ring-1 ring-sakura-500'
                        : ''
                    }`}
                    onClick={() => setSelectedWidget(widget.id)}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div className="p-1.5 bg-gray-500/10 dark:bg-gray-300/10 rounded-lg">
                        {widget.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-gray-900 dark:text-white truncate">{widget.name}</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-1">{widget.description}</p>
                      </div>
                    </div>
                    <div className="flex-1 overflow-hidden">{widget.preview}</div>
                  </div>
                ))}
              </div>
              
              {/* Webhook Configuration Form */}
              {selectedWidget === 'webhook' && (
                <div className="mt-6 bg-gray-500/5 dark:bg-gray-300/5 p-4 rounded-lg max-h-[60vh] overflow-y-auto">
                  <h3 className="font-medium text-gray-900 dark:text-white mb-4">Webhook Configuration</h3>
                  
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
              
              {/* Quick Chat Widget Configuration Form */}
              {selectedWidget === 'quick-chat' && (
                <div className="mt-6 bg-gray-500/5 dark:bg-gray-300/5 p-4 rounded-lg max-h-[60vh] overflow-y-auto">
                  <h3 className="font-medium text-gray-900 dark:text-white mb-4">Quick Chat Configuration</h3>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Widget Name</label>
                      <input 
                        type="text"
                        className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg"
                        placeholder="My Quick Chat"
                        value={quickChatName}
                        onChange={(e) => setQuickChatName(e.target.value)}
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Ollama API URL</label>
                      <input 
                        type="text"
                        className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg"
                        placeholder="http://localhost:11434"
                        value={quickChatUrl}
                        onChange={(e) => setQuickChatUrl(e.target.value)}
                      />
                      <p className="text-xs text-gray-500 mt-1">Enter the URL of your Ollama API endpoint</p>
                    </div>

                    <div>
                      <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Model</label>
                      {loadingModels ? (
                        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Loading available models...
                        </div>
                      ) : (
                        <select
                          className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg"
                          value={quickChatModel}
                          onChange={(e) => setQuickChatModel(e.target.value)}
                        >
                          <option value="">Select a model</option>
                          {availableModels.map(model => (
                            <option key={model} value={model}>{model}</option>
                          ))}
                        </select>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
                        System Prompt (optional)
                      </label>
                      <textarea
                        className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg h-24 resize-none"
                        placeholder="Enter a system prompt to set the AI's behavior"
                        value={quickChatSystemPrompt}
                        onChange={(e) => setQuickChatSystemPrompt(e.target.value)}
                      />
                      <p className="text-xs text-gray-500 mt-1">This won't be visible in the chat but will influence how the AI responds</p>
                    </div>

                    <div>
                      <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
                        Pre-Prompt (optional)
                      </label>
                      <textarea
                        className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg h-24 resize-none"
                        placeholder="This text will be prepended to each of your messages"
                        value={quickChatPrePrompt}
                        onChange={(e) => setQuickChatPrePrompt(e.target.value)}
                      />
                      <p className="text-xs text-gray-500 mt-1">This text will be added before each of your messages</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Email Widget Configuration Form */}
              {selectedWidget === 'email' && (
                <div className="mt-6 bg-gray-500/5 dark:bg-gray-300/5 p-4 rounded-lg max-h-[60vh] overflow-y-auto">
                  <h3 className="font-medium text-gray-900 dark:text-white mb-4">Email Widget Configuration</h3>
                  
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
                      <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Auto-Refresh Interval (seconds)</label>
                      <input
                        type="number"
                        className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg"
                        value={emailRefreshInterval}
                        onChange={(e) => setEmailRefreshInterval(Number(e.target.value))}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddWidgetModal;