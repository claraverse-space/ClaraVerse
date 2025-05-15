import React, { useState, useEffect } from 'react';
import { 
  Bot,
  Settings,
  Loader2,
  CheckCircle2,
  XCircle,
  ArrowRight,
  ImageIcon,
  MessageSquare,
  Lightbulb,
  Code,
  FileText,
  Zap,
  Info,
  Star,
  RefreshCw,
  Sparkles,
  Server,
  TerminalSquare,
  Database,
  Trash2,
  Cpu,
  Move,
  Check,
  Plus
} from 'lucide-react';
import { db } from '../db';
import axios from 'axios';
import api from '../services/api'; // Import the API service
import WebhookWidget from './widget-components/WebhookWidget';
import WelcomeWidget from './widget-components/WelcomeWidget';
import WhatsNewWidget from './widget-components/WhatsNewWidget';
import CapabilitiesWidget from './widget-components/CapabilitiesWidget';
import PrivacyWidget from './widget-components/PrivacyWidget';
import WidgetContextMenu from './widget-components/WidgetContextMenu';
import AddWidgetModal from './widget-components/AddWidgetModal';
import EmailWidget from './widget-components/EmailWidget';
import QuickChatWidget from './widget-components/QuickChatWidget';

interface DashboardProps {
  onPageChange?: (page: string) => void;
}

// Default widget configuration for first-time users only
const DEFAULT_WIDGETS = [
  { id: 'welcome', type: 'welcome', order: 0 },
  { id: 'privacy', type: 'privacy', order: 1 }
];

interface Widget {
  id: string;
  type: string;
  name?: string;
  url?: string;
  order: number;
  refreshInterval?: number;
}

interface ContextMenuState {
  x: number;
  y: number;
  show: boolean;
  widgetId?: string;
}

const Dashboard: React.FC<DashboardProps> = ({ onPageChange }) => {
  const [ollamaUrl, setOllamaUrl] = useState('');
  const [isConfiguring, setIsConfiguring] = useState(false);
  const [ollamaStatus, setOllamaStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');
  const [showOllamaUrlInput, setShowOllamaUrlInput] = useState(false);
  const [pythonStatus, setPythonStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');
  const [pythonPort, setPythonPort] = useState<number | null>(null);
  const [isReconnecting, setIsReconnecting] = useState<boolean>(false);
  const [reconnectError, setReconnectError] = useState<string | null>(null);

  // Widget system state
  const [widgets, setWidgets] = useState<Widget[]>(() => {
    // Try to load widgets from localStorage on initialization
    const savedWidgets = localStorage.getItem('dashboard_widgets');
    console.log('Loading widgets from localStorage:', savedWidgets);
    
    if (savedWidgets) {
      try {
        const parsed = JSON.parse(savedWidgets);
        if (Array.isArray(parsed) && parsed.length > 0) {
          console.log('Loaded saved widgets:', parsed);
          return parsed;
        }
      } catch (error) {
        console.error('Error parsing saved widgets:', error);
      }
    }
    
    console.log('Using default widgets');
    return DEFAULT_WIDGETS;
  });
  const [showAddWidget, setShowAddWidget] = useState(false);
  const [newWidgetName, setNewWidgetName] = useState('');
  const [newWidgetUrl, setNewWidgetUrl] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    x: 0,
    y: 0,
    show: false,
    widgetId: undefined
  });

  const [isRearrangeMode, setIsRearrangeMode] = useState(false);
  const [draggedWidget, setDraggedWidget] = useState<string | null>(null);
  const [dragOverWidget, setDragOverWidget] = useState<string | null>(null);

  // Load config and check connections
  useEffect(() => {
    console.log('Initial widgets state:', widgets);
    const loadConfig = async () => {
      const config = await db.getAPIConfig();
      
      if (config?.ollama_base_url) {
        setOllamaUrl(config.ollama_base_url);
        checkOllamaConnection(config.ollama_base_url);
      } else {
        setOllamaStatus('disconnected');
      }
      
      if (window.electron) {
        try {
          const port = await window.electron.getPythonPort();
          setPythonPort(port);
        } catch (error) {
          console.error('Could not get Python port from Electron:', error);
        }
      
        try {
          const backendStatus = await window.electron.checkPythonBackend();
          if (backendStatus.port) {
            setPythonPort(backendStatus.port);
          }
          
          if (backendStatus.status === 'running' && backendStatus.available) {
            setPythonStatus('connected');
          } else {
            checkPythonConnection();
          }
        } catch (error) {
          console.error('Error checking Python backend:', error);
          checkPythonConnection();
        }
      } else {
        checkPythonConnection();
      }
    };
    
    loadConfig();
    
    if (window.electron) {
      const backendStatusListener = (status: any) => {
        if (status.port) {
          setPythonPort(status.port);
        }
        
        if (status.status === 'running') {
          checkPythonConnection();
        } else if (['crashed', 'failed', 'stopped'].includes(status.status)) {
          setPythonStatus('disconnected');
        }
      };
      
      window.electron.receive('backend-status', backendStatusListener);
      return () => {
        window.electron.removeListener('backend-status', backendStatusListener);
      };
    }
  }, []);

  // Save widgets to localStorage whenever they change
  useEffect(() => {
    console.log('Saving widgets to localStorage:', widgets);
    localStorage.setItem('dashboard_widgets', JSON.stringify(widgets));
  }, [widgets]);

  const checkOllamaConnection = async (url: string) => {
    setOllamaStatus('checking');
    try {
      const response = await axios.get(`${url}/api/tags`, { timeout: 5000 });
      if (response.status === 200) {
        setOllamaStatus('connected');
      } else {
        setOllamaStatus('disconnected');
      }
    } catch (error) {
      console.error('Ollama connection error:', error);
      setOllamaStatus('disconnected');
    }
  };

  const checkPythonConnection = async () => {
    setPythonStatus('checking');
    setIsReconnecting(true);
    setReconnectError(null);
    
    try {
      const health = await api.checkHealth();
      
      if (health.status === 'connected') {
        setPythonStatus('connected');
        if (health.port && health.port !== pythonPort) {
          setPythonPort(health.port);
        }
        try {
          const result = await api.getTest();
          if (!result) {
            console.warn('Test endpoint returned empty result');
          }
        } catch (testError) {
          console.warn('Test endpoint error:', testError);
        }
      } else {
        setPythonStatus('disconnected');
        setReconnectError('Failed to connect to Python backend');
      }
    } catch (error: any) {
      console.error('Python backend check failed:', error);
      setPythonStatus('disconnected');
      setReconnectError(error.message);
    } finally {
      setIsReconnecting(false);
    }
  };

  const handleAddWidget = (type: string) => {
    const widgetId = `${type}-${Date.now()}`;
    if (type === 'webhook') {
      // For webhook widgets, show the custom webhook modal
      setShowAddWidget(true);
      return;
    }

    // For other widget types, add them directly
    const newWidget: Widget = {
      id: widgetId,
      type,
      order: widgets.length
    };
    
    console.log('Adding new widget:', newWidget);
    setWidgets(prev => [...prev, newWidget]);
  };

  const handleRemoveWidget = (id: string) => {
    console.log('Attempting to remove widget:', id);
    setWidgets(prev => {
      // Only prevent removal if it's the last widget
      if (prev.length === 1) {
        setShowToast(true);
        setTimeout(() => setShowToast(false), 3000);
        return prev;
      }
      return prev.filter(w => w.id !== id);
    });
  };

  // Sort widgets by order
  const sortedWidgets = [...widgets].sort((a, b) => (a.order || 0) - (b.order || 0));

  const renderWidget = (widget: Widget) => {
    console.log('Attempting to render widget:', widget);
    if (!widget) {
      console.warn('Received undefined or null widget');
      return null;
    }
    if (!widget.type) {
      console.warn('Widget missing type property:', widget);
      return null;
    }

    switch (widget.type) {
      case 'welcome':
        console.log('Rendering welcome widget');
        return (
          <WelcomeWidget
            key={widget.id}
            id={widget.id}
            onRemove={handleRemoveWidget}
            pythonStatus={pythonStatus}
            pythonPort={pythonPort}
            onPageChange={onPageChange}
          />
        );
      case 'whats-new':
        return (
          <WhatsNewWidget
            key={widget.id}
            id={widget.id}
            onRemove={handleRemoveWidget}
          />
        );
      case 'capabilities':
        return (
          <CapabilitiesWidget
            key={widget.id}
            id={widget.id}
            onRemove={handleRemoveWidget}
          />
        );
      case 'privacy':
        return (
          <PrivacyWidget
            key={widget.id}
            id={widget.id}
            onRemove={handleRemoveWidget}
          />
        );
      case 'webhook':
        return (
          <WebhookWidget
            key={widget.id}
            id={widget.id}
            name={widget.name || ''}
            url={widget.url || ''}
            onRemove={handleRemoveWidget}
          />
        );
      case 'quick-chat':
        return (
          <QuickChatWidget
            key={widget.id}
            id={widget.id}
            onRemove={handleRemoveWidget}
          />
        );

      case 'email':
        return (
          <EmailWidget
            key={widget.id}
            id={widget.id}
            name={widget.name || ''}
            url={widget.url || ''}
            onRemove={handleRemoveWidget}
          />
        );
      default:
        console.warn('Unknown widget type:', widget.type);
        return null;
    }
  };

  // Add handler for context menu
  const handleContextMenu = (e: React.MouseEvent, widgetId?: string) => {
    e.preventDefault();
    if (isRearrangeMode) return; // Disable context menu in rearrange mode
    
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      show: true,
      widgetId
    });
  };

  // Close context menu
  const closeContextMenu = () => {
    setContextMenu(prev => ({ ...prev, show: false }));
  };

  // Handle widget reordering with drag and drop
  const handleDragStart = (e: React.DragEvent, id: string) => {
    if (!isRearrangeMode) return;
    setDraggedWidget(id);
    // Create a ghost image
    const ghostImg = document.createElement('div');
    ghostImg.classList.add('opacity-50', 'bg-sakura-100', 'rounded-lg', 'p-4');
    ghostImg.textContent = 'Moving widget...';
    document.body.appendChild(ghostImg);
    e.dataTransfer.setDragImage(ghostImg, 20, 20);
    setTimeout(() => {
      document.body.removeChild(ghostImg);
    }, 0);
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    if (!isRearrangeMode || draggedWidget === id) return;
    setDragOverWidget(id);
  };

  const handleDrop = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    if (!isRearrangeMode || !draggedWidget || draggedWidget === id) return;
    
    setWidgets(prev => {
      const updatedWidgets = [...prev];
      const draggedIndex = updatedWidgets.findIndex(w => w.id === draggedWidget);
      const dropIndex = updatedWidgets.findIndex(w => w.id === id);
      
      if (draggedIndex < 0 || dropIndex < 0) return prev;
      
      // Reorder all widgets with proper order values
      // This ensures consistent ordering is maintained
      const dragged = updatedWidgets[draggedIndex];
      
      // Remove the dragged widget
      updatedWidgets.splice(draggedIndex, 1);
      
      // Insert at the new position
      updatedWidgets.splice(dropIndex, 0, dragged);
      
      // Update all order properties to match the new array order
      return updatedWidgets.map((widget, index) => ({
        ...widget,
        order: index
      }));
    });
    
    setDraggedWidget(null);
    setDragOverWidget(null);
  };

  const handleDragEnd = () => {
    setDraggedWidget(null);
    setDragOverWidget(null);
  };

  const handleAddWebhookWidget = (name: string, url: string) => {
    const widgetId = `webhook-${Date.now()}`;
    const newWidget: Widget = {
      id: widgetId,
      type: 'webhook',
      name,
      url,
      order: widgets.length
    };
    setWidgets(prev => [...prev, newWidget]);
    localStorage.setItem(`webhook_widget_${widgetId}`, JSON.stringify({ name, url }));
    setShowAddWidget(false);
  };

  const handleAddEmailWidget = (name: string, url: string, refreshInterval: number) => {
    const widgetId = `email-${Date.now()}`;
    const newWidget: Widget = {
      id: widgetId,
      type: 'email',
      name,
      url,
      refreshInterval,
      order: widgets.length
    };
    setWidgets(prev => [...prev, newWidget]);
    localStorage.setItem(`email_widget_${widgetId}`, JSON.stringify({ name, url, refreshInterval }));
    setShowAddWidget(false);
  };

  const handleAddQuickChatWidget = (name: string, url: string, model: string) => {
    const widgetId = `quick-chat-${Date.now()}`;
    const newWidget: Widget = {
      id: widgetId,
      type: 'quick-chat',
      name,
      url,
      model,
      order: widgets.length
    };
    setWidgets(prev => [...prev, newWidget]);
    localStorage.setItem(`quick_chat_widget_${widgetId}`, JSON.stringify({ ollamaUrl: url, model }));
    setShowAddWidget(false);
  };

  const toggleRearrangeMode = () => {
    setIsRearrangeMode(!isRearrangeMode);
    if (isRearrangeMode) {
      // When exiting rearrange mode, ensure all widgets have correct order values
      setWidgets(prev => 
        prev.map((widget, index) => ({
          ...widget,
          order: index
        }))
      );
      
      // Reset any drag state
      setDraggedWidget(null);
      setDragOverWidget(null);
    }
  };

  return (
    <div 
      className="h-[calc(100vh-theme(spacing.16)-theme(spacing.12))] overflow-y-auto scrollbar-none"
      onContextMenu={(e) => !isRearrangeMode && handleContextMenu(e)}
    >
      <div className="w-[90%] mx-auto p-6">
        {/* Rearrange Mode Controls */}
        <div className="mb-4 flex justify-between items-center">
          {isRearrangeMode && (
            <button
              className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors bg-sakura-500 text-white"
              onClick={toggleRearrangeMode}
            >
              <Check className="w-4 h-4" />
              Done
            </button>
          )}
        </div>

        {/* Toast Notification */}
        {showToast && (
          <div className="fixed top-4 right-4 bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg animate-fadeIn z-50">
            At least one widget must remain on the dashboard
          </div>
        )}

        {/* Rearrange Mode Instruction */}
        {isRearrangeMode && (
          <div className="mb-4 bg-sakura-500/10 p-4 rounded-lg text-sakura-800 dark:text-sakura-200 text-sm">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4" />
              <span>Drag and drop widgets to rearrange them, then click "Done" when finished.</span>
            </div>
          </div>
        )}

        {/* Render all widgets in their fixed order */}
        <div className="flex flex-col gap-8 relative">
          {sortedWidgets.map(widget => (
            <div 
              key={widget.id} 
              className={`w-full transition-all ${
                isRearrangeMode ? 'cursor-move' : ''
              } ${
                dragOverWidget === widget.id ? 'transform scale-105 opacity-70' : ''
              } ${
                draggedWidget === widget.id ? 'opacity-50' : ''
              }`}
              draggable={isRearrangeMode}
              onDragStart={(e) => handleDragStart(e, widget.id)}
              onDragOver={(e) => handleDragOver(e, widget.id)}
              onDrop={(e) => handleDrop(e, widget.id)}
              onDragEnd={handleDragEnd}
              onContextMenu={(e) => !isRearrangeMode && handleContextMenu(e, widget.id)}
            >
              <div className={`relative ${isRearrangeMode ? 'border-2 border-dashed border-sakura-300 dark:border-sakura-700 rounded-2xl p-1' : ''}`}>
                {isRearrangeMode && (
                  <div className="absolute -top-3 -left-3 z-10 bg-sakura-500 text-white p-1 rounded-full">
                    <Move className="w-4 h-4" />
                  </div>
                )}
                {renderWidget(widget)}
              </div>
            </div>
          ))}
        </div>

        {/* Context Menu */}
        {contextMenu.show && !isRearrangeMode && (
          <WidgetContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            onClose={closeContextMenu}
            onAddWidget={() => setShowAddWidget(true)}
            onRearrangeWidgets={toggleRearrangeMode}
            onRemoveWidget={
              contextMenu.widgetId 
                ? () => handleRemoveWidget(contextMenu.widgetId!)
                : undefined
            }
            showRemove={!!contextMenu.widgetId}
          />
        )}

        {/* Add Widget Modal */}
        {showAddWidget && (
          <AddWidgetModal
            onClose={() => setShowAddWidget(false)}
            onAddWidget={handleAddWidget}
            onAddWebhookWidget={handleAddWebhookWidget}
            onAddEmailWidget={handleAddEmailWidget}
            onAddQuickChatWidget={handleAddQuickChatWidget}
            onAddEmailWidget={(name: string, url: string, refreshInterval: number) => {
              const widgetId = `email-${Date.now()}`;
              const newWidget: Widget = {
                id: widgetId,
                type: 'email',
                name,
                url,
                refreshInterval,
                order: widgets.length
              };
              console.log('Adding new email widget:', newWidget);
              setWidgets(prev => [...prev, newWidget]);
              localStorage.setItem(`email_widget_${widgetId}`, JSON.stringify({ name, url, refreshInterval }));
              setShowAddWidget(false);
            }}
            onAddQuickChatWidget={(name: string, url: string, model: string) => {
              const widgetId = `quick-chat-${Date.now()}`;
              const newWidget: Widget = {
                id: widgetId,
                type: 'quick-chat',
                order: widgets.length
              };
              setWidgets(prev => [...prev, newWidget]);
              localStorage.setItem(`quick_chat_widget_${widgetId}`, JSON.stringify({ ollamaUrl: url, model }));
              setShowAddWidget(false);
            }}
          />
        )}
      </div>
    </div>
  );
};

export default Dashboard;
