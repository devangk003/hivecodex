import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef, useMemo } from 'react';
import { useAuth } from './AuthContext';
import { useEnhancedUserStatus } from '@/hooks/useEnhancedUserStatus';
import { useAbortableRequest } from '@/hooks/useDebounce';
import socketService from '@/lib/socket';
import { roomAPI } from '@/lib/api';
import type { GlobalUserStatus, RoomUserStatus, UserStatusData } from '@/types/userStatus';

interface UserStatusContextType {
  globalStatus: GlobalUserStatus;
  roomStatus: RoomUserStatus;
  currentRoomId: string | null;
  participants: Map<string, UserStatusData>;
  updateGlobalStatus: (status: GlobalUserStatus) => Promise<void>;
  updateRoomStatus: (status: RoomUserStatus, roomId?: string) => Promise<void>;
  enterRoom: (roomId: string) => Promise<void>;
  leaveRoom: () => Promise<void>;
  getUserStatus: (userId: string) => UserStatusData | null;
  updateParticipantStatus: (userData: UserStatusData) => void;
  loadInitialParticipants: (roomId: string) => Promise<void>;
  isLoadingParticipants: boolean;
}

const UserStatusContext = createContext<UserStatusContextType | undefined>(undefined);

export const useUserStatusContext = () => {
  const context = useContext(UserStatusContext);
  if (context === undefined) {
    // In development, throw error for debugging
    if (process.env.NODE_ENV === 'development') {
      console.error('useUserStatusContext must be used within a UserStatusProvider');
    }
    // Return a default/fallback context to prevent crashes
    return {
      globalStatus: 'online' as GlobalUserStatus,
      roomStatus: 'online' as RoomUserStatus,
      currentRoomId: null,
      participants: new Map(),
      updateGlobalStatus: async () => {},
      updateRoomStatus: async () => {},
      enterRoom: async () => {},
      leaveRoom: async () => {},
      getUserStatus: () => null,
      updateParticipantStatus: () => {},
      loadInitialParticipants: async () => {},
      isLoadingParticipants: false,
    };
  }
  return context;
};

interface UserStatusProviderProps {
  children: ReactNode;
}

export const UserStatusProvider: React.FC<UserStatusProviderProps> = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const [participants, setParticipants] = useState<Map<string, UserStatusData>>(new Map());
  const [isLoadingParticipants, setIsLoadingParticipants] = useState(false);
  const { makeRequest, cleanup: cleanupAbortable } = useAbortableRequest();
  
  const {
    globalStatus,
    roomStatus,
    currentRoomId,
    updateGlobalStatus: updateGlobalStatusHook,
    updateRoomStatus: updateRoomStatusHook,
    enterRoom: enterRoomHook,
    leaveRoom: leaveRoomHook,
    getUserStatus: getUserStatusHook,
  } = useEnhancedUserStatus(user?.id);

  // Enhanced socket listeners for granular real-time updates
  useEffect(() => {
    if (!isAuthenticated) return;
    
    let timeoutId: NodeJS.Timeout | null = null;
    let listenersSetup = false;
    
    // Store handler references for cleanup
    const handlers = {
      userJoined: null as ((data: any) => void) | null,
      userLeft: null as ((data: any) => void) | null,
      statusChange: null as ((data: any) => void) | null,
      globalStatusUpdate: null as ((data: any) => void) | null,
    };
    
    // Wait for socket to be connected before setting up listeners
    const setupSocketListeners = () => {
      if (!socketService.isConnected()) {
        // Retry after a short delay if socket is not yet connected
        timeoutId = setTimeout(setupSocketListeners, 1000);
        return;
      }

      if (listenersSetup) return; // Prevent duplicate setup

      // Handle granular userJoined events with complete profile data
      handlers.userJoined = (data: {
        userId: string;
        userName: string;
        profilePicId?: string;
        email?: string;
        status?: string;
        joinedAt?: Date;
        timestamp: string;
      }) => {
        console.log('UserStatusContext: User joined:', data);
        setParticipants(prev => {
          const newMap = new Map(prev);
          const statusData: UserStatusData = {
            userId: data.userId,
            userName: data.userName,
            profilePicId: data.profilePicId,
            globalStatus: 'online',
            roomStatus: 'in-room',
            currentRoomId: currentRoomId,
            lastSeen: undefined,
            isInSameRoom: true,
          };
          
          newMap.set(data.userId, statusData);
          return newMap;
        });
      };

      // Handle granular userLeft events
      handlers.userLeft = (data: {
        userId: string;
        userName: string;
        status: string;
        leftAt: Date;
        timestamp: string;
      }) => {
        console.log('UserStatusContext: User left:', data);
        setParticipants(prev => {
          const newMap = new Map(prev);
          const existing = newMap.get(data.userId);
          
          if (existing) {
            newMap.set(data.userId, {
              ...existing,
              globalStatus: 'offline',
              roomStatus: 'offline',
              currentRoomId: undefined,
              lastSeen: new Date(data.leftAt),
              isInSameRoom: false,
            });
          }
          
          return newMap;
        });
      };

      // Handle status changes within room
      handlers.statusChange = (data: {
        userId: string;
        userName: string;
        online: boolean;
        timestamp: string;
      }) => {
        setParticipants(prev => {
          const newMap = new Map(prev);
          const existing = newMap.get(data.userId);
          
          if (existing) {
            newMap.set(data.userId, {
              ...existing,
              globalStatus: data.online ? 'online' : 'offline',
              roomStatus: data.online ? 'in-room' : 'offline',
              lastSeen: !data.online ? new Date() : undefined,
              isInSameRoom: data.online,
            });
          } else {
            // Create new entry if user not in map
            newMap.set(data.userId, {
              userId: data.userId,
              userName: data.userName,
              profilePicId: undefined,
              globalStatus: data.online ? 'online' : 'offline',
              roomStatus: data.online ? 'in-room' : 'offline',
              currentRoomId: data.online ? currentRoomId : undefined,
              lastSeen: !data.online ? new Date() : undefined,
              isInSameRoom: data.online,
            });
          }
          
          return newMap;
        });
      };

      handlers.globalStatusUpdate = (data: {
        userId: string;
        userName: string;
        status: 'online' | 'offline';
      }) => {
        setParticipants(prev => {
          const newMap = new Map(prev);
          const existing = newMap.get(data.userId);
          
          if (existing) {
            newMap.set(data.userId, {
              ...existing,
              globalStatus: data.status,
              lastSeen: data.status === 'offline' ? new Date() : undefined,
            });
          }
          
          return newMap;
        });
      };

      try {
        // Set up granular event listeners
        socketService.onUserJoinedGranular(handlers.userJoined);
        socketService.onUserLeftGranular(handlers.userLeft);
        socketService.onStatusChange(handlers.statusChange);
        socketService.onGlobalUserStatusUpdate(handlers.globalStatusUpdate);
        
        listenersSetup = true;
        console.log('UserStatusContext: Granular socket listeners set up');
      } catch (error) {
        console.warn('Failed to set up socket listeners:', error);
      }
    };

    setupSocketListeners();

    // Add current user to participants if not already there
    if (user) {
      const currentUserStatus = getUserStatusHook();
      if (currentUserStatus) {
        setParticipants(prev => {
          const newMap = new Map(prev);
          newMap.set(user.id, {
            ...currentUserStatus,
            userName: user.name,
            profilePicId: user.profilePicId,
          });
          return newMap;
        });
      }
    }

    return () => {
      // Clear timeout if still pending
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      
      // Removed debouncing timeout cleanup - no longer needed
      
      // Cleanup AbortController
      cleanupAbortable();
      
      // Remove socket listeners if they were set up
      if (listenersSetup && socketService.socket && handlers.userJoined) {
        try {
          socketService.socket.off('userJoined', handlers.userJoined);
          socketService.socket.off('userLeft', handlers.userLeft);
          socketService.socket.off('statusChange', handlers.statusChange);
          socketService.socket.off('global-user-status-update', handlers.globalStatusUpdate);
          console.log('UserStatusContext: Socket listeners cleaned up');
        } catch (error) {
          console.warn('Error cleaning up socket listeners:', error);
        }
      }
    };
  }, [isAuthenticated, user, currentRoomId, getUserStatusHook]);

  // Update current user's status in participants when it changes
  useEffect(() => {
    if (user) {
      const currentUserStatus = getUserStatusHook();
      if (currentUserStatus) {
        setParticipants(prev => {
          const newMap = new Map(prev);
          newMap.set(user.id, {
            ...currentUserStatus,
            userName: user.name,
            profilePicId: user.profilePicId,
          });
          return newMap;
        });
      }
    }
  }, [user, globalStatus, roomStatus, currentRoomId, getUserStatusHook]);

  const updateGlobalStatus = async (status: GlobalUserStatus) => {
    await updateGlobalStatusHook(status);
  };

  const updateRoomStatus = async (status: RoomUserStatus, roomId?: string) => {
    await updateRoomStatusHook(status, roomId);
  };

  const enterRoom = async (roomId: string) => {
    await enterRoomHook(roomId);
  };

  const leaveRoom = async () => {
    await leaveRoomHook();
  };

  const getUserStatus = (userId: string): UserStatusData | null => {
    return participants.get(userId) || null;
  };

  const updateParticipantStatus = useCallback((userData: UserStatusData) => {
    setParticipants(prev => {
      const newMap = new Map(prev);
      newMap.set(userData.userId, userData);
      return newMap;
    });
  }, []);

  // Removed debouncing refs - no longer needed since we don't make API calls

  // Load initial participants for a room (called once when entering room)
  // REMOVED: This function now does nothing to prevent redundant API calls
  // All participant updates are handled via granular socket events
  const loadInitialParticipants = useCallback(async (roomId: string) => {
    if (!roomId) return;
    
    console.log('UserStatusContext: Skipping API call - relying on socket events for participants in room:', roomId);
    // Socket events (userJoined, userLeft, statusChange) will handle all participant updates
    // Initial participants will be populated when users join via socket events
  }, []);

  const value: UserStatusContextType = useMemo(() => ({
    globalStatus,
    roomStatus,
    currentRoomId,
    participants,
    updateGlobalStatus,
    updateRoomStatus,
    enterRoom,
    leaveRoom,
    getUserStatus,
    updateParticipantStatus,
    loadInitialParticipants,
    isLoadingParticipants,
  }), [
    globalStatus,
    roomStatus,
    currentRoomId,
    participants,
    updateGlobalStatus,
    updateRoomStatus,
    enterRoom,
    leaveRoom,
    getUserStatus,
    updateParticipantStatus,
    loadInitialParticipants,
    isLoadingParticipants,
  ]);

  return <UserStatusContext.Provider value={value}>{children}</UserStatusContext.Provider>;
};
