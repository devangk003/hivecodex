import { Socket, Server } from "socket.io";
import { SocketEvent } from "../types/socket";
import { getUsersInRoom, getUserBySocketId } from "./userHelpers";

/**
 * Broadcast message to all users in a room except sender
 */
export function broadcastToRoom(
  io: Server, 
  roomId: string, 
  event: SocketEvent, 
  data: any, 
  excludeSocketId?: string
): void {
  if (excludeSocketId) {
    io.to(roomId).except(excludeSocketId).emit(event, data);
  } else {
    io.to(roomId).emit(event, data);
  }
}

/**
 * Broadcast message to all users in a room including sender
 */
export function broadcastToRoomIncludingSender(
  io: Server,
  roomId: string,
  event: SocketEvent,
  data: any
): void {
  io.to(roomId).emit(event, data);
}

/**
 * Send message to specific user by socket ID
 */
export function sendToUser(
  io: Server,
  socketId: string,
  event: SocketEvent,
  data: any
): void {
  io.to(socketId).emit(event, data);
}

/**
 * Join user to a room
 */
export async function joinRoom(socket: Socket, roomId: string): Promise<void> {
  await socket.join(roomId);
  socket.data.roomId = roomId;
}

/**
 * Leave user from a room
 */
export async function leaveRoom(socket: Socket, roomId: string): Promise<void> {
  await socket.leave(roomId);
  if (socket.data.roomId === roomId) {
    socket.data.roomId = undefined;
  }
}

/**
 * Get all socket IDs in a room
 */
export async function getSocketsInRoom(io: Server, roomId: string): Promise<string[]> {
  const sockets = await io.in(roomId).fetchSockets();
  return sockets.map(socket => socket.id);
}

/**
 * Get room participants count
 */
export async function getRoomParticipantsCount(io: Server, roomId: string): Promise<number> {
  const sockets = await io.in(roomId).fetchSockets();
  return sockets.length;
}

/**
 * Broadcast user list update to room
 */
export function broadcastUserListUpdate(io: Server, roomId: string): void {
  const users = getUsersInRoom(roomId);
  broadcastToRoomIncludingSender(io, roomId, SocketEvent.USER_JOINED, {
    users,
    count: users.length
  });
}

/**
 * Broadcast typing status to room
 */
export function broadcastTypingStatus(
  io: Server,
  roomId: string,
  userId: string,
  userName: string,
  isTyping: boolean,
  fileName?: string,
  cursorPosition?: number
): void {
  const typingData = {
    userId,
    userName,
    isTyping,
    fileName,
    cursorPosition,
    timestamp: new Date().toISOString()
  };

  const event = isTyping ? SocketEvent.TYPING_START : SocketEvent.TYPING_STOP;
  broadcastToRoom(io, roomId, event, typingData);
}

/**
 * Broadcast file operation to room
 */
export function broadcastFileOperation(
  io: Server,
  roomId: string,
  operation: "created" | "updated" | "deleted" | "renamed",
  fileData: {
    fileName: string;
    filePath?: string;
    userId: string;
    userName: string;
    content?: string;
    newFileName?: string;
  },
  excludeSocketId?: string
): void {
  const eventMap = {
    created: SocketEvent.FILE_CREATED,
    updated: SocketEvent.FILE_UPDATED,
    deleted: SocketEvent.FILE_DELETED,
    renamed: SocketEvent.FILE_RENAMED
  };

  const event = eventMap[operation];
  broadcastToRoom(io, roomId, event, {
    ...fileData,
    timestamp: new Date().toISOString()
  }, excludeSocketId);
}

/**
 * Broadcast collaborative change to room
 */
export function broadcastCollaborativeChange(
  io: Server,
  roomId: string,
  changeData: {
    operation: string;
    content: string;
    position: number;
    length: number;
    fileName: string;
    userId: string;
    userName: string;
  },
  excludeSocketId?: string
): void {
  broadcastToRoom(io, roomId, SocketEvent.COLLABORATIVE_CHANGE, {
    ...changeData,
    timestamp: new Date().toISOString()
  }, excludeSocketId);
}

/**
 * Broadcast cursor update to room
 */
export function broadcastCursorUpdate(
  io: Server,
  roomId: string,
  cursorData: {
    cursorPosition: number;
    fileName: string;
    userId: string;
    userName: string;
  },
  excludeSocketId?: string
): void {
  broadcastToRoom(io, roomId, SocketEvent.CURSOR_UPDATE, {
    ...cursorData,
    timestamp: new Date().toISOString()
  }, excludeSocketId);
}

/**
 * Broadcast user disconnect to room
 */
export function broadcastUserDisconnect(
  io: Server,
  roomId: string,
  userData: {
    userId: string;
    userName: string;
  }
): void {
  broadcastToRoomIncludingSender(io, roomId, SocketEvent.USER_DISCONNECTED, {
    ...userData,
    timestamp: new Date().toISOString()
  });
}

/**
 * Broadcast message to room
 */
export function broadcastMessage(
  io: Server,
  roomId: string,
  messageData: {
    text: string;
    sender?: string;
    senderId?: string;
    userId?: string;
    userName?: string;
    timestamp?: string;
    id?: string;
    messageType?: "text" | "file" | "system" | "code";
  }
): void {
  broadcastToRoomIncludingSender(io, roomId, SocketEvent.MESSAGE, {
    ...messageData,
    messageType: messageData.messageType || "text"
  });
}

/**
 * Send error message to specific socket
 */
export function sendError(
  socket: Socket,
  message: string,
  code?: string,
  details?: any
): void {
  socket.emit(SocketEvent.ERROR, {
    message,
    code,
    details,
    timestamp: new Date().toISOString()
  });
}

/**
 * Validate room access for socket
 */
export function validateRoomAccess(socket: Socket, roomId: string): boolean {
  return socket.data.roomId === roomId;
}

/**
 * Get room information for socket
 */
export function getRoomInfo(socket: Socket): {
  roomId?: string;
  userId?: string;
  userName?: string;
} {
  return {
    roomId: socket.data.roomId,
    userId: socket.data.userId,
    userName: socket.data.userName
  };
}

/**
 * Cleanup room if empty
 */
export async function cleanupEmptyRoom(io: Server, roomId: string): Promise<boolean> {
  const participantsCount = await getRoomParticipantsCount(io, roomId);
  
  if (participantsCount === 0) {
    // Room is empty, perform cleanup
    // You can add database cleanup logic here
    console.log(`Room ${roomId} is empty and cleaned up`);
    return true;
  }
  
  return false;
}

/**
 * Notify room about user status change
 */
export function notifyUserStatusChange(
  io: Server,
  roomId: string,
  userId: string,
  userName: string,
  status: "online" | "offline" | "away" | "busy"
): void {
  const event = status === "online" ? SocketEvent.USER_ONLINE : SocketEvent.USER_OFFLINE;
  
  broadcastToRoomIncludingSender(io, roomId, event, {
    userId,
    userName,
    status,
    timestamp: new Date().toISOString()
  });
}
