import React from 'react';
import { Code, Copy, Check } from 'lucide-react';

interface UIElement {
  id: string;
  type: string;
  props: any;
  children?: UIElement[];
}

interface CodePanelProps {
  elements: UIElement[];
}

const CodePanel: React.FC<CodePanelProps> = ({ elements }) => {
  const [copied, setCopied] = React.useState(false);

  const handleCopyCode = () => {
    // Sample code for now - in real implementation, this would be generated from elements
    const sampleCode = `
import React from 'react';

export default function MyCustomUI() {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">My Custom UI</h1>
      {/* Your generated components will appear here */}
    </div>
  );
}
`;
    navigator.clipboard.writeText(sampleCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (elements.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center text-gray-500 dark:text-gray-400">
        <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
          <Code className="w-8 h-8 text-gray-400 dark:text-gray-500" />
        </div>
        <h3 className="text-lg font-medium mb-2 text-gray-700 dark:text-gray-300">
          No code generated yet
        </h3>
        <p className="text-sm max-w-md">
          Add UI components to see the generated React code here.
        </p>
      </div>
    );
  }

  // This would be generated from the elements in a real implementation
  const sampleCode = `
import React from 'react';

export default function MyCustomUI() {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">My Custom UI</h1>
      {/* Your generated components will appear here */}
    </div>
  );
}
`;

  return (
    <div className="p-6 h-full">
      <div className="w-full h-full bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col">
        <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Code className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              React Component
            </span>
          </div>
          <button
            onClick={handleCopyCode}
            className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300"
          >
            {copied ? (
              <>
                <Check className="w-3 h-3" />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
        <div className="overflow-auto flex-1 p-4 bg-gray-50 dark:bg-gray-900 font-mono text-sm">
          <pre className="text-gray-800 dark:text-gray-200">{sampleCode}</pre>
        </div>
      </div>
    </div>
  );
};

export default CodePanel; 