import { Server, Socket } from "socket.io";
import mongoose from "mongoose";
import { Room } from "../../database/models";
import {
  ServerToClientEvents,
  ClientToServerEvents,
  InterServerEvents,
  SocketData,
  CollaborativeChangePayload,
  TextOperationPayload,
  EditorFileEventData,
  EditorCursorPosition,
} from "../../types/socket";
import { updateUserCursorPosition, setUserTyping, updateUserActivity } from "../../utils/userHelpers";

// In-memory canonical docs per room
interface CanonicalFileState {
  content: string;
  version: number;
  operationsLog: { operations: TextOperationPayload[]; version: number }[];
}

const roomDocuments: Map<string, Map<string, CanonicalFileState>> = new Map();

function getCanonical(socket: Socket, fileId: string): CanonicalFileState | null {
  const { roomId } = socket.data || {};
  if (!roomId) return null;
  let files = roomDocuments.get(roomId);
  if (!files) {
    files = new Map();
    roomDocuments.set(roomId, files);
  }
  let file = files.get(fileId);
  if (!file) {
    file = { content: "", version: 0, operationsLog: [] };
    files.set(fileId, file);
  }
  return file;
}

function applyOperations(content: string, operations: TextOperationPayload[]): string {
  let index = 0;
  let result = "";
  for (const op of operations) {
    if (op.type === 'retain') {
      const len = op.length || 0;
      result += content.slice(index, index + len);
      index += len;
    } else if (op.type === 'insert') {
      result += op.text || "";
    } else if (op.type === 'delete') {
      index += op.length || 0;
    }
  }
  if (index < content.length) {
    result += content.slice(index);
  }
  return result;
}

function transformAgainst(opA: TextOperationPayload[], opB: TextOperationPayload[]): TextOperationPayload[] {
  const a = [...opA];
  const b = [...opB];
  const result: TextOperationPayload[] = [];
  let i = 0, j = 0;
  let aOffset = 0, bOffset = 0;

  const pushRetain = (len: number) => {
    if (len <= 0) return;
    const prev = result[result.length - 1];
    if (prev && prev.type === 'retain') prev.length = (prev.length || 0) + len;
    else result.push({ type: 'retain', length: len });
  };
  const pushInsert = (text: string) => {
    if (!text) return;
    const prev = result[result.length - 1];
    if (prev && prev.type === 'insert') prev.text = (prev.text || '') + text;
    else result.push({ type: 'insert', text });
  };
  const pushDelete = (len: number) => {
    if (len <= 0) return;
    const prev = result[result.length - 1];
    if (prev && prev.type === 'delete') prev.length = (prev.length || 0) + len;
    else result.push({ type: 'delete', length: len });
  };

  let aOp = a[i];
  let bOp = b[j];
  while (aOp || bOp) {
    if (bOp && bOp.type === 'insert') {
      pushRetain((bOp.text || '').length - bOffset);
      j++; bOp = b[j]; bOffset = 0;
      continue;
    }
    if (aOp && aOp.type === 'insert') {
      pushInsert((aOp.text || '').slice(aOffset));
      i++; aOp = a[i]; aOffset = 0;
      continue;
    }
    const aLen = aOp ? (aOp.type !== 'insert' ? (aOp.length || 0) - aOffset : 0) : 0;
    const bLen = bOp ? (bOp.type !== 'insert' ? (bOp.length || 0) - bOffset : 0) : 0;
    if (!bOp || bOp.type === 'retain') {
      if (aOp && aOp.type === 'retain') { pushRetain(aLen); i++; aOp = a[i]; aOffset = 0; }
      else if (aOp && aOp.type === 'delete') { pushDelete(aLen); i++; aOp = a[i]; aOffset = 0; }
      else { j++; bOp = b[j]; bOffset = 0; }
    } else if (bOp.type === 'delete') {
      const consume = Math.min(aLen, bLen);
      if (aOp && aOp.type === 'retain') {
        aOffset += consume;
      } else if (aOp && aOp.type === 'delete') {
        aOffset += consume;
      }
      if (aOffset === (aOp?.length || 0)) { i++; aOp = a[i]; aOffset = 0; }
      if (consume === bLen) { j++; bOp = b[j]; bOffset = 0; } else { bOffset += consume; }
    }
  }
  return result;
}

export function registerEditorHandlers(
  io: Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
  socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>
): void {
  socket.on("collaborative-change", async (data: CollaborativeChangePayload) => {
    console.log('📥 Backend received collaborative-change:', data);
    const { roomId } = socket.data || {};
    if (!roomId) {
      console.log('❌ No roomId in socket data');
      return;
    }
    const { fileId, operations, baseVersion } = data;
    const canonical = getCanonical(socket, fileId);
    if (!canonical) {
      console.log('❌ No canonical state for file:', fileId);
      return;
    }

    console.log('🔄 Processing operations:', operations, 'baseVersion:', baseVersion, 'canonical version:', canonical.version);

    let transformed = operations;
    if (baseVersion < canonical.version) {
      for (const entry of canonical.operationsLog) {
        // Transform only against operations AFTER the client's baseVersion
        if (entry.version > baseVersion) {
          transformed = transformAgainst(transformed, entry.operations);
        }
      }
    }

    const newContent = applyOperations(canonical.content, transformed);
    const oldVersion = canonical.version;
    canonical.version = oldVersion + 1;
    canonical.content = newContent;
    canonical.operationsLog.push({ operations: transformed, version: canonical.version });

    // Persist the collaborative change to the database
    try {
      const room = await Room.findOne({ 'files.fileId': new mongoose.Types.ObjectId(fileId) });
      if (room) {
        const fileIndex = room.files.findIndex((f: any) => f.fileId?.toString() === fileId);
        if (fileIndex !== -1) {
          const file = room.files[fileIndex] as any;
          file.content = newContent;
          file.lastModified = new Date();
          file.lastModifiedBy = socket.data?.userId;
          await room.save();
          console.log('💾 Saved collaborative change to database for file:', fileId);
        }
      }
    } catch (error) {
      console.error('❌ Failed to save collaborative change to database:', error);
    }

    console.log('✅ Sending ack and broadcasting change to room:', roomId);
    socket.emit("collaborative-change-ack", { fileId, ackVersion: canonical.version });
    socket.to(roomId).emit("collaborative-change", {
      ...data,
      operations: transformed,
      baseVersion: oldVersion,
      appliedVersion: canonical.version,
    });
    updateUserActivity(socket.id);
  });

  socket.on("cursor-update", (data) => {
    console.log('👆 Backend received cursor-update:', data);
    const { roomId } = socket.data || {};
    if (!roomId) {
      console.log('❌ No roomId for cursor update');
      return;
    }
    updateUserCursorPosition(socket.id, data.cursorPosition);
    console.log('✅ Broadcasting cursor update to room:', roomId);
    socket.to(roomId).emit("cursor-update", data);
    updateUserActivity(socket.id);
  });

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

  socket.on("request-file-sync", (data: { fileId: string }) => {
    const { roomId } = socket.data || {};
    if (!roomId) return;
    const canonical = getCanonical(socket, data.fileId);
    if (!canonical) return;
    socket.emit("file-sync", {
      fileId: data.fileId,
      content: canonical.content,
      version: canonical.version,
    });
    updateUserActivity(socket.id);
  });

  socket.on("file-sync", (data: any) => {
    const { roomId } = socket.data || {};
    if (!roomId) return;
    const { fileId, content, version } = data || {};
    if (fileId && typeof content === 'string') {
      const canonical = getCanonical(socket, fileId);
      if (canonical) {
        // Seed canonical if empty, or accept newer version
        if ((canonical.version === 0 && canonical.content === "") || (typeof version === 'number' && version > canonical.version)) {
          canonical.content = content;
          canonical.version = typeof version === 'number' ? version : canonical.version;
        }
        socket.to(roomId).emit("file-sync", { fileId, content: canonical.content, version: canonical.version });
        updateUserActivity(socket.id);
        return;
      }
    }
    // Fallback: just forward
    socket.to(roomId).emit("file-sync", data);
    updateUserActivity(socket.id);
  });

  // Whiteboard / drawing collaboration
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

  // File editing status tracking
  socket.on('start-editing', (data: EditorFileEventData) => {
    const { roomId } = socket.data || {};
    if (!roomId) return;
    
    // Broadcast to other users in the room
    socket.to(roomId).emit('user-started-editing', {
      fileId: data.fileId,
      userId: data.userId,
      username: data.username,
      cursorPosition: data.cursorPosition
    });
    updateUserActivity(socket.id);
  });

  socket.on('stop-editing', (data: { fileId: string; userId: string }) => {
    const { roomId } = socket.data || {};
    if (!roomId) return;
    
    // Broadcast to other users in the room
    socket.to(roomId).emit('user-stopped-editing', {
      fileId: data.fileId,
      userId: data.userId
    });
    updateUserActivity(socket.id);
  });

  socket.on('update-cursor', (data: { fileId: string; userId: string; cursorPosition: EditorCursorPosition }) => {
    const { roomId } = socket.data || {};
    if (!roomId) return;
    
    // Broadcast to other users in the room
    socket.to(roomId).emit('user-cursor-update', {
      fileId: data.fileId,
      userId: data.userId,
      cursorPosition: data.cursorPosition
    });
    updateUserActivity(socket.id);
  });

  socket.on('file-saved', (data: { fileId: string; userId: string; timestamp: Date }) => {
    const { roomId } = socket.data || {};
    if (!roomId) return;
    
    // Broadcast to other users in the room
    socket.to(roomId).emit('file-saved', {
      fileId: data.fileId,
      userId: data.userId,
      timestamp: data.timestamp
    });
    updateUserActivity(socket.id);
  });
}


