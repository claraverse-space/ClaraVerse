import { useState } from 'react';
import { Home, Bot, Settings, HelpCircle, ChevronRight, Bug, Grid, ImageIcon } from 'lucide-react';
import logo from '../assets/logo.png';

interface SidebarProps {
  activePage: string;
  onPageChange: (page: string) => void;
}

const Sidebar = ({ activePage = 'dashboard', onPageChange }: SidebarProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const menuItems = [
    { icon: Home, label: 'Dashboard', id: 'dashboard' },
    { icon: Bot, label: 'Chat', id: 'assistant' },
    { icon: Grid, label: 'Apps', id: 'apps' },
    { icon: ImageIcon, label: 'Image Gen', id: 'image-gen' },
    { icon: Settings, label: 'Settings', id: 'settings' },
    { icon: Bug, label: 'Debug', id: 'debug' },
    { icon: HelpCircle, label: 'Help', id: 'help' },
  ];

  return (
    <div
      className={`glassmorphic h-full flex flex-col gap-6 transition-all duration-300 ease-in-out ${
        isExpanded ? 'w-64' : 'w-20'
      }`}
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
    >
      <div className={`flex items-center py-4 ${
        isExpanded ? 'px-4 justify-start gap-3' : 'justify-center'
      }`}>
        <button
          onClick={() => onPageChange('dashboard')}
          className="flex items-center gap-3 hover:opacity-80 transition-opacity"
        >
          <img src={logo} alt="Clara Logo" className="w-8 h-8 flex-shrink-0" />
          <h1 
            className={`text-2xl font-semibold text-gray-800 dark:text-gray-100 whitespace-nowrap overflow-hidden transition-all duration-300 ${
              isExpanded ? 'opacity-100 w-auto' : 'opacity-0 w-0'
            }`}
          >
            Clara
          </h1>
        </button>
      </div>
      
      <nav className="flex-1">
        <ul className="space-y-2 px-2">
          {menuItems.map((item) => (
            <li key={item.id}>
              <button 
                onClick={() => onPageChange(item.id)}
                data-page={item.id}
                className={`w-full flex items-center rounded-lg transition-colors ${
                  isExpanded ? 'px-4 justify-start gap-3' : 'justify-center px-0'
                } ${
                  activePage === item.id
                    ? 'bg-sakura-100 text-sakura-500 dark:bg-sakura-100/10'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-sakura-50 hover:text-sakura-500 dark:hover:bg-sakura-100/10'
                } py-2`}
              >
                <item.icon className="w-5 h-5 flex-shrink-0" />
                <span 
                  className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${
                    isExpanded ? 'opacity-100 w-auto ml-3' : 'opacity-0 w-0'
                  }`}
                >
                  {item.label}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <div 
        className={`absolute top-1/2 -right-3 transform -translate-y-1/2 transition-transform duration-300 ${
          isExpanded ? 'rotate-180' : ''
        }`}
      >
        <div className="bg-sakura-500 rounded-full p-1 shadow-lg cursor-pointer">
          <ChevronRight className="w-4 h-4 text-white" />
        </div>
      </div>
    </div>
  );
};

export default Sidebar;