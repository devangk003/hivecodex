import express from "express";
import { body, param, validationResult } from "express-validator";
import rateLimit from "express-rate-limit";
import jwt from "jsonwebtoken";
import { Room, User } from "../database/models";
import { JWT_SECRET } from "../config/constants";

const router = express.Router();

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

// Room creation limiter - 10 rooms per user per day (business logic limit)
const createRoomLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: 10,
  message: "You have exceeded the 10 rooms created per day limit.",
  keyGenerator: (req: express.Request) => {
    // Use the authenticated user's ID as the key
    return (req as any).user?.id;
  },
  skip: (req: express.Request) => !(req as any).user?.id, // Skip rate limiting if the user is not authenticated
});

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

// POST /api/rooms - create a room
router.post(
  "/",
  authenticateToken, // Apply authentication
  createRoomLimiter, // Apply rate limiter
  body("roomName").isString().trim().notEmpty().withMessage("roomName is required"),
  body("description").optional().isString().trim().isLength({ max: 1000 }),
  body("isPrivate").optional().isBoolean(),
  body("password").optional().isString().isLength({ min: 4, max: 128 }),
  validate,
  async (req, res) => {
    try {
      const { roomName, description = "", isPrivate = false, password } = req.body;
      const userId = (req as any).user?.id || req.body.userId; // fallback for now
      if (!userId) {
        return res.status(401).json({ success: false, message: "Unauthorized" });
      }

      const existing = await Room.findOne({ name: roomName });
      if (existing) {
        return res.status(409).json({ success: false, message: "Room name already exists" });
      }

      const roomId = `room_${Date.now()}`;
      const nowIso = new Date().toISOString();

      const room = new Room({
        userId,
        id: roomId,
        name: roomName,
        description,
        isPrivate,
        password,
        mostUsedLanguage: "JavaScript",
        dateTime: nowIso,
        lastActive: nowIso,
        participants: 1,
        files: [],
        participantList: [],
      });

      await room.save();
      return res.status(201).json({ success: true, data: room });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message || "Failed to create room" });
    }
  }
);

// GET /api/rooms/:id - get room details
router.get(
  "/:id",
  authenticateToken, // Apply authentication
  param("id").isString().trim().notEmpty(),
  validate,
  async (req, res) => {
    try {
      const room = await Room.findOne({ id: req.params.id });
      if (!room) return res.status(404).json({ success: false, message: "Room not found" });
      return res.json({ success: true, data: room });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message || "Failed to fetch room" });
    }
  }
);

// GET /api/users/:userId/rooms - fetch user's rooms
router.get(
  "/users/:userId/rooms",
  authenticateToken, // Apply authentication
  param("userId").isString().trim().notEmpty(),
  validate,
  async (req, res) => {
    try {
      const { userId } = req.params as { userId: string };
      const rooms = await Room.find({ userId });
      return res.json({ success: true, data: rooms });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message || "Failed to fetch user rooms" });
    }
  }
);


// GET /api/rooms/:roomId/users - get participants in a room with status/profile info
router.get(
  "/:roomId/users",
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
      // Get participantList from room
      const participants = room.participantList || [];
      // Fetch user status/profilePicId for each participant
      const userIds = participants.map(p => p.userId);
      const users = await (await import("../database/models")).User.find({ _id: { $in: userIds } });
      // Map userId to status/profilePicId
      const userMap = new Map();
      users.forEach(u => {
        userMap.set(u._id.toString(), {
          status: u.activityStatus || 'offline',
          profilePicId: u.profilePicId || null
        });
      });
      // Compose participant info for frontend
      const result = participants.map(p => ({
        id: p.userId.toString(),
        name: p.name,
        profilePicId: userMap.get(p.userId.toString())?.profilePicId || null,
        status: userMap.get(p.userId.toString())?.status || 'offline',
        role: p.role,
        joinedAt: p.joinedAt
      }));
      return res.json(result);
    } catch (err) {
      const errorMessage = (err as any).message || "Failed to fetch participants";
      return res.status(500).json({ success: false, message: errorMessage });
    }
  }
);

export default router;


