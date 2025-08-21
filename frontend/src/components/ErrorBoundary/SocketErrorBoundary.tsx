import React, { Component, ReactNode } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { RefreshCw, Wifi, WifiOff } from 'lucide-react';

interface SocketErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  isRetrying: boolean;
  retryCount: number;
}

interface SocketErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onRetry?: () => void;
  maxRetries?: number;
}

export class SocketErrorBoundary extends Component<SocketErrorBoundaryProps, SocketErrorBoundaryState> {
  private retryTimeout: NodeJS.Timeout | null = null;

  constructor(props: SocketErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      isRetrying: false,
      retryCount: 0,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<SocketErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('SocketErrorBoundary caught an error:', error, errorInfo);
    
    this.setState({
      error,
      errorInfo,
    });

    // Auto-retry for socket-related errors
    if (this.isSocketError(error) && this.state.retryCount < (this.props.maxRetries || 3)) {
      this.autoRetry();
    }
  }

  componentWillUnmount() {
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
    }
  }

  private isSocketError(error: Error): boolean {
    const socketErrorMessages = [
      'socket',
      'connection',
      'network',
      'timeout',
      'disconnect',
      'websocket',
    ];
    
    return socketErrorMessages.some(msg => 
      error.message.toLowerCase().includes(msg) ||
      error.name.toLowerCase().includes(msg)
    );
  }

  private autoRetry = () => {
    const delay = Math.min(1000 * Math.pow(2, this.state.retryCount), 10000); // Exponential backoff, max 10s
    
    this.setState({ isRetrying: true });
    
    this.retryTimeout = setTimeout(() => {
      this.handleRetry();
    }, delay);
  };

  private handleRetry = () => {
    this.setState(prevState => ({
      hasError: false,
      error: null,
      errorInfo: null,
      isRetrying: false,
      retryCount: prevState.retryCount + 1,
    }));

    this.props.onRetry?.();
  };

  private handleManualRetry = () => {
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
    }
    this.handleRetry();
  };

  private renderError() {
    const { error } = this.state;
    const isSocketError = error && this.isSocketError(error);
    
    return (
      <div className="flex flex-col items-center justify-center min-h-[200px] p-6 space-y-4">
        <div className="flex items-center space-x-2 text-red-500">
          {isSocketError ? <WifiOff className="w-8 h-8" /> : <Wifi className="w-8 h-8" />}
          <h2 className="text-xl font-semibold">
            {isSocketError ? 'Connection Error' : 'Something went wrong'}
          </h2>
        </div>
        
        <Alert className="max-w-md">
          <AlertDescription>
            {isSocketError 
              ? 'Lost connection to the server. Trying to reconnect...'
              : error?.message || 'An unexpected error occurred'
            }
          </AlertDescription>
        </Alert>

        {this.state.isRetrying ? (
          <div className="flex items-center space-x-2 text-blue-500">
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span>Retrying... (Attempt {this.state.retryCount + 1})</span>
          </div>
        ) : (
          <div className="flex space-x-2">
            <Button 
              onClick={this.handleManualRetry}
              variant="outline"
              size="sm"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry
            </Button>
            
            <Button 
              onClick={() => window.location.reload()}
              variant="default"
              size="sm"
            >
              Reload Page
            </Button>
          </div>
        )}

        {process.env.NODE_ENV === 'development' && (
          <details className="mt-4 text-sm text-gray-600">
            <summary className="cursor-pointer">Error Details</summary>
            <pre className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-auto max-w-md">
              {error?.stack}
            </pre>
          </details>
        )}
      </div>
    );
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || this.renderError();
    }

    return this.props.children;
  }
}