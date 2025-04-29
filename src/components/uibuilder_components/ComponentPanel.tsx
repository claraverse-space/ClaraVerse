import React from 'react';
import { 
  Type, 
  FormInput, 
  Mail, 
  Phone, 
  FileText, 
  Calendar, 
  Check, 
  ToggleLeft,
  Radio, 
  List, 
  Grid as GridIcon, 
  Table, 
  Image, 
  Square, 
  AlignLeft,
  Heading,
  LayoutGrid,
  AlertTriangle,
  Bell
} from 'lucide-react';

interface ComponentPanelProps {
  onSelectElement: (id: string) => void;
}

// Types of UI components
const componentCategories = [
  {
    name: 'Inputs',
    components: [
      { id: 'text-input', name: 'Text Input', icon: FormInput },
      { id: 'email-input', name: 'Email', icon: Mail },
      { id: 'phone-input', name: 'Phone', icon: Phone },
      { id: 'textarea', name: 'Text Area', icon: AlignLeft },
      { id: 'file-input', name: 'File Upload', icon: FileText },
      { id: 'date-picker', name: 'Date Picker', icon: Calendar },
      { id: 'checkbox', name: 'Checkbox', icon: Check },
      { id: 'toggle', name: 'Toggle', icon: ToggleLeft },
      { id: 'radio', name: 'Radio', icon: Radio },
    ]
  },
  {
    name: 'Display',
    components: [
      { id: 'text', name: 'Text', icon: Type },
      { id: 'heading', name: 'Heading', icon: Heading },
      { id: 'list', name: 'List', icon: List },
      { id: 'table', name: 'Table', icon: Table },
      { id: 'image', name: 'Image', icon: Image },
      { id: 'card', name: 'Card', icon: GridIcon },
      { id: 'alert', name: 'Alert', icon: AlertTriangle },
      { id: 'notification', name: 'Notification', icon: Bell },
    ]
  },
  {
    name: 'Actions',
    components: [
      { id: 'button', name: 'Button', icon: Square },
      { id: 'button-group', name: 'Button Group', icon: GridIcon },
    ]
  },
  {
    name: 'Layout',
    components: [
      { id: 'container', name: 'Container', icon: LayoutGrid },
      { id: 'grid', name: 'Grid', icon: GridIcon },
      { id: 'form', name: 'Form', icon: FileText },
    ]
  }
];

const ComponentPanel: React.FC<ComponentPanelProps> = ({ onSelectElement }) => {
  return (
    <div className="space-y-6">
      {componentCategories.map((category) => (
        <div key={category.name} className="space-y-2">
          <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            {category.name}
          </h4>
          <div className="space-y-1">
            {category.components.map((component) => (
              <div
                key={component.id}
                onClick={() => onSelectElement(component.id)}
                className="flex items-center gap-2 p-2 text-sm rounded-lg cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300"
              >
                <component.icon className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                <span>{component.name}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default ComponentPanel; 