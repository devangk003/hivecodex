export type SocketId = string;

export interface JoinRoomPayload {
  roomId: string;
  userId: string;
  userName: string;
}

export interface MessagePayload {
  message: string;
  userName: string;
  userId: string;
  roomId: string;
  timestamp: string;
  id?: string;
}

export interface FileOperationPayload {
  fileName: string;
  fileContent?: string;
  filePath?: string;
  roomId: string;
  userId: string;
}

export interface CollaborativeChangePayload {
  operation: string;
  content: string;
  position: number;
  length: number;
  fileName: string;
  userId: string;
}

export interface CursorUpdatePayload {
  cursorPosition: number;
  fileName: string;
  userId: string;
  userName: string;
}

export interface TypingPayload {
  userId: string;
  userName: string;
  roomId?: string;
}

export interface StatusChangePayload {
  online: boolean;
  userId?: string;
  userName?: string;
  timestamp?: string;
}

export interface DrawingPayload {
  drawingData: any;
  roomId: string;
  userId: string;
  timestamp?: string;
}

export interface UserJoinedPayload {
  userId: string;
  userName: string;
  timestamp: string;
}

export interface ErrorPayload {
  message: string;
  code?: string;
  details?: any;
}

export interface SocketData {
  roomId?: string;
  userId?: string;
  userName?: string;
  isAuthenticated?: boolean;
  joinedAt?: Date;
}

// Server-to-client events (what server sends to client)
export interface ServerToClientEvents {
  "userJoined": (data: UserJoinedPayload) => void;
  "userDisconnected": (data: UserJoinedPayload) => void;
  "roomParticipants": (users: any[]) => void;
  "message": (data: MessagePayload) => void;
  "collaborative-change": (data: CollaborativeChangePayload) => void;
  "cursor-update": (data: CursorUpdatePayload) => void;
  "typing-start": (data: TypingPayload) => void;
  "typing-stop": (data: TypingPayload) => void;
  "typing-update": (data: TypingPayload & { isTyping: boolean }) => void;
  "newFile": (data: FileOperationPayload) => void;
  "fileRead": (data: FileOperationPayload) => void;
  "fileDelete": (data: FileOperationPayload) => void;
  "file-sync": (data: any) => void;
  "request-file-sync": (data: any) => void;
  "statusChange": (data: StatusChangePayload) => void;
  "user-activity-status-update": (data: {
    userId: string;
    userName: string;
    activityStatus: string;
    timestamp: string;
  }) => void;
  "user-status-refresh": (data: {
    userId: string;
    userName: string;
    activityStatus: string;
    timestamp: string;
    roomId?: string;
  }) => void;
  "drawing-update": (data: DrawingPayload) => void;
  "request-drawing": (data: any) => void;
  "sync-drawing": (data: DrawingPayload) => void;
  "sync-file-structure": (data: any) => void;
  "directory-created": (data: any) => void;
  "directory-updated": (data: any) => void;
  "directory-deleted": (data: any) => void;
  "file-created": (data: any) => void;
  "file-updated": (data: any) => void;
  "file-renamed": (data: any) => void;
  "error": (data: ErrorPayload) => void;
  "ping": () => void;
}

// Client-to-server events (what client sends to server)
export interface ClientToServerEvents {
  "joinRoom": (data: JoinRoomPayload) => void;
  "message": (data: MessagePayload) => void;
  "collaborative-change": (data: CollaborativeChangePayload) => void;
  "cursor-update": (data: CursorUpdatePayload) => void;
  "typing-start": (roomId: string) => void;
  "typing-stop": (roomId: string) => void;
  "newFile": (data: FileOperationPayload) => void;
  "fileRead": (data: FileOperationPayload) => void;
  "fileDelete": (data: FileOperationPayload) => void;
  "file-sync": (data: any) => void;
  "request-file-sync": (data: any) => void;
  "statusChange": (data: StatusChangePayload) => void;
  "drawing-update": (data: DrawingPayload) => void;
  "request-drawing": (data: any) => void;
  "sync-drawing": (data: DrawingPayload) => void;
  "sync-file-structure": (data: any) => void;
  "directory-created": (data: any) => void;
  "directory-updated": (data: any) => void;
  "directory-deleted": (data: any) => void;
  "file-created": (data: any) => void;
  "file-updated": (data: any) => void;
  "file-renamed": (data: any) => void;
  "pong": () => void;
}

// Inter-server events (for scaling)
export interface InterServerEvents {
  ping: () => void;
}
