import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Brain, Zap, AlertCircle, CheckCircle } from 'lucide-react';
import { aiService } from '@/services/aiService';

interface AIStatus {
  connected: boolean;
  service: string;
  model: string;
  host: string;
  port: number;
  lastChecked: Date;
}

export const AIStatusIndicator: React.FC = () => {
  const [status, setStatus] = useState<AIStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkStatus = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await aiService.getStatus();
      if (response.success && response.data) {
        setStatus({
          connected: response.data.connected,
          service: response.data.service,
          model: response.data.config.model,
          host: response.data.config.host,
          port: response.data.config.port,
          lastChecked: new Date(),
        });
      } else {
        setError(response.error || 'Failed to check AI status');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setStatus({
        connected: false,
        service: 'Ollama',
        model: 'N/A',
        host: 'localhost',
        port: 11434,
        lastChecked: new Date(),
      });
    } finally {
      setIsLoading(false);
    }
  };

  const testConnection = async () => {
    setIsLoading(true);
    try {
      const response = await aiService.testConnection();
      if (response.success) {
        await checkStatus();
        // You could show a toast notification here
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Test failed');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkStatus();
    
    // Check status every 30 seconds
    const interval = setInterval(checkStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const getStatusIcon = () => {
    if (isLoading) {
      return <Zap className="w-3 h-3 animate-pulse" />;
    }
    
    if (status?.connected) {
      return <CheckCircle className="w-3 h-3 text-green-500" />;
    }
    
    return <AlertCircle className="w-3 h-3 text-red-500" />;
  };

  const getStatusBadge = () => {
    if (isLoading) {
      return <Badge variant="outline" className="text-xs">Checking...</Badge>;
    }
    
    if (status?.connected) {
      return <Badge variant="default" className="bg-green-600 text-xs">AI Ready</Badge>;
    }
    
    return <Badge variant="destructive" className="text-xs">AI Offline</Badge>;
  };

  const getTooltipContent = () => {
    if (!status) return 'AI Status Unknown';
    
    return (
      <div className="space-y-1">
        <div className="font-medium">AI Service Status</div>
        <div className="text-xs space-y-0.5">
          <div>Service: {status.service}</div>
          <div>Model: {status.model}</div>
          <div>Host: {status.host}:{status.port}</div>
          <div>Status: {status.connected ? 'Connected' : 'Disconnected'}</div>
          <div>Last checked: {status.lastChecked.toLocaleTimeString()}</div>
          {error && <div className="text-red-400">Error: {error}</div>}
        </div>
      </div>
    );
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-2 px-2 py-1 rounded-md bg-background/50 hover:bg-background/80 transition-colors">
            <Brain className="w-4 h-4" />
            {getStatusIcon()}
            {getStatusBadge()}
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          {getTooltipContent()}
          <div className="mt-2 flex gap-1">
            <Button
              size="sm"
              variant="outline"
              onClick={checkStatus}
              disabled={isLoading}
              className="h-6 px-2 text-xs"
            >
              Refresh
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={testConnection}
              disabled={isLoading}
              className="h-6 px-2 text-xs"
            >
              Test
            </Button>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default AIStatusIndicator;
