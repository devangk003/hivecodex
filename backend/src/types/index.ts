// Socket types
export * from "./socket";

// User types
export * from "./user";

// File system types
export * from "./filesystem";

// Database types - selective exports to avoid conflicts
export type {
  IRoom,
  IMessage,
  ISession,
  IRoomActivity,
  ICollaborationHistory,
  IRoomInvitation,
  IRoomStatistics,
  DatabaseConfig,
  RedisConfig,
  GridFSConfig
} from "./database";

// AI types
export * from "./ai";

// Common utility types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  timestamp: Date;
}

export interface PaginatedResponse<T = any> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

export interface ServerConfig {
  port: number;
  host: string;
  cors: {
    origin: string | string[];
    credentials: boolean;
    methods: string[];
  };
  jwt: {
    secret: string;
    expiresIn: string;
    refreshExpiresIn: string;
  };
  upload: {
    maxFileSize: number;
    allowedTypes: string[];
    destination: string;
  };
  redis: {
    enabled: boolean;
    host: string;
    port: number;
    password?: string;
  };
}

export interface Environment {
  NODE_ENV: "development" | "production" | "test";
  PORT: string;
  MONGO_URI: string;
  JWT_SECRET: string;
  REDIS_URL?: string;
  EMAIL_SERVICE?: string;
  EMAIL_USER?: string;
  EMAIL_PASS?: string;
  UPLOAD_LIMIT?: string;
  SESSION_SECRET?: string;
}
