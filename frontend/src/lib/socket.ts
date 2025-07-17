import io from 'socket.io-client';
import { Message, Participant, FileItem } from './api';
import { CollaborativeChange, UserCursor } from './collaboration';

const SOCKET_URL = import.meta.env.VITE_API_ENDPOINT || 'http://localhost:5000';

class SocketService {
  private socket: any = null;
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
      console.log('Socket already connected, skipping connection');
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
      console.log('Connected to server with socket ID:', this.socket.id);
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from server with socket ID:', this.socket.id);
    });

    this.socket.on('connect_error', (error: any) => {
      console.error('Connection error:', error);
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
  joinRoom(roomId: string, user?: any) {
    if (this.socket) {
      // Get user info from token if not provided
      let userId = user?.id;
      let userName = user?.name;
      
      if (!userId || !userName) {
        const token = localStorage.getItem('token');
        if (token) {
          try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            userId = payload.id;
            userName = payload.name; // Now available in JWT
            
            // Fallback to localStorage if still not found
            if (!userName) {
              const storedUser = localStorage.getItem('user');
              if (storedUser && storedUser !== 'undefined') {
                const parsedUser = JSON.parse(storedUser);
                userName = parsedUser.name;
              }
            }
          } catch (error) {
            console.error('Error parsing token:', error);
            return;
          }
        }
      }
      
      if (userId && userName) {
        console.log(`Joining room ${roomId} with userId: ${userId}, userName: ${userName}`);
        this.socket.emit('joinRoom', {
          roomId,
          userId,
          userName
        });
        this.roomId = roomId;
      } else {
        console.error('Cannot join room: missing userId or userName', { userId, userName });
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
      console.log('SocketService - Sending message:', message);
      console.log('SocketService - Socket connected:', this.socket.connected);
      console.log('SocketService - Current room:', this.roomId);
      
      // Include room ID in the message payload
      const messageWithRoom = {
        ...message,
        roomId: this.roomId
      };
      
      console.log('SocketService - Sending message with room:', messageWithRoom);
      this.socket.emit('message', messageWithRoom);
    } else {
      console.error('SocketService - Cannot send message: socket not connected');
    }
  }

  onNewMessage(callback: (message: Message) => void) {
    if (this.socket) {
      console.log('SocketService - Setting up message listener');
      this.socket.on('message', callback);
    }
  }

  // Room participants
  onRoomParticipants(callback: (participants: any[]) => void) {
    if (this.socket) {
      this.socket.on('roomParticipants', callback);
    }
  }

  onUserJoined(callback: (participant: any) => void) {
    if (this.socket) {
      this.socket.on('userJoined', callback);
    }
  }

  onUserLeft(callback: (data: { userId: string; name: string }) => void) {
    if (this.socket) {
      this.socket.on('userLeft', callback);
    }
  }

  onUserStatus(callback: (status: { userId: string; online: boolean }) => void) {
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
  onFileContentUpdate(callback: (data: { fileId: string; content: string; userId: string }) => void) {
    if (this.socket) {
      this.socket.on('file-content-updated', callback);
    }
  }

  updateFileContent(fileId: string, content: string) {
    if (this.socket && this.roomId) {
      this.socket.emit('update-file-content', { 
        roomId: this.roomId, 
        fileId, 
        content 
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
  onRoomUpdate(callback: (roomData: any) => void) {
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

  onTypingUpdate(callback: (data: { userId: string; userName: string; isTyping: boolean }) => void) {
    if (this.socket) {
      this.socket.on('typing-update', callback);
    }
  }

  // User status updates
  emitUserStatus(roomId: string, status: 'online' | 'away' | 'offline') {
    if (this.socket) {
      this.socket.emit('user-status', { roomId, status });
    }
  }

  onUserStatusUpdate(callback: (data: { userId: string; userName: string; status: string }) => void) {
    if (this.socket) {
      this.socket.on('user-status-update', callback);
    }
  }

  // Collaboration
  sendCollaborativeChange(change: CollaborativeChange) {
    console.log('📤 Sending collaborative change:', change);
    if (this.socket && this.roomId) {
      this.socket.emit('collaborative-change', { ...change, roomId: this.roomId });
      console.log('✅ Change sent to room:', this.roomId);
    } else {
      console.log('❌ Cannot send change:', { socket: !!this.socket, roomId: this.roomId });
    }
  }

  onCollaborativeChange(callback: (change: CollaborativeChange) => void) {
    if (this.socket) {
      this.socket.on('collaborative-change', callback);
    }
  }

  sendCursorUpdate(cursor: UserCursor) {
    console.log('📤 Sending cursor update:', cursor);
    if (this.socket && this.roomId) {
      this.socket.emit('cursor-update', { ...cursor, roomId: this.roomId });
      console.log('✅ Cursor sent to room:', this.roomId);
    } else {
      console.log('❌ Cannot send cursor:', { socket: !!this.socket, roomId: this.roomId });
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

  onFileSync(callback: (data: { fileId: string; content: string; version: number }) => void) {
    if (this.socket) {
      this.socket.on('file-sync', callback);
    }
  }

  onRequestFileSyncFromPeer(callback: (data: { fileId: string; requesterId: string }) => void) {
    if (this.socket) {
      this.socket.on('request-file-sync-from-peer', callback);
    }
  }

  sendFileSyncToPeer(data: { requesterId: string; fileId: string; content: string; version: number }) {
    if (this.socket) {
      this.socket.emit('file-sync', data);
    }
  }
}

const socketService = SocketService.getInstance();
export default socketService;
