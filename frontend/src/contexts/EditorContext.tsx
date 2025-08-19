import React, { createContext, useContext, useReducer, useCallback, ReactNode } from 'react';
import type { FileTab } from '@/types';

// Editor state interface
export interface EditorState {
  tabs: FileTab[];
  activeTabIndex: number;
  isLoading: boolean;
  isSaving: boolean;
  userClosedAllTabs: boolean;
  canScrollLeft: boolean;
  canScrollRight: boolean;
  editorOptions: Record<string, any>;
  theme: string;
  language: string;
  fontSize: number;
}

// Editor action types
export type EditorAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_SAVING'; payload: boolean }
  | { type: 'ADD_TAB'; payload: FileTab }
  | { type: 'CLOSE_TAB'; payload: number }
  | { type: 'SET_ACTIVE_TAB'; payload: number }
  | { type: 'UPDATE_TAB_CONTENT'; payload: { index: number; content: string } }
  | { type: 'SET_TAB_MODIFIED'; payload: { index: number; isModified: boolean } }
  | { type: 'SET_SCROLL_STATE'; payload: { canScrollLeft: boolean; canScrollRight: boolean } }
  | { type: 'RESET_USER_CLOSED_FLAG' }
  | { type: 'OPEN_FILE_AFTER_CLOSE_ALL' }
  | { type: 'SET_EDITOR_OPTIONS'; payload: Record<string, any> }
  | { type: 'SET_THEME'; payload: string }
  | { type: 'SET_LANGUAGE'; payload: string }
  | { type: 'SET_FONT_SIZE'; payload: number }
  | { type: 'CLOSE_ALL_TABS' }
  | { type: 'DUPLICATE_TAB'; payload: number }
  | { type: 'REORDER_TABS'; payload: { fromIndex: number; toIndex: number } };

// Initial state
const initialState: EditorState = {
  tabs: [],
  activeTabIndex: -1,
  isLoading: false,
  isSaving: false,
  userClosedAllTabs: false,
  canScrollLeft: false,
  canScrollRight: false,
  editorOptions: {},
  theme: 'hivecodex-dark',
  language: 'javascript',
  fontSize: 14,
};

// Editor reducer
function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };

    case 'SET_SAVING':
      return { ...state, isSaving: action.payload };

    case 'ADD_TAB': {
      const newTab = action.payload;
      // Check if tab already exists
      const existingTabIndex = state.tabs.findIndex(tab => tab.fileId === newTab.fileId);
      
      if (existingTabIndex !== -1) {
        // Tab exists, just activate it
        return {
          ...state,
          activeTabIndex: existingTabIndex,
          userClosedAllTabs: false,
        };
      }

      // Add new tab
      const newTabs = state.tabs.map(tab => ({ ...tab, isActive: false }));
      newTabs.push(newTab);
      return {
        ...state,
        tabs: newTabs,
        activeTabIndex: newTabs.length - 1,
        userClosedAllTabs: false,
      };
    }

    case 'CLOSE_TAB': {
      const tabIndex = action.payload;
      const newTabs = state.tabs.filter((_, index) => index !== tabIndex);

      let newActiveTabIndex = state.activeTabIndex;
      let userClosedAllTabs = state.userClosedAllTabs;

      if (newTabs.length === 0) {
        newActiveTabIndex = -1;
        userClosedAllTabs = true;
      } else if (tabIndex === state.activeTabIndex) {
        // If closing active tab, switch to adjacent tab
        newActiveTabIndex = Math.min(tabIndex, newTabs.length - 1);
      } else if (tabIndex < state.activeTabIndex) {
        // If closing tab before active tab, adjust active index
        newActiveTabIndex = state.activeTabIndex - 1;
      }

      return {
        ...state,
        tabs: newTabs,
        activeTabIndex: newActiveTabIndex,
        userClosedAllTabs,
      };
    }

    case 'CLOSE_ALL_TABS':
      return {
        ...state,
        tabs: [],
        activeTabIndex: -1,
        userClosedAllTabs: true,
      };

    case 'SET_ACTIVE_TAB': {
      const newActiveIndex = action.payload;
      // Avoid unnecessary state updates if the active tab is unchanged
      if (newActiveIndex === state.activeTabIndex) {
        return state;
      }
      if (newActiveIndex >= 0 && newActiveIndex < state.tabs.length) {
        const newTabs = state.tabs.map((tab, index) => ({
          ...tab,
          isActive: index === newActiveIndex,
        }));
        return {
          ...state,
          tabs: newTabs,
          activeTabIndex: newActiveIndex,
        };
      }
      return state;
    }

    case 'UPDATE_TAB_CONTENT': {
      const { index, content } = action.payload;
      if (index >= 0 && index < state.tabs.length) {
        const newTabs = [...state.tabs];
        const currentTab = newTabs[index];
        newTabs[index] = {
          ...currentTab,
          content,
          isModified: true, // Mark as modified when content changes
        };
        return { ...state, tabs: newTabs };
      }
      return state;
    }

    case 'SET_TAB_MODIFIED': {
      const { index, isModified } = action.payload;
      if (index >= 0 && index < state.tabs.length) {
        const newTabs = [...state.tabs];
        newTabs[index] = { ...newTabs[index], isModified };
        return { ...state, tabs: newTabs };
      }
      return state;
    }

    case 'SET_SCROLL_STATE':
      return {
        ...state,
        canScrollLeft: action.payload.canScrollLeft,
        canScrollRight: action.payload.canScrollRight,
      };

    case 'RESET_USER_CLOSED_FLAG':
      return { ...state, userClosedAllTabs: false };

    case 'OPEN_FILE_AFTER_CLOSE_ALL':
      return { ...state, userClosedAllTabs: false };

    case 'SET_EDITOR_OPTIONS':
      return { ...state, editorOptions: { ...state.editorOptions, ...action.payload } };

    case 'SET_THEME':
      return { ...state, theme: action.payload };

    case 'SET_LANGUAGE':
      return { ...state, language: action.payload };

    case 'SET_FONT_SIZE':
      return { ...state, fontSize: action.payload };

    case 'DUPLICATE_TAB': {
      const tabIndex = action.payload;
      if (tabIndex >= 0 && tabIndex < state.tabs.length) {
        const originalTab = state.tabs[tabIndex];
        const duplicatedTab: FileTab = {
          ...originalTab,
          fileId: `${originalTab.fileId}_copy_${Date.now()}`,
          name: `${originalTab.name} (Copy)`,
          isActive: true,
        };
        
        const newTabs = state.tabs.map(tab => ({ ...tab, isActive: false }));
        newTabs.splice(tabIndex + 1, 0, duplicatedTab);
        
        return {
          ...state,
          tabs: newTabs,
          activeTabIndex: tabIndex + 1,
        };
      }
      return state;
    }

    case 'REORDER_TABS': {
      const { fromIndex, toIndex } = action.payload;
      if (
        fromIndex >= 0 &&
        fromIndex < state.tabs.length &&
        toIndex >= 0 &&
        toIndex < state.tabs.length &&
        fromIndex !== toIndex
      ) {
        const newTabs = [...state.tabs];
        const [movedTab] = newTabs.splice(fromIndex, 1);
        newTabs.splice(toIndex, 0, movedTab);

        // Update active tab index
        let newActiveTabIndex = state.activeTabIndex;
        if (state.activeTabIndex === fromIndex) {
          newActiveTabIndex = toIndex;
        } else if (fromIndex < state.activeTabIndex && toIndex >= state.activeTabIndex) {
          newActiveTabIndex = state.activeTabIndex - 1;
        } else if (fromIndex > state.activeTabIndex && toIndex <= state.activeTabIndex) {
          newActiveTabIndex = state.activeTabIndex + 1;
        }

        return {
          ...state,
          tabs: newTabs,
          activeTabIndex: newActiveTabIndex,
        };
      }
      return state;
    }

    default:
      return state;
  }
}

// Context interface
export interface EditorContextType {
  state: EditorState;
  dispatch: React.Dispatch<EditorAction>;
  // Helper functions
  addTab: (tab: FileTab) => void;
  closeTab: (index: number) => void;
  closeAllTabs: () => void;
  setActiveTab: (index: number) => void;
  updateTabContent: (index: number, content: string) => void;
  setTabModified: (index: number, isModified: boolean) => void;
  duplicateTab: (index: number) => void;
  reorderTabs: (fromIndex: number, toIndex: number) => void;
  setEditorOptions: (options: Record<string, any>) => void;
  setTheme: (theme: string) => void;
  setLanguage: (language: string) => void;
  setFontSize: (fontSize: number) => void;
  getActiveTab: () => FileTab | null;
  isTabModified: (index: number) => boolean;
}

// Create context
export const EditorContext = createContext<EditorContextType | undefined>(undefined);

// Provider props
interface EditorProviderProps {
  children: ReactNode;
  initialTabs?: FileTab[];
}

// Provider component
export const EditorProvider: React.FC<EditorProviderProps> = ({ 
  children, 
  initialTabs = [] 
}) => {
  const [state, dispatch] = useReducer(editorReducer, {
    ...initialState,
    tabs: initialTabs,
    activeTabIndex: initialTabs.length > 0 ? 0 : -1,
  });

  // Helper functions
  const addTab = useCallback((tab: FileTab) => {
    dispatch({ type: 'ADD_TAB', payload: tab });
  }, []);

  const closeTab = useCallback((index: number) => {
    dispatch({ type: 'CLOSE_TAB', payload: index });
  }, []);

  const closeAllTabs = useCallback(() => {
    dispatch({ type: 'CLOSE_ALL_TABS' });
  }, []);

  const setActiveTab = useCallback((index: number) => {
    dispatch({ type: 'SET_ACTIVE_TAB', payload: index });
  }, []);

  const updateTabContent = useCallback((index: number, content: string) => {
    dispatch({ type: 'UPDATE_TAB_CONTENT', payload: { index, content } });
  }, []);

  const setTabModified = useCallback((index: number, isModified: boolean) => {
    dispatch({ type: 'SET_TAB_MODIFIED', payload: { index, isModified } });
  }, []);

  const duplicateTab = useCallback((index: number) => {
    dispatch({ type: 'DUPLICATE_TAB', payload: index });
  }, []);

  const reorderTabs = useCallback((fromIndex: number, toIndex: number) => {
    dispatch({ type: 'REORDER_TABS', payload: { fromIndex, toIndex } });
  }, []);

  const setEditorOptions = useCallback((options: Record<string, any>) => {
    dispatch({ type: 'SET_EDITOR_OPTIONS', payload: options });
  }, []);

  const setTheme = useCallback((theme: string) => {
    dispatch({ type: 'SET_THEME', payload: theme });
  }, []);

  const setLanguage = useCallback((language: string) => {
    dispatch({ type: 'SET_LANGUAGE', payload: language });
  }, []);

  const setFontSize = useCallback((fontSize: number) => {
    dispatch({ type: 'SET_FONT_SIZE', payload: fontSize });
  }, []);

  const getActiveTab = useCallback((): FileTab | null => {
    if (state.activeTabIndex >= 0 && state.activeTabIndex < state.tabs.length) {
      return state.tabs[state.activeTabIndex];
    }
    return null;
  }, [state.activeTabIndex, state.tabs]);

  const isTabModified = useCallback((index: number): boolean => {
    if (index >= 0 && index < state.tabs.length) {
      return state.tabs[index].isModified || false;
    }
    return false;
  }, [state.tabs]);

  const value: EditorContextType = {
    state,
    dispatch,
    addTab,
    closeTab,
    closeAllTabs,
    setActiveTab,
    updateTabContent,
    setTabModified,
    duplicateTab,
    reorderTabs,
    setEditorOptions,
    setTheme,
    setLanguage,
    setFontSize,
    getActiveTab,
    isTabModified,
  };

  return (
    <EditorContext.Provider value={value}>
      {children}
    </EditorContext.Provider>
  );
};

// Hook to use the editor context
export const useEditor = (): EditorContextType => {
  const context = useContext(EditorContext);
  if (context === undefined) {
    throw new Error('useEditor must be used within an EditorProvider');
  }
  return context;
};

// Hook to get active tab
export const useActiveTab = (): FileTab | null => {
  const { getActiveTab } = useEditor();
  return getActiveTab();
};

// Hook to get editor settings
export const useEditorSettings = () => {
  const { state, setTheme, setFontSize, setEditorOptions } = useEditor();
  
  return {
    theme: state.theme,
    fontSize: state.fontSize,
    editorOptions: state.editorOptions,
    setTheme,
    setFontSize,
    setEditorOptions,
  };
};
