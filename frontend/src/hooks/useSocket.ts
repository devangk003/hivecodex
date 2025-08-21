import { useEffect, useRef, useState, useCallback } from 'react';

// Utility: Wait for socket to be connected before emitting
function waitForSocketConnection(socket, timeout = 5000) {
  return new Promise((resolve, reject) => {
    if (socket && socket.connected) return resolve(true);
    const start = Date.now();
    function check() {
      if (socket && socket.connected) return resolve(true);
      if (Date.now() - start > timeout) return reject(new Error('Socket connect timeout'));
      setTimeout(check, 50);
    }
    check();
  });
}
import { Socket } from 'socket.io-client';
import { enhancedSocketService } from '../services/enhancedSocket';
import { fileSyncService } from '../services/fileSynchronization';
import { userPresenceService } from '../services/userPresence';
import { autoReconnectionManager } from '../services/autoReconnection';
import type { FileOperation, ConflictResolution } from '../types/filesystem';

export interface UseSocketOptions {
  autoConnect?: boolean;
  enableFileSync?: boolean;
  enablePresence?: boolean;
  enableAutoReconnect?: boolean;
  onConnect?: () => void;
  onDisconnect?: (reason: string) => void;
  onError?: (error: Error | { message: string; code?: string }) => void;
}

export interface SocketState {
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  reconnectAttempts: number;
  socket: Socket | null;
}

export const useSocket = (
  userId?: string,
  username?: string,
  options: UseSocketOptions = {}
) => {
  const {
    autoConnect = true,
    enableFileSync = true,
    enablePresence = true,
    enableAutoReconnect = true,
    onConnect,
    onDisconnect,
    onError
  } = options;

  const [socketState, setSocketState] = useState<SocketState>({
    isConnected: false,
    isConnecting: false,
    error: null,
    reconnectAttempts: 0,
    socket: null
  });

  const initializationRef = useRef(false);
  const servicesInitializedRef = useRef(false);

  // Track joined rooms for robust re-join
  const joinedRoomsRef = useRef<Set<string>>(new Set());

  // Initialize socket connection
  const initializeSocket = useCallback(async () => {
    if (initializationRef.current) return;
    initializationRef.current = true;

    try {
      setSocketState(prev => ({ ...prev, isConnecting: true, error: null }));

      // Update auth if user info is provided
      if (userId && username) {
        enhancedSocketService.updateAuth({ userId, token: 'temp-token' });
      }

      const socket = await enhancedSocketService.connect();

      setSocketState(prev => ({
        ...prev,
        socket,
        isConnected: true,
        isConnecting: false,
        error: null
      }));

      // Initialize services
      if (!servicesInitializedRef.current) {
        initializeServices(socket);
        servicesInitializedRef.current = true;
      }

      // On connect/reconnect, re-join all rooms
      socket.on('connect', () => {
        joinedRoomsRef.current.forEach(roomId => {
          socket.emit('joinRoom', { roomId, userId, userName: username });
        });
        console.log('Socket connected!');
      });

      socket.on('disconnect', () => {
        console.log('Socket disconnected!');
      });

      onConnect?.();

    } catch (error) {
      setSocketState(prev => ({
        ...prev,
        isConnecting: false,
        error: error instanceof Error ? error.message : 'Connection failed'
      }));
      onError?.(error);
    }
  }, [userId, username, onConnect, onError]);

  // Initialize all services
  const initializeServices = useCallback((socket: Socket) => {
    // Initialize file synchronization service
    if (enableFileSync) {
      fileSyncService.initialize(socket);
    }

    // Initialize user presence service
    if (enablePresence && userId && username) {
      userPresenceService.initialize(socket, userId, username);
    }

    // Initialize auto-reconnection manager
    if (enableAutoReconnect) {
      autoReconnectionManager.initialize(socket);
    }
  }, [enableFileSync, enablePresence, enableAutoReconnect, userId, username]);

  // Setup enhanced socket event listeners
  useEffect(() => {
    const handleConnected = () => {
      setSocketState(prev => ({
        ...prev,
        isConnected: true,
        isConnecting: false,
        error: null,
        reconnectAttempts: 0
      }));
    };

    const handleDisconnected = (reason: string) => {
      setSocketState(prev => ({
        ...prev,
        isConnected: false,
        error: reason
      }));
      onDisconnect?.(reason);
    };

    const handleConnectionError = (error: Error | { message: string; code?: string }) => {
      setSocketState(prev => ({
        ...prev,
        isConnecting: false,
        error: error.message || 'Connection error'
      }));
      onError?.(error);
    };

    const handleReconnecting = (attempts: number) => {
      setSocketState(prev => ({
        ...prev,
        reconnectAttempts: attempts,
        isConnecting: true
      }));
    };

    // Subscribe to enhanced socket events
    enhancedSocketService.on('connected', handleConnected);
    enhancedSocketService.on('disconnected', handleDisconnected);
    enhancedSocketService.on('connection-error', handleConnectionError);
    
    // Subscribe to auto-reconnection events
    if (enableAutoReconnect) {
      autoReconnectionManager.on('reconnecting', handleReconnecting);
      autoReconnectionManager.on('reconnected', handleConnected);
      autoReconnectionManager.on('max-attempts-reached', () => {
        setSocketState(prev => ({
          ...prev,
          isConnecting: false,
          error: 'Maximum reconnection attempts reached'
        }));
      });
    }

    return () => {
      enhancedSocketService.off('connected', handleConnected);
      enhancedSocketService.off('disconnected', handleDisconnected);
      enhancedSocketService.off('connection-error', handleConnectionError);
      
      if (enableAutoReconnect) {
        autoReconnectionManager.off('reconnecting', handleReconnecting);
        autoReconnectionManager.off('reconnected', handleConnected);
        autoReconnectionManager.off('max-attempts-reached', () => {});
      }
    };
  }, [enableAutoReconnect, onDisconnect, onError]);

  // Auto-connect on mount if enabled
  useEffect(() => {
    if (autoConnect && !socketState.isConnected && !socketState.isConnecting) {
      initializeSocket();
    }
  }, [autoConnect, initializeSocket, socketState.isConnected, socketState.isConnecting]);

  // Socket utility functions
  const connect = useCallback(async () => {
    if (!socketState.isConnected && !socketState.isConnecting) {
      initializationRef.current = false;
      await initializeSocket();
    }
  }, [initializeSocket, socketState.isConnected, socketState.isConnecting]);

  const disconnect = useCallback(() => {
    enhancedSocketService.disconnect();
    setSocketState(prev => ({
      ...prev,
      isConnected: false,
      isConnecting: false,
      socket: null
    }));
  }, []);


  // Only emit if connected
  const emit = useCallback((event: string, data?: Record<string, unknown>) => {
    const socket = socketState.socket;
    if (socket && socket.connected) {
      socket.emit(event, data);
    } else {
      console.warn(`Cannot emit ${event}: Socket not connected`);
    }
  }, [socketState.socket]);

  const emitWithAck = useCallback(async (event: string, data?: Record<string, unknown>, timeout?: number) => {
    return enhancedSocketService.emitWithAck(event, data, timeout);
  }, []);

  const on = useCallback((event: string, callback: (...args: unknown[]) => void) => {
    enhancedSocketService.on(event, callback);
  }, []);

  const off = useCallback((event: string, callback?: (...args: unknown[]) => void) => {
    enhancedSocketService.off(event, callback);
  }, []);

  // Room management functions

  // Robust joinRoom/leaveRoom: track joined rooms, only emit if connected
  const joinRoom = useCallback(async (roomId: string, options?: Record<string, unknown>) => {
    const socket = socketState.socket;
    if (!roomId) return;
    joinedRoomsRef.current.add(roomId);
    if (socket && socket.connected) {
      socket.emit('joinRoom', { roomId, userId, userName: username, ...options });
    } else {
      // Will auto re-join on connect
      console.warn('Socket not connected, will auto-join on connect');
    }
  }, [socketState.socket, userId, username]);

  const leaveRoom = useCallback(async (roomId: string) => {
    const socket = socketState.socket;
    if (!roomId) return;
    joinedRoomsRef.current.delete(roomId);
    if (socket && socket.connected) {
      socket.emit('leave-room', { roomId, userId });
    } else {
      // No need to emit if not connected
      console.warn('Socket not connected, cannot emit leave-room');
    }
  }, [socketState.socket, userId]);

  // File synchronization functions
  const syncFile = useCallback((operation: FileOperation) => {
    if (enableFileSync) {
      fileSyncService.queueOperation(operation);
    }
  }, [enableFileSync]);

  const resolveConflict = useCallback((resolution: { 
    conflictId: string; 
    resolution: ConflictResolution; 
    mergedContent?: string; 
    timestamp: Date; 
  }) => {
    if (enableFileSync) {
      fileSyncService.resolveConflict(resolution);
    }
  }, [enableFileSync]);

  const getSyncStatus = useCallback((fileId: string) => {
    if (enableFileSync) {
      return fileSyncService.getSyncStatus(fileId);
    }
    return undefined;
  }, [enableFileSync]);

  // Presence functions
  const updatePresence = useCallback((presence: Record<string, unknown>) => {
    if (enablePresence) {
      userPresenceService.updatePresence(presence);
    }
  }, [enablePresence]);

  const updateCursor = useCallback((fileId: string, line: number, column: number) => {
    if (enablePresence) {
      userPresenceService.updateCursorPosition(fileId, line, column);
    }
  }, [enablePresence]);

  const updateSelection = useCallback((
    fileId: string,
    startLine: number,
    startColumn: number,
    endLine: number,
    endColumn: number
  ) => {
    if (enablePresence) {
      userPresenceService.updateTextSelection(fileId, startLine, startColumn, endLine, endColumn);
    }
  }, [enablePresence]);

  const getOnlineUsers = useCallback(() => {
    if (enablePresence) {
      return userPresenceService.getOnlineUsers();
    }
    return [];
  }, [enablePresence]);

  // Connection management
  const forceReconnect = useCallback(() => {
    if (enableAutoReconnect) {
      autoReconnectionManager.forceReconnect();
    } else {
      enhancedSocketService.forceReconnect();
    }
  }, [enableAutoReconnect]);

  const getConnectionStatus = useCallback(() => {
    return enhancedSocketService.getConnectionStatus();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (socketState.isConnected) {
        disconnect();
      }
    };
  }, []);

  return {
    // State
    ...socketState,
    
    // Connection methods
    connect,
    disconnect,
    forceReconnect,
    getConnectionStatus,
    
    // Socket methods
    emit,
    emitWithAck,
    on,
    off,
    
    // Room methods
    joinRoom,
    leaveRoom,
    
    // File sync methods
    syncFile,
    resolveConflict,
    getSyncStatus,
    
    // Presence methods
    updatePresence,
    updateCursor,
    updateSelection,
    getOnlineUsers,
    
    // Service instances (for advanced usage)
    services: {
      socket: enhancedSocketService,
      fileSync: fileSyncService,
      presence: userPresenceService,
      autoReconnect: autoReconnectionManager
    }
  };
};