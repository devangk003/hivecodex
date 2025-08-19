import { useState, useCallback, useRef, useEffect } from 'react';
import { aiService, AICompletionRequest, AICompletionResponse } from '@/services/aiService';

export interface AISuggestionState {
  suggestions: string[];
  isLoading: boolean;
  error: string | null;
  confidence: number;
  lastRequestTime: number;
}

export interface AISuggestionOptions {
  debounceMs?: number;
  minContentLength?: number;
  maxSuggestions?: number;
  enableAutoSuggest?: boolean;
}

const DEFAULT_OPTIONS: Required<AISuggestionOptions> = {
  debounceMs: 500,
  minContentLength: 3,
  maxSuggestions: 3,
  enableAutoSuggest: true,
};

export const useAISuggestion = (options: AISuggestionOptions = {}) => {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  const [state, setState] = useState<AISuggestionState>({
    suggestions: [],
    isLoading: false,
    error: null,
    confidence: 0,
    lastRequestTime: 0,
  });

  const debounceTimerRef = useRef<NodeJS.Timeout>();
  const abortControllerRef = useRef<AbortController>();
  const lastRequestRef = useRef<string>('');

  const clearSuggestions = useCallback(() => {
    setState(prev => ({
      ...prev,
      suggestions: [],
      error: null,
      confidence: 0,
    }));
  }, []);

  const generateSuggestions = useCallback(async (
    content: string,
    language: string = 'javascript',
    context?: string,
    cursorPosition?: number,
    fileContent?: string
  ): Promise<AICompletionResponse | null> => {
    // Validate input
    if (!content || content.length < opts.minContentLength) {
      clearSuggestions();
      return null;
    }

    // Create unique request key to avoid duplicate requests
    const requestKey = `${content}-${language}-${cursorPosition}`;
    if (requestKey === lastRequestRef.current) {
      return null;
    }

    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setState(prev => ({
      ...prev,
      isLoading: true,
      error: null,
    }));

    try {
      const request: AICompletionRequest = {
        content: content.trim(),
        language,
        context,
        cursorPosition,
        fileContent,
      };

      const response = await aiService.generateSuggestions(request);
      
      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to generate suggestions');
      }

      lastRequestRef.current = requestKey;
      
      setState(prev => ({
        ...prev,
        suggestions: response.data!.suggestions.slice(0, opts.maxSuggestions),
        confidence: response.data!.confidence,
        isLoading: false,
        error: null,
        lastRequestTime: Date.now(),
      }));

      return response.data;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        // Request was cancelled, don't update state
        return null;
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
        suggestions: [],
      }));

      console.error('AI suggestion error:', error);
      return null;
    }
  }, [opts.minContentLength, opts.maxSuggestions, clearSuggestions]);

  const debouncedGenerateSuggestions = useCallback((
    content: string,
    language: string = 'javascript',
    context?: string,
    cursorPosition?: number,
    fileContent?: string
  ) => {
    // Clear existing debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Set new debounce timer
    debounceTimerRef.current = setTimeout(() => {
      if (opts.enableAutoSuggest) {
        generateSuggestions(content, language, context, cursorPosition, fileContent);
      }
    }, opts.debounceMs);
  }, [generateSuggestions, opts.debounceMs, opts.enableAutoSuggest]);

  const manualSuggest = useCallback((
    content: string,
    language: string = 'javascript',
    context?: string,
    cursorPosition?: number,
    fileContent?: string
  ) => {
    // Clear debounce timer for manual requests
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    
    return generateSuggestions(content, language, context, cursorPosition, fileContent);
  }, [generateSuggestions]);

  const applySuggestion = useCallback((suggestion: string): string => {
    // Clean up suggestion for application
    return suggestion.trim();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    ...state,
    generateSuggestions: debouncedGenerateSuggestions,
    manualSuggest,
    clearSuggestions,
    applySuggestion,
    isEnabled: opts.enableAutoSuggest,
  };
};

export default useAISuggestion;
