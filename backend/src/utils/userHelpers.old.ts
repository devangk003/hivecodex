import { Socket } from "socket.io";
import { User, UserInRoom, UserSession, TypingUser } from "../types/user";
import { SocketId } from "../types/socket";

// In-memory storage for active users (consider Redis for production scaling)
let activeUsers: Map<SocketId, User> = new Map();
let userSessions: Map<string, UserSession> = new Map(); // userId -> session
let typingUsers: Map<string, TypingUser[]> = new Map(); // roomId -> typing users

/**
 * Add a user to the active users list
 */
export function addUser(user: User): void {
  activeUsers.set(user.socketId, user);
  
  // Update session tracking
  const session: UserSession = {
    userId: user.userId,
    userName: user.username,
    socketId: user.socketId,
    roomId: user.roomId,
    isAuthenticated: true,
    connectedAt: new Date(),
    lastActivity: new Date()
  };
  
  userSessions.set(user.userId.toString(), session);
}

/**
 * Remove a user from active users list
 */
export function removeUser(socketId: SocketId): User | undefined {
  const user = activeUsers.get(socketId);
  if (user) {
    activeUsers.delete(socketId);
    userSessions.delete(user.userId.toString());
    
    // Remove from typing users if present
    removeUserFromTyping(user.roomId, user.userId.toString());
  }
  return user;
}

/**
 * Get user by socket ID
 */
export function getUserBySocketId(socketId: SocketId): User | undefined {
  return activeUsers.get(socketId);
}

/**
 * Get user by user ID
 */
export function getUserByUserId(userId: string): User | undefined {
  return Array.from(activeUsers.values()).find(user => 
    user.userId.toString() === userId
  );
}

/**
 * Get all users in a specific room
 */
export function getUsersInRoom(roomId: string): UserInRoom[] {
  return Array.from(activeUsers.values())
    .filter(user => user.roomId === roomId)
    .map(user => ({
      userId: user.userId,
      userName: user.username,
      profilePicId: user.profilePicId,
      status: user.activityStatus,
      isTyping: user.typing,
      currentFile: user.currentFile || undefined,
      cursorPosition: user.cursorPosition,
      socketId: user.socketId
    }));
}

/**
 * Update user's current file
 */
export function updateUserCurrentFile(socketId: SocketId, fileName: string | null): void {
  const user = activeUsers.get(socketId);
  if (user) {
    user.currentFile = fileName;
    user.lastSeen = new Date();
  }
}

/**
 * Update user's cursor position
 */
export function updateUserCursorPosition(socketId: SocketId, position: number): void {
  const user = activeUsers.get(socketId);
  if (user) {
    user.cursorPosition = position;
    user.lastSeen = new Date();
  }
}

/**
 * Update user's activity status
 */
export function updateUserActivityStatus(socketId: SocketId, status: User['activityStatus']): void {
  const user = activeUsers.get(socketId);
  if (user) {
    user.activityStatus = status;
    user.lastSeen = new Date();
  }
}

/**
 * Set user typing status
 */
export function setUserTyping(socketId: SocketId, isTyping: boolean, fileName?: string): void {
  const user = activeUsers.get(socketId);
  if (!user) return;

  user.typing = isTyping;
  user.lastSeen = new Date();

  const roomTypingUsers = typingUsers.get(user.roomId) || [];
  
  if (isTyping && fileName) {
    // Add to typing users if not already present
    const existingIndex = roomTypingUsers.findIndex(tu => tu.userId.toString() === user.userId.toString());
    const typingUser: TypingUser = {
      userId: user.userId,
      userName: user.username,
      fileName,
      cursorPosition: user.cursorPosition,
      startedAt: new Date()
    };

    if (existingIndex >= 0) {
      roomTypingUsers[existingIndex] = typingUser;
    } else {
      roomTypingUsers.push(typingUser);
    }
  } else {
    // Remove from typing users
    const filteredUsers = roomTypingUsers.filter(tu => 
      tu.userId.toString() !== user.userId.toString()
    );
    typingUsers.set(user.roomId, filteredUsers);
    return;
  }

  typingUsers.set(user.roomId, roomTypingUsers);
}

/**
 * Get typing users in a room
 */
export function getTypingUsersInRoom(roomId: string, excludeUserId?: string): TypingUser[] {
  const roomTypingUsers = typingUsers.get(roomId) || [];
  
  // Filter out expired typing sessions (older than 5 seconds)
  const now = new Date();
  const validTypingUsers = roomTypingUsers.filter(tu => {
    const timeDiff = now.getTime() - tu.startedAt.getTime();
    return timeDiff < 5000; // 5 seconds timeout
  });

  // Update the map with valid users only
  typingUsers.set(roomId, validTypingUsers);

  // Exclude specific user if provided
  if (excludeUserId) {
    return validTypingUsers.filter(tu => tu.userId.toString() !== excludeUserId);
  }

  return validTypingUsers;
}

/**
 * Remove user from typing users list
 */
function removeUserFromTyping(roomId: string, userId: string): void {
  const roomTypingUsers = typingUsers.get(roomId) || [];
  const filteredUsers = roomTypingUsers.filter(tu => 
    tu.userId.toString() !== userId
  );
  typingUsers.set(roomId, filteredUsers);
}

/**
 * Get room ID from socket data
 */
export function getRoomId(socket: Socket): string | undefined {
  return socket.data?.roomId;
}

/**
 * Get user ID from socket data
 */
export function getUserId(socket: Socket): string | undefined {
  return socket.data?.userId;
}

/**
 * Get user name from socket data
 */
export function getUserName(socket: Socket): string | undefined {
  return socket.data?.userName;
}

/**
 * Update user's last activity
 */
export function updateUserActivity(socketId: SocketId): void {
  const user = activeUsers.get(socketId);
  if (user) {
    user.lastSeen = new Date();
    
    const session = userSessions.get(user.userId.toString());
    if (session) {
      session.lastActivity = new Date();
    }
  }
}

/**
 * Get user statistics
 */
export function getUserStats() {
  const totalUsers = activeUsers.size;
  const roomsWithUsers = new Set(Array.from(activeUsers.values()).map(u => u.roomId)).size;
  const onlineUsers = Array.from(activeUsers.values()).filter(u => 
    u.activityStatus === 'online'
  ).length;

  return {
    totalUsers,
    activeUsers: totalUsers,
    onlineUsers,
    roomsWithUsers
  };
}

/**
 * Cleanup inactive users (call periodically)
 */
export function cleanupInactiveUsers(timeoutMinutes: number = 30): void {
  const now = new Date();
  const timeoutMs = timeoutMinutes * 60 * 1000;

  for (const [socketId, user] of activeUsers.entries()) {
    const timeDiff = now.getTime() - user.lastSeen.getTime();
    if (timeDiff > timeoutMs) {
      removeUser(socketId);
    }
  }

  // Cleanup expired typing sessions
  for (const [roomId, roomTypingUsers] of typingUsers.entries()) {
    const validUsers = roomTypingUsers.filter(tu => {
      const timeDiff = now.getTime() - tu.startedAt.getTime();
      return timeDiff < 5000; // 5 seconds
    });
    typingUsers.set(roomId, validUsers);
  }
}

/**
 * Get all active users (for debugging/monitoring)
 */
export function getAllActiveUsers(): User[] {
  return Array.from(activeUsers.values());
}

/**
 * Clear all users (for testing or restart)
 */
export function clearAllUsers(): void {
  activeUsers.clear();
  userSessions.clear();
  typingUsers.clear();
}
