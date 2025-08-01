import React from 'react';
import { Wifi, WifiOff, Loader2, AlertTriangle } from 'lucide-react';
import { Badge } from './badge';
import { Button } from './button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './tooltip';

export interface ConnectionStatusProps {
  isConnected: boolean;
  isConnecting?: boolean;
  reconnectAttempts?: number;
  lastError?: string;
  onReconnect?: () => void;
  showDetails?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const statusConfig = {
  connected: {
    icon: Wifi,
    label: 'Connected',
    color: 'bg-green-500',
    badgeVariant: 'default' as const,
    badgeClass: 'bg-green-100 text-green-800 border-green-200'
  },
  connecting: {
    icon: Loader2,
    label: 'Connecting',
    color: 'bg-yellow-500',
    badgeVariant: 'secondary' as const,
    badgeClass: 'bg-yellow-100 text-yellow-800 border-yellow-200'
  },
  reconnecting: {
    icon: Loader2,
    label: 'Reconnecting',
    color: 'bg-orange-500',
    badgeVariant: 'secondary' as const,
    badgeClass: 'bg-orange-100 text-orange-800 border-orange-200'
  },
  disconnected: {
    icon: WifiOff,
    label: 'Disconnected',
    color: 'bg-red-500',
    badgeVariant: 'destructive' as const,
    badgeClass: 'bg-red-100 text-red-800 border-red-200'
  },
  error: {
    icon: AlertTriangle,
    label: 'Connection Error',
    color: 'bg-red-500',
    badgeVariant: 'destructive' as const,
    badgeClass: 'bg-red-100 text-red-800 border-red-200'
  }
};

const sizeConfig = {
  sm: { icon: 'w-3 h-3', badge: 'text-xs px-2 py-1', indicator: 'w-2 h-2' },
  md: { icon: 'w-4 h-4', badge: 'text-sm px-3 py-1', indicator: 'w-3 h-3' },
  lg: { icon: 'w-5 h-5', badge: 'text-base px-4 py-2', indicator: 'w-4 h-4' }
};

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({
  isConnected,
  isConnecting = false,
  reconnectAttempts = 0,
  lastError,
  onReconnect,
  showDetails = false,
  size = 'md'
}) => {
  const getStatus = () => {
    if (lastError) return 'error';
    if (isConnecting && reconnectAttempts > 0) return 'reconnecting';
    if (isConnecting) return 'connecting';
    if (isConnected) return 'connected';
    return 'disconnected';
  };

  const status = getStatus();
  const config = statusConfig[status];
  const sizeClasses = sizeConfig[size];
  const IconComponent = config.icon;

  const getTooltipContent = () => {
    if (lastError) {
      return `Connection error: ${lastError}`;
    }
    if (reconnectAttempts > 0) {
      return `Reconnecting (attempt ${reconnectAttempts})`;
    }
    if (isConnecting) {
      return 'Establishing connection...';
    }
    if (isConnected) {
      return 'Connected to server';
    }
    return 'Not connected to server';
  };

  const SimpleIndicator = () => (
    <div className="flex items-center gap-2">
      <div className={`rounded-full ${config.color} ${sizeClasses.indicator}`} />
      <IconComponent className={`${sizeClasses.icon} ${
        status === 'connecting' || status === 'reconnecting' ? 'animate-spin' : ''
      }`} />
    </div>
  );

  const DetailedStatus = () => (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2">
        <div className={`rounded-full ${config.color} ${sizeClasses.indicator}`} />
        <IconComponent className={`${sizeClasses.icon} ${
          status === 'connecting' || status === 'reconnecting' ? 'animate-spin' : ''
        }`} />
      </div>
      
      <Badge variant={config.badgeVariant} className={`${config.badgeClass} ${sizeClasses.badge}`}>
        {config.label}
        {reconnectAttempts > 0 && ` (${reconnectAttempts})`}
      </Badge>

      {!isConnected && onReconnect && (
        <Button
          variant="outline"
          size="sm"
          onClick={onReconnect}
          disabled={isConnecting}
          className="h-6 px-2 text-xs"
        >
          {isConnecting ? 'Connecting...' : 'Reconnect'}
        </Button>
      )}
    </div>
  );

  const StatusComponent = showDetails ? DetailedStatus : SimpleIndicator;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="inline-flex">
            <StatusComponent />
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>{getTooltipContent()}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default ConnectionStatus;