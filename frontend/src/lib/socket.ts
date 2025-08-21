import io, { Socket } from 'socket.io-client';
import { Message, Participant, FileItem, User } from './api';
import { CollaborativeChange, UserCursor } from './collaboration';
import { SOCKET_EVENTS } from '@/constants';

// Use localhost for development - change to LAN IP if needed for cross-device testing
const SOCKET_URL = 'http://localhost:5000';

class SocketService {
  socket: Socket | null = null;
  private roomId: string | null = null;
  private static instance: SocketService;
  private lastJoinAttempt: { roomId: string; timestamp: number } | null = null;
  private readonly JOIN_COOLDOWN = 2000; // 2 seconds between join attempts

  constructor() {
    if (SocketService.instance) {
      return SocketService.instance;
    }
    SocketService.instance = this;
  }

  static getInstance(): SocketService {
    if (!SocketService.instance) {
      SocketService.instance = new SocketService();
    }
    return SocketService.instance;
  }

  // Expose the underlying socket instance (read-only)
  getSocket(): Socket | null {
    return this.socket;
  }

  isConnected(): boolean {
    return this.socket && this.socket.connected;
  }

  connect(token: string) {
    console.log(`🔌 [${new Date().toISOString()}] Attempting socket connection...`);
    console.log(`📍 Socket URL: ${SOCKET_URL}`);
    console.log(`🔑 Token: ${token ? 'Present' : 'Missing'}`);
    
    // Don't create multiple connections
    if (this.socket && this.socket.connected) {
      console.log(`✅ [${new Date().toISOString()}] Socket already connected, reusing connection`);
      return this.socket;
    }

    // Disconnect existing socket if it exists
    if (this.socket) {
      console.log(`🔄 [${new Date().toISOString()}] Disconnecting existing socket before reconnecting`);
      this.socket.disconnect();
    }

    console.log(`🚀 [${new Date().toISOString()}] Creating new socket connection...`);
    this.socket = io(SOCKET_URL, {
      auth: {
        token: token,
      },
      // Connection stability settings
      timeout: 20000,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      randomizationFactor: 0.5,
      autoConnect: true,
      forceNew: false,
    });

    // Handle connection events
    this.socket.on('connect', () => {
      console.log(`✅ [${new Date().toISOString()}] Socket connected successfully - ID: ${this.socket?.id}`);
    });

    this.socket.on('disconnect', (reason) => {
      console.log(`🔌❌ [${new Date().toISOString()}] Socket disconnected - Reason: ${reason}`);
      if (reason === 'io server disconnect') {
        // Server disconnected the client, reconnect manually
        console.log(`🔄 [${new Date().toISOString()}] Server disconnected client, attempting manual reconnect...`);
        this.socket?.connect();
      }
    });

    this.socket.on('connect_error', (error) => {
      console.error(`💥 [${new Date().toISOString()}] Socket connection error:`, error);
      console.error(`📍 Error details: ${error.message}`);
      console.error(`🔗 Attempted URL: ${SOCKET_URL}`);
    });

    this.socket.on('reconnect', (attemptNumber) => {
      console.log(`Socket reconnected after ${attemptNumber} attempts`);
      // Rejoin room if we were in one
      if (this.roomId) {
        const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
        if (currentUser._id) {
          this.joinRoom(this.roomId, currentUser);
        }
      }
    });

    this.socket.on('reconnect_error', (error) => {
      console.error('Socket reconnection error:', error);
    });

    this.socket.on('reconnect_failed', () => {
      console.error('Socket reconnection failed');
    });

    // Handle server-side pong for heartbeat
    this.socket.on('pong', () => {
      console.log('Received pong from server');
    });

    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.roomId = null;
    this.lastJoinAttempt = null;
  }

  // Room management
  joinRoom(roomId: string, user?: User) {
    if (this.socket) {
      // Store roomId for reconnection purposes
      this.roomId = roomId;
      
      // Prevent rapid successive join attempts for the same room
      const now = Date.now();
      if (this.lastJoinAttempt && 
          this.lastJoinAttempt.roomId === roomId && 
          now - this.lastJoinAttempt.timestamp < this.JOIN_COOLDOWN) {
        console.log(`Skipping duplicate join room attempt for ${roomId}`);
        return;
      }

      // Update last join attempt
      this.lastJoinAttempt = { roomId, timestamp: now };

      // Get user info from token if not provided
      let userId = user?.id;
      let userName = user?.name;
      let profilePicId = user?.profilePicId;

      if (!userId || !userName) {
        const token = localStorage.getItem('token');
        if (token) {
          try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            userId = payload.id;
            userName = payload.name;
            // Fallback to localStorage if still not found
            if (!userName || !profilePicId) {
              const storedUser = localStorage.getItem('user');
              if (storedUser && storedUser !== 'undefined') {
                const parsedUser = JSON.parse(storedUser);
                if (!userName) userName = parsedUser.name;
                if (!profilePicId) profilePicId = parsedUser.profilePicId;
              }
            }
          } catch (error) {
            return;
          }
        }
      }

      if (userId && userName) {
        this.socket.emit('joinRoom', {
          roomId,
          userId,
          userName,
          profilePicId,
        });
        this.roomId = roomId;
      } else {
        console.warn('Cannot join room: missing user information');
      }
    }
  }

  leaveRoom() {
    if (this.socket && this.roomId) {
      this.socket.emit('leave-room', this.roomId);
      this.roomId = null;
    }
  }

  // NOTE: Message sending uses HTTP API, but we still listen for real-time updates from other users
  onNewMessage(callback: (message: Message) => void) {
    if (this.socket) {
      this.socket.on('message', callback);
    }
  }

  onReactionUpdate(callback: (data: { messageId: string; reactions: any[] }) => void) {
    if (this.socket) {
      this.socket.on('reactionUpdate', callback);
    }
  }

  onChatUpdated(callback: (data: { roomId: string; timestamp: string }) => void) {
    if (this.socket) {
      this.socket.on('chat-updated', callback);
    }
  }

  // Room participants
  onRoomParticipants(callback: (participants: Participant[]) => void) {
    if (this.socket) {
      this.socket.on('roomParticipants', callback);
    }
  }

  onUserJoined(callback: (participant: Participant) => void) {
    if (this.socket) {
      this.socket.on('userJoined', callback);
    }
  }

  onUserLeft(callback: (data: { userId: string; name: string }) => void) {
    if (this.socket) {
      this.socket.on('userDisconnected', callback);
    }
  }

  // New granular event handlers for efficient real-time updates
  onUserJoinedGranular(callback: (data: {
    userId: string;
    userName: string;
    profilePicId?: string;
    email?: string;
    status?: string;
    joinedAt?: Date;
    timestamp: string;
  }) => void) {
    if (this.socket) {
      this.socket.on('userJoined', callback);
    }
  }

  onUserLeftGranular(callback: (data: {
    userId: string;
    userName: string;
    status: string;
    leftAt: Date;
    timestamp: string;
  }) => void) {
    if (this.socket) {
      this.socket.on('userLeft', callback);
    }
  }

  onUserStatus(
    callback: (status: { userId: string; online: boolean }) => void
  ) {
    if (this.socket) {
      this.socket.on('userStatus', callback);
    }
  }

  // File operations
  onFileUploaded(callback: (file: FileItem) => void) {
    if (this.socket) {
      this.socket.on('file-uploaded', callback);
    }
  }

  onFileDeleted(callback: (fileId: string) => void) {
    if (this.socket) {
      this.socket.on('file-deleted', callback);
    }
  }

  onParticipantsUpdate(callback: (participants: Participant[]) => void) {
    if (this.socket) {
      this.socket.on('participants-update', callback);
    }
  }

  // File sharing and collaboration
  onFileContentUpdate(
    callback: (data: {
      fileId: string;
      content: string;
      userId: string;
    }) => void
  ) {
    if (this.socket) {
      this.socket.on('file-content-updated', callback);
    }
  }

  updateFileContent(fileId: string, content: string) {
    if (this.socket && this.roomId) {
      this.socket.emit('update-file-content', {
        roomId: this.roomId,
        fileId,
        content,
      });
    }
  }

  // Cleanup listeners
  removeAllListeners() {
    if (this.socket) {
      this.socket.removeAllListeners();
    }
  }

  // Room status
  onRoomUpdate(callback: (roomData: Record<string, unknown>) => void) {
    if (this.socket) {
      this.socket.on('room-updated', callback);
    }
  }

  // Typing indicators
  startTyping(roomId: string) {
    if (this.socket) {
      this.socket.emit('typing-start', roomId);
    }
  }

  stopTyping(roomId: string) {
    if (this.socket) {
      this.socket.emit('typing-stop', roomId);
    }
  }

  onTypingUpdate(
    callback: (data: {
      userId: string;
      userName: string;
      isTyping: boolean;
    }) => void
  ) {
    if (this.socket) {
      this.socket.on('typing-update', callback);
    }
  }

  // User status updates
  emitUserStatus(roomId: string, status: 'online' | 'away' | 'offline' | 'in-room') {
    if (this.socket && this.socket.connected) {
      try {
        // Use statusChange event that backend actually handles
        this.socket.emit('statusChange', { 
          roomId, 
          online: status === 'online' || status === 'in-room' 
        });
      } catch (error) {
        // Silently fail to prevent console spam
      }
    }
  }

  emitGlobalUserStatus(status: 'online' | 'offline') {
    if (this.socket && this.socket.connected) {
      try {
        // Use statusChange event that backend actually handles
        this.socket.emit('statusChange', { 
          online: status === 'online' 
        });
      } catch (error) {
        // Silently fail to prevent console spam
      }
    } else {
      console.warn('Cannot emit global user status: socket not connected');
    }
  }

  onUserStatusUpdate(
    callback: (data: {
      userId: string;
      userName: string;
      status: string;
      roomId?: string;
    }) => void
  ) {
    if (this.socket) {
      this.socket.on('user-status-update', callback);
    }
  }

  onStatusChange(
    callback: (data: {
      userId: string;
      userName: string;
      online: boolean;
      timestamp: string;
    }) => void
  ) {
    if (this.socket) {
      this.socket.on('statusChange', callback);
    }
  }

  onGlobalUserStatusUpdate(
    callback: (data: {
      userId: string;
      userName: string;
      status: 'online' | 'offline';
    }) => void
  ) {
    if (this.socket) {
      this.socket.on('global-user-status-update', callback);
    }
  }

  // Collaboration
  sendCollaborativeChange(change: CollaborativeChange) {
    if (this.socket && this.roomId) {
      this.socket.emit('collaborative-change', {
        ...change,
        roomId: this.roomId,
      });
    } else {
      console.warn(
        'Cannot send collaborative change: socket not connected or no room joined'
      );
    }
  }

  onCollaborativeChange(callback: (change: CollaborativeChange) => void) {
    if (this.socket) {
      this.socket.on('collaborative-change', callback);
    }
  }

  onCollaborativeAck(callback: (data: { fileId: string; ackVersion: number }) => void) {
    if (this.socket) {
      this.socket.on('collaborative-change-ack', callback);
    }
  }

  sendCursorUpdate(cursor: UserCursor) {
    if (this.socket && this.roomId) {
      this.socket.emit('cursor-update', { ...cursor, roomId: this.roomId });
    } else {
      console.warn(
        'Cannot send cursor update: socket not connected or no room joined'
      );
    }
  }

  onCursorUpdate(callback: (cursor: UserCursor) => void) {
    if (this.socket) {
      this.socket.on('cursor-update', callback);
    }
  }

  requestFileSync(fileId: string) {
    if (this.socket && this.roomId) {
      this.socket.emit('request-file-sync', { fileId });
    }
  }

  onFileSync(
    callback: (data: {
      fileId: string;
      content: string;
      version: number;
    }) => void
  ) {
    if (this.socket) {
      this.socket.on('file-sync', callback);
    }
  }

  onRequestFileSyncFromPeer(
    callback: (data: { fileId: string; requesterId: string }) => void
  ) {
    if (this.socket) {
      this.socket.on('request-file-sync-from-peer', callback);
    }
  }

  sendFileSyncToPeer(data: {
    requesterId: string;
    fileId: string;
    content: string;
    version: number;
  }) {
    if (this.socket) {
      this.socket.emit('file-sync', data);
    }
  }
}

const socketService = SocketService.getInstance();
export default socketService;
