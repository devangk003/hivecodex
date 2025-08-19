import { Server } from "socket.io";
import {
  ServerToClientEvents,
  ClientToServerEvents,
  InterServerEvents,
  SocketData,
} from "../types/socket";
import { cleanupInactiveUsers } from "../utils/userHelpers";
import { registerRoomHandlers } from "./handlers/roomHandler";
import { registerFileHandlers } from "./handlers/fileHandler";
import { registerEditorHandlers } from "./handlers/editorHandler";
import { registerMessageHandlers } from "./handlers/messageHandler";
import { registerChatHandlers } from "./handlers/chatHandler";

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

    // Connection monitoring
    let isConnected = true;
    let heartbeatInterval: NodeJS.Timeout;

    const startHeartbeat = () => {
      heartbeatInterval = setInterval(() => {
        if (isConnected && socket.connected) {
          socket.emit("ping");
        } else {
          clearInterval(heartbeatInterval);
        }
      }, 30000);
    };

    socket.on("pong", () => {});

    startHeartbeat();

    // Delegate to modular handlers
    registerRoomHandlers(io, socket);
    registerFileHandlers(io, socket);
    registerEditorHandlers(io, socket);
    registerMessageHandlers(io, socket);
    registerChatHandlers(io, socket);

    socket.on("disconnect", () => {
      isConnected = false;
      clearInterval(heartbeatInterval);
    });

    socket.on("error", () => {
      isConnected = false;
      clearInterval(heartbeatInterval);
    });
  });

  // Cleanup inactive users every 5 minutes
  setInterval(() => {
    cleanupInactiveUsers(30); // Remove users inactive for 30 minutes
  }, 5 * 60 * 1000);
}
