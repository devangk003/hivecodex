import React, { useEffect, useRef, useCallback, useReducer } from 'react';
import { Editor, useMonaco } from '@monaco-editor/react';
import { editor } from 'monaco-editor';
import { UserCursor, CollaborativeChange } from '@/lib/collaboration';
import {
  X,
  Save,
  Undo,
  Redo,
  Users,
  ChevronLeft,
  ChevronRight,
  Search,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { fileAPI } from '@/lib/api';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { collaborationService } from '@/lib/collaboration';
import socketService from '@/lib/socket';
import { Badge } from '@/components/ui/badge';
import type { FileTab, SelectedFile } from '@/types';
import './MonacoEditor.css';

// Helper function to get consistent user color
const getUserColor = (userId: string): string => {
  const colors = [
    '#FF6B6B', // Red
    '#4ECDC4', // Teal
    '#45B7D1', // Blue
    '#96CEB4', // Green
    '#FECA57', // Yellow
    '#FF9FF3', // Pink
    '#54A0FF', // Light Blue
    '#5F27CD', // Purple
    '#00D2D3', // Cyan
    '#FF9F43', // Orange
  ];
  
  // Generate a consistent hash from userId
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    const char = userId.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  // Use absolute value and modulo to get consistent color index
  const colorIndex = Math.abs(hash) % colors.length;
  return colors[colorIndex];
};

interface MonacoEditorProps {
  roomId: string;
  selectedFile?: SelectedFile | null;
  onFileContentChange?: (fileId: string, content: string) => void;
}

// Consolidated state interface
interface EditorState {
  tabs: FileTab[];
  activeTabIndex: number;
  isLoading: boolean;
  isSaving: boolean;
  userClosedAllTabs: boolean;
  canScrollLeft: boolean;
  canScrollRight: boolean;
  collaborators: Map<string, UserCursor>;
}

// Action types for state management
type EditorAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_SAVING'; payload: boolean }
  | { type: 'ADD_TAB'; payload: FileTab }
  | { type: 'CLOSE_TAB'; payload: number }
  | { type: 'SET_ACTIVE_TAB'; payload: number }
  | { type: 'UPDATE_TAB_CONTENT'; payload: { index: number; content: string } }
  | { type: 'SET_TAB_MODIFIED'; payload: { index: number; isModified: boolean } }
  | {
      type: 'SET_SCROLL_STATE';
      payload: { canScrollLeft: boolean; canScrollRight: boolean };
    }
  | { type: 'SET_COLLABORATORS'; payload: Map<string, UserCursor> }
  | { type: 'RESET_USER_CLOSED_FLAG' }
  | { type: 'OPEN_FILE_AFTER_CLOSE_ALL' };

// Initial state
const initialState: EditorState = {
  tabs: [],
  activeTabIndex: -1,
  isLoading: false,
  isSaving: false,
  userClosedAllTabs: false,
  canScrollLeft: false,
  canScrollRight: false,
  collaborators: new Map(),
};

// Optimized reducer for all state management
function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };

    case 'SET_SAVING':
      return { ...state, isSaving: action.payload };

    case 'ADD_TAB': {
      const newTab = action.payload;
      const newTabs = state.tabs.map(tab => ({ ...tab, isActive: false }));
      newTabs.push(newTab);
      return {
        ...state,
        tabs: newTabs,
        activeTabIndex: newTabs.length - 1,
        userClosedAllTabs: false, // Reset flag when adding new tab
      };
    }

    case 'CLOSE_TAB': {
      const tabIndex = action.payload;
      const newTabs = state.tabs.filter((_, index) => index !== tabIndex);

      let newActiveTabIndex = state.activeTabIndex;
      let userClosedAllTabs = state.userClosedAllTabs;

      if (newTabs.length === 0) {
        newActiveTabIndex = -1;
        userClosedAllTabs = true; // User explicitly closed all tabs
      } else if (tabIndex === state.activeTabIndex) {
        newActiveTabIndex = Math.max(0, tabIndex - 1);
      } else if (tabIndex < state.activeTabIndex) {
        newActiveTabIndex = state.activeTabIndex - 1;
      }

      return {
        ...state,
        tabs: newTabs.map((t, i) => ({
          ...t,
          isActive: i === newActiveTabIndex,
        })),
        activeTabIndex: newActiveTabIndex,
        userClosedAllTabs,
      };
    }

    case 'SET_ACTIVE_TAB': {
      const newActiveIndex = action.payload;
      if (newActiveIndex === state.activeTabIndex) return state;

      return {
        ...state,
        activeTabIndex: newActiveIndex,
        tabs: state.tabs.map((tab, index) => ({
          ...tab,
          isActive: index === newActiveIndex,
        })),
      };
    }

    case 'UPDATE_TAB_CONTENT': {
      const { index, content } = action.payload;
      return {
        ...state,
        tabs: state.tabs.map((tab, i) =>
          i === index ? { ...tab, content } : tab
        ),
      };
    }

    case 'SET_TAB_MODIFIED': {
      const { index, isModified } = action.payload;
      return {
        ...state,
        tabs: state.tabs.map((tab, i) =>
          i === index ? { ...tab, isModified } : tab
        ),
      };
    }

    case 'SET_SCROLL_STATE':
      return {
        ...state,
        canScrollLeft: action.payload.canScrollLeft,
        canScrollRight: action.payload.canScrollRight,
      };

    case 'SET_COLLABORATORS':
      return { ...state, collaborators: action.payload };

    case 'RESET_USER_CLOSED_FLAG':
      return { ...state, userClosedAllTabs: false };

    case 'OPEN_FILE_AFTER_CLOSE_ALL':
      return { ...state, userClosedAllTabs: false };

    default:
      return state;
  }
}

const getLanguageFromExtension = (extension: string): string => {
  const languageMap: { [key: string]: string } = {
    js: 'javascript',
    jsx: 'javascript',
    ts: 'typescript',
    tsx: 'typescript',
    py: 'python',
    java: 'java',
    cpp: 'cpp',
    c: 'c',
    cs: 'csharp',
    php: 'php',
    rb: 'ruby',
    go: 'go',
    rs: 'rust',
    swift: 'swift',
    kt: 'kotlin',
    scala: 'scala',
    html: 'html',
    css: 'css',
    scss: 'scss',
    sass: 'sass',
    less: 'less',
    json: 'json',
    xml: 'xml',
    yaml: 'yaml',
    yml: 'yaml',
    md: 'markdown',
    sql: 'sql',
    sh: 'shell',
    bash: 'shell',
    zsh: 'shell',
    ps1: 'powershell',
    dockerfile: 'dockerfile',
    env: 'properties',
    properties: 'properties',
    ini: 'ini',
    toml: 'toml',
    gitignore: 'gitignore',
    txt: 'plaintext',
  };

  return languageMap[extension.toLowerCase()] || 'plaintext';
};

export const MonacoEditor: React.FC<MonacoEditorProps> = ({
  roomId,
  selectedFile,
  onFileContentChange,
}) => {
  // Single state management with useReducer
  const [state, dispatch] = useReducer(editorReducer, initialState);

  // Extract frequently used values for cleaner code
  const {
    tabs,
    activeTabIndex,
    userClosedAllTabs,
    collaborators,
  } = state;
  const activeTab = activeTabIndex >= 0 ? tabs[activeTabIndex] : null;

  // Refs remain the same
  const tabsContainerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const createdModelsRef = useRef<editor.IEditorModel[]>([]);
  const currentModelRef = useRef<string | null>(null); // Track current model to prevent unnecessary switches
  const editorReadyRef = useRef<boolean>(false); // Track if editor is ready
  const { user } = useAuth();
  const monaco = useMonaco();

  // This ref will hold the latest state, preventing stale closures in callbacks.
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const activeTabForEffect = state.tabs[state.activeTabIndex];
  const activeFileId = activeTabForEffect?.fileId;
  const activeFileContent = activeTabForEffect?.content;

  // Initialize collaboration service
  useEffect(() => {
    if (user && roomId) {
      collaborationService.setUser({ id: user.id, name: user.name });
      collaborationService.setRoomId(roomId);

      // change: { fileId: string, ... }
      const handleRemoteChange = (change: CollaborativeChange) => {
        collaborationService.applyRemoteChange(change);
        const { tabs, activeTabIndex } = stateRef.current;
        const activeTab = tabs[activeTabIndex];
        if (activeTab && activeTab.fileId === change.fileId) {
          const model = editorRef.current?.getModel();
          if (model) {
            dispatch({
              type: 'UPDATE_TAB_CONTENT',
              payload: {
                index: activeTabIndex,
                content: model.getValue(),
              },
            });
          }
        }
      };

      // cursor: UserCursor
      const handleCursorUpdate = (cursor: UserCursor) => {
        collaborationService.updateRemoteCursor(cursor);

        // Update collaborators state with current file users only
        const { tabs, activeTabIndex } = stateRef.current;
        const currentFileId = tabs[activeTabIndex]?.fileId;
        if (currentFileId) {
          const currentFileCursors = new Map();
          collaborationService.getUserCursors().forEach((c, userId) => {
            if (c.fileId === currentFileId) {
              currentFileCursors.set(userId, c);
            }
          });
          dispatch({
            type: 'SET_COLLABORATORS',
            payload: currentFileCursors,
          });
        }
      };

      // data: { fileId: string, content: string, version: number }
      const handleFileSync = (data: {
        fileId: string;
        content: string;
        version: number;
      }) => {
        collaborationService.initializeFile(
          data.fileId,
          data.content,
          data.version
        );
        const { tabs } = stateRef.current;
        const tabIndex = tabs.findIndex(t => t.fileId === data.fileId);
        if (tabIndex > -1) {
          dispatch({
            type: 'UPDATE_TAB_CONTENT',
            payload: {
              index: tabIndex,
              content: data.content,
            },
          });
        }
      };

      const handleRequestFileSyncFromPeer = (data: {
        fileId: string;
        requesterId: string;
      }) => {
        const fileState = collaborationService.getFileState(data.fileId);
        if (fileState) {
          socketService.sendFileSyncToPeer({
            requesterId: data.requesterId,
            fileId: data.fileId,
            content: fileState.content,
            version: fileState.version,
          });
        }
      };

      socketService.onCollaborativeChange(handleRemoteChange);
      socketService.onCursorUpdate(handleCursorUpdate);
      socketService.onFileSync(handleFileSync);
      socketService.onRequestFileSyncFromPeer(handleRequestFileSyncFromPeer);

      return () => {
        collaborationService.cleanup();
      };
    }
  }, [user, roomId, dispatch]);

  const loadFileContent = useCallback(
    async (file: {
      fileId: string;
      name: string;
      extension?: string;
      path: string;
    }) => {
      if (!file.fileId) return;

      console.log("branch", file.name, file.path); // VS Code reference pattern

      const { tabs, userClosedAllTabs } = stateRef.current;
      const existingTabIndex = tabs.findIndex(tab => tab.fileId === file.fileId);
      if (existingTabIndex >= 0) {
        dispatch({ type: 'SET_ACTIVE_TAB', payload: existingTabIndex });
        if (userClosedAllTabs) {
          dispatch({ type: 'RESET_USER_CLOSED_FLAG' });
        }
        return;
      }

      dispatch({ type: 'SET_LOADING', payload: true });
      try {
        const fileData = await fileAPI.getFileContent(file.fileId);
        const language = getLanguageFromExtension(file.extension || '');

        // Create active file object matching VS Code reference pattern
        const activeFileObject = {
          path: file.path,
          name: file.name,
          extension: file.extension,
          language: language,
          isModified: false
        };

        // Create selected file for editor matching VS Code reference structure
        const selectedFileForEditor = {
          name: file.name,
          path: file.path,
          content: fileData.content || ''
        };

        const newTab: FileTab = {
          fileId: file.fileId,
          name: file.name,
          content: fileData.content || '',
          language,
          isModified: false,
          isActive: true,
          path: file.path || file.name,
        };

        dispatch({ type: 'ADD_TAB', payload: newTab });
        
        // Initialize collaboration for this file (preserve collaboration features)
        collaborationService.initializeFile(newTab.fileId, newTab.content, 0);
        socketService.requestFileSync(newTab.fileId);
        
        console.log("File selected for editor:", selectedFileForEditor); // VS Code reference pattern
      } catch (error) {
        console.error('Failed to load file content:', error);
        toast.error('Failed to load file content');
      } finally {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    },
    [dispatch]
  );

  const handleEditorChange = useCallback(
    (value: string | undefined) => {
      if (value === undefined) return;

      const { activeTabIndex, tabs } = stateRef.current;
      if (activeTabIndex < 0 || activeTabIndex >= tabs.length) return;

      const currentTab = tabs[activeTabIndex];
      if (!currentTab) return;

      try {
        dispatch({
          type: 'UPDATE_TAB_CONTENT',
          payload: { index: activeTabIndex, content: value },
        });

        dispatch({
          type: 'SET_TAB_MODIFIED',
          payload: { index: activeTabIndex, isModified: true },
        });

        if (onFileContentChange) {
          onFileContentChange(currentTab.fileId, value);
        }
      } catch (error) {
        console.error('Error handling editor change:', error);
      }
    },
    [onFileContentChange, dispatch]
  );

  const handleSaveFile = useCallback(
    async (tabIndex: number) => {
      const { tabs } = stateRef.current;
      const tab = tabs[tabIndex];
      if (!tab || !tab.isModified) return;

      dispatch({ type: 'SET_SAVING', payload: true });
      try {
        await fileAPI.updateFileContent(tab.fileId, tab.content);

        dispatch({
          type: 'SET_TAB_MODIFIED',
          payload: { index: tabIndex, isModified: false },
        });

        toast.success(`${tab.name} saved successfully`);
      } catch (error) {
        console.error('Failed to save file:', error);
        toast.error('Failed to save file');
      } finally {
        dispatch({ type: 'SET_SAVING', payload: false });
      }
    },
    [dispatch]
  );

  const handleCloseTab = useCallback(
    (tabIndex: number) => {
      const { tabs, activeTabIndex } = stateRef.current;
      const tab = tabs[tabIndex];

      if (tab.isModified) {
        const confirmed = window.confirm(
          `${tab.name} has unsaved changes. Close anyway?`
        );
        if (!confirmed) return;
      }

      // Clean up model reference if closing active tab
      if (tabIndex === activeTabIndex && currentModelRef.current === tab.fileId) {
        currentModelRef.current = null;
        
        // Clear editor model to prevent stale references
        try {
          if (editorRef.current) {
            editorRef.current.setModel(null);
          }
        } catch (error) {
          console.warn('Error clearing editor model on tab close:', error);
        }
      }

      dispatch({ type: 'CLOSE_TAB', payload: tabIndex });
    },
    [dispatch]
  );

  const handleTabClick = useCallback(
    (tabIndex: number) => {
      if (stateRef.current.activeTabIndex === tabIndex) {
        return;
      }
      dispatch({ type: 'SET_ACTIVE_TAB', payload: tabIndex });
    },
    [dispatch]
  );

  // Get or create model using official monaco-react pattern with disposal safety
  const getOrCreateModel = useCallback((fileId: string, content: string, language: string) => {
    if (!monaco) return null;
    
    try {
      const uri = monaco.Uri.parse(fileId);
      let model = monaco.editor.getModel(uri);
      
      if (!model) {
        // Check if component is still mounted before creating model
        if (!editorReadyRef.current) return null;
        
        model = monaco.editor.createModel(content, language, uri);
        if (model && !createdModelsRef.current.includes(model)) {
          createdModelsRef.current.push(model);
        }
      }
      
      return model;
    } catch (error) {
      console.error('Error creating model:', error);
      return null;
    }
  }, [monaco]);

  // Set editor model following official monaco-react best practices with disposal safety
  const setEditorModel = useCallback((fileId: string, content: string, language: string) => {
    if (!editorRef.current || !monaco || !editorReadyRef.current) {
      return false;
    }

    try {
      // Check if editor has been disposed with more thorough validation
      const currentEditor = editorRef.current;
      if (!currentEditor || 
          typeof currentEditor.getModel !== 'function' || 
          typeof currentEditor.setModel !== 'function') {
        console.warn('Editor appears to be disposed, skipping model setup');
        editorReadyRef.current = false;
        return false;
      }

      const model = getOrCreateModel(fileId, content, language);
      if (!model) return false;

      // Update model content if different
      if (model.getValue() !== content) {
        try {
          model.setValue(content);
        } catch (valueError) {
          console.warn('Error setting model value:', valueError);
          return false;
        }
      }

      // Only set model if it's different from current and editor is still valid
      const currentModel = currentEditor.getModel();
      if (currentModel !== model) {
        // Additional safety check before setting model
        try {
          // Double-check editor is still functional right before setModel
          if (!editorReadyRef.current || typeof currentEditor.setModel !== 'function') {
            console.warn('Editor became disposed before setModel');
            editorReadyRef.current = false;
            return false;
          }
          
          currentEditor.setModel(model);
        } catch (disposalError) {
          console.warn('Editor disposed during setModel operation:', disposalError);
          editorReadyRef.current = false;
          return false;
        }
      }
      
      return true;
    } catch (error) {
      console.error('Error setting editor model:', error);
      // If we get disposal errors, mark editor as not ready
      if (error.message && error.message.includes('disposed')) {
        editorReadyRef.current = false;
      }
      return false;
    }
  }, [monaco, getOrCreateModel]);

  // Main editor lifecycle management following monaco-react best practices with disposal safety
  useEffect(() => {
    if (!editorRef.current || !monaco || !editorReadyRef.current) return;

    if (!activeFileId) {
      // Clear editor model when no active file
      try {
        const currentEditor = editorRef.current;
        if (typeof currentEditor.getModel === 'function') {
          const currentModel = currentEditor.getModel();
          if (currentModel && editorReadyRef.current && typeof currentEditor.setModel === 'function') {
            currentEditor.setModel(null);
          }
        }
      } catch (error) {
        console.warn('Error clearing editor model (editor may be disposed):', error);
        if (error.message && error.message.includes('disposed')) {
          editorReadyRef.current = false;
        }
      }
      currentModelRef.current = null;
      return;
    }

    // Skip if already showing the correct model
    if (currentModelRef.current === activeFileId) {
      return;
    }

    // Use immediate execution with validation instead of timeout to reduce race conditions
    const executeModelChange = () => {
      // Re-check if we still need to set this model and editor is ready
      if (currentModelRef.current === activeFileId || !editorReadyRef.current || !editorRef.current) {
        return;
      }

      // Additional validation that editor is still functional
      if (typeof editorRef.current.setModel !== 'function') {
        console.warn('Editor appears to be disposed, skipping model change');
        editorReadyRef.current = false;
        return;
      }

      // Set the model for the active file
      const success = setEditorModel(
        activeFileId,
        activeFileContent ?? '',
        activeTabForEffect?.language || 'plaintext'
      );

      if (success && editorReadyRef.current) {
        currentModelRef.current = activeFileId;

        // Initialize collaboration for the new file
        try {
          collaborationService.initializeFile(
            activeFileId,
            activeFileContent ?? '',
            0
          );
          socketService.requestFileSync(activeFileId);

          // Update collaborators display
          const currentFileCursors = new Map();
          collaborationService.getUserCursors().forEach((cursor, userId) => {
            if (cursor.fileId === activeFileId) {
              currentFileCursors.set(userId, cursor);
            }
          });
          dispatch({
            type: 'SET_COLLABORATORS',
            payload: currentFileCursors,
          });
        } catch (collaborationError) {
          console.warn('Error initializing collaboration:', collaborationError);
        }
      } else {
        // Reset state on failure
        currentModelRef.current = null;
      }
    };

    // Try immediate execution first
    try {
      executeModelChange();
    } catch (immediateError) {
      console.warn('Immediate model change failed, trying with short delay:', immediateError);
      // Fallback to small delay only if immediate execution fails
      const timeoutId = setTimeout(() => {
        if (editorReadyRef.current) {
          executeModelChange();
        }
      }, 5); // Very small delay as fallback
      
      return () => {
        clearTimeout(timeoutId);
      };
    }
  }, [
    activeFileId,
    activeFileContent,
    monaco,
    dispatch,
    activeTabForEffect?.language,
    setEditorModel,
  ]);

  const checkScrollButtons = useCallback(() => {
    if (!tabsContainerRef.current) return;

    const container = tabsContainerRef.current;
    dispatch({
      type: 'SET_SCROLL_STATE',
      payload: {
        canScrollLeft: container.scrollLeft > 0,
        canScrollRight:
          container.scrollLeft < container.scrollWidth - container.clientWidth,
      },
    });
  }, []);

  const scrollTabs = (direction: 'left' | 'right') => {
    if (!tabsContainerRef.current) return;

    const container = tabsContainerRef.current;
    const scrollAmount = 150;

    container.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
  };

  useEffect(() => {
    checkScrollButtons();
  }, [tabs, checkScrollButtons]);

  useEffect(() => {
    const container = tabsContainerRef.current;
    if (!container) return;

    const handleScroll = () => checkScrollButtons();
    const resizeObserver = new ResizeObserver(checkScrollButtons);

    const handleWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY) || e.shiftKey) {
        e.preventDefault();

        const scrollAmount = e.deltaX !== 0 ? e.deltaX : e.deltaY;

        container.scrollBy({
          left: scrollAmount,
          behavior: 'auto',
        });
      }
    };

    container.addEventListener('scroll', handleScroll);
    container.addEventListener('wheel', handleWheel, { passive: false });
    resizeObserver.observe(container);

    return () => {
      container.removeEventListener('scroll', handleScroll);
      container.removeEventListener('wheel', handleWheel);
      resizeObserver.disconnect();
    };
  }, [checkScrollButtons]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 's') {
          e.preventDefault();
          const { activeTabIndex, tabs } = stateRef.current;
          if (activeTabIndex >= 0 && activeTabIndex < tabs.length) {
            handleSaveFile(activeTabIndex);
          }
        }
      }
    },
    [handleSaveFile]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  useEffect(() => {
    if (!selectedFile) return;

    const { userClosedAllTabs, tabs, activeTabIndex } = stateRef.current;

    if (userClosedAllTabs) {
      dispatch({ type: 'RESET_USER_CLOSED_FLAG' });
    }

    const existingTabIndex = tabs.findIndex(
      tab => tab.fileId === selectedFile.fileId
    );
    if (existingTabIndex >= 0) {
      if (activeTabIndex !== existingTabIndex) {
        handleTabClick(existingTabIndex);
      }
    } else if (selectedFile.fileId) {
      loadFileContent({
        fileId: selectedFile.fileId,
        name: selectedFile.name,
        extension: selectedFile.extension,
        path: selectedFile.path,
      });
    }
  }, [selectedFile, handleTabClick, loadFileContent, dispatch]);

  // Cleanup effect following monaco-react best practices with improved disposal safety
  useEffect(() => {
    return () => {
      // Mark editor as not ready during cleanup to prevent race conditions
      editorReadyRef.current = false;
      
      // Give a small delay to ensure any pending operations complete
      setTimeout(() => {
        // Clean up models created by this component
        if (monaco) {
          createdModelsRef.current.forEach(model => {
            try {
              // Check if model is still valid before disposing
              if (model && 'dispose' in model && typeof (model as any).dispose === 'function') {
                (model as any).dispose();
              }
            } catch (error) {
              console.warn('Error disposing model:', error);
            }
          });
        }
        createdModelsRef.current = [];
        
        // Clear references
        editorRef.current = null;
        currentModelRef.current = null;
      }, 100); // Small delay to prevent disposal race conditions
    };
  }, [monaco]);

  return (
    <div className="flex-1 bg-discord-editor flex flex-col h-full">
      <div className="relative bg-discord-sidebar border-b border-border">
        {state.canScrollLeft && (
          <>
            <div className="absolute left-0 top-0 h-full w-8 bg-gradient-to-r from-discord-sidebar to-transparent z-10 pointer-events-none" />
            <Button
              variant="ghost"
              size="sm"
              className="absolute left-1 top-1/2 transform -translate-y-1/2 z-20 w-6 h-6 p-0 bg-discord-sidebar hover:bg-discord-sidebar-hover border border-border/50"
              onClick={() => scrollTabs('left')}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
          </>
        )}

        {state.canScrollRight && (
          <>
            <div className="absolute right-0 top-0 h-full w-8 bg-gradient-to-l from-discord-sidebar to-transparent z-10 pointer-events-none" />
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-1 top-1/2 transform -translate-y-1/2 z-20 w-6 h-6 p-0 bg-discord-sidebar hover:bg-discord-sidebar-hover border border-border/50"
              onClick={() => scrollTabs('right')}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </>
        )}

        <div
          ref={tabsContainerRef}
          className="flex overflow-x-auto scrollbar-hide"
          style={{
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            scrollBehavior: 'smooth',
          }}
        >
          {tabs.map((tab, index) => (
            <div
              key={`tab-${tab.fileId}-${index}`}
              className={`flex items-center gap-2 px-4 py-2 text-sm border-r border-border cursor-pointer transition-colors flex-shrink-0 ${
                tab.isActive
                  ? 'bg-discord-editor text-foreground'
                  : 'bg-discord-sidebar text-muted-foreground hover:bg-discord-sidebar-hover'
              }`}
              style={{
                minWidth: '120px',
                maxWidth: '200px',
                width: 'auto',
              }}
              onClick={() => handleTabClick(index)}
            >
              <span className="truncate flex-1 min-w-0">
                {tab.name}
                {tab.isModified && (
                  <span className="text-discord-primary ml-1">●</span>
                )}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="w-4 h-4 p-0 hover:bg-discord-sidebar-hover"
                onClick={e => {
                  e.stopPropagation();
                  handleCloseTab(index);
                }}
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      {activeTab && (
        <div className="px-4 py-2 bg-discord-editor border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>{activeTab.path}</span>
            {activeTab.isModified && (
              <span className="text-discord-primary">● Modified</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {collaborators.size > 0 && (
              <div className="flex items-center gap-1">
                <Users className="w-4 h-4 text-green-500" />
                <span className="text-xs text-muted-foreground">
                  {collaborators.size} collaborator
                  {collaborators.size > 1 ? 's' : ''}
                </span>
                <div className="flex gap-1">
                  {Array.from(collaborators.values())
                    .slice(0, 3)
                    .map(cursor => (
                      <Badge
                        key={cursor.userId}
                        variant="secondary"
                        className={`text-xs px-1 py-0 h-5 transition-all ${
                          cursor.isTyping
                            ? 'animate-pulse border border-white/30'
                            : ''
                        }`}
                        style={{
                          backgroundColor: cursor.color + '40',
                          color: cursor.color,
                          borderColor: cursor.isTyping
                            ? cursor.color
                            : 'transparent',
                        }}
                        title={
                          cursor.isTyping
                            ? `${cursor.userName} is typing...`
                            : cursor.userName
                        }
                      >
                        {cursor.userName.charAt(0).toUpperCase()}
                        {cursor.isTyping && (
                          <span className="ml-1 text-[8px]">●</span>
                        )}
                      </Badge>
                    ))}
                  {collaborators.size > 3 && (
                    <Badge
                      variant="secondary"
                      className="text-xs px-1 py-0 h-5"
                    >
                      +{collaborators.size - 3}
                    </Badge>
                  )}
                </div>
              </div>
            )}
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="w-8 h-8 p-0"
                onClick={() => handleSaveFile(activeTabIndex)}
                disabled={!activeTab.isModified || state.isSaving}
              >
                <Save className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="w-8 h-8 p-0"
                onClick={() =>
                  editorRef.current?.trigger('keyboard', 'undo', null)
                }
              >
                <Undo className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="w-8 h-8 p-0"
                onClick={() =>
                  editorRef.current?.trigger('keyboard', 'redo', null)
                }
              >
                <Redo className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="w-8 h-8 p-0"
                onClick={() =>
                  editorRef.current?.trigger('keyboard', 'actions.find', null)
                }
              >
                <Search className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 relative">
        {state.isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-discord-primary"></div>
          </div>
        ) : tabs.length > 0 ? (
          <>
            <Editor
              height="100%"
              defaultLanguage="typescript"
              defaultValue=""
              keepCurrentModel={true}
              saveViewState={true}
              onChange={handleEditorChange}
              onMount={(editor, monacoInstance) => {
                try {
                  editorRef.current = editor;
                  collaborationService.setEditor(editor);
                  
                  // Set editor as ready immediately but with validation
                  editorReadyRef.current = true;
                  
                  // Setup real-time broadcasting event listeners
                  console.log('🎯 Setting up real-time broadcasting listeners');
                  
                  // Real-time content change broadcasting
                  editor.onDidChangeModelContent((e) => {
                    const model = editor.getModel();
                    if (!model || !user || !roomId) return;

                    const { tabs, activeTabIndex } = stateRef.current;
                    const activeTab = tabs[activeTabIndex];
                    if (!activeTab?.fileId) return;

                    // Update local state
                    const newContent = model.getValue();
                    dispatch({
                      type: 'UPDATE_TAB_CONTENT',
                      payload: { index: activeTabIndex, content: newContent },
                    });
                    dispatch({
                      type: 'SET_TAB_MODIFIED',
                      payload: { index: activeTabIndex, isModified: true },
                    });

                    // Broadcast changes to other users in real-time
                    const fileState = collaborationService.getFileState(activeTab.fileId);
                    if (fileState) {
                      console.log('📡 Broadcasting real-time changes for file:', activeTab.name);
                      
                      // Create collaborative change with detailed operations
                      const operations = e.changes.map(change => ({
                        type: 'replace' as const,
                        range: {
                          startLineNumber: change.range.startLineNumber,
                          startColumn: change.range.startColumn,
                          endLineNumber: change.range.endLineNumber,
                          endColumn: change.range.endColumn,
                        },
                        text: change.text,
                        rangeLength: change.rangeLength,
                      }));

                      const collaborativeChange: CollaborativeChange = {
                        id: `change-${Date.now()}-${Math.random()}`,
                        userId: user.id,
                        userName: user.name,
                        fileId: activeTab.fileId,
                        operations: operations.map(op => ({
                          type: 'insert',
                          text: op.text,
                          length: op.rangeLength,
                        })),
                        baseVersion: fileState.version,
                        timestamp: Date.now(),
                      };

                      // Send to collaboration service for processing and broadcasting
                      collaborationService.sendChange(collaborativeChange);
                      
                      // Also notify file content change callback
                      if (onFileContentChange) {
                        onFileContentChange(activeTab.fileId, newContent);
                      }
                    }
                  });

                  // Real-time cursor position broadcasting  
                  editor.onDidChangeCursorPosition((e) => {
                    if (!user || !roomId) return;
                    
                    const { tabs, activeTabIndex } = stateRef.current;
                    const activeTab = tabs[activeTabIndex];
                    if (!activeTab?.fileId) return;

                    const selection = editor.getSelection();
                    const cursor: UserCursor = {
                      userId: user.id,
                      userName: user.name,
                      fileId: activeTab.fileId,
                      position: {
                        lineNumber: e.position.lineNumber,
                        column: e.position.column,
                      },
                      selection: selection ? {
                        startLineNumber: selection.startLineNumber,
                        startColumn: selection.startColumn,
                        endLineNumber: selection.endLineNumber,
                        endColumn: selection.endColumn,
                      } : undefined,
                      color: getUserColor(user.id),
                      isTyping: false,
                      lastActivity: Date.now(),
                    };

                    // Broadcast cursor position to other users
                    console.log('📍 Broadcasting cursor position:', cursor);
                    // Note: Collaboration service handles cursor updates internally
                  });

                  // Real-time selection change broadcasting
                  editor.onDidChangeCursorSelection((e) => {
                    if (!user || !roomId) return;
                    
                    const { tabs, activeTabIndex } = stateRef.current;
                    const activeTab = tabs[activeTabIndex];
                    if (!activeTab?.fileId) return;

                    const cursor: UserCursor = {
                      userId: user.id,
                      userName: user.name,
                      fileId: activeTab.fileId,
                      position: {
                        lineNumber: e.selection.startLineNumber,
                        column: e.selection.startColumn,
                      },
                      selection: {
                        startLineNumber: e.selection.startLineNumber,
                        startColumn: e.selection.startColumn,
                        endLineNumber: e.selection.endLineNumber,
                        endColumn: e.selection.endColumn,
                      },
                      color: getUserColor(user.id),
                      isTyping: true,
                      lastActivity: Date.now(),
                    };

                    // Broadcast selection to other users
                    console.log('📋 Broadcasting selection change:', cursor);
                    // Note: Collaboration service handles selection updates internally
                  });

                  
                  // Handle initial model setup with immediate validation
                  if (activeFileId && activeFileContent !== undefined && activeTabForEffect?.language) {
                    // Use a more immediate approach with validation
                    const setupInitialModel = () => {
                      // Validate editor is still ready and not disposed
                      if (!editorReadyRef.current || !editorRef.current) {
                        return;
                      }
                      
                      try {
                        // Check if editor is still functional
                        if (typeof editor.setModel !== 'function') {
                          console.warn('Editor appears to be disposed during initial setup');
                          editorReadyRef.current = false;
                          return;
                        }
                        
                        const model = getOrCreateModel(
                          activeFileId,
                          activeFileContent,
                          activeTabForEffect.language
                        );
                        
                        if (model && editorReadyRef.current) {
                          editor.setModel(model);
                          currentModelRef.current = activeFileId;
                          
                          // Initialize file for collaboration
                          if (activeTab?.fileId && activeFileContent) {
                            console.log('🔄 Initializing file for collaboration:', activeTab.name);
                            collaborationService.initializeFile(activeTab.fileId, activeFileContent, 0);
                          }
                        }
                      } catch (modelError) {
                        console.warn('Error setting initial model:', modelError);
                        if (modelError.message && modelError.message.includes('disposed')) {
                          editorReadyRef.current = false;
                        }
                      }
                    };
                    
                    // Try immediate setup first, fallback to delayed if needed
                    try {
                      setupInitialModel();
                    } catch (immediateError) {
                      // If immediate setup fails, try once more with a small delay
                      setTimeout(() => {
                        if (editorReadyRef.current) {
                          setupInitialModel();
                        }
                      }, 10);
                    }
                  }
                } catch (error) {
                  console.error('Error in Monaco onMount:', error);
                  editorReadyRef.current = false;
                }
              }}
              theme="vs-dark"
              options={{
                // Core editor options following monaco-react best practices
                minimap: { enabled: true },
                fontSize: 14,
                fontFamily: 'JetBrains Mono, Consolas, "Courier New", monospace',
                wordWrap: 'on',
                automaticLayout: true,
                scrollBeyondLastLine: false,
                renderWhitespace: 'selection',
                tabSize: 2,
                insertSpaces: true,
                detectIndentation: true,
                formatOnPaste: true,
                formatOnType: true,
                
                // IntelliSense and suggestions
                suggestOnTriggerCharacters: true,
                acceptSuggestionOnEnter: 'on',
                quickSuggestions: true,
                parameterHints: { enabled: true },
                
                // Code folding and visual guides
                folding: true,
                lineNumbers: 'on',
                glyphMargin: true,
                rulers: [80, 120],
                bracketPairColorization: { enabled: true },
                guides: {
                  bracketPairs: true,
                  indentation: true,
                },
                
                // Performance and stability options
                mouseWheelZoom: false,
                contextmenu: true,
                scrollbar: {
                  vertical: 'visible',
                  horizontal: 'visible',
                  alwaysConsumeMouseWheel: false,
                },
              }}
            />
            {!activeTab && (
              <div className="absolute inset-0 flex items-center justify-center h-full text-center bg-discord-editor bg-opacity-95">
                <div className="text-muted-foreground">
                  <div className="w-16 h-16 mx-auto mb-4 bg-discord-sidebar rounded-lg flex items-center justify-center">
                    <span className="text-2xl">📝</span>
                  </div>
                  <h3 className="text-lg font-medium mb-2">
                    No file selected
                  </h3>
                  <p className="text-sm">
                    Select a file from the sidebar to start editing
                  </p>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-center">
            <div className="text-muted-foreground">
              <div className="w-16 h-16 mx-auto mb-4 bg-discord-sidebar rounded-lg flex items-center justify-center">
                <span className="text-2xl">📝</span>
              </div>
              <h3 className="text-lg font-medium mb-2">No files open</h3>
              <p className="text-sm">
                Select a file from the sidebar to start editing
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default React.memo(MonacoEditor);