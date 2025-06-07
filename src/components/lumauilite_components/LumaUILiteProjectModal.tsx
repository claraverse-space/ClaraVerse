import React, { useState } from 'react';
import { X, Plus, Trash2, Loader2 } from 'lucide-react';
import { LiteProject, LiteProjectFile } from '../LumaUILite';

interface LumaUILiteProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateProject: (project: Omit<LiteProject, 'id' | 'createdAt' | 'lastModified'>) => void;
}

// Predefined project types for quick selection
const PROJECT_TYPES = [
  {
    id: 'landing-page',
    name: 'Landing Page',
    description: 'Marketing landing page with hero section and call-to-action',
    defaultFeatures: ['Hero section', 'Contact form', 'Responsive design']
  },
  {
    id: 'portfolio',
    name: 'Portfolio',
    description: 'Personal portfolio to showcase your work and skills',
    defaultFeatures: ['Project gallery', 'About section', 'Contact form', 'Skills showcase']
  },
  {
    id: 'dashboard',
    name: 'Dashboard',
    description: 'Simple data dashboard with charts and metrics',
    defaultFeatures: ['Data visualization', 'Metrics cards', 'Interactive charts']
  },
  {
    id: 'blog',
    name: 'Blog/Article',
    description: 'Blog or article page with content sections',
    defaultFeatures: ['Article layout', 'Reading time', 'Social sharing', 'Comments section']
  },
  {
    id: 'todo-app',
    name: 'Todo App',
    description: 'Task management application with CRUD operations',
    defaultFeatures: ['Add/remove tasks', 'Mark complete', 'Local storage', 'Filter tasks']
  },
  {
    id: 'calculator',
    name: 'Calculator',
    description: 'Basic calculator with mathematical operations',
    defaultFeatures: ['Basic math operations', 'Memory functions', 'Keyboard support']
  },
  {
    id: 'game',
    name: 'Simple Game',
    description: 'Browser-based game (like tic-tac-toe, memory game)',
    defaultFeatures: ['Game logic', 'Score tracking', 'Reset functionality']
  },
  {
    id: 'custom',
    name: 'Custom Application',
    description: 'Describe your own application idea',
    defaultFeatures: []
  }
];

const LumaUILiteProjectModal: React.FC<LumaUILiteProjectModalProps> = ({
  isOpen,
  onClose,
  onCreateProject
}) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: '',
    customDescription: '',
    features: [] as string[]
  });
  const [newFeature, setNewFeature] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const handleReset = () => {
    setStep(1);
    setFormData({
      name: '',
      description: '',
      type: '',
      customDescription: '',
      features: []
    });
    setNewFeature('');
    setIsGenerating(false);
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const handleTypeSelect = (typeId: string) => {
    const selectedType = PROJECT_TYPES.find(t => t.id === typeId);
    if (selectedType) {
      setFormData(prev => ({
        ...prev,
        type: selectedType.name,
        description: selectedType.description,
        features: [...selectedType.defaultFeatures]
      }));
    }
  };

  const handleAddFeature = () => {
    if (newFeature.trim() && !formData.features.includes(newFeature.trim())) {
      setFormData(prev => ({
        ...prev,
        features: [...prev.features, newFeature.trim()]
      }));
      setNewFeature('');
    }
  };

  const handleRemoveFeature = (index: number) => {
    setFormData(prev => ({
      ...prev,
      features: prev.features.filter((_, i) => i !== index)
    }));
  };

  const generateInitialCode = (projectData: typeof formData) => {
    const isCustom = formData.type === 'Custom Application';
    const appDescription = isCustom ? formData.customDescription : formData.description;
    
    // Generate basic HTML structure
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${projectData.name}</title>
    <link rel="stylesheet" href="styles.css">
</head>
<body>
    <div id="app">
        <header>
            <h1>${projectData.name}</h1>
            <p>${appDescription}</p>
        </header>
        
        <main>
            <section class="content">
                <h2>Welcome to your ${projectData.type}</h2>
                <p>Start building your application by editing the HTML, CSS, and JavaScript files.</p>
                
                ${projectData.features.length > 0 ? `
                <div class="features">
                    <h3>Planned Features:</h3>
                    <ul>
                        ${projectData.features.map(feature => `<li>${feature}</li>`).join('\n                        ')}
                    </ul>
                </div>
                ` : ''}
            </section>
        </main>
        
        <footer>
            <p>Built with LumaUI-lite</p>
        </footer>
    </div>
    
    <script src="script.js"></script>
</body>
</html>`;

    // Generate basic CSS
    const css = `/* ${projectData.name} Styles */
* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    line-height: 1.6;
    color: #333;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    min-height: 100vh;
}

#app {
    max-width: 1200px;
    margin: 0 auto;
    padding: 20px;
    background: rgba(255, 255, 255, 0.95);
    border-radius: 15px;
    box-shadow: 0 8px 32px rgba(31, 38, 135, 0.37);
    backdrop-filter: blur(4px);
    border: 1px solid rgba(255, 255, 255, 0.18);
    margin-top: 40px;
}

header {
    text-align: center;
    margin-bottom: 2rem;
    padding: 2rem 0;
    border-bottom: 2px solid #f0f0f0;
}

header h1 {
    color: #2c3e50;
    font-size: 2.5rem;
    margin-bottom: 0.5rem;
    font-weight: 700;
}

header p {
    color: #7f8c8d;
    font-size: 1.1rem;
}

main {
    padding: 2rem 0;
}

.content {
    background: #f8f9fa;
    padding: 2rem;
    border-radius: 10px;
    border-left: 4px solid #667eea;
}

.content h2 {
    color: #2c3e50;
    margin-bottom: 1rem;
    font-size: 1.8rem;
}

.content p {
    color: #555;
    margin-bottom: 1.5rem;
    font-size: 1.1rem;
}

.features {
    background: white;
    padding: 1.5rem;
    border-radius: 8px;
    margin-top: 1.5rem;
    border: 1px solid #e9ecef;
}

.features h3 {
    color: #495057;
    margin-bottom: 1rem;
    font-size: 1.3rem;
}

.features ul {
    list-style: none;
}

.features li {
    padding: 0.5rem 0;
    border-bottom: 1px solid #f8f9fa;
    position: relative;
    padding-left: 1.5rem;
}

.features li:before {
    content: "✓";
    position: absolute;
    left: 0;
    color: #28a745;
    font-weight: bold;
}

.features li:last-child {
    border-bottom: none;
}

footer {
    text-align: center;
    margin-top: 2rem;
    padding-top: 2rem;
    border-top: 2px solid #f0f0f0;
    color: #7f8c8d;
}

/* Responsive Design */
@media (max-width: 768px) {
    #app {
        margin: 20px;
        padding: 15px;
    }
    
    header h1 {
        font-size: 2rem;
    }
    
    .content {
        padding: 1.5rem;
    }
}`;

    // Generate basic JavaScript
    const js = `// ${projectData.name} JavaScript
console.log('${projectData.name} loaded successfully!');

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM Content Loaded');
    
    // Add your application logic here
    initializeApp();
});

function initializeApp() {
    console.log('Initializing ${projectData.name}...');
    
    // Example: Add click event to header
    const header = document.querySelector('header h1');
    if (header) {
        header.addEventListener('click', function() {
            alert('Welcome to ${projectData.name}!');
        });
    }
    
    // Add your features implementation here:
    ${projectData.features.map(feature => `// TODO: Implement ${feature}`).join('\n    ')}
    
    console.log('${projectData.name} initialized successfully!');
}

// Utility functions
function showMessage(message, type = 'info') {
    console.log(\`[\${type.toUpperCase()}] \${message}\`);
    // TODO: Implement visual notifications
}

// Add more utility functions as needed`;

    return { html, css, js };
  };

  const handleCreateProject = async () => {
    if (!formData.name.trim()) {
      alert('Please enter a project name');
      return;
    }

    if (!formData.type) {
      alert('Please select a project type');
      return;
    }

    if (formData.type === 'Custom Application' && !formData.customDescription.trim()) {
      alert('Please describe your custom application');
      return;
    }

    setIsGenerating(true);

    // Simulate generation delay for better UX
    await new Promise(resolve => setTimeout(resolve, 1500));

    const files = generateInitialCode(formData);

    const projectData = {
      name: formData.name.trim(),
      description: formData.type === 'Custom Application' ? formData.customDescription : formData.description,
      type: formData.type,
      features: formData.features,
      files: {
        html: files.html,
        css: files.css,
        js: files.js
      },
      projectFiles: [] // Will be populated in handleCreateProject
    };

    onCreateProject(projectData);
    handleReset();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="glassmorphic max-w-4xl w-full max-h-[90vh] overflow-auto rounded-2xl border border-white/30 dark:border-gray-700/50">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/20 dark:border-gray-700/50">
          <div>
            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">
              {step === 1 ? 'Create New Project' : 'Customize Your Project'}
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {step === 1 ? 'Choose what kind of application you want to build' : 'Add features and customize your project'}
            </p>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {step === 1 ? (
            /* Step 1: Project Type Selection */
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Project Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="My Awesome App"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
                  Choose Application Type *
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {PROJECT_TYPES.map((type) => (
                    <button
                      key={type.id}
                      onClick={() => handleTypeSelect(type.id)}
                      className={`text-left p-4 rounded-lg border-2 transition-all ${
                        formData.type === type.name
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-200 dark:border-gray-600 hover:border-blue-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                      }`}
                    >
                      <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-2">
                        {type.name}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {type.description}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              {formData.type === 'Custom Application' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Describe Your Application *
                  </label>
                  <textarea
                    value={formData.customDescription}
                    onChange={(e) => setFormData(prev => ({ ...prev, customDescription: e.target.value }))}
                    placeholder="Describe what your application will do, its main features, and any specific requirements..."
                    rows={4}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  />
                </div>
              )}
            </div>
          ) : (
            /* Step 2: Features Customization */
            <div className="space-y-6">
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                <h3 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">
                  {formData.name} - {formData.type}
                </h3>
                <p className="text-sm text-blue-600 dark:text-blue-300">
                  {formData.type === 'Custom Application' ? formData.customDescription : formData.description}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
                  Features & Requirements
                </label>
                
                {/* Add Feature Input */}
                <div className="flex gap-2 mb-4">
                  <input
                    type="text"
                    value={newFeature}
                    onChange={(e) => setNewFeature(e.target.value)}
                    placeholder="Add a feature or requirement..."
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    onKeyPress={(e) => e.key === 'Enter' && handleAddFeature()}
                  />
                  <button
                    onClick={handleAddFeature}
                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                {/* Features List */}
                {formData.features.length > 0 && (
                  <div className="space-y-2">
                    {formData.features.map((feature, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600"
                      >
                        <span className="text-gray-800 dark:text-gray-200">{feature}</span>
                        <button
                          onClick={() => handleRemoveFeature(index)}
                          className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {formData.features.length === 0 && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    No features added yet. Add some features to help guide the code generation.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-white/20 dark:border-gray-700/50">
          <div className="flex items-center gap-2">
            {step === 2 && (
              <button
                onClick={() => setStep(1)}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Back
              </button>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={handleClose}
              className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            
            {step === 1 ? (
              <button
                onClick={() => setStep(2)}
                disabled={!formData.name.trim() || !formData.type || (formData.type === 'Custom Application' && !formData.customDescription.trim())}
                className="px-6 py-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg hover:from-blue-600 hover:to-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                Next: Customize
              </button>
            ) : (
              <button
                onClick={handleCreateProject}
                disabled={isGenerating}
                className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg hover:from-blue-600 hover:to-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  'Create Project'
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LumaUILiteProjectModal; 