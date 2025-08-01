/**
 * Real-time File Tree Component
 * Displays a synchronized file tree with live updates and conflict indicators
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  ChevronRight,
  ChevronDown,
  File,
  Folder,
  FolderOpen,
  Search,
  AlertTriangle,
  RefreshCw,
  Settings,
  Eye,
  EyeOff,
  MoreHorizontal,
  Plus,
  Upload,
  Download,
  Copy,
  Trash2,
  Edit3,
  Move,
  FileText,
  Image,
  FileCode,
  Archive,
  FileVideo,
  Music,
  Clock
} from 'lucide-react';
import { Button } from '../button';
import { Input } from '../input';
import { Badge } from '../badge';
import { ScrollArea } from '../scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../tooltip';
import { cn } from '../../../lib/utils';
import { fileSyncService } from '../../../services/fileSynchronization';
import type { FileTreeNode } from '../../../types/filesystem';

export interface RealTimeFileTreeProps {
  className?: string;
  onFileSelect?: (file: FileTreeNode) => void;
  onDirectorySelect?: (directory: FileTreeNode) => void;
  showSearch?: boolean;
  showMetadata?: boolean;
  viewMode?: 'compact' | 'detailed';
  maxDepth?: number;
}

interface FileTypeConfig {
  icon: React.ElementType;
  color: string;
  extensions: string[];
}

const FILE_TYPES: Record<string, FileTypeConfig> = {
  code: {
    icon: FileCode,
    color: 'text-blue-600',
    extensions: ['.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.cpp', '.c', '.php', '.rb', '.go', '.rs']
  },
  image: {
    icon: Image,
    color: 'text-green-600',
    extensions: ['.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp', '.bmp']
  },
  video: {
    icon: FileVideo,
    color: 'text-purple-600',
    extensions: ['.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm']
  },
  audio: {
    icon: Music,
    color: 'text-orange-600',
    extensions: ['.mp3', '.wav', '.flac', '.aac', '.ogg']
  },
  archive: {
    icon: Archive,
    color: 'text-yellow-600',
    extensions: ['.zip', '.rar', '.7z', '.tar', '.gz']
  },
  document: {
    icon: FileText,
    color: 'text-indigo-600',
    extensions: ['.pdf', '.doc', '.docx', '.txt', '.md', '.rtf']
  }
};

const getFileType = (filename: string): FileTypeConfig => {
  const extension = filename.toLowerCase().substring(filename.lastIndexOf('.'));
  
  for (const [, config] of Object.entries(FILE_TYPES)) {
    if (config.extensions.includes(extension)) {
      return config;
    }
  }
  
  return {
    icon: File,
    color: 'text-gray-600',
    extensions: []
  };
};

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const formatLastModified = (timestamp: number): string => {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - timestamp;

  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return date.toLocaleDateString();
};

export const RealTimeFileTree: React.FC<RealTimeFileTreeProps> = ({
  className = '',
  onFileSelect,
  onDirectorySelect,
  showSearch = true,
  showMetadata = true,
  viewMode = 'detailed',
  maxDepth = 10
}) => {
  const [fileTree, setFileTree] = useState<FileTreeNode[]>([]);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showHidden, setShowHidden] = useState(false);
  const [conflicts, setConflicts] = useState<Set<string>>(new Set());

  // Load initial file tree
  useEffect(() => {
    const loadFileTree = async () => {
      setIsLoading(true);
      try {
        const tree = fileSyncService.getFileTree();
        setFileTree(tree);
      } catch (error) {
        console.error('Failed to load file tree:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadFileTree();

    // Listen for real-time updates
    const handleFileTreeUpdate = (updatedTree: FileTreeNode[]) => {
      setFileTree(updatedTree);
    };

    const handleFileConflict = (conflictData: { path: string; [key: string]: unknown }) => {
      setConflicts(prev => new Set(prev.add(conflictData.path)));
    };

    const handleConflictResolved = (conflictData: { path: string; [key: string]: unknown }) => {
      setConflicts(prev => {
        const newSet = new Set(prev);
        newSet.delete(conflictData.path);
        return newSet;
      });
    };

    fileSyncService.on('file_tree_update', handleFileTreeUpdate);
    fileSyncService.on('conflict_detected', handleFileConflict);
    fileSyncService.on('conflict_resolved', handleConflictResolved);

    return () => {
      fileSyncService.off('file_tree_update', handleFileTreeUpdate);
      fileSyncService.off('conflict_detected', handleFileConflict);
      fileSyncService.off('conflict_resolved', handleConflictResolved);
    };
  }, []);

  // Filter and search functionality
  const filteredTree = useMemo(() => {
    const filterNode = (node: FileTreeNode): FileTreeNode | null => {
      // Hide hidden files if showHidden is false
      if (!showHidden && node.name.startsWith('.')) {
        return null;
      }

      // Apply search filter
      if (searchQuery) {
        const matchesSearch = node.name.toLowerCase().includes(searchQuery.toLowerCase());
        const hasMatchingChildren = node.children?.some(child => filterNode(child) !== null);
        
        if (!matchesSearch && !hasMatchingChildren) {
          return null;
        }
      }

      // Filter children recursively
      const filteredChildren = node.children
        ?.map(child => filterNode(child))
        .filter(Boolean) as FileTreeNode[];

      return {
        ...node,
        children: filteredChildren
      };
    };

    return fileTree.map(node => filterNode(node)).filter(Boolean) as FileTreeNode[];
  }, [fileTree, searchQuery, showHidden]);

  const toggleNode = (path: string) => {
    setExpandedNodes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(path)) {
        newSet.delete(path);
      } else {
        newSet.add(path);
      }
      return newSet;
    });
  };

  const selectNode = (node: FileTreeNode) => {
    setSelectedNode(node.path);
    
    if (node.isDirectory) {
      onDirectorySelect?.(node);
      toggleNode(node.path);
    } else {
      onFileSelect?.(node);
    }
  };

  const refreshTree = () => {
    fileSyncService.requestFileTreeSync();
  };

  const renderTreeNode = (node: FileTreeNode, depth: number = 0): React.ReactNode => {
    if (depth > maxDepth) return null;

    const isExpanded = expandedNodes.has(node.path);
    const isSelected = selectedNode === node.path;
    const hasConflict = conflicts.has(node.path);
    const fileType = node.isDirectory ? null : getFileType(node.name);

    const NodeIcon = node.isDirectory 
      ? (isExpanded ? FolderOpen : Folder)
      : fileType?.icon || File;

    return (
      <div key={node.path} className="select-none">
        <div
          className={cn(
            'flex items-center gap-2 py-1 px-2 rounded hover:bg-muted/50 cursor-pointer transition-colors',
            isSelected && 'bg-primary/10 border border-primary/20',
            hasConflict && 'bg-orange-50 border-orange-200',
            depth > 0 && 'ml-4'
          )}
          onClick={() => selectNode(node)}
        >
          {/* Expand/Collapse Icon */}
          {node.isDirectory && (
            <Button
              variant="ghost"
              size="sm"
              className="w-4 h-4 p-0"
              onClick={(e) => {
                e.stopPropagation();
                toggleNode(node.path);
              }}
            >
              {isExpanded ? (
                <ChevronDown className="w-3 h-3" />
              ) : (
                <ChevronRight className="w-3 h-3" />
              )}
            </Button>
          )}

          {/* File/Folder Icon */}
          <NodeIcon 
            className={cn(
              'w-4 h-4',
              fileType?.color || (node.isDirectory ? 'text-blue-600' : 'text-gray-600')
            )} 
          />

          {/* File/Folder Name */}
          <span className="flex-1 truncate text-sm">
            {node.name}
          </span>

          {/* Conflict Indicator */}
          {hasConflict && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <AlertTriangle className="w-4 h-4 text-orange-500" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>File conflict detected</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {/* Metadata (Detailed View) */}
          {viewMode === 'detailed' && showMetadata && !node.isDirectory && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {node.size && (
                <span>{formatFileSize(node.size)}</span>
              )}
              {node.lastModified && (
                <span>{formatLastModified(node.lastModified?.getTime() || Date.now())}</span>
              )}
            </div>
          )}

          {/* Context Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="w-4 h-4 p-0 opacity-0 group-hover:opacity-100"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="w-3 h-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem>
                <Edit3 className="w-4 h-4 mr-2" />
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Copy className="w-4 h-4 mr-2" />
                Copy
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Move className="w-4 h-4 mr-2" />
                Move
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <Download className="w-4 h-4 mr-2" />
                Download
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-red-600">
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Render Children */}
        {node.isDirectory && isExpanded && node.children && (
          <div className="ml-2">
            {node.children.map(child => renderTreeNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <TooltipProvider>
      <div className={cn('border rounded-lg bg-background', className)}>
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b">
          <div className="flex items-center gap-2">
            <Folder className="w-5 h-5 text-blue-600" />
            <span className="font-medium">File Explorer</span>
            {conflicts.size > 0 && (
              <Badge variant="destructive" className="text-xs">
                {conflicts.size} conflicts
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-1">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowHidden(!showHidden)}
                    className={cn(showHidden && 'bg-muted')}
                  >
                    {showHidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {showHidden ? 'Hide hidden files' : 'Show hidden files'}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={refreshTree}
                    disabled={isLoading}
                  >
                    <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  Refresh file tree
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  <Settings className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem>
                  <Plus className="w-4 h-4 mr-2" />
                  New File
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Folder className="w-4 h-4 mr-2" />
                  New Folder
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Files
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Search */}
        {showSearch && (
          <div className="p-3 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search files and folders..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        )}

        {/* File Tree */}
        <ScrollArea className="h-96">
          <div className="p-2">
            {isLoading ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                Loading file tree...
              </div>
            ) : filteredTree.length === 0 ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <div className="text-center">
                  <Folder className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No files found</p>
                  {searchQuery && (
                    <p className="text-sm mt-1">Try adjusting your search</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                {filteredTree.map(node => renderTreeNode(node))}
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    </TooltipProvider>
  );
};

export default RealTimeFileTree;
