import { Socket } from "socket.io";

export type SocketId = string;

export enum SocketEvent {
  // Room management
  JOIN_REQUEST = "join-request",
  JOIN_ACCEPTED = "join-accepted",
  JOIN_ROOM = "joinRoom",
  USER_JOINED = "user-joined",
  USER_DISCONNECTED = "user-disconnected",
  USER_OFFLINE = "offline",
  USER_ONLINE = "online",
  
  // File system operations
  SYNC_FILE_STRUCTURE = "sync-file-structure",
  DIRECTORY_CREATED = "directory-created",
  DIRECTORY_UPDATED = "directory-updated",
  DIRECTORY_RENAMED = "directory-renamed",
  DIRECTORY_DELETED = "directory-deleted",
  FILE_CREATED = "file-created",
  FILE_UPDATED = "file-updated",
  FILE_RENAMED = "file-renamed",
  FILE_DELETED = "file-deleted",
  NEW_FILE = "newFile",
  FILE_READ = "fileRead",
  FILE_DELETE = "fileDelete",
  
  // Chat and messaging
  SEND_MESSAGE = "send-message",
  RECEIVE_MESSAGE = "receive-message",
  MESSAGE = "message",
  
  // Real-time collaboration
  COLLABORATIVE_CHANGE = "collaborative-change",
  CURSOR_UPDATE = "cursor-update",
  TYPING_START = "typing-start",
  TYPING_PAUSE = "typing-pause",
  TYPING_STOP = "typing-stop",
  
  // Drawing/Whiteboard
  REQUEST_DRAWING = "request-drawing",
  SYNC_DRAWING = "sync-drawing",
  DRAWING_UPDATE = "drawing-update",
  
  // User management
  USERNAME_EXISTS = "username-exists",
  
  // Error handling
  ERROR = "error",
  CONNECTION_ERROR = "connection_error",
}

export interface SocketContext {
  socket: Socket;
}

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
  cursorPosition: number;
  fileName?: string;
  userId: string;
  userName: string;
  isTyping: boolean;
}

export interface DrawingPayload {
  drawingData: any; // To be refined based on drawing implementation
  roomId: string;
  userId: string;
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
}

// Server-to-client events
export interface ServerToClientEvents {
  [SocketEvent.JOIN_ACCEPTED]: (data: { roomId: string }) => void;
  [SocketEvent.USER_JOINED]: (data: { userName: string; userId: string }) => void;
  [SocketEvent.USER_DISCONNECTED]: (data: { userName: string; userId: string }) => void;
  [SocketEvent.MESSAGE]: (data: MessagePayload) => void;
  [SocketEvent.COLLABORATIVE_CHANGE]: (data: CollaborativeChangePayload) => void;
  [SocketEvent.CURSOR_UPDATE]: (data: CursorUpdatePayload) => void;
  [SocketEvent.TYPING_START]: (data: TypingPayload) => void;
  [SocketEvent.TYPING_STOP]: (data: TypingPayload) => void;
  [SocketEvent.FILE_CREATED]: (data: FileOperationPayload) => void;
  [SocketEvent.FILE_UPDATED]: (data: FileOperationPayload) => void;
  [SocketEvent.FILE_DELETED]: (data: FileOperationPayload) => void;
  [SocketEvent.SYNC_DRAWING]: (data: DrawingPayload) => void;
  [SocketEvent.ERROR]: (data: ErrorPayload) => void;
}

// Client-to-server events
export interface ClientToServerEvents {
  [SocketEvent.JOIN_REQUEST]: (data: JoinRoomPayload) => void;
  [SocketEvent.MESSAGE]: (data: MessagePayload) => void;
  [SocketEvent.COLLABORATIVE_CHANGE]: (data: CollaborativeChangePayload) => void;
  [SocketEvent.CURSOR_UPDATE]: (data: CursorUpdatePayload) => void;
  [SocketEvent.TYPING_START]: (data: TypingPayload) => void;
  [SocketEvent.TYPING_STOP]: (data: TypingPayload) => void;
  [SocketEvent.NEW_FILE]: (data: FileOperationPayload) => void;
  [SocketEvent.FILE_READ]: (data: FileOperationPayload) => void;
  [SocketEvent.FILE_DELETE]: (data: FileOperationPayload) => void;
  [SocketEvent.REQUEST_DRAWING]: (data: { roomId: string }) => void;
  [SocketEvent.DRAWING_UPDATE]: (data: DrawingPayload) => void;
}

// Inter-server events (for scaling)
export interface InterServerEvents {
  ping: () => void;
}
