import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_ENDPOINT || 'http://localhost:5000';

console.log('API Base URL:', API_BASE_URL);

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    console.log('API Request - Token:', token ? 'Present' : 'Missing');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.log('API Response Error:', error.response?.status, error.response?.data);
    if (error.response?.status === 401) {
      console.log('401 - Redirecting to login');
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    if (error.response?.status === 403) {
      console.log('403 - Token expired or invalid');
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
}

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

export interface Message {
  sender: string;
  senderId: string;
  text: string;
  timestamp: string;
  id: string;
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
    const response = await api.post('/api/login', { email, password });
    return response.data;
  },

  register: async (name: string, email: string, password: string) => {
    const response = await api.post('/api/register', { name, email, password });
    return response.data;
  },

  getCurrentUser: async () => {
    const response = await api.get('/api/user');
    return response.data;
  },
};

// Room API
export const roomAPI = {
  getAllRooms: async () => {
    const response = await api.get('/api/rooms');
    return response.data;
  },

  getUserRooms: async () => {
    const response = await api.get('/api/user/rooms');
    return response.data;
  },

  getRoom: async (roomId: string) => {
    const response = await api.get(`/api/rooms/${roomId}`);
    return response.data;
  },

  createRoom: async (name: string, description: string, isPrivate: boolean = false, password?: string) => {
    const response = await api.post('/api/rooms', { name, description, isPrivate, password });
    return response.data;
  },

  joinRoom: async (roomId: string, password?: string) => {
    const response = await api.post(`/api/rooms/${roomId}/join`, { password });
    return response.data;
  },

  getRoomParticipants: async (roomId: string) => {
    const response = await api.get(`/api/rooms/${roomId}/participants`);
    return response.data;
  },

  leaveRoom: async (roomId: string) => {
    const response = await api.post(`/api/rooms/${roomId}/leave`);
    return response.data;
  },
};

// File API
export const fileAPI = {
  uploadFile: async (roomId: string, file: File, onProgress?: (progress: number) => void) => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await api.post(`/api/rooms/${roomId}/files`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(progress);
        }
      },
    });

    return response.data;
  },

  uploadProject: async (roomId: string, zipFile: File, onProgress?: (progress: number) => void) => {
    const formData = new FormData();
    formData.append('zipFile', zipFile);

    const response = await api.post(`/api/rooms/${roomId}/upload-project`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(progress);
        }
      },
    });

    return response.data;
  },

  bulkOperations: async (roomId: string, operation: string, fileIds: string[]) => {
    const response = await api.post(`/api/rooms/${roomId}/bulk-operations`, {
      operation,
      fileIds,
    });
    return response.data;
  },

  downloadFile: async (fileId: string) => {
    const response = await api.get(`/api/files/${fileId}/download`, {
      responseType: 'blob',
    });
    return response.data;
  },

  getFileContent: async (fileId: string) => {
    const response = await api.get(`/api/files/${fileId}/content`);
    return response.data;
  },

  updateFileContent: async (fileId: string, content: string) => {
    const response = await api.put(`/api/files/${fileId}/content`, { content });
    return response.data;
  },

  deleteFile: async (fileId: string) => {
    const response = await api.delete(`/api/files/${fileId}`);
    return response.data;
  },

  getRoomFiles: async (roomId: string) => {
    const response = await api.get(`/api/rooms/${roomId}/files`);
    return response.data;
  },
};

// Chat API
export const chatAPI = {
  getRoomMessages: async (roomId: string) => {
    const response = await api.get(`/api/rooms/${roomId}/messages`);
    return response.data;
  },

  sendMessage: async (roomId: string, message: string) => {
    const response = await api.post(`/api/rooms/${roomId}/messages`, { message });
    return response.data;
  },
};

export default api;
