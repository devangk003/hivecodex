import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { useEnhancedUserStatus } from '@/hooks/useEnhancedUserStatus';
import { activityAPI } from '@/lib/api';
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

      const handleStatusChange = (data: {
        userId: string;
        userName: string;
        online: boolean;
        timestamp: string;
      }) => {
        console.log('UserStatusContext - Received statusChange:', data);
        
        setParticipants(prev => {
          const newMap = new Map(prev);
          const existing = newMap.get(data.userId);
          
          if (existing) {
            newMap.set(data.userId, {
              ...existing,
              globalStatus: data.online ? 'online' : 'offline',
              roomStatus: data.online ? 'in-room' : 'offline',
              lastSeen: !data.online ? new Date() : undefined,
            });
          } else {
            // Add new participant if not exists
            newMap.set(data.userId, {
              userId: data.userId,
              userName: data.userName,
              profilePicId: undefined,
              globalStatus: data.online ? 'online' : 'offline',
              roomStatus: data.online ? 'in-room' : 'offline',
              currentRoomId: undefined,
              lastSeen: !data.online ? new Date() : undefined,
              isInSameRoom: false,
            });
          }
          
          return newMap;
        });
      };

      const handleUserActivityStatusUpdate = (data: {
        userId: string;
        userName: string;
        activityStatus: string;
        timestamp: string;
      }) => {
        console.log('UserStatusContext - Received user-activity-status-update:', data);
        
        setParticipants(prev => {
          const newMap = new Map(prev);
          const existing = newMap.get(data.userId);
          
          if (existing) {
            // Map backend activityStatus to frontend status types
            let globalStatus: 'online' | 'offline' = 'online';
            let roomStatus: RoomUserStatus = 'online';
            
            switch (data.activityStatus.toLowerCase()) {
              case 'offline':
                globalStatus = 'offline';
                roomStatus = 'offline';
                break;
              case 'away':
              case 'busy': // Map busy to away for now
                roomStatus = 'away';
                break;
              case 'in_room':
              case 'in-room':
                roomStatus = 'in-room';
                break;
              default:
                roomStatus = 'online';
            }
            
            newMap.set(data.userId, {
              ...existing,
              globalStatus,
              roomStatus,
              lastSeen: globalStatus === 'offline' ? new Date() : undefined,
            });
          } else {
            // Add new participant if not exists
            let globalStatus: 'online' | 'offline' = 'online';
            let roomStatus: RoomUserStatus = 'online';
            
            switch (data.activityStatus.toLowerCase()) {
              case 'offline':
                globalStatus = 'offline';
                roomStatus = 'offline';
                break;
              case 'away':
              case 'busy': // Map busy to away for now
                roomStatus = 'away';
                break;
              case 'in_room':
              case 'in-room':
                roomStatus = 'in-room';
                break;
              default:
                roomStatus = 'online';
            }
            
            newMap.set(data.userId, {
              userId: data.userId,
              userName: data.userName,
              profilePicId: undefined,
              globalStatus,
              roomStatus,
              currentRoomId: undefined,
              lastSeen: globalStatus === 'offline' ? new Date() : undefined,
              isInSameRoom: false,
            });
          }
          
          return newMap;
        });
      };

      const handleUserStatusRefresh = async (data: {
        userId: string;
        userName: string;
        activityStatus: string;
        timestamp: string;
        roomId?: string;
      }) => {
        console.log('UserStatusContext - Received user-status-refresh:', data);
        
        // Fetch latest status from backend (like fetching messages)
        try {
          const allUsersStatus = await activityAPI.getAllUsersStatus();
          console.log('UserStatusContext - Fetched all users status from backend:', allUsersStatus);
          
          // Update all participants with fresh data from backend
          setParticipants(prev => {
            const newMap = new Map(prev);
            
            allUsersStatus.forEach((userStatus: any) => {
              const existing = newMap.get(userStatus.userId);
              
              // Map backend activityStatus to frontend status types
              let globalStatus: 'online' | 'offline' = 'online';
              let roomStatus: RoomUserStatus = 'online';
              
              switch (userStatus.activityStatus?.toLowerCase()) {
                case 'offline':
                  globalStatus = 'offline';
                  roomStatus = 'offline';
                  break;
                case 'away':
                case 'busy':
                  roomStatus = 'away';
                  break;
                case 'in_room':
                case 'in-room':
                  roomStatus = 'in-room';
                  break;
                default:
                  roomStatus = 'online';
              }
              
              if (existing) {
                newMap.set(userStatus.userId, {
                  ...existing,
                  userName: userStatus.userName,
                  profilePicId: userStatus.profilePicId,
                  globalStatus,
                  roomStatus,
                  currentRoomId: userStatus.currentRoomId,
                  lastSeen: globalStatus === 'offline' ? new Date() : undefined,
                });
              } else {
                newMap.set(userStatus.userId, {
                  userId: userStatus.userId,
                  userName: userStatus.userName,
                  profilePicId: userStatus.profilePicId,
                  globalStatus,
                  roomStatus,
                  currentRoomId: userStatus.currentRoomId,
                  lastSeen: globalStatus === 'offline' ? new Date() : undefined,
                  isInSameRoom: false,
                });
              }
            });
            
            return newMap;
          });
        } catch (error) {
          console.error('Failed to fetch users status from backend:', error);
        }
      };

      try {
        socketService.onUserStatusUpdate(handleUserStatusUpdate);
        socketService.onGlobalUserStatusUpdate(handleGlobalUserStatusUpdate);
        socketService.onStatusChange(handleStatusChange);
        socketService.onUserActivityStatusUpdate(handleUserActivityStatusUpdate);
        socketService.onUserStatusRefresh(handleUserStatusRefresh);
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
  }, [isAuthenticated, user?.id, currentRoomId]); // Remove getUserStatusHook from dependencies

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
  }, [user?.id, globalStatus, roomStatus, currentRoomId]); // Remove getUserStatusHook from dependencies

  const updateGlobalStatus = useCallback(async (status: GlobalUserStatus) => {
    await updateGlobalStatusHook(status);
  }, [updateGlobalStatusHook]);

  const updateRoomStatus = useCallback(async (status: RoomUserStatus, roomId?: string) => {
    await updateRoomStatusHook(status, roomId);
  }, [updateRoomStatusHook]);

  const enterRoom = useCallback(async (roomId: string) => {
    await enterRoomHook(roomId);
    
    // Make sure current user is added to participants with correct room status
    if (user) {
      console.log('UserStatusContext - Adding current user to participants:', {
        userId: user.id,
        userName: user.name,
        roomId,
        currentRoomId: roomId // Use the roomId parameter since we just entered
      });
      
      setParticipants(prev => {
        const newMap = new Map(prev);
        newMap.set(user.id, {
          userId: user.id,
          userName: user.name,
          profilePicId: user.profilePicId,
          globalStatus: 'online',
          roomStatus: 'in-room',
          currentRoomId: roomId, // Set to the room we just entered
          lastSeen: undefined,
          isInSameRoom: true,
        });
        return newMap;
      });
    }
  }, [enterRoomHook, user]);

  const leaveRoom = useCallback(async () => {
    await leaveRoomHook();
  }, [leaveRoomHook]);

  const getUserStatus = useCallback((userId: string): UserStatusData | null => {
    return participants.get(userId) || null;
  }, [participants]);

  const updateParticipantStatus = useCallback((userData: UserStatusData) => {
    setParticipants(prev => {
      const newMap = new Map(prev);
      newMap.set(userData.userId, userData);
      return newMap;
    });
  }, []);

  const value = useMemo(() => ({
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
  ]);

  return <UserStatusContext.Provider value={value}>{children}</UserStatusContext.Provider>;
};
