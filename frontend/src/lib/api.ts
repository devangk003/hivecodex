import axios from 'axios';

// Use '/api' for all API calls
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1';

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
    // Only logout on 401/403 if the error message indicates invalid/expired token
    if (error.response?.status === 401 || error.response?.status === 403) {
      const errorMessage = error.response?.data?.message || '';
      
      // Only logout for token-related errors, not for other authorization issues
      if (errorMessage.includes('Invalid token') || 
          errorMessage.includes('expired') || 
          errorMessage.includes('Access token is required')) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
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
  // NOTE: This fetches the currently authenticated user's profile, not any user by ID.
  getUserProfile: async () => {
    try {
      // The backend endpoint is /api/v1/profile, which gets the current user's profile based on the auth token.
      const response = await api.get(`/v1/profile`);
      return response.data;
    } catch (error) {
      console.error(`Failed to fetch user profile:`, error);
      return null;
    }
  },

  getUsersInRoom: async (roomId: string) => {
    try {
      // This endpoint is defined in roomRoutes.ts
      const response = await api.get(`/rooms/${roomId}/users`);
      return response.data;
    } catch (error) {
      console.warn(`Failed to get users for room ${roomId}:`, error);
      return [];
    }
  },

  // The following endpoints are not implemented in the backend yet.
  // kickUser: async (roomId: string, userId: string) => { ... },
  // updateUserRole: async (roomId: string, userId: string, role: string) => { ... },
  // inviteUserToRoom: async (roomId: string, email: string) => { ... },

  updateUserStatus: async (status: string, roomId?: string) => {
    try {
      const response = await api.put('/user/activity-status', { activityStatus: status, roomId });
      return response.data;
    } catch (error) {
      console.error('Failed to update user status:', error);
      throw error;
    }
  },
};

// Activity Status API with rate limiting
let lastActivityUpdate = 0;
const ACTIVITY_UPDATE_COOLDOWN = 5000; // 5 seconds between updates

export const activityAPI = {
  getStatus: async () => {
    try {
      const response = await api.get('/user/activity-status');
      return response.data.data.activityStatus; // Backend returns nested data
    } catch (error) {
      // Silently return default status to prevent infinite retries
      return 'Online'; // Default status
    }
  },
  setStatus: async (activityStatus: string) => {
    try {
      // Rate limiting - prevent too frequent updates
      const now = Date.now();
      if (now - lastActivityUpdate < ACTIVITY_UPDATE_COOLDOWN) {
        return activityStatus; // Return without making API call
      }
      lastActivityUpdate = now;

      const response = await api.put('/user/activity-status', { activityStatus });
      return response.data.data.activityStatus; // Backend returns nested data
    } catch (error) {
      // Silently return the requested status to prevent infinite retries
      return activityStatus; // Return the requested status as if it was set
    }
  },
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
    // Backend route is POST /api/v1/login
    const response = await api.post('/login', { email, password });
    return response.data;
  },

  register: async (formData: FormData) => {
    // Backend route is POST /api/v1/register and expects multipart/form-data
    const response = await api.post('/register', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  getCurrentUser: async () => {
    // Backend route is GET /api/v1/user
    const response = await api.get('/user');
    return response.data;
  },

  updateProfile: async (formData: FormData) => {
    // Backend route is POST /api/v1/profile/update
    const response = await api.post('/v1/profile/update', formData, {
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
    // The backend now returns the array directly
    return response.data || [];
  },

  getRoom: async (roomId: string) => {
    const response = await api.get(`/rooms/${roomId}`);
    return response.data.data; // Extract the actual room data from the wrapped response
  },

  createRoom: async (
    name: string,
    description: string,
    isPrivate: boolean = false,
    password?: string
  ) => {
    const response = await api.post('/rooms', {
      roomName: name, // The backend expects 'roomName'
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
    const response = await api.get(`/rooms/${roomId}/users`);
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
  getRoomFiles: async (roomId: string) => {
    const response = await api.get(`/rooms/${roomId}/files`);
    return response.data;
  },

  getFileContent: async (roomId: string, fileId: string) => {
    const response = await api.get(`/files/${fileId}/content`);
    return response.data;
  },

  // NOTE: The following file-related endpoints are not yet implemented in the backend.
  // This section is kept as a placeholder for future development.
  // moveFileOrFolder: async (...) => { ... },
  // uploadFile: async (...) => { ... },
  // uploadFolder: async (...) => { ... },
  // uploadProject: async (...) => { ... },
  // bulkOperations: async (...) => { ... },
  // downloadFile: async (...) => { ... },
  // updateFileContent: async (...) => { ... },
  // deleteFile: async (...) => { ... },
  // createFile: async (...) => { ... },
  // createFolder: async (...) => { ... },
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

  addReaction: async (roomId: string, messageId: string, emoji: string) => {
    const response = await api.post(`/rooms/${roomId}/messages/${messageId}/reactions`, {
      emoji,
    });
    return response.data;
  },

  removeReaction: async (roomId: string, messageId: string, emoji: string) => {
    const response = await api.delete(`/rooms/${roomId}/messages/${messageId}/reactions`, {
      data: { emoji },
    });
    return response.data;
  },
};

export default api;
