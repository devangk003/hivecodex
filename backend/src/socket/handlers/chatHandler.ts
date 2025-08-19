import { Server, Socket } from "socket.io";
import {
  ServerToClientEvents,
  ClientToServerEvents,
  InterServerEvents,
  SocketData,
} from "../../types/socket";

// Placeholder for future chat-specific events beyond generic "message"
export function registerChatHandlers(
  io: Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
  socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>
): void {
  // Example: reactions support could be handled here in future
  // socket.on("add-reaction", (data) => { ... })
}


