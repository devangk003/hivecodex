import dotenv from "dotenv";

// Load environment variables
dotenv.config();

export const JWT_SECRET = process.env.JWT_SECRET || "supersecret";
export const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "24h";
export const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || "7d";
export const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/hivecodex";
export const PORT = Number(process.env.PORT) || 5000;

// Security Configuration
export const SECURITY_CONFIG = {
  // Rate Limiting
  AUTH_RATE_LIMIT: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5 // 5 attempts per window
  },
  GENERAL_RATE_LIMIT: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // 100 requests per window
  },
  STRICT_RATE_LIMIT: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 30 // 30 requests per window
  },
  
  // Request Limits
  MAX_REQUEST_SIZE: 50 * 1024 * 1024, // 50MB
  MAX_PARAMETERS: 100,
  
  // CORS Origins
  ALLOWED_ORIGINS: [
    process.env.FRONTEND_URL || "http://localhost:8080",
    "http://localhost:3000",
    "http://localhost:5173"
  ].filter(Boolean),
  
  // Security Headers
  SECURITY_HEADERS: {
    X_FRAME_OPTIONS: 'DENY',
    X_CONTENT_TYPE_OPTIONS: 'nosniff',
    X_XSS_PROTECTION: '1; mode=block',
    REFERRER_POLICY: 'strict-origin-when-cross-origin',
    CONTENT_SECURITY_POLICY: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' ws: wss:;",
    PERMISSIONS_POLICY: 'geolocation=(), microphone=(), camera=()'
  }
};
