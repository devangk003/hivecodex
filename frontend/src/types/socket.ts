import { FileOperation, FileConflict, DirectoryStructure, FileSyncStatus } from './filesystem';

export interface SocketEvents {
  // File synchronization events
  'file:operation': (operation: FileOperation) => void;
  'file:conflict': (conflict: FileConflict) => void;
  'file:sync-status': (status: FileSyncStatus) => void;
  'file:tree-update': (tree: DirectoryStructure[]) => void;
  
  // User presence events
  'user:presence-update': (presence: UserPresence) => void;
  'user:cursor-update': (cursor: CursorPosition) => void;
  'user:selection-update': (selection: TextSelection) => void;
  
  // Room events
  'room:joined': (roomData: RoomJoinData) => void;
  'room:left': (roomData: RoomLeaveData) => void;
  'room:user-list': (users: RoomUser[]) => void;
  
  // Connection events
  'connect': () => void;
  'disconnect': (reason: string) => void;
  'reconnect': (attemptNumber: number) => void;
  'error': (error: SocketError) => void;
}

export interface UserPresence {
  userId: string;
  username: string;
  isOnline: boolean;
  currentFile?: string;
  lastSeen: Date;
  activeRoom?: string;
  status: 'online' | 'away' | 'busy' | 'offline';
}

export interface CursorPosition {
  userId: string;
  fileId: string;
  line: number;
  column: number;
  timestamp: Date;
}

export interface TextSelection {
  userId: string;
  fileId: string;
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
  timestamp: Date;
}

export interface RoomJoinData {
  roomId: string;
  userId: string;
  username: string;
  joinedAt: Date;
}

export interface RoomLeaveData {
  roomId: string;
  userId: string;
  leftAt: Date;
}

export interface RoomUser {
  userId: string;
  username: string;
  isOnline: boolean;
  joinedAt: Date;
  role: 'owner' | 'admin' | 'member' | 'guest';
}

export interface SocketError {
  type: 'connection' | 'authentication' | 'permission' | 'file-operation' | 'sync';
  message: string;
  code?: string;
  details?: Record<string, unknown>;
}

export interface SocketConnectionOptions {
  autoReconnect: boolean;
  reconnectAttempts: number;
  reconnectDelay: number;
  timeout: number;
}

export interface EnhancedSocketEvents extends SocketEvents {
  // Enhanced events for advanced features
  'file:batch-operation': (operations: FileOperation[]) => void;
  'file:operation-progress': (progress: OperationProgress) => void;
  'room:collaboration-invite': (invite: CollaborationInvite) => void;
  'system:notification': (notification: SystemNotification) => void;
}

export interface OperationProgress {
  operationId: string;
  type: 'upload' | 'download' | 'sync' | 'batch';
  progress: number; // 0-100
  status: 'pending' | 'in-progress' | 'completed' | 'failed' | 'paused';
  currentStep?: string;
  totalSteps?: number;
}

export interface CollaborationInvite {
  inviteId: string;
  fromUserId: string;
  fromUsername: string;
  roomId: string;
  roomName: string;
  permissions: string[];
  expiresAt: Date;
}

export interface SystemNotification {
  id: string;
  type: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
  timestamp: Date;
  actionable?: boolean;
  action?: {
    label: string;
    handler: string;
  };
}