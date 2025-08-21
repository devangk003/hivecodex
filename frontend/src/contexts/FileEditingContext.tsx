import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import socketService from '@/lib/socket';

interface FileEditingUser {
  userId: string;
  username: string;
  timestamp: Date;
  cursorPosition?: { line: number; column: number };
}

interface FileEditingState {
  [fileId: string]: FileEditingUser[];
}

interface FileEditingContextType {
  editingUsers: FileEditingState;
  startEditing: (fileId: string, userId: string, username: string, cursorPosition?: { line: number; column: number }) => void;
  stopEditing: (fileId: string, userId: string) => void;
  updateCursorPosition: (fileId: string, userId: string, cursorPosition: { line: number; column: number }) => void;
  isFileBeingEdited: (fileId: string) => boolean;
  getEditingUsers: (fileId: string) => FileEditingUser[];
  saveFile: (fileId: string, content: string) => Promise<void>;
}

const FileEditingContext = createContext<FileEditingContextType | undefined>(undefined);

export const useFileEditing = () => {
  const context = useContext(FileEditingContext);
  if (!context) {
    throw new Error('useFileEditing must be used within a FileEditingProvider');
  }
  return context;
};

interface FileEditingProviderProps {
  children: React.ReactNode;
  roomId: string;
}

export const FileEditingProvider: React.FC<FileEditingProviderProps> = ({ children, roomId }) => {
  const [editingUsers, setEditingUsers] = useState<FileEditingState>({});

  // Clean up stale editing sessions (older than 5 minutes)
  const cleanupStaleSessions = useCallback(() => {
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
    
    setEditingUsers(prev => {
      const cleaned: FileEditingState = {};
      Object.keys(prev).forEach(fileId => {
        const activeUsers = prev[fileId].filter(user => 
          user.timestamp > fiveMinutesAgo
        );
        if (activeUsers.length > 0) {
          cleaned[fileId] = activeUsers;
        }
      });
      return cleaned;
    });
  }, []);

  // Cleanup stale sessions every minute
  useEffect(() => {
    const interval = setInterval(cleanupStaleSessions, 60000);
    return () => clearInterval(interval);
  }, [cleanupStaleSessions]);

  // Socket event handlers
  useEffect(() => {
    if (!roomId) return;

    const socket = socketService.getSocket();
    if (!socket) return;

    // Listen for file editing events from other users
    const handleUserStartedEditing = (data: {
      fileId: string;
      userId: string;
      username: string;
      cursorPosition?: { line: number; column: number };
    }) => {
      setEditingUsers(prev => ({
        ...prev,
        [data.fileId]: [
          ...(prev[data.fileId] || []).filter(u => u.userId !== data.userId),
          {
            userId: data.userId,
            username: data.username,
            timestamp: new Date(),
            cursorPosition: data.cursorPosition
          }
        ]
      }));
    };

    const handleUserStoppedEditing = (data: {
      fileId: string;
      userId: string;
    }) => {
      setEditingUsers(prev => ({
        ...prev,
        [data.fileId]: (prev[data.fileId] || []).filter(u => u.userId !== data.userId)
      }));
    };

    const handleUserCursorUpdate = (data: {
      fileId: string;
      userId: string;
      cursorPosition: { line: number; column: number };
    }) => {
      setEditingUsers(prev => ({
        ...prev,
        [data.fileId]: (prev[data.fileId] || []).map(user =>
          user.userId === data.userId
            ? { ...user, cursorPosition: data.cursorPosition, timestamp: new Date() }
            : user
        )
      }));
    };

    const handleFileSaved = (data: {
      fileId: string;
      userId: string;
      timestamp: Date;
    }) => {
      // Remove the user from editing state when they save
      setEditingUsers(prev => ({
        ...prev,
        [data.fileId]: (prev[data.fileId] || []).filter(u => u.userId !== data.userId)
      }));
    };

    socket.on('user-started-editing', handleUserStartedEditing);
    socket.on('user-stopped-editing', handleUserStoppedEditing);
    socket.on('user-cursor-update', handleUserCursorUpdate);
    socket.on('file-saved', handleFileSaved);

    return () => {
      socket.off('user-started-editing', handleUserStartedEditing);
      socket.off('user-stopped-editing', handleUserStoppedEditing);
      socket.off('user-cursor-update', handleUserCursorUpdate);
      socket.off('file-saved', handleFileSaved);
    };
  }, [roomId]);

  const startEditing = useCallback((fileId: string, userId: string, username: string, cursorPosition?: { line: number; column: number }) => {
    setEditingUsers(prev => ({
      ...prev,
      [fileId]: [
        ...(prev[fileId] || []).filter(u => u.userId !== userId),
        {
          userId,
          username,
          timestamp: new Date(),
          cursorPosition
        }
      ]
    }));

    // Notify other users
    const socket = socketService.getSocket();
    if (socket) {
      socket.emit('start-editing', {
        fileId,
        userId,
        username,
        cursorPosition
      });
    }
  }, []);

  const stopEditing = useCallback((fileId: string, userId: string) => {
    setEditingUsers(prev => ({
      ...prev,
      [fileId]: (prev[fileId] || []).filter(u => u.userId !== userId)
    }));

    // Notify other users
    const socket = socketService.getSocket();
    if (socket) {
      socket.emit('stop-editing', {
        fileId,
        userId
      });
    }
  }, []);

  const updateCursorPosition = useCallback((fileId: string, userId: string, cursorPosition: { line: number; column: number }) => {
    setEditingUsers(prev => ({
      ...prev,
      [fileId]: (prev[fileId] || []).map(user =>
        user.userId === userId
          ? { ...user, cursorPosition, timestamp: new Date() }
          : user
      )
    }));

    // Notify other users
    const socket = socketService.getSocket();
    if (socket) {
      socket.emit('update-cursor', {
        fileId,
        userId,
        cursorPosition
      });
    }
  }, []);

  const isFileBeingEdited = useCallback((fileId: string) => {
    return editingUsers[fileId] && editingUsers[fileId].length > 0;
  }, [editingUsers]);

  const getEditingUsers = useCallback((fileId: string) => {
    return editingUsers[fileId] || [];
  }, [editingUsers]);

  const saveFile = useCallback(async (fileId: string, content: string) => {
    try {
      // Save file content via API
      const response = await fetch(`/api/v1/files/${fileId}/content`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ content })
      });

      if (!response.ok) {
        throw new Error('Failed to save file');
      }

      // Notify other users that file was saved
      const socket = socketService.getSocket();
      if (socket) {
        socket.emit('file-saved', {
          fileId,
          userId: JSON.parse(localStorage.getItem('user') || '{}').id,
          timestamp: new Date()
        });
      }

      // Remove current user from editing state
      const currentUserId = JSON.parse(localStorage.getItem('user') || '{}').id;
      if (currentUserId) {
        stopEditing(fileId, currentUserId);
      }

      return response.json();
    } catch (error) {
      console.error('Error saving file:', error);
      throw error;
    }
  }, [stopEditing]);

  const value: FileEditingContextType = {
    editingUsers,
    startEditing,
    stopEditing,
    updateCursorPosition,
    isFileBeingEdited,
    getEditingUsers,
    saveFile
  };

  return (
    <FileEditingContext.Provider value={value}>
      {children}
    </FileEditingContext.Provider>
  );
};
