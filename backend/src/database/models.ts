import mongoose, { Schema, Document } from "mongoose";
import { IUser, IRoom, IMessage } from "../types/database";
import { UserStatus } from "../types/user";

// User Schema
const userSchema = new Schema<IUser>({
  name: { 
    type: String, 
    required: true,
    trim: true,
    maxlength: 100
  },
  email: { 
    type: String, 
    required: true, 
    unique: true,
    lowercase: true,
    trim: true
  },
  password: { 
    type: String, 
    required: true,
    minlength: 6
  },
  profilePicId: { 
    type: Schema.Types.ObjectId, 
    default: null 
  },
  rememberMe: { 
    type: Boolean, 
    default: false 
  },
  resetToken: { 
    type: String,
    default: undefined
  },
  resetTokenExpiry: { 
    type: Date,
    default: undefined
  },
  activityStatus: { 
    type: String, 
    enum: Object.values(UserStatus),
    default: UserStatus.OFFLINE 
  },
  lastLogin: {
    type: Date,
    default: undefined
  },
  lastSeen: {
    type: Date,
    default: undefined
  },
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  emailVerificationToken: {
    type: String,
    default: undefined
  },
  twoFactorEnabled: {
    type: Boolean,
    default: false
  },
  twoFactorSecret: {
    type: String,
    default: undefined
  },
  preferences: {
    theme: {
      type: String,
      enum: ["light", "dark"],
      default: "dark"
    },
    language: {
      type: String,
      default: "en"
    },
    notifications: {
      email: {
        type: Boolean,
        default: true
      },
      push: {
        type: Boolean,
        default: true
      },
      mentions: {
        type: Boolean,
        default: true
      }
    }
  },
  statistics: {
    roomsCreated: {
      type: Number,
      default: 0
    },
    roomsJoined: {
      type: Number,
      default: 0
    },
    messagesSet: {
      type: Number,
      default: 0
    },
    filesCreated: {
      type: Number,
      default: 0
    },
    totalTimeSpent: {
      type: Number,
      default: 0
    }
  }
}, {
  timestamps: true,
  collection: "users"
});

// Add indexes for performance
userSchema.index({ resetToken: 1 });
userSchema.index({ emailVerificationToken: 1 });
userSchema.index({ email: 1 }, { unique: true, name: "idx_users_email_unique" });

// Room Schema
const roomSchema = new Schema<IRoom>({
  userId: { 
    type: Schema.Types.ObjectId, 
    ref: "User", 
    required: true 
  },
  id: { 
    type: String, 
    required: true, 
    unique: true,
    trim: true
  },
  name: { 
    type: String, 
    required: true,
    trim: true,
    maxlength: 200
  },
  description: { 
    type: String, 
    default: "",
    maxlength: 1000
  },
  isPrivate: { 
    type: Boolean, 
    default: false 
  },
  password: { 
    type: String,
    default: undefined
  },
  mostUsedLanguage: { 
    type: String, 
    default: "JavaScript" 
  },
  dateTime: { 
    type: String, 
    required: true 
  },
  lastActive: { 
    type: String, 
    default: () => new Date().toISOString() 
  },
  participants: { 
    type: Number, 
    default: 1,
    min: 0
  },
  files: [{
    fileId: { 
      type: Schema.Types.ObjectId,
      default: null
    },
    name: { 
      type: String, 
      required: true,
      trim: true
    },
    ext: { 
      type: String,
      default: undefined
    },
    content: {
      type: String,
      default: ""
    },
    lines: { 
      type: Number,
      default: 0,
      min: 0
    },
    read: { 
      type: Boolean, 
      default: false 
    },
    type: { 
      type: String, 
      enum: ["file", "folder"], 
      required: true 
    },
    parentId: { 
      type: Schema.Types.ObjectId, 
      default: null 
    },
    size: {
      type: Number,
      default: 0,
      min: 0
    },
    lastModified: {
      type: Date,
      default: Date.now
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null
    },
    lastModifiedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null
    }
  }],
  participantList: [{
    userId: { 
      type: Schema.Types.ObjectId, 
      ref: "User",
      required: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    profilePicId: { 
      type: Schema.Types.ObjectId,
      default: null
    },
    role: {
      type: String,
      enum: ["owner", "admin", "member"],
      default: "member"
    },
    joinedAt: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true,
  collection: "rooms"
});

// Add indexes for performance
roomSchema.index({ userId: 1 });
roomSchema.index({ isPrivate: 1 });
roomSchema.index({ lastActive: -1 });
roomSchema.index({ name: 1 }, { name: "idx_rooms_name" });

// Message Schema
const messageSchema = new Schema<IMessage>({
  roomId: {
    type: Schema.Types.ObjectId,
    ref: "Room",
    required: true
  },
  senderId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  senderName: {
    type: String,
    required: true,
    trim: true
  },
  content: {
    type: String,
    required: true,
    maxlength: 5000
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  messageType: {
    type: String,
    enum: ["text", "file", "system", "code"],
    default: "text"
  },
  isEdited: {
    type: Boolean,
    default: false
  },
  editedAt: {
    type: Date,
    default: undefined
  },
  attachments: [{
    fileId: {
      type: Schema.Types.ObjectId,
      required: true
    },
    fileName: {
      type: String,
      required: true,
      trim: true
    },
    fileSize: {
      type: Number,
      required: true,
      min: 0
    },
    mimeType: {
      type: String,
      required: true
    }
  }],
  mentions: [{
    type: Schema.Types.ObjectId,
    ref: "User"
  }],
  reactions: [{
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    emoji: {
      type: String,
      required: true,
      maxlength: 10
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  replyTo: {
    type: Schema.Types.ObjectId,
    ref: "Message",
    default: null
  },
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: {
    type: Date,
    default: undefined
  }
}, {
  timestamps: true,
  collection: "messages"
});

// Add indexes for performance
messageSchema.index({ roomId: 1, timestamp: -1 });
messageSchema.index({ senderId: 1 });
messageSchema.index({ isDeleted: 1 });

// Create and export models
export const User = mongoose.model<IUser>("User", userSchema);
export const Room = mongoose.model<IRoom>("Room", roomSchema);
export const Message = mongoose.model<IMessage>("Message", messageSchema);

// Export schemas for potential extensions
export { userSchema, roomSchema, messageSchema };

// File metadata and version history
interface IFileHistoryEntry {
  timestamp: Date;
  userId: Schema.Types.ObjectId;
  previousFileId: Schema.Types.ObjectId; // GridFS file id snapshot
}

export interface IFileMeta extends Document {
  currentFileId: Schema.Types.ObjectId; // current GridFS file id
  history: IFileHistoryEntry[];
  createdAt: Date;
  updatedAt: Date;
}

const fileHistorySchema = new Schema<IFileHistoryEntry>({
  timestamp: { type: Date, default: Date.now },
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  previousFileId: { type: Schema.Types.ObjectId, required: true },
});

const fileMetaSchema = new Schema<IFileMeta>({
  currentFileId: { type: Schema.Types.ObjectId, required: true, index: true, unique: true },
  history: { type: [fileHistorySchema], default: [] },
}, {
  timestamps: true,
  collection: "fileMeta"
});

export const FileMeta = mongoose.model<IFileMeta>("FileMeta", fileMetaSchema);