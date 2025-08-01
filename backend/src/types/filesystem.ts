import { ObjectId } from "mongoose";

export interface FileInfo {
  fileId?: ObjectId; // For files only; null for folders
  name: string;
  ext?: string; // For files only
  lines?: number; // For files only
  read: boolean; // For files only
  type: "file" | "folder";
  parentId?: ObjectId | null; // null for root-level
  size?: number; // File size in bytes
  lastModified?: Date;
  createdAt?: Date;
  content?: string; // File content for reading
  path?: string; // Full file path
}

export interface DirectoryStructure {
  id: ObjectId;
  name: string;
  type: "file" | "folder";
  parentId?: ObjectId | null;
  children?: DirectoryStructure[];
  size?: number;
  lastModified?: Date;
  ext?: string;
  lines?: number;
  read?: boolean;
}

export interface FileOperation {
  type: "create" | "read" | "update" | "delete" | "rename" | "move";
  fileId?: ObjectId;
  fileName: string;
  filePath?: string;
  content?: string;
  newName?: string;
  newPath?: string;
  userId: ObjectId;
  roomId: string;
  timestamp: Date;
}

export interface FileUpload {
  originalName: string;
  fileName: string;
  fileId: ObjectId;
  size: number;
  mimeType: string;
  uploadedBy: ObjectId;
  uploadedAt: Date;
  roomId: string;
}

export interface FileSystemChange {
  operation: FileOperation["type"];
  path: string;
  newPath?: string;
  content?: string;
  userId: ObjectId;
  timestamp: Date;
  roomId: string;
}

export interface GridFSFile {
  _id: ObjectId;
  filename: string;
  contentType: string;
  length: number;
  uploadDate: Date;
  metadata?: {
    originalName: string;
    uploadedBy: ObjectId;
    roomId: string;
    fileType: string;
  };
}

export interface FileVersioning {
  fileId: ObjectId;
  version: number;
  content: string;
  modifiedBy: ObjectId;
  modifiedAt: Date;
  changeDescription?: string;
}

export interface FilePermissions {
  fileId: ObjectId;
  userId: ObjectId;
  permissions: ("read" | "write" | "delete" | "share")[];
  grantedBy: ObjectId;
  grantedAt: Date;
}

export interface FileShare {
  fileId: ObjectId;
  sharedBy: ObjectId;
  sharedWith: ObjectId[];
  shareType: "view" | "edit" | "full";
  expiresAt?: Date;
  createdAt: Date;
}

export interface FileMetadata {
  fileId: ObjectId;
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  encoding?: string;
  hash?: string; // File hash for integrity checking
  tags?: string[];
  description?: string;
  createdBy: ObjectId;
  createdAt: Date;
  lastModifiedBy: ObjectId;
  lastModifiedAt: Date;
}

export interface ProjectStructure {
  rootPath: string;
  files: FileInfo[];
  directories: DirectoryStructure[];
  totalFiles: number;
  totalDirectories: number;
  totalSize: number;
  lastUpdated: Date;
}

export interface FileSearchResult {
  fileId: ObjectId;
  fileName: string;
  filePath: string;
  content: string;
  matches: {
    line: number;
    column: number;
    text: string;
    context: string;
  }[];
  roomId: string;
  lastModified: Date;
}

export interface FileValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  fileSize: number;
  allowedExtensions: string[];
  maxSize: number;
}
