import { useCallback, useRef } from 'react';

/**
 * Custom hook for debouncing function calls
 */
export function useDebounce<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const callbackRef = useRef(callback);

  // Update callback ref when callback changes
  callbackRef.current = callback;

  const debouncedCallback = useCallback(
    (...args: Parameters<T>) => {
      // Clear existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Set new timeout
      timeoutRef.current = setTimeout(() => {
        callbackRef.current(...args);
      }, delay);
    },
    [delay]
  ) as T;

  // Cleanup on unmount
  const cleanup = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  }, []);

  // Expose cleanup for manual use
  (debouncedCallback as any).cleanup = cleanup;

  return debouncedCallback;
}

/**
 * Custom hook for API calls with AbortController cleanup
 */
export function useAbortableRequest() {
  const abortControllerRef = useRef<AbortController | null>(null);

  const makeRequest = useCallback(async <T>(
    requestFn: (signal: AbortSignal) => Promise<T>
  ): Promise<T | null> => {
    // Abort previous request if still pending
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new AbortController
    abortControllerRef.current = new AbortController();

    try {
      const result = await requestFn(abortControllerRef.current.signal);
      return result;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('Request was aborted');
        return null;
      }
      throw error;
    }
  }, []);

  const abort = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  // Cleanup on unmount
  const cleanup = useCallback(() => {
    abort();
  }, [abort]);

  return { makeRequest, abort, cleanup };
}
