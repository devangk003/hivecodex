import React, { useState, useCallback } from 'react';
import { 
  Upload,
  Download,
  Plus,
  RefreshCw,
  X,
  Archive
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { VSCodeFileExplorer } from './VSCodeFileExplorer';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDropzone } from 'react-dropzone';
import { toast } from 'sonner';
import { fileAPI, FileItem } from '@/lib/api';

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

interface UploadProgress {
  fileName: string;
  progress: number;
  status: 'uploading' | 'success' | 'error';
}

interface ExplorerPanelProps {
  onFileSelect: (file: FileTreeItem) => void;
  roomId: string;
  isOpen: boolean;
}

export const ExplorerPanel: React.FC<ExplorerPanelProps> = ({
  onFileSelect,
  roomId,
  isOpen
}) => {
  const [uploadProgress, setUploadProgress] = useState<UploadProgress[]>([]);
  const queryClient = useQueryClient();

  // Fetch files only when panel is open
  const { data: files = [], isLoading } = useQuery({
    queryKey: ['files', roomId],
    queryFn: () => fileAPI.getRoomFiles(roomId),
    enabled: roomId && isOpen,
    refetchOnWindowFocus: false,
    staleTime: 30000, // 30 seconds
  });

  // File upload mutation
  const uploadMutation = useMutation({
    mutationFn: ({ file, roomId }: { file: File; roomId: string }) => 
      fileAPI.uploadFile(roomId, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['files', roomId] });
      toast.success('File uploaded successfully');
    },
    onError: (error) => {
      console.error('Upload error:', error);
      toast.error('Failed to upload file');
    },
  });

  // File deletion mutation
  const deleteMutation = useMutation({
    mutationFn: (fileId: string) => fileAPI.deleteFile(fileId),
    onSuccess: () => {
      console.log('File deleted successfully, invalidating queries');
      queryClient.invalidateQueries({ queryKey: ['files', roomId] });
      queryClient.refetchQueries({ queryKey: ['files', roomId] });
      toast.success('File deleted successfully');
    },
    onError: (error: any) => {
      console.error('Delete error:', error);
      if (error.response?.status === 403) {
        toast.error('Authentication failed. Please login again.');
      } else if (error.response?.status === 404) {
        toast.error('File not found or already deleted');
        queryClient.invalidateQueries({ queryKey: ['files', roomId] });
      } else {
        toast.error('Failed to delete file: ' + (error.response?.data?.message || error.message));
      }
    },
  });

  // Convert API files to FileTreeItem format
  const convertToFileTree = (apiFiles: FileItem[]): FileTreeItem[] => {
    console.log('Converting API files to file tree:', apiFiles);
    return apiFiles.map(file => ({
      id: file.fileId,
      name: file.name,
      type: 'file',
      path: file.name,
      size: file.lines * 50, // Approximate size based on lines
      fileId: file.fileId,
      extension: file.ext,
      lastModified: new Date(),
      isCorrupted: file.isCorrupted || false,
    }));
  };

  const fileTree = convertToFileTree(files);

  // Handle file upload
  const handleFileUpload = useCallback((uploadFiles: File[]) => {
    uploadFiles.forEach(file => {
      uploadMutation.mutate({ file, roomId });
    });
  }, [uploadMutation, roomId]);

  // Handle file deletion
  const handleFileDelete = useCallback((fileId: string) => {
    console.log('Deleting file with ID:', fileId);
    deleteMutation.mutate(fileId);
  }, [deleteMutation]);

  // Handle ZIP upload
  const handleZipUpload = useCallback((extractedFiles: FileTreeItem[]) => {
    console.log('ZIP upload not implemented yet:', extractedFiles);
    toast.info('ZIP upload feature coming soon!');
  }, []);

  // Dropzone configuration
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: handleFileUpload,
    accept: {
      'text/*': ['.txt', '.js', '.ts', '.tsx', '.jsx', '.py', '.java', '.cpp', '.c', '.h', '.css', '.html', '.xml', '.json', '.md'],
      'application/json': ['.json'],
      'application/javascript': ['.js'],
      'text/javascript': ['.js'],
      'text/typescript': ['.ts'],
      'text/html': ['.html'],
      'text/css': ['.css'],
      'text/markdown': ['.md'],
    },
    multiple: true,
    maxSize: 5 * 1024 * 1024, // 5MB
    noClick: true, // Prevent clicking on the dropzone from opening file dialog
    noKeyboard: true, // Prevent keyboard activation
  });

  if (!isOpen) return null;

  return (
    <div className="h-full bg-discord-sidebar flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-discord-border">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Explorer
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 hover:bg-discord-sidebar-hover"
            onClick={() => queryClient.invalidateQueries({ queryKey: ['files', roomId] })}
            disabled={isLoading}
          >
            <RefreshCw className={`h-3 w-3 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 hover:bg-discord-sidebar-hover"
            onClick={() => document.getElementById('file-upload')?.click()}
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* File Upload Input */}
      <input
        id="file-upload"
        type="file"
        multiple
        accept=".txt,.js,.ts,.tsx,.jsx,.py,.java,.cpp,.c,.h,.css,.html,.xml,.json,.md"
        onChange={(e) => {
          const files = Array.from(e.target.files || []);
          handleFileUpload(files);
          e.target.value = '';
        }}
        className="hidden"
      />

      {/* Drag and Drop Area */}
      <div
        {...getRootProps()}
        className={`flex-1 relative overflow-hidden ${isDragActive ? 'bg-discord-primary/10 border-2 border-dashed border-discord-primary' : ''}`}
        onClick={(e) => {
          // Prevent dropzone click when clicking on file items
          e.stopPropagation();
        }}
      >
        <input {...getInputProps()} />
        
        {/* Drag Active Overlay */}
        {isDragActive && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-discord-primary/10 border-2 border-dashed border-discord-primary">
            <div className="text-center">
              <Upload className="w-8 h-8 mx-auto mb-2 text-discord-primary" />
              <p className="text-sm text-discord-primary">Drop files here to upload</p>
            </div>
          </div>
        )}

        {/* Upload Progress */}
        {uploadProgress.length > 0 && (
          <div className="p-3 border-b border-discord-border">
            {uploadProgress.map((progress, index) => (
              <div key={index} className="mb-2">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="truncate">{progress.fileName}</span>
                  <span>{progress.progress}%</span>
                </div>
                <Progress value={progress.progress} className="h-1" />
              </div>
            ))}
          </div>
        )}

        {/* File Tree */}
        <div className="h-full overflow-y-auto vscode-scrollbar">
          {isLoading ? (
            <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
              <RefreshCw className="w-4 h-4 animate-spin mr-2" />
              Loading files...
            </div>
          ) : fileTree.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
              <div className="text-center">
                <Archive className="w-8 h-8 mx-auto mb-2" />
                <p>No files yet</p>
                <p className="text-xs mt-1">Upload files to get started</p>
              </div>
            </div>
          ) : (
            <div 
              onClick={(e) => {
                // Allow file selection clicks to pass through
                e.stopPropagation();
              }}
            >
              <VSCodeFileExplorer
                files={fileTree}
                onFileSelect={onFileSelect}
                onFileUpload={handleFileUpload}
                onFileDelete={handleFileDelete}
                onZipUpload={handleZipUpload}
              />
            </div>
          )}
        </div>

        {/* VS Code-style scrollbar CSS */}
        <style dangerouslySetInnerHTML={{
          __html: `
            .vscode-scrollbar {
              scrollbar-width: thin;
              scrollbar-color: rgba(121, 121, 121, 0.4) transparent;
            }
            
            .vscode-scrollbar::-webkit-scrollbar {
              width: 10px;
            }
            
            .vscode-scrollbar::-webkit-scrollbar-track {
              background: transparent;
            }
            
            .vscode-scrollbar::-webkit-scrollbar-thumb {
              background-color: rgba(121, 121, 121, 0.4);
              border-radius: 0;
              border: 2px solid transparent;
              background-clip: content-box;
            }
            
            .vscode-scrollbar::-webkit-scrollbar-thumb:hover {
              background-color: rgba(121, 121, 121, 0.7);
            }
            
            .vscode-scrollbar::-webkit-scrollbar-thumb:active {
              background-color: rgba(121, 121, 121, 0.8);
            }
            
            .vscode-scrollbar::-webkit-scrollbar-corner {
              background: transparent;
            }
          `
        }} />
      </div>
    </div>
  );
};
