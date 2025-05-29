import React, { useState, useEffect } from 'react';
import { Responsive, WidthProvider } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
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
  Plus,
  AppWindow,
  Search,
  SlidersHorizontal,
  Grid,
  Layers,
  MoreVertical,
  Activity,
  Globe,
  User,
  Brain,
  Command,
  Book,
  Layout,
  Compass,
  Copy,
  Edit,
  X
} from 'lucide-react';
import { db } from '../db';
import axios from 'axios';
import api from '../services/api';
import WebhookWidget from './widget-components/WebhookWidget';
import WelcomeWidget from './widget-components/WelcomeWidget';
import WhatsNewWidget from './widget-components/WhatsNewWidget';
import CapabilitiesWidget from './widget-components/CapabilitiesWidget';
import PrivacyWidget from './widget-components/PrivacyWidget';
import WidgetContextMenu from './widget-components/WidgetContextMenu';
import AddWidgetModal from './widget-components/AddWidgetModal';
import EmailWidget from './widget-components/EmailWidget';
import QuickChatWidget from './widget-components/QuickChatWidget';
import AppWidget from './widget-components/AppWidget';
import ResizableWidget, { 
  WIDGET_SIZE_CONSTRAINTS, 
  DEFAULT_SIZE_CONSTRAINTS 
} from './widget-components/ResizableWidget';
import { useTheme } from '../hooks/useTheme';

// Extend Window interface to include electron
declare global {
  interface Window {
    electron: {
      getWorkflowsPath: () => Promise<string>;
      getPythonPort: () => Promise<number>;
      checkPythonBackend: () => Promise<{ port: number; status: string; available: boolean }>;
      receive: (channel: string, func: (data: any) => void) => void;
      removeListener: (channel: string, func: (data: any) => void) => void;
    };
  }
}

interface DashboardProps {
  onPageChange?: (page: string) => void;
}

// Default widget configuration for first-time users only
const DEFAULT_WIDGETS = [
  { id: 'privacy', type: 'privacy', order: 2, w: 12, h: 2 },
  { id: 'whats-new', type: 'whats-new', order: 1, w: 12, h: 2 },
  { id: 'welcome', type: 'welcome', order: 0, w: 12, h: 2 },
];

interface Widget {
  id: string;
  type: string;
  name?: string;
  url?: string;
  order: number;
  refreshInterval?: number;
  appId?: string;
  appName?: string;
  appDescription?: string;
  appIcon?: string;
  model?: string; // Add model property for quick chat widgets
  // Add layout properties
  x?: number;
  y?: number;
  w?: number;
  h?: number;
}

interface ContextMenuState {
  x: number;
  y: number;
  show: boolean;
  widgetId?: string;
}

const ResponsiveGridLayout = WidthProvider(Responsive);

const Dashboard: React.FC<DashboardProps> = ({ onPageChange }) => {
  const { isDark } = useTheme();
  const [ollamaUrl, setOllamaUrl] = useState('');
  const [isConfiguring, setIsConfiguring] = useState(false);
  const [ollamaStatus, setOllamaStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');
  const [showOllamaUrlInput, setShowOllamaUrlInput] = useState(false);
  const [pythonStatus, setPythonStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');
  const [pythonPort, setPythonPort] = useState<number | null>(null);
  const [isReconnecting, setIsReconnecting] = useState<boolean>(false);
  const [reconnectError, setReconnectError] = useState<string | null>(null);
  const [wallpaperUrl, setWallpaperUrl] = useState<string | null>(null);

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

  // Load user name from database
  const [userName, setUserName] = useState<string>('');

  // Add loading state for initial widget load
  const [isLoadingWidgets, setIsLoadingWidgets] = useState(true);

  // Simulate initial loading (you can replace this with actual loading logic)
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoadingWidgets(false);
    }, 800);
    return () => clearTimeout(timer);
  }, []);

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

  // Load user name from database
  useEffect(() => {
    const loadUserName = async () => {
      const personalInfo = await db.getPersonalInfo();
      if (personalInfo?.name) {
        // Capitalize first letter, rest lowercase
        const formattedName = personalInfo.name.charAt(0).toUpperCase() + personalInfo.name.slice(1).toLowerCase();
        setUserName(formattedName);
      }
    };
    loadUserName();
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

  // Add useEffect to scroll to top on mount
  useEffect(() => {
    window.scrollTo(0, 0);
    // Alternative: scroll the dashboard container to top
    const dashboardContainer = document.getElementById('dashboard-container');
    if (dashboardContainer) {
      dashboardContainer.scrollTop = 0;
    }
  }, []);

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

  const handleAddWidget = (type: string, data?: any) => {
    const widgetId = `${type}-${Date.now()}`;
    if (type === 'webhook') {
      // For webhook widgets, show the custom webhook modal
      setShowAddWidget(true);
      return;
    }

    // For app widgets, use the provided data
    if (type === 'app' && data) {
      const newWidget: Widget = {
        id: widgetId,
        type: 'app',
        appId: data.appId,
        appName: data.appName,
        appDescription: data.appDescription,
        appIcon: data.appIcon,
        order: widgets.length
      };
      console.log('Adding new app widget:', newWidget);
      setWidgets(prev => [...prev, newWidget]);
      // Automatically enter rearrange mode after adding widget
      setIsRearrangeMode(true);
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
    // Automatically enter rearrange mode after adding widget
    setIsRearrangeMode(true);
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

  // Grid layout configuration
  const layouts = {
    lg: widgets.map((widget, index) => {
      const constraints = WIDGET_SIZE_CONSTRAINTS[widget.type as keyof typeof WIDGET_SIZE_CONSTRAINTS] || DEFAULT_SIZE_CONSTRAINTS;
      return {
        i: widget.id,
        x: widget.x ?? (index % 3) * 4, // Use nullish coalescing to only use default if x is null/undefined
        y: widget.y ?? Math.floor(index / 3) * 4, // Use nullish coalescing to only use default if y is null/undefined
        w: widget.w || constraints.minW,
        h: widget.h || constraints.minH,
        minW: constraints.minW,
        minH: constraints.minH,
        maxW: constraints.maxW,
        maxH: constraints.maxH,
        static: !isRearrangeMode // Make widgets static when not in rearrange mode
      };
    })
  };

  // Handle layout change
  const handleLayoutChange = (layout: any[], layouts: any) => {
    // Only update positions if in rearrange mode to prevent unwanted position changes
    if (isRearrangeMode) {
      const updatedWidgets = widgets.map(widget => {
        const layoutItem = layout.find(item => item.i === widget.id);
        if (layoutItem) {
          return {
            ...widget,
            x: layoutItem.x,
            y: layoutItem.y,
            w: layoutItem.w,
            h: layoutItem.h
          };
        }
        return widget;
      });
      setWidgets(updatedWidgets);
    }
  };

  // Handle widget resize
  const handleWidgetResize = (id: string, dimensions: { width: number; height: number }) => {
    setWidgets(prev => prev.map(widget => {
      if (widget.id === id) {
        return {
          ...widget,
          w: Math.ceil(dimensions.width / 100), // Convert pixels to grid units
          h: Math.ceil(dimensions.height / 100)  // Convert pixels to grid units
        };
      }
      return widget;
    }));
  };

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

    // Get current size from layout
    const layout = layouts.lg.find(l => l.i === widget.id);
    const currentSize = {
      w: layout?.w || 4,
      h: layout?.h || 4
    };

    const handleSizePresetSelect = (preset: { w: number; h: number }) => {
      setWidgets(prev => prev.map(w => {
        if (w.id === widget.id) {
          return {
            ...w,
            w: preset.w,
            h: preset.h
          };
        }
        return w;
      }));
    };

    const wrapWithResizable = (component: React.ReactNode) => (
      <ResizableWidget
        key={widget.id}
        className="glassmorphic rounded-2xl transition-all duration-300 hover:shadow-2xl hover:shadow-sakura-500/10 hover:-translate-y-1 hover:scale-[1.02] group"
        isRearrangeMode={isRearrangeMode}
        onSizePresetSelect={handleSizePresetSelect}
        currentSize={currentSize}
        widgetType={widget.type}
      >
        <div className="relative overflow-hidden rounded-2xl h-full">
          {/* Subtle gradient overlay on hover */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
          {component}
        </div>
      </ResizableWidget>
    );

    switch (widget.type) {
      case 'welcome':
        return wrapWithResizable(
          <WelcomeWidget
            id={widget.id}
            onRemove={handleRemoveWidget}
            pythonStatus={pythonStatus}
            pythonPort={pythonPort}
            onPageChange={onPageChange}
          />
        );
      case 'whats-new':
        return wrapWithResizable(
          <WhatsNewWidget
            id={widget.id}
            onRemove={handleRemoveWidget}
          />
        );
      case 'capabilities':
        return wrapWithResizable(
          <CapabilitiesWidget
            id={widget.id}
            onRemove={handleRemoveWidget}
          />
        );
      case 'privacy':
        return wrapWithResizable(
          <PrivacyWidget
            id={widget.id}
            onRemove={handleRemoveWidget}
          />
        );
      case 'webhook':
        return wrapWithResizable(
          <WebhookWidget
            id={widget.id}
            name={widget.name || ''}
            url={widget.url || ''}
            onRemove={handleRemoveWidget}
          />
        );
      case 'quick-chat':
        return wrapWithResizable(
          <QuickChatWidget
            id={widget.id}
            onRemove={handleRemoveWidget}
          />
        );
      case 'email':
        return wrapWithResizable(
          <EmailWidget
            id={widget.id}
            name={widget.name || ''}
            url={widget.url || ''}
            onRemove={handleRemoveWidget}
          />
        );
      case 'app':
        return wrapWithResizable(
          <AppWidget
            id={widget.id}
            appId={widget.appId || ''}
            name={widget.appName || ''}
            description={widget.appDescription || ''}
            icon={widget.appIcon}
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
    // Automatically enter rearrange mode after adding widget
    setIsRearrangeMode(true);
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
    // Automatically enter rearrange mode after adding widget
    setIsRearrangeMode(true);
  };

  const handleAddQuickChatWidget = (name: string, url: string, model: string, systemPrompt: string = '', prePrompt: string = '') => {
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
    localStorage.setItem(`quick_chat_widget_${widgetId}`, JSON.stringify({ 
      ollamaUrl: url, 
      model,
      systemPrompt,
      prePrompt
    }));
    setShowAddWidget(false);
    // Automatically enter rearrange mode after adding widget
    setIsRearrangeMode(true);
  };

  const toggleRearrangeMode = () => {
    if (isRearrangeMode) {
      // When exiting rearrange mode, ensure all widgets have correct order values
      // but preserve their x,y positions
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
    setIsRearrangeMode(!isRearrangeMode);
  };

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

  return (
    <div 
      id="dashboard-container"
      className="h-[calc(100vh-theme(spacing.16)-theme(spacing.12))] overflow-y-auto scrollbar-none relative"
      onContextMenu={(e) => {
        e.preventDefault();
        handleContextMenu(e);
      }}
    >
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
      
      <div className="relative z-10">
        {/* Rearrange Mode Controls */}
        <div id="dashboard-header" className="mb-6 flex justify-between items-start px-4 pt-6 group">
          {/* Enhanced Greeting Section */}
          <div id="greeting-message" className="py-4 flex-1">
            <div className="space-y-2">
              <h2 className="text-5xl font-extrabold text-gray-800 dark:text-gray-100 font-sans leading-tight" 
                  style={{ 
                    textShadow: '0 2px 4px rgba(0,0,0,0.1)', 
                    letterSpacing: '-0.02em' 
                  }}>
                Hi, <span className="bg-gradient-to-r from-sakura-500 via-pink-500 to-purple-500 bg-clip-text text-transparent animate-gradient-x">
                  {userName || 'there'}
                </span> 
              </h2>
              <p className="text-lg text-gray-600 dark:text-gray-300 font-medium opacity-80">
                Welcome back to your personalized workspace
              </p>
            </div>
          </div>

          {/* Enhanced Control Buttons */}
          <div className={`flex items-center gap-3 transition-all duration-300 ${
            isRearrangeMode ? 'opacity-100 scale-100' : 'opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100'
          }`}> 
            <button
              className={`flex items-center gap-2 px-5 py-3 rounded-xl font-medium transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105 ${
                isRearrangeMode 
                  ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-green-500/25' 
                  : 'bg-gradient-to-r from-sakura-500 to-pink-500 text-white shadow-sakura-500/25'
              }`}
              onClick={toggleRearrangeMode}
            >
              {isRearrangeMode ? (
                <>
                  <Check className="w-4 h-4" />
                  Done Arranging
                </>
              ) : (
                <>
                  <Move className="w-4 h-4" />
                  Rearrange
                </>
              )}
            </button>
            <button
              className="flex items-center gap-2 px-5 py-3 rounded-xl font-medium transition-all duration-200 bg-gradient-to-r from-violet-500 to-purple-500 text-white shadow-lg hover:shadow-xl shadow-violet-500/25 transform hover:scale-105"
              onClick={() => setShowAddWidget(true)}
            >
              <Plus className="w-4 h-4" />
              Add Widget
            </button>
          </div>
        </div>

        {/* Enhanced Toast Notification */}
        {showToast && (
          <div className="fixed top-6 right-6 z-50 animate-slideInRight">
            <div className="glassmorphic rounded-xl shadow-2xl border border-red-200/20 dark:border-red-800/20 p-4 max-w-sm">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 bg-red-100 dark:bg-red-900/30 rounded-lg flex items-center justify-center">
                  <Info className="w-4 h-4 text-red-500" />
                </div>
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900 dark:text-white text-sm mb-1">
                    Cannot Remove Widget
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    At least one widget must remain on your dashboard
                  </p>
                </div>
                <button 
                  onClick={() => setShowToast(false)}
                  className="flex-shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Enhanced Grid Layout */}
        <div className="px-4">
          {isLoadingWidgets ? (
            // Skeleton Loading State
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {[1, 2, 3].map((i) => (
                <div key={i} className="glassmorphic rounded-2xl p-6 animate-pulse">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-gray-300 dark:bg-gray-600 rounded-lg"></div>
                    <div className="flex-1">
                      <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded mb-2"></div>
                      <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded"></div>
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-5/6"></div>
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-4/6"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : widgets.length === 0 ? (
            // Empty State
            <div className="flex flex-col items-center justify-center py-20 px-4">
              <div className="glassmorphic rounded-3xl p-12 text-center max-w-md">
                <div className="w-20 h-20 bg-gradient-to-br from-sakura-100 to-pink-100 dark:from-sakura-900/30 dark:to-pink-900/30 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <Grid className="w-10 h-10 text-sakura-500" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
                  Your Dashboard Awaits
                </h3>
                <p className="text-gray-600 dark:text-gray-300 mb-6 leading-relaxed">
                  Start building your personalized workspace by adding your first widget. Choose from productivity tools, data displays, and more.
                </p>
                <button
                  onClick={() => setShowAddWidget(true)}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-sakura-500 to-pink-500 text-white rounded-xl font-medium shadow-lg hover:shadow-xl shadow-sakura-500/25 transition-all duration-200 hover:scale-105"
                >
                  <Plus className="w-5 h-5" />
                  Add Your First Widget
                </button>
              </div>
            </div>
          ) : (
            <ResponsiveGridLayout
              className="layout"
              layouts={layouts}
              breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
              cols={{ lg: 12, md: 12, sm: 12, xs: 12, xxs: 12 }}
              rowHeight={100}
              margin={[20, 20]}
              containerPadding={[0, 0]}
              onLayoutChange={handleLayoutChange}
              isDraggable={isRearrangeMode}
              isResizable={false}
              useCSSTransforms={true}
              preventCollision={false}
              compactType="vertical"
            >
              {widgets.map(widget => (
                <div 
                  key={widget.id} 
                  className="widget-container"
                  onContextMenu={(e) => handleContextMenu(e, widget.id)}
                >
                  {renderWidget(widget)}
                </div>
              ))}
            </ResponsiveGridLayout>
          )}
        </div>
      </div>

      {/* Context Menu */}
      {contextMenu.show && (
        <WidgetContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={closeContextMenu}
          onAddWidget={() => setShowAddWidget(true)}
          onRearrangeWidgets={toggleRearrangeMode}
          onSetWallpaper={handleSetWallpaper}
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
          onResetDefault={() => {
            setWidgets(DEFAULT_WIDGETS);
            localStorage.setItem('dashboard_widgets', JSON.stringify(DEFAULT_WIDGETS));
            setShowAddWidget(false);
          }}
        />
      )}

      {/* Quick Actions Floating Button */}
      {!isRearrangeMode && (
        <div className="fixed bottom-6 right-6 z-40">
          <div className="relative group">
            <button
              className="w-14 h-14 bg-gradient-to-r from-sakura-500 to-pink-500 rounded-full shadow-lg hover:shadow-xl shadow-sakura-500/25 flex items-center justify-center transition-all duration-300 hover:scale-110 group"
              onClick={() => setShowAddWidget(true)}
            >
              <Plus className="w-6 h-6 text-white" />
            </button>
            
            {/* Tooltip */}
            <div className="absolute bottom-full right-0 mb-2 px-3 py-1.5 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap">
              Add Widget
              <div className="absolute top-full right-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900 dark:border-t-gray-100"></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
