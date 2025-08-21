import { FileOperationsHandler } from '../socket/handlers/fileOperationsHandler';
import { Room, User } from '../database/models';
import mongoose, { ClientSession } from 'mongoose';
import { Socket } from 'socket.io';

// Mock dependencies
jest.mock('../database/models', () => ({
  Room: {
    findById: jest.fn(),
  },
  User: {
    findById: jest.fn(),
  },
}));

// A simplified mock for mongoose.Types.ObjectId
const mockObjectId = (id: string | number) => new mongoose.Types.ObjectId(id.toString());

// Mock the entire mongoose library
jest.mock('mongoose', () => ({
  ...jest.requireActual('mongoose'),
  startSession: jest.fn(),
  Types: {
    ObjectId: jest.fn((id) => ({
        toString: () => id,
        equals: (other: any) => other?.toString() === id,
    })),
  },
}));


describe('FileOperationsHandler', () => {
  let handler: FileOperationsHandler;
  let mockSocket: jest.Mocked<Pick<Socket, 'to' | 'emit'>>;
  let mockRoom: any;
  let mockUser: any;
  let mockSession: jest.Mocked<ClientSession>;
  const userId = 'user123';
  const roomId = 'room123';

  beforeEach(() => {
    jest.clearAllMocks();

    const mockEmit = jest.fn();
    mockSocket = {
      to: jest.fn().mockReturnThis(),
      emit: mockEmit,
    } as unknown as jest.Mocked<Pick<Socket, 'to' | 'emit'>>;
    (mockSocket.to as jest.Mock).mockReturnValue({ emit: mockEmit });


    mockUser = {
      _id: mockObjectId(userId),
    };

    mockRoom = {
      _id: roomId,
      participants: [mockObjectId(userId)],
      files: [],
      save: jest.fn().mockResolvedValue(true),
    };

    mockSession = {
      withTransaction: jest.fn(async (fn) => fn(mockSession)),
      endSession: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<ClientSession>;

    (mongoose.startSession as jest.Mock).mockResolvedValue(mockSession);

    (Room.findById as jest.Mock).mockReturnValue({
      session: jest.fn().mockResolvedValue(mockRoom),
    });
    (User.findById as jest.Mock).mockReturnValue({
      session: jest.fn().mockResolvedValue(mockUser),
    });

    handler = new FileOperationsHandler(mockSocket as unknown as Socket, userId);
  });

  describe('uploadFiles', () => {
    const mockFiles = [
      {
        originalname: 'test.txt',
        buffer: Buffer.from('hello world'),
        size: 11,
      },
    ] as Express.Multer.File[];

    it('should upload files successfully', async () => {
      const result = await handler.uploadFiles(roomId, mockFiles);

      expect(result.success).toBe(true);
      expect(mockRoom.files.length).toBe(1);
      expect(mockRoom.files[0].name).toBe('test.txt');
      expect(mockRoom.save).toHaveBeenCalledWith({ session: mockSession });
      expect(mockSocket.to).toHaveBeenCalledWith(roomId);
      expect(mockSocket.to(roomId).emit).toHaveBeenCalledWith('files:uploaded', expect.any(Object));
    });

    it('should fail if room not found', async () => {
      (Room.findById as jest.Mock).mockReturnValue({
        session: jest.fn().mockResolvedValue(null),
      });
      const result = await handler.uploadFiles(roomId, mockFiles);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Room not found');
    });

    it('should fail if user does not have access', async () => {
      mockRoom.participants = [];
      const result = await handler.uploadFiles(roomId, mockFiles);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Access denied');
    });

    it('should fail if parent folder not found', async () => {
      const result = await handler.uploadFiles(roomId, mockFiles, 'nonexistentParent');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Parent folder not found');
    });
  });

  describe('moveItem', () => {
    const fileId = 'file1';
    const folderId = 'folder1';

    beforeEach(() => {
      mockRoom.files = [
        { fileId: mockObjectId(fileId), name: 'file.txt', type: 'file', parentId: null },
        { fileId: mockObjectId(folderId), name: 'My Folder', type: 'folder', parentId: null },
      ];
    });

    it('should move an item successfully', async () => {
      const result = await handler.moveItem(fileId, folderId, roomId);
      const movedItem = mockRoom.files.find((f: any) => f.fileId.toString() === fileId);

      expect(result.success).toBe(true);
      expect(movedItem.parentId.toString()).toBe(folderId);
      expect(mockRoom.save).toHaveBeenCalledWith({ session: mockSession });
      expect(mockSocket.to).toHaveBeenCalledWith(roomId);
      expect(mockSocket.to(roomId).emit).toHaveBeenCalledWith('files:moved', expect.any(Object));
    });

    it('should fail if item not found', async () => {
      const result = await handler.moveItem('nonexistent', folderId, roomId);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Item not found');
    });

    it('should fail if target folder not found', async () => {
      const result = await handler.moveItem(fileId, 'nonexistent', roomId);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Target folder not found');
    });

    it('should prevent moving a folder into its own subtree', async () => {
      const childFolderId = 'childFolder1';
      mockRoom.files.push({
        fileId: mockObjectId(childFolderId),
        name: 'Child Folder',
        type: 'folder',
        parentId: mockObjectId(folderId),
      });

      const result = await handler.moveItem(folderId, childFolderId, roomId);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Cannot move folder into its own subtree');
    });
  });

  describe('deleteItem', () => {
    const fileId = 'file1';
    const folderId = 'folder1';
    const childFileId = 'childFile1';

    beforeEach(() => {
      mockRoom.files = [
        { fileId: mockObjectId(fileId), name: 'file.txt', type: 'file', parentId: null },
        { fileId: mockObjectId(folderId), name: 'My Folder', type: 'folder', parentId: null },
        { fileId: mockObjectId(childFileId), name: 'child.txt', type: 'file', parentId: mockObjectId(folderId) },
      ];
    });

    it('should delete a file successfully', async () => {
      const result = await handler.deleteItem(fileId, roomId);
      expect(result.success).toBe(true);
      expect(mockRoom.files.find((f: any) => f.fileId.toString() === fileId)).toBeUndefined();
      expect(mockRoom.save).toHaveBeenCalledWith({ session: mockSession });
      expect(mockSocket.to).toHaveBeenCalledWith(roomId);
      expect(mockSocket.to(roomId).emit).toHaveBeenCalledWith('files:deleted', { itemId: fileId, deletedBy: userId });
    });

    it('should recursively delete a folder and its contents', async () => {
      const result = await handler.deleteItem(folderId, roomId);
      expect(result.success).toBe(true);
      expect(mockRoom.files.find((f: any) => f.fileId.toString() === folderId)).toBeUndefined();
      expect(mockRoom.files.find((f: any) => f.fileId.toString() === childFileId)).toBeUndefined();
      expect(mockRoom.files.length).toBe(1); // Only file1 should remain
    });

    it('should fail if item not found', async () => {
      const result = await handler.deleteItem('nonexistent', roomId);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Item not found');
    });
  });

  describe('createItem', () => {
    it('should create a file successfully', async () => {
      const result = await handler.createItem('newFile.txt', 'file', roomId);
      expect(result.success).toBe(true);
      expect(mockRoom.files.length).toBe(1);
      expect(mockRoom.files[0].name).toBe('newFile.txt');
      expect(mockRoom.save).toHaveBeenCalledWith({ session: mockSession });
      expect(mockSocket.to).toHaveBeenCalledWith(roomId);
      expect(mockSocket.to(roomId).emit).toHaveBeenCalledWith('files:created', expect.any(Object));
    });

    it('should create a folder successfully', async () => {
        const result = await handler.createItem('New Folder', 'folder', roomId);
        expect(result.success).toBe(true);
        expect(mockRoom.files.length).toBe(1);
        expect(mockRoom.files[0].type).toBe('folder');
    });

    it('should fail if item with the same name already exists', async () => {
      mockRoom.files = [{ name: 'existing.txt', type: 'file', parentId: null }];
      const result = await handler.createItem('existing.txt', 'file', roomId);
      expect(result.success).toBe(false);
      expect(result.error).toBe('File with this name already exists');
    });

    it('should fail if parent folder does not exist', async () => {
        const result = await handler.createItem('newFile.txt', 'file', roomId, 'nonexistentParent');
        expect(result.success).toBe(false);
        expect(result.error).toBe('Parent folder not found');
    });
  });
});
