import { io, Socket } from 'socket.io-client';
import { 
  FileOperation, 
  FileConflict, 
  DirectoryStructure, 
  FileSyncStatus, 
  FileTreeNode,
  ConflictResolution 
} from '../types/filesystem';
import { SocketEvents } from '../types/socket';

export interface FileSyncConfig {
  autoSync: boolean;
  conflictResolution: 'auto' | 'manual';
  syncInterval: number;
  maxRetries: number;
}

export class FileSynchronizationService {
  private socket: Socket | null = null;
  private config: FileSyncConfig;
  private syncQueue: FileOperation[] = [];
  private conflictQueue: FileConflict[] = [];
  private syncStatus: Map<string, FileSyncStatus> = new Map();
  private listeners: Map<string, ((...args: unknown[]) => void)[]> = new Map();

  constructor(config: Partial<FileSyncConfig> = {}) {
    this.config = {
      autoSync: true,
      conflictResolution: 'manual',
      syncInterval: 1000,
      maxRetries: 3,
      ...config
    };
  }

  // Initialize service with socket connection
  initialize(socket: Socket): void {
    this.socket = socket;
    this.setupSocketListeners();
  }

  // Setup socket event listeners
  private setupSocketListeners(): void {
    if (!this.socket) return;

    this.socket.on('file:operation', (operation: FileOperation) => {
      this.handleFileOperation(operation);
    });

    this.socket.on('file:conflict', (conflict: FileConflict) => {
      this.handleFileConflict(conflict);
    });

    this.socket.on('file:sync-status', (status: FileSyncStatus) => {
      this.updateSyncStatus(status);
    });

    this.socket.on('file:tree-update', (tree: DirectoryStructure[]) => {
      this.emit('tree-updated', tree);
    });
  }

  // Queue file operation for synchronization
  queueOperation(operation: FileOperation): void {
    this.syncQueue.push(operation);
    this.updateSyncStatus({
      fileId: operation.fileId || operation.fileName,
      status: 'syncing',
      lastSync: new Date()
    });

    if (this.config.autoSync) {
      this.processQueue();
    }
  }

  // Process queued operations
  private async processQueue(): Promise<void> {
    while (this.syncQueue.length > 0) {
      const operation = this.syncQueue.shift();
      if (operation) {
        await this.executeOperation(operation);
      }
    }
  }

  // Execute single file operation
  private async executeOperation(operation: FileOperation): Promise<void> {
    if (!this.socket) {
      throw new Error('Socket not initialized');
    }

    try {
      this.socket.emit('file:operation', operation);
      
      this.updateSyncStatus({
        fileId: operation.fileId || operation.fileName,
        status: 'synced',
        lastSync: new Date()
      });

      this.emit('operation-completed', operation);
    } catch (error) {
      this.updateSyncStatus({
        fileId: operation.fileId || operation.fileName,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      this.emit('operation-failed', { operation, error });
    }
  }

  // Handle incoming file operations
  private handleFileOperation(operation: FileOperation): void {
    this.emit('file-operation', operation);
    
    // Update sync status
    this.updateSyncStatus({
      fileId: operation.fileId || operation.fileName,
      status: 'synced',
      lastSync: new Date()
    });
  }

  // Handle file conflicts
  private handleFileConflict(conflict: FileConflict): void {
    this.conflictQueue.push(conflict);
    
    this.updateSyncStatus({
      fileId: conflict.fileName,
      status: 'conflict',
      conflictId: conflict.id
    });

    if (this.config.conflictResolution === 'auto' && conflict.autoResolvable) {
      this.autoResolveConflict(conflict);
    } else {
      this.emit('conflict-detected', conflict);
    }
  }

  // Auto-resolve conflicts when possible
  private autoResolveConflict(conflict: FileConflict): void {
    if (!conflict.suggestedResolution) return;

    const resolution = {
      conflictId: conflict.id,
      resolution: conflict.suggestedResolution,
      timestamp: new Date()
    };

    this.resolveConflict(resolution);
  }

  // Manually resolve conflict
  resolveConflict(resolution: {
    conflictId: string;
    resolution: ConflictResolution;
    mergedContent?: string;
    timestamp: Date;
  }): void {
    if (!this.socket) return;

    this.socket.emit('file:resolve-conflict', resolution);
    
    // Remove from conflict queue
    const conflictIndex = this.conflictQueue.findIndex(c => c.id === resolution.conflictId);
    if (conflictIndex > -1) {
      this.conflictQueue.splice(conflictIndex, 1);
    }

    this.emit('conflict-resolved', resolution);
  }

  // Get current sync status for a file
  getSyncStatus(fileId: string): FileSyncStatus | undefined {
    return this.syncStatus.get(fileId);
  }

  // Update sync status
  private updateSyncStatus(status: FileSyncStatus): void {
    this.syncStatus.set(status.fileId, status);
    this.emit('sync-status-updated', status);
  }

  // Get all pending conflicts
  getPendingConflicts(): FileConflict[] {
    return [...this.conflictQueue];
  }

  // Get conflicts (alias for backward compatibility)
  getConflicts(): FileConflict[] {
    return this.getPendingConflicts();
  }

  // Get current sync queue
  getSyncQueue(): FileOperation[] {
    return [...this.syncQueue];
  }

  // Force sync for specific file
  forceSyncFile(fileId: string): void {
    if (!this.socket) return;

    this.socket.emit('file:force-sync', { fileId, timestamp: new Date() });
    
    this.updateSyncStatus({
      fileId,
      status: 'syncing',
      lastSync: new Date()
    });
  }

  // Request file tree refresh
  refreshFileTree(): void {
    if (!this.socket) return;
    this.socket.emit('file:request-tree-update');
  }

  // Get file tree (placeholder - would typically come from server)
  getFileTree(): FileTreeNode[] {
    // This would typically be populated from server data
    return [];
  }

  // Request file tree sync (alias for refreshFileTree)
  requestFileTreeSync(): void {
    this.refreshFileTree();
  }

  // Event listener management
  on(event: string, callback: (...args: unknown[]) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  off(event: string, callback: (...args: unknown[]) => void): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      const index = eventListeners.indexOf(callback);
      if (index > -1) {
        eventListeners.splice(index, 1);
      }
    }
  }

  private emit(event: string, data?: unknown): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach(callback => callback(data));
    }
  }

  // Cleanup
  destroy(): void {
    this.syncQueue = [];
    this.conflictQueue = [];
    this.syncStatus.clear();
    this.listeners.clear();
    
    if (this.socket) {
      this.socket.off('file:operation');
      this.socket.off('file:conflict');
      this.socket.off('file:sync-status');
      this.socket.off('file:tree-update');
    }
  }
}

// Export singleton instance
export const fileSyncService = new FileSynchronizationService();