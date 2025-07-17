import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  File, 
  Search,
  GitBranch,
  Package,
  Settings,
  User,
  Terminal,
  RefreshCw,
  X,
  Bell,
  Shield,
  Activity,
  Code,
  Archive,
  Plus,
  Upload,
  Download,
  Trash2,
  Folder,
  FolderOpen,
  FileText,
  ChevronDown,
  ChevronRight,
  Mic,
  MicOff,
  Headphones,
  Check,
  LogOut,
  UserCheck,
  Crown,
  Copy
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import socketService from '@/lib/socket';
import { fileAPI, FileItem } from '@/lib/api';
import { VSCodeFileExplorer } from './VSCodeFileExplorer';
import { useAuth } from '@/contexts/AuthContext';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDropzone } from 'react-dropzone';
import { Progress } from '@/components/ui/progress';

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

interface ActivityBarItem {
  id: string;
  icon: React.ReactNode;
  label: string;
  isActive?: boolean;
}

const activityBarItems: ActivityBarItem[] = [
  { id: 'files', icon: <File className="w-5 h-5" />, label: 'Explorer' },
  { id: 'search', icon: <Search className="w-5 h-5" />, label: 'Search' },
  { id: 'git', icon: <GitBranch className="w-5 h-5" />, label: 'Source Control' },
  { id: 'extensions', icon: <Package className="w-5 h-5" />, label: 'Extensions' },
];

interface FileSidebarProps {
  onFileSelect: (file: FileTreeItem) => void;
  roomId: string;
  isVoiceConnected: boolean;
  onVoiceToggle: () => void;
  isMuted: boolean;
  onMuteToggle: () => void;
  isDeafened: boolean;
  onDeafenToggle: () => void;
  activeView?: string;
  onViewChange?: (view: string) => void;
  isPanelOpen?: boolean;
  onPanelToggle?: () => void;
}

export const FileSidebar: React.FC<FileSidebarProps> = ({
  onFileSelect,
  roomId,
  isVoiceConnected,
  onVoiceToggle,
  isMuted,
  onMuteToggle,
  isDeafened,
  onDeafenToggle,
  activeView = 'files',
  onViewChange,
  isPanelOpen = true,
  onPanelToggle,
}) => {
  const [localActiveView, setLocalActiveView] = useState(activeView);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress[]>([]);
  const [isMultiSelect, setIsMultiSelect] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const queryClient = useQueryClient();
  
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  
  // Sync local active view with prop
  useEffect(() => {
    setLocalActiveView(activeView);
  }, [activeView]);
  
  // Handle logout
  const handleLogout = useCallback(() => {
    logout();
    navigate('/login');
  }, [logout, navigate]);
  
  // Handle copy room ID
  const handleCopyRoomId = useCallback(() => {
    if (roomId) {
      navigator.clipboard.writeText(roomId);
      toast.success('Room ID copied to clipboard');
    }
  }, [roomId]);
  
  // Handle view change
  const handleViewChange = (viewId: string) => {
    console.log('handleViewChange called:', { viewId, localActiveView, isPanelOpen });
    
    if (localActiveView === viewId) {
      // If clicking the same view, toggle panel open/closed
      console.log('Same view clicked, toggling panel');
      onPanelToggle?.();
    } else {
      // If clicking different view, switch to it and ensure panel is open
      console.log('Different view clicked, switching and opening panel');
      setLocalActiveView(viewId);
      onViewChange?.(viewId);
      if (!isPanelOpen) {
        console.log('Panel was closed, opening it');
        onPanelToggle?.();
      }
    }
  };

  // Fetch files - only when on files tab
  const { data: files = [], isLoading } = useQuery({
    queryKey: ['files', roomId],
    queryFn: () => {
      console.log('Fetching files for room:', roomId);
      return fileAPI.getRoomFiles(roomId);
    },
    enabled: !!roomId && localActiveView === 'files' && isPanelOpen,
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
      // Invalidate and refetch immediately
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
        // Still refresh the list to remove it from UI
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

  // Handle file selection
  const handleFileSelect = useCallback((file: FileTreeItem) => {
    onFileSelect(file);
  }, [onFileSelect]);

  // Handle file deletion
  const handleFileDelete = useCallback((fileId: string) => {
    console.log('Deleting file with ID:', fileId);
    deleteMutation.mutate(fileId);
  }, [deleteMutation]);

  // Handle ZIP upload (batch operation)
  const handleZipUpload = useCallback((extractedFiles: FileTreeItem[]) => {
    // Convert extracted files to native File objects and upload
    extractedFiles.forEach(file => {
      if (file.content) {
        const blob = new Blob([file.content], { type: 'text/plain' });
        const uploadFile = new window.File([blob], file.name, { type: 'text/plain' });
        uploadMutation.mutate({ file: uploadFile, roomId });
      }
    });
  }, [uploadMutation, roomId]);

  // Activity bar render
  const renderActivityBar = () => (
    <div className="w-12 bg-discord-sidebar border-r border-discord-border flex flex-col flex-shrink-0">
      <div className="flex-1 py-2">
        {activityBarItems.map((item) => (
          <TooltipProvider key={item.id}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={`w-full h-12 mb-1 rounded-none ${
                    localActiveView === item.id && isPanelOpen ? 'bg-discord-primary/20 text-discord-primary' : 'text-muted-foreground'
                  }`}
                  onClick={() => handleViewChange(item.id)}
                >
                  {item.icon}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                {item.label}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ))}
      </div>
      
      <div className="border-t border-discord-border p-2">
        <div className="flex flex-col items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="w-8 h-8 p-0 rounded-full hover:bg-discord-primary/20"
              >
                <User className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="right" align="end" className="w-56">
              <DropdownMenuLabel className="flex items-center gap-2">
                <User className="w-4 h-4" />
                {user?.name || 'Guest'}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleCopyRoomId} className="flex items-center gap-2">
                <Copy className="w-4 h-4" />
                Copy Room ID
              </DropdownMenuItem>
              <DropdownMenuItem className="flex items-center gap-2">
                <Crown className="w-4 h-4" />
                Room Settings
              </DropdownMenuItem>
              <DropdownMenuItem className="flex items-center gap-2">
                <UserCheck className="w-4 h-4" />
                Manage Participants
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="flex items-center gap-2">
                <Settings className="w-4 h-4" />
                Preferences
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={handleLogout}
                className="flex items-center gap-2 text-red-600 focus:text-red-600"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-8 h-8 p-0"
                >
                  <Settings className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                Settings
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </div>
  );

  // Main content based on active view
  const renderMainContent = () => {
    if (!isPanelOpen) return null;
    
    switch (localActiveView) {
      case 'files':
        return (
          <div className="h-full bg-discord-secondary min-w-0 overflow-hidden">
            <VSCodeFileExplorer
              files={fileTree}
              onFileSelect={handleFileSelect}
              onFileUpload={handleFileUpload}
              onFileDelete={handleFileDelete}
              onZipUpload={handleZipUpload}
            />
          </div>
        );      case 'search':
        return (
          <div className="h-full bg-discord-secondary p-4">
            <div className="text-center text-muted-foreground">
              <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Search functionality</p>
              <p className="text-xs mt-1">Coming soon...</p>
            </div>
          </div>
        );
      
      case 'git':
        return (
          <div className="h-full bg-discord-secondary p-4">
            <div className="text-center text-muted-foreground">
              <GitBranch className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Source Control</p>
              <p className="text-xs mt-1">Coming soon...</p>
            </div>
          </div>
        );
      
      case 'extensions':
        return (
          <div className="h-full bg-discord-secondary p-4">
            <div className="text-center text-muted-foreground">
              <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Extensions</p>
              <p className="text-xs mt-1">Coming soon...</p>
            </div>
          </div>
        );
      
      default:
        return (
          <div className="h-full bg-discord-secondary p-4">
            <div className="text-center text-muted-foreground">
              <File className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Select a view</p>
            </div>
          </div>
        );
    }
  };

  // Voice channel section (Discord-style)
  const renderVoiceChannel = () => (
    <div className="p-2 border-t border-border bg-discord-sidebar flex-shrink-0">
      <div className="flex items-center gap-2 p-2 rounded hover:bg-discord-sidebar-hover transition-colors">
        <div className="flex items-center gap-2 flex-1">
          <div className="w-8 h-8 rounded-full bg-discord-primary flex items-center justify-center">
            <span className="text-sm font-medium text-white">
              {user?.name?.charAt(0).toUpperCase() || 'U'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-foreground truncate">
              {user?.name || 'Unknown User'}
            </div>
            <div className="text-xs text-muted-foreground">
              #{user?.id?.slice(-4) || '0000'}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-1">
          <button 
            className={`p-1 rounded hover:bg-discord-sidebar-hover transition-colors ${
              isMuted ? 'bg-red-500' : ''
            }`}
            onClick={onMuteToggle}
          >
            {isMuted ? (
              <MicOff className="w-4 h-4 text-white" />
            ) : (
              <Mic className="w-4 h-4 text-muted-foreground" />
            )}
          </button>
          
          <button 
            className={`p-1 rounded hover:bg-discord-sidebar-hover transition-colors ${
              isDeafened ? 'bg-red-500' : ''
            }`}
            onClick={onDeafenToggle}
          >
            <div className="relative">
              <Headphones className={`w-4 h-4 ${isDeafened ? 'text-white' : 'text-muted-foreground'}`} />
              {isDeafened && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-5 h-0.5 bg-white transform rotate-45"></div>
                </div>
              )}
            </div>
          </button>
          
          <button className="p-1 rounded hover:bg-discord-sidebar-hover transition-colors">
            <Settings className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-full min-w-0 max-w-full">
      {/* Activity Bar - Always visible */}
      <div className="flex-shrink-0">
        {renderActivityBar()}
      </div>
      
      {/* Main Panel Content - Only visible when panel is open */}
      {isPanelOpen && (
        <div className="flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden">
          <div className="flex-1 min-h-0 min-w-0 overflow-hidden">
            {renderMainContent()}
          </div>
          {/* Voice section only shows for files view */}
          {localActiveView === 'files' && renderVoiceChannel()}
        </div>
      )}
    </div>
  );
};