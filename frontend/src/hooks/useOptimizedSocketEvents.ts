import { useCallback, useRef, useEffect } from 'react';
import { useDebounce } from './useDebounce';
import socketService from '@/lib/socket';

interface SocketEventOptions {
  debounceMs?: number;
  throttleMs?: number;
  maxCalls?: number;
  timeWindow?: number;
}

/**
 * Custom hook for optimized socket event handling with debouncing and rate limiting
 */
export function useOptimizedSocketEvents() {
  const eventCountersRef = useRef<Map<string, { count: number; windowStart: number }>>(new Map());
  
  const registerOptimizedEvent = useCallback(<T extends (...args: any[]) => void>(
    eventName: string,
    handler: T,
    options: SocketEventOptions = {}
  ) => {
    const {
      debounceMs = 0,
      throttleMs = 0,
      maxCalls = Infinity,
      timeWindow = 60000 // 1 minute
    } = options;

    // Rate limiting wrapper
    const rateLimitedHandler = useCallback((...args: Parameters<T>) => {
      const now = Date.now();
      const counter = eventCountersRef.current.get(eventName) || { count: 0, windowStart: now };
      
      // Reset counter if time window has passed
      if (now - counter.windowStart > timeWindow) {
        counter.count = 0;
        counter.windowStart = now;
      }
      
      // Check rate limit
      if (counter.count >= maxCalls) {
        console.warn(`Rate limit exceeded for socket event: ${eventName}`);
        return;
      }
      
      counter.count++;
      eventCountersRef.current.set(eventName, counter);
      
      handler(...args);
    }, [handler, eventName, maxCalls, timeWindow]);

    // Apply debouncing if specified
    const optimizedHandler = debounceMs > 0 
      ? useDebounce(rateLimitedHandler, debounceMs)
      : rateLimitedHandler;

    // Register the event
    useEffect(() => {
      if (socketService.socket) {
        socketService.socket.on(eventName, optimizedHandler);
        
        return () => {
          socketService.socket?.off(eventName, optimizedHandler);
          // Cleanup debounce if it exists
          if ('cleanup' in optimizedHandler) {
            (optimizedHandler as any).cleanup();
          }
        };
      }
    }, [eventName, optimizedHandler]);

    return optimizedHandler;
  }, []);

  const clearEventCounters = useCallback(() => {
    eventCountersRef.current.clear();
  }, []);

  return {
    registerOptimizedEvent,
    clearEventCounters
  };
}

/**
 * Hook for batching multiple socket events to reduce re-renders
 */
export function useBatchedSocketEvents<T>(
  eventNames: string[],
  batchHandler: (events: Array<{ eventName: string; data: T }>) => void,
  batchDelay: number = 100
) {
  const batchRef = useRef<Array<{ eventName: string; data: T }>>([]);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const processBatch = useCallback(() => {
    if (batchRef.current.length > 0) {
      batchHandler([...batchRef.current]);
      batchRef.current = [];
    }
  }, [batchHandler]);

  const debouncedProcessBatch = useDebounce(processBatch, batchDelay);

  useEffect(() => {
    const handlers = eventNames.map(eventName => {
      const handler = (data: T) => {
        batchRef.current.push({ eventName, data });
        debouncedProcessBatch();
      };

      if (socketService.socket) {
        socketService.socket.on(eventName, handler);
      }

      return { eventName, handler };
    });

    return () => {
      handlers.forEach(({ eventName, handler }) => {
        socketService.socket?.off(eventName, handler);
      });
      
      // Cleanup debounce
      if ('cleanup' in debouncedProcessBatch) {
        (debouncedProcessBatch as any).cleanup();
      }
      
      // Clear timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [eventNames, debouncedProcessBatch]);

  // Force process remaining batch on unmount
  useEffect(() => {
    return () => {
      processBatch();
    };
  }, [processBatch]);
}
