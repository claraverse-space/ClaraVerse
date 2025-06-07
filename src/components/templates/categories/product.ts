import { ApplicationTemplate, TemplateFile } from '../index';

const generateTaskManagerApp = (frameworkId: string, projectName: string): TemplateFile[] => {
  const files: TemplateFile[] = [];

  if (frameworkId === 'react-vite-tailwind') {
    files.push({
      path: 'src/components/TaskBoard.tsx',
      type: 'file',
      content: `import React, { useState } from 'react';
import { Plus, MoreHorizontal, Calendar, User, Flag } from 'lucide-react';

interface Task {
  id: string;
  title: string;
  description: string;
  status: 'todo' | 'in-progress' | 'done';
  priority: 'low' | 'medium' | 'high';
  assignee: string;
  dueDate: string;
}

const TaskBoard: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([
    {
      id: '1',
      title: 'Design Landing Page',
      description: 'Create a modern landing page design',
      status: 'todo',
      priority: 'high',
      assignee: 'John Doe',
      dueDate: '2024-02-15'
    },
    {
      id: '2',
      title: 'Implement Authentication',
      description: 'Add user login and registration',
      status: 'in-progress',
      priority: 'medium',
      assignee: 'Jane Smith',
      dueDate: '2024-02-20'
    },
    {
      id: '3',
      title: 'Setup Database',
      description: 'Configure PostgreSQL database',
      status: 'done',
      priority: 'high',
      assignee: 'Mike Johnson',
      dueDate: '2024-02-10'
    }
  ]);

  const [showNewTaskForm, setShowNewTaskForm] = useState(false);

  const columns = [
    { id: 'todo', title: 'To Do', color: 'bg-gray-100 border-gray-300' },
    { id: 'in-progress', title: 'In Progress', color: 'bg-blue-100 border-blue-300' },
    { id: 'done', title: 'Done', color: 'bg-green-100 border-green-300' }
  ];

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-600 bg-red-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'low': return 'text-green-600 bg-green-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Project Tasks</h1>
        <p className="text-gray-600">Manage your project tasks efficiently</p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {columns.map((column) => (
          <div key={column.id} className="bg-white rounded-lg shadow-sm border-2 border-dashed p-4 min-h-[400px]">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-700">{column.title}</h2>
              <span className="text-sm text-gray-500">
                {tasks.filter(task => task.status === column.id).length}
              </span>
            </div>

            <div className="space-y-3">
              {tasks
                .filter(task => task.status === column.id)
                .map((task) => (
                  <div
                    key={task.id}
                    className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-medium text-gray-900 text-sm">{task.title}</h3>
                      <button className="text-gray-400 hover:text-gray-600">
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                    </div>
                    
                    <p className="text-xs text-gray-600 mb-3">{task.description}</p>
                    
                    <div className="flex items-center justify-between">
                      <span className={\`text-xs px-2 py-1 rounded-full font-medium \${getPriorityColor(task.priority)}\`}>
                        {task.priority}
                      </span>
                      <div className="flex items-center text-xs text-gray-500">
                        <Calendar className="w-3 h-3 mr-1" />
                        {task.dueDate}
                      </div>
                    </div>
                    
                    <div className="flex items-center mt-2 pt-2 border-t border-gray-100">
                      <User className="w-3 h-3 text-gray-400 mr-1" />
                      <span className="text-xs text-gray-600">{task.assignee}</span>
                    </div>
                  </div>
                ))}

              {column.id === 'todo' && (
                <button 
                  onClick={() => setShowNewTaskForm(true)}
                  className="w-full border-2 border-dashed border-gray-300 rounded-lg p-4 text-gray-500 hover:border-gray-400 hover:text-gray-600 transition-colors flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add new task
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TaskBoard;`
    });

    files.push({
      path: 'src/App.tsx',
      type: 'file',
      overwrite: true,
      content: `import React from 'react';
import TaskBoard from './components/TaskBoard';
import './App.css';

function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <TaskBoard />
    </div>
  );
}

export default App;`
    });
  }

  return files;
};

export const productTemplates: ApplicationTemplate[] = [
  {
    id: 'task-manager',
    name: 'Task Management App',
    description: 'Kanban-style task management application with drag-and-drop functionality',
    icon: '📋',
    category: 'product',
    tags: ['productivity', 'tasks', 'kanban', 'project-management'],
    difficulty: 'intermediate',
    estimatedTime: '10 minutes',
    features: [
      'Kanban board layout',
      'Task cards with priority levels',
      'Due date tracking',
      'Assignee management',
      'Responsive design'
    ],
    frameworks: ['react-vite-tailwind'],
    generateFiles: generateTaskManagerApp
  }
]; 