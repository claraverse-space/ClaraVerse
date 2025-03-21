import React, { useState, useEffect } from 'react';
import { 
  Save, X, Activity, FileText, Code, 
  Image, MessageSquare, Database, Globe, Sparkles, 
  Zap, User, Settings, BarChart2, Search, Bot, Brain,
  Command, Book, Layout, Compass, Folder, Plus
} from 'lucide-react';

interface SaveAppModalProps {
  initialName: string;
  initialDescription: string;
  initialIcon?: string;
  initialColor?: string;
  onSave: (name: string, description: string, icon: string, bgColor: string, customIconUrl?: string) => void;
  onCancel: () => void;
}

// Available icons
const availableIcons = [
  { name: 'Activity', component: Activity },
  { name: 'FileText', component: FileText },
  { name: 'Code', component: Code },
  { name: 'Image', component: Image },
  { name: 'MessageSquare', component: MessageSquare },
  { name: 'Database', component: Database },
  { name: 'Globe', component: Globe },
  { name: 'Sparkles', component: Sparkles },
  { name: 'Zap', component: Zap },
  { name: 'User', component: User },
  { name: 'Settings', component: Settings },
  { name: 'Chart', component: BarChart2 },
  { name: 'Search', component: Search },
  { name: 'Bot', component: Bot },
  { name: 'Brain', component: Brain },
  { name: 'Command', component: Command },
  { name: 'Book', component: Book },
  { name: 'Layout', component: Layout },
  { name: 'Compass', component: Compass },
  { name: 'Folder', component: Folder }
];

// Predefined color options
const colorOptions = [
  { name: 'Blue', value: '#3B82F6', textColor: 'white' },
  { name: 'Purple', value: '#8B5CF6', textColor: 'white' },
  { name: 'Pink', value: '#EC4899', textColor: 'white' },
  { name: 'Red', value: '#EF4444', textColor: 'white' },
  { name: 'Orange', value: '#F59E0B', textColor: 'white' },
  { name: 'Green', value: '#10B981', textColor: 'white' },
  { name: 'Teal', value: '#14B8A6', textColor: 'white' },
  { name: 'Indigo', value: '#6366F1', textColor: 'white' },
  { name: 'Yellow', value: '#FBBF24', textColor: 'black' },
  { name: 'Gray', value: '#6B7280', textColor: 'white' }
];

const SaveAppModal: React.FC<SaveAppModalProps> = ({ 
  initialName, 
  initialDescription, 
  initialIcon = 'Activity', 
  initialColor = '#3B82F6', 
  onSave, 
  onCancel 
}) => {
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [selectedIcon, setSelectedIcon] = useState(initialIcon);
  const [selectedColor, setSelectedColor] = useState(initialColor);
  const [activeTab, setActiveTab] = useState('general');
  const [isVisible, setIsVisible] = useState(false);
  
  // States for custom options
  const [customIconUrl, setCustomIconUrl] = useState('');
  const [customColorActive, setCustomColorActive] = useState(false);

  // Animation effect for modal entrance
  useEffect(() => {
    setIsVisible(true);
  }, []);

  // Determine what to show in the header icon preview
  const renderIconPreview = () => {
    if (selectedIcon === 'custom') {
      return customIconUrl ? (
        <img 
          src={customIconUrl} 
          alt="Custom Icon" 
          className="w-12 h-12 object-contain" 
          style={{ filter: 'brightness(0) invert(1)' }}
        />
      ) : (
        <Plus className="w-12 h-12 text-white" />
      );
    }
    const iconObj = availableIcons.find(icon => icon.name === selectedIcon);
    const IconComponent = iconObj?.component || Activity;
    return <IconComponent className="w-12 h-12 text-white" />;
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50">
      <div 
        className="absolute inset-0 bg-black bg-opacity-60 backdrop-blur-sm" 
        onClick={onCancel}
      />
      <div 
        className={`relative glassmorphic dark:bg-gray-800/90 bg-white/95 rounded-lg shadow-xl overflow-hidden 
          w-full max-w-md transform border border-white/20 dark:border-gray-700/50
          ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'} 
          transition-all duration-300 ease-in-out backdrop-blur-md`}
      >
        {/* Preview header */}
        <div 
          className="h-24 flex items-center justify-center relative" 
          style={{ backgroundColor: selectedColor }}
        >
          <div className="absolute top-3 right-3">
            <button 
              onClick={onCancel}
              className="p-1 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
          
          {renderIconPreview()}
        </div>
        
        {/* App name overlay */}
        <div className="absolute top-16 left-0 right-0 flex justify-center">
          <div className="glassmorphic dark:bg-gray-800/90 bg-white/95 shadow-lg rounded-lg px-6 py-3 min-w-[200px] backdrop-blur-md">
            <h2 className="text-center font-bold truncate dark:text-white">{name || 'New App'}</h2>
          </div>
        </div>
        
        {/* Tabs */}
        <div className="flex border-b border-white/20 dark:border-gray-700/50 px-6 pt-8">
          <button
            className={`py-2 px-4 border-b-2 transition-colors ${
              activeTab === 'general'
                ? 'border-sakura-500 text-sakura-600 dark:text-sakura-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
            onClick={() => setActiveTab('general')}
          >
            General
          </button>
          <button
            className={`py-2 px-4 border-b-2 transition-colors ${
              activeTab === 'appearance'
                ? 'border-sakura-500 text-sakura-600 dark:text-sakura-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
            onClick={() => setActiveTab('appearance')}
          >
            Appearance
          </button>
        </div>
        
        {/* Content area */}
        <div className="p-6">
          {activeTab === 'general' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  App Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2 rounded-md border border-gray-300 dark:border-gray-600 
                    bg-white/80 dark:bg-gray-700/80 text-gray-900 dark:text-white 
                    focus:ring-2 focus:ring-sakura-500 focus:border-transparent transition-shadow backdrop-blur-sm"
                  placeholder="Enter app name"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-2 rounded-md border border-gray-300 dark:border-gray-600 
                    bg-white/80 dark:bg-gray-700/80 text-gray-900 dark:text-white 
                    focus:ring-2 focus:ring-sakura-500 focus:border-transparent transition-shadow backdrop-blur-sm"
                  placeholder="What does this app do?"
                />
              </div>
            </div>
          )}
          
          {activeTab === 'appearance' && (
            <div className="space-y-6">
              {/* Icon selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  App Icon
                </label>
                <div className="grid grid-cols-5 gap-3">
                  {availableIcons.map(icon => (
                    <button
                      key={icon.name}
                      onClick={() => setSelectedIcon(icon.name)}
                      className={`p-3 rounded-lg flex items-center justify-center transition-all ${
                        selectedIcon === icon.name 
                          ? 'bg-sakura-100 dark:bg-sakura-900/70 border-2 border-sakura-500' 
                          : 'bg-gray-100/80 dark:bg-gray-700/80 hover:bg-gray-200 dark:hover:bg-gray-600/80 border-2 border-transparent backdrop-blur-sm'
                      }`}
                    >
                      {React.createElement(icon.component, { 
                        className: `w-6 h-6 ${
                          selectedIcon === icon.name 
                            ? 'text-sakura-600 dark:text-sakura-400' 
                            : 'text-gray-600 dark:text-gray-300'
                        }` 
                      })}
                    </button>
                  ))}
                  {/* Custom icon button */}
                  <button
                    onClick={() => setSelectedIcon('custom')}
                    className={`p-3 rounded-lg flex items-center justify-center transition-all ${
                      selectedIcon === 'custom'
                        ? 'bg-sakura-100 dark:bg-sakura-900/70 border-2 border-sakura-500'
                        : 'bg-gray-100/80 dark:bg-gray-700/80 hover:bg-gray-200 dark:hover:bg-gray-600/80 border-2 border-transparent backdrop-blur-sm'
                    }`}
                  >
                    <Plus className="w-6 h-6 text-gray-600 dark:text-gray-300" />
                  </button>
                </div>
                {selectedIcon === 'custom' && (
                  <div className="mt-3">
                    <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
                      Custom Icon URL
                    </label>
                    <input
                      type="text"
                      value={customIconUrl}
                      onChange={(e) => setCustomIconUrl(e.target.value)}
                      placeholder="https://example.com/icon.svg"
                      className="w-full px-4 py-2 rounded-md border border-gray-300 dark:border-gray-600 
                        bg-white/80 dark:bg-gray-700/80 text-gray-900 dark:text-white 
                        focus:ring-2 focus:ring-sakura-500 focus:border-transparent transition-shadow backdrop-blur-sm"
                    />
                  </div>
                )}
              </div>
              
              {/* Color selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Theme Color
                </label>
                <div className="grid grid-cols-5 gap-3">
                  {colorOptions.map(color => (
                    <button
                      key={color.name}
                      onClick={() => {
                        setSelectedColor(color.value);
                        setCustomColorActive(false);
                      }}
                      className={`h-10 rounded-lg transition-all ${
                        selectedColor === color.value 
                          ? 'ring-2 ring-offset-2 ring-sakura-500 dark:ring-offset-gray-800' 
                          : ''
                      }`}
                      style={{ backgroundColor: color.value }}
                      title={color.name}
                    />
                  ))}
                  {/* Custom color button */}
                  <button
                    onClick={() => setCustomColorActive(!customColorActive)}
                    className={`h-10 rounded-lg flex items-center justify-center transition-all border-2 ${
                      customColorActive 
                        ? 'ring-2 ring-offset-2 ring-sakura-500 dark:ring-offset-gray-800' 
                        : 'border-transparent'
                    } bg-gray-100/80 dark:bg-gray-700/80 hover:bg-gray-200 dark:hover:bg-gray-600/80`}
                    title="Custom Color"
                  >
                    <Plus className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                  </button>
                </div>
                {customColorActive && (
                  <div className="mt-3 flex items-center space-x-3">
                    <input
                      type="color"
                      value={selectedColor}
                      onChange={(e) => setSelectedColor(e.target.value)}
                      className="w-10 h-10 p-0 border-0 rounded"
                    />
                    <input
                      type="text"
                      value={selectedColor}
                      onChange={(e) => setSelectedColor(e.target.value)}
                      className="w-full px-2 py-1 rounded-md border border-gray-300 dark:border-gray-600 
                        bg-white/80 dark:bg-gray-700/80 text-gray-900 dark:text-white"
                      placeholder="#HEXCODE"
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        
        {/* Footer buttons */}
        <div className="glassmorphic dark:bg-gray-900/50 bg-white px-6 py-4 flex justify-end gap-3 border-t border-gray-200 dark:border-gray-700/50 backdrop-blur-sm">
          <button 
            onClick={onCancel} 
            className="px-4 py-2 rounded-md border border-gray-300 dark:border-gray-600 
              text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/80 transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={() => onSave(name, description, selectedIcon, selectedColor, customIconUrl)} 
            className="px-4 py-2 rounded-md bg-sakura-500 hover:bg-sakura-600 text-white transition-colors flex items-center gap-2 shadow-sm"
          >
            <Save className="w-4 h-4" />
            Save App
          </button>
        </div>
      </div>
    </div>
  );
};

export default SaveAppModal;
