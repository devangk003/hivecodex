import jwt, { SignOptions } from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { Request, Response, NextFunction } from "express";
import { JwtPayload, AuthenticatedUser } from "../types/user";
import { ApiResponse } from "../types";
import { User } from "../database/models";

const JWT_SECRET = process.env.JWT_SECRET || "supersecret";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "24h";
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || "7d";

/**
 * Update user's lastSeen timestamp
 */
async function updateLastSeen(userId: string): Promise<void> {
  try {
    await User.findByIdAndUpdate(userId, { lastSeen: new Date() });
  } catch (error) {
    // Silently fail to avoid disrupting the main request
    console.error("Failed to update lastSeen for user:", userId, error);
  }
}

// Extend Express Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

/**
 * Hash password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 12;
  return await bcrypt.hash(password, saltRounds);
}

/**
 * Compare password with hashed password
 */
export async function comparePassword(password: string, hashedPassword: string): Promise<boolean> {
  return await bcrypt.compare(password, hashedPassword);
}

/**
 * Generate JWT token
 */
export function generateToken(payload: Omit<JwtPayload, "iat" | "exp">): string {
  return jwt.sign(payload as object, JWT_SECRET, {
    expiresIn: "24h"
  });
}

/**
 * Generate refresh token
 */
export function generateRefreshToken(payload: Omit<JwtPayload, "iat" | "exp">): string {
  return jwt.sign(payload as object, JWT_SECRET, {
    expiresIn: "7d"
  });
}

/**
 * Verify JWT token
 */
export function verifyToken(token: string): JwtPayload {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch (error) {
    throw new Error("Invalid or expired token");
  }
}

/**
 * Extract token from Authorization header
 */
export function extractToken(authHeader: string | undefined): string | null {
  if (!authHeader) return null;
  
  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") return null;
  
  return parts[1];
}

/**
 * Authentication middleware
 */
export function authenticateToken(
  req: Request, 
  res: Response, 
  next: NextFunction
): void {
  const authHeader = req.headers["authorization"];
  const token = extractToken(authHeader);

  if (!token) {
    res.status(401).json({
      success: false,
      message: "Access token is required"
    } as ApiResponse);
    return;
  }

  try {
    const decoded = verifyToken(token);
    req.user = decoded;
    
    // Update lastSeen timestamp asynchronously (don't block the request)
    updateLastSeen(decoded.userId.toString()).catch((error: any) => {
      console.error("Failed to update lastSeen:", error);
    });
    
    next();
  } catch (error) {
    res.status(403).json({
      success: false,
      message: "Invalid or expired token",
      error: error instanceof Error ? error.message : "Unknown error"
    } as ApiResponse);
  }
}

/**
 * Optional authentication middleware (doesn't fail if no token)
 */
export function optionalAuth(
  req: Request, 
  res: Response, 
  next: NextFunction
): void {
  const authHeader = req.headers["authorization"];
  const token = extractToken(authHeader);

  if (token) {
    try {
      const decoded = verifyToken(token);
      req.user = decoded;
    } catch (error) {
      // Ignore invalid tokens in optional auth
    }
  }
  
  next();
}

/**
 * Require specific user role (extend as needed)
 */
export function requireRole(roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: "Authentication required"
      } as ApiResponse);
      return;
    }

    // Note: Role checking would require extending the user model
    // For now, just pass through
    next();
  };
}

/**
 * Generate password reset token
 */
export function generateResetToken(): string {
  return jwt.sign({ 
    type: "password_reset",
    timestamp: Date.now()
  }, JWT_SECRET, {
    expiresIn: "1h"
  });
}

/**
 * Verify password reset token
 */
export function verifyResetToken(token: string): { valid: boolean; expired?: boolean } {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    
    if (decoded.type !== "password_reset") {
      return { valid: false };
    }
    
    return { valid: true };
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return { valid: false, expired: true };
    }
    return { valid: false };
  }
}

/**
 * Generate email verification token
 */
export function generateEmailVerificationToken(userId: string, email: string): string {
  return jwt.sign({
    userId,
    email,
    type: "email_verification"
  }, JWT_SECRET, {
    expiresIn: "24h"
  });
}

/**
 * Verify email verification token
 */
export function verifyEmailVerificationToken(token: string): {
  valid: boolean;
  userId?: string;
  email?: string;
  expired?: boolean;
} {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    
    if (decoded.type !== "email_verification") {
      return { valid: false };
    }
    
    return { 
      valid: true, 
      userId: decoded.userId, 
      email: decoded.email 
    };
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return { valid: false, expired: true };
    }
    return { valid: false };
  }
}

/**
 * Create authenticated user object (for responses)
 */
export function createAuthenticatedUser(user: any): AuthenticatedUser {
  return {
    userId: user._id,
    name: user.name,
    email: user.email,
    profilePicId: user.profilePicId,
    activityStatus: user.activityStatus
  };
}

/**
 * Validate password strength
 */
export function validatePassword(password: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  if (password.length < 8) {
    errors.push("Password must be at least 8 characters long");
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push("Password must contain at least one uppercase letter");
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push("Password must contain at least one lowercase letter");
  }
  
  if (!/\d/.test(password)) {
    errors.push("Password must contain at least one number");
  }
  
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push("Password must contain at least one special character");
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Generate secure random string
 */
export function generateSecureRandom(length: number = 32): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  return result;
}
