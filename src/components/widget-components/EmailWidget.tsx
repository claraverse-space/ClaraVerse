import React, { useState, useEffect, useCallback, useRef } from 'react';
import { XCircle, Mail, RefreshCw, Clock, MoreHorizontal, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';
import axios from 'axios';

interface EmailWidgetProps {
  id: string;
  name: string;
  url: string;
  onRemove: (id: string) => void;
}

interface Email {
  title: string;
  importance: 'low' | 'medium' | 'high';
  content: string;
  suggestedReply?: string;
}

const EmailWidget: React.FC<EmailWidgetProps> = ({ id, name, url, onRemove }) => {
  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(5); // minutes
  const [lastFetchTime, setLastFetchTime] = useState<number | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const initialFetchTimeout = useRef<NodeJS.Timeout | null>(null);
  
  // Configuration and cache for this widget stored in localStorage
  const storageKey = `email_widget_${id}`;
  const cacheKey = `email_widget_cache_${id}`;
  
  // Load configuration and cached emails from localStorage
  useEffect(() => {
    const savedConfig = localStorage.getItem(storageKey);
    if (savedConfig) {
      try {
        const config = JSON.parse(savedConfig);
        if (config.autoRefresh !== undefined) setAutoRefresh(config.autoRefresh);
        if (config.refreshInterval) setRefreshInterval(config.refreshInterval);
        if (config.lastFetchTime) setLastFetchTime(config.lastFetchTime);
      } catch (err) {
        console.error('Error loading email widget config:', err);
      }
    }
    // Load cached emails
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) {
          setEmails(parsed);
        }
      } catch (err) {
        console.error('Error loading cached emails:', err);
      }
    }
  }, [storageKey, cacheKey]);
  
  // Save configuration to localStorage when it changes
  useEffect(() => {
    const config = {
      autoRefresh,
      refreshInterval,
      lastFetchTime
    };
    localStorage.setItem(storageKey, JSON.stringify(config));
  }, [autoRefresh, refreshInterval, lastFetchTime, storageKey]);
  
  // Setup auto-refresh
  useEffect(() => {
    if (autoRefresh) {
      timerRef.current = setInterval(() => {
        const now = Date.now();
        // Only auto-refresh if last fetch was more than 15 minutes ago
        if (!lastFetchTime || (now - lastFetchTime) >= 15 * 60 * 1000) {
          fetchEmails();
        }
      }, refreshInterval * 60 * 1000);
    }
    
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [autoRefresh, refreshInterval, lastFetchTime]);
  
  // Fetch emails with 2s delay on mount
  useEffect(() => {
    const shouldFetch = () => {
      if (!lastFetchTime) return true;
      const timeSinceLastFetch = Date.now() - lastFetchTime;
      return timeSinceLastFetch >= 15 * 60 * 1000; // 15 minutes
    };

    if (shouldFetch()) {
      initialFetchTimeout.current = setTimeout(() => {
        fetchEmails();
      }, 2000);
    }

    return () => {
      if (initialFetchTimeout.current) {
        clearTimeout(initialFetchTimeout.current);
      }
    };
    // Include lastFetchTime in dependencies
  }, [url, lastFetchTime]);
  
  const fetchEmails = async () => {
    if (loading) return;
    
    // Check if we have cached data and it's recent (within 15 minutes)
    const now = Date.now();
    if (lastFetchTime && (now - lastFetchTime) < 15 * 60 * 1000) {
      console.log('Using cached data, last fetch was less than 15 minutes ago');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(url);
      let result = response.data;
      // Support both {output: [...]} and [...] as response
      if (result && typeof result === 'object' && Array.isArray(result.output)) {
        result = result.output;
      }
      if (Array.isArray(result)) {
        setEmails(result);
        localStorage.setItem(cacheKey, JSON.stringify(result));
        setLastFetchTime(now);
      } else {
        setError('Invalid email data format');
      }
    } catch (err) {
      console.error('Error fetching emails:', err);
      setError('Error connecting to email service');
    } finally {
      setLoading(false);
    }
  };
  
  const handleRefresh = () => {
    // For manual refresh, force a new fetch by temporarily clearing lastFetchTime
    setLastFetchTime(null);
    fetchEmails();
  };
  
  const toggleAutoRefresh = () => {
    setAutoRefresh(!autoRefresh);
  };
  
  const handleIntervalChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setRefreshInterval(Number(e.target.value));
  };
  
  const toggleExpanded = () => {
    setExpanded(!expanded);
  };
  
  // Sort emails by importance (high -> medium -> low)
  const sortedEmails = Array.isArray(emails) ? [...emails].sort((a, b) => {
    const importanceOrder = { high: 0, medium: 1, low: 2 };
    return importanceOrder[a.importance] - importanceOrder[b.importance];
  }) : [];
  
  const displayEmails = expanded ? sortedEmails : sortedEmails.slice(0, 5);
  const hasMoreEmails = sortedEmails.length > 5;
  
  // Copy suggested reply using Electron API
  const handleCopy = (text: string) => {
    if (
      window.electron &&
      typeof (window.electron as any).copyToClipboard === 'function'
    ) {
      (window.electron as any).copyToClipboard(text);
    } else {
      alert('Copy not supported in this environment.');
    }
  };
  
  // Get time since last fetch in minutes
  const getTimeSinceLastFetch = () => {
    if (!lastFetchTime) return null;
    const minutes = Math.floor((Date.now() - lastFetchTime) / (60 * 1000));
    return minutes;
  };
  
  // Get status text
  const getStatusText = () => {
    if (autoRefresh) {
      const timeSinceLastFetch = getTimeSinceLastFetch();
      if (timeSinceLastFetch !== null && timeSinceLastFetch < 15) {
        return `Updated ${timeSinceLastFetch}m ago (waiting 15m before next auto-refresh)`;
      }
      return `Auto-refreshing every ${refreshInterval} ${refreshInterval === 1 ? 'minute' : 'minutes'}`;
    }
    const timeSinceLastFetch = getTimeSinceLastFetch();
    return timeSinceLastFetch ? `Updated ${timeSinceLastFetch}m ago` : 'Manual refresh';
  };
  
  return (
    <div className="glassmorphic rounded-2xl p-6 animate-fadeIn relative group shadow-lg">
      <button
        className="absolute top-4 right-4 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors opacity-0 group-hover:opacity-100"
        onClick={() => onRemove(id)}
        aria-label="Remove widget"
      >
        <XCircle className="w-5 h-5" />
      </button>
      
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-gray-500/5 dark:bg-gray-300/5 rounded-full flex-shrink-0">
            <Mail className="w-5 h-5 text-sakura-500" />
          </div>
          <div>
            <h3 className="font-medium text-gray-900 dark:text-white">{name}</h3>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              {getStatusText()}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button 
            className={`p-1.5 rounded-full transition-colors ${
              autoRefresh 
                ? 'bg-sakura-500/10 text-sakura-500' 
                : 'bg-gray-500/5 dark:bg-gray-300/5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
            onClick={toggleAutoRefresh}
            title={autoRefresh ? 'Disable auto-refresh' : 'Enable auto-refresh'}
          >
            <Clock className="w-4 h-4" />
          </button>
          
          <button 
            className="p-1.5 bg-gray-500/5 dark:bg-gray-300/5 rounded-full text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
            onClick={handleRefresh}
            disabled={loading}
            title="Refresh now"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>
      
      {/* Controls */}
      {autoRefresh && (
        <div className="mb-4 flex items-center gap-2">
          <span className="text-xs text-gray-600 dark:text-gray-400">Refresh every:</span>
          <select
            value={refreshInterval}
            onChange={handleIntervalChange}
            className="text-xs bg-gray-500/5 dark:bg-gray-300/5 rounded-md px-2 py-1 text-gray-700 dark:text-gray-300"
          >
            <option value="1">1 minute</option>
            <option value="5">5 minutes</option>
            <option value="15">15 minutes</option>
            <option value="30">30 minutes</option>
            <option value="60">1 hour</option>
          </select>
        </div>
      )}
      
      {/* Error State */}
      {error && (
        <div className="mb-4 p-3 bg-red-500/10 dark:bg-red-400/10 rounded-lg text-red-600 dark:text-red-400 text-sm">
          {error}
        </div>
      )}
      
      {/* Loading State */}
      {loading && emails.length === 0 && (
        <div className="flex items-center justify-center p-6">
          <RefreshCw className="w-6 h-6 text-sakura-500 animate-spin" />
        </div>
      )}
      
      {/* Empty State */}
      {!loading && emails.length === 0 && !error && (
        <div className="text-center p-6 text-gray-500 dark:text-gray-400">
          <Mail className="w-8 h-8 mb-2 mx-auto opacity-40" />
          <p>No emails found</p>
        </div>
      )}
      
      {/* Email List */}
      {displayEmails.length > 0 && (
        <div className="space-y-4 mt-2">
          {displayEmails.map((email, index) => (
            <div
              key={index}
              className="p-4 glassmorphic rounded-xl transition-all hover:bg-white/60 dark:hover:bg-gray-800/60 shadow-md flex flex-col gap-2"
              style={{ border: 'none', boxShadow: '0 2px 16px 0 rgba(0,0,0,0.04)' }}
            >
              <div className="flex items-center gap-3 mb-1">
                <span className={`flex items-center gap-1 text-lg font-medium text-gray-900 dark:text-white`}>
                  <span className={`flex items-center justify-center w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-800`}>
                    {email.importance === 'high' && <AlertCircle className="w-5 h-5 text-red-500" />}
                    {email.importance === 'medium' && <AlertCircle className="w-5 h-5 text-amber-500" />}
                    {email.importance === 'low' && <AlertCircle className="w-5 h-5 text-blue-500" />}
                  </span>
                  {email.title}
                </span>
              </div>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                {email.content}
              </p>
              {typeof email.suggestedReply === 'string' && email.suggestedReply && (
                <div className="bg-sakura-50 dark:bg-sakura-900/10 rounded-lg px-4 py-3 flex flex-col gap-2 mt-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase tracking-wider text-sakura-600 dark:text-sakura-400 font-medium">
                      Suggested Reply
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-700 dark:text-gray-200 flex-1 select-text">
                      {email.suggestedReply}
                    </span>
                    <button
                      className="ml-2 px-3 py-1 rounded-md bg-sakura-500 hover:bg-sakura-600 text-white text-xs font-medium transition-colors shadow"
                      onClick={() => handleCopy(email.suggestedReply as string)}
                    >
                      Copy
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      
      {/* Show More/Less */}
      {hasMoreEmails && (
        <button
          className="mt-3 w-full py-2 flex items-center justify-center gap-1 text-sm text-sakura-500 hover:text-sakura-600 transition-colors"
          onClick={toggleExpanded}
        >
          {expanded ? (
            <>
              <ChevronUp className="w-4 h-4" />
              Show Less
            </>
          ) : (
            <>
              <ChevronDown className="w-4 h-4" />
              Show More ({sortedEmails.length - 5} more)
            </>
          )}
        </button>
      )}
    </div>
  );
};

export default EmailWidget; 