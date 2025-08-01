import React, { useState, useEffect } from 'react';
import { 
  Upload, 
  Download, 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  Loader2,
  Pause,
  Play,
  X
} from 'lucide-react';
import { Progress } from './progress';
import { Button } from './button';
import { Card, CardContent, CardHeader, CardTitle } from './card';
import { Badge } from './badge';
import { ScrollArea } from './scroll-area';
import { OperationProgress } from '../../types/socket';

interface FileOperationProgressProps {
  operations: OperationProgress[];
  onCancel?: (operationId: string) => void;
  onPause?: (operationId: string) => void;
  onResume?: (operationId: string) => void;
  onRetry?: (operationId: string) => void;
  onDismiss?: (operationId: string) => void;
  maxVisible?: number;
  showCompleted?: boolean;
}

const operationIcons = {
  upload: Upload,
  download: Download,
  sync: RefreshCw,
  batch: Loader2
};

const statusIcons = {
  pending: Loader2,
  'in-progress': Loader2,
  completed: CheckCircle,
  failed: XCircle,
  paused: Pause
};

const statusColors = {
  pending: 'bg-gray-100 text-gray-800',
  'in-progress': 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
  paused: 'bg-yellow-100 text-yellow-800'
};

export const FileOperationProgress: React.FC<FileOperationProgressProps> = ({
  operations = [],
  onCancel,
  onPause,
  onResume,
  onRetry,
  onDismiss,
  maxVisible = 3,
  showCompleted = true
}) => {
  const [visibleOperations, setVisibleOperations] = useState<OperationProgress[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);

  // Filter and manage visible operations
  useEffect(() => {
    let filteredOps = operations;
    
    if (!showCompleted) {
      filteredOps = operations.filter(op => op.status !== 'completed');
    }

    // Sort by status priority (in-progress > pending > paused > failed > completed)
    const statusPriority = {
      'in-progress': 1,
      'pending': 2,
      'paused': 3,
      'failed': 4,
      'completed': 5
    };

    filteredOps.sort((a, b) => statusPriority[a.status] - statusPriority[b.status]);

    setVisibleOperations(isExpanded ? filteredOps : filteredOps.slice(0, maxVisible));
  }, [operations, maxVisible, showCompleted, isExpanded]);

  const formatFileSize = (bytes: number) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const getEstimatedTime = (progress: OperationProgress) => {
    if (progress.status !== 'in-progress' || progress.progress === 0) {
      return null;
    }

    // Simple estimation based on progress rate
    const remainingProgress = 100 - progress.progress;
    const estimatedSeconds = (remainingProgress / progress.progress) * 60; // rough estimate
    
    if (estimatedSeconds < 60) {
      return `${Math.round(estimatedSeconds)}s remaining`;
    } else {
      const minutes = Math.round(estimatedSeconds / 60);
      return `${minutes}m remaining`;
    }
  };

  const handleAction = (action: string, operationId: string) => {
    switch (action) {
      case 'cancel':
        onCancel?.(operationId);
        break;
      case 'pause':
        onPause?.(operationId);
        break;
      case 'resume':
        onResume?.(operationId);
        break;
      case 'retry':
        onRetry?.(operationId);
        break;
      case 'dismiss':
        onDismiss?.(operationId);
        break;
    }
  };

  if (visibleOperations.length === 0 && !showCompleted) {
    return null;
  }

  const activeOperations = operations.filter(op => 
    op.status === 'pending' || op.status === 'in-progress'
  );

  return (
    <div className="fixed bottom-4 right-4 z-50 w-96 max-w-sm">
      <Card className="shadow-lg">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <RefreshCw className="w-4 h-4" />
            File Operations
            {activeOperations.length > 0 && (
              <Badge variant="secondary" className="ml-auto">
                {activeOperations.length} active
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <ScrollArea className={isExpanded ? "h-80" : "h-auto"}>
            <div className="space-y-3">
              {visibleOperations.map((operation) => {
                const OperationIcon = operationIcons[operation.type];
                const StatusIcon = statusIcons[operation.status];
                const statusColor = statusColors[operation.status];

                return (
                  <div
                    key={operation.operationId}
                    className="p-3 rounded-lg border bg-card"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className="flex items-center gap-2">
                        <OperationIcon className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm font-medium truncate">
                          {operation.type.charAt(0).toUpperCase() + operation.type.slice(1)}
                        </span>
                      </div>
                      
                      <Badge variant="secondary" className={`text-xs ${statusColor}`}>
                        <StatusIcon className={`w-3 h-3 mr-1 ${
                          operation.status === 'in-progress' ? 'animate-spin' : ''
                        }`} />
                        {operation.status}
                      </Badge>

                      <div className="ml-auto flex items-center gap-1">
                        {operation.status === 'in-progress' && onPause && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => handleAction('pause', operation.operationId)}
                          >
                            <Pause className="w-3 h-3" />
                          </Button>
                        )}
                        
                        {operation.status === 'paused' && onResume && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => handleAction('resume', operation.operationId)}
                          >
                            <Play className="w-3 h-3" />
                          </Button>
                        )}
                        
                        {operation.status === 'failed' && onRetry && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => handleAction('retry', operation.operationId)}
                          >
                            <Loader2 className="w-3 h-3" />
                          </Button>
                        )}
                        
                        {(operation.status === 'pending' || operation.status === 'in-progress') && onCancel && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => handleAction('cancel', operation.operationId)}
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        )}
                        
                        {(operation.status === 'completed' || operation.status === 'failed') && onDismiss && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => handleAction('dismiss', operation.operationId)}
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Progress Bar */}
                    {operation.status !== 'pending' && (
                      <div className="mb-2">
                        <Progress 
                          value={operation.progress} 
                          className="h-2"
                        />
                        <div className="flex justify-between items-center mt-1">
                          <span className="text-xs text-muted-foreground">
                            {operation.progress}%
                          </span>
                          {getEstimatedTime(operation) && (
                            <span className="text-xs text-muted-foreground">
                              {getEstimatedTime(operation)}
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Current Step */}
                    {operation.currentStep && (
                      <div className="text-xs text-muted-foreground mb-1">
                        {operation.currentStep}
                        {operation.totalSteps && (
                          <span className="ml-2">
                            ({operation.totalSteps - (operation.totalSteps * operation.progress / 100)} remaining)
                          </span>
                        )}
                      </div>
                    )}

                    {/* Operation Details */}
                    {operation.status === 'failed' && (
                      <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 rounded p-2">
                        <AlertCircle className="w-3 h-3" />
                        Operation failed. Click retry to try again.
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>

          {operations.length > maxVisible && !isExpanded && (
            <div className="pt-3 border-t mt-3">
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs"
                onClick={() => setIsExpanded(true)}
              >
                View All {operations.length} Operations
              </Button>
            </div>
          )}

          {isExpanded && (
            <div className="pt-3 border-t mt-3">
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs"
                onClick={() => setIsExpanded(false)}
              >
                Show Less
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default FileOperationProgress;