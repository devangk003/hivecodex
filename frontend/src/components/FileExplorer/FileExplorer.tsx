import React, { useState, useRef, useCallback, useEffect } from 'react';
import { 
  ChevronRight, 
  ChevronDown, 
  File, 
  Folder, 
  FolderOpen,
  Plus,
  MoreHorizontal,
  RefreshCw,
  FileText,
  Image,
  Code,
  FileCode,
  Database
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { fileAPI } from '@/lib/api';
import { toast } from 'sonner';

export interface FileTreeItem {
  id: string;
  name: string;
  type: 'file' | 'folder';
  path: string;
  size?: number;
  content?: string;
  extension?: string;
  children?: FileTreeItem[];
  isExpanded?: boolean;
  isSelected?: boolean;
  lastModified?: Date;
  fileId?: string;
  parentId?: string;
}

interface FileExplorerProps {
  roomId: string;
  onFileSelect?: (file: FileTreeItem) => void;
  selectedFileId?: string;
}

interface FileNodeProps {
  item: FileTreeItem;
  level: number;
  onSelect: (item: FileTreeItem) => void;
  onToggleExpand: (item: FileTreeItem) => void;
  onCreateFile: (parentId: string, type: 'file' | 'folder') => void;
  onDeleteItem: (item: FileTreeItem) => void;
  onRenameItem: (item: FileTreeItem, newName: string) => void;
  selectedFileId?: string;
}

const getFileIcon = (name: string, type: 'file' | 'folder', isExpanded?: boolean) => {
  if (type === 'folder') {
    return isExpanded ? FolderOpen : Folder;
  }
  
  const extension = name.split('.').pop()?.toLowerCase();
  
  switch (extension) {
    case 'js':
    case 'jsx':
    case 'ts':
    case 'tsx':
      return FileCode;
    case 'html':
    case 'css':
    case 'scss':
    case 'less':
      return Code;
    case 'json':
    case 'xml':
    case 'yml':
    case 'yaml':
      return Database;
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'svg':
      return Image;
    case 'md':
    case 'txt':
      return FileText;
    default:
      return File;
  }
};

const FileNode: React.FC<FileNodeProps> = ({
  item,
  level,
  onSelect,
  onToggleExpand,
  onCreateFile,
  onDeleteItem,
  onRenameItem,
  selectedFileId,
}) => {
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(item.name);
  const inputRef = useRef<HTMLInputElement>(null);

  const Icon = getFileIcon(item.name, item.type, item.isExpanded);
  const isSelected = selectedFileId === item.id;

  useEffect(() => {
    if (isRenaming && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isRenaming]);

  const handleClick = () => {
    if (item.type === 'folder') {
      onToggleExpand(item);
    } else {
      onSelect(item);
    }
  };

  const handleRename = () => {
    if (renameValue.trim() && renameValue !== item.name) {
      onRenameItem(item, renameValue.trim());
    }
    setIsRenaming(false);
    setRenameValue(item.name);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleRename();
    } else if (e.key === 'Escape') {
      setIsRenaming(false);
      setRenameValue(item.name);
    }
  };

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            className={cn(
              'flex items-center h-6 px-2 cursor-pointer hover:bg-discord-sidebar-hover group',
              isSelected && 'bg-discord-primary/20',
              'transition-colors'
            )}
            style={{ paddingLeft: `${level * 12 + 8}px` }}
            onClick={handleClick}
          >
            {item.type === 'folder' && (
              <div className="w-4 h-4 flex items-center justify-center mr-1">
                {item.isExpanded ? (
                  <ChevronDown className="w-3 h-3 text-discord-text" />
                ) : (
                  <ChevronRight className="w-3 h-3 text-discord-text" />
                )}
              </div>
            )}
            
            <Icon className="w-4 h-4 mr-2 text-discord-text flex-shrink-0" />
            
            {isRenaming ? (
              <Input
                ref={inputRef}
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onBlur={handleRename}
                onKeyDown={handleKeyDown}
                className="h-5 text-xs border-none bg-discord-editor text-white p-0 focus:ring-1 focus:ring-discord-primary"
              />
            ) : (
              <span className="text-sm text-discord-text truncate flex-1">
                {item.name}
              </span>
            )}
          </div>
        </ContextMenuTrigger>
        
        <ContextMenuContent className="bg-discord-sidebar border-discord-border">
          {item.type === 'folder' && (
            <>
              <ContextMenuItem onClick={() => onCreateFile(item.id, 'file')}>
                <File className="w-4 h-4 mr-2" />
                New File
              </ContextMenuItem>
              <ContextMenuItem onClick={() => onCreateFile(item.id, 'folder')}>
                <Folder className="w-4 h-4 mr-2" />
                New Folder
              </ContextMenuItem>
              <ContextMenuSeparator />
            </>
          )}
          <ContextMenuItem onClick={() => setIsRenaming(true)}>
            Rename
          </ContextMenuItem>
          <ContextMenuItem 
            onClick={() => onDeleteItem(item)}
            className="text-red-400 focus:text-red-300"
          >
            Delete
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {item.type === 'folder' && item.isExpanded && item.children && (
        <div>
          {item.children.map((child) => (
            <FileNode
              key={child.id}
              item={child}
              level={level + 1}
              onSelect={onSelect}
              onToggleExpand={onToggleExpand}
              onCreateFile={onCreateFile}
              onDeleteItem={onDeleteItem}
              onRenameItem={onRenameItem}
              selectedFileId={selectedFileId}
            />
          ))}
        </div>
      )}
    </>
  );
};

export const FileExplorer: React.FC<FileExplorerProps> = ({
  roomId,
  onFileSelect,
  selectedFileId,
}) => {
  const [fileTree, setFileTree] = useState<FileTreeItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState<{ type: 'file' | 'folder'; parentId: string } | null>(null);
  const [newItemName, setNewItemName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const loadFiles = useCallback(async () => {
    try {
      setIsLoading(true);
      const files = await fileAPI.getRoomFiles(roomId);
      
      // Transform the flat file list into a tree structure
      const buildTree = (items: any[], parentId: string | null = null): FileTreeItem[] => {
        return items
          .filter(item => item.parentId === parentId)
          .map(item => ({
            id: item.fileId || item.id,
            name: item.name,
            type: item.type === 'directory' ? 'folder' : 'file',
            path: item.path || item.name,
            size: item.size,
            extension: item.extension,
            lastModified: item.lastModified ? new Date(item.lastModified) : undefined,
            fileId: item.fileId,
            parentId: item.parentId,
            isExpanded: false,
            children: item.type === 'directory' ? buildTree(items, item.fileId || item.id) : undefined,
          }));
      };

      const tree = buildTree(files);
      setFileTree(tree);
    } catch (error) {
      console.error('Failed to load files:', error);
      toast.error('Failed to load files');
    } finally {
      setIsLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    if (roomId) {
      loadFiles();
    }
  }, [roomId, loadFiles]);

  useEffect(() => {
    if (isCreating && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isCreating]);

  const updateFileTree = (tree: FileTreeItem[], targetId: string, updater: (item: FileTreeItem) => FileTreeItem): FileTreeItem[] => {
    return tree.map(item => {
      if (item.id === targetId) {
        return updater(item);
      }
      if (item.children) {
        return {
          ...item,
          children: updateFileTree(item.children, targetId, updater),
        };
      }
      return item;
    });
  };

  const handleToggleExpand = (item: FileTreeItem) => {
    setFileTree(prev => 
      updateFileTree(prev, item.id, (current) => ({
        ...current,
        isExpanded: !current.isExpanded,
      }))
    );
  };

  const handleFileSelect = (item: FileTreeItem) => {
    if (item.type === 'file') {
      onFileSelect?.(item);
    }
  };

  const handleCreateFile = (parentId: string, type: 'file' | 'folder') => {
    setIsCreating({ type, parentId });
    setNewItemName(type === 'file' ? 'untitled.txt' : 'New Folder');
  };

  const handleCreateConfirm = async () => {
    if (!isCreating || !newItemName.trim()) return;

    try {
      // TODO: Implement actual file/folder creation API call
      // For now, we'll add it locally
      const newItem: FileTreeItem = {
        id: Date.now().toString(),
        name: newItemName.trim(),
        type: isCreating.type,
        path: newItemName.trim(),
        fileId: Date.now().toString(),
        parentId: isCreating.parentId === 'root' ? null : isCreating.parentId,
        isExpanded: false,
        children: isCreating.type === 'folder' ? [] : undefined,
      };

      if (isCreating.parentId === 'root') {
        setFileTree(prev => [...prev, newItem]);
      } else {
        setFileTree(prev => 
          updateFileTree(prev, isCreating.parentId, (current) => ({
            ...current,
            children: [...(current.children || []), newItem],
            isExpanded: true,
          }))
        );
      }

      toast.success(`${isCreating.type === 'file' ? 'File' : 'Folder'} created successfully`);
    } catch (error) {
      console.error('Failed to create item:', error);
      toast.error(`Failed to create ${isCreating.type}`);
    } finally {
      setIsCreating(null);
      setNewItemName('');
    }
  };

  const handleCreateCancel = () => {
    setIsCreating(null);
    setNewItemName('');
  };

  const handleDeleteItem = async (item: FileTreeItem) => {
    if (!confirm(`Are you sure you want to delete "${item.name}"?`)) return;

    try {
      // TODO: Implement actual delete API call
      
      const removeFromTree = (tree: FileTreeItem[], targetId: string): FileTreeItem[] => {
        return tree.filter(treeItem => {
          if (treeItem.id === targetId) return false;
          if (treeItem.children) {
            treeItem.children = removeFromTree(treeItem.children, targetId);
          }
          return true;
        });
      };

      setFileTree(prev => removeFromTree(prev, item.id));
      toast.success(`${item.type === 'file' ? 'File' : 'Folder'} deleted successfully`);
    } catch (error) {
      console.error('Failed to delete item:', error);
      toast.error(`Failed to delete ${item.type}`);
    }
  };

  const handleRenameItem = async (item: FileTreeItem, newName: string) => {
    try {
      // TODO: Implement actual rename API call
      
      setFileTree(prev => 
        updateFileTree(prev, item.id, (current) => ({
          ...current,
          name: newName,
          path: newName,
        }))
      );

      toast.success(`${item.type === 'file' ? 'File' : 'Folder'} renamed successfully`);
    } catch (error) {
      console.error('Failed to rename item:', error);
      toast.error(`Failed to rename ${item.type}`);
    }
  };

  return (
    <div className="h-full bg-discord-sidebar flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-2 border-b border-discord-border">
        <span className="text-xs font-medium text-discord-text uppercase tracking-wide">
          Explorer
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 hover:bg-discord-sidebar-hover"
            onClick={() => handleCreateFile('root', 'file')}
            title="New File"
          >
            <Plus className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 hover:bg-discord-sidebar-hover"
            onClick={() => handleCreateFile('root', 'folder')}
            title="New Folder"
          >
            <Folder className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 hover:bg-discord-sidebar-hover"
            onClick={loadFiles}
            title="Refresh Explorer"
          >
            <RefreshCw className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 hover:bg-discord-sidebar-hover"
            title="More Actions..."
          >
            <MoreHorizontal className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* File Tree */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-20">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-discord-primary"></div>
          </div>
        ) : (
          <>
            {fileTree.map((item) => (
              <FileNode
                key={item.id}
                item={item}
                level={0}
                onSelect={handleFileSelect}
                onToggleExpand={handleToggleExpand}
                onCreateFile={handleCreateFile}
                onDeleteItem={handleDeleteItem}
                onRenameItem={handleRenameItem}
                selectedFileId={selectedFileId}
              />
            ))}

            {/* New item creation input */}
            {isCreating && (
              <div
                className="flex items-center h-6 px-2"
                style={{ paddingLeft: isCreating.parentId === 'root' ? '8px' : '20px' }}
              >
                {isCreating.type === 'file' ? (
                  <File className="w-4 h-4 mr-2 text-discord-text" />
                ) : (
                  <Folder className="w-4 h-4 mr-2 text-discord-text" />
                )}
                <Input
                  ref={inputRef}
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  onBlur={handleCreateCancel}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleCreateConfirm();
                    } else if (e.key === 'Escape') {
                      handleCreateCancel();
                    }
                  }}
                  className="h-5 text-xs border-none bg-discord-editor text-white p-0 focus:ring-1 focus:ring-discord-primary"
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
