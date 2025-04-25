import React, { useState } from 'react';
import { X, Workflow } from 'lucide-react';
import { db } from '../../db';

interface WorkflowToolModalProps {
  isOpen: boolean;
  onClose: () => void;
  onToolCreated: () => void;
}

export const WorkflowToolModal: React.FC<WorkflowToolModalProps> = ({ isOpen, onClose, onToolCreated }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      // Basic validation
      if (!name.trim() || !description.trim() || !webhookUrl.trim()) {
        setError('All fields are required');
        return;
      }

      // Validate webhook URL format
      try {
        new URL(webhookUrl);
      } catch {
        setError('Invalid webhook URL');
        return;
      }

      // Extract query parameter template from URL if exists
      const url = new URL(webhookUrl);
      const hasQueryParam = url.searchParams.has('query');

      // Create the tool implementation
      const implementation = `async function implementation(args) {
  try {
    const result = args;
    const query = encodeURIComponent(result.query || '');
    
    const url = \`${webhookUrl}\${${hasQueryParam ? '' : '?query='}\${query}\`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(\`Request failed with status \${response.status}\`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    throw new Error(\`Tool execution failed: \${error.message}\`);
  }
}`;

      // Create the tool object
      const tool = {
        name: name.toLowerCase().replace(/\s+/g, '_'),
        description,
        parameters: [
          {
            name: 'query',
            type: 'string',
            description: 'The query parameter to send to the webhook',
            required: true
          }
        ],
        implementation,
        isEnabled: true
      };

      // Save to database
      await db.addTool(tool);
      onToolCreated();
      onClose();

      // Reset form
      setName('');
      setDescription('');
      setWebhookUrl('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred while creating the tool');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="glassmorphic rounded-2xl p-8 max-w-2xl w-full mx-4 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Workflow className="w-6 h-6 text-sakura-500" />
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-50">
              Create Workflow Tool
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
              Tool Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              placeholder="Enter tool name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              placeholder="Describe what this tool does"
              rows={3}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
              Webhook URL
            </label>
            <input
              type="text"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              placeholder="Enter n8n webhook URL"
            />
          </div>

          {error && (
            <div className="text-red-500 text-sm">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-sakura-500 hover:bg-sakura-600 rounded-lg transition-colors"
            >
              Create Tool
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}; 