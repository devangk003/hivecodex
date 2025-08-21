import express from "express";
import { body, param, validationResult } from "express-validator";
import jwt from "jsonwebtoken";
import multer from "multer";
import { Room } from "../database/models";
import { JWT_SECRET } from "../config/constants";
import { FileOperationsHandler } from "../socket/handlers/fileOperationsHandler";

const router = express.Router();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow all file types for now
    cb(null, true);
  }
});

// Authentication middleware
const authenticateToken = (req: express.Request, res: express.Response, next: express.NextFunction): void => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({
      success: false,
      message: "Access token is required",
      timestamp: new Date()
    });
    return;
  }

  try {
    const verified = jwt.verify(token, JWT_SECRET);
    (req as any).user = verified;
    next();
  } catch (error) {
    console.error("JWT verification error:", error);
    res.status(403).json({
      success: false,
      message: "Invalid token",
      timestamp: new Date()
    });
    return;
  }
};

const validate = (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ success: false, errors: errors.array() });
    return;
  }
  next();
};

// GET /api/rooms/:roomId/files - get room files
router.get(
  "/:roomId/files",
  authenticateToken,
  param("roomId").isString().trim().notEmpty(),
  validate,
  async (req, res) => {
    try {
      const { roomId } = req.params;
      const room = await Room.findOne({ id: roomId });
      if (!room) {
        return res.status(404).json({ success: false, message: "Room not found" });
      }
      
      return res.json(room.files || []);
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message || "Failed to fetch files" });
    }
  }
);

// POST /api/rooms/:roomId/files/upload - upload files
router.post(
  "/:roomId/files/upload",
  authenticateToken,
  upload.array('file'),
  param("roomId").isString().trim().notEmpty(),
  validate,
  async (req, res) => {
    try {
      const { roomId } = req.params;
      const { parentId } = req.body;
      const files = req.files as Express.Multer.File[];
      const userId = (req as any).user?.id;

      if (!files || files.length === 0) {
        return res.status(400).json({ success: false, message: "No files provided" });
      }

      // Create a mock socket for the handler
      const mockSocket = {
        to: () => ({ emit: () => {} }),
        emit: () => {}
      } as any;

      const handler = new FileOperationsHandler(mockSocket, userId);
      const result = await handler.uploadFiles(roomId, files, parentId);

      if (result.success) {
        return res.status(201).json(result);
      } else {
        return res.status(400).json(result);
      }
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message || "Upload failed" });
    }
  }
);

// POST /api/rooms/:roomId/files/create - create file or folder
router.post(
  "/:roomId/files/create",
  authenticateToken,
  param("roomId").isString().trim().notEmpty(),
  body("name").isString().trim().notEmpty().withMessage("Name is required"),
  body("type").isIn(['file', 'folder']).withMessage("Type must be 'file' or 'folder'"),
  body("parentId").optional().custom((value) => {
    if (value === null || value === undefined || typeof value === 'string') {
      return true;
    }
    throw new Error('parentId must be a string, null, or undefined');
  }),
  validate,
  async (req, res) => {
    try {
      const { roomId } = req.params;
      const { name, type, parentId } = req.body;
      const userId = (req as any).user?.id;

      // Create a mock socket for the handler
      const mockSocket = {
        to: () => ({ emit: () => {} }),
        emit: () => {}
      } as any;

      const handler = new FileOperationsHandler(mockSocket, userId);
      const result = await handler.createItem(name, type, roomId, parentId);

      if (result.success) {
        return res.status(201).json(result);
      } else {
        return res.status(400).json(result);
      }
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message || "Create failed" });
    }
  }
);

// DELETE /api/rooms/:roomId/files/:fileId - delete file or folder
router.delete(
  "/:roomId/files/:fileId",
  authenticateToken,
  param("roomId").isString().trim().notEmpty(),
  param("fileId").isString().trim().notEmpty(),
  validate,
  async (req, res) => {
    try {
      const { roomId, fileId } = req.params;
      const userId = (req as any).user?.id;

      // Create a mock socket for the handler
      const mockSocket = {
        to: () => ({ emit: () => {} }),
        emit: () => {}
      } as any;

      const handler = new FileOperationsHandler(mockSocket, userId);
      const result = await handler.deleteItem(fileId, roomId);

      if (result.success) {
        return res.json(result);
      } else {
        return res.status(400).json(result);
      }
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message || "Delete failed" });
    }
  }
);

// PUT /api/rooms/:roomId/files/:fileId/move - move file or folder
router.put(
  "/:roomId/files/:fileId/move",
  authenticateToken,
  param("roomId").isString().trim().notEmpty(),
  param("fileId").isString().trim().notEmpty(),
  body("targetFolderId").optional().isString(),
  validate,
  async (req, res) => {
    try {
      const { roomId, fileId } = req.params;
      const { targetFolderId } = req.body;
      const userId = (req as any).user?.id;

      // Create a mock socket for the handler
      const mockSocket = {
        to: () => ({ emit: () => {} }),
        emit: () => {}
      } as any;

      const handler = new FileOperationsHandler(mockSocket, userId);
      const result = await handler.moveItem(fileId, targetFolderId, roomId);

      if (result.success) {
        return res.json(result);
      } else {
        return res.status(400).json(result);
      }
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message || "Move failed" });
    }
  }
);

// PUT /api/rooms/:roomId/files/:fileId/rename - rename file or folder
router.put(
  "/:roomId/files/:fileId/rename",
  authenticateToken,
  param("roomId").isString().trim().notEmpty(),
  param("fileId").isString().trim().notEmpty(),
  body("name").isString().trim().notEmpty().withMessage("Name is required"),
  validate,
  async (req, res) => {
    try {
      const { roomId, fileId } = req.params;
      const { name } = req.body;
      const userId = (req as any).user?.id;

      // Find the room and file
      const room = await Room.findOne({ id: roomId });
      if (!room) {
        return res.status(404).json({ success: false, message: "Room not found" });
      }

      const fileIndex = room.files.findIndex((f: any) => f.fileId?.toString() === fileId);
      if (fileIndex === -1) {
        return res.status(404).json({ success: false, message: "File not found" });
      }

      // Update the file name
      room.files[fileIndex].name = name;
      room.files[fileIndex].lastModified = new Date();
      await room.save();

      return res.json({ success: true, data: room.files[fileIndex] });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message || "Rename failed" });
    }
  }
);

export default router;
