import { useState, useEffect, useCallback } from 'react';
import socketService from '@/lib/socket';

export type UserStatus = 'online' | 'away' | 'offline';

interface UseUserStatusReturn {
  status: UserStatus;
  isOnline: boolean;
  isAway: boolean;
  isOffline: boolean;
  setStatus: (status: UserStatus) => void;
}

export const useUserStatus = (roomId?: string): UseUserStatusReturn => {
  const [status, setStatusState] = useState<UserStatus>('online');
  const [isPageVisible, setIsPageVisible] = useState(true);
  const [lastActivity, setLastActivity] = useState(Date.now());
  const [isManualOverride, setIsManualOverride] = useState(false);

  // Activity tracking
  const updateActivity = useCallback(() => {
    setLastActivity(Date.now());
    if (status === 'away' && isPageVisible && !isManualOverride) {
      setStatusState('online');
    }
  }, [status, isPageVisible, isManualOverride]);

  // Page visibility tracking
  useEffect(() => {
    const handleVisibilityChange = () => {
      const visible = !document.hidden;
      setIsPageVisible(visible);

      if (visible && !isManualOverride) {
        setStatusState('online');
        updateActivity();
      } else if (!visible && !isManualOverride) {
        setStatusState('away');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () =>
      document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [updateActivity, isManualOverride]);

  // Activity listeners
  useEffect(() => {
    const events = [
      'mousedown',
      'mousemove',
      'keypress',
      'scroll',
      'touchstart',
      'click',
    ];

    events.forEach(event => {
      document.addEventListener(event, updateActivity, { passive: true });
    });

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, updateActivity);
      });
    };
  }, [updateActivity]);

  // Away detection based on inactivity
  useEffect(() => {
    const checkActivity = () => {
      if (isManualOverride) return; // Don't auto-change if manually set

      const now = Date.now();
      const timeSinceActivity = now - lastActivity;
      const awayThreshold = 5 * 60 * 1000; // 5 minutes

      if (
        timeSinceActivity > awayThreshold &&
        isPageVisible &&
        status !== 'away'
      ) {
        setStatusState('away');
      }
    };

    const interval = setInterval(checkActivity, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [lastActivity, isPageVisible, status, isManualOverride]);

  // Online/offline detection
  useEffect(() => {
    const handleOnline = () => {
      if (!isManualOverride) {
        setStatusState('online');
        updateActivity();
      }
    };

    const handleOffline = () => {
      setStatusState('offline');
      setIsManualOverride(false); // Reset manual override on offline
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check initial state
    if (!navigator.onLine) {
      setStatusState('offline');
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [updateActivity, isManualOverride]);

  // Socket status updates
  useEffect(() => {
    if (!roomId || !socketService) return;

    // Emit status changes to the room
    socketService.emitUserStatus(roomId, status);
  }, [roomId, status]);

  const setStatus = useCallback(
    (newStatus: UserStatus) => {
      console.log('useUserStatus - setStatus called with:', newStatus);
      console.log('Current status before change:', status);
      setStatusState(newStatus);
      setLastActivity(Date.now());

      // Set manual override flag for manual status changes
      if (newStatus === 'away' || newStatus === 'online') {
        setIsManualOverride(true);
        // Clear manual override after 10 minutes to allow automatic detection again
        setTimeout(
          () => {
            setIsManualOverride(false);
          },
          10 * 60 * 1000
        );
      }

      if (roomId) {
        console.log('Emitting status to room:', roomId, newStatus);
        socketService.emitUserStatus(roomId, newStatus);
      } else {
        console.log('No roomId available, not emitting status');
      }
    },
    [roomId, status]
  );

  return {
    status,
    isOnline: status === 'online',
    isAway: status === 'away',
    isOffline: status === 'offline',
    setStatus,
  };
};
