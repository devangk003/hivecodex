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

export interface TextOperationPayload {
  type: 'retain' | 'insert' | 'delete';
  length?: number;
  text?: string;
}

export interface CollaborativeChangePayload {
  id: string;
  userId: string;
  userName?: string;
  fileId: string;
  operations: TextOperationPayload[];
  baseVersion: number;
  timestamp?: number;
  roomId?: string;
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

export interface ChatUpdatedPayload {
  roomId: string;
  timestamp: string;
}

// Editor events shared types
export interface EditorCursorPosition {
  line: number;
  column: number;
}

export interface EditorFileEventData {
  fileId: string;
  userId: string;
  username?: string;
  cursorPosition?: EditorCursorPosition;
  timestamp?: Date;
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
  "collaborative-change": (data: CollaborativeChangePayload & { appliedVersion?: number }) => void;
  "collaborative-change-ack": (data: { fileId: string; ackVersion: number }) => void;
  "cursor-update": (data: CursorUpdatePayload) => void;
  "typing-start": (data: TypingPayload) => void;
  "typing-stop": (data: TypingPayload) => void;
  "typing-update": (data: TypingPayload & { isTyping: boolean }) => void;
  "newFile": (data: FileOperationPayload) => void;
  "fileRead": (data: FileOperationPayload) => void;
  "fileDelete": (data: FileOperationPayload) => void;
  "file-sync": (data: any) => void;
  "request-file-sync": (data: any) => void;
  "chat-updated": (data: ChatUpdatedPayload) => void;
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
  "user-started-editing": (data: EditorFileEventData) => void;
  "user-stopped-editing": (data: { fileId: string; userId: string }) => void;
  "user-cursor-update": (data: { fileId: string; userId: string; cursorPosition: EditorCursorPosition }) => void;
  "file-saved": (data: { fileId: string; userId: string; timestamp: Date }) => void;
  "error": (data: ErrorPayload) => void;
  "ping": () => void;
}

// Client-to-server events (what client sends to server)
export interface ClientToServerEvents {
  "joinRoom": (data: JoinRoomPayload) => void;
  "leave-room": (roomId: string) => void;
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
  "reaction-update": (data: { messageId: string; emoji: string }) => void;
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
  "start-editing": (data: EditorFileEventData) => void;
  "stop-editing": (data: { fileId: string; userId: string }) => void;
  "update-cursor": (data: { fileId: string; userId: string; cursorPosition: EditorCursorPosition }) => void;
  "file-saved": (data: { fileId: string; userId: string; timestamp: Date }) => void;
  "pong": () => void;
}

// Inter-server events (for scaling)
export interface InterServerEvents {
  ping: () => void;
}
