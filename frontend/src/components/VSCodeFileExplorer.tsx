import React, { useState, useCallback } from 'react';
import { 
  File, 
  Folder, 
  FolderOpen, 
  FileText, 
  ChevronDown, 
  ChevronRight,
  Upload,
  Trash2,
  Plus,
  Download,
  AlertTriangle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useDropzone } from 'react-dropzone';
import { toast } from 'sonner';

interface FileTreeItem {
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
  isCorrupted?: boolean;
}

interface VSCodeFileExplorerProps {
  files: FileTreeItem[];
  onFileSelect: (file: FileTreeItem) => void;
  onFileUpload: (files: File[]) => void;
  onFileDelete: (fileId: string) => void;
  onZipUpload: (files: FileTreeItem[]) => void;
}

const getFileIcon = (item: FileTreeItem) => {
  if (item.type === 'folder') {
    return item.isExpanded ? (
      <FolderOpen className="w-4 h-4 text-blue-400" />
    ) : (
      <Folder className="w-4 h-4 text-blue-400" />
    );
  }
  
  switch (item.extension) {
    case 'py':
      return <File className="w-4 h-4 text-blue-400" />;
    case 'js':
      return <File className="w-4 h-4 text-yellow-400" />;
    case 'tsx':
    case 'ts':
      return <File className="w-4 h-4 text-blue-300" />;
    case 'env':
      return <File className="w-4 h-4 text-green-400" />;
    case 'json':
      return <File className="w-4 h-4 text-orange-400" />;
    case 'md':
      return <File className="w-4 h-4 text-purple-400" />;
    default:
      return <FileText className="w-4 h-4 text-muted-foreground" />;
  }
};

const FileTreeItem: React.FC<{ 
  item: FileTreeItem; 
  depth?: number;
  onSelect: (file: FileTreeItem) => void;
  onDelete: (fileId: string) => void;
}> = ({ item, depth = 0, onSelect, onDelete }) => {
  const [isExpanded, setIsExpanded] = useState(item.isExpanded || false);
  
  const handleClick = () => {
    if (item.type === 'folder') {
      setIsExpanded(!isExpanded);
    } else {
      onSelect(item);
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (item.fileId) {
      console.log('Deleting file with fileId:', item.fileId);
      onDelete(item.fileId);
    } else {
      console.log('No fileId found for item:', item);
    }
  };

  return (
    <div className="min-w-0">
      <div 
        className={`flex items-center gap-2 py-1 px-2 hover:bg-discord-sidebar-hover rounded-sm cursor-pointer text-sm transition-colors group min-w-0 ${
          item.isSelected ? 'bg-discord-primary/20 text-discord-primary' : 'text-foreground'
        }`}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
        onClick={handleClick}
      >
        {item.type === 'folder' && (
          <div className="w-4 h-4 flex items-center justify-center flex-shrink-0">
            {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          </div>
        )}
        <div className="flex-shrink-0">
          {getFileIcon({ ...item, isExpanded })}
        </div>
        {item.isCorrupted && (
          <div className="flex-shrink-0 text-yellow-500" title="File is corrupted or missing">
            <AlertTriangle className="w-3 h-3" />
          </div>
        )}
        <span className={`flex-1 truncate min-w-0 ${item.isCorrupted ? 'text-yellow-500' : ''}`} title={item.name}>
          {item.name}
        </span>
        
        {item.type === 'file' && (
          <Button
            variant="ghost"
            size="sm"
            className="w-5 h-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
            onClick={handleDelete}
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        )}
      </div>
      
      {item.type === 'folder' && isExpanded && item.children && (
        <div>
          {item.children.map((child) => (
            <FileTreeItem 
              key={child.id} 
              item={child} 
              depth={depth + 1}
              onSelect={onSelect}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const VSCodeFileExplorer: React.FC<VSCodeFileExplorerProps> = ({
  files,
  onFileSelect,
  onFileUpload,
  onFileDelete,
  onZipUpload,
}) => {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: onFileUpload,
    accept: {
      'text/*': ['.txt', '.js', '.ts', '.tsx', '.py', '.json', '.md', '.html', '.css'],
      'application/javascript': ['.js'],
      'application/json': ['.json'],
      'application/zip': ['.zip'],
    },
  });

  const handleFileSelect = useCallback((file: FileTreeItem) => {
    onFileSelect(file);
  }, [onFileSelect]);

  const handleFileDelete = useCallback((fileId: string) => {
    onFileDelete(fileId);
  }, [onFileDelete]);

  if (files.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <div 
          {...getRootProps()} 
          className={`w-full border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            isDragActive 
              ? 'border-discord-primary bg-discord-primary/10' 
              : 'border-discord-border hover:border-discord-primary/50'
          }`}
        >
          <input {...getInputProps()} />
          <Upload className="w-8 h-8 mx-auto mb-4 text-muted-foreground" />
          <p className="text-sm text-foreground font-medium mb-2">
            {isDragActive ? 'Drop files here' : 'Drag & drop files here'}
          </p>
          <p className="text-xs text-muted-foreground">
            or click to select files
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="p-2">
        {files.map((file) => (
          <FileTreeItem 
            key={file.id} 
            item={file} 
            onSelect={handleFileSelect}
            onDelete={handleFileDelete}
          />
        ))}
      </div>
      
      {/* Drop zone overlay */}
      {isDragActive && (
        <div 
          {...getRootProps()}
          className="absolute inset-0 bg-discord-primary/20 border-2 border-discord-primary border-dashed rounded-lg flex items-center justify-center z-10"
        >
          <input {...getInputProps()} />
          <div className="text-center">
            <Upload className="w-12 h-12 mx-auto mb-4 text-discord-primary" />
            <p className="text-lg font-medium text-discord-primary">Drop files here</p>
          </div>
        </div>
      )}
    </div>
  );
};
