import mongoose from "mongoose";

export enum UserStatus {
  ONLINE = "online",
  OFFLINE = "offline",
  AWAY = "away",
  BUSY = "busy",
  IDLE = "idle",
  IN_ROOM = "in-room"
}

export enum UserConnectionStatus {
  CONNECTED = "connected",
  DISCONNECTED = "disconnected",
  RECONNECTING = "reconnecting"
}

export interface User {
  username: string;
  roomId: string;
  status: UserConnectionStatus;
  activityStatus: UserStatus;
  cursorPosition: number;
  typing: boolean;
  currentFile: string | null;
  socketId: string;
  userId: mongoose.Types.ObjectId;
  profilePicId?: mongoose.Types.ObjectId;
  lastSeen: Date;
  joinedAt: Date;
}

export interface UserSession {
  userId: mongoose.Types.ObjectId;
  userName: string;
  socketId: string;
  roomId: string;
  isAuthenticated: boolean;
  connectedAt: Date;
  lastActivity: Date;
}

export interface UserInRoom {
  userId: mongoose.Types.ObjectId;
  userName: string;
  profilePicId?: mongoose.Types.ObjectId;
  status: UserStatus;
  isTyping: boolean;
  currentFile?: string;
  cursorPosition?: number;
  socketId: string;
}

export interface UserPresence {
  userId: mongoose.Types.ObjectId;
  userName: string;
  status: UserStatus;
  lastSeen: Date;
  currentRoom?: string;
  activeFile?: string;
}

export interface TypingUser {
  userId: mongoose.Types.ObjectId;
  userName: string;
  fileName: string;
  cursorPosition: number;
  startedAt: Date;
}

export interface UserActivity {
  userId: mongoose.Types.ObjectId;
  roomId: string;
  action: string;
  timestamp: Date;
  details?: any;
}

// Database User Schema Interface
export interface IUser {
  _id: mongoose.Types.ObjectId;
  name: string;
  email: string;
  password: string;
  profilePicId?: mongoose.Types.ObjectId;
  rememberMe: boolean;
  resetToken?: string;
  resetTokenExpiry?: Date;
  activityStatus: UserStatus;
  createdAt: Date;
  updatedAt: Date;
}

// JWT Payload Interface
export interface JwtPayload {
  userId: mongoose.Types.ObjectId;
  email: string;
  name: string;
  iat: number;
  exp: number;
}

export interface AuthenticatedUser {
  userId: mongoose.Types.ObjectId;
  name: string;
  email: string;
  profilePicId?: mongoose.Types.ObjectId;
  activityStatus: UserStatus;
}

export interface UserStats {
  totalUsers: number;
  activeUsers: number;
  onlineUsers: number;
  roomsWithUsers: number;
}
