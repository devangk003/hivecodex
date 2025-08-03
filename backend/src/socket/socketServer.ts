import { Server } from "socket.io";
import { 
  ServerToClientEvents, 
  ClientToServerEvents, 
  InterServerEvents, 
  SocketData
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
        const updatedUser = await User.findByIdAndUpdate(
          userId, 
          { 
            activityStatus: UserStatus.IN_ROOM,
            currentRoomId: roomId,
            lastLogin: new Date()
          },
          { new: true }
        );

        // Update joined rooms history
        if (updatedUser) {
          const existingRoomIndex = updatedUser.joinedRooms?.findIndex(
            room => room.roomId === roomId
          );

          if (existingRoomIndex !== undefined && existingRoomIndex >= 0) {
            // Update existing room entry
            updatedUser.joinedRooms[existingRoomIndex].lastJoined = new Date();
            updatedUser.joinedRooms[existingRoomIndex].joinCount += 1;
          } else {
            // Add new room to history
            const room = await Room.findOne({ id: roomId });
            if (room) {
              if (!updatedUser.joinedRooms) {
                updatedUser.joinedRooms = [];
              }
              updatedUser.joinedRooms.push({
                roomId: roomId,
                roomName: room.name,
                lastJoined: new Date(),
                joinCount: 1
              });
            }
          }
          await updatedUser.save();
        }

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
                profilePicId: user.profilePicId
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
        // Include all users who have ever joined this room with their current status
        const roomData = await Room.findOne({ id: roomId });
        if (roomData) {
          const participantIds = roomData.participantList.map(p => p.userId);
          console.log(`🔍 [${timestamp}] Debug participant lookup:`, {
            roomId,
            participantListLength: roomData.participantList.length,
            participantIds: participantIds.map(id => id?.toString()),
            participantListRaw: roomData.participantList
          });
          
          const participantUsers = await User.find({ _id: { $in: participantIds } })
            .select('name profilePicId activityStatus currentRoomId')
            .lean();

          console.log(`🔍 [${timestamp}] Debug user lookup results:`, {
            foundUsers: participantUsers.length,
            expectedUsers: participantIds.length,
            users: participantUsers.map(u => ({
              id: u._id?.toString(),
              name: u.name,
              profilePicId: u.profilePicId,
              activityStatus: u.activityStatus
            }))
          });

          const participantsWithStatus = participantUsers
            .filter(user => user._id && user.name) // Filter out users with missing essential data
            .map(user => {
            const userStatus = user.activityStatus || 'offline';
            
            // Map backend UserStatus to frontend status types
            const getGlobalStatus = (status: string): 'online' | 'offline' | 'away' => {
              switch (status) {
                case 'online':
                case 'busy':
                case 'idle':
                case 'in-room':
                  return 'online';
                case 'away':
                  return 'away';
                default:
                  return 'offline';
              }
            };

            const getRoomStatus = (status: string, currentRoomId?: string): 'online' | 'away' | 'in-room' | 'offline' => {
              if (currentRoomId === roomId) {
                // User is in this room
                switch (status) {
                  case 'online':
                  case 'busy':
                  case 'idle':
                  case 'in-room':
                    return 'in-room';
                  case 'away':
                    return 'away';
                  default:
                    return 'offline';
                }
              } else {
                // User is not in this room
                switch (status) {
                  case 'online':
                  case 'busy':
                  case 'idle':
                    return 'online';
                  case 'away':
                    return 'away';
                  case 'in-room':
                    return 'in-room'; // They're in a different room
                  default:
                    return 'offline';
                }
              }
            };

            const globalStatus = getGlobalStatus(userStatus);
            const roomStatus = getRoomStatus(userStatus, user.currentRoomId);
            const isOnline = globalStatus === 'online' || globalStatus === 'away';
            
            return {
              userId: user._id,
              userName: user.name,
              profilePicId: user.profilePicId,
              globalStatus: globalStatus,
              roomStatus: roomStatus,
              currentRoomId: user.currentRoomId,
              lastSeen: new Date(),
              isInSameRoom: user.currentRoomId === roomId
            };
          });

          console.log(`🔍 [${timestamp}] Debug final participants data:`, {
            participantsWithStatusLength: participantsWithStatus.length,
            participantsWithStatus: participantsWithStatus.map(p => ({
              userId: p.userId?.toString(),
              userName: p.userName,
              profilePicId: p.profilePicId,
              globalStatus: p.globalStatus,
              roomStatus: p.roomStatus
            }))
          });

          io.to(roomId).emit("roomParticipants", participantsWithStatus);
        }

        console.log(`User ${userName} joined room ${roomId} successfully`);
        
      } catch (error) {
        console.error("Error joining room:", error);
        socket.emit("error", { message: "Failed to join room" });
      }
    });

    // Typing indicators
    socket.on("typing-start", (roomId) => {
      const { userId, userName } = socket.data || {};
      if (!userId || !userName) return;

      setUserTyping(socket.id, true);
      socket.to(roomId).emit("typing-update", { userId, userName, isTyping: true });
      updateUserActivity(socket.id);
    });

    socket.on("typing-stop", (roomId) => {
      const { userId, userName } = socket.data || {};
      if (!userId || !userName) return;

      setUserTyping(socket.id, false);
      socket.to(roomId).emit("typing-update", { userId, userName, isTyping: false });
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
    socket.on("statusChange", async ({ online }) => {
      const { roomId, userId, userName } = socket.data || {};
      if (!roomId || !userId || !userName) return;

      const activityStatus = online ? UserStatus.IN_ROOM : UserStatus.OFFLINE;
      
      try {
        // Update user status in database (like message persistence)
        await User.findByIdAndUpdate(userId, { activityStatus });
        
        console.log(`✅ User ${userName} (${userId}) status updated to: ${activityStatus}`);
        
        // Broadcast refresh event to ALL connected users (like message broadcast)
        io.emit('user-status-refresh', {
          userId,
          userName,
          activityStatus,
          timestamp: new Date().toISOString(),
          roomId
        });
        
        console.log(`📡 Broadcasted status refresh for user ${userName} to all connected clients`);
        
      } catch (error) {
        console.error("Error updating user status:", error);
      }
      
      // Update user activity in memory
      updateUserActivity(socket.id);
    });

    // Disconnect handler
    socket.on("disconnect", async (reason) => {
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
        
        // Stop typing indicator if user was typing
        setUserTyping(socket.id, false);
        socket.to(roomId).emit("typing-update", { userId, userName, isTyping: false });
        
        // Remove user from active users
        removeUser(socket.id);
        
        // Update user status in database
        await User.findByIdAndUpdate(userId, { 
          activityStatus: UserStatus.OFFLINE,
          currentRoomId: null
        });

        // Broadcast status refresh event to all connected users
        io.emit('user-status-refresh', {
          userId,
          userName,
          activityStatus: UserStatus.OFFLINE,
          timestamp: new Date().toISOString(),
          roomId
        });
        
        console.log(`📡 Broadcasted status refresh for disconnected user ${userName}`);

        // Notify other users with a delay to prevent rapid disconnect/reconnect spam
        setTimeout(async () => {
          console.log(`📢 [${new Date().toISOString()}] Broadcasting user disconnect: ${userName}`);
          socket.to(roomId).emit("userDisconnected", {
            userId,
            userName,
            timestamp: new Date().toISOString()
          });

          // Send updated participant list with current statuses
          const roomData = await Room.findOne({ id: roomId });
          if (roomData) {
            const participantIds = roomData.participantList.map(p => p.userId);
            const participantUsers = await User.find({ _id: { $in: participantIds } })
              .select('name profilePicId activityStatus currentRoomId')
              .lean();

            const participantsWithStatus = participantUsers
              .filter(user => user._id && user.name) // Filter out users with missing essential data
              .map(user => {
              const userStatus = user.activityStatus || 'offline';
              
              // Map backend UserStatus to frontend status types
              const getGlobalStatus = (status: string): 'online' | 'offline' | 'away' => {
                switch (status) {
                  case 'online':
                  case 'busy':
                  case 'idle':
                  case 'in-room':
                    return 'online';
                  case 'away':
                    return 'away';
                  default:
                    return 'offline';
                }
              };

              const getRoomStatus = (status: string, currentRoomId?: string): 'online' | 'away' | 'in-room' | 'offline' => {
                if (currentRoomId === roomId) {
                  // User is in this room
                  switch (status) {
                    case 'online':
                    case 'busy':
                    case 'idle':
                    case 'in-room':
                      return 'in-room';
                    case 'away':
                      return 'away';
                    default:
                      return 'offline';
                  }
                } else {
                  // User is not in this room
                  switch (status) {
                    case 'online':
                    case 'busy':
                    case 'idle':
                      return 'online';
                    case 'away':
                      return 'away';
                    case 'in-room':
                      return 'in-room'; // They're in a different room
                    default:
                      return 'offline';
                  }
                }
              };

              const globalStatus = getGlobalStatus(userStatus);
              const roomStatus = getRoomStatus(userStatus, user.currentRoomId);
              
              return {
                userId: user._id,
                userName: user.name,
                profilePicId: user.profilePicId,
                globalStatus: globalStatus,
                roomStatus: roomStatus,
                currentRoomId: user.currentRoomId,
                lastSeen: new Date(),
                isInSameRoom: user.currentRoomId === roomId
              };
            });

            io.to(roomId).emit("roomParticipants", participantsWithStatus);
          }
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
