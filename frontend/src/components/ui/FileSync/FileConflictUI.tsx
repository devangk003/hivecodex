/**
 * File Conflict Resolution UI
 * Handles display and resolution of file system conflicts
 */

import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  Users,
  Clock,
  File,
  Folder,
  Check,
  X,
  GitMerge,
  Copy,
  History,
  User,
  Calendar,
  FileText,
  Info,
  Zap,
  RotateCcw
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../card';
import { Button } from '../button';
import { Badge } from '../badge';
import { Separator } from '../separator';
import { ScrollArea } from '../scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../dialog';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '../alert';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../tabs';
import { Progress } from '../progress';
import { cn } from '../../../lib/utils';
import { fileSyncService } from '../../../services/fileSynchronization';
import type { FileConflict, ConflictResolution } from '../../../types/filesystem';

export interface FileConflictUIProps {
  className?: string;
  onConflictResolved?: (conflictId: string, resolution: ConflictResolution) => void;
  showNotifications?: boolean;
}

interface ConflictWithMetadata extends FileConflict {
  severity: 'low' | 'medium' | 'high' | 'critical';
  autoResolvable: boolean;
  suggestedResolution?: ConflictResolution;
  metadata?: {
    fileSize?: number;
    lastModified?: Date;
    contentPreview?: string;
  };
}

interface ResolutionOption {
  id: ConflictResolution;
  label: string;
  description: string;
  icon: React.ElementType;
  risk: 'low' | 'medium' | 'high';
  automated: boolean;
}

const RESOLUTION_OPTIONS: ResolutionOption[] = [
  {
    id: 'auto',
    label: 'Auto Resolve',
    description: 'Let the system automatically resolve using best practices',
    icon: Zap,
    risk: 'low',
    automated: true
  },
  {
    id: 'last_write_wins',
    label: 'Use Latest Version',
    description: 'Keep the most recently modified version',
    icon: Clock,
    risk: 'medium',
    automated: true
  },
  {
    id: 'first_write_wins',
    label: 'Use Original Version',
    description: 'Keep the first version that was created',
    icon: History,
    risk: 'medium',
    automated: true
  },
  {
    id: 'merge',
    label: 'Merge Changes',
    description: 'Attempt to merge both versions together',
    icon: GitMerge,
    risk: 'high',
    automated: false
  },
  {
    id: 'rename_both',
    label: 'Rename Both',
    description: 'Keep both versions with different names',
    icon: Copy,
    risk: 'low',
    automated: true
  },
  {
    id: 'manual',
    label: 'Manual Resolution',
    description: 'Resolve manually with full control',
    icon: User,
    risk: 'low',
    automated: false
  }
];

export const FileConflictUI: React.FC<FileConflictUIProps> = ({
  className = '',
  onConflictResolved,
  showNotifications = true
}) => {
  const [conflicts, setConflicts] = useState<ConflictWithMetadata[]>([]);
  const [selectedConflict, setSelectedConflict] = useState<ConflictWithMetadata | null>(null);
  const [resolutionInProgress, setResolutionInProgress] = useState<Set<string>>(new Set());
  const [showConflictDialog, setShowConflictDialog] = useState(false);
  const [autoResolveEnabled, setAutoResolveEnabled] = useState(true);

  // Load conflicts from service
  useEffect(() => {
    const loadConflicts = () => {
      const rawConflicts = fileSyncService.getConflicts();
      const enrichedConflicts: ConflictWithMetadata[] = rawConflicts.map(conflict => ({
        ...conflict,
        severity: determineSeverity(conflict),
        autoResolvable: canAutoResolve(conflict),
        suggestedResolution: getSuggestedResolution(conflict)
      }));

      setConflicts(enrichedConflicts);
    };

    // Initial load
    loadConflicts();

    // Listen for new conflicts
    const handleConflictDetected = (conflict: FileConflict) => {
      const enriched: ConflictWithMetadata = {
        ...conflict,
        severity: determineSeverity(conflict),
        autoResolvable: canAutoResolve(conflict),
        suggestedResolution: getSuggestedResolution(conflict)
      };

      setConflicts(prev => [...prev, enriched]);

      // Auto-resolve if enabled and possible
      if (autoResolveEnabled && enriched.autoResolvable && enriched.suggestedResolution) {
        setTimeout(() => {
          resolveConflict(enriched.conflictId, enriched.suggestedResolution!);
        }, 1000);
      }
    };

    const handleConflictResolved = (data: { conflictId: string }) => {
      setConflicts(prev => prev.filter(c => c.conflictId !== data.conflictId));
      setResolutionInProgress(prev => {
        const newSet = new Set(prev);
        newSet.delete(data.conflictId);
        return newSet;
      });
    };

    fileSyncService.on('conflict_detected', handleConflictDetected);
    fileSyncService.on('conflict_resolved', handleConflictResolved);

    return () => {
      fileSyncService.off('conflict_detected', handleConflictDetected);
      fileSyncService.off('conflict_resolved', handleConflictResolved);
    };
  }, [autoResolveEnabled]);

  const determineSeverity = (conflict: FileConflict): 'low' | 'medium' | 'high' | 'critical' => {
    if (conflict.users.length > 3) return 'critical';
    if (conflict.users.length > 2) return 'high';
    if (conflict.type === 'operation_conflict') return 'medium';
    return 'low';
  };

  const canAutoResolve = (conflict: FileConflict): boolean => {
    // Simple conflicts can be auto-resolved
    if (conflict.type === 'file_conflict' && conflict.users.length <= 2) {
      return true;
    }
    
    // Operation conflicts between different operations can be auto-resolved
    if (conflict.type === 'operation_conflict') {
      const operations = conflict.users.map(u => u.operation);
      const uniqueOperations = new Set(operations);
      return uniqueOperations.size <= 2;
    }

    return false;
  };

  const getSuggestedResolution = (conflict: FileConflict): ConflictResolution => {
    if (conflict.type === 'file_conflict') {
      return 'last_write_wins';
    }
    
    if (conflict.type === 'operation_conflict') {
      return 'auto';
    }

    return 'manual';
  };

  const resolveConflict = async (conflictId: string, resolution: ConflictResolution) => {
    setResolutionInProgress(prev => new Set(prev.add(conflictId)));

    try {
      // Find the conflict
      const conflict = conflicts.find(c => c.conflictId === conflictId);
      if (!conflict) return;

      // Determine winner for automated resolutions
      let winner;
      if (resolution === 'last_write_wins') {
        winner = conflict.users.sort((a, b) => b.timestamp - a.timestamp)[0];
      } else if (resolution === 'first_write_wins') {
        winner = conflict.users.sort((a, b) => a.timestamp - b.timestamp)[0];
      }

      // Call service to resolve
      fileSyncService.resolveConflict({
        conflictId,
        resolution,
        timestamp: new Date(),
        // Optionally add mergedContent if needed, e.g. mergedContent: winner?.mergedContent
      });
      
      // Notify parent component
      onConflictResolved?.(conflictId, resolution);

    } catch (error) {
      console.error('Failed to resolve conflict:', error);
      setResolutionInProgress(prev => {
        const newSet = new Set(prev);
        newSet.delete(conflictId);
        return newSet;
      });
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-600 bg-red-50 border-red-200';
      case 'high': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      default: return 'text-blue-600 bg-blue-50 border-blue-200';
    }
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'high': return 'text-red-600';
      case 'medium': return 'text-yellow-600';
      default: return 'text-green-600';
    }
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - timestamp;

    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString();
  };

  const openConflictDetails = (conflict: ConflictWithMetadata) => {
    setSelectedConflict(conflict);
    setShowConflictDialog(true);
  };

  if (conflicts.length === 0 && showNotifications) {
    return (
      <div className={cn('p-4', className)}>
        <Alert>
          <Check className="h-4 w-4" />
          <AlertTitle>No Conflicts</AlertTitle>
          <AlertDescription>
            All files are synchronized and no conflicts detected.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Conflicts List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-orange-500" />
                File Conflicts ({conflicts.length})
              </CardTitle>
              <CardDescription>
                Resolve conflicts to continue collaboration
              </CardDescription>
            </div>

            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-orange-600">
                {conflicts.filter(c => c.severity === 'critical' || c.severity === 'high').length} High Priority
              </Badge>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  conflicts.forEach(conflict => {
                    if (conflict.autoResolvable && conflict.suggestedResolution) {
                      resolveConflict(conflict.conflictId, conflict.suggestedResolution);
                    }
                  });
                }}
                disabled={conflicts.every(c => !c.autoResolvable)}
              >
                <Zap className="w-4 h-4 mr-2" />
                Auto-Resolve All
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <ScrollArea className="h-96">
            <div className="space-y-3 p-4">
              {conflicts.map((conflict) => (
                <div
                  key={conflict.conflictId}
                  className={cn(
                    'p-4 rounded-lg border transition-colors cursor-pointer hover:bg-muted/50',
                    getSeverityColor(conflict.severity)
                  )}
                  onClick={() => openConflictDetails(conflict)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="flex items-center gap-1">
                          {conflict.type === 'file_conflict' ? (
                            <File className="w-4 h-4" />
                          ) : (
                            <Folder className="w-4 h-4" />
                          )}
                          <span className="font-medium truncate">{conflict.path}</span>
                        </div>
                        
                        <Badge variant="outline" className="text-xs">
                          {conflict.severity}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-4 text-sm text-muted-foreground mb-2">
                        <div className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          <span>{conflict.users.length} users</span>
                        </div>
                        
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>{formatTimestamp(Math.max(...conflict.users.map(u => u.timestamp)))}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {conflict.users.map((user, index) => (
                          <Badge key={index} variant="secondary" className="text-xs">
                            {user.username}: {user.operation}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 ml-4">
                      {conflict.autoResolvable && (
                        <Badge variant="outline" className="text-green-600">
                          Auto-resolvable
                        </Badge>
                      )}
                      
                      {resolutionInProgress.has(conflict.conflictId) ? (
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                          <span className="text-sm text-muted-foreground">Resolving...</span>
                        </div>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (conflict.suggestedResolution) {
                              resolveConflict(conflict.conflictId, conflict.suggestedResolution);
                            }
                          }}
                          disabled={!conflict.suggestedResolution}
                        >
                          Quick Resolve
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Conflict Details Dialog */}
      <Dialog open={showConflictDialog} onOpenChange={setShowConflictDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>
              Resolve File Conflict
            </DialogTitle>
            <DialogDescription>
              {selectedConflict && `Choose how to resolve the conflict for "${selectedConflict.path}"`}
            </DialogDescription>
          </DialogHeader>

          {selectedConflict && (
            <div className="space-y-6">
              {/* Conflict Overview */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Conflict Details</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <h4 className="font-medium mb-2">File Information</h4>
                      <div className="space-y-1 text-sm">
                        <div>Path: <code className="bg-muted px-1 rounded">{selectedConflict.path}</code></div>
                        <div>Type: {selectedConflict.type.replace('_', ' ')}</div>
                        <div>Severity: <span className={cn('font-medium', getSeverityColor(selectedConflict.severity))}>{selectedConflict.severity}</span></div>
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="font-medium mb-2">Conflicting Users</h4>
                      <div className="space-y-1">
                        {selectedConflict.users.map((user, index) => (
                          <div key={index} className="flex items-center gap-2 text-sm">
                            <User className="w-3 h-3" />
                            <span>{user.username}</span>
                            <Badge variant="outline" className="text-xs">{user.operation}</Badge>
                            <span className="text-muted-foreground">{formatTimestamp(user.timestamp)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Resolution Options */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Resolution Options</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3 md:grid-cols-2">
                    {RESOLUTION_OPTIONS.map((option) => {
                      const Icon = option.icon;
                      return (
                        <Card
                          key={option.id}
                          className="cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={() => {
                            resolveConflict(selectedConflict.conflictId, option.id);
                            setShowConflictDialog(false);
                          }}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-start gap-3">
                              <Icon className="w-5 h-5 mt-1 text-primary" />
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <h4 className="font-medium">{option.label}</h4>
                                  <Badge variant="outline" className={cn('text-xs', getRiskColor(option.risk))}>
                                    {option.risk} risk
                                  </Badge>
                                  {option.automated && (
                                    <Badge variant="outline" className="text-xs text-blue-600">
                                      Automated
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-sm text-muted-foreground">{option.description}</p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConflictDialog(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FileConflictUI;
