import dotenv from "dotenv";
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";
import { GridFSBucket } from "mongodb";

// Import types
import { 
  ServerToClientEvents, 
  ClientToServerEvents, 
  InterServerEvents, 
  SocketData 
} from "./types/socket";

// Import utilities
import { cleanupInactiveUsers } from "./utils/userHelpers";

// Load environment variables
dotenv.config();

// Create Express app
const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Environment variables
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/hivecodex";
const JWT_SECRET = process.env.JWT_SECRET || "supersecret";

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
    console.log("Connected to MongoDB");
    const db = mongoose.connection.db;
    if (db) {
      gridfsBucket = new GridFSBucket(db, { bucketName: "uploads" });
      console.log("GridFS bucket initialized");
    } else {
      throw new Error("Database connection not established");
    }
  })
  .catch((err) => {
    console.error("Database connection error:", err);
    process.exit(1);
  });

// Export GridFS bucket for use in other modules
export { gridfsBucket };

// TODO: Import and use modular route handlers
// import authRoutes from "./routes/auth";
// import roomRoutes from "./routes/rooms";
// import fileRoutes from "./routes/files";
// import messageRoutes from "./routes/messages";

// TODO: Import and use socket handlers
// import { initializeSocketHandlers } from "./socket/socketServer";

// Basic health check endpoint
app.get("/health", (req, res) => {
  res.json({ 
    status: "OK", 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: "2.0.0-ts"
  });
});

// Placeholder for authentication middleware
const authenticateToken = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  // TODO: Implement proper authentication
  // This is a placeholder - will be moved to auth module
  console.log("Authentication middleware called");
  next();
};

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
io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);
  
  // Basic connection setup
  socket.on("disconnect", (reason) => {
    console.log(`User disconnected: ${socket.id}, reason: ${reason}`);
    // TODO: Handle user cleanup
  });
  
  // TODO: Initialize all socket event handlers
  // initializeSocketHandlers(socket, io);
});

// Cleanup inactive users every 30 minutes
setInterval(() => {
  cleanupInactiveUsers(30);
}, 30 * 60 * 1000);

// Start server
const startServer = async () => {
  try {
    await dbConnectionPromise;
    
    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📊 Environment: ${process.env.NODE_ENV || "development"}`);
      console.log(`💾 Database: Connected to MongoDB`);
      console.log(`🔌 Socket.IO: Ready for connections`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
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

// Start the server
startServer();

export { app, io, authenticateToken };
