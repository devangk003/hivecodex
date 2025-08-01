import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { useEnhancedUserStatus } from '@/hooks/useEnhancedUserStatus';
import socketService from '@/lib/socket';
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

  // Socket listeners for status updates
  useEffect(() => {
    if (!isAuthenticated) return;
    
    // Wait for socket to be connected before setting up listeners
    const setupSocketListeners = () => {
      if (!socketService.isConnected()) {
        // Retry after a short delay if socket is not yet connected
        setTimeout(setupSocketListeners, 1000);
        return;
      }

      const handleUserStatusUpdate = (data: {
        userId: string;
        userName: string;
        status: string;
        roomId?: string;
      }) => {
        setParticipants(prev => {
          const newMap = new Map(prev);
          const existing = newMap.get(data.userId);
          
          const statusData: UserStatusData = {
            userId: data.userId,
            userName: data.userName,
            profilePicId: existing?.profilePicId,
            globalStatus: data.status === 'offline' ? 'offline' : 'online',
            roomStatus: data.status as RoomUserStatus,
            currentRoomId: data.roomId,
            lastSeen: data.status === 'offline' ? new Date() : undefined,
            isInSameRoom: data.roomId === currentRoomId,
          };
          
          newMap.set(data.userId, statusData);
          return newMap;
        });
      };

      const handleGlobalUserStatusUpdate = (data: {
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
        socketService.onUserStatusUpdate(handleUserStatusUpdate);
        socketService.onGlobalUserStatusUpdate(handleGlobalUserStatusUpdate);
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
      // Socket listeners are cleaned up by socketService
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

  const updateParticipantStatus = (userData: UserStatusData) => {
    setParticipants(prev => {
      const newMap = new Map(prev);
      newMap.set(userData.userId, userData);
      return newMap;
    });
  };

  const value: UserStatusContextType = {
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
  };

  return <UserStatusContext.Provider value={value}>{children}</UserStatusContext.Provider>;
};
