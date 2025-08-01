import React, { useState, useEffect } from 'react';
import { Bell, Folder, File, Plus, Trash2, Edit3, Move, Users } from 'lucide-react';
import { Badge } from './badge';
import { Button } from './button';
import { Card, CardContent, CardHeader, CardTitle } from './card';
import { Avatar, AvatarFallback, AvatarImage } from './avatar';
import { ScrollArea } from './scroll-area';
import { FileOperation } from '../../types/filesystem';

interface DirectoryOperation extends FileOperation {
  id: string;
  username: string;
  userAvatar?: string;
  isVisible: boolean;
  broadcasted: boolean;
}

interface DirectoryOperationsBroadcastProps {
  operations: DirectoryOperation[];
  onDismiss?: (operationId: string) => void;
  onViewDetails?: (operation: DirectoryOperation) => void;
  maxVisible?: number;
  autoHideDelay?: number;
}

const operationIcons = {
  create: Plus,
  read: File,
  update: Edit3,
  delete: Trash2,
  rename: Edit3,
  move: Move
};

const operationColors = {
  create: 'bg-green-100 text-green-800 border-green-200',
  read: 'bg-blue-100 text-blue-800 border-blue-200',
  update: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  delete: 'bg-red-100 text-red-800 border-red-200',
  rename: 'bg-purple-100 text-purple-800 border-purple-200',
  move: 'bg-indigo-100 text-indigo-800 border-indigo-200'
};

export const DirectoryOperationsBroadcast: React.FC<DirectoryOperationsBroadcastProps> = ({
  operations = [],
  onDismiss,
  onViewDetails,
  maxVisible = 5,
  autoHideDelay = 5000
}) => {
  const [visibleOperations, setVisibleOperations] = useState<DirectoryOperation[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);

  // Filter and manage visible operations
  useEffect(() => {
    const newOperations = operations.filter(op => op.isVisible && op.broadcasted);
    setVisibleOperations(newOperations.slice(0, maxVisible));

    // Auto-hide operations after delay
    if (autoHideDelay > 0) {
      const timers = newOperations.map(operation => 
        setTimeout(() => {
          handleDismiss(operation.id);
        }, autoHideDelay)
      );

      return () => {
        timers.forEach(clearTimeout);
      };
    }
  }, [operations, maxVisible, autoHideDelay]);

  const handleDismiss = (operationId: string) => {
    setVisibleOperations(prev => prev.filter(op => op.id !== operationId));
    onDismiss?.(operationId);
  };

  const formatTimestamp = (timestamp: Date) => {
    const now = new Date();
    const diff = now.getTime() - timestamp.getTime();
    
    if (diff < 60000) {
      return 'just now';
    } else if (diff < 3600000) {
      const minutes = Math.floor(diff / 60000);
      return `${minutes}m ago`;
    } else {
      const hours = Math.floor(diff / 3600000);
      return `${hours}h ago`;
    }
  };

  const getOperationMessage = (operation: DirectoryOperation) => {
    const fileName = operation.fileName;
    const username = operation.username;

    switch (operation.type) {
      case 'create':
        return `${username} created ${fileName}`;
      case 'delete':
        return `${username} deleted ${fileName}`;
      case 'update':
        return `${username} modified ${fileName}`;
      case 'rename':
        return `${username} renamed ${fileName} to ${operation.newName || 'unknown'}`;
      case 'move':
        return `${username} moved ${fileName}`;
      case 'read':
        return `${username} opened ${fileName}`;
      default:
        return `${username} performed an action on ${fileName}`;
    }
  };

  if (visibleOperations.length === 0) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-50 w-96 max-w-sm">
      <Card className="shadow-lg border-l-4 border-l-blue-500">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Bell className="w-4 h-4" />
            Directory Operations
            {operations.length > maxVisible && (
              <Badge variant="secondary" className="ml-auto">
                {operations.length - maxVisible}+ more
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <ScrollArea className={isExpanded ? "h-64" : "h-auto"}>
            <div className="space-y-3">
              {visibleOperations.map((operation) => {
                const IconComponent = operationIcons[operation.type];
                const colorClass = operationColors[operation.type];

                return (
                  <div
                    key={operation.id}
                    className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <Avatar className="w-8 h-8">
                      <AvatarImage src={operation.userAvatar} />
                      <AvatarFallback className="text-xs">
                        {operation.username.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs border ${colorClass}`}>
                          <IconComponent className="w-3 h-3" />
                          {operation.type}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {formatTimestamp(operation.timestamp)}
                        </span>
                      </div>
                      
                      <p className="text-sm text-foreground leading-relaxed">
                        {getOperationMessage(operation)}
                      </p>
                      
                      {operation.filePath && (
                        <p className="text-xs text-muted-foreground mt-1 font-mono truncate">
                          {operation.filePath}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      {onViewDetails && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => onViewDetails(operation)}
                        >
                          <File className="w-3 h-3" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => handleDismiss(operation.id)}
                      >
                        ×
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>

          {operations.length > maxVisible && (
            <div className="pt-3 border-t mt-3">
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs"
                onClick={() => setIsExpanded(!isExpanded)}
              >
                {isExpanded ? 'Show Less' : `View All ${operations.length} Operations`}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default DirectoryOperationsBroadcast;