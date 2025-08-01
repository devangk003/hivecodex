import { io, Socket } from 'socket.io-client';
import { 
  EnhancedSocketEvents, 
  SocketConnectionOptions, 
  OperationProgress,
  CollaborationInvite,
  SystemNotification 
} from '../types/socket';

export interface EnhancedSocketConfig extends SocketConnectionOptions {
  serverUrl: string;
  auth?: {
    token?: string;
    userId?: string;
  };
  enableHeartbeat: boolean;
  heartbeatInterval: number;
  enableCompression: boolean;
  maxRetryDelay: number;
}

export class EnhancedSocketService {
  private socket: Socket | null = null;
  private config: EnhancedSocketConfig;
  private reconnectAttempts: number = 0;
  private isConnected: boolean = false;
  private listeners: Map<string, ((...args: unknown[]) => void)[]> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private connectionPromise: Promise<Socket> | null = null;

  constructor(config: Partial<EnhancedSocketConfig> = {}) {
    this.config = {
      serverUrl: process.env.REACT_APP_SOCKET_URL || 'http://localhost:3001',
      autoReconnect: true,
      reconnectAttempts: 5,
      reconnectDelay: 1000,
      timeout: 20000,
      enableHeartbeat: true,
      heartbeatInterval: 30000,
      enableCompression: true,
      maxRetryDelay: 30000,
      ...config
    };
  }

  // Initialize and connect to socket server
  async connect(): Promise<Socket> {
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.connectionPromise = this.establishConnection();
    return this.connectionPromise;
  }

  private async establishConnection(): Promise<Socket> {
    return new Promise((resolve, reject) => {
      const socketOptions = {
        autoConnect: false,
        timeout: this.config.timeout,
        forceNew: true,
        auth: this.config.auth,
        transports: ['websocket', 'polling'],
        upgrade: true,
        compression: this.config.enableCompression
      };

      this.socket = io(this.config.serverUrl, socketOptions);

      // Connection event handlers
      this.socket.on('connect', () => {
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.connectionPromise = null;
        
        if (this.config.enableHeartbeat) {
          this.startHeartbeat();
        }

        this.emit('connected');
        resolve(this.socket!);
      });

      this.socket.on('disconnect', (reason) => {
        this.isConnected = false;
        this.stopHeartbeat();
        this.emit('disconnected', reason);

        if (this.config.autoReconnect && reason !== 'io client disconnect') {
          this.handleReconnection();
        }
      });

      this.socket.on('connect_error', (error) => {
        this.emit('connection-error', error);
        
        if (this.reconnectAttempts === 0) {
          reject(error);
        }
      });

      // Enhanced event handlers
      this.setupEnhancedListeners();

      // Connect
      this.socket.connect();
    });
  }

  // Setup enhanced event listeners
  private setupEnhancedListeners(): void {
    if (!this.socket) return;

    this.socket.on('file:batch-operation', (operations) => {
      this.emit('batch-operation-received', operations);
    });

    this.socket.on('file:operation-progress', (progress: OperationProgress) => {
      this.emit('operation-progress', progress);
    });

    this.socket.on('room:collaboration-invite', (invite: CollaborationInvite) => {
      this.emit('collaboration-invite', invite);
    });

    this.socket.on('system:notification', (notification: SystemNotification) => {
      this.emit('system-notification', notification);
    });

    this.socket.on('error', (error) => {
      this.emit('socket-error', error);
    });
  }

  // Handle automatic reconnection
  private handleReconnection(): void {
    if (this.reconnectAttempts >= this.config.reconnectAttempts) {
      this.emit('max-reconnect-attempts-reached');
      return;
    }

    const delay = Math.min(
      this.config.reconnectDelay * Math.pow(2, this.reconnectAttempts),
      this.config.maxRetryDelay
    );

    setTimeout(() => {
      this.reconnectAttempts++;
      this.emit('reconnecting', this.reconnectAttempts);
      
      if (this.socket) {
        this.socket.connect();
      }
    }, delay);
  }

  // Start heartbeat to maintain connection
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      if (this.socket && this.isConnected) {
        this.socket.emit('heartbeat', { timestamp: new Date() });
      }
    }, this.config.heartbeatInterval);
  }

  // Stop heartbeat
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  // Emit event with error handling
  emit(event: string, data?: unknown): void {
    try {
      if (this.socket && this.isConnected) {
        this.socket.emit(event, data);
      } else {
        console.warn(`Cannot emit ${event}: Socket not connected`);
      }
    } catch (error) {
      console.error(`Error emitting ${event}:`, error);
      this.emitLocal('emit-error', { event, error });
    }
  }

  // Emit event with acknowledgment
  emitWithAck(event: string, data?: unknown, timeout: number = 5000): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.isConnected) {
        reject(new Error('Socket not connected'));
        return;
      }

      const timer = setTimeout(() => {
        reject(new Error(`Acknowledgment timeout for event: ${event}`));
      }, timeout);

      this.socket.emit(event, data, (response: unknown) => {
        clearTimeout(timer);
        resolve(response);
      });
    });
  }

  // Join room with enhanced features
  async joinRoom(roomId: string, options: { 
    password?: string; 
    role?: string; 
    permissions?: string[] 
  } = {}): Promise<unknown> {
    return this.emitWithAck('room:join', { roomId, ...options });
  }

  // Leave room
  async leaveRoom(roomId: string): Promise<unknown> {
    return this.emitWithAck('room:leave', { roomId });
  }

  // Send batch file operations
  sendBatchOperations(operations: unknown[]): void {
    this.emit('file:batch-operation', operations);
  }

  // Track operation progress
  trackOperationProgress(operationId: string): void {
    this.emit('file:track-progress', { operationId });
  }

  // Send collaboration invite
  sendCollaborationInvite(invite: Omit<CollaborationInvite, 'inviteId'>): void {
    this.emit('room:send-invite', invite);
  }

  // Respond to collaboration invite
  respondToInvite(inviteId: string, accept: boolean): void {
    this.emit('room:respond-invite', { inviteId, accept });
  }

  // Get connection status
  getConnectionStatus(): {
    isConnected: boolean;
    reconnectAttempts: number;
    lastConnected?: Date;
  } {
    return {
      isConnected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
      lastConnected: this.isConnected ? new Date() : undefined
    };
  }

  // Get socket instance (for direct access if needed)
  getSocket(): Socket | null {
    return this.socket;
  }

  // Update authentication
  updateAuth(auth: { token?: string; userId?: string }): void {
    this.config.auth = { ...this.config.auth, ...auth };
    
    if (this.socket) {
      this.socket.auth = this.config.auth;
    }
  }

  // Event listener management
  on(event: string, callback: (...args: unknown[]) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);

    // Also listen on socket if it exists
    if (this.socket) {
      this.socket.on(event, callback as any);
    }
  }

  off(event: string, callback?: (...args: unknown[]) => void): void {
    if (callback) {
      const eventListeners = this.listeners.get(event);
      if (eventListeners) {
        const index = eventListeners.indexOf(callback);
        if (index > -1) {
          eventListeners.splice(index, 1);
        }
      }
      
      if (this.socket) {
        this.socket.off(event, callback as any);
      }
    } else {
      this.listeners.delete(event);
      if (this.socket) {
        this.socket.removeAllListeners(event);
      }
    }
  }

  // Emit local events (for internal use)
  private emitLocal(event: string, data?: unknown): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error);
        }
      });
    }
  }

  // Disconnect and cleanup
  disconnect(): void {
    this.stopHeartbeat();
    
    if (this.socket) {
      this.socket.disconnect();
      this.socket.removeAllListeners();
      this.socket = null;
    }

    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.connectionPromise = null;
    this.listeners.clear();
  }

  // Force reconnection
  forceReconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket.connect();
    }
  }
}

// Export singleton instance
export const enhancedSocketService = new EnhancedSocketService();