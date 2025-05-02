import React, { useEffect, useState, useRef } from 'react';
import { XCircle, RefreshCw } from 'lucide-react';

interface WebhookWidgetProps {
  id: string;
  name: string;
  url: string;
  onRemove: (id: string) => void;
}

const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes

const WebhookWidget: React.FC<WebhookWidgetProps> = ({ id, name, url, onRemove }) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const fetchData = async () => {
    if (!mounted) return;
    setLoading(true);
    setError(null);
    try {
      console.log('Fetching data from webhook:', url);
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const contentType = response.headers.get('content-type');
      let result;
      if (contentType && contentType.includes('application/json')) {
        result = await response.json();
      } else {
        result = await response.text();
      }
      if (mounted) {
        console.log('Successfully fetched webhook data:', result);
        setData(result);
      }
    } catch (err: any) {
      console.error('Error fetching webhook data:', err);
      if (mounted) {
        setError(err.message || 'Failed to fetch');
        setData(null);
      }
    } finally {
      if (mounted) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchData();
    intervalRef.current = setInterval(fetchData, REFRESH_INTERVAL);
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [url]);

  if (!mounted) return null;

  return (
    <div className="bg-white/70 dark:bg-gray-800/70 p-4 rounded-xl border border-gray-200 dark:border-gray-700 relative min-w-[250px] max-w-[400px] group">
      <button
        className="absolute top-2 right-2 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={() => onRemove(id)}
        aria-label="Remove widget"
      >
        <XCircle className="w-5 h-5" />
      </button>
      <div className="flex items-center gap-2 mb-2">
        <span className="font-semibold text-gray-900 dark:text-white">{name}</span>
        <button
          className="ml-auto text-gray-400 hover:text-blue-500"
          onClick={fetchData}
          disabled={loading}
          aria-label="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>
      <div className="text-xs text-gray-500 break-all mb-2">{url}</div>
      <div className="text-sm text-gray-800 dark:text-gray-200 overflow-auto max-h-40">
        {loading && <div>Loading...</div>}
        {error && <div className="text-red-500">Error: {error}</div>}
        {!loading && !error && data && (
          typeof data === 'object' ? (
            <pre className="whitespace-pre-wrap">{JSON.stringify(data, null, 2)}</pre>
          ) : (
            <div>{String(data)}</div>
          )
        )}
      </div>
    </div>
  );
};

export default WebhookWidget; 