import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { 
  ChevronRight, 
  ChevronDown, 
  File, 
  Folder, 
  FolderOpen,
  Plus,
  FolderPlus,
  MoreHorizontal,
  RefreshCw,
  FileText,
  Image,
  Code,
  FileCode,
  Database,
  Upload,
  Loader2
} from 'lucide-react';
import { useDropzone } from 'react-dropzone';
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
import { useFileEditing } from '@/contexts/FileEditingContext';

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
  onItemDrop?: (draggedItem: FileTreeItem, targetFolderId: string | null) => void;
  selectedFileId?: string;
  draggedItem?: FileTreeItem | null;
  setDraggedItem?: (item: FileTreeItem | null) => void;
  setDragOverItem?: (itemId: string | null) => void;
  dragOverItem?: string | null;
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
  onItemDrop,
  selectedFileId,
  draggedItem,
  setDraggedItem,
  setDragOverItem,
  dragOverItem,
}) => {
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(item.name);
  const inputRef = useRef<HTMLInputElement>(null);
  const { isFileBeingEdited, getEditingUsers } = useFileEditing();

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

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', item.id);
    setDraggedItem?.(item);
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (item.type === 'folder' && draggedItem && draggedItem.id !== item.id) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      setDragOverItem?.(item.id);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOverItem?.(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (item.type === 'folder' && draggedItem && onItemDrop) {
      onItemDrop(draggedItem, item.id);
    }
    
    setDraggedItem?.(null);
    setDragOverItem?.(null);
  };

  const handleDragEnd = () => {
    setDraggedItem?.(null);
    setDragOverItem?.(null);
  };

  const isDraggedOver = dragOverItem === item.id;
  const isDraggedItem = draggedItem?.id === item.id;

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
              isDraggedOver && 'bg-discord-primary/30 border-l-2 border-discord-primary',
              isDraggedItem && 'opacity-50',
              'transition-colors'
            )}
            style={{ paddingLeft: `${level * 12 + 8}px` }}
            onClick={handleClick}
            draggable
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onDragEnd={handleDragEnd}
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
                className="h-5 text-xs border-none bg-discord-editor text-white p-0 focus:ring-1 focus:ring-discord-primary flex-1"
              />
            ) : (
              <span className="text-sm text-discord-text truncate flex-1">
                {item.name}
              </span>
            )}

            {/* Neon green dot for files being edited (placed to the right of the name) */}
            {item.type === 'file' && !isRenaming && isFileBeingEdited(item.fileId || item.id) && (
              <div className="w-2 h-2 bg-green-400 rounded-full ml-2 animate-pulse shadow-lg shadow-green-400/50" />
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
              onItemDrop={onItemDrop}
              selectedFileId={selectedFileId}
              draggedItem={draggedItem}
              setDraggedItem={setDraggedItem}
              setDragOverItem={setDragOverItem}
              dragOverItem={dragOverItem}
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
  const [isUploading, setIsUploading] = useState(false);
  const [dragOverItem, setDragOverItem] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [draggedItem, setDraggedItem] = useState<FileTreeItem | null>(null);
  const [isCreating, setIsCreating] = useState<{ type: 'file' | 'folder'; parentId: string } | null>(null);
  const [newItemName, setNewItemName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const dropzoneRef = useRef<HTMLDivElement>(null);

  const loadFiles = useCallback(async () => {
    try {
      setIsLoading(true);
      const files = await fileAPI.getRoomFiles(roomId);
      
      // Transform the flat file list into a tree structure (normalize ObjectId/string)
      const buildTree = (items: any[], parentId: string | null = null): FileTreeItem[] => {
        const parentIdStr = parentId === null ? null : String(parentId);
        return items
          .filter(item => {
            const itemParentStr = item.parentId == null ? null : String(item.parentId);
            return itemParentStr === parentIdStr;
          })
          .map(item => ({
            id: (item.fileId ? String(item.fileId) : (item.id ? String(item.id) : String(item._id))) as string,
            name: item.name,
            type: item.type === 'folder' ? 'folder' : 'file',
            path: item.path || item.name,
            size: item.size,
            extension: item.extension,
            lastModified: item.lastModified ? new Date(item.lastModified) : undefined,
            fileId: item.fileId ? String(item.fileId) : undefined,
            parentId: item.parentId == null ? null : String(item.parentId),
            isExpanded: false,
            children: item.type === 'folder' ? buildTree(items, (item.fileId ? String(item.fileId) : (item.id ? String(item.id) : String(item._id)))) : undefined,
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
      if (isCreating.type === 'file') {
        await fileAPI.createFile(
          roomId,
          newItemName.trim(),
          isCreating.parentId === 'root' ? null : isCreating.parentId
        );
        await loadFiles();
        toast.success('File created successfully');
      } else {
        await fileAPI.createFolder(
          roomId,
          newItemName.trim(),
          isCreating.parentId === 'root' ? null : isCreating.parentId
        );
        await loadFiles();
        toast.success('Folder created successfully');
      }
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
      await fileAPI.deleteFile(roomId, item.id);
      await loadFiles();
      toast.success(`${item.type === 'file' ? 'File' : 'Folder'} deleted successfully`);
    } catch (error) {
      console.error('Failed to delete item:', error);
      toast.error(`Failed to delete ${item.type}`);
    }
  };

  const handleRenameItem = async (item: FileTreeItem, newName: string) => {
    if (newName === item.name) return;

    try {
      await fileAPI.renameFile(roomId, item.id, newName);
      await loadFiles();
      toast.success('Item renamed successfully');
    } catch (error) {
      console.error('Failed to rename item:', error);
      toast.error('Failed to rename item');
    }
  };

  // Handle file uploads via drag and drop
  const handleFileDrop = useCallback(async (acceptedFiles: File[], fileRejections: any[], event: any) => {
    if (!dragOverItem) return;
    
    const targetFolderId = dragOverItem === 'root' ? null : dragOverItem;
    setIsUploading(true);
    
    try {
      const uploadPromises = acceptedFiles.map(async (file) => {
        const formData = new FormData();
        formData.append('file', file);
        if (targetFolderId) {
          formData.append('parentId', targetFolderId);
        }
        return fileAPI.uploadFile(roomId, formData);
      });
      
      await Promise.all(uploadPromises);
      await loadFiles();
      toast.success(`Uploaded ${acceptedFiles.length} file(s) successfully`);
    } catch (error) {
      console.error('Failed to upload files:', error);
      toast.error('Failed to upload files');
    } finally {
      setIsUploading(false);
      setDragOverItem(null);
      setIsDragging(false);
    }
  }, [dragOverItem, roomId, loadFiles]);

  // Handle moving files/folders via drag and drop
  const handleItemDrop = async (draggedItem: FileTreeItem, targetFolderId: string | null) => {
    if (!draggedItem || draggedItem.id === targetFolderId || (draggedItem.parentId === targetFolderId)) {
      return;
    }

    // Prevent moving a folder into its own subtree
    const isDescendant = (folderId: string, targetId: string | null): boolean => {
      if (!targetId) return false;
      const findItem = (items: FileTreeItem[], id: string): FileTreeItem | null => {
        for (const item of items) {
          if (item.id === id) return item;
          if (item.children) {
            const found = findItem(item.children, id);
            if (found) return found;
          }
        }
        return null;
      };
      
      const targetItem = findItem(fileTree, targetId);
      if (!targetItem) return false;
      
      const checkChildren = (current: FileTreeItem): boolean => {
        if (current.id === folderId) return true;
        if (!current.children) return false;
        return current.children.some(checkChildren);
      };
      
      return checkChildren(targetItem);
    };

    if (draggedItem.type === 'folder' && isDescendant(draggedItem.id, targetFolderId)) {
      toast.error('Cannot move a folder into its own subfolder');
      return;
    }

    try {
      await fileAPI.moveFileOrFolder(roomId, draggedItem.id, targetFolderId);
      await loadFiles();
      toast.success(`Moved ${draggedItem.name} successfully`);
    } catch (error) {
      console.error('Failed to move item:', error);
      toast.error(`Failed to move ${draggedItem.type}`);
    }
  };

  // Configure dropzone for file uploads
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: handleFileDrop,
    noClick: true,
    noKeyboard: true,
    onDragEnter: () => setIsDragging(true),
    onDragLeave: (e) => {
      // Only set dragging to false if we're leaving the dropzone entirely
      if (!dropzoneRef.current?.contains(e.relatedTarget as Node)) {
        setIsDragging(false);
        setDragOverItem(null);
      }
    },
  });

  // Memoize the file tree rendering to prevent unnecessary re-renders
  const renderFileTree = useMemo(() => {
    const renderTree = (items: FileTreeItem[], level = 0) => {
      return items.map((item) => (
        <FileNode
          key={item.id}
          item={item}
          level={level}
          onSelect={handleFileSelect}
          onToggleExpand={handleToggleExpand}
          onCreateFile={handleCreateFile}
          onDeleteItem={handleDeleteItem}
          onRenameItem={handleRenameItem}
          onItemDrop={handleItemDrop}
          selectedFileId={selectedFileId}
          draggedItem={draggedItem}
          setDraggedItem={setDraggedItem}
          setDragOverItem={setDragOverItem}
          dragOverItem={dragOverItem}
        />
      ));
    };

    return renderTree(fileTree);
  }, [fileTree, selectedFileId, draggedItem, dragOverItem]);

  return (
    <div 
      className="h-full flex flex-col bg-discord-sidebar text-discord-text relative"
      {...getRootProps()}
      ref={dropzoneRef}
    >
      <input {...getInputProps()} />
      <div className="flex items-center justify-between px-3 py-2 border-b border-discord-border">
        <h3 className="text-sm font-medium">EXPLORER</h3>
        <div className="flex items-center space-x-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={(e) => {
              e.stopPropagation();
              loadFiles();
            }}
            title="Refresh"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={(e) => {
              e.stopPropagation();
              handleCreateFile('root', 'file');
            }}
            title="New File"
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={(e) => {
              e.stopPropagation();
              handleCreateFile('root', 'folder');
            }}
            title="New Folder"
          >
            <FolderPlus className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      <div 
        className={`flex-1 overflow-y-auto relative ${isDragging ? 'bg-discord-primary/10' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!dragOverItem) {
            setDragOverItem('root');
          }
        }}
      >
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-discord-primary"></div>
          </div>
        ) : fileTree.length === 0 ? (
          <div 
            className={`text-center p-4 text-sm ${isDragging ? 'text-discord-primary' : 'text-discord-text-muted'}`}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setDragOverItem('root');
            }}
          >
            {isDragging ? 'Drop files here to upload' : 'No files found. Drag and drop files here to upload.'}
          </div>
        ) : (
          <div 
            className={`min-h-full ${isDragging ? 'opacity-75' : ''}`}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (dragOverItem !== 'root') {
                setDragOverItem('root');
              }
            }}
          >
            {renderFileTree}
          </div>
        )}
        
        {isCreating && (
          <div className="flex items-center px-2 py-1 bg-discord-sidebar-hover border border-discord-border rounded mx-2 mb-2" style={{ paddingLeft: '16px' }}>
            {isCreating.type === 'file' ? (
              <File className="w-4 h-4 mr-2 text-discord-text" />
            ) : (
              <Folder className="w-4 h-4 mr-2 text-discord-text" />
            )}
            <Input
              ref={inputRef}
              type="text"
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              onBlur={handleCreateCancel}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateConfirm();
                else if (e.key === 'Escape') handleCreateCancel();
              }}
              className="flex-1 bg-discord-sidebar text-sm text-white border-discord-border focus:ring-1 focus:ring-discord-primary h-6"
              placeholder={isCreating.type === 'file' ? 'Enter file name...' : 'Enter folder name...'}
              autoFocus
            />
          </div>
        )}
        
        {/* Upload indicator */}
        {isUploading && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <div className="bg-discord-sidebar border border-discord-border rounded-lg p-4 flex items-center space-x-3">
              <Loader2 className="h-5 w-5 animate-spin text-discord-primary" />
              <span className="text-sm text-discord-text">Uploading files...</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FileExplorer;
