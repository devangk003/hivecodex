import dotenv from "dotenv";
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";
import { GridFSBucket, ObjectId } from "mongodb";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import multer from "multer";
import AdmZip from "adm-zip";
import path from "path";

// Import types
import { 
  ServerToClientEvents, 
  ClientToServerEvents, 
  InterServerEvents, 
  SocketData 
} from "./types/socket";
import { UserStatus } from "./types/user";

// Import utilities and handlers
import { 
  addUser, 
  removeUser, 
  getUserBySocketId, 
  getUsersInRoom, 
  updateUserStatus,
  cleanupInactiveUsers,
  broadcastToRoom 
} from "./utils/userHelpers";
import { initializeSocketHandlers } from "./socket/socketServer";
import { setGridFSBucket, authRoutes } from "./routes/auth";
import aiRoutes from "./routes/ai";
import roomRoutes from "./routes/roomRoutes";
import { User, Room, Message, FileMeta } from "./database/models";
import { JWT_SECRET, MONGO_URI, PORT } from "./config/constants";

// Load environment variables
dotenv.config();

// Create Express app
const app = express();

// Add comprehensive request logging middleware
app.use((req, res, next) => {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();
  
  // Log incoming request
  console.log(`\n🔥 [${timestamp}] ${req.method} ${req.url}`);
  console.log(`📍 IP: ${req.ip}`);
  console.log(`🔑 Headers: ${JSON.stringify(req.headers, null, 2)}`);
  
  if (req.body && Object.keys(req.body).length > 0) {
    console.log(`📦 Body: ${JSON.stringify(req.body, null, 2)}`);
  }
  
  if (req.query && Object.keys(req.query).length > 0) {
    console.log(`❓ Query: ${JSON.stringify(req.query, null, 2)}`);
  }

  // Override res.json to log responses
  const originalJson = res.json;
  res.json = function(body) {
    const duration = Date.now() - startTime;
    console.log(`✅ [${new Date().toISOString()}] ${req.method} ${req.url} - ${res.statusCode} (${duration}ms)`);
    console.log(`📤 Response: ${JSON.stringify(body, null, 2)}`);
    return originalJson.call(this, body);
  };

  // Override res.send to log responses
  const originalSend = res.send;
  res.send = function(body) {
    const duration = Date.now() - startTime;
    console.log(`✅ [${new Date().toISOString()}] ${req.method} ${req.url} - ${res.statusCode} (${duration}ms)`);
    console.log(`📤 Response: ${body}`);
    return originalSend.call(this, body);
  };

  next();
});

// Middleware stack
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:8080";
app.use(cors({
  origin: [FRONTEND_URL],
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  credentials: true,
}));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Global error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  const timestamp = new Date().toISOString();
  const status = err.status || 500;
  res.status(status).json({
    error: true,
    message: err.message || 'Internal Server Error',
    timestamp,
    endpoint: `${req.method} ${req.url}`,
  });
});

// HTTP and Socket.IO setup with proper typing
const server = http.createServer(app);
const io = new Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    credentials: true,
  },
});

// MongoDB connection and GridFS
let gridfsBucket: GridFSBucket;

const dbConnectionPromise = mongoose
  .connect(MONGO_URI, {})
  .then(() => {
    const timestamp = new Date().toISOString();
    console.log(`✅ [${timestamp}] MongoDB connection established`);
    console.log(`📍 Database: ${mongoose.connection.name}`);
    console.log(`🔗 Host: ${mongoose.connection.host}:${mongoose.connection.port}`);
    
    const db = mongoose.connection.db;
    if (db) {
      gridfsBucket = new GridFSBucket(db, { bucketName: "uploads" });
      console.log(`📁 [${timestamp}] GridFS bucket initialized (bucket: uploads)`);
      setGridFSBucket(gridfsBucket);
    } else {
      throw new Error("Database connection not established");
    }
  })
  .catch((err) => {
    const timestamp = new Date().toISOString();
    console.error(`💥 [${timestamp}] Database connection error:`, err);
    console.error(`📍 MONGO_URI: ${MONGO_URI ? "Present" : "Missing"}`);
    throw err;
    process.exit(1);
  });

// Export GridFS bucket for use in other modules
export { gridfsBucket };

// Configure multer for file uploads
const upload = multer();

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/rooms", roomRoutes);

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

// Essential API endpoints that frontend needs

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ 
    status: "OK", 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: "2.0.0-ts"
  });
});

// Debug endpoint to test if routes are working
app.get("/api/test", (req, res) => {
  res.json({ 
    message: "API routes are working", 
    timestamp: new Date().toISOString()
  });
});

// Authentication endpoints (from server.js)
app.post("/api/register", upload.single("profilePic"), async (req, res): Promise<any> => {
  try {
    await dbConnectionPromise;
    const { name, email, password, rememberMe } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ 
        success: false, 
        message: "User with this email already exists",
        timestamp: new Date()
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    let profilePicId = null;

    if (req.file && gridfsBucket) {
      const uploadStream = gridfsBucket.openUploadStream(`profile_${Date.now()}_${req.file.originalname}`, {
        metadata: { mimetype: req.file.mimetype },
      });
      uploadStream.end(req.file.buffer);
      await new Promise((resolve, reject) => {
        uploadStream.on("finish", () => {
          profilePicId = uploadStream.id;
          resolve(uploadStream.id);
        });
        uploadStream.on("error", reject);
      });
    }

    const user = new User({
      name,
      email,
      password: hashedPassword,
      profilePicId,
      rememberMe: rememberMe === "true",
      activityStatus: "online",
    });

    await user.save();

    const token = jwt.sign(
      { id: user._id, email: user.email, name: user.name },
      JWT_SECRET,
      { expiresIn: rememberMe === "true" ? "7d" : "24h" }
    );

    const userData = {
      id: user._id,
      name: user.name,
      email: user.email,
      profilePicId: user.profilePicId,
      activityStatus: user.activityStatus || "offline",
    };

    res.status(201).json({
      token, 
      user: userData, 
      message: "Registration completed successfully"
    });
  } catch (error) {
    console.error("Registration error:", error);
    return res.status(500).json({ 
      success: false,
      message: "Failed to register user. Please try again later.",
      timestamp: new Date()
    });
  }
});

app.post("/api/login", async (req, res): Promise<any> => {
  const timestamp = new Date().toISOString();
  console.log(`\n🔐 [${timestamp}] LOGIN ATTEMPT`);
  console.log(`📧 Email: ${req.body.email}`);
  console.log(`🔄 Remember Me: ${req.body.rememberMe}`);
  
  try {
    await dbConnectionPromise;
    const { email, password, rememberMe } = req.body;

    console.log(`🔍 [${timestamp}] Looking up user with email: ${email}`);
    const user = await User.findOne({ email });
    if (!user) {
      console.log(`❌ [${timestamp}] User not found for email: ${email}`);
      return res.status(401).json({ 
        success: false,
        message: "Invalid email or password",
        timestamp: new Date()
      });
    }

    console.log(`🔑 [${timestamp}] Validating password for user: ${user.name}`);
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.log(`❌ [${timestamp}] Invalid password for user: ${email}`);
      return res.status(401).json({ 
        success: false,
        message: "Invalid email or password",
        timestamp: new Date()
      });
    }

    console.log(`✅ [${timestamp}] Password valid, updating user status`);
    user.rememberMe = rememberMe;
    user.activityStatus = UserStatus.ONLINE;
    await user.save();

    console.log(`🎫 [${timestamp}] Generating JWT token for user: ${user.name}`);
    const token = jwt.sign(
      { id: user._id, email: user.email, name: user.name },
      JWT_SECRET,
      { expiresIn: rememberMe ? "7d" : "24h" }
    );

    const userData = {
      id: user._id,
      name: user.name,
      email: user.email,
      profilePicId: user.profilePicId,
      activityStatus: user.activityStatus || "offline",
    };

    console.log(`🎉 [${timestamp}] Login successful for user: ${user.name}`);
    res.status(200).json({ 
      token, 
      user: userData, 
      message: "Login successful" 
    });
  } catch (error) {
    console.error(`💥 [${timestamp}] Login error:`, error);
    return res.status(500).json({ 
      success: false,
      message: "Failed to log in. Please try again later.",
      timestamp: new Date()
    });
  }
});

// Get current user
app.get("/api/user", authenticateToken, async (req, res): Promise<any> => {
  try {
    await dbConnectionPromise;
    const user = await User.findById((req as any).user.id).select(
      "-password -resetToken -resetTokenExpiry"
    );

    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: "User not found",
        timestamp: new Date()
      });
    }

    res.json({
      id: user._id,
      name: user.name,
      email: user.email,
      profilePicId: user.profilePicId,
      activityStatus: user.activityStatus || "offline",
    });
  } catch (err) {
    console.error("User fetch error:", err);
    return res.status(500).json({ 
      success: false,
      message: "Failed to fetch user data. Please try again later.",
      timestamp: new Date()
    });
  }
});

// Get user's rooms
app.get("/api/user/rooms", authenticateToken, async (req, res) => {
  try {
    await dbConnectionPromise;
    const userIdStr = (req as any).user.id;
    const userObjectId = new mongoose.Types.ObjectId(userIdStr);
    const rooms = await Room.find({
      $or: [
        { userId: userObjectId },
        { 'participantList.userId': userObjectId },
      ],
    })
      .sort({ lastActive: -1 })
      .lean();

    res.json(rooms);
  } catch (err) {
    console.error("User rooms fetch error:", err);
    res.status(500).json({ 
      message: "Failed to fetch user rooms. Please try again later."
    });
  }
});

// Get user activity status
app.get("/api/user/activity-status", authenticateToken, async (req, res) => {
  try {
    await dbConnectionPromise;
    const user = await User.findById((req as any).user.id).select('activityStatus').lean();
    res.json({ 
      success: true,
      data: { activityStatus: user?.activityStatus || 'online' },
      timestamp: new Date()
    });
  } catch (err) {
    console.error("User activity status fetch error:", err);
    res.status(500).json({ 
      success: false,
      message: "Failed to fetch activity status. Please try again later.",
      timestamp: new Date()
    });
  }
});

// Update user activity status
app.put("/api/user/activity-status", authenticateToken, async (req, res): Promise<any> => {
  try {
    await dbConnectionPromise;
    const { activityStatus } = req.body;
    
    if (!activityStatus || typeof activityStatus !== 'string') {
      return res.status(400).json({ 
        success: false,
        message: "Valid activity status is required",
        timestamp: new Date()
      });
    }

    await User.findByIdAndUpdate(
      (req as any).user.id, 
      { activityStatus }, 
      { new: true }
    );
    
    res.json({ 
      success: true,
      data: { activityStatus },
      timestamp: new Date()
    });
  } catch (err) {
    console.error("User activity status update error:", err);
    return res.status(500).json({ 
      success: false,
      message: "Failed to update activity status. Please try again later.",
      timestamp: new Date()
    });
  }
});

// Rooms endpoints
app.get("/api/rooms", authenticateToken, async (req, res) => {
  try {
    await dbConnectionPromise;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 6;
    const skip = (page - 1) * limit;

    const rooms = await Room.find({})
      .sort({ lastActive: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Room.countDocuments();

    res.json({
      success: true,
      data: {
        rooms,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      },
      timestamp: new Date()
    });
  } catch (err) {
    console.error("Rooms fetch error:", err);
    res.status(500).json({ 
      success: false,
      message: "Failed to fetch rooms. Please try again later.",
      timestamp: new Date()
    });
  }
});

app.post("/api/rooms", authenticateToken, async (req, res): Promise<any> => {
  try {
    await dbConnectionPromise;
    const { name, description, isPrivate, password } = req.body;
    
    if (!name) {
      return res.status(400).json({ 
        success: false,
        message: "Room name is required",
        timestamp: new Date()
      });
    }

    const roomId = `room_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const newRoom = new Room({
      userId: (req as any).user.id,
      id: roomId,
      name,
      description: description || "",
      isPrivate: isPrivate || false,
      password: isPrivate && password ? await bcrypt.hash(password, 10) : undefined,
      dateTime: new Date().toISOString(),
      lastActive: new Date().toISOString(),
      participants: 1,
      files: [],
      participantList: [{
        userId: (req as any).user.id,
        name: (req as any).user.name,
        profilePicId: null,
        role: 'owner',
        joinedAt: new Date()
      }],
    });

    await newRoom.save();

    // Remove password from response for security
    const { password: _, ...roomData } = newRoom.toObject();

    res.status(201).json({
      room: roomData,
      message: "Room created successfully"
    });
  } catch (error) {
    console.error("Room creation error:", error);
    return res.status(500).json({ 
      success: false,
      message: "Failed to create room. Please try again later.",
      timestamp: new Date()
    });
  }
});

app.post("/api/rooms/:roomId/join", authenticateToken, async (req, res): Promise<any> => {
  try {
    await dbConnectionPromise;
    const { roomId } = req.params;
    const { password } = req.body;
    
    const room = await Room.findOne({ id: roomId });
    
    if (!room) {
      return res.status(404).json({ message: "Room not found" });
    }

    // Check if room is private and password is required
    if (room.isPrivate && room.password) {
      if (!password) {
        return res.status(400).json({ message: "Password is required to join this private room" });
      }
      
      const isPasswordValid = await bcrypt.compare(password, room.password);
      if (!isPasswordValid) {
        return res.status(401).json({ message: "Incorrect password" });
      }
    }
    
    const user = await User.findById((req as any).user.id).select("name profilePicId");
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    if (!room.participantList.some((p: any) => p.userId.toString() === user._id.toString())) {
      room.participantList.push({
        userId: user._id,
        name: user.name,
        profilePicId: user.profilePicId,
        role: 'member',
        joinedAt: new Date()
      });
      
      room.participants = room.participantList.length;
      await room.save();
    }
    
    // Return room data without password
    const { password: _, ...roomData } = room.toObject();
    res.json({ room: roomData, message: "Successfully joined the room" });
  } catch (error) {
    console.error("Join room error:", error);
    res.status(500).json({ message: "Failed to join room. Please try again later." });
  }
});

app.get("/api/rooms/:roomId", authenticateToken, async (req, res): Promise<any> => {
  try {
    await dbConnectionPromise;
    const { roomId } = req.params;
    const room = await Room.findOne({ id: roomId });
    
    if (!room) {
      return res.status(404).json({ 
        success: false,
        message: "Room not found",
        timestamp: new Date()
      });
    }

    res.json({
      success: true,
      data: room,
      timestamp: new Date()
    });
  } catch (error) {
    console.error("Room fetch error:", error);
    return res.status(500).json({ 
      success: false,
      message: "Failed to fetch room. Please try again later.",
      timestamp: new Date()
    });
  }
});

// Profile endpoints
app.get("/api/profile", authenticateToken, async (req, res): Promise<any> => {
  try {
    await dbConnectionPromise;
    const user = await User.findById((req as any).user.id).select("-password");
    
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: "User not found",
        timestamp: new Date()
      });
    }

    res.json({
      success: true,
      data: user,
      timestamp: new Date()
    });
  } catch (error) {
    console.error("Profile fetch error:", error);
    return res.status(500).json({ 
      success: false,
      message: "Failed to fetch profile. Please try again later.",
      timestamp: new Date()
    });
  }
});

// Update user profile
app.post("/api/profile/update", authenticateToken, upload.single("profilePic"), async (req, res): Promise<any> => {
  console.log("=== Profile update endpoint reached ===");
  console.log("Request body:", req.body);
  console.log("Request file:", req.file);
  console.log("User from token:", (req as any).user);
  
  try {
    await dbConnectionPromise;
    const { name, email } = req.body;
    const userId = (req as any).user.id;

    console.log("User ID from token:", userId);

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: "User not found",
        timestamp: new Date()
      });
    }

    // Check if email is already taken by another user
    if (email && email !== user.email) {
      const existingUser = await User.findOne({ email, _id: { $ne: userId } });
      if (existingUser) {
        return res.status(400).json({ 
          success: false,
          message: "Email is already taken by another user",
          timestamp: new Date()
        });
      }
    }

    // Handle profile picture upload
    let profilePicId = user.profilePicId;
    if (req.file && gridfsBucket) {
      console.log("Processing profile picture upload...");
      
      // Delete old profile picture if it exists
      if (user.profilePicId) {
        try {
          await gridfsBucket.delete(user.profilePicId);
          console.log("Deleted old profile picture");
        } catch (deleteError) {
          console.warn("Could not delete old profile picture:", deleteError);
        }
      }

      // Upload new profile picture
      const uploadStream = gridfsBucket.openUploadStream(`profile_${Date.now()}_${req.file.originalname}`, {
        metadata: { mimetype: req.file.mimetype, userId: userId },
      });
      uploadStream.end(req.file.buffer);
      
      await new Promise((resolve, reject) => {
        uploadStream.on("finish", () => {
          profilePicId = uploadStream.id;
          console.log("Profile picture uploaded with ID:", profilePicId);
          resolve(uploadStream.id);
        });
        uploadStream.on("error", reject);
      });
    }

    // Update user data
    const updateData: any = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (profilePicId !== user.profilePicId) updateData.profilePicId = profilePicId;

    console.log("Updating user with data:", updateData);

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true }
    ).select("-password");

    if (!updatedUser) {
      return res.status(404).json({ 
        success: false,
        message: "User not found after update",
        timestamp: new Date()
      });
    }

    console.log("User updated successfully");

    res.json({
      success: true,
      data: {
        id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        profilePicId: updatedUser.profilePicId,
        activityStatus: updatedUser.activityStatus || "offline"
      },
      message: "Profile updated successfully",
      timestamp: new Date()
    });

  } catch (error) {
    console.error("Profile update error:", error);
    return res.status(500).json({ 
      success: false,
      message: "Failed to update profile. Please try again later.",
      timestamp: new Date()
    });
  }
});

// Basic error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: "Internal server error",
    error: process.env.NODE_ENV === "development" ? err.message : undefined
  });
});

// Socket connection handling
// Initialize Socket.IO handlers
initializeSocketHandlers(io);

// Cleanup inactive users every 30 minutes
setInterval(() => {
  cleanupInactiveUsers(30);
}, 30 * 60 * 1000);

// Start server
const startServer = async () => {
  try {
    const startTime = Date.now();
    const timestamp = new Date().toISOString();
    
    console.log(`\n🚀 [${timestamp}] STARTING HIVECODEX BACKEND SERVER`);
    console.log(`📍 PORT: ${PORT}`);
    console.log(`🌍 NODE_ENV: ${process.env.NODE_ENV || "development"}`);
    console.log(`🔗 MONGO_URI: ${MONGO_URI ? "✅ Configured" : "❌ Missing"}`);
    console.log(`🔑 JWT_SECRET: ${JWT_SECRET ? "✅ Configured" : "❌ Missing"}`);
    
    console.log(`\n💾 [${timestamp}] Connecting to MongoDB...`);
    await dbConnectionPromise;
    console.log(`✅ [${new Date().toISOString()}] MongoDB connected successfully`);
    
    server.listen(PORT, () => {
      const bootTime = Date.now() - startTime;
      const readyTimestamp = new Date().toISOString();
      
      console.log(`\n🎉 [${readyTimestamp}] HIVECODEX BACKEND READY!`);
      console.log(`⚡ Boot time: ${bootTime}ms`);
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📊 Environment: ${process.env.NODE_ENV || "development"}`);
      console.log(`💾 Database: ✅ Connected to MongoDB`);
      console.log(`🔌 Socket.IO: ✅ Ready for connections`);
      console.log(`🌐 Available at: http://localhost:${PORT}`);
      console.log(`\n🔥 Ready to accept requests! 🔥\n`);
    });
  } catch (error) {
    const errorTimestamp = new Date().toISOString();
    console.error(`\n💥 [${errorTimestamp}] FAILED TO START SERVER`);
    console.error(`❌ Error Details:`, error);
    console.error(`📍 Stack Trace:`, error instanceof Error ? error.stack : 'No stack trace');
    process.exit(1);
  }
};

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down gracefully");
  server.close(() => {
    mongoose.connection.close();
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  console.log("SIGINT received, shutting down gracefully");
  server.close(() => {
    mongoose.connection.close();
    process.exit(0);
  });
});

// Missing endpoints that frontend expects
// Get user profile by ID
app.get("/api/users/:userId/profile", authenticateToken, async (req, res): Promise<any> => {
  try {
    await dbConnectionPromise;
    const { userId } = req.params;
    const user = await User.findById(userId).select("-password -resetToken -resetTokenExpiry");
    
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: "User not found",
        timestamp: new Date()
      });
    }

    res.json({
      success: true,
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        profilePicId: user.profilePicId,
        activityStatus: user.activityStatus || "offline"
      },
      timestamp: new Date()
    });
  } catch (error) {
    console.error("User profile fetch error:", error);
    return res.status(500).json({ 
      success: false,
      message: "Failed to fetch user profile. Please try again later.",
      timestamp: new Date()
    });
  }
});

// Get users in a room
app.get("/api/rooms/:roomId/users", authenticateToken, async (req, res): Promise<any> => {
  try {
    await dbConnectionPromise;
    const { roomId } = req.params;
    const room = await Room.findOne({ id: roomId });
    
    if (!room) {
      return res.status(404).json({ 
        success: false,
        message: "Room not found",
        timestamp: new Date()
      });
    }

    // Get participant details with user info
    const participantsWithUserInfo = await Promise.all(
      room.participantList.map(async (participant) => {
        const user = await User.findById(participant.userId).select("name email profilePicId activityStatus lastSeen");
        return {
          userId: user ? {
            _id: user._id,
            name: user.name,
            email: user.email,
            profilePicId: user.profilePicId,
            activityStatus: user.activityStatus || "offline",
            lastSeen: user.lastSeen
          } : {
            _id: participant.userId,
            name: participant.name || "Unknown User",
            email: null,
            profilePicId: participant.profilePicId,
            activityStatus: "offline",
            lastSeen: new Date()
          },
          role: participant.role,
          joinedAt: participant.joinedAt
        };
      })
    );

    res.json({
      success: true,
      data: participantsWithUserInfo,
      timestamp: new Date()
    });
  } catch (error) {
    console.error("Room users fetch error:", error);
    return res.status(500).json({ 
      success: false,
      message: "Failed to fetch room users. Please try again later.",
      timestamp: new Date()
    });
  }
});

// Update user status
app.put("/api/user/status", authenticateToken, async (req, res): Promise<any> => {
  try {
    await dbConnectionPromise;
    const { status, roomId } = req.body;
    
    if (!status || typeof status !== 'string') {
      return res.status(400).json({ 
        success: false,
        message: "Valid status is required",
        timestamp: new Date()
      });
    }

    await User.findByIdAndUpdate(
      (req as any).user.id, 
      { activityStatus: status }, 
      { new: true }
    );
    
    res.json({ 
      success: true,
      data: { status, roomId },
      timestamp: new Date()
    });
  } catch (err) {
    console.error("User status update error:", err);
    return res.status(500).json({ 
      success: false,
      message: "Failed to update user status. Please try again later.",
      timestamp: new Date()
    });
  }
});

// Leave room endpoint
app.post("/api/rooms/:roomId/leave", authenticateToken, async (req, res): Promise<any> => {
  try {
    await dbConnectionPromise;
    const { roomId } = req.params;
    const userId = (req as any).user.id;
    
    const room = await Room.findOne({ id: roomId });
    if (!room) {
      return res.status(404).json({ 
        success: false,
        message: "Room not found",
        timestamp: new Date()
      });
    }

    // Remove user from participants
    room.participantList = room.participantList.filter(
      p => p.userId.toString() !== userId
    );
    
    room.participants = Math.max(0, room.participants - 1);
    await room.save();

    res.json({
      success: true,
      message: "Left room successfully",
      timestamp: new Date()
    });
  } catch (error) {
    console.error("Leave room error:", error);
    return res.status(500).json({ 
      success: false,
      message: "Failed to leave room. Please try again later.",
      timestamp: new Date()
    });
  }
});

// User Management Endpoints

// Kick user from room
app.post("/api/rooms/:roomId/users/:userId/kick", authenticateToken, async (req, res): Promise<any> => {
  try {
    await dbConnectionPromise;
    const { roomId, userId } = req.params;
    const requesterId = (req as any).user.id;

    const room = await Room.findOne({ id: roomId });
    if (!room) {
      return res.status(404).json({ 
        success: false,
        message: "Room not found",
        timestamp: new Date()
      });
    }

    // Check if requester has permission (owner or admin)
    const requesterParticipant = room.participantList.find(p => p.userId.toString() === requesterId);
    if (!requesterParticipant || !['owner', 'admin'].includes(requesterParticipant.role)) {
      return res.status(403).json({ 
        success: false,
        message: "Insufficient permissions to kick users",
        timestamp: new Date()
      });
    }

    // Remove user from participants
    const targetParticipant = room.participantList.find(p => p.userId.toString() === userId);
    if (!targetParticipant) {
      return res.status(404).json({ 
        success: false,
        message: "User not found in room",
        timestamp: new Date()
      });
    }

    // Can't kick the owner
    if (targetParticipant.role === 'owner') {
      return res.status(403).json({ 
        success: false,
        message: "Cannot kick room owner",
        timestamp: new Date()
      });
    }

    room.participantList = room.participantList.filter(p => p.userId.toString() !== userId);
    room.participants = Math.max(0, room.participants - 1);
    await room.save();

    res.json({
      success: true,
      message: "User kicked successfully",
      timestamp: new Date()
    });
  } catch (error) {
    console.error("Kick user error:", error);
    return res.status(500).json({ 
      success: false,
      message: "Failed to kick user. Please try again later.",
      timestamp: new Date()
    });
  }
});

// Update user role in room
app.put("/api/rooms/:roomId/users/:userId/role", authenticateToken, async (req, res): Promise<any> => {
  try {
    await dbConnectionPromise;
    const { roomId, userId } = req.params;
    const { role } = req.body;
    const requesterId = (req as any).user.id;

    if (!['admin', 'member', 'viewer'].includes(role)) {
      return res.status(400).json({ 
        success: false,
        message: "Invalid role. Must be admin, member, or viewer",
        timestamp: new Date()
      });
    }

    const room = await Room.findOne({ id: roomId });
    if (!room) {
      return res.status(404).json({ 
        success: false,
        message: "Room not found",
        timestamp: new Date()
      });
    }

    // Check if requester has permission (owner)
    const requesterParticipant = room.participantList.find(p => p.userId.toString() === requesterId);
    if (!requesterParticipant || requesterParticipant.role !== 'owner') {
      return res.status(403).json({ 
        success: false,
        message: "Only room owner can change user roles",
        timestamp: new Date()
      });
    }

    // Find and update user role
    const targetParticipant = room.participantList.find(p => p.userId.toString() === userId);
    if (!targetParticipant) {
      return res.status(404).json({ 
        success: false,
        message: "User not found in room",
        timestamp: new Date()
      });
    }

    // Can't change owner role
    if (targetParticipant.role === 'owner') {
      return res.status(403).json({ 
        success: false,
        message: "Cannot change owner role",
        timestamp: new Date()
      });
    }

    targetParticipant.role = role;
    await room.save();

    res.json({
      success: true,
      message: "User role updated successfully",
      data: { userId, role },
      timestamp: new Date()
    });
  } catch (error) {
    console.error("Update user role error:", error);
    return res.status(500).json({ 
      success: false,
      message: "Failed to update user role. Please try again later.",
      timestamp: new Date()
    });
  }
});

// Invite user to room
app.post("/api/rooms/:roomId/invite", authenticateToken, async (req, res): Promise<any> => {
  try {
    await dbConnectionPromise;
    const { roomId } = req.params;
    const { email } = req.body;
    const requesterId = (req as any).user.id;

    if (!email) {
      return res.status(400).json({ 
        success: false,
        message: "Email is required",
        timestamp: new Date()
      });
    }

    const room = await Room.findOne({ id: roomId });
    if (!room) {
      return res.status(404).json({ 
        success: false,
        message: "Room not found",
        timestamp: new Date()
      });
    }

    // Check if requester is in the room
    const requesterParticipant = room.participantList.find(p => p.userId.toString() === requesterId);
    if (!requesterParticipant) {
      return res.status(403).json({ 
        success: false,
        message: "You must be a room member to invite users",
        timestamp: new Date()
      });
    }

    // Find user by email
    const targetUser = await User.findOne({ email });
    if (!targetUser) {
      return res.status(404).json({ 
        success: false,
        message: "User not found",
        timestamp: new Date()
      });
    }

    // Check if user is already in room
    const existingParticipant = room.participantList.find(p => p.userId.toString() === targetUser._id.toString());
    if (existingParticipant) {
      return res.status(400).json({ 
        success: false,
        message: "User is already in the room",
        timestamp: new Date()
      });
    }

    // Add user to room
    room.participantList.push({
      userId: targetUser._id,
      name: targetUser.name,
      profilePicId: targetUser.profilePicId,
      role: 'member',
      joinedAt: new Date()
    });
    room.participants += 1;
    await room.save();

    res.json({
      success: true,
      message: "User invited successfully",
      data: {
        userId: targetUser._id,
        name: targetUser.name,
        email: targetUser.email
      },
      timestamp: new Date()
    });
  } catch (error) {
    console.error("Invite user error:", error);
    return res.status(500).json({ 
      success: false,
      message: "Failed to invite user. Please try again later.",
      timestamp: new Date()
    });
  }
});

// Fix file download endpoint to match frontend expectation
app.get("/api/files/:fileId/download", async (req, res) => {
  try {
    await dbConnectionPromise;
    const { fileId } = req.params;
    const downloadStream = gridfsBucket.openDownloadStream(
      new ObjectId(fileId),
    );

    downloadStream.on("error", () => {
      res.status(404).json({ message: "File not found in storage" });
    });

    downloadStream.pipe(res);
  } catch (error) {
    console.error("File download error:", error);
    res
      .status(500)
      .json({ message: "Failed to download file. Please try again later." });
  }
});

// Profile picture endpoint for consistent frontend access
app.get("/api/profile/picture/:pictureId", async (req, res): Promise<any> => {
  try {
    await dbConnectionPromise;
    const { pictureId } = req.params;
    
    if (!gridfsBucket) {
      return res.status(500).json({ message: "File storage not available" });
    }
    
    const downloadStream = gridfsBucket.openDownloadStream(
      new ObjectId(pictureId),
    );

    downloadStream.on("error", () => {
      return res.status(404).json({ message: "Profile picture not found" });
    });

    // Set proper headers for images
    downloadStream.on("file", (file) => {
      res.set("Content-Type", file.metadata?.mimetype || "image/jpeg");
      res.set("Cache-Control", "public, max-age=31536000"); // 1 year cache
    });

    downloadStream.pipe(res);
    return; // Explicit return for the success path
  } catch (error) {
    console.error("Profile picture download error:", error);
    return res.status(500).json({ message: "Failed to load profile picture" });
  }
});

// Alternative endpoint for backward compatibility
app.get("/api/files/:fileId", async (req, res): Promise<any> => {
  try {
    await dbConnectionPromise;
    const { fileId } = req.params;
    
    if (!gridfsBucket) {
      return res.status(500).json({ message: "File storage not available" });
    }
    
    const downloadStream = gridfsBucket.openDownloadStream(
      new ObjectId(fileId),
    );

    downloadStream.on("error", () => {
      return res.status(404).json({ message: "File not found" });
    });

    // Set proper headers for images
    downloadStream.on("file", (file) => {
      res.set("Content-Type", file.metadata?.mimetype || "application/octet-stream");
      res.set("Cache-Control", "public, max-age=31536000"); // 1 year cache
    });

    downloadStream.pipe(res);
    return; // Explicit return for the success path
  } catch (error) {
    console.error("File download error:", error);
    return res.status(500).json({ message: "Failed to load file" });
  }
});

// Get file content for editing
app.get("/api/files/:fileId/content", authenticateToken, async (req, res): Promise<any> => {
  const timestamp = new Date().toISOString();
  console.log(`\n📄 [${timestamp}] FILE CONTENT REQUEST`);
  console.log(`📁 File ID: ${req.params.fileId}`);
  console.log(`👤 User: ${(req as any).user?.name} (ID: ${(req as any).user?.id})`);
  
  try {
    await dbConnectionPromise;
    const { fileId } = req.params;

    if (!gridfsBucket) {
      console.log(`❌ [${timestamp}] GridFS bucket not initialized`);
      return res.status(500).json({ 
        success: false,
        message: "File storage not available" 
      });
    }

    console.log(`🔍 [${timestamp}] Looking up file in GridFS: ${fileId}`);
    
    // Check if file exists
    const files = await gridfsBucket.find({ _id: new ObjectId(fileId) }).toArray();
    if (!files || files.length === 0) {
      console.log(`❌ [${timestamp}] File not found in GridFS: ${fileId}`);
      return res.status(404).json({ 
        success: false,
        message: "File not found" 
      });
    }

    const file = files[0];
    console.log(`✅ [${timestamp}] File found: ${file.filename} (${file.length} bytes)`);

    // Create download stream
    const downloadStream = gridfsBucket.openDownloadStream(new ObjectId(fileId));
    
    let content = '';
    
    downloadStream.on('data', (chunk) => {
      content += chunk.toString();
    });

    downloadStream.on('end', () => {
      console.log(`✅ [${timestamp}] File content loaded successfully (${content.length} characters)`);
      res.json({
        success: true,
        content: content,
        filename: file.filename,
        size: file.length,
        uploadDate: file.uploadDate
      });
    });

    downloadStream.on('error', (error) => {
      console.error(`💥 [${timestamp}] Error reading file content:`, error);
      res.status(500).json({ 
        success: false,
        message: "Failed to read file content" 
      });
    });

  } catch (error) {
    console.error(`💥 [${timestamp}] File content error:`, error);
    res.status(500).json({ 
      success: false,
      message: "Failed to get file content" 
    });
  }
});

// Update file content
app.put("/api/files/:fileId/content", authenticateToken, async (req, res): Promise<any> => {
  const timestamp = new Date().toISOString();
  console.log(`\n📝 [${timestamp}] FILE CONTENT UPDATE REQUEST`);
  console.log(`📁 File ID: ${req.params.fileId}`);
  console.log(`👤 User: ${(req as any).user?.name} (ID: ${(req as any).user?.id})`);
  console.log(`📄 Content length: ${req.body.content ? req.body.content.length : 0} characters`);
  
  try {
    await dbConnectionPromise;
    const { fileId } = req.params;
    const { content } = req.body;

    if (!gridfsBucket) {
      console.log(`❌ [${timestamp}] GridFS bucket not initialized`);
      return res.status(500).json({ 
        success: false,
        message: "File storage not available" 
      });
    }

    // Check if file exists
    const files = await gridfsBucket.find({ _id: new ObjectId(fileId) }).toArray();
    if (!files || files.length === 0) {
      console.log(`❌ [${timestamp}] File not found in GridFS: ${fileId}`);
      return res.status(404).json({ 
        success: false,
        message: "File not found" 
      });
    }

    const originalFile = files[0];
    console.log(`🔍 [${timestamp}] Updating file: ${originalFile.filename}`);

    // Record version history before replacing the file
    try {
      const userId = (req as any).user?.id;
      await FileMeta.updateOne(
        { currentFileId: new ObjectId(fileId) },
        {
          $setOnInsert: { currentFileId: new ObjectId(fileId) },
          $push: {
            history: {
              timestamp: new Date(),
              userId: new ObjectId(userId),
              previousFileId: new ObjectId(fileId),
            },
          },
        },
        { upsert: true }
      );
    } catch (historyErr) {
      console.warn(`⚠️ [${timestamp}] Failed to write file version history:`, historyErr);
    }

    // Delete the old file
    await gridfsBucket.delete(new ObjectId(fileId));
    console.log(`🗑️ [${timestamp}] Old file deleted`);

    // Upload the updated content as a new file with the same filename
    const uploadStream = gridfsBucket.openUploadStream(originalFile.filename, {
      metadata: { ...originalFile.metadata, updatedAt: new Date() }
    });

    uploadStream.end(Buffer.from(content, 'utf8'));

    uploadStream.on('finish', async () => {
      const newFileId = uploadStream.id;
      console.log(`✅ [${timestamp}] File updated with new ID: ${newFileId}`);

      // Update room files array with new file ID (if needed)
      try {
        await Room.updateMany(
          { "files.fileId": new ObjectId(fileId) },
          { $set: { "files.$.fileId": newFileId } }
        );
        console.log(`✅ [${timestamp}] Room file references updated`);
      } catch (updateError) {
        console.warn(`⚠️ [${timestamp}] Could not update room file references:`, updateError);
      }

      // Update FileMeta current pointer to the new GridFS file id
      try {
        await FileMeta.updateOne(
          { currentFileId: new ObjectId(fileId) },
          { $set: { currentFileId: newFileId } }
        );
      } catch (metaErr) {
        console.warn(`⚠️ [${timestamp}] Failed to update FileMeta currentFileId:`, metaErr);
      }

      res.json({
        success: true,
        fileId: newFileId.toString(),
        message: "File content updated successfully"
      });
    });

    uploadStream.on('error', (error) => {
      console.error(`💥 [${timestamp}] Error updating file content:`, error);
      res.status(500).json({ 
        success: false,
        message: "Failed to update file content" 
      });
    });

  } catch (error) {
    console.error(`💥 [${timestamp}] File update error:`, error);
    res.status(500).json({ 
      success: false,
      message: "Failed to update file content" 
    });
  }
});

// Get room messages
app.get("/api/rooms/:roomId/messages", authenticateToken, async (req, res): Promise<any> => {
  const timestamp = new Date().toISOString();
  console.log(`\n💬 [${timestamp}] GET MESSAGES REQUEST`);
  console.log(`🏠 Room ID: ${req.params.roomId}`);
  console.log(`👤 User: ${(req as any).user?.name} (ID: ${(req as any).user?.id})`);
  
  try {
    await dbConnectionPromise;
    const { roomId } = req.params;
    const userId = (req as any).user.id;

    console.log(`🔍 [${timestamp}] Looking up room: ${roomId}`);

    // Check if user is part of the room
    const room = await Room.findOne({ id: roomId });
    if (!room) {
      console.log(`❌ [${timestamp}] Room not found: ${roomId}`);
      return res.status(404).json({ message: "Room not found" });
    }

    console.log(`✅ [${timestamp}] Room found, checking participant status`);
    const isParticipant = room.participantList.some((p: any) => p.userId.toString() === userId);
    if (!isParticipant) {
      console.log(`❌ [${timestamp}] User not a participant of room: ${userId}`);
      return res.status(403).json({ message: "Not a participant of this room" });
    }

    console.log(`📚 [${timestamp}] Fetching messages from database`);
    // Get messages for the room
    const messages = await Message.find({ roomId: room._id })
      .sort({ timestamp: 1 })
      .lean();

    console.log(`✅ [${timestamp}] Found ${messages.length} messages`);

    // Get user profile pictures for all message senders
    const senderIds = [...new Set(messages.map((msg: any) => msg.senderId.toString()))];
    const users = await User.find({ _id: { $in: senderIds } }).select("_id profilePicId").lean();
    const userProfilePics = users.reduce((acc: any, user: any) => {
      acc[user._id.toString()] = user.profilePicId?.toString() || null;
      return acc;
    }, {});

    // Format messages for response
    const formattedMessages = messages.map((msg: any) => ({
      id: msg._id.toString(),
      sender: msg.senderName,
      senderId: msg.senderId.toString(),
      text: msg.content,
      timestamp: msg.timestamp.toISOString(),
      profilePicId: userProfilePics[msg.senderId.toString()] || null,
      reactions: msg.reactions || []
    }));

    console.log(`✅ [${timestamp}] Messages fetched successfully`);
    res.json(formattedMessages);
  } catch (error) {
    console.error(`💥 [${timestamp}] Get messages error:`, error);
    res.status(500).json({ message: "Failed to retrieve messages. Please try again later." });
  }
});

// Post message to room
app.post("/api/rooms/:roomId/messages", authenticateToken, async (req, res): Promise<any> => {
  const timestamp = new Date().toISOString();
  console.log(`\n💬 [${timestamp}] POST MESSAGE REQUEST`);
  console.log(`🏠 Room ID: ${req.params.roomId}`);
  console.log(`👤 User: ${(req as any).user?.name} (ID: ${(req as any).user?.id})`);
  console.log(`📝 Message: ${req.body.message}`);
  
  try {
    await dbConnectionPromise;
    const { roomId } = req.params;
    const { message } = req.body;
    const userId = (req as any).user.id;
    const userName = (req as any).user.name;

    console.log(`🔍 [${timestamp}] Looking up room: ${roomId}`);

    // Check if user is part of the room
    const room = await Room.findOne({ id: roomId });
    if (!room) {
      console.log(`❌ [${timestamp}] Room not found: ${roomId}`);
      return res.status(404).json({ message: "Room not found" });
    }

    console.log(`✅ [${timestamp}] Room found, checking participant status`);
    const isParticipant = room.participantList.some((p: any) => p.userId.toString() === userId);
    if (!isParticipant) {
      console.log(`❌ [${timestamp}] User not a participant of room: ${userId}`);
      return res.status(403).json({ message: "Not a participant of this room" });
    }

    console.log(`💾 [${timestamp}] Creating message document`);
    
    // Get user info including profile picture
    const user = await User.findById(userId).select("profilePicId");
    
    // Create and save message
    const newMessage = new Message({
      roomId: room._id,
      senderId: userId,
      senderName: userName,
      content: message,
      timestamp: new Date(),
      messageType: "text",
      isEdited: false
    });

    await newMessage.save();
    console.log(`✅ [${timestamp}] Message saved with ID: ${newMessage._id}`);

    // Format message for response
    const formattedMessage = {
      id: newMessage._id.toString(),
      sender: newMessage.senderName,
      senderId: newMessage.senderId.toString(),
      text: newMessage.content,
      timestamp: newMessage.timestamp.toISOString(),
      profilePicId: user?.profilePicId?.toString() || null,
      reactions: [],
      roomId
    } as any;

    // Broadcast to other users in the room for real-time updates
    console.log(`📡 [${timestamp}] Broadcasting message to room: ${roomId}`);
    (io as any).to(roomId).emit("message", formattedMessage);
  // Also broadcast a chat-updated event so all clients (including sender) refetch from DB
  ;(io as any).to(roomId).emit("chat-updated", { roomId, timestamp: new Date().toISOString() });

    console.log(`✅ [${timestamp}] Message posted successfully`);
    res.status(201).json(formattedMessage);
  } catch (error) {
    console.error(`💥 [${timestamp}] Post message error:`, error);
    res.status(500).json({ message: "Failed to post message. Please try again later." });
  }
});

// Add reaction to message
app.post("/api/messages/:messageId/reactions", authenticateToken, async (req, res): Promise<any> => {
  const timestamp = new Date().toISOString();
  console.log(`\n😀 [${timestamp}] ADD REACTION REQUEST`);
  console.log(`📝 Message ID: ${req.params.messageId}`);
  console.log(`👤 User: ${(req as any).user?.name} (ID: ${(req as any).user?.id})`);
  console.log(`😄 Emoji: ${req.body.emoji}`);
  
  try {
    await dbConnectionPromise;
    const { messageId } = req.params;
    const { emoji } = req.body;
    const userId = (req as any).user.id;

    console.log(`🔍 [${timestamp}] Looking up message: ${messageId}`);

    // Find the message
    const message = await Message.findById(messageId);
    if (!message) {
      console.log(`❌ [${timestamp}] Message not found: ${messageId}`);
      return res.status(404).json({ message: "Message not found" });
    }

    console.log(`✅ [${timestamp}] Message found, checking existing reactions`);
    
    // Check if user already reacted with this emoji
    const existingReaction = message.reactions?.find(
      (r: any) => r.userId.toString() === userId && r.emoji === emoji
    );

    if (existingReaction) {
      console.log(`⚠️ [${timestamp}] User already reacted with this emoji`);
      return res.status(400).json({ message: "You have already reacted with this emoji" });
    }

    console.log(`➕ [${timestamp}] Adding reaction`);
    
    // Add reaction
    if (!message.reactions) {
      message.reactions = [];
    }
    
    message.reactions.push({
      userId: userId,
      emoji: emoji,
      timestamp: new Date()
    });

    await message.save();
    console.log(`✅ [${timestamp}] Reaction added successfully`);
    
    // Return the updated reactions
    const formattedReactions = message.reactions?.map((r: any) => ({
      emoji: r.emoji,
      userId: r.userId.toString(),
      timestamp: r.timestamp.toISOString()
    })) || [];
    
    // Find the room this message belongs to for socket broadcasting
    const messageRoom = await Room.findById(message.roomId);
    if (messageRoom) {
      console.log(`📡 [${timestamp}] Broadcasting reaction update to room: ${messageRoom.id}`);
      // Broadcast reaction update to all users in the room
      (io as any).to(messageRoom.id).emit("reactionUpdate", {
        messageId: messageId,
        reactions: formattedReactions
      });
    }
    
    res.status(201).json({ 
      message: "Reaction added successfully",
      reactions: formattedReactions
    });
  } catch (error) {
    console.error(`💥 [${timestamp}] Add reaction error:`, error);
    res.status(500).json({ message: "Failed to add reaction. Please try again later." });
  }
});

// Remove reaction from message
app.delete("/api/messages/:messageId/reactions", authenticateToken, async (req, res): Promise<any> => {
  const timestamp = new Date().toISOString();
  console.log(`\n😞 [${timestamp}] REMOVE REACTION REQUEST`);
  console.log(`📝 Message ID: ${req.params.messageId}`);
  console.log(`👤 User: ${(req as any).user?.name} (ID: ${(req as any).user?.id})`);
  console.log(`😄 Emoji: ${req.body.emoji}`);
  
  try {
    await dbConnectionPromise;
    const { messageId } = req.params;
    const { emoji } = req.body;
    const userId = (req as any).user.id;

    console.log(`🔍 [${timestamp}] Looking up message: ${messageId}`);

    // Find the message
    const message = await Message.findById(messageId);
    if (!message) {
      console.log(`❌ [${timestamp}] Message not found: ${messageId}`);
      return res.status(404).json({ message: "Message not found" });
    }

    console.log(`✅ [${timestamp}] Message found, looking for reaction to remove`);
    
    // Find and remove the reaction
    const reactionIndex = message.reactions?.findIndex(
      (r: any) => r.userId.toString() === userId && r.emoji === emoji
    );

    if (reactionIndex === -1 || reactionIndex === undefined) {
      console.log(`❌ [${timestamp}] Reaction not found`);
      return res.status(404).json({ message: "Reaction not found" });
    }

    console.log(`➖ [${timestamp}] Removing reaction`);
    
    message.reactions?.splice(reactionIndex, 1);
    await message.save();
    
    // Return the updated reactions
    const formattedReactions = message.reactions?.map((r: any) => ({
      emoji: r.emoji,
      userId: r.userId.toString(),
      timestamp: r.timestamp.toISOString()
    })) || [];
    
    // Find the room this message belongs to for socket broadcasting
    const messageRoom = await Room.findById(message.roomId);
    if (messageRoom) {
      console.log(`📡 [${timestamp}] Broadcasting reaction removal to room: ${messageRoom.id}`);
      // Broadcast reaction update to all users in the room
      (io as any).to(messageRoom.id).emit("reactionUpdate", {
        messageId: messageId,
        reactions: formattedReactions
      });
    }
    
    console.log(`✅ [${timestamp}] Reaction removed successfully`);
    res.json({ 
      message: "Reaction removed successfully",
      reactions: formattedReactions
    });
  } catch (error) {
    console.error(`💥 [${timestamp}] Remove reaction error:`, error);
    res.status(500).json({ message: "Failed to remove reaction. Please try again later." });
  }
});

// Get room files
app.get("/api/rooms/:roomId/files", authenticateToken, async (req, res): Promise<any> => {
  try {
    await dbConnectionPromise;
    const { roomId } = req.params;
    
    const room = await Room.findOne({ id: roomId });
    if (!room) {
      return res.status(404).json({ message: "Room not found" });
    }
    
    const roomFiles = room.files || [];
    res.json(roomFiles);
  } catch (error) {
    console.error("Get room files error:", error);
    res.status(500).json({ message: "Failed to get room files" });
  }
});

// Create empty file in room
app.post("/api/rooms/:roomId/create-file", authenticateToken, async (req, res): Promise<any> => {
  try {
    await dbConnectionPromise;
    const { roomId } = req.params;
    const { name, parentId } = req.body as { name: string; parentId?: string | null };

    const room = await Room.findOne({ id: roomId });
    if (!room) return res.status(404).json({ message: "Room not found" });

    if (!gridfsBucket) return res.status(500).json({ message: "File storage not available" });

    // Create empty GridFS file
    const uploadStream = gridfsBucket.openUploadStream(name, {
      metadata: { roomId, createdAt: new Date(), empty: true }
    });
    uploadStream.end(Buffer.from(""));

    uploadStream.on('finish', async () => {
      const fileId = uploadStream.id;
      const fileEntry: any = {
        fileId,
        name,
        ext: path.extname(name),
        read: false,
        type: "file",
        size: 0,
        lastModified: new Date(),
        createdAt: new Date(),
        parentId: parentId ? new mongoose.Types.ObjectId(parentId) : null,
        path: `/${name}`,
      };
      room.files = room.files || [];
      room.files.push(fileEntry);
      await room.save();
      return res.status(201).json({ success: true, file: fileEntry });
    });

    uploadStream.on('error', (err) => {
      return res.status(500).json({ message: 'Failed to create file', error: String(err) });
    });
  } catch (error) {
    console.error('Create file error:', error);
    return res.status(500).json({ message: 'Failed to create file' });
  }
});

// Create folder in room
app.post("/api/rooms/:roomId/create-folder", authenticateToken, async (req, res): Promise<any> => {
  try {
    await dbConnectionPromise;
    const { roomId } = req.params;
    const { name, parentId } = req.body as { name: string; parentId?: string | null };

    const room = await Room.findOne({ id: roomId });
    if (!room) return res.status(404).json({ message: "Room not found" });

    const folderEntry: any = {
      name,
      type: "folder",
      parentId: parentId ? new mongoose.Types.ObjectId(parentId) : null,
      lastModified: new Date(),
      createdAt: new Date(),
      size: 0,
    };
    room.files = room.files || [];
    room.files.push(folderEntry);
    await room.save();
    // Return the newly added folder (last element) so client gets the generated _id
    const created = room.files[room.files.length - 1];
    return res.status(201).json({ success: true, folder: created });
  } catch (error) {
    console.error('Create folder error:', error);
    return res.status(500).json({ message: 'Failed to create folder' });
  }
});

// Move file or folder (change parent)
app.patch("/api/rooms/:roomId/move", authenticateToken, async (req, res): Promise<any> => {
  try {
    await dbConnectionPromise;
    const { roomId } = req.params;
    const { fileId, newParentId } = req.body as { fileId: string; newParentId?: string | null };

    const room = await Room.findOne({ id: roomId });
    if (!room) return res.status(404).json({ message: "Room not found" });

    const parentObjectId = newParentId ? new mongoose.Types.ObjectId(newParentId) : null;

    // Find target by either subdoc _id (folders) or fileId (files)
    let updated = false;
    room.files = (room.files || []).map((entry: any) => {
      const isFolderMatch = entry._id && entry._id.toString() === fileId;
      const isFileMatch = entry.fileId && entry.fileId.toString() === fileId;
      if (isFolderMatch || isFileMatch) {
        updated = true;
        return { ...entry, parentId: parentObjectId };
      }
      return entry;
    });

    if (!updated) return res.status(404).json({ message: 'File or folder not found' });
    await room.save();
    return res.json({ success: true });
  } catch (error) {
    console.error('Move file/folder error:', error);
    return res.status(500).json({ message: 'Failed to move file or folder' });
  }
});

// Bulk operations (delete)
app.patch("/api/rooms/:roomId/files", authenticateToken, async (req, res): Promise<any> => {
  try {
    await dbConnectionPromise;
    const { roomId } = req.params;
    const { operation, fileIds } = req.body as { operation: string; fileIds: string[] };

    if (operation !== 'delete') return res.status(400).json({ message: 'Unsupported operation' });

    const room = await Room.findOne({ id: roomId });
    if (!room) return res.status(404).json({ message: 'Room not found' });

    const idsToDelete = new Set(fileIds);
    // Remove entries matching either subdoc _id or fileId
    const remaining = (room.files || []).filter((entry: any) => {
      const match = idsToDelete.has(entry._id?.toString?.()) || idsToDelete.has(entry.fileId?.toString?.());
      return !match;
    });

    // Delete GridFS files for matched fileIds
    for (const entry of room.files || []) {
      const fileIdValue = entry.fileId ? entry.fileId.toString() : undefined;
      const match = fileIdValue ? idsToDelete.has(fileIdValue) : false;
      if (match && entry.fileId && gridfsBucket) {
        try { await gridfsBucket.delete(new ObjectId(fileIdValue)); } catch {}
      }
    }

    room.files = remaining as any;
    await room.save();
    return res.json({ success: true });
  } catch (error) {
    console.error('Bulk operation error:', error);
    return res.status(500).json({ message: 'Failed to process bulk operation' });
  }
});

// Upload file to room
app.post("/api/rooms/:roomId/files", authenticateToken, upload.single("file"), async (req, res): Promise<any> => {
  const timestamp = new Date().toISOString();
  console.log(`\n📁 [${timestamp}] FILE UPLOAD REQUEST`);
  console.log(`🏠 Room ID: ${req.params.roomId}`);
  console.log(`📄 File: ${req.file ? req.file.originalname : 'No file'}`);
  console.log(`👤 User: ${(req as any).user?.name} (ID: ${(req as any).user?.id})`);
  
  try {
    await dbConnectionPromise;
    const { roomId } = req.params;
    const userId = (req as any).user.id;
    
    if (!req.file) {
      console.log(`❌ [${timestamp}] No file provided in request`);
      return res.status(400).json({ 
        success: false,
        message: "No file provided" 
      });
    }

    console.log(`🔍 [${timestamp}] Looking up room: ${roomId}`);
    const room = await Room.findOne({ id: roomId });
    if (!room) {
      console.log(`❌ [${timestamp}] Room not found: ${roomId}`);
      return res.status(404).json({ 
        success: false,
        message: "Room not found" 
      });
    }

    console.log(`📁 [${timestamp}] Uploading file to GridFS...`);
    if (!gridfsBucket) {
      console.log(`❌ [${timestamp}] GridFS bucket not initialized`);
      return res.status(500).json({ 
        success: false,
        message: "File storage not available" 
      });
    }

    // Upload file to GridFS
    const uploadStream = gridfsBucket.openUploadStream(req.file.originalname, {
      metadata: { roomId, userId, uploadedAt: new Date() }
    });

    uploadStream.end(req.file.buffer);

    uploadStream.on('finish', async () => {
      const fileId = uploadStream.id;
      console.log(`✅ [${new Date().toISOString()}] File uploaded to GridFS with ID: ${fileId}`);

      try {
        // Add file reference to room
        const fileData = {
          fileId: uploadStream.id as any, // GridFS ObjectId compatible with mongoose ObjectId
          name: req.file!.originalname,
          ext: path.extname(req.file!.originalname),
          read: false,
          type: "file" as const,
          size: req.file!.size,
          lastModified: new Date(),
          createdAt: new Date(),
          path: `/${req.file!.originalname}`
        };

        if (!room.files) {
          room.files = [];
        }
        room.files.push(fileData);
        await room.save();

        console.log(`✅ [${new Date().toISOString()}] File reference added to room`);
        res.status(201).json({
          success: true,
          file: {
            id: fileId.toString(),
            name: req.file!.originalname,
            size: req.file!.size,
            type: req.file!.mimetype,
            uploadedAt: new Date()
          },
          message: "File uploaded successfully"
        });
      } catch (error) {
        console.error(`💥 [${new Date().toISOString()}] Error saving file reference:`, error);
        res.status(500).json({ 
          success: false,
          message: "Failed to save file reference" 
        });
      }
    });

    uploadStream.on('error', (error) => {
      console.error(`💥 [${new Date().toISOString()}] GridFS upload error:`, error);
      res.status(500).json({ 
        success: false,
        message: "Failed to upload file" 
      });
    });

  } catch (error) {
    console.error(`💥 [${timestamp}] File upload error:`, error);
    res.status(500).json({ 
      success: false,
      message: "Failed to upload file" 
    });
  }
});

// Start the server
startServer();

export { app, io, authenticateToken };
