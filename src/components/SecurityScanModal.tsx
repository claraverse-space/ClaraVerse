import React, { useState, useEffect } from 'react';
import { X, Shield, AlertTriangle, CheckCircle, Loader2, Play } from 'lucide-react';
import { db } from '../db';
import { CommunityResource } from '../services/communityService';

interface SecurityScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProceed: () => void;
  resource: CommunityResource;
}

interface SecurityScanResult {
  status: 'scanning' | 'safe' | 'warning' | 'dangerous' | 'error';
  riskLevel: 'low' | 'medium' | 'high';
  issues: string[];
  recommendations: string[];
  summary: string;
  explanation?: string;
}

const SecurityScanModal: React.FC<SecurityScanModalProps> = ({
  isOpen,
  onClose,
  onProceed,
  resource
}) => {
  const [selectedProviderId, setSelectedProviderId] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [providers, setProviders] = useState<any[]>([]);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<SecurityScanResult | null>(null);
  const [userChoice, setUserChoice] = useState<'scan' | 'skip' | null>(null);

  // Debug logging
  useEffect(() => {
    console.log('=== SecurityScanModal Props ===');
    console.log('isOpen:', isOpen);
    console.log('resource:', resource);
  }, [isOpen, resource]);

  // Load available providers
  useEffect(() => {
    if (isOpen) {
      console.log('SecurityScanModal opened, loading providers...');
      loadProviders();
    }
  }, [isOpen]);

  const loadProviders = async () => {
    try {
      const allProviders = await db.getAllProviders();
      const enabledProviders = allProviders.filter(p => p.isEnabled);
      setProviders(enabledProviders);
      
      // Auto-select primary provider
      const primary = enabledProviders.find(p => p.isPrimary);
      if (primary) {
        setSelectedProviderId(primary.id);
        await loadModelsForProvider(primary.id);
      } else if (enabledProviders.length > 0) {
        setSelectedProviderId(enabledProviders[0].id);
        await loadModelsForProvider(enabledProviders[0].id);
      }
    } catch (error) {
      console.error('Error loading providers:', error);
    }
  };

  const loadModelsForProvider = async (providerId: string) => {
    if (!providerId) {
      setAvailableModels([]);
      setSelectedModel('');
      return;
    }

    setLoadingModels(true);
    try {
      const provider = providers.find(p => p.id === providerId) || 
                      (await db.getAllProviders()).find(p => p.id === providerId);
      
      if (!provider) {
        setAvailableModels([]);
        setSelectedModel('');
        return;
      }

      let models: string[] = [];

      // Fetch models based on provider type - NO FALLBACKS, REAL API CALLS ONLY
      if (provider.type === 'openai' || provider.type === 'openai_compatible') {
        console.log(`Fetching models from ${provider.name} at ${provider.baseUrl}/models`);
        
        const response = await fetch(`${provider.baseUrl}/models`, {
          headers: {
            'Authorization': `Bearer ${provider.apiKey}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (!response.ok) {
          throw new Error(`Failed to fetch models: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        models = data.data?.map((model: any) => model.id) || [];
        
        if (models.length === 0) {
          throw new Error('No models returned from API');
        }

        console.log(`Successfully fetched ${models.length} models from ${provider.name}:`, models);

      } else if (provider.type === 'ollama') {
        console.log(`Fetching models from Ollama at ${provider.baseUrl.replace('/v1', '')}/api/tags`);
        
        const response = await fetch(`${provider.baseUrl.replace('/v1', '')}/api/tags`);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch Ollama models: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        models = data.models?.map((model: any) => model.name) || [];
        
        if (models.length === 0) {
          throw new Error('No models installed in Ollama');
        }

        console.log(`Successfully fetched ${models.length} models from Ollama:`, models);

      } else if (provider.type === 'claras-pocket') {
        console.log(`Fetching models from Clara's Core at ${provider.baseUrl}/models`);
        
        try {
          const response = await fetch(`${provider.baseUrl}/models`, {
            headers: {
              'Authorization': `Bearer ${provider.apiKey || 'clara-default'}`,
              'Content-Type': 'application/json'
            }
          });
          
          if (response.ok) {
            const data = await response.json();
            models = data.data?.map((model: any) => model.id) || data.models || [];
          }
        } catch (error) {
          console.warn('Clara\'s Core /models endpoint not available, trying alternative endpoint');
        }

        // If no models from API, try Clara's Core specific endpoint
        if (models.length === 0) {
          try {
            const response = await fetch(`${provider.baseUrl}/v1/models`, {
              headers: {
                'Authorization': `Bearer ${provider.apiKey || 'clara-default'}`,
                'Content-Type': 'application/json'
              }
            });
            
            if (response.ok) {
              const data = await response.json();
              models = data.data?.map((model: any) => model.id) || data.models || [];
            }
          } catch (error) {
            console.warn('Clara\'s Core models endpoint not available');
          }
        }

        if (models.length === 0) {
          throw new Error('Unable to fetch models from Clara\'s Core API');
        }

        console.log(`Successfully fetched ${models.length} models from Clara's Core:`, models);

      } else {
        throw new Error(`Unsupported provider type: ${provider.type}`);
      }

      setAvailableModels(models);
      // Auto-select first model
      if (models.length > 0) {
        setSelectedModel(models[0]);
      }

    } catch (error) {
      console.error('Error loading models for provider:', error);
      // Show the actual error to user instead of hiding it
      setAvailableModels([]);
      setSelectedModel('');
      // You could add a toast notification here to inform user about the error
      alert(`Failed to load models from provider: ${error instanceof Error ? error.message : 'Unknown error'}. Please check your API configuration.`);
    } finally {
      setLoadingModels(false);
    }
  };

  const handleProviderChange = async (providerId: string) => {
    setSelectedProviderId(providerId);
    await loadModelsForProvider(providerId);
  };

  // Enhanced security analysis function
  const analyzeSuspiciousCode = async (code: string, baseURL: string, apiKey: string, modelId: string = 'gpt-4-turbo') => {
    // Construct the analysis prompt
    const systemPrompt = `You are a security expert analyzing code for potential malicious behavior. 
Analyze the provided code and respond with a JSON object containing:
1. "summary": Brief description of what the code does
2. "isMalicious": Boolean indicating if code is potentially harmful
3. "riskLevel": "none", "low", "medium", "high", or "critical"
4. "maliciousBehaviors": Array of specific malicious behaviors found (empty if none)
5. "explanation": Detailed explanation of findings
6. "recommendations": Security recommendations`;

    const userPrompt = `Analyze this code for malicious behavior:\n\n\`\`\`\n${code}\n\`\`\``;

    // Prepare the API request
    const requestBody = {
      model: modelId,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.1, // Low temperature for consistent analysis
      max_tokens: 1000,
      response_format: { type: "json_object" } // Force JSON response
    };

    try {
      // Make the API call
      const response = await fetch(`${baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      // Parse the response
      const analysis = JSON.parse(data.choices[0].message.content);
      
      return {
        success: true,
        analysis: analysis,
        usage: data.usage // Token usage info
      };
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        analysis: {
          summary: "Analysis failed",
          isMalicious: null,
          riskLevel: "unknown",
          maliciousBehaviors: [],
          explanation: `Error during analysis: ${error instanceof Error ? error.message : 'Unknown error'}`,
          recommendations: "Please review the code manually"
        }
      };
    }
  };

  const performSecurityScan = async () => {
    if (!selectedProviderId || !selectedModel) {
      console.warn('Missing provider or model selection');
      return;
    }

    console.log('Starting security scan with:', {
      provider: selectedProviderId,
      model: selectedModel,
      resource: resource
    });

    setIsScanning(true);
    setScanResult(null);

    try {
      const provider = providers.find(p => p.id === selectedProviderId);
      if (!provider) {
        throw new Error('Selected provider not found');
      }

      // Get the appropriate base URL and API key
      let baseURL = provider.baseUrl;
      let apiKey = provider.apiKey || '';

      if (provider.type === 'openai' && !apiKey) {
        throw new Error('OpenAI API key not found. Please configure your API key.');
      }

      // Prepare the code content for analysis - handle missing content gracefully
      let codeToAnalyze: string;
      if (resource.content) {
        codeToAnalyze = typeof resource.content === 'string' 
          ? resource.content 
          : JSON.stringify(resource.content, null, 2);
      } else {
        // If no content, analyze the resource metadata
        codeToAnalyze = JSON.stringify({
          title: resource.title,
          description: resource.description,
          category: resource.category,
          tags: resource.tags,
          github_url: resource.github_url,
          download_url: resource.download_url,
          author_username: resource.author_username
        }, null, 2);
      }

      console.log('Analyzing content:', codeToAnalyze.substring(0, 200) + '...');

      console.log('Starting security scan with enhanced analyzer:', {
        provider: provider.name,
        model: selectedModel,
        endpoint: `${baseURL}/chat/completions`
      });

      // Use the enhanced analysis function
      const result = await analyzeSuspiciousCode(codeToAnalyze, baseURL, apiKey, selectedModel);
      
      if (result.success && result.analysis) {
        // Convert the enhanced analysis result to our SecurityScanResult format
        const scanData: SecurityScanResult = {
          status: result.analysis.isMalicious ? 'warning' : 'safe',
          riskLevel: result.analysis.riskLevel || 'low',
          issues: result.analysis.maliciousBehaviors || [],
          recommendations: Array.isArray(result.analysis.recommendations) 
            ? result.analysis.recommendations 
            : [result.analysis.recommendations || 'Review code manually'],
          summary: result.analysis.summary || 'Analysis completed',
          explanation: result.analysis.explanation
        };

        setScanResult(scanData);
      } else {
        // Handle failed analysis
        setScanResult({
          status: 'error',
          riskLevel: 'medium',
          issues: ['Security scan failed - unable to verify safety'],
          recommendations: ['Manual code review required', 'Proceed with caution'],
          summary: `Scan error: ${result.error || 'Unknown error'}`,
          explanation: result.analysis?.explanation
        });
      }

    } catch (error) {
      console.error('Security scan failed:', error);
      setScanResult({
        status: 'error',
        riskLevel: 'medium',
        issues: ['Security scan failed - unable to verify safety'],
        recommendations: ['Manual code review required', 'Proceed with caution'],
        summary: `Scan error: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    } finally {
      setIsScanning(false);
    }
  };

  const getRiskColor = (riskLevel: string) => {
    switch (riskLevel) {
      case 'low': return 'text-green-600 dark:text-green-400';
      case 'medium': return 'text-yellow-600 dark:text-yellow-400';
      case 'high': return 'text-red-600 dark:text-red-400';
      default: return 'text-gray-600 dark:text-gray-400';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'safe': return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'warning': return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'dangerous': return <AlertTriangle className="w-5 h-5 text-red-500" />;
      case 'scanning': return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />;
      default: return <Shield className="w-5 h-5 text-gray-500" />;
    }
  };

  const handleProceed = () => {
    onProceed();
    onClose();
  };

  const handleSkipScan = () => {
    setUserChoice('skip');
    onProceed();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <Shield className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Security Scan
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {/* Resource Info */}
          <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <h3 className="font-medium text-gray-900 dark:text-white mb-2">
              {resource.title}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              {resource.description}
            </p>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span className="px-2 py-1 bg-gray-200 dark:bg-gray-600 rounded">
                {resource.category}
              </span>
              <span>•</span>
              <span>{resource.downloads_count} downloads</span>
            </div>
          </div>

          {!userChoice && !scanResult && (
            <>
              {/* Security Warning */}
              <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-yellow-800 dark:text-yellow-200 mb-1">
                      Security Recommendation
                    </h4>
                    <p className="text-sm text-yellow-700 dark:text-yellow-300">
                      Community content may contain untrusted code. We recommend running a security scan 
                      before installation to detect potential security issues.
                    </p>
                  </div>
                </div>
              </div>

              {/* Provider and Model Selection */}
              <div className="mb-6 space-y-4">
                {/* Provider Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Select AI Provider for Security Analysis
                  </label>
                  <select
                    value={selectedProviderId}
                    onChange={(e) => handleProviderChange(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                             bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                             focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select a provider...</option>
                    {providers.map(provider => (
                      <option key={provider.id} value={provider.id}>
                        {provider.name} ({provider.type})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Model Selection */}
                {selectedProviderId && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Select Model
                    </label>
                    <select
                      value={selectedModel}
                      onChange={(e) => setSelectedModel(e.target.value)}
                      disabled={loadingModels}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                               bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                               focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                               disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loadingModels ? (
                        <option value="">Loading models...</option>
                      ) : availableModels.length > 0 ? (
                        availableModels.map(model => (
                          <option key={model} value={model}>
                            {model}
                          </option>
                        ))
                      ) : (
                        <option value="">No models available</option>
                      )}
                    </select>
                    {loadingModels && (
                      <div className="flex items-center gap-2 mt-2 text-sm text-gray-500">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Loading available models...
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={performSecurityScan}
                  disabled={!selectedProviderId || !selectedModel || isScanning || loadingModels}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 
                           text-white px-4 py-2 rounded-lg font-medium transition-colors
                           flex items-center justify-center gap-2"
                >
                  {isScanning ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Scanning...
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4" />
                      Run Security Scan
                    </>
                  )}
                </button>
                <button
                  onClick={handleSkipScan}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 
                           text-gray-700 dark:text-gray-300 rounded-lg font-medium 
                           hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Skip & Download
                </button>
              </div>
            </>
          )}

          {/* Scanning State */}
          {isScanning && (
            <div className="text-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Analyzing Code Security...
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Our AI is examining the code for potential security issues.
              </p>
            </div>
          )}

          {/* Scan Results */}
          {scanResult && (
            <div className="space-y-4">
              {/* Status Header */}
              <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                {getStatusIcon(scanResult.status)}
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-white">
                    Security Scan Complete
                  </h3>
                  <p className={`text-sm ${getRiskColor(scanResult.riskLevel)}`}>
                    Risk Level: {scanResult.riskLevel.toUpperCase()}
                  </p>
                </div>
              </div>

              {/* Summary */}
              <div>
                <h4 className="font-medium text-gray-900 dark:text-white mb-2">Summary</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {scanResult.summary}
                </p>
              </div>

              {/* Detailed Explanation */}
              {scanResult.explanation && (
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white mb-2">Detailed Analysis</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
                    {scanResult.explanation}
                  </p>
                </div>
              )}

              {/* Issues */}
              {scanResult.issues.length > 0 && (
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white mb-2">
                    Security Issues Found
                  </h4>
                  <ul className="space-y-1">
                    {scanResult.issues.map((issue, index) => (
                      <li key={index} className="text-sm text-red-600 dark:text-red-400 flex items-start gap-2">
                        <span className="w-1 h-1 bg-red-500 rounded-full mt-2 flex-shrink-0" />
                        {issue}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Recommendations */}
              {scanResult.recommendations.length > 0 && (
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white mb-2">
                    Recommendations
                  </h4>
                  <ul className="space-y-1">
                    {scanResult.recommendations.map((rec, index) => (
                      <li key={index} className="text-sm text-gray-600 dark:text-gray-400 flex items-start gap-2">
                        <span className="w-1 h-1 bg-gray-400 rounded-full mt-2 flex-shrink-0" />
                        {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleProceed}
                  className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                    scanResult.riskLevel === 'high' 
                      ? 'bg-red-600 hover:bg-red-700 text-white'
                      : scanResult.riskLevel === 'medium'
                      ? 'bg-yellow-600 hover:bg-yellow-700 text-white'
                      : 'bg-green-600 hover:bg-green-700 text-white'
                  }`}
                >
                  {scanResult.riskLevel === 'high' ? 'Download Anyway (Risky)' : 'Proceed with Download'}
                </button>
                <button
                  onClick={onClose}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 
                           text-gray-700 dark:text-gray-300 rounded-lg font-medium 
                           hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SecurityScanModal;
