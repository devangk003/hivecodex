export interface FileInfo {
  fileId?: string;
  name: string;
  ext?: string;
  lines?: number;
  read: boolean;
  type: "file" | "folder";
  parentId?: string | null;
  size?: number;
  lastModified?: Date;
  createdAt?: Date;
  content?: string;
  path?: string;
}

export interface DirectoryStructure {
  id: string;
  name: string;
  type: "file" | "folder";
  parentId?: string | null;
  children?: DirectoryStructure[];
  size?: number;
  lastModified?: Date;
  ext?: string;
  lines?: number;
  read?: boolean;
}

export interface FileOperation {
  type: "create" | "read" | "update" | "delete" | "rename" | "move";
  fileId?: string;
  fileName: string;
  filePath?: string;
  content?: string;
  newName?: string;
  newPath?: string;
  userId: string;
  roomId: string;
  timestamp: Date;
}

export interface FileConflict {
  id: string;
  fileName: string;
  filePath: string;
  conflictType: 'content' | 'rename' | 'delete' | 'permission';
  severity: 'low' | 'medium' | 'high' | 'critical';
  currentVersion: {
    content: string;
    lastModified: Date;
    modifiedBy: string;
  };
  incomingVersion: {
    content: string;
    lastModified: Date;
    modifiedBy: string;
  };
  autoResolvable: boolean;
  suggestedResolution?: ConflictResolution;
  type?: string;
  path?: string;
  conflictId?: string;
  users?: Array<{
    id: string;
    username: string;
    timestamp: number;
    operation?: string;
  }>;
}

export type ConflictResolution = 
  | 'accept-current' 
  | 'accept-incoming' 
  | 'merge' 
  | 'manual' 
  | 'auto' 
  | 'last_write_wins' 
  | 'first_write_wins' 
  | 'rename_both';

export interface FileTreeNode {
  id: string;
  name: string;
  type: 'file' | 'folder';
  path: string;
  parentId?: string;
  children?: FileTreeNode[];
  isExpanded?: boolean;
  isLoading?: boolean;
  hasConflict?: boolean;
  operationStatus?: 'syncing' | 'synced' | 'error' | 'conflict';
  isDirectory?: boolean;
  size?: number;
  lastModified?: Date;
  metadata?: {
    size?: number;
    lastModified?: Date;
    permissions?: string[];
    createdBy?: string;
  };
}

export interface FileSyncStatus {
  fileId: string;
  status: 'synced' | 'syncing' | 'conflict' | 'error' | 'offline';
  lastSync?: Date;
  conflictId?: string;
  error?: string;
}

export interface FilePermission {
  userId: string;
  permission: 'read' | 'write' | 'admin';
  grantedBy: string;
  grantedAt: Date;
}