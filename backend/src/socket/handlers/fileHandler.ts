import { Server, Socket } from "socket.io";
import {
  ServerToClientEvents,
  ClientToServerEvents,
  InterServerEvents,
  SocketData,
} from "../../types/socket";
import { updateUserCurrentFile, updateUserActivity } from "../../utils/userHelpers";

// Simple in-memory lock set per room for destructive ops
const roomFileLocks: Map<string, Set<string>> = new Map();

function lockFile(roomId: string, pathOrId: string): boolean {
  let locks = roomFileLocks.get(roomId);
  if (!locks) {
    locks = new Set();
    roomFileLocks.set(roomId, locks);
  }
  if (locks.has(pathOrId)) return false;
  locks.add(pathOrId);
  return true;
}

function unlockFile(roomId: string, pathOrId: string): void {
  const locks = roomFileLocks.get(roomId);
  if (locks) {
    locks.delete(pathOrId);
    if (locks.size === 0) roomFileLocks.delete(roomId);
  }
}

export function registerFileHandlers(
  io: Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
  socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>
): void {
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

  socket.on("fileDelete", async (data) => {
    const { roomId } = socket.data || {};
    if (!roomId) return;
    const key = data.filePath || data.fileName;
    if (!key) return;
    if (!lockFile(roomId, key)) {
      socket.emit("error", { message: "File is locked for delete by another user" });
      return;
    }
    try {
      socket.to(roomId).emit("fileDelete", data);
    } finally {
      unlockFile(roomId, key);
    }
    updateUserActivity(socket.id);
  });

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

  socket.on("file-renamed", async (data) => {
    const { roomId } = socket.data || {};
    if (!roomId) return;
    const key = data.oldPath || data.filePath;
    if (!key) return;
    if (!lockFile(roomId, key)) {
      socket.emit("error", { message: "File is locked for rename by another user" });
      return;
    }
    try {
      socket.to(roomId).emit("file-renamed", data);
    } finally {
      unlockFile(roomId, key);
    }
    updateUserActivity(socket.id);
  });
}


