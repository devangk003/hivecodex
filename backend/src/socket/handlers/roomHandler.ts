import { Server, Socket } from "socket.io";
import mongoose from "mongoose";
import {
  ServerToClientEvents,
  ClientToServerEvents,
  InterServerEvents,
  SocketData,
} from "../../types/socket";
import { UserStatus } from "../../types/user";
import {
  addUser,
  removeUser,
  getUsersInRoom,
  updateUserActivity,
} from "../../utils/userHelpers";
import { User, Room } from "../../database/models";

export function registerRoomHandlers(
  io: Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
  socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>
): void {
  // Join room
  socket.on("joinRoom", async ({ roomId, userId, userName }) => {
    const timestamp = new Date().toISOString();

    try {
      if (socket.data?.roomId === roomId && socket.data?.userId === userId) {
        return;
      }

      socket.join(roomId);

      socket.data = {
        roomId,
        userId,
        userName,
        joinedAt: new Date(),
      };

      addUser({
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
        joinedAt: new Date(),
      });

      await User.findByIdAndUpdate(userId, { activityStatus: "online" });
      // Emit status change to room
      io.to(roomId).emit("statusChange", {
  userId,
  userName,
  online: true,
  timestamp,
      });

      const room = await Room.findOne({ id: roomId });
      if (room) {
        const already = room.participantList.find(
          (p) => p.userId?.toString() === userId
        );
        if (!already) {
          const user = await User.findById(userId);
          if (user) {
            room.participantList.push({
              userId: new mongoose.Types.ObjectId(userId),
              name: userName,
              profilePicId: user.profilePicId,
              role: "member",
              joinedAt: new Date(),
            });
            room.participants = room.participantList.length;
            await room.save();
          }
        }
      }

      // Emit granular userJoined event with complete user profile data
      const user = await User.findById(userId);
      if (user) {
        socket.to(roomId).emit("userJoined", {
          userId,
          userName: userName as string,
          profilePicId: user.profilePicId?.toString(),
          email: user.email,
          status: 'in-room',
          joinedAt: new Date(),
          timestamp,
        });
      }

      // Still emit roomParticipants for backward compatibility, but frontend should rely on granular events
      const participants = getUsersInRoom(roomId);
      io.to(roomId).emit("roomParticipants", participants);
    } catch (error) {
      socket.emit("error", { message: "Failed to join room" });
    }
  });

  // Explicit leave-room (frontend emits this)
  socket.on("leave-room", async (roomId: string) => {
    try {
      const { userId, userName } = socket.data || {};
      if (!roomId || !userId) return;

      socket.leave(roomId);
      removeUser(socket.id);
      updateUserActivity(socket.id);

      // Do NOT set user as away here; only remove from room

      // Update DB participant list
      const room = await Room.findOne({ id: roomId });
      if (room) {
        room.participantList = room.participantList.filter(
          (p: any) => p.userId?.toString() !== String(userId)
        );
        room.participants = room.participantList.length;
        await room.save();
      }

      // Emit granular userLeft event with user data
      socket.to(roomId).emit("userLeft", {
        userId,
        userName: (userName as string) || "",
        status: 'offline',
        leftAt: new Date(),
        timestamp: new Date().toISOString(),
      });

      // Keep backward compatibility events
      socket.to(roomId).emit("userDisconnected", {
        userId,
        userName: (userName as string) || "",
        timestamp: new Date().toISOString(),
      });

      io.to(roomId).emit("statusChange", {
        userId,
        userName: (userName as string) || "",
        online: false,
        timestamp: new Date().toISOString(),
      });

      const participants = getUsersInRoom(roomId);
      io.to(roomId).emit("roomParticipants", participants);
    } catch {}
  });

  // Status change within a room context
  socket.on("statusChange", ({ online }) => {
    const { roomId, userId, userName } = socket.data || {};
    if (!roomId || !userId) return;

    updateUserActivity(socket.id);
    User.findByIdAndUpdate(userId, { activityStatus: online ? "online" : "offline" }).catch(
      () => {}
    );

    socket.to(roomId).emit("statusChange", {
      userId,
      userName: (userName as string) || "",
      online,
      timestamp: new Date().toISOString(),
    });
  });

  // Disconnect cleanup
  socket.on("disconnect", async () => {
    const { roomId, userId, userName } = socket.data || {};
    if (!roomId || !userId) return;

    removeUser(socket.id);
    await User.findByIdAndUpdate(userId, { activityStatus: "offline" }).catch(() => {});

    // Emit status change to room
    io.to(roomId).emit("statusChange", {
  userId,
  userName: (userName as string) || "",
  online: false,
  timestamp: new Date().toISOString(),
    });

    // Emit granular userLeft event on disconnect
    setTimeout(() => {
      socket.to(roomId).emit("userLeft", {
        userId,
        userName: (userName as string) || "",
        status: 'offline',
        leftAt: new Date(),
        timestamp: new Date().toISOString(),
      });
      
      // Keep backward compatibility
      socket.to(roomId).emit("userDisconnected", {
        userId,
        userName: (userName as string) || "",
        timestamp: new Date().toISOString(),
      });
    }, 1000);
  });
}


