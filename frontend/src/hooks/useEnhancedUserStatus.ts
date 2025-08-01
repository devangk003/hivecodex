import { useState, useEffect, useCallback } from 'react';
import socketService from '@/lib/socket';
import { authAPI, activityAPI } from '@/lib/api';
import type { GlobalUserStatus, RoomUserStatus, UserStatusData, StatusUpdatePayload } from '@/types/userStatus';

interface UseEnhancedUserStatusReturn {
  globalStatus: GlobalUserStatus;
  roomStatus: RoomUserStatus;
  currentRoomId: string | null;
  updateGlobalStatus: (status: GlobalUserStatus) => Promise<void>;
  updateRoomStatus: (status: RoomUserStatus, roomId?: string) => Promise<void>;
  enterRoom: (roomId: string) => Promise<void>;
  leaveRoom: () => Promise<void>;
  getUserStatus: () => UserStatusData | null;
}

export const useEnhancedUserStatus = (userId?: string): UseEnhancedUserStatusReturn => {
  const [globalStatus, setGlobalStatus] = useState<GlobalUserStatus>('online');
  const [roomStatus, setRoomStatus] = useState<RoomUserStatus>('online');
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);
  const [isPageVisible, setIsPageVisible] = useState(true);
  const [lastActivity, setLastActivity] = useState(Date.now());

  // Activity tracking
  const updateActivity = useCallback(() => {
    setLastActivity(Date.now());
    if (roomStatus === 'away' && isPageVisible) {
      setRoomStatus('in-room');
    }
  }, [roomStatus, isPageVisible]);

  // Page visibility tracking
  useEffect(() => {
    const handleVisibilityChange = () => {
      const visible = !document.hidden;
      setIsPageVisible(visible);

      if (visible && currentRoomId) {
        setRoomStatus('in-room');
        updateActivity();
      } else if (!visible && currentRoomId) {
        setRoomStatus('away');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [updateActivity, currentRoomId]);

  // Activity listeners
  useEffect(() => {
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];

    events.forEach(event => {
      document.addEventListener(event, updateActivity, { passive: true });
    });

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, updateActivity);
      });
    };
  }, [updateActivity]);

  // Away detection based on inactivity (only when in room)
  useEffect(() => {
    const checkActivity = () => {
      if (!currentRoomId) return;

      const now = Date.now();
      const timeSinceActivity = now - lastActivity;
      const awayThreshold = 3 * 60 * 1000; // 3 minutes

      if (timeSinceActivity > awayThreshold && isPageVisible && roomStatus === 'in-room') {
        setRoomStatus('away');
        if (currentRoomId) {
          socketService.emitUserStatus(currentRoomId, 'away');
        }
      }
    };

    const interval = setInterval(checkActivity, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [lastActivity, isPageVisible, roomStatus, currentRoomId]);

  // Update global status (website-wide)
  const updateGlobalStatus = useCallback(async (status: GlobalUserStatus) => {
    try {
      setGlobalStatus(status);
      
      // Update backend (optional - don't fail if endpoint doesn't exist)
      try {
        const activityStatus = status === 'online' ? 'Online' : 'Offline';
        await activityAPI.setStatus(activityStatus);
      } catch (apiError) {
        console.warn('Backend activity status update failed:', apiError);
        // Continue with local status update
      }
      
      // Emit to all rooms if connected
      if (socketService.isConnected()) {
        socketService.emitGlobalUserStatus(status);
      }
    } catch (error) {
      console.error('Failed to update global status:', error);
    }
  }, []);

  // Online/offline detection
  useEffect(() => {
    const handleOnline = async () => {
      setGlobalStatus('online');
      if (currentRoomId) {
        setRoomStatus('in-room');
      }
      await updateGlobalStatus('online');
    };

    const handleOffline = async () => {
      setGlobalStatus('offline');
      setRoomStatus('offline');
      await updateGlobalStatus('offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check initial state
    if (!navigator.onLine) {
      setGlobalStatus('offline');
      setRoomStatus('offline');
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [currentRoomId, updateGlobalStatus]);

  // Update room status
  const updateRoomStatus = useCallback(async (status: RoomUserStatus, roomId?: string) => {
    const targetRoomId = roomId || currentRoomId;
    if (!targetRoomId) return;

    setRoomStatus(status);
    
    // Emit room-specific status
    socketService.emitUserStatus(targetRoomId, status);
  }, [currentRoomId]);

  // Enter room
  const enterRoom = useCallback(async (roomId: string) => {
    setCurrentRoomId(roomId);
    setRoomStatus('in-room');
    
    // Update backend about room entry (optional)
    try {
      await activityAPI.setStatus('In Room');
    } catch (error) {
      console.warn('Failed to update room status in backend:', error);
      // Continue with local status update
    }

    // Emit room status
    socketService.emitUserStatus(roomId, 'in-room');
  }, []);

  // Leave room
  const leaveRoom = useCallback(async () => {
    if (currentRoomId) {
      socketService.emitUserStatus(currentRoomId, 'offline');
    }
    
    setCurrentRoomId(null);
    setRoomStatus('online');
    
    // Update backend (optional)
    try {
      await activityAPI.setStatus('Online');
    } catch (error) {
      console.warn('Failed to update status in backend:', error);
      // Continue with local status update
    }
  }, [currentRoomId]);

  // Get current user status data
  const getUserStatus = useCallback((): UserStatusData | null => {
    if (!userId) return null;

    return {
      userId,
      userName: '', // This should be filled by the component using this hook
      globalStatus,
      roomStatus,
      currentRoomId,
      lastSeen: globalStatus === 'offline' ? new Date() : undefined,
      isInSameRoom: false, // This will be calculated by components
    };
  }, [userId, globalStatus, roomStatus, currentRoomId]);

  return {
    globalStatus,
    roomStatus,
    currentRoomId,
    updateGlobalStatus,
    updateRoomStatus,
    enterRoom,
    leaveRoom,
    getUserStatus,
  };
};
