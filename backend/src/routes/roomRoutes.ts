import express from "express";
import { body, param, validationResult } from "express-validator";
import { Room, User } from "../database/models";

const router = express.Router();

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

export default router;


