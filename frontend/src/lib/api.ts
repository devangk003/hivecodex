import axios from 'axios';

// Use '/api' for all API calls
export const API_BASE_URL = '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  config => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  error => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle auth errors
api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    if (error.response?.status === 403) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export interface User {
  id: string;
  name: string;
  email: string;
  profilePicId?: string;
  activityStatus?: string;
}
// User API
export const userAPI = {
  getUserProfile: async (userId: string) => {
    try {
      const response = await api.get(`/users/${userId}/profile`);
      return response.data;
    } catch (error) {
      console.warn(`User profile endpoint not available for user ${userId}`);
      return null;
    }
  },

  getUsersInRoom: async (roomId: string) => {
    try {
      const response = await api.get(`/rooms/${roomId}/users`);
      return response.data;
    } catch (error) {
      console.warn(`Room users endpoint not available for room ${roomId}`);
      return [];
    }
  },

  updateUserStatus: async (status: string, roomId?: string) => {
    try {
      const response = await api.put('/user/status', { status, roomId });
      return response.data;
    } catch (error) {
      console.warn('User status update endpoint not available');
      return { status, roomId };
    }
  },
};

// Activity Status API with rate limiting
const lastStatusUpdate = { timestamp: 0 };
const STATUS_UPDATE_COOLDOWN = 3000; // 3 seconds

export const activityAPI = {
  getStatus: async () => {
    try {
      const response = await api.get('/user/activity-status');
      return response.data.data.activityStatus; // Backend returns nested data
    } catch (error) {
      console.warn('Failed to get user activity status:', error);
      return 'online'; // fallback
    }
  },

  // Get all users' activity status from backend (like fetching messages)
  getAllUsersStatus: async () => {
    try {
      const response = await api.get('/users/activity-status');
      return response.data.data;
    } catch (error) {
      console.warn('Failed to get all users activity status:', error);
      return []; // fallback
    }
  },
  setStatus: async (activityStatus: string) => {
    // Rate limiting
    const now = Date.now();
    if (now - lastStatusUpdate.timestamp < STATUS_UPDATE_COOLDOWN) {
      if (process.env.NODE_ENV === 'development') {
        return activityStatus; // Return without making API call
      }
    }
    try {
      const response = await api.put('/user/activity-status', { activityStatus });
      return response.data.data.activityStatus; // Backend returns nested data
    } catch (error) {
      lastStatusUpdate.timestamp = now;
      return activityStatus; // Return the requested status as if it was set
    }
  },
  
  // Get user's joined rooms history
  getJoinedRooms: async () => {
    try {
      const response = await api.get('/user/joined-rooms');
      return response.data.data;
    } catch (error) {
      console.error('Failed to fetch joined rooms:', error);
      return [];
    }
  },

  // Get global user status across all rooms
  getGlobalUserStatus: async () => {
    try {
      const response = await api.get('/users/global-status');
      return response.data.data;
    } catch (error) {
      console.error('Failed to fetch global user status:', error);
      return [];
    }
  }
};

export interface Room {
  id: string;
  name: string;
  description: string;
  participants: number;
  isPrivate: boolean;
  lastActive: string;
  language: string;
  userId: string;
  dateTime: string;
  files: FileItem[];
}

export interface FileItem {
  fileId: string;
  name: string;
  ext: string;
  lines: number;
  read: boolean;
  displayName?: string;
  isCorrupted?: boolean;
}

export interface Reaction {
  emoji: string;
  userId: string;
  timestamp?: string;
}

export interface Message {
  sender: string;
  senderId: string;
  text: string;
  timestamp: string;
  id: string;
  profilePicId?: string;
  reactions?: Reaction[];
}

export interface Participant {
  id: string;
  name: string;
  profilePicId?: string;
  online: boolean;
}

// Auth API
export const authAPI = {
  login: async (email: string, password: string) => {
    const response = await api.post('/login', { email, password });
    return response.data;
  },

  register: async (name: string, email: string, password: string) => {
    const response = await api.post('/register', { name, email, password });
    return response.data;
  },

  getCurrentUser: async () => {
    const response = await api.get('/user');
    return response.data;
  },

  updateProfile: async (data: FormData | {
    name?: string;
    email?: string;
    profilePic?: File | null;
  }) => {
    let formData: FormData;
    
    if (data instanceof FormData) {
      formData = data;
    } else {
      // Convert object to FormData for backward compatibility
      formData = new FormData();
      if (data.name) formData.append('name', data.name);
      if (data.email) formData.append('email', data.email);
      if (data.profilePic) formData.append('profilePic', data.profilePic);
    }
    
    const response = await api.post('/profile/update', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data.data; // Backend returns nested data
  },
};

// Room API
export const roomAPI = {
  getAllRooms: async () => {
    const response = await api.get('/rooms');
    return response.data;
  },

  getUserRooms: async () => {
    const response = await api.get('/user/rooms');
    // Always return an array
    if (Array.isArray(response.data)) return response.data;
    if (response.data && Array.isArray(response.data.rooms))
      return response.data.rooms;
    return [];
  },

  getRoom: async (roomId: string) => {
    const response = await api.get(`/rooms/${roomId}`);
    return response.data;
  },

  createRoom: async (
    name: string,
    description: string,
    isPrivate: boolean = false,
    password?: string
  ) => {
    const response = await api.post('/rooms', {
      name,
      description,
      isPrivate,
      password,
    });
    return response.data;
  },

  joinRoom: async (roomId: string, password?: string) => {
    const response = await api.post(`/rooms/${roomId}/join`, { password });
    return response.data;
  },

  getRoomParticipants: async (roomId: string) => {
    const response = await api.get(`/rooms/${roomId}/participants`);
    return response.data;
  },

  leaveRoom: async (roomId: string) => {
    const response = await api.post(`/rooms/${roomId}/leave`);
    return response.data;
  },

  deleteRoom: async (roomId: string) => {
    const response = await api.delete(`/rooms/${roomId}`);
    return response.data;
  },
};

// File API
export const fileAPI = {
  moveFileOrFolder: async (
    roomId: string,
    fileId: string,
    newParentId?: string | null
  ) => {
    // PATCH endpoint to update parentId of file/folder
    const payload: { fileId: string; newParentId?: string | null } = { fileId };
    if (newParentId) {
      payload.newParentId = newParentId;
    } else {
      payload.newParentId = null;
    }
    const response = await api.patch(`/rooms/${roomId}/move`, payload);
    return response.data;
  },
  uploadFile: async (
    roomId: string,
    file: File,
    onProgress?: (progress: number) => void
  ) => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await api.post(`/rooms/${roomId}/files`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: progressEvent => {
        if (onProgress && progressEvent.total) {
          const progress = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          onProgress(progress);
        }
      },
    });

    return response.data;
  },

  uploadFolder: async (
    roomId: string,
    files: File[],
    onProgress?: (progress: number) => void
  ) => {
    const formData = new FormData();
    for (const file of files) {
      // Use webkitRelativePath if available, fallback to name
      const relPath =
        typeof (file as File & { webkitRelativePath?: string })
          .webkitRelativePath === 'string'
          ? (file as File & { webkitRelativePath?: string }).webkitRelativePath
          : file.name;
      formData.append('files', file, relPath);
    }
    const response = await api.post(
      `/rooms/${roomId}/upload-folder`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: progressEvent => {
          if (onProgress && progressEvent.total) {
            const progress = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total
            );
            onProgress(progress);
          }
        },
      }
    );
    return response.data;
  },

  uploadProject: async (
    roomId: string,
    zipFile: File,
    onProgress?: (progress: number) => void
  ) => {
    const formData = new FormData();
    formData.append('zipFile', zipFile);

    const response = await api.post(
      `/rooms/${roomId}/upload-project`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: progressEvent => {
          if (onProgress && progressEvent.total) {
            const progress = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total
            );
            onProgress(progress);
          }
        },
      }
    );

    return response.data;
  },

  bulkOperations: async (
    roomId: string,
    operation: string,
    fileIds: string[]
  ) => {
    const response = await api.post(`/rooms/${roomId}/bulk-operations`, {
      operation,
      fileIds,
    });
    return response.data;
  },

  downloadFile: async (fileId: string) => {
    const response = await api.get(`/files/${fileId}/download`, {
      responseType: 'blob',
    });
    return response.data;
  },

  getFileContent: async (fileId: string) => {
    const response = await api.get(`/files/${fileId}/content`);
    return response.data;
  },

  updateFileContent: async (fileId: string, content: string) => {
    const response = await api.put(`/files/${fileId}/content`, { content });
    return response.data;
  },

  deleteFile: async (roomId: string, fileId: string) => {
    // Use batch delete endpoint for both files and folders
    const response = await api.patch(`/rooms/${roomId}/files`, {
      operation: 'delete',
      fileIds: [fileId],
    });
    return response.data;
  },

  getRoomFiles: async (roomId: string) => {
    const response = await api.get(`/rooms/${roomId}/files`);
    return response.data;
  },

  createFile: async (roomId: string, name: string, parentId: string | null) => {
    const response = await api.post(`/rooms/${roomId}/create-file`, {
      name,
      parentId,
    });
    return response.data;
  },

  createFolder: async (
    roomId: string,
    name: string,
    parentId: string | null
  ) => {
    const response = await api.post(`/rooms/${roomId}/create-folder`, {
      name,
      parentId,
    });
    return response.data;
  },
};

// Chat API
export const chatAPI = {
  getRoomMessages: async (roomId: string) => {
    const response = await api.get(`/rooms/${roomId}/messages`);
    return response.data;
  },

  sendMessage: async (roomId: string, message: string) => {
    const response = await api.post(`/rooms/${roomId}/messages`, { message });
    return response.data;
  },

  addReaction: async (messageId: string, emoji: string) => {
    const response = await api.post(`/messages/${messageId}/reactions`, {
      emoji,
    });
    return response.data;
  },

  removeReaction: async (messageId: string, emoji: string) => {
    const response = await api.delete(`/messages/${messageId}/reactions`, {
      data: { emoji },
    });
    return response.data;
  },
};

export default api;
