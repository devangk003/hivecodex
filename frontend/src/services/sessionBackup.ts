export interface SessionData {
  sessionId: string;
  userId: string;
  roomId: string;
  timestamp: Date;
  fileStates: Map<string, FileState>;
  userPreferences: UserPreferences;
  collaborationState: CollaborationState;
}

export interface FileState {
  fileId: string;
  content: string;
  cursorPosition: { line: number; column: number };
  selection?: { start: { line: number; column: number }; end: { line: number; column: number } };
  scrollPosition: { top: number; left: number };
  lastModified: Date;
  isDirty: boolean;
  version: number;
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'auto';
  fontSize: number;
  tabSize: number;
  wordWrap: boolean;
  showLineNumbers: boolean;
  showMinimap: boolean;
  autoSave: boolean;
  autoSaveDelay: number;
}

export interface CollaborationState {
  activeUsers: string[];
  permissions: Map<string, string[]>;
  sharedCursors: Map<string, { line: number; column: number; fileId: string }>;
  chatHistory: ChatMessage[];
  presenceData: Map<string, Record<string, unknown>>;
}

export interface ChatMessage {
  id: string;
  userId: string;
  username: string;
  message: string;
  timestamp: Date;
  type: 'text' | 'system' | 'file-share';
}

export interface BackupConfig {
  autoBackupInterval: number;
  maxBackupHistory: number;
  compressionEnabled: boolean;
  encryptionEnabled: boolean;
  localStorageKey: string;
  remoteBackupEnabled: boolean;
}

export class SessionBackupManager {
  private config: BackupConfig;
  private currentSession: SessionData | null = null;
  private backupHistory: SessionData[] = [];
  private backupTimer: NodeJS.Timeout | null = null;
  private listeners: Map<string, ((...args: unknown[]) => void)[]> = new Map();
  private isBackupInProgress: boolean = false;

  constructor(config: Partial<BackupConfig> = {}) {
    this.config = {
      autoBackupInterval: 30000, // 30 seconds
      maxBackupHistory: 10,
      compressionEnabled: true,
      encryptionEnabled: false,
      localStorageKey: 'hivecodex_session_backup',
      remoteBackupEnabled: true,
      ...config
    };
  }

  // Initialize session backup
  initializeSession(sessionData: Partial<SessionData>): void {
    this.currentSession = {
      sessionId: sessionData.sessionId || this.generateSessionId(),
      userId: sessionData.userId || '',
      roomId: sessionData.roomId || '',
      timestamp: new Date(),
      fileStates: new Map(),
      userPreferences: sessionData.userPreferences || this.getDefaultPreferences(),
      collaborationState: sessionData.collaborationState || this.getDefaultCollaborationState(),
      ...sessionData
    };

    this.startAutoBackup();
    this.emit('session-initialized', this.currentSession);
  }

  // Generate unique session ID
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Get default user preferences
  private getDefaultPreferences(): UserPreferences {
    return {
      theme: 'dark',
      fontSize: 14,
      tabSize: 2,
      wordWrap: true,
      showLineNumbers: true,
      showMinimap: true,
      autoSave: true,
      autoSaveDelay: 1000
    };
  }

  // Get default collaboration state
  private getDefaultCollaborationState(): CollaborationState {
    return {
      activeUsers: [],
      permissions: new Map(),
      sharedCursors: new Map(),
      chatHistory: [],
      presenceData: new Map()
    };
  }

  // Update file state
  updateFileState(fileId: string, fileState: Partial<FileState>): void {
    if (!this.currentSession) return;

    const existingState = this.currentSession.fileStates.get(fileId);
    const updatedState: FileState = {
      fileId,
      content: '',
      cursorPosition: { line: 1, column: 1 },
      scrollPosition: { top: 0, left: 0 },
      lastModified: new Date(),
      isDirty: false,
      version: 1,
      ...existingState,
      ...fileState
    };

    this.currentSession.fileStates.set(fileId, updatedState);
    this.currentSession.timestamp = new Date();
    
    this.emit('file-state-updated', { fileId, fileState: updatedState });
  }

  // Update user preferences
  updateUserPreferences(preferences: Partial<UserPreferences>): void {
    if (!this.currentSession) return;

    this.currentSession.userPreferences = {
      ...this.currentSession.userPreferences,
      ...preferences
    };

    this.currentSession.timestamp = new Date();
    this.emit('preferences-updated', this.currentSession.userPreferences);
  }

  // Update collaboration state
  updateCollaborationState(state: Partial<CollaborationState>): void {
    if (!this.currentSession) return;

    this.currentSession.collaborationState = {
      ...this.currentSession.collaborationState,
      ...state
    };

    this.currentSession.timestamp = new Date();
    this.emit('collaboration-state-updated', this.currentSession.collaborationState);
  }

  // Start automatic backup
  private startAutoBackup(): void {
    if (this.backupTimer) {
      clearInterval(this.backupTimer);
    }

    this.backupTimer = setInterval(() => {
      this.createBackup();
    }, this.config.autoBackupInterval);
  }

  // Create backup manually
  async createBackup(): Promise<boolean> {
    if (!this.currentSession || this.isBackupInProgress) {
      return false;
    }

    this.isBackupInProgress = true;
    this.emit('backup-started');

    try {
      // Create backup copy
      const backup = this.serializeSession(this.currentSession);
      
      // Save to local storage
      await this.saveToLocalStorage(backup);
      
      // Save to remote if enabled
      if (this.config.remoteBackupEnabled) {
        await this.saveToRemote(backup);
      }

      // Add to backup history
      this.addToBackupHistory(this.currentSession);
      
      this.emit('backup-completed', backup);
      return true;

    } catch (error) {
      this.emit('backup-failed', error);
      return false;
    } finally {
      this.isBackupInProgress = false;
    }
  }

  // Serialize session data
  private serializeSession(session: SessionData): string {
    const serializable = {
      ...session,
      fileStates: Array.from(session.fileStates.entries()),
      collaborationState: {
        ...session.collaborationState,
        permissions: Array.from(session.collaborationState.permissions.entries()),
        sharedCursors: Array.from(session.collaborationState.sharedCursors.entries()),
        presenceData: Array.from(session.collaborationState.presenceData.entries())
      }
    };

    return JSON.stringify(serializable);
  }

  // Deserialize session data
  private deserializeSession(data: string): SessionData {
    const parsed = JSON.parse(data);
    
    return {
      ...parsed,
      timestamp: new Date(parsed.timestamp),
      fileStates: new Map(parsed.fileStates),
      collaborationState: {
        ...parsed.collaborationState,
        permissions: new Map(parsed.collaborationState.permissions),
        sharedCursors: new Map(parsed.collaborationState.sharedCursors),
        presenceData: new Map(parsed.collaborationState.presenceData)
      }
    };
  }

  // Save to local storage
  private async saveToLocalStorage(data: string): Promise<void> {
    try {
      const compressed = this.config.compressionEnabled ? this.compress(data) : data;
      localStorage.setItem(this.config.localStorageKey, compressed);
    } catch (error) {
      throw new Error(`Failed to save to local storage: ${error}`);
    }
  }

  // Save to remote backup
  private async saveToRemote(data: string): Promise<void> {
    try {
      // This would typically make an API call to save the backup
      // For now, we'll just simulate it
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // In a real implementation, you'd make an HTTP request here
      // const response = await fetch('/api/backup', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ data, sessionId: this.currentSession?.sessionId })
      // });
      
    } catch (error) {
      throw new Error(`Failed to save to remote: ${error}`);
    }
  }

  // Compress data (simple implementation)
  private compress(data: string): string {
    // In a real implementation, you'd use a proper compression library
    return btoa(data);
  }

  // Decompress data
  private decompress(data: string): string {
    try {
      return atob(data);
    } catch {
      return data; // Return as-is if not compressed
    }
  }

  // Add to backup history
  private addToBackupHistory(session: SessionData): void {
    this.backupHistory.unshift({ ...session });
    
    // Limit backup history size
    if (this.backupHistory.length > this.config.maxBackupHistory) {
      this.backupHistory = this.backupHistory.slice(0, this.config.maxBackupHistory);
    }
  }

  // Restore from backup
  async restoreFromBackup(backupIndex: number = 0): Promise<boolean> {
    try {
      let sessionToRestore: SessionData;

      if (backupIndex < this.backupHistory.length) {
        // Restore from backup history
        sessionToRestore = this.backupHistory[backupIndex];
      } else {
        // Restore from local storage
        const stored = await this.loadFromLocalStorage();
        if (!stored) {
          throw new Error('No backup found in local storage');
        }
        sessionToRestore = stored;
      }

      this.currentSession = sessionToRestore;
      this.emit('session-restored', sessionToRestore);
      return true;

    } catch (error) {
      this.emit('restore-failed', error);
      return false;
    }
  }

  // Load from local storage
  private async loadFromLocalStorage(): Promise<SessionData | null> {
    try {
      const stored = localStorage.getItem(this.config.localStorageKey);
      if (!stored) return null;

      const decompressed = this.config.compressionEnabled 
        ? this.decompress(stored) 
        : stored;

      return this.deserializeSession(decompressed);
    } catch (error) {
      console.error('Failed to load from local storage:', error);
      return null;
    }
  }

  // Get current session
  getCurrentSession(): SessionData | null {
    return this.currentSession;
  }

  // Get backup history
  getBackupHistory(): SessionData[] {
    return [...this.backupHistory];
  }

  // Get file state
  getFileState(fileId: string): FileState | undefined {
    return this.currentSession?.fileStates.get(fileId);
  }

  // Clear backup data
  clearBackups(): void {
    this.backupHistory = [];
    localStorage.removeItem(this.config.localStorageKey);
    this.emit('backups-cleared');
  }

  // Update configuration
  updateConfig(newConfig: Partial<BackupConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Restart auto backup with new interval
    if (this.backupTimer) {
      this.startAutoBackup();
    }
    
    this.emit('config-updated', this.config);
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
      eventListeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in backup event listener for ${event}:`, error);
        }
      });
    }
  }

  // Cleanup
  destroy(): void {
    if (this.backupTimer) {
      clearInterval(this.backupTimer);
      this.backupTimer = null;
    }
    
    this.listeners.clear();
    this.emit('manager-destroyed');
  }
}

// Export singleton instance
export const sessionBackupManager = new SessionBackupManager();