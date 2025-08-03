import mongoose, { Document } from "mongoose";
import { FileInfo } from "./filesystem";
import { UserStatus } from "./user";

// Room Database Schema Interface
export interface IRoom extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId; // Room creator
  id: string; // Unique room identifier
  name: string;
  description: string;
  isPrivate: boolean;
  password?: string; // Only for private rooms
  mostUsedLanguage: string;
  dateTime: string;
  lastActive: string;
  participants: number;
  files: FileInfo[];
  participantList: {
    userId: mongoose.Types.ObjectId;
    name: string;
    profilePicId?: mongoose.Types.ObjectId;
    role: 'owner' | 'admin' | 'member' | 'viewer';
    joinedAt: Date;
  }[];
  createdAt: Date;
  updatedAt: Date;
}

// Message Database Schema Interface
export interface IMessage extends Document {
  _id: mongoose.Types.ObjectId;
  roomId: mongoose.Types.ObjectId;
  senderId: mongoose.Types.ObjectId;
  senderName: string;
  content: string;
  timestamp: Date;
  messageType: "text" | "file" | "system" | "code";
  isEdited: boolean;
  editedAt?: Date;
  attachments?: {
    fileId: mongoose.Types.ObjectId;
    fileName: string;
    fileSize: number;
    mimeType: string;
  }[];
  mentions?: mongoose.Types.ObjectId[]; // User IDs mentioned in message
  reactions?: {
    userId: mongoose.Types.ObjectId;
    emoji: string;
    timestamp: Date;
  }[];
  replyTo?: mongoose.Types.ObjectId; // Message ID this is replying to
  isDeleted: boolean;
  deletedAt?: Date;
}

// User Database Schema Interface (from user.ts but extended for database)
export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  email: string;
  password: string;
  profilePicId?: mongoose.Types.ObjectId;
  rememberMe: boolean;
  resetToken?: string;
  resetTokenExpiry?: Date;
  activityStatus: UserStatus;
  lastLogin?: Date;
  isEmailVerified: boolean;
  emailVerificationToken?: string;
  twoFactorEnabled: boolean;
  twoFactorSecret?: string;
  preferences: {
    theme: "light" | "dark";
    language: string;
    notifications: {
      email: boolean;
      push: boolean;
      mentions: boolean;
    };
  };
  statistics: {
    roomsCreated: number;
    roomsJoined: number;
    messagesSet: number;
    filesCreated: number;
    totalTimeSpent: number; // in minutes
  };
  lastSeen: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Session Management
export interface ISession extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  sessionToken: string;
  deviceInfo: {
    userAgent: string;
    ip: string;
    platform: string;
    browser: string;
  };
  isActive: boolean;
  lastActivity: Date;
  expiresAt: Date;
  createdAt: Date;
}

// Room Activity Log
export interface IRoomActivity extends Document {
  _id: mongoose.Types.ObjectId;
  roomId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  activityType: "join" | "leave" | "file_create" | "file_update" | "file_delete" | "message" | "invite";
  details: {
    fileName?: string;
    messageId?: mongoose.Types.ObjectId;
    invitedUserId?: mongoose.Types.ObjectId;
    description?: string;
  };
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
}

// File Collaboration History
export interface ICollaborationHistory extends Document {
  _id: mongoose.Types.ObjectId;
  fileId: mongoose.Types.ObjectId;
  roomId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  operation: "insert" | "delete" | "replace" | "format";
  position: number;
  length: number;
  content: string;
  previousContent?: string;
  timestamp: Date;
  sessionId: string; // For grouping related operations
}

// Room Invitations
export interface IRoomInvitation extends Document {
  _id: mongoose.Types.ObjectId;
  roomId: mongoose.Types.ObjectId;
  invitedBy: mongoose.Types.ObjectId;
  invitedUser: mongoose.Types.ObjectId;
  invitationType: "email" | "link" | "direct";
  invitationToken: string;
  status: "pending" | "accepted" | "declined" | "expired";
  permissions: ("read" | "write" | "admin")[];
  expiresAt: Date;
  respondedAt?: Date;
  createdAt: Date;
}

// Analytics and Statistics
export interface IRoomStatistics extends Document {
  _id: mongoose.Types.ObjectId;
  roomId: mongoose.Types.ObjectId;
  date: Date; // Daily statistics
  metrics: {
    activeUsers: number;
    totalMessages: number;
    filesCreated: number;
    filesModified: number;
    totalEditTime: number; // in minutes
    collaborativeEdits: number;
    peakConcurrentUsers: number;
  };
  userActivity: {
    userId: mongoose.Types.ObjectId;
    timeSpent: number; // in minutes
    messagesSet: number;
    filesModified: number;
    collaborativeEdits: number;
  }[];
}

// Database Connection Configuration
export interface DatabaseConfig {
  mongoUri: string;
  dbName: string;
  options: {
    useNewUrlParser: boolean;
    useUnifiedTopology: boolean;
    maxPoolSize: number;
    serverSelectionTimeoutMS: number;
    socketTimeoutMS: number;
    bufferMaxEntries: number;
    bufferCommands: boolean;
  };
}

// Redis Configuration for Session Storage
export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db: number;
  keyPrefix: string;
  ttl: number; // Time to live in seconds
}

// GridFS Configuration
export interface GridFSConfig {
  bucketName: string;
  chunkSizeBytes: number;
  maxFileSize: number; // in bytes
  allowedMimeTypes: string[];
  uploadPath: string;
}
