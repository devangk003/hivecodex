import React, { useState, useCallback } from 'react';
import { Upload, Download, Plus, RefreshCw, X } from 'lucide-react';
import { ZipUploadIcon } from './ui/ZipUploadIcon';
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
  parentId?: string | null;
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
  isOpen,
}) => {
  const [uploadProgress, setUploadProgress] = useState<UploadProgress[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const queryClient = useQueryClient();

  // Fetch files only when panel is open
  const {
    data: files = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['files', roomId],
    queryFn: () => fileAPI.getRoomFiles(roomId),
    enabled: roomId && isOpen,
    refetchOnWindowFocus: false,
    staleTime: 30000, // 30 seconds
  });

  // Manual refresh handler
  const handleRefresh = async () => {
    setIsRefreshing(true);
    const minSpinTime = 500; // ms
    const start = Date.now();
    try {
      await refetch();
    } finally {
      const elapsed = Date.now() - start;
      if (elapsed < minSpinTime) {
        setTimeout(() => setIsRefreshing(false), minSpinTime - elapsed);
      } else {
        setIsRefreshing(false);
      }
    }
  };

  // File upload mutation
  const uploadMutation = useMutation({
    mutationFn: ({ file, roomId }: { file: File; roomId: string }) =>
      fileAPI.uploadFile(roomId, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['files', roomId] });
      toast.success('File uploaded successfully');
    },
    onError: error => {
      console.error('Upload error:', error);
      toast.error('Failed to upload file');
    },
  });

  // File deletion mutation
  const deleteMutation = useMutation({
    mutationFn: (fileId: string) => fileAPI.deleteFile(roomId, fileId),
    onSuccess: () => {
      console.log('File/folder deleted successfully, invalidating queries');
      queryClient.invalidateQueries({ queryKey: ['files', roomId] });
      queryClient.refetchQueries({ queryKey: ['files', roomId] });
      toast.success('File or folder deleted successfully');
    },
    onError: (error: unknown) => {
      console.error('Delete error:', error);
      if (
        typeof error === 'object' &&
        error !== null &&
        'response' in error &&
        typeof (
          error as {
            response?: { status?: number; data?: { message?: string } };
          }
        ).response?.status === 'number'
      ) {
        const response = (
          error as { response: { status: number; data?: { message?: string } } }
        ).response;
        if (response.status === 403) {
          toast.error('Authentication failed. Please login again.');
        } else if (response.status === 404) {
          toast.error('File/folder not found or already deleted');
          queryClient.invalidateQueries({ queryKey: ['files', roomId] });
        } else {
          toast.error(
            'Failed to delete file/folder: ' +
              (response.data?.message || 'Unknown error')
          );
        }
      } else {
        toast.error('Failed to delete file/folder: Unknown error');
      }
    },
  });

  // Convert flat array to nested tree using parentId
  // Accepts an array of FileItem or backend file objects and builds a nested file tree.
  type BackendFile = FileItem & {
    _id?: string;
    parentId?: string;
    type?: string;
  };
  const buildFileTree = (flatFiles: BackendFile[]): FileTreeItem[] => {
    const idMap: Record<string, FileTreeItem> = {};
    const roots: FileTreeItem[] = [];
    flatFiles.forEach(file => {
      // Support both backend and frontend file shapes
      const id = (file._id ?? file.fileId)?.toString();
      const parentId = file.parentId ? file.parentId.toString() : null;
      if (!id) return;
      idMap[id] = {
        id,
        name: file.name,
        type: (file as { type?: string }).type === 'folder' ? 'folder' : 'file',
        path: file.name,
        size: file.lines ? file.lines * 50 : 0,
        fileId: file.fileId,
        extension: file.ext,
        lastModified: new Date(),
        isCorrupted: file.isCorrupted || false,
        children: [],
        parentId,
      };
    });
    // Build tree
    Object.values(idMap).forEach(item => {
      if (item.type === 'folder' && !item.children) item.children = [];
      if (item.parentId && idMap[item.parentId]) {
        idMap[item.parentId].children = idMap[item.parentId].children || [];
        idMap[item.parentId].children.push(item);
      } else {
        roots.push(item);
      }
    });
    // Only return root-level items
    return roots.filter(item => !item.parentId);
  };

  // Build the file tree from backend files
  const fileTree = buildFileTree(files);

  // Handle file/folder drop/upload (always supports folder structure)
  const handleDrop = useCallback(
    (acceptedFiles: File[]) => {
      // If any file has a webkitRelativePath or _relativePath with a slash, treat as folder upload
      if (
        acceptedFiles.some(
          f =>
            (typeof (f as File & { webkitRelativePath?: string })
              .webkitRelativePath === 'string' &&
              (
                f as File & { webkitRelativePath?: string }
              ).webkitRelativePath.includes('/')) ||
            (typeof (f as File & { _relativePath?: string })._relativePath ===
              'string' &&
              (f as File & { _relativePath?: string })._relativePath.includes(
                '/'
              ))
        )
      ) {
        fileAPI
          .uploadFolder(roomId, acceptedFiles)
          .then(() => {
            queryClient.invalidateQueries({ queryKey: ['files', roomId] });
            toast.success('Folder uploaded successfully');
          })
          .catch(error => {
            toast.error('Failed to upload folder');
            console.error('Folder upload error:', error);
          });
      } else {
        acceptedFiles.forEach(file => {
          uploadMutation.mutate({ file, roomId });
        });
      }
    },
    [roomId, uploadMutation, queryClient]
  );

  // Handle file deletion
  const handleFileDelete = useCallback(
    (fileId: string) => {
      console.log('Deleting file with ID:', fileId);
      deleteMutation.mutate(fileId);
    },
    [deleteMutation]
  );

  // Handle ZIP upload
  const handleZipUpload = useCallback((extractedFiles: FileTreeItem[]) => {
    console.log('ZIP upload not implemented yet:', extractedFiles);
    toast.info('ZIP upload feature coming soon!');
  }, []);

  // Dropzone configuration (supports folder upload)
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: handleDrop,
    noClick: true,
    noKeyboard: true,
    multiple: true,
  });

  // Track selected folder (null = root)
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);

  // Handle file/folder selection from explorer
  const handleFileSelectInternal = (item: FileTreeItem) => {
    if (item.type === 'folder') {
      setSelectedFolder(item.id);
    } else {
      setSelectedFolder(item.parentId || null);
      onFileSelect(item);
    }
  };

  if (!isOpen) return null;

  // Provide a refresh callback to child explorer for drag-and-drop move
  const handleExplorerRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['files', roomId] });
    queryClient.refetchQueries({ queryKey: ['files', roomId] });
  };

  return (
    <div className="h-full bg-discord-sidebar flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-discord-border">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Explorer
        </span>
        <div className="flex items-center gap-1">
          {/* ZIP upload button */}
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 hover:bg-discord-sidebar-hover"
            onClick={() => document.getElementById('file-upload-zip')?.click()}
            title="Upload ZIP"
          >
            <ZipUploadIcon className="h-4 w-4" />
          </Button>
          {/* ZIP upload input */}
          <input
            id="file-upload-zip"
            type="file"
            accept=".zip"
            onChange={async e => {
              if (e.target.files && e.target.files[0]) {
                const JSZip = (await import('jszip')).default;
                const zip = new JSZip();
                const file = e.target.files[0];
                const loaded = await zip.loadAsync(file);
                const files: File[] = [];
                const promises: Promise<void>[] = [];
                loaded.forEach((relativePath, zipEntry) => {
                  if (!zipEntry.dir) {
                    promises.push(
                      zipEntry.async('blob').then(blob => {
                        const f = new File([blob], relativePath);
                        // Use a custom property for relative path from zip
                        (f as File & { _relativePath?: string })._relativePath =
                          relativePath;
                        files.push(f);
                      })
                    );
                  }
                });
                await Promise.all(promises);
                handleDrop(files);
              }
              e.target.value = '';
            }}
            className="hidden"
          />
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 hover:bg-discord-sidebar-hover"
            onClick={handleRefresh}
            disabled={isLoading || isRefreshing}
          >
            <RefreshCw
              className={`h-3 w-3 ${isLoading || isRefreshing ? 'animate-spin' : ''}`}
            />
          </Button>
          {/* Unified file/folder upload button */}
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 hover:bg-discord-sidebar-hover"
            onClick={() =>
              document.getElementById('file-upload-unified')?.click()
            }
            title="Upload Files or Folder"
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Unified file/folder upload input */}
      <input
        id="file-upload-unified"
        type="file"
        multiple
        // Folder upload is supported in Chromium browsers via webkitdirectory, but TS does not recognize it. You may add it via ref if needed.
        onChange={e => {
          if (e.target.files) {
            handleDrop(Array.from(e.target.files));
          }
          e.target.value = '';
        }}
        className="hidden"
      />
      {/* Subheader for create file/folder */}
      <div className="flex items-center gap-2 px-3 py-1 border-b border-discord-border bg-discord-sidebar/80">
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2"
          onClick={() => {
            const name = prompt('Enter new file name:');
            if (!name) return;
            // Create file in selected folder (or root)
            fileAPI
              .createFile(roomId, name, selectedFolder)
              .then(() => {
                queryClient.invalidateQueries({ queryKey: ['files', roomId] });
                toast.success('File created');
              })
              .catch(() => toast.error('Failed to create file'));
          }}
        >
          Create File
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2"
          onClick={() => {
            const name = prompt('Enter new folder name:');
            if (!name) return;
            // Create folder in selected folder (or root)
            fileAPI
              .createFolder(roomId, name, selectedFolder)
              .then(() => {
                queryClient.invalidateQueries({ queryKey: ['files', roomId] });
                toast.success('Folder created');
              })
              .catch(() => toast.error('Failed to create folder'));
          }}
        >
          Create Folder
        </Button>
        {selectedFolder && (
          <span className="ml-2 text-xs text-muted-foreground">
            In: {fileTree.find(f => f.id === selectedFolder)?.name || '...'}
          </span>
        )}
      </div>

      {/* Drag and Drop Area */}
      <div
        {...getRootProps()}
        className={`flex-1 relative overflow-hidden ${isDragActive ? 'bg-discord-primary/10 border-2 border-dashed border-discord-primary' : ''}`}
        onClick={e => {
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
              <p className="text-sm text-discord-primary">
                Drop files here to upload
              </p>
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
                <ZipUploadIcon className="w-8 h-8 mx-auto mb-2" />
                <p>No files yet</p>
                <p className="text-xs mt-1">Upload files to get started</p>
              </div>
            </div>
          ) : (
            <div
              onClick={e => {
                // Allow file selection clicks to pass through
                e.stopPropagation();
              }}
            >
              <VSCodeFileExplorer
                files={fileTree}
                onFileSelect={handleFileSelectInternal}
                onFileUpload={handleDrop}
                onFileDelete={handleFileDelete}
                onZipUpload={handleZipUpload}
                selectedFolder={selectedFolder}
                onMove={handleExplorerRefresh}
              />
            </div>
          )}
        </div>

        {/* VS Code-style scrollbar CSS */}
        <style
          dangerouslySetInnerHTML={{
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
          `,
          }}
        />
      </div>
    </div>
  );
};
