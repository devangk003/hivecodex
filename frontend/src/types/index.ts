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
}

export interface Participant {
  id: string;
  name: string;
  avatar?: string;
  profilePicId?: string;
  isOnline: boolean;
  status: 'online' | 'away' | 'offline';
  lastSeen?: Date;
}

export interface SelectedFile {
  id: string;
  name: string;
  content?: string;
  extension?: string;
  language?: string;
  fileId: string;
  path: string;
}

export interface FileTab {
  fileId: string;
  name: string;
  content: string;
  language: string;
  isModified: boolean;
  isActive: boolean;
  path: string;
}

export interface UserCursor {
  userId: string;
  userName: string;
  color: string;
  position: {
    lineNumber: number;
    column: number;
  };
}

export interface CollaborativeChange {
  fileId: string;
  changes: Array<{
    range: {
      startLineNumber: number;
      startColumn: number;
      endLineNumber: number;
      endColumn: number;
    };
    text: string;
  }>;
  versionId: number;
}

export interface APIError {
  response?: {
    data?: {
      message?: string;
    };
    status?: number;
  };
  message?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  profilePicId?: string;
}

export interface Room {
  id: string;
  name: string;
  description?: string;
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
}

// Re-export user status types
export type {
  GlobalUserStatus,
  RoomUserStatus,
  UserStatusData,
  RoomParticipant,
  StatusUpdatePayload,
} from './userStatus';
