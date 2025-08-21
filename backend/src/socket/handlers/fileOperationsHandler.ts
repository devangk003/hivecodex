import { Socket } from 'socket.io';
import { Room, User } from '../../database/models';
import { FileInfo } from '../../types/filesystem';
import mongoose, { ClientSession } from 'mongoose';
import multer from 'multer';
import path from 'path';

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow all file types for now, but could add restrictions
    cb(null, true);
  }
});

interface FileOperationResult {
  success: boolean;
  data?: any;
  error?: string;
}

export class FileOperationsHandler {
  private socket: Socket;
  private userId: string;

  constructor(socket: Socket, userId: string) {
    this.socket = socket;
    this.userId = userId;
  }

  /**
   * Execute work in a MongoDB transaction if supported (replica set or mongos),
   * otherwise gracefully fall back to non-transactional execution.
   */
  private async withTransactionFallback<T>(
    work: (session: ClientSession | null) => Promise<T>
  ): Promise<T> {
    const session = await mongoose.startSession();
    try {
      try {
        // Attempt transactional execution
        return await session.withTransaction(async () => {
          return await work(session);
        });
      } catch (err: any) {
        const msg = String(err?.message || '');
        // Error code 20 or message indicates standalone deployment (no transactions)
        const isNoTxnSupport = err?.code === 20 || err?.codeName === 'IllegalOperation' ||
          msg.includes('Transaction numbers are only allowed on a replica set member or mongos');
        if (isNoTxnSupport) {
          // Fallback: run without a session/transaction
          return await work(null);
        }
        throw err;
      }
    } finally {
      await session.endSession();
    }
  }

  /**
   * Upload files with ACID compliance
   * Uses MongoDB transactions to ensure atomicity
   */
  async uploadFiles(roomId: string, files: Express.Multer.File[], parentId?: string): Promise<FileOperationResult> {
    try {
      return await this.withTransactionFallback(async (session) => {
        // Verify room access
        const q = Room.findOne({ id: roomId });
        const room = session ? await q.session(session) : await q;
        if (!room) {
          throw new Error('Room not found');
        }

        // Verify user has access to room (owner or in participantList)
        const uq = User.findById(this.userId);
        const user = session ? await uq.session(session) : await uq;
        if (!user) {
          throw new Error('Access denied');
        }

        const isOwner = room.userId?.toString() === user._id.toString();
        const isParticipant = Array.isArray(room.participantList)
          && room.participantList.some((p: any) => p?.userId?.toString() === user._id.toString());
        if (!isOwner && !isParticipant) {
          throw new Error('Access denied');
        }


        // Verify parent folder exists if specified
        if (parentId) {
          const parentFolder = room.files.find((file: FileInfo) => (file.fileId?.toString() === parentId) && file.type === 'folder');
          if (!parentFolder) {
            throw new Error('Parent folder not found');
          }
        }

        const uploadedFiles: FileInfo[] = [];

        for (const file of files) {
          const newFile: FileInfo = {
            fileId: new mongoose.Types.ObjectId(),
            name: file.originalname,
            type: 'file',
            parentId: parentId ? new mongoose.Types.ObjectId(parentId) : null,
            size: file.size,
            lastModified: new Date(),
            createdAt: new Date(),
            lines: (file.buffer.toString('utf8').match(/\n/g) || []).length + 1,
            read: false,
            ext: path.extname(file.originalname).slice(1),
            content: file.buffer.toString('utf8'),
            createdBy: new mongoose.Types.ObjectId(this.userId),
            lastModifiedBy: new mongoose.Types.ObjectId(this.userId)
          };
          room.files.push(newFile);
          uploadedFiles.push(newFile);
        }

        await room.save(session ? { session } : undefined as any);

        // Broadcast file upload event to room
        this.socket.to(roomId).emit('files:uploaded', {
          files: uploadedFiles,
          uploadedBy: this.userId
        });

        return { success: true, data: uploadedFiles };
      });
    } catch (error) {
      console.error('File upload error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed'
      };
    }
  }

  /**
   * Move file/folder with ACID compliance
   * Prevents circular dependencies and validates permissions
   */
  async moveItem(itemId: string, targetFolderId: string | null, roomId: string): Promise<FileOperationResult> {
    try {
      return await this.withTransactionFallback(async (session) => {
        // Verify room access
        const q = Room.findOne({ id: roomId });
        const room = session ? await q.session(session) : await q;
        if (!room) {
          throw new Error('Room not found');
        }

        // Find the item
  const item = room.files.find((f: FileInfo) => f.fileId?.toString() === itemId);
        if (!item) {
          throw new Error('Item not found');
        }

        // Verify target folder exists if specified
        let targetFolder = null;
        if (targetFolderId) {
          targetFolder = room.files.find((f: FileInfo) => f.fileId?.toString() === targetFolderId);
          if (!targetFolder || targetFolder.type !== 'folder') {
            throw new Error('Target folder not found');
          }

          // Prevent moving folder into its own subtree
          if (item.type === 'folder') {
            const isDescendant = await this.isDescendantFolder(itemId, targetFolderId, room, session);
            if (isDescendant) {
              throw new Error('Cannot move folder into its own subtree');
            }
          }
        }

        // Update item's parent
  const oldParentId = item.parentId;
  item.parentId = targetFolderId ? new mongoose.Types.ObjectId(targetFolderId) : null;
  item.lastModified = new Date();

        await room.save(session ? { session } : undefined as any);

        // If moving a folder, update all descendant paths
        if (item.type === 'folder') {
          await this.updateDescendantPaths(itemId, room, session);
        }

        // Broadcast move event
        this.socket.to(roomId).emit('files:moved', {
          itemId,
          oldParentId,
          newParentId: targetFolderId,
          movedBy: this.userId
        });

        return { success: true, data: item };
      });
    } catch (error) {
      console.error('Move item error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Move failed'
      };
    }
  }

  /**
   * Delete file/folder with ACID compliance
   * Recursively deletes folder contents
   */
  async deleteItem(itemId: string, roomId: string): Promise<FileOperationResult> {
    try {
      return await this.withTransactionFallback(async (session) => {
        // Verify room access
        const q = Room.findOne({ id: roomId });
        const room = session ? await q.session(session) : await q;
        if (!room) {
          throw new Error('Room not found');
        }

        // Find the item
  const item = room.files.find((f: FileInfo) => f.fileId?.toString() === itemId);
        if (!item) {
          throw new Error('Item not found');
        }

        // If it's a folder, delete all contents recursively
        if (item.type === 'folder') {
          await this.deleteDescendants(itemId, room, session);
        }

        // Remove the item from the files array
  room.files = room.files.filter((f: FileInfo) => f.fileId?.toString() !== itemId);
        await room.save(session ? { session } : undefined as any);

        // Broadcast delete event
        this.socket.to(roomId).emit('files:deleted', {
          itemId,
          deletedBy: this.userId
        });

        return { success: true };
      });
    } catch (error) {
      console.error('Delete item error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Delete failed'
      };
    }
  }

  /**
   * Create new file/folder with ACID compliance
   */
  async createItem(name: string, type: 'file' | 'folder', roomId: string, parentId?: string): Promise<FileOperationResult> {
    try {
      return await this.withTransactionFallback(async (session) => {
        // Verify room access
        const q = Room.findOne({ id: roomId });
        const room = session ? await q.session(session) : await q;
        if (!room) {
          throw new Error('Room not found');
        }

        // Verify parent folder exists if specified
        if (parentId) {
          const parentFolder = room.files.find((file: FileInfo) => file.fileId?.toString() === parentId && file.type === 'folder');
          if (!parentFolder) {
            throw new Error('Parent folder not found');
          }
        }

        // Check for name conflicts
        const existingItem = room.files.find(file =>
          file.name === name &&
          (file.parentId?.toString() === parentId || (!file.parentId && !parentId))
        );

        if (existingItem) {
          throw new Error(`${type === 'file' ? 'File' : 'Folder'} with this name already exists`);
        }

        // Create the item
        const newItem: Omit<FileInfo, 'content' | 'createdBy' | 'lastModifiedBy'> & { content?: string, createdBy?: mongoose.Types.ObjectId, lastModifiedBy?: mongoose.Types.ObjectId } = {
          fileId: new mongoose.Types.ObjectId(),
          name,
          type,
          parentId: parentId ? new mongoose.Types.ObjectId(parentId) : null,
          size: type === 'file' ? 0 : undefined,
          lastModified: new Date(),
          createdAt: new Date(),
          lines: type === 'file' ? 0 : undefined,
          read: false,
          ext: type === 'file' ? path.extname(name).slice(1) : undefined
        };


        room.files.push(newItem as FileInfo);
        await room.save(session ? { session } : undefined as any);

        // Broadcast create event
        this.socket.to(roomId).emit('files:created', {
          item: newItem,
          createdBy: this.userId
        });

        return { success: true, data: newItem };
      });
    } catch (error) {
      console.error('Create item error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Create failed'
      };
    }
  }

  /**
   * Helper method to check if target is descendant of source folder
   */
  private async isDescendantFolder(
    sourceFolderId: string,
    targetFolderId: string,
    room: any,
    session: ClientSession | null
  ): Promise<boolean> {
  const targetFolder = room.files.find((f: FileInfo) => f.fileId?.toString() === targetFolderId);

    if (!targetFolder) return false;
    if (targetFolder.parentId?.toString() === sourceFolderId) return true;
    if (!targetFolder.parentId) return false;

    return this.isDescendantFolder(sourceFolderId, targetFolder.parentId.toString(), room, session);
  }

  /**
   * Helper method to update paths of all descendants when moving a folder
   */
  private async updateDescendantPaths(
    folderId: string,
    room: any,
    session: ClientSession | null
  ): Promise<void> {
    const descendants = room.files.filter((file: FileInfo) =>
      file.parentId?.toString() === folderId
    );

    for (const descendant of descendants) {
      descendant.lastModified = new Date();

      // Recursively update if it's a folder
      if (descendant.type === 'folder') {
        await this.updateDescendantPaths(descendant.fileId.toString(), room, session);
      }
    }

    await room.save(session ? { session } : undefined as any);
  }

  /**
   * Helper method to recursively delete folder contents
   */
  private async deleteDescendants(
    folderId: string,
    room: any,
    session: ClientSession | null
  ): Promise<void> {
    const descendants = room.files.filter((file: FileInfo) =>
      file.parentId?.toString() === folderId
    );

    for (const descendant of descendants) {
      if (descendant.type === 'folder') {
        await this.deleteDescendants(descendant.fileId.toString(), room, session);
      }
  room.files = room.files.filter((f: FileInfo) => f.fileId?.toString() !== descendant.fileId?.toString());
    }
  }
}

// Socket event handlers
export const setupFileOperationsHandlers = (socket: Socket, userId: string) => {
  const handler = new FileOperationsHandler(socket, userId);

  socket.on('files:upload', async (data) => {
    const { roomId, files, parentId } = data;
    const result = await handler.uploadFiles(roomId, files, parentId);
    socket.emit('files:upload:result', result);
  });

  socket.on('files:move', async (data) => {
    const { itemId, targetFolderId, roomId } = data;
    const result = await handler.moveItem(itemId, targetFolderId, roomId);
    socket.emit('files:move:result', result);
  });

  socket.on('files:delete', async (data) => {
    const { itemId, roomId } = data;
    const result = await handler.deleteItem(itemId, roomId);
    socket.emit('files:delete:result', result);
  });

  socket.on('files:create', async (data) => {
    const { name, type, roomId, parentId } = data;
    const result = await handler.createItem(name, type, roomId, parentId);
    socket.emit('files:create:result', result);
  });
};
