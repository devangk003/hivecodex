import { Server, Socket } from "socket.io";
import mongoose from "mongoose";
import {
  ServerToClientEvents,
  ClientToServerEvents,
  InterServerEvents,
  SocketData,
  MessagePayload,
} from "../../types/socket";
import { Room, Message } from "../../database/models";

export function registerMessageHandlers(
  io: Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
  socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>
): void {
  socket.on("message", async (msg) => {
    const timestamp = new Date().toISOString();
    try {
      const { roomId, userId, userName } = socket.data || {};
      if (!roomId || !userId) {
        socket.emit("error", { message: "User not in room" });
        return;
      }

      const room = await Room.findOne({ id: roomId });
      if (!room) {
        socket.emit("error", { message: "Room not found" });
        return;
      }

      const message = new Message({
        roomId: room._id,
        senderId: new mongoose.Types.ObjectId(userId),
        senderName: msg.userName || userName,
        content: msg.message,
        timestamp: new Date(),
        messageType: "text",
        isEdited: false,
      });

      await message.save();

      // Broadcast an event to let clients refetch latest messages via HTTP
      io.to(roomId).emit("chat-updated", { roomId, timestamp });
    } catch (error) {
      socket.emit("error", { message: "Failed to send message" });
    }
  });

  // Reaction updates: broadcast only a signal to refetch
  socket.on("reaction-update", async (data: { messageId: string; emoji: string }) => {
    try {
      const { roomId } = socket.data || {};
      if (!roomId) return;
      io.to(roomId).emit("chat-updated", { roomId, timestamp: new Date().toISOString() });
    } catch {}
  });
}


