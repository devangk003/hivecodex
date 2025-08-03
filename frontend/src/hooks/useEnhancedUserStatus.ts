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
  const [lastStatusUpdate, setLastStatusUpdate] = useState(0);

  // Rate limiting constants
  const STATUS_UPDATE_COOLDOWN = 3000; // 3 seconds between status updates

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
        // Emit status update to socket
        socketService.emitUserStatus(currentRoomId, 'in-room');
      } else if (!visible && currentRoomId) {
        setRoomStatus('away');
        // Emit away status to socket
        socketService.emitUserStatus(currentRoomId, 'away');
      } else if (visible && !currentRoomId) {
        setGlobalStatus('online');
        // Update backend status
        activityAPI.setStatus('online').catch(() => {});
      } else if (!visible && !currentRoomId) {
        setGlobalStatus('away');
        // Update backend status
        activityAPI.setStatus('away').catch(() => {});
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
      // Rate limiting
      const now = Date.now();
      if (now - lastStatusUpdate < STATUS_UPDATE_COOLDOWN) {
        return; // Skip if too recent
      }
      setLastStatusUpdate(now);

      setGlobalStatus(status);
      
      // Update backend (optional - don't fail if endpoint doesn't exist)
      // Only try to update backend if we're not already in an error state
      if (navigator.onLine) {
        try {
          const activityStatus = status === 'online' ? 'Online' : 'Offline';
          await activityAPI.setStatus(activityStatus);
        } catch (apiError) {
          // Silently fail - don't log to prevent console spam
          // Backend endpoint might not be available
        }
      }
      
      // Emit to all rooms if connected
      if (socketService.isConnected()) {
        socketService.emitGlobalUserStatus(status);
      }
    } catch (error) {
      // Silently fail to prevent infinite error loops
    }
  }, [lastStatusUpdate]);

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
    // Prevent rapid room changes
    const now = Date.now();
    if (now - lastStatusUpdate < STATUS_UPDATE_COOLDOWN) {
      return; // Skip if too recent
    }
    setLastStatusUpdate(now);

    setCurrentRoomId(roomId);
    setRoomStatus('in-room');
    setGlobalStatus('online'); // Set global status to online when entering room
    
    // Update backend about room entry (optional) - with rate limiting
    try {
      // Only update if online and not in rapid succession
      if (navigator.onLine) {
        await activityAPI.setStatus('in-room');
      }
    } catch (error) {
      // Silently fail to prevent console spam
    }

    // Emit room status
    socketService.emitUserStatus(roomId, 'in-room');
  }, [lastStatusUpdate]);

  // Leave room
  const leaveRoom = useCallback(async () => {
    // Rate limiting
    const now = Date.now();
    if (now - lastStatusUpdate < STATUS_UPDATE_COOLDOWN) {
      return; // Skip if too recent
    }
    setLastStatusUpdate(now);

    if (currentRoomId) {
      socketService.emitUserStatus(currentRoomId, 'offline');
    }
    
    setCurrentRoomId(null);
    setRoomStatus('online');
    
    // Update backend (optional) - with rate limiting
    try {
      if (navigator.onLine) {
        await activityAPI.setStatus('Online');
      }
    } catch (error) {
      // Silently fail to prevent console spam
    }
  }, [currentRoomId, lastStatusUpdate]);

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
