import React, { useState } from 'react';
import { Handle, Position } from 'reactflow';
import { useTheme } from '../../../hooks/useTheme';
import { FileJson, Copy, Check } from 'lucide-react';

const EXAMPLE_JSON = {
  "cars": [
    {
      "make": "Toyota",
      "model": "Corolla",
      "year": "2022",
      "price": "20000"
    },
    {
      "make": "Honda",
      "model": "Civic",
      "year": "2021",
      "price": "22000"
    },
    {
      "make": "Ford",
      "model": "Mustang",
      "year": "2023",
      "price": "30000"
    },
    {
      "make": "Chevrolet",
      "model": "Malibu",
      "year": "2020",
      "price": "18000"
    },
    {
      "make": "Nissan",
      "model": "Altima",
      "year": "2019",
      "price": "17000"
    }
  ]
};

const CSV_PREVIEW = `
# This JSON will convert to CSV like this:
make,model,year,price
Toyota,Corolla,2022,20000
Honda,Civic,2021,22000
Ford,Mustang,2023,30000
Chevrolet,Malibu,2020,18000
Nissan,Altima,2019,17000
`;

const JsonToCsvNode = ({ data, isConnectable }: any) => {
  const { isDark } = useTheme();
  const [copied, setCopied] = useState(false);
  const tool = data.tool;
  const Icon = tool.icon || FileJson;
  const nodeColor = isDark ? tool.darkColor : tool.lightColor;

  const handleCopyExample = () => {
    navigator.clipboard.writeText(JSON.stringify(EXAMPLE_JSON, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`p-3 rounded-lg border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} shadow-md w-72`}>
      <div className="flex items-center gap-2 mb-2">
        <div className="p-2 rounded-lg" style={{ background: nodeColor }}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div className="font-medium text-sm text-gray-900 dark:text-white">
          {data.label}
        </div>
      </div>

      <div className="mb-3">
        <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400 mb-2">
          <span>Example JSON format:</span>
          <button
            onClick={handleCopyExample}
            className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 flex items-center gap-1"
            title="Copy example"
          >
            {copied ? (
              <Check className="w-3 h-3 text-green-500" />
            ) : (
              <Copy className="w-3 h-3 text-gray-500 dark:text-gray-400" />
            )}
          </button>
        </div>
        <pre className="text-xs bg-gray-100 dark:bg-gray-900 p-2 rounded overflow-auto max-h-32">
          {JSON.stringify(EXAMPLE_JSON, null, 2)}
        </pre>
        <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 font-mono bg-gray-50 dark:bg-gray-900/50 p-2 rounded">
          {CSV_PREVIEW}
        </div>
        <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          <strong>Supports:</strong> 
          <ul className="list-disc pl-4 mt-1">
            <li>Nested JSON with a property containing an array of objects (shown above)</li>
            <li>Direct array of objects (without wrapper property)</li>
            <li>Column-oriented format with arrays of values</li>
          </ul>
        </div>
      </div>

      <div className="text-xs text-gray-500 dark:text-gray-400">
        Converts JSON to CSV format and downloads the file
      </div>

      <Handle
        type="target"
        position={Position.Top}
        id="text"
        isConnectable={isConnectable}
        className="!bg-blue-500 !w-3 !h-3"
        style={{ top: -6 }}
      />
      
      <Handle
        type="source"
        position={Position.Bottom}
        id="text"
        isConnectable={isConnectable}
        className="!bg-blue-500 !w-3 !h-3"
        style={{ bottom: -6 }}
      />
    </div>
  );
};

export const metadata = {
  id: 'json_to_csv',
  name: 'JSON to CSV',
  description: 'Convert JSON data to CSV format',
  icon: FileJson,
  color: 'bg-yellow-500',
  bgColor: 'bg-yellow-100',
  lightColor: '#F59E0B',
  darkColor: '#FBBF24',
  category: 'function',
  inputs: ['text'],
  outputs: ['text'],
};

export default JsonToCsvNode;
