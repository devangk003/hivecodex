import io, { Socket } from 'socket.io-client';
import { Message, Participant, FileItem, User } from './api';
import { CollaborativeChange, UserCursor } from './collaboration';
import { SOCKET_EVENTS } from '@/constants';

// Use LAN IP for dev so all devices can connect to Socket.IO
const SOCKET_URL = 'http://192.168.29.26:5000';

class SocketService {
  private socket: Socket | null = null;
  private roomId: string | null = null;
  private static instance: SocketService;

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

  isConnected(): boolean {
    return this.socket && this.socket.connected;
  }

  connect(token: string) {
    // Don't create multiple connections
    if (this.socket && this.socket.connected) {
      return this.socket;
    }

    // Disconnect existing socket if it exists
    if (this.socket) {
      this.socket.disconnect();
    }

    this.socket = io(SOCKET_URL, {
      auth: {
        token: token,
      },
    });

    this.socket.on('connect', () => {
      console.log('Socket connected');
    });

    this.socket.on('disconnect', () => {
      console.log('Socket disconnected');
    });

    this.socket.on('connect_error', (error: Error) => {
      console.error('Socket connection error:', error);
    });

    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.roomId = null;
    }
  }

  // Room management
  joinRoom(roomId: string, user?: User) {
    if (this.socket) {
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

  // Chat functionality
  sendMessage(message: Message) {
    if (this.socket) {
      // Include room ID in the message payload
      const messageWithRoom = {
        ...message,
        roomId: this.roomId,
      };

      this.socket.emit('message', messageWithRoom);
    } else {
      console.warn('Cannot send message: socket not connected');
    }
  }

  onNewMessage(callback: (message: Message) => void) {
    if (this.socket) {
      this.socket.on('message', callback);
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
        this.socket.emit('user-status', { roomId, status });
      } catch (error) {
        console.warn('Failed to emit user status:', error);
      }
    } else {
      console.warn('Cannot emit user status: socket not connected');
    }
  }

  emitGlobalUserStatus(status: 'online' | 'offline') {
    if (this.socket && this.socket.connected) {
      try {
        this.socket.emit('global-user-status', { status });
      } catch (error) {
        console.warn('Failed to emit global user status:', error);
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
      this.socket.emit('request-file-sync', { roomId: this.roomId, fileId });
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
