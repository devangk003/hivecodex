require("dotenv").config();

const express = require("express");
const app = express();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const multer = require("multer");
const crypto = require("crypto");
const http = require("http");
const { Server } = require("socket.io");
const { GridFSBucket } = require("mongodb");
const path = require("path");
const AdmZip = require("adm-zip");

require("dotenv").config();

// Middleware
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Environment variables
const PORT = process.env.PORT || 5000;
const MONGO_URI =
  process.env.MONGO_URI || "mongodb://localhost:27017/hivecodex";
const JWT_SECRET = process.env.JWT_SECRET || "supersecret";

// HTTP and Socket.IO setup
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    credentials: true,
  },
});

// MongoDB connection and GridFS
let gridfsBucket;
const dbConnectionPromise = mongoose
  .connect(MONGO_URI, {})
  .then(() => {
    const db = mongoose.connection.db;
    gridfsBucket = new GridFSBucket(db, { bucketName: "uploads" });
  })
  .catch((err) => {});

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  profilePicId: { type: mongoose.Types.ObjectId, default: null },
  rememberMe: { type: Boolean, default: false },
  resetToken: { type: String },
  resetTokenExpiry: { type: Date },
  activityStatus: { type: String, default: "offline" },
});

const roomSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  description: { type: String, default: "" },
  isPrivate: { type: Boolean, default: false },
  password: { type: String }, // Only for private rooms
  mostUsedLanguage: { type: String, default: "JavaScript" },
  dateTime: { type: String, required: true },
  lastActive: { type: String, default: () => new Date().toISOString() },
  participants: { type: Number, default: 1 },
  files: [
    {
      fileId: { type: mongoose.Types.ObjectId }, // For files only; null for folders
      name: { type: String, required: true },
      ext: { type: String }, // For files only
      lines: { type: Number }, // For files only
      read: { type: Boolean, default: false }, // For files only
      type: { type: String, enum: ["file", "folder"], required: true },
      parentId: { type: mongoose.Types.ObjectId, default: null }, // null for root-level
      // Optionally, add createdAt/updatedAt for folders/files
    },
  ],
  participantList: [
    {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      name: String,
      profilePicId: { type: mongoose.Types.ObjectId },
    },
  ],
});

const messageSchema = new mongoose.Schema({
  roomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Room",
    required: true,
  },
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  sender: {
    type: String,
    required: true,
  },
  text: {
    type: String,
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
  reactions: [
    {
      emoji: { type: String, required: true },
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
    },
  ],
});

const authenticateToken = (req, res, next) => {
  // Batch file/folder operations (delete, etc.)
  app.patch("/api/rooms/:roomId/files", authenticateToken, async (req, res) => {
    try {
      await dbConnectionPromise;
      const { roomId } = req.params;
      const { operation, fileIds } = req.body;
      if (!operation || !Array.isArray(fileIds) || fileIds.length === 0) {
        return res
          .status(400)
          .json({ message: "Operation and fileIds are required" });
      }
      const room = await Room.findOne({ id: roomId });
      if (!room) return res.status(404).json({ message: "Room not found" });
      if (operation === "delete") {
        // Helper: recursively collect all descendant fileIds for folders
        function collectDescendants(files, parentIds) {
          let descendants = [];
          let queue = Array.isArray(parentIds) ? [...parentIds] : [parentIds];
          while (queue.length > 0) {
            const currentId = queue.shift();
            const children = files.filter(
              (f) => f.parentId && f.parentId.toString() === currentId,
            );
            for (const child of children) {
              descendants.push(child);
              if (child.type === "folder") {
                queue.push(
                  child._id?.toString?.() ||
                    child.fileId?.toString?.() ||
                    child.name,
                );
              }
            }
          }
          return descendants;
        }
        // Find all files/folders to delete (including descendants of folders)
        let toDelete = [];
        for (const id of fileIds) {
          const file = room.files.find(
            (f) =>
              (f.fileId && f.fileId.toString() === id) ||
              (f._id && f._id.toString() === id),
          );
          if (file) {
            toDelete.push(file);
            if (file.type === "folder") {
              const descendants = collectDescendants(
                room.files,
                file._id?.toString?.() ||
                  file.fileId?.toString?.() ||
                  file.name,
              );
              toDelete = toDelete.concat(descendants);
            }
          }
        }
        // Remove duplicates
        const uniqueToDelete = Array.from(
          new Set(
            toDelete.map(
              (f) => f._id?.toString?.() || f.fileId?.toString?.() || f.name,
            ),
          ),
        ).map((id) =>
          toDelete.find(
            (f) =>
              (f._id?.toString?.() || f.fileId?.toString?.() || f.name) === id,
          ),
        );
        // Delete files from GridFS (for type: 'file')
        for (const file of uniqueToDelete) {
          if (file.type === "file" && file.fileId) {
            try {
              await gridfsBucket.delete(
                new mongoose.Types.ObjectId(file.fileId),
              );
            } catch (err) {
              // Ignore if not found
            }
          }
        }
        // Remove from room.files
        room.files = room.files.filter(
          (f) =>
            !uniqueToDelete.some(
              (d) =>
                (d._id?.toString?.() || d.fileId?.toString?.() || d.name) ===
                (f._id?.toString?.() || f.fileId?.toString?.() || f.name),
            ),
        );
        await room.save();
        return res.json({
          message: "Deleted successfully",
          deleted: uniqueToDelete.map(
            (f) => f._id?.toString?.() || f.fileId?.toString?.() || f.name,
          ),
        });
      }
      return res.status(400).json({ message: "Unsupported operation" });
    } catch (error) {
      res.status(500).json({ message: "Failed to perform operation" });
    }
  });
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "Access token is required" });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ message: "Invalid or expired token" });
    }
    req.user = user;
    next();
  });
};

// Add a reaction to a message
app.post(
  "/api/messages/:messageId/reactions",
  authenticateToken,
  async (req, res) => {
    try {
      const { emoji } = req.body;
      const { messageId } = req.params;
      if (!emoji) return res.status(400).json({ message: "Emoji is required" });
      const message = await Message.findByIdAndUpdate(
        messageId,
        { $addToSet: { reactions: { emoji, userId: req.user.id } } },
        { new: true },
      );
      if (!message)
        return res.status(404).json({ message: "Message not found" });
      res.json({ reactions: message.reactions });
    } catch (error) {
      res.status(500).json({ message: "Failed to add reaction" });
    }
  },
);

// Remove a reaction from a message
app.delete(
  "/api/messages/:messageId/reactions",
  authenticateToken,
  async (req, res) => {
    try {
      const { emoji } = req.body;
      const { messageId } = req.params;
      if (!emoji) return res.status(400).json({ message: "Emoji is required" });
      const message = await Message.findByIdAndUpdate(
        messageId,
        { $pull: { reactions: { emoji, userId: req.user.id } } },
        { new: true },
      );
      if (!message)
        return res.status(404).json({ message: "Message not found" });
      res.json({ reactions: message.reactions });
    } catch (error) {
      res.status(500).json({ message: "Failed to remove reaction" });
    }
  },
);

const User = mongoose.model("User", userSchema);
const Room = mongoose.model("Room", roomSchema);
const Message = mongoose.model("Message", messageSchema);
const upload = multer();
// Upload multiple files with folder structure (folder upload, fixed)
app.post(
  "/api/rooms/:roomId/upload-folder",
  authenticateToken,
  upload.array("files"),
  async (req, res) => {
    try {
      await dbConnectionPromise;
      if (!gridfsBucket) {
        throw new Error("GridFS is not initialized");
      }

      const { roomId } = req.params;
      const room = await Room.findOne({ id: roomId });
      if (!room) {
        return res.status(404).json({ message: "Room not found" });
      }

      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ message: "No files provided" });
      }

      // Map to keep track of created folders: { 'folder/path': folderObject }
      const folderMap = {};
      const createdFiles = [];

      for (const file of req.files) {
        // Use _relativePath (from zip upload) if present, else originalname (webkitRelativePath)
        const relPath = file._relativePath || file.originalname;
        if (!relPath) continue;
        const parts = relPath.split(/[\/]/g);
        let parentId = null;
        let currPath = "";

        // Create folders as needed
        for (let i = 0; i < parts.length - 1; i++) {
          currPath += (currPath ? "/" : "") + parts[i];
          if (!folderMap[currPath]) {
            // Check if folder already exists in room.files (by name, parentId, and type)
            let folder = room.files.find(
              (f) =>
                f.type === "folder" &&
                f.name === parts[i] &&
                ((f.parentId &&
                  parentId &&
                  f.parentId.toString() === parentId?.toString()) ||
                  (!f.parentId && !parentId)),
            );
            if (!folder) {
              folder = {
                _id: new mongoose.Types.ObjectId(),
                fileId: null,
                name: parts[i],
                ext: "",
                lines: 0,
                read: false,
                type: "folder",
                parentId: parentId || null,
              };
              room.files.push(folder);
            } else {
            }
            folderMap[currPath] = folder;
          }
          parentId = folderMap[currPath]._id;
        }

        // Now create the file
        const fileName = parts[parts.length - 1];
        const fileId = crypto.randomBytes(8).toString("hex");
        const finalFileName = `${fileId}-${fileName}`;
        const uploadStream = gridfsBucket.openUploadStream(finalFileName, {
          contentType: file.mimetype,
        });
        uploadStream.end(file.buffer);
        const gridfsFileId = uploadStream.id;

        const fileData = {
          _id: new mongoose.Types.ObjectId(),
          fileId: gridfsFileId,
          name: fileName,
          ext: fileName.split(".").pop() || "",
          lines: Math.ceil(file.buffer.toString().split("\n").length),
          read: false,
          type: "file",
          parentId: parentId || null,
        };
        room.files.push(fileData);
        createdFiles.push(fileData);
      }

      await room.save();
      io.to(roomId).emit("newFiles", createdFiles);
      res.status(201).json({ files: createdFiles });
    } catch (error) {
      res
        .status(500)
        .json({ message: "Failed to upload folder. Please try again later." });
    }
  },
);

app.post("/api/register", upload.single("profilePic"), async (req, res) => {
  try {
    await dbConnectionPromise;
    const { name, email, password, rememberMe } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res
        .status(400)
        .json({ message: "This email is already registered" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    let profilePicId;

    if (req.file) {
      const filename = `${Date.now()}-${req.file.originalname}`;
      const uploadStream = gridfsBucket.openUploadStream(filename, {
        contentType: req.file.mimetype,
      });
      uploadStream.end(req.file.buffer);
      profilePicId = uploadStream.id;
    }

    const user = new User({
      name,
      email,
      password: hashedPassword,
      profilePicId,
      rememberMe: rememberMe === "true",
    });

    await user.save();

    const token = jwt.sign(
      { id: user._id, email: user.email, name: user.name },
      JWT_SECRET,
      {
        expiresIn: rememberMe === "true" ? "7d" : "1h",
      },
    );

    // Return user data (excluding password) along with token
    const userData = {
      id: user._id,
      name: user.name,
      email: user.email,
      profilePicId: user.profilePicId,
      activityStatus: user.activityStatus,
    };

    res
      .status(201)
      .json({
        token,
        user: userData,
        message: "Registration completed successfully",
      });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to register user. Please try again later." });
  }
});

app.post("/api/login", async (req, res) => {
  try {
    await dbConnectionPromise;
    const { email, password, rememberMe } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Incorrect email or password" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Incorrect email or password" });
    }

    user.rememberMe = rememberMe;
    await user.save();

    const token = jwt.sign(
      { id: user._id, email: user.email, name: user.name },
      JWT_SECRET,
      {
        expiresIn: rememberMe ? "7d" : "1h",
      },
    );

    // Return user data (excluding password) along with token
    const userData = {
      id: user._id,
      name: user.name,
      email: user.email,
      profilePicId: user.profilePicId,
      activityStatus: user.activityStatus,
    };
    res.json({ token, user: userData, message: "Login successful" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to log in. Please try again later." });
  }
});

app.post("/api/forgot-password", async (req, res) => {
  try {
    await dbConnectionPromise;
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      return res
        .status(404)
        .json({ message: "No account found with this email" });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    user.resetToken = resetToken;
    user.resetTokenExpiry = Date.now() + 3600000;
    await user.save();

    res.json({ message: "Password reset link has been sent to your email" });
  } catch (error) {
    res
      .status(500)
      .json({
        message:
          "Failed to process password reset request. Please try again later.",
      });
  }
});

app.post("/api/reset-password/:token", async (req, res) => {
  try {
    await dbConnectionPromise;
    const { token } = req.params;
    const { password } = req.body;

    const user = await User.findOne({
      resetToken: token,
      resetTokenExpiry: { $gt: Date.now() },
    });

    if (!user) {
      return res
        .status(400)
        .json({ message: "The reset token is invalid or has expired" });
    }

    user.password = await bcrypt.hash(password, 10);
    user.resetToken = undefined;
    user.resetTokenExpiry = undefined;
    await user.save();

    res.json({ message: "Password has been reset successfully" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to reset password. Please try again later." });
  }
});

app.get(
  "/api/rooms/:roomId/files/:fileName",
  authenticateToken,
  async (req, res) => {
    try {
      await dbConnectionPromise;
      const { roomId, fileName } = req.params;
      const room = await Room.findOne({ id: roomId });
      if (!room) {
        return res.status(404).json({ message: "Room not found" });
      }

      const file = room.files.find((f) => f.name === fileName);
      if (!file || !file.fileId) {
        return res.status(404).json({ message: "File not found in the room" });
      }

      const downloadStream = gridfsBucket.openDownloadStream(file.fileId);
      let content = "";

      downloadStream.on("data", (chunk) => {
        content += chunk.toString("utf8");
      });

      downloadStream.on("error", () => {
        res.status(404).json({ message: "Error retrieving file from storage" });
      });

      downloadStream.on("end", () => {
        res.json({ content });
      });
    } catch (error) {
      res
        .status(500)
        .json({ message: "Failed to retrieve file. Please try again later." });
    }
  },
);

// Create a new file (empty, metadata only)
app.post(
  "/api/rooms/:roomId/create-file",
  authenticateToken,
  async (req, res) => {
    try {
      await dbConnectionPromise;
      const { roomId } = req.params;
      const { name, parentId } = req.body;
      if (!name) return res.status(400).json({ message: "File name required" });
      const room = await Room.findOne({ id: roomId });
      if (!room) return res.status(404).json({ message: "Room not found" });
      const ext = name.includes(".") ? name.split(".").pop() : "";
      const file = {
        _id: new mongoose.Types.ObjectId(),
        fileId: null,
        name,
        ext,
        lines: 0,
        read: false,
        type: "file",
        parentId: parentId || null,
      };
      room.files.push(file);
      await room.save();
      res.status(201).json({ file });
    } catch (error) {
      res.status(500).json({ message: "Failed to create file" });
    }
  },
);

// Create a new folder
app.post(
  "/api/rooms/:roomId/create-folder",
  authenticateToken,
  async (req, res) => {
    try {
      await dbConnectionPromise;
      const { roomId } = req.params;
      const { name, parentId } = req.body;
      if (!name)
        return res.status(400).json({ message: "Folder name required" });
      const room = await Room.findOne({ id: roomId });
      if (!room) return res.status(404).json({ message: "Room not found" });
      const folder = {
        _id: new mongoose.Types.ObjectId(),
        fileId: null,
        name,
        ext: "",
        lines: 0,
        read: false,
        type: "folder",
        parentId: parentId || null,
      };
      room.files.push(folder);
      await room.save();
      res.status(201).json({ folder });
    } catch (error) {
      res.status(500).json({ message: "Failed to create folder" });
    }
  },
);

// Move file or folder (update parentId)
app.patch("/api/rooms/:roomId/move", authenticateToken, async (req, res) => {
  try {
    await dbConnectionPromise;
    const { roomId } = req.params;
    const { fileId, newParentId } = req.body;
    if (!fileId) return res.status(400).json({ message: "fileId is required" });

    const room = await Room.findOne({ id: roomId });
    if (!room) return res.status(404).json({ message: "Room not found" });

    // Always match by _id (string)
    const file = room.files.find((f) => f._id && f._id.toString() === fileId);
    if (!file)
      return res.status(404).json({ message: "File/folder not found" });

    // Prevent moving a folder into itself or its descendants
    if (file.type === "folder" && newParentId) {
      // Recursively check descendants
      function isDescendant(files, folderId, targetId) {
        for (const f of files) {
          if (f.parentId && f.parentId.toString() === folderId) {
            if (
              (f._id && f._id.toString() === targetId) ||
              (f.fileId && f.fileId.toString() === targetId)
            )
              return true;
            if (
              f.type === "folder" &&
              isDescendant(
                files,
                f._id?.toString?.() || f.fileId?.toString?.(),
                targetId,
              )
            )
              return true;
          }
        }
        return false;
      }
      if (
        file._id &&
        (file._id.toString() === newParentId ||
          isDescendant(room.files, file._id.toString(), newParentId))
      ) {
        return res
          .status(400)
          .json({
            message: "Cannot move a folder into itself or its descendants",
          });
      }
    }

    // Log before
    console.log("[MOVE] Before:", {
      file: { ...file },
      parentId: file.parentId,
    });
    if (newParentId === null || newParentId === undefined) {
      file.parentId = null;
    } else {
      file.parentId = new mongoose.Types.ObjectId(newParentId);
    }
    if (typeof file.set === "function") file.set("parentId", file.parentId);
    room.markModified("files");
    await room.save();
    // Log after
    console.log("[MOVE] After:", {
      file: { ...file },
      parentId: file.parentId,
    });
    io.to(roomId).emit("fileMoved", { fileId, newParentId });
    res.json({ message: "Moved successfully", fileId, newParentId });
  } catch (error) {
    console.error("Move file/folder error:", error);
    res.status(500).json({ message: "Failed to move file/folder" });
  }
});

// Get current user
app.get("/api/user", authenticateToken, async (req, res) => {
  try {
    await dbConnectionPromise;
    const user = await User.findById(req.user.id).select(
      "-password -resetToken -resetTokenExpiry",
    );

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({
      id: user._id,
      name: user.name,
      email: user.email,
      profilePicId: user.profilePicId,
    });
  } catch (err) {
    console.error("User fetch error:", err);
    res
      .status(500)
      .json({ message: "Failed to fetch user data. Please try again later." });
  }
});

// Get user's rooms
app.get("/api/user/rooms", authenticateToken, async (req, res) => {
  try {
    await dbConnectionPromise;
    const rooms = await Room.find({ userId: req.user.id })
      .sort({ lastActive: -1 })
      .lean();

    res.json(rooms);
  } catch (err) {
    console.error("User rooms fetch error:", err);
    res
      .status(500)
      .json({ message: "Failed to fetch user rooms. Please try again later." });
  }
});

// Get user activity status
app.get("/api/user/activity-status", authenticateToken, async (req, res) => {
  try {
    await dbConnectionPromise;
    const user = await User.findById(req.user.id).select('activityStatus').lean();
    res.json({ 
      activityStatus: user?.activityStatus || 'Online' 
    });
  } catch (err) {
    console.error("User activity status fetch error:", err);
    res.status(500).json({ 
      message: "Failed to fetch activity status. Please try again later." 
    });
  }
});

// Update user activity status
app.put("/api/user/activity-status", authenticateToken, async (req, res) => {
  try {
    await dbConnectionPromise;
    const { activityStatus } = req.body;
    
    if (!activityStatus || typeof activityStatus !== 'string') {
      return res.status(400).json({ 
        message: "Invalid activity status" 
      });
    }

    await User.findByIdAndUpdate(
      req.user.id, 
      { activityStatus }, 
      { new: true }
    );
    
    res.json({ activityStatus });
  } catch (err) {
    console.error("User activity status update error:", err);
    res.status(500).json({ 
      message: "Failed to update activity status. Please try again later." 
    });
  }
});

app.get("/api/rooms", authenticateToken, async (req, res) => {
  try {
    await dbConnectionPromise;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 6;
    const skip = (page - 1) * limit;

    const rooms = await Room.find({ userId: req.user.id })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Room.countDocuments({ userId: req.user.id });

    res.json({
      rooms,
      total,
      page,
      limit,
    });
  } catch (err) {
    console.error("Rooms fetch error:", err);
    res
      .status(500)
      .json({ message: "Failed to fetch rooms. Please try again later." });
  }
});

app.post("/api/rooms", authenticateToken, async (req, res) => {
  try {
    await dbConnectionPromise;
    const {
      name,
      description,
      isPrivate = false,
      password,
      mostUsedLanguage = "JavaScript",
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Room name is required" });
    }

    if (isPrivate && !password) {
      return res
        .status(400)
        .json({ message: "Password is required for private rooms" });
    }

    const roomId = crypto.randomBytes(3).toString("hex");

    const newRoom = new Room({
      userId: req.user.id,
      id: roomId,
      name: name.trim(),
      description: description || "",
      isPrivate,
      password: isPrivate ? await bcrypt.hash(password, 10) : null,
      mostUsedLanguage,
      dateTime: new Date().toISOString(),
      lastActive: new Date().toISOString(),
      participants: 1,
      files: [],
    });

    await newRoom.save();

    // Return room data without password
    const { password: _, ...roomData } = newRoom.toObject();
    res.status(201).json({ room: roomData });
  } catch (error) {
    console.error("Create room error:", error);
    res
      .status(500)
      .json({ message: "Failed to create room. Please try again later." });
  }
});

app.delete("/api/rooms/:roomId", authenticateToken, async (req, res) => {
  try {
    await dbConnectionPromise;
    const { roomId } = req.params;
    const userId = req.user.id;
    const room = await Room.findOne({ id: roomId });
    if (!room) {
      return res.status(404).json({ message: "Room not found" });
    }
    if (room.userId.toString() !== userId) {
      return res
        .status(403)
        .json({ message: "Only the room owner can delete this room" });
    }
    // Remove all files in GridFS associated with this room
    if (
      room.files &&
      room.files.length > 0 &&
      typeof gridfsBucket !== "undefined"
    ) {
      for (const file of room.files) {
        try {
          await gridfsBucket.delete(new mongoose.Types.ObjectId(file.fileId));
        } catch (err) {
          // Ignore errors for missing files
        }
      }
    }
    await Message.deleteMany({ roomId: room._id });
    await Room.deleteOne({ id: roomId });
    res.json({ message: "Room deleted successfully" });
  } catch (error) {
    console.error("Delete room error:", error);
    res
      .status(500)
      .json({ message: "Failed to delete room. Please try again later." });
  }
});

app.get("/api/rooms/:roomId", authenticateToken, async (req, res) => {
  try {
    await dbConnectionPromise;
    const { roomId } = req.params;
    const room = await Room.findOne({ id: roomId }).lean();

    if (!room) {
      return res.status(404).json({ message: "Room not found" });
    }

    res.json(room);
  } catch (error) {
    console.error("Get room error:", error);
    res
      .status(500)
      .json({
        message: "Failed to retrieve room details. Please try again later.",
      });
  }
});

app.post("/api/rooms/:roomId/join", authenticateToken, async (req, res) => {
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
        return res
          .status(400)
          .json({ message: "Password is required to join this private room" });
      }

      const isPasswordValid = await bcrypt.compare(password, room.password);
      if (!isPasswordValid) {
        return res.status(401).json({ message: "Incorrect password" });
      }
    }

    const user = await User.findById(req.user.id).select("name profilePicId");

    if (
      !room.participantList.some(
        (p) => p.userId.toString() === user._id.toString(),
      )
    ) {
      room.participantList.push({
        userId: user._id,
        name: user.name,
        profilePicId: user.profilePicId,
      });

      room.participants = room.participantList.length;
      await room.save();
    }

    // Return room data without password
    const { password: _, ...roomData } = room.toObject();
    res.json({ room: roomData, message: "Successfully joined the room" });
  } catch (error) {
    console.error("Join room error:", error);
    res
      .status(500)
      .json({ message: "Failed to join room. Please try again later." });
  }
});

// Get room participants
app.get(
  "/api/rooms/:roomId/participants",
  authenticateToken,
  async (req, res) => {
    try {
      await dbConnectionPromise;
      const { roomId } = req.params;

      const room = await Room.findOne({ id: roomId });
      if (!room) {
        return res.status(404).json({ message: "Room not found" });
      }

      // Fetch latest profilePicId for each participant
      const participantList = room.participantList || [];
      const userIds = participantList.map((p) => p.userId);
      const users = await User.find({ _id: { $in: userIds } }).select(
        "profilePicId",
      );
      const userPicMap = new Map(
        users.map((u) => [u._id.toString(), u.profilePicId]),
      );

      const mergedParticipants = participantList.map((p) => ({
        ...(p.toObject?.() ? p.toObject() : p),
        profilePicId:
          userPicMap.get(p.userId.toString()) || p.profilePicId || null,
      }));

      res.json(mergedParticipants);
    } catch (error) {
      console.error("Get room participants error:", error);
      res.status(500).json({ message: "Failed to get room participants" });
    }
  },
);

// Get room files
app.get("/api/rooms/:roomId/files", authenticateToken, async (req, res) => {
  try {
    await dbConnectionPromise;
    const { roomId } = req.params;
    const room = await Room.findOne({ id: roomId });
    if (!room) {
      return res.status(404).json({ message: "Room not found" });
    }

    const roomFiles = room.files || [];
    const validFiles = [];
    const invalidFiles = [];

    for (const file of roomFiles) {
      if (file.type === "folder") {
        // Folders do not have fileId or GridFS entry
        validFiles.push({ ...(file.toObject?.() || file), isCorrupted: false });
      } else if (file.fileId) {
        try {
          const gridfsFile = await gridfsBucket
            .find({ _id: new mongoose.Types.ObjectId(file.fileId) })
            .toArray();
          if (gridfsFile && gridfsFile.length > 0) {
            validFiles.push({
              ...(file.toObject?.() || file),
              isCorrupted: false,
            });
          } else {
            console.log("File not found in GridFS:", file.fileId);
            invalidFiles.push(file.fileId);
          }
        } catch (error) {
          console.log(
            "Error checking file in GridFS:",
            file.fileId,
            error.message,
          );
          invalidFiles.push(file.fileId);
          validFiles.push({
            ...(file.toObject?.() || file),
            isCorrupted: true,
          });
        }
      }
    }

    // Remove invalid files from room document (only for files, not folders)
    if (invalidFiles.length > 0) {
      console.log("Removing invalid files from room:", invalidFiles);
      await Room.updateOne(
        { id: roomId },
        {
          $pull: {
            files: {
              fileId: {
                $in: invalidFiles.map((id) => new mongoose.Types.ObjectId(id)),
              },
            },
          },
        },
      );
    }

    res.json(validFiles);
  } catch (error) {
    console.error("Get room files error:", error);
    res.status(500).json({ message: "Failed to get room files" });
  }
});

app.post(
  "/api/rooms/:roomId/files",
  authenticateToken,
  upload.single("file"),
  async (req, res) => {
    try {
      await dbConnectionPromise;
      if (!gridfsBucket) {
        throw new Error("GridFS is not initialized");
      }

      const { roomId } = req.params;
      const { fileName, fileExt, type, parentId } = req.body;

      const room = await Room.findOne({ id: roomId });
      if (!room) {
        return res.status(404).json({ message: "Room not found" });
      }

      if (type === "folder") {
        // Create a folder
        if (!fileName) {
          return res.status(400).json({ message: "Folder name is required" });
        }
        const folderData = {
          _id: new mongoose.Types.ObjectId(),
          fileId: null,
          name: fileName,
          ext: "",
          lines: 0,
          read: false,
          type: "folder",
          parentId: parentId || null,
        };
        room.files.push(folderData);
        await room.save();
        io.to(roomId).emit("newFile", folderData);
        return res.status(201).json({ file: folderData });
      }

      // Default: file upload
      if (!req.file && !fileName) {
        return res.status(400).json({ message: "No file provided for upload" });
      }

      const fileId = crypto.randomBytes(8).toString("hex");
      const uploadedFileName = fileName || req.file.originalname;
      let gridfsFileId;

      if (req.file) {
        const finalFileName = `${fileId}-${uploadedFileName}`;
        const uploadStream = gridfsBucket.openUploadStream(finalFileName, {
          contentType: req.file.mimetype,
        });
        uploadStream.on("error", (error) => {
          console.error("GridFS upload error:", error);
          throw error;
        });
        uploadStream.end(req.file.buffer);
        gridfsFileId = uploadStream.id;
      }

      if (!gridfsFileId) {
        return res
          .status(500)
          .json({ message: "Failed to upload file to storage" });
      }
      const fileData = {
        _id: new mongoose.Types.ObjectId(),
        fileId: gridfsFileId,
        name: uploadedFileName,
        ext: fileExt || uploadedFileName.split(".").pop() || "",
        lines: req.file
          ? Math.ceil(req.file.buffer.toString().split("\n").length)
          : 0,
        read: false,
        type: "file",
        parentId: parentId || null,
      };

      room.files.push(fileData);
      await room.save();
      io.to(roomId).emit("newFile", fileData);
      res.status(201).json({ file: fileData });
    } catch (error) {
      console.error("File/folder upload error:", error.message, error.stack);
      res
        .status(500)
        .json({
          message: "Failed to upload file/folder. Please try again later.",
        });
    }
  },
);

// Upload ZIP project
app.post(
  "/api/rooms/:roomId/upload-project",
  authenticateToken,
  upload.single("zipFile"),
  async (req, res) => {
    try {
      await dbConnectionPromise;
      const { roomId } = req.params;

      const room = await Room.findOne({ id: roomId });
      if (!room) {
        return res.status(404).json({ message: "Room not found" });
      }

      if (!req.file) {
        return res.status(400).json({ message: "No ZIP file provided" });
      }

      // Validate file type
      const fileExtension = path.extname(req.file.originalname).toLowerCase();
      if (fileExtension !== ".zip") {
        return res.status(400).json({ message: "Only ZIP files are allowed" });
      }

      try {
        const zip = new AdmZip(req.file.buffer);
        const zipEntries = zip.getEntries();
        const uploadedFiles = [];

        // Process each file in the ZIP
        for (const entry of zipEntries) {
          if (!entry.isDirectory) {
            const filePath = entry.entryName;
            const fileName = path.basename(filePath);
            const fileDir = path.dirname(filePath);
            const fileExt = path.extname(fileName).slice(1);
            const fileContent = entry.getData();

            // Skip hidden files and common build directories
            if (
              fileName.startsWith(".") ||
              filePath.includes("node_modules/") ||
              filePath.includes(".git/") ||
              filePath.includes("dist/") ||
              filePath.includes("build/")
            ) {
              continue;
            }

            // Generate unique file ID
            const fileId = new mongoose.Types.ObjectId();
            const finalFileName = `${fileId}-${fileName}`;

            // Upload to GridFS
            const uploadStream = gridfsBucket.openUploadStream(finalFileName, {
              metadata: {
                roomId: roomId,
                originalName: fileName,
                filePath: filePath,
                uploadedBy: req.user.id,
              },
            });

            uploadStream.on("error", (error) => {
              console.error("GridFS upload error:", error);
              throw error;
            });

            uploadStream.end(fileContent);
            const gridfsFileId = uploadStream.id;

            // Create file data
            const fileData = {
              fileId: gridfsFileId,
              name: fileName,
              path: filePath,
              directory: fileDir !== "." ? fileDir : "",
              ext: fileExt,
              size: fileContent.length,
              lines: fileContent.toString().split("\n").length,
              read: false,
            };

            uploadedFiles.push(fileData);
          }
        }

        // Add all files to room
        room.files.push(...uploadedFiles);
        await room.save();

        // Emit to all users in the room
        io.to(roomId).emit("projectUploaded", {
          files: uploadedFiles,
          projectName: path.basename(req.file.originalname, ".zip"),
        });

        res.status(201).json({
          message: "Project uploaded successfully",
          files: uploadedFiles,
          count: uploadedFiles.length,
        });
      } catch (zipError) {
        console.error("ZIP processing error:", zipError);
        res
          .status(400)
          .json({ message: "Invalid ZIP file or processing error" });
      }
    } catch (error) {
      console.error("Project upload error:", error.message, error.stack);
      res
        .status(500)
        .json({ message: "Failed to upload project. Please try again later." });
    }
  },
);

// Bulk file operations
app.post(
  "/api/rooms/:roomId/bulk-operations",
  authenticateToken,
  async (req, res) => {
    try {
      await dbConnectionPromise;
      const { roomId } = req.params;
      const { operation, fileIds } = req.body;

      const room = await Room.findOne({ id: roomId });
      if (!room) {
        return res.status(404).json({ message: "Room not found" });
      }

      if (!Array.isArray(fileIds) || fileIds.length === 0) {
        return res.status(400).json({ message: "No files specified" });
      }

      switch (operation) {
        case "delete": {
          // Helper: recursively collect all descendant fileIds for folders
          function collectDescendants(files, parentIds) {
            let descendants = [];
            let queue = Array.isArray(parentIds) ? [...parentIds] : [parentIds];
            while (queue.length > 0) {
              const currentId = queue.shift();
              const children = files.filter(
                (f) => f.parentId && f.parentId.toString() === currentId,
              );
              for (const child of children) {
                descendants.push(child);
                if (child.type === "folder") {
                  queue.push(
                    child._id?.toString?.() ||
                      child.fileId?.toString?.() ||
                      child.name,
                  ); // fallback to name if no id
                }
              }
            }
            return descendants;
          }

          // Find all files/folders to delete (including descendants of folders)
          let toDelete = [];
          for (const id of fileIds) {
            const file = room.files.find(
              (f) =>
                (f.fileId && f.fileId.toString() === id) ||
                (f._id && f._id.toString() === id),
            );
            if (file) {
              toDelete.push(file);
              if (file.type === "folder") {
                const descendants = collectDescendants(
                  room.files,
                  file._id?.toString?.() ||
                    file.fileId?.toString?.() ||
                    file.name,
                );
                toDelete = toDelete.concat(descendants);
              }
            }
          }

          // Remove duplicates
          const uniqueToDelete = Array.from(
            new Set(
              toDelete.map(
                (f) => f._id?.toString?.() || f.fileId?.toString?.() || f.name,
              ),
            ),
          ).map((id) =>
            toDelete.find(
              (f) =>
                (f._id?.toString?.() || f.fileId?.toString?.() || f.name) ===
                id,
            ),
          );

          // Delete files from GridFS (for type: 'file')
          for (const file of uniqueToDelete) {
            if (file.type === "file" && file.fileId) {
              try {
                await gridfsBucket.delete(
                  new mongoose.Types.ObjectId(file.fileId),
                );
              } catch (error) {
                console.error(
                  `Failed to delete file ${file.fileId} from GridFS:`,
                  error,
                );
              }
            }
          }

          // Remove files/folders from room
          const idsToDelete = uniqueToDelete.map(
            (f) => f._id?.toString?.() || f.fileId?.toString?.() || f.name,
          );
          room.files = room.files.filter(
            (file) =>
              !idsToDelete.includes(
                file._id?.toString?.() ||
                  file.fileId?.toString?.() ||
                  file.name,
              ),
          );
          await room.save();

          io.to(roomId).emit("filesDeleted", { fileIds: idsToDelete });
          res.json({
            message: `${idsToDelete.length} files/folders deleted successfully`,
          });
          break;
        }
        default:
          res.status(400).json({ message: "Invalid operation" });
      }
    } catch (error) {
      console.error("Bulk operation error:", error.message, error.stack);
      res
        .status(500)
        .json({
          message: "Failed to perform bulk operation. Please try again later.",
        });
    }
  },
);

app.post(
  "/api/profile/update",
  authenticateToken,
  upload.single("profilePic"),
  async (req, res) => {
    try {
      await dbConnectionPromise;
      console.log("[PROFILE UPDATE] user id:", req.user.id);
      const user = await User.findById(req.user.id);
      if (!user) {
        console.error("[PROFILE UPDATE] User not found:", req.user.id);
        return res.status(404).json({ message: "User not found" });
      }

      // Update name/email if provided
      const { name, email } = req.body;
      console.log("[PROFILE UPDATE] req.body:", req.body);
      if (name) user.name = name;
      if (email) user.email = email;

      if (req.file) {
        if (!req.file.buffer) {
          console.error(
            "[PROFILE UPDATE] req.file present but buffer missing:",
            req.file,
          );
          return res.status(400).json({ message: "Invalid file upload" });
        }
        const filename = `${Date.now()}-${req.file.originalname}`;
        console.log("[PROFILE UPDATE] Uploading file:", filename);
        const uploadStream = gridfsBucket.openUploadStream(filename, {
          contentType: req.file.mimetype,
        });
        uploadStream.end(req.file.buffer);
        user.profilePicId = uploadStream.id;
      }

      await user.save();
      console.log("[PROFILE UPDATE] User saved:", user._id);
      await Room.updateMany(
        { "participantList.userId": user._id },
        { $set: { "participantList.$.profilePicId": user.profilePicId } },
      );
      console.log(
        "[PROFILE UPDATE] Room participants updated for user:",
        user._id,
      );

      res.json({
        message: "Profile updated successfully",
        profilePicId: user.profilePicId,
        name: user.name,
        email: user.email,
      });
    } catch (error) {
      console.error(
        "Profile update error:",
        error && error.stack ? error.stack : error,
      );
      res
        .status(500)
        .json({ message: "Failed to update profile. Please try again later." });
    }
  },
);

app.get("/api/profile", authenticateToken, async (req, res) => {
  try {
    await dbConnectionPromise;
    const user = await User.findById(req.user.id).select(
      "-password -resetToken -resetTokenExpiry",
    );
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json(user);
  } catch (error) {
    console.error("Profile error:", error);
    res
      .status(500)
      .json({ message: "Failed to retrieve profile. Please try again later." });
  }
});

app.get("/api/files/:fileId", async (req, res) => {
  try {
    await dbConnectionPromise;
    const { fileId } = req.params;
    const downloadStream = gridfsBucket.openDownloadStream(
      new mongoose.Types.ObjectId(fileId),
    );

    downloadStream.on("error", () => {
      res.status(404).json({ message: "File not found in storage" });
    });

    downloadStream.pipe(res);
  } catch (error) {
    console.error("File retrieval error:", error);
    res
      .status(500)
      .json({ message: "Failed to retrieve file. Please try again later." });
  }
});

// Get file content as text
app.get("/api/files/:fileId/content", authenticateToken, async (req, res) => {
  try {
    await dbConnectionPromise;
    const { fileId } = req.params;

    const downloadStream = gridfsBucket.openDownloadStream(
      new mongoose.Types.ObjectId(fileId),
    );
    let fileContent = "";

    downloadStream.on("data", (chunk) => {
      fileContent += chunk.toString();
    });

    downloadStream.on("end", () => {
      res.json({ content: fileContent });
    });

    downloadStream.on("error", () => {
      res.status(404).json({ message: "File not found in storage" });
    });
  } catch (error) {
    console.error("File content retrieval error:", error);
    res
      .status(500)
      .json({
        message: "Failed to retrieve file content. Please try again later.",
      });
  }
});

// Update file content
app.put("/api/files/:fileId/content", authenticateToken, async (req, res) => {
  try {
    await dbConnectionPromise;
    const { fileId } = req.params;
    const { content } = req.body;

    if (content === undefined) {
      return res.status(400).json({ message: "Content is required" });
    }

    // Get the original file info
    const originalFile = await gridfsBucket
      .find({ _id: new mongoose.Types.ObjectId(fileId) })
      .toArray();
    if (!originalFile || originalFile.length === 0) {
      return res.status(404).json({ message: "File not found" });
    }

    const file = originalFile[0];

    // Delete the old file
    await gridfsBucket.delete(new mongoose.Types.ObjectId(fileId));

    // Create a new file with the updated content
    const uploadStream = gridfsBucket.openUploadStreamWithId(
      new mongoose.Types.ObjectId(fileId),
      file.filename,
      {
        metadata: {
          ...file.metadata,
          lastModified: new Date(),
        },
      },
    );

    uploadStream.end(Buffer.from(content));

    uploadStream.on("finish", () => {
      res.json({
        message: "File content updated successfully",
        fileId: fileId,
        filename: file.filename,
      });
    });

    uploadStream.on("error", (error) => {
      console.error("File update error:", error);
      res.status(500).json({ message: "Failed to update file content" });
    });
  } catch (error) {
    console.error("File content update error:", error);
    res
      .status(500)
      .json({
        message: "Failed to update file content. Please try again later.",
      });
  }
});

// Delete file
app.delete("/api/files/:fileId", authenticateToken, async (req, res) => {
  try {
    await dbConnectionPromise;
    const { fileId } = req.params;

    console.log("Attempting to delete file with ID:", fileId);

    // Check if file exists in GridFS
    const file = await gridfsBucket
      .find({ _id: new mongoose.Types.ObjectId(fileId) })
      .toArray();
    if (!file || file.length === 0) {
      console.log("File not found in GridFS:", fileId);
      return res.status(404).json({ message: "File not found" });
    }

    console.log("File found in GridFS:", file[0]);

    // Delete the file from GridFS
    await gridfsBucket.delete(new mongoose.Types.ObjectId(fileId));
    console.log("File deleted from GridFS");

    // Remove from room's files array - try both ObjectId and string matching
    const roomId = file[0].metadata?.roomId;
    if (roomId) {
      console.log("Removing file from room:", roomId);

      // Try to remove using ObjectId
      const result1 = await Room.updateOne(
        { id: roomId },
        { $pull: { files: { fileId: new mongoose.Types.ObjectId(fileId) } } },
      );
      console.log("Remove result (ObjectId):", result1);

      // Also try to remove using string comparison (fallback)
      const result2 = await Room.updateOne(
        { id: roomId },
        { $pull: { files: { fileId: fileId } } },
      );
      console.log("Remove result (string):", result2);

      // Verify the file was actually removed
      const updatedRoom = await Room.findOne({ id: roomId });
      console.log("Updated room files count:", updatedRoom?.files?.length);
    }

    res.json({
      message: "File deleted successfully",
      fileId: fileId,
    });
  } catch (error) {
    console.error("File deletion error:", error);
    res
      .status(500)
      .json({ message: "Failed to delete file. Please try again later." });
  }
});

// Message API endpoints
app.get("/api/rooms/:roomId/messages", authenticateToken, async (req, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.user.id;

    console.log(`Getting messages for room ${roomId} by user ${userId}`);

    // Check if user is part of the room
    const room = await Room.findOne({ id: roomId });
    if (!room) {
      return res.status(404).json({ message: "Room not found" });
    }

    const isParticipant = room.participantList.some(
      (p) => p.userId.toString() === userId,
    );
    if (!isParticipant) {
      return res
        .status(403)
        .json({ message: "Not a participant of this room" });
    }

    // Get messages for the room
    const messages = await Message.find({ roomId: room._id })
      .sort({ timestamp: 1 })
      .limit(100) // Limit to last 100 messages
      .lean();

    // Format messages for frontend
    const formattedMessages = messages.map((msg) => ({
      id: msg._id.toString(),
      sender: msg.sender,
      senderId: msg.senderId.toString(),
      text: msg.text,
      timestamp: msg.timestamp.toISOString(),
    }));

    console.log(
      `Found ${formattedMessages.length} messages for room ${roomId}`,
    );
    res.json({ messages: formattedMessages });
  } catch (error) {
    console.error("Get room messages error:", error);
    res.status(500).json({ message: "Failed to get room messages" });
  }
});

app.post("/api/rooms/:roomId/messages", authenticateToken, async (req, res) => {
  try {
    const { roomId } = req.params;
    const { message } = req.body;
    const userId = req.user.id;
    const userName = req.user.name;

    console.log(
      `Posting message to room ${roomId} by user ${userId}: ${message}`,
    );

    // Check if user is part of the room
    const room = await Room.findOne({ id: roomId });
    if (!room) {
      return res.status(404).json({ message: "Room not found" });
    }

    const isParticipant = room.participantList.some(
      (p) => p.userId.toString() === userId,
    );
    if (!isParticipant) {
      return res
        .status(403)
        .json({ message: "Not a participant of this room" });
    }

    // Create and save message
    const newMessage = new Message({
      roomId: room._id,
      senderId: userId,
      sender: userName,
      text: message,
      timestamp: new Date(),
    });

    await newMessage.save();

    // Format message for response
    const formattedMessage = {
      id: newMessage._id.toString(),
      sender: newMessage.sender,
      senderId: newMessage.senderId.toString(),
      text: newMessage.text,
      timestamp: newMessage.timestamp.toISOString(),
    };

    console.log(`Message saved to database:`, formattedMessage);
    res.json(formattedMessage);
  } catch (error) {
    console.error("Post message error:", error);
    res.status(500).json({ message: "Failed to send message" });
  }
});

io.on("connection", (socket) => {
  console.log("User connected:", socket.id, "with userId: (not yet set)");

  socket.on("joinRoom", async ({ roomId, userId, userName }) => {
    try {
      console.log(
        `JoinRoom attempt - roomId: ${roomId}, userId: ${userId}, userName: ${userName}`,
      );
      if (!userId || !userName) {
        console.error(
          `Invalid joinRoom data: userId=${userId}, userName=${userName}`,
        );
        return;
      }

      socket.data.roomId = roomId;
      socket.data.userId = userId;
      socket.data.userName = userName;

      socket.join(roomId);
      console.log(
        `User ${userName} (${userId}) joined room ${roomId} with socket ${socket.id}`,
      );

      socket.to(roomId).emit("userJoined", {
        id: userId,
        name: userName,
        online: true,
      });

      const room = await Room.findOne({ id: roomId });
      if (!room) {
        console.error(`Room ${roomId} not found`);
        return;
      }

      const socketsInRoom = await io.in(roomId).fetchSockets();
      const onlineUserIds = new Set(
        socketsInRoom
          .filter((s) => s.data.userId && s.data.userName)
          .map((s) => s.data.userId),
      );
      const userIds = room.participantList.map((p) => p.userId);
      const users = await User.find({ _id: { $in: userIds } }).select(
        "name profilePicId",
      );

      const uniqueParticipants = Array.from(
        new Map(
          room.participantList.map((p) => {
            const user = users.find(
              (u) => u._id.toString() === p.userId.toString(),
            );
            return [
              p.userId.toString(),
              {
                id: p.userId.toString(),
                name: p.name,
                profilePicId: user?.profilePicId || p.profilePicId,
                online: onlineUserIds.has(p.userId.toString()),
              },
            ];
          }),
        ).values(),
      );

      console.log(`Participants in room ${roomId}:`, uniqueParticipants);
      io.to(roomId).emit("roomParticipants", uniqueParticipants);
    } catch (error) {
      console.error("Error joining room:", error);
    }
  });

  socket.on("message", async (msg) => {
    const roomId = socket.data.roomId;
    const userId = socket.data.userId;
    const userName = socket.data.userName;
    console.log(
      `Message handler called - roomId: ${roomId}, userId: ${userId}, userName: ${userName}`,
    );

    if (roomId && userId && userName) {
      console.log(`Message from ${userName} in room ${roomId}:`, msg);

      try {
        // Find the room in database
        const room = await Room.findOne({ id: roomId });
        if (room) {
          // Save message to database
          const newMessage = new Message({
            roomId: room._id,
            senderId: userId,
            sender: userName,
            text: msg.text,
            timestamp: new Date(),
          });

          await newMessage.save();
          console.log(`Message saved to database for room ${roomId}`);

          // Broadcast to all clients in the room including sender
          const messageForBroadcast = {
            id: newMessage._id.toString(),
            sender: userName,
            senderId: userId,
            text: msg.text,
            timestamp: newMessage.timestamp.toISOString(),
          };

          io.to(roomId).emit("message", messageForBroadcast);
        } else {
          console.error(`Room ${roomId} not found when saving message`);
        }
      } catch (error) {
        console.error("Error saving message to database:", error);
        // Still broadcast even if database save fails
        io.to(roomId).emit("message", {
          ...msg,
          sender: userName,
          senderId: userId,
          timestamp: new Date().toISOString(),
        });
      }
    } else {
      console.warn(
        `Message ignored: missing roomId=${roomId}, userId=${userId}, or userName=${userName}`,
      );
    }
  });

  socket.on("typing-start", (roomId) => {
    const userId = socket.data.userId;
    const userName = socket.data.userName;
    if (roomId && userId && userName) {
      socket.to(roomId).emit("typing-update", {
        userId,
        userName,
        isTyping: true,
      });
    }
  });

  socket.on("typing-stop", (roomId) => {
    const userId = socket.data.userId;
    const userName = socket.data.userName;
    if (roomId && userId && userName) {
      socket.to(roomId).emit("typing-update", {
        userId,
        userName,
        isTyping: false,
      });
    }
  });

  socket.on("typing-start", (roomId) => {
    const userId = socket.data.userId;
    const userName = socket.data.userName;
    if (roomId && userId && userName) {
      socket.to(roomId).emit("typing-update", {
        userId,
        userName,
        isTyping: true,
      });
    }
  });

  socket.on("typing-stop", (roomId) => {
    const userId = socket.data.userId;
    const userName = socket.data.userName;
    if (roomId && userId && userName) {
      socket.to(roomId).emit("typing-update", {
        userId,
        userName,
        isTyping: false,
      });
    }
  });

  socket.on("newFile", (file) => {
    const roomId = socket.data.roomId;
    const userId = socket.data.userId;
    if (roomId && userId) {
      io.to(roomId).emit("newFile", file);
    } else {
      console.warn(
        `New file ignored: missing roomId=${roomId} or userId=${userId}`,
      );
    }
  });

  socket.on("fileRead", (data) => {
    const roomId = socket.data.roomId;
    const userId = socket.data.userId;
    if (roomId && userId) {
      io.to(roomId).emit("fileRead", {
        ...data,
        userId,
      });
    } else {
      console.warn(
        `File read ignored: missing roomId=${roomId} or userId=${userId}`,
      );
    }
  });

  socket.on("fileDelete", (data) => {
    const roomId = socket.data.roomId;
    const userId = socket.data.userId;
    if (roomId && userId) {
      io.to(roomId).emit("fileDelete", {
        ...data,
        userId,
      });
    } else {
      console.warn(
        `File delete ignored: missing roomId=${roomId} or userId=${userId}`,
      );
    }
  });

  // Real-time Collaboration Events
  socket.on("collaborative-change", (data) => {
    console.log("📥 Server received collaborative change:", data);
    const { roomId, fileId, userId } = data;
    const socketUserId = socket.data.userId;

    if (roomId && (userId || socketUserId) && fileId) {
      console.log("✅ Broadcasting change to room:", roomId);
      socket.to(roomId).emit("collaborative-change", {
        ...data,
        senderId: socket.id,
        userId: userId || socketUserId,
      });
    } else {
      console.warn(`❌ Collaborative change ignored due to missing data:`, {
        roomId,
        userId: userId || socketUserId,
        fileId,
        socketUserId,
      });
    }
  });

  socket.on("cursor-update", (data) => {
    console.log("📥 Server received cursor update:", data);
    const { roomId, fileId, userId, userName } = data;
    const socketUserId = socket.data.userId;
    const socketUserName = socket.data.userName;

    if (roomId && (userId || socketUserId) && fileId) {
      console.log("✅ Broadcasting cursor to room:", roomId);
      socket.to(roomId).emit("cursor-update", {
        ...data,
        senderId: socket.id,
        userId: userId || socketUserId,
        userName: userName || socketUserName,
      });
    } else {
      console.warn(`❌ Cursor update ignored due to missing data:`, {
        roomId,
        userId: userId || socketUserId,
        fileId,
        socketUserId,
        socketUserName,
      });
    }
  });

  socket.on("request-file-sync", (data) => {
    const { roomId, fileId } = data;
    const requesterId = socket.id;

    if (roomId && fileId) {
      const roomSockets = io.sockets.adapter.rooms.get(roomId);
      if (roomSockets && roomSockets.size > 1) {
        // Find another user in the room to request the file from
        const otherSocketId = [...roomSockets].find((id) => id !== requesterId);
        if (otherSocketId) {
          // Ask another client for the latest version of the file
          io.to(otherSocketId).emit("request-file-sync-from-peer", {
            fileId,
            requesterId,
          });
        }
      }
    }
  });

  socket.on("file-sync", (data) => {
    const { requesterId, fileId, content, version } = data;
    if (requesterId && fileId && content !== undefined) {
      // Send the file content back to the original requester
      io.to(requesterId).emit("file-sync", {
        fileId,
        content,
        version,
      });
    }
  });

  socket.on("statusChange", ({ online }) => {
    const roomId = socket.data.roomId;
    const userId = socket.data.userId;
    if (roomId && userId) {
      socket.to(roomId).emit("userStatus", {
        userId,
        online,
      });
    } else {
      console.warn(
        `Status change ignored: missing roomId=${roomId} or userId=${userId}`,
      );
    }
  });

  socket.on("disconnect", () => {
    const roomId = socket.data.roomId;
    const userId = socket.data.userId;
    console.log(
      `User disconnected: ${socket.id} from room: ${roomId}, userId: ${userId || "(not set)"}`,
    );

    if (roomId && userId) {
      socket.to(roomId).emit("userLeft", {
        userId,
        name: socket.data.userName,
      });
    }
  });
});

dbConnectionPromise.then(() => {
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT} with Socket.IO`);
  });
});
