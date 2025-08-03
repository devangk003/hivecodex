import { Server } from "socket.io";
import { 
  ServerToClientEvents, 
  ClientToServerEvents, 
  InterServerEvents, 
  SocketData,
  MessagePayload
} from "../types/socket";
import {
  addUser,
  removeUser,
  getUserBySocketId,
  getUsersInRoom,
  updateUserCurrentFile,
  updateUserCursorPosition,
  setUserTyping,
  getTypingUsersInRoom,
  updateUserActivity,
  broadcastToRoom,
  cleanupInactiveUsers
} from "../utils/userHelpers";
import { User as UserType, UserStatus } from "../types/user";
import { User, Room, Message } from "../database/models";
import mongoose from "mongoose";

/**
 * Initialize all socket event handlers
 */
export function initializeSocketHandlers(
  io: Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>
): void {
  
  // Configure socket.io server with better connection handling
  io.engine.on("connection_error", (err) => {
    console.log("Socket connection error:", err.req);
    console.log("Socket connection error code:", err.code);
    console.log("Socket connection error message:", err.message);
    console.log("Socket connection error context:", err.context);
  });

  io.on("connection", (socket) => {
    const timestamp = new Date().toISOString();
    console.log(`\n🔌 [${timestamp}] Socket connected: ${socket.id}`);
    console.log(`📍 Socket IP: ${socket.handshake.address}`);
    console.log(`🔑 Socket Auth: ${JSON.stringify(socket.handshake.auth)}`);
    console.log(`🌐 Socket Headers: ${JSON.stringify(socket.handshake.headers)}`);

    // Set up connection monitoring
    let isConnected = true;
    let heartbeatInterval: NodeJS.Timeout;

    // Heartbeat mechanism to detect dead connections
    const startHeartbeat = () => {
      heartbeatInterval = setInterval(() => {
        if (isConnected && socket.connected) {
          socket.emit('ping');
        } else {
          clearInterval(heartbeatInterval);
        }
      }, 30000); // Send ping every 30 seconds
    };

    // Handle pong response
    socket.on('pong', () => {
      // Connection is alive
    });

    // Start heartbeat
    startHeartbeat();

    // Join room handler
    socket.on("joinRoom", async ({ roomId, userId, userName }) => {
      const timestamp = new Date().toISOString();
      console.log(`\n🏠 [${timestamp}] JOIN ROOM REQUEST`);
      console.log(`🔗 Socket: ${socket.id}`);
      console.log(`🏠 Room: ${roomId}`);
      console.log(`👤 User: ${userName} (ID: ${userId})`);
      
      try {
        // Prevent duplicate joins - check if user is already in this room
        if (socket.data?.roomId === roomId && socket.data?.userId === userId) {
          console.log(`⚠️  [${timestamp}] User ${userName} already in room ${roomId}, skipping join`);
          return;
        }

        console.log(`✅ [${timestamp}] Processing join for ${userName} in room ${roomId}`);
        
        // Join the socket room
        socket.join(roomId);
        
        // Store user data in socket
        socket.data = {
          roomId,
          userId,
          userName,
          joinedAt: new Date()
        };

        // Add user to active users
        const user: UserType = {
          username: userName,
          roomId,
          status: "connected" as any,
          activityStatus: UserStatus.ONLINE,
          cursorPosition: 0,
          typing: false,
          currentFile: null,
          socketId: socket.id,
          userId: new mongoose.Types.ObjectId(userId),
          lastSeen: new Date(),
          joinedAt: new Date()
        };

        addUser(user);

        // Update user status in database
        await User.findByIdAndUpdate(userId, { 
          activityStatus: "online" 
        });

        // Get room details
        const room = await Room.findOne({ id: roomId });
        if (room) {
          // Update participant list if user not already there
          const existingParticipant = room.participantList.find(
            p => p.userId?.toString() === userId
          );
          
          if (!existingParticipant) {
            const user = await User.findById(userId);
            if (user) {
              room.participantList.push({
                userId: new mongoose.Types.ObjectId(userId),
                name: userName,
                profilePicId: user.profilePicId,
                role: 'member',
                joinedAt: new Date()
              });
              room.participants = room.participantList.length;
              await room.save();
            }
          }
        }

        // Broadcast to other users in the room
        socket.to(roomId).emit("userJoined", {
          userId,
          userName,
          timestamp: new Date().toISOString()
        });

        // Send updated participant list to everyone in the room
        const participants = getUsersInRoom(roomId);
        io.to(roomId).emit("roomParticipants", participants);

        console.log(`User ${userName} joined room ${roomId} successfully`);
        
      } catch (error) {
        console.error("Error joining room:", error);
        socket.emit("error", { message: "Failed to join room" });
      }
    });

    // Chat message handler
    socket.on("message", async (msg) => {
      const timestamp = new Date().toISOString();
      console.log(`\n💬 [${timestamp}] MESSAGE RECEIVED VIA SOCKET`);
      console.log(`🔗 Socket: ${socket.id}`);
      console.log(`📝 Message: ${JSON.stringify(msg, null, 2)}`);
      
      try {
        const { roomId, userId, userName } = socket.data || {};
        if (!roomId || !userId) {
          console.log(`❌ [${timestamp}] User not in room - Socket data:`, socket.data);
          socket.emit("error", { message: "User not in room" });
          return;
        }

        console.log(`✅ [${timestamp}] Processing message from user ${userId} (${userName}) in room ${roomId}`);

        // Find room by string ID and get mongoose.Types.ObjectId
        const room = await Room.findOne({ id: roomId });
        if (!room) {
          console.log(`❌ [${timestamp}] Room not found: ${roomId}`);
          socket.emit("error", { message: "Room not found" });
          return;
        }

        console.log(`💾 [${timestamp}] Saving message to database`);
        
        // Save message to database - using MessagePayload format
        const messageContent = msg.message;
        const senderName = msg.userName || userName;
        
        const message = new Message({
          roomId: room._id,
          senderId: new mongoose.Types.ObjectId(userId),
          senderName: senderName,
          content: messageContent,
          timestamp: new Date(),
          messageType: "text",
          isEdited: false
        });

        await message.save();
        console.log(`✅ [${timestamp}] Message saved with ID: ${message._id}`);

        // Format message for broadcasting according to MessagePayload interface
        const formattedMessage: MessagePayload = {
          id: message._id.toString(),
          message: message.content,
          userName: message.senderName,
          userId: message.senderId.toString(),
          roomId: roomId,
          timestamp: message.timestamp.toISOString()
        };

        console.log(`📡 [${timestamp}] Broadcasting message to room: ${roomId}`);
        
        // Broadcast to all users in the room
        io.to(roomId).emit("message", formattedMessage);
        
        console.log(`✅ [${timestamp}] Message broadcasted successfully`);
      } catch (error) {
        console.error(`💥 [${timestamp}] Error handling message:`, error);
        socket.emit("error", { message: "Failed to send message" });
      }
    });

    // Typing indicators
    socket.on("typing-start", (roomId) => {
      const { userId, userName } = socket.data || {};
      if (!userId || !userName) return;

      setUserTyping(socket.id, true);
      socket.to(roomId).emit("typing-start", { userId, userName });
      updateUserActivity(socket.id);
    });

    socket.on("typing-stop", (roomId) => {
      const { userId, userName } = socket.data || {};
      if (!userId || !userName) return;

      setUserTyping(socket.id, false);
      socket.to(roomId).emit("typing-stop", { userId, userName });
      updateUserActivity(socket.id);
    });

    // File operations
    socket.on("newFile", (file) => {
      const { roomId } = socket.data || {};
      if (!roomId) return;

      socket.to(roomId).emit("newFile", file);
      updateUserActivity(socket.id);
    });

    socket.on("fileRead", (data) => {
      const { roomId } = socket.data || {};
      if (!roomId) return;

      updateUserCurrentFile(socket.id, data.fileName);
      socket.to(roomId).emit("fileRead", data);
      updateUserActivity(socket.id);
    });

    socket.on("fileDelete", (data) => {
      const { roomId } = socket.data || {};
      if (!roomId) return;

      socket.to(roomId).emit("fileDelete", data);
      updateUserActivity(socket.id);
    });

    // Collaborative editing
    socket.on("collaborative-change", (data) => {
      const { roomId } = socket.data || {};
      if (!roomId) return;

      socket.to(roomId).emit("collaborative-change", data);
      updateUserActivity(socket.id);
    });

    socket.on("cursor-update", (data) => {
      const { roomId } = socket.data || {};
      if (!roomId) return;

      updateUserCursorPosition(socket.id, data.cursorPosition);
      socket.to(roomId).emit("cursor-update", data);
      updateUserActivity(socket.id);
    });

    // File synchronization
    socket.on("request-file-sync", (data) => {
      const { roomId } = socket.data || {};
      if (!roomId) return;

      socket.to(roomId).emit("request-file-sync", data);
      updateUserActivity(socket.id);
    });

    socket.on("file-sync", (data) => {
      const { roomId } = socket.data || {};
      if (!roomId) return;

      socket.to(roomId).emit("file-sync", data);
      updateUserActivity(socket.id);
    });

    // Status changes
    socket.on("statusChange", ({ online }) => {
      const { roomId, userId, userName } = socket.data || {};
      if (!roomId || !userId) return;

      const status = online ? "online" : "offline";
      
      // Update user status in memory and database
      updateUserActivity(socket.id);
      User.findByIdAndUpdate(userId, { activityStatus: status }).catch(console.error);

      // Broadcast status change
      socket.to(roomId).emit("statusChange", {
        userId,
        userName,
        online,
        timestamp: new Date().toISOString()
      });
    });

    // Disconnect handler
    socket.on("disconnect", (reason) => {
      isConnected = false;
      clearInterval(heartbeatInterval);
      
      const { roomId, userId, userName } = socket.data || {};
      const timestamp = new Date().toISOString();
      
      console.log(`\n🔌❌ [${timestamp}] SOCKET DISCONNECTED`);
      console.log(`🔗 Socket: ${socket.id}`);
      console.log(`📍 Reason: ${reason}`);
      console.log(`👤 User: ${userName} (ID: ${userId})`);
      console.log(`🏠 Room: ${roomId}`);
      
      if (roomId && userId && userName) {
        console.log(`🧹 [${timestamp}] Cleaning up user ${userName} from room ${roomId}`);
        
        // Remove user from active users
        removeUser(socket.id);
        
        // Update user status in database
        User.findByIdAndUpdate(userId, { 
          activityStatus: "offline" 
        }).catch(console.error);

        // Notify other users with a delay to prevent rapid disconnect/reconnect spam
        setTimeout(() => {
          console.log(`📢 [${new Date().toISOString()}] Broadcasting user disconnect: ${userName}`);
          socket.to(roomId).emit("userDisconnected", {
            userId,
            userName,
            timestamp: new Date().toISOString()
          });
        }, 1000); // 1 second delay

        console.log(`✅ [${timestamp}] User ${userName} cleanup completed for room ${roomId}`);
      }
    });

    // Manual cleanup on any error
    socket.on("error", (error) => {
      console.log("Socket error:", error);
      isConnected = false;
      clearInterval(heartbeatInterval);
    });

    // Drawing/Whiteboard events (NEW FEATURE)
    socket.on("drawing-update", (data) => {
      const { roomId } = socket.data || {};
      if (!roomId) return;

      socket.to(roomId).emit("drawing-update", data);
      updateUserActivity(socket.id);
    });

    socket.on("request-drawing", (data) => {
      const { roomId } = socket.data || {};
      if (!roomId) return;

      socket.to(roomId).emit("request-drawing", data);
      updateUserActivity(socket.id);
    });

    socket.on("sync-drawing", (data) => {
      const { roomId } = socket.data || {};
      if (!roomId) return;

      socket.to(roomId).emit("sync-drawing", data);
      updateUserActivity(socket.id);
    });

    // Enhanced file structure sync (NEW FEATURE)
    socket.on("sync-file-structure", (data) => {
      const { roomId } = socket.data || {};
      if (!roomId) return;

      socket.to(roomId).emit("sync-file-structure", data);
      updateUserActivity(socket.id);
    });

    socket.on("directory-created", (data) => {
      const { roomId } = socket.data || {};
      if (!roomId) return;

      socket.to(roomId).emit("directory-created", data);
      updateUserActivity(socket.id);
    });

    socket.on("directory-updated", (data) => {
      const { roomId } = socket.data || {};
      if (!roomId) return;

      socket.to(roomId).emit("directory-updated", data);
      updateUserActivity(socket.id);
    });

    socket.on("directory-deleted", (data) => {
      const { roomId } = socket.data || {};
      if (!roomId) return;

      socket.to(roomId).emit("directory-deleted", data);
      updateUserActivity(socket.id);
    });

    socket.on("file-created", (data) => {
      const { roomId } = socket.data || {};
      if (!roomId) return;

      socket.to(roomId).emit("file-created", data);
      updateUserActivity(socket.id);
    });

    socket.on("file-updated", (data) => {
      const { roomId } = socket.data || {};
      if (!roomId) return;

      socket.to(roomId).emit("file-updated", data);
      updateUserActivity(socket.id);
    });

    socket.on("file-renamed", (data) => {
      const { roomId } = socket.data || {};
      if (!roomId) return;

      socket.to(roomId).emit("file-renamed", data);
      updateUserActivity(socket.id);
    });
  });

  // Cleanup inactive users every 5 minutes
  setInterval(() => {
    cleanupInactiveUsers(30); // Remove users inactive for 30 minutes
  }, 5 * 60 * 1000);
}
