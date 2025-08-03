import React, { createContext, useContext, useReducer, useCallback } from 'react';
import type { SelectedFile, FileTab } from '@/types';

// Main context interface matching the reference
interface IMainContext {
  handleSetEditor: (selectedFile: SelectedFile) => void;
  handleRemoveEditor: (selectedFile: SelectedFile) => void;
}

// State interface
interface MainState {
  activeFiles: FileTab[];
  activeFile: FileTab | null;
  indent: { line: number; column: number };
}

// Action types
type MainAction =
  | { type: 'UPDATE_ACTIVE_FILES'; payload: FileTab[] }
  | { type: 'UPDATE_ACTIVE_FILE'; payload: FileTab | null }
  | { type: 'UPDATE_INDENT'; payload: { line: number; column: number } };

// Initial state
const initialState: MainState = {
  activeFiles: [],
  activeFile: null,
  indent: { line: 1, column: 1 },
};

// Reducer
function mainReducer(state: MainState, action: MainAction): MainState {
  switch (action.type) {
    case 'UPDATE_ACTIVE_FILES':
      return { ...state, activeFiles: action.payload };
    case 'UPDATE_ACTIVE_FILE':
      return { ...state, activeFile: action.payload };
    case 'UPDATE_INDENT':
      return { ...state, indent: action.payload };
    default:
      return state;
  }
}

// Create the context
export const MainContext = createContext<IMainContext>({} as IMainContext);

// Context provider component
interface MainContextProviderProps {
  children: React.ReactNode;
  onSetEditor?: (selectedFile: SelectedFile) => void;
  onRemoveEditor?: (selectedFile: SelectedFile) => void;
}

export const MainContextProvider: React.FC<MainContextProviderProps> = ({
  children,
  onSetEditor,
  onRemoveEditor,
}) => {
  const [state, dispatch] = useReducer(mainReducer, initialState);

  const handleSetEditor = useCallback((selectedFile: SelectedFile) => {
    console.log('Context handleSetEditor called with:', selectedFile);
    onSetEditor?.(selectedFile);
  }, [onSetEditor]);

  const handleRemoveEditor = useCallback((selectedFile: SelectedFile) => {
    console.log('Context handleRemoveEditor called with:', selectedFile);
    onRemoveEditor?.(selectedFile);
  }, [onRemoveEditor]);

  const value: IMainContext = {
    handleSetEditor,
    handleRemoveEditor,
  };

  return (
    <MainContext.Provider value={value}>
      {children}
    </MainContext.Provider>
  );
};

// Hook to use the context
export const useMainContext = () => {
  const context = useContext(MainContext);
  if (!context) {
    throw new Error('useMainContext must be used within a MainContextProvider');
  }
  return context;
};
