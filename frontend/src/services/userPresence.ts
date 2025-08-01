import { Socket } from 'socket.io-client';
import { 
  UserPresence, 
  CursorPosition, 
  TextSelection, 
  RoomUser 
} from '../types/socket';

export interface PresenceConfig {
  updateInterval: number;
  idleTimeout: number;
  trackCursor: boolean;
  trackSelection: boolean;
}

export class UserPresenceService {
  private socket: Socket | null = null;
  private config: PresenceConfig;
  private currentPresence: UserPresence | null = null;
  private onlineUsers: Map<string, UserPresence> = new Map();
  private userCursors: Map<string, CursorPosition> = new Map();
  private userSelections: Map<string, TextSelection> = new Map();
  private listeners: Map<string, ((...args: unknown[]) => void)[]> = new Map();
  private presenceUpdateInterval: NodeJS.Timeout | null = null;
  private lastActivity: Date = new Date();

  constructor(config: Partial<PresenceConfig> = {}) {
    this.config = {
      updateInterval: 5000, // 5 seconds
      idleTimeout: 300000, // 5 minutes
      trackCursor: true,
      trackSelection: true,
      ...config
    };
  }

  // Initialize service with socket connection
  initialize(socket: Socket, userId: string, username: string): void {
    this.socket = socket;
    this.setupSocketListeners();
    this.initializePresence(userId, username);
    this.startPresenceUpdates();
    this.setupActivityTracking();
  }

  // Setup socket event listeners
  private setupSocketListeners(): void {
    if (!this.socket) return;

    this.socket.on('user:presence-update', (presence: UserPresence) => {
      this.handlePresenceUpdate(presence);
    });

    this.socket.on('user:cursor-update', (cursor: CursorPosition) => {
      this.handleCursorUpdate(cursor);
    });

    this.socket.on('user:selection-update', (selection: TextSelection) => {
      this.handleSelectionUpdate(selection);
    });

    this.socket.on('room:user-list', (users: RoomUser[]) => {
      this.handleUserListUpdate(users);
    });

    this.socket.on('disconnect', () => {
      this.handleDisconnect();
    });
  }

  // Initialize current user presence
  private initializePresence(userId: string, username: string): void {
    this.currentPresence = {
      userId,
      username,
      isOnline: true,
      lastSeen: new Date(),
      status: 'online'
    };

    this.updatePresence(this.currentPresence);
  }

  // Start periodic presence updates
  private startPresenceUpdates(): void {
    this.presenceUpdateInterval = setInterval(() => {
      this.checkIdleStatus();
      if (this.currentPresence) {
        this.updatePresence(this.currentPresence);
      }
    }, this.config.updateInterval);
  }

  // Setup activity tracking
  private setupActivityTracking(): void {
    // Track mouse movement, keyboard activity, etc.
    const updateActivity = () => {
      this.lastActivity = new Date();
      if (this.currentPresence && this.currentPresence.status === 'away') {
        this.setStatus('online');
      }
    };

    // Add event listeners for activity tracking
    document.addEventListener('mousemove', updateActivity);
    document.addEventListener('keypress', updateActivity);
    document.addEventListener('click', updateActivity);
    document.addEventListener('scroll', updateActivity);
  }

  // Check if user is idle
  private checkIdleStatus(): void {
    if (!this.currentPresence) return;

    const now = new Date();
    const timeSinceActivity = now.getTime() - this.lastActivity.getTime();

    if (timeSinceActivity > this.config.idleTimeout && this.currentPresence.status === 'online') {
      this.setStatus('away');
    }
  }

  // Update current user presence
  updatePresence(presence: Partial<UserPresence>): void {
    if (!this.socket || !this.currentPresence) return;

    this.currentPresence = {
      ...this.currentPresence,
      ...presence,
      lastSeen: new Date()
    };

    this.socket.emit('user:presence-update', this.currentPresence);
    this.emit('presence-updated', this.currentPresence);
  }

  // Set user status
  setStatus(status: UserPresence['status']): void {
    if (!this.currentPresence) return;

    this.updatePresence({ status });
  }

  // Set current file being viewed
  setCurrentFile(fileId: string): void {
    if (!this.currentPresence) return;

    this.updatePresence({ currentFile: fileId });
  }

  // Update cursor position
  updateCursorPosition(fileId: string, line: number, column: number): void {
    if (!this.socket || !this.currentPresence || !this.config.trackCursor) return;

    const cursor: CursorPosition = {
      userId: this.currentPresence.userId,
      fileId,
      line,
      column,
      timestamp: new Date()
    };

    this.socket.emit('user:cursor-update', cursor);
  }

  // Update text selection
  updateTextSelection(
    fileId: string, 
    startLine: number, 
    startColumn: number, 
    endLine: number, 
    endColumn: number
  ): void {
    if (!this.socket || !this.currentPresence || !this.config.trackSelection) return;

    const selection: TextSelection = {
      userId: this.currentPresence.userId,
      fileId,
      startLine,
      startColumn,
      endLine,
      endColumn,
      timestamp: new Date()
    };

    this.socket.emit('user:selection-update', selection);
  }

  // Handle incoming presence updates
  private handlePresenceUpdate(presence: UserPresence): void {
    this.onlineUsers.set(presence.userId, presence);
    this.emit('user-presence-changed', presence);
  }

  // Handle cursor updates from other users
  private handleCursorUpdate(cursor: CursorPosition): void {
    this.userCursors.set(cursor.userId, cursor);
    this.emit('user-cursor-moved', cursor);
  }

  // Handle selection updates from other users
  private handleSelectionUpdate(selection: TextSelection): void {
    this.userSelections.set(selection.userId, selection);
    this.emit('user-selection-changed', selection);
  }

  // Handle user list updates
  private handleUserListUpdate(users: RoomUser[]): void {
    // Update online users based on room user list
    const userPresences = users.map(user => ({
      userId: user.userId,
      username: user.username,
      isOnline: user.isOnline,
      lastSeen: new Date(),
      status: user.isOnline ? 'online' as const : 'offline' as const
    }));

    userPresences.forEach(presence => {
      this.onlineUsers.set(presence.userId, presence);
    });

    this.emit('user-list-updated', users);
  }

  // Handle disconnect
  private handleDisconnect(): void {
    if (this.currentPresence) {
      this.currentPresence.isOnline = false;
      this.currentPresence.status = 'offline';
    }
    this.emit('disconnected');
  }

  // Get current user presence
  getCurrentPresence(): UserPresence | null {
    return this.currentPresence;
  }

  // Get all online users
  getOnlineUsers(): UserPresence[] {
    return Array.from(this.onlineUsers.values()).filter(user => user.isOnline);
  }

  // Get specific user presence
  getUserPresence(userId: string): UserPresence | undefined {
    return this.onlineUsers.get(userId);
  }

  // Get user cursor position
  getUserCursor(userId: string): CursorPosition | undefined {
    return this.userCursors.get(userId);
  }

  // Get user text selection
  getUserSelection(userId: string): TextSelection | undefined {
    return this.userSelections.get(userId);
  }

  // Get cursors for specific file
  getFileCursors(fileId: string): CursorPosition[] {
    return Array.from(this.userCursors.values()).filter(cursor => cursor.fileId === fileId);
  }

  // Get selections for specific file
  getFileSelections(fileId: string): TextSelection[] {
    return Array.from(this.userSelections.values()).filter(selection => selection.fileId === fileId);
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
    if (this.presenceUpdateInterval) {
      clearInterval(this.presenceUpdateInterval);
    }

    this.onlineUsers.clear();
    this.userCursors.clear();
    this.userSelections.clear();
    this.listeners.clear();

    if (this.socket) {
      this.socket.off('user:presence-update');
      this.socket.off('user:cursor-update');
      this.socket.off('user:selection-update');
      this.socket.off('room:user-list');
      this.socket.off('disconnect');
    }

    // Remove activity listeners
    document.removeEventListener('mousemove', () => {});
    document.removeEventListener('keypress', () => {});
    document.removeEventListener('click', () => {});
    document.removeEventListener('scroll', () => {});
  }
}

// Export singleton instance
export const userPresenceService = new UserPresenceService();