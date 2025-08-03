import express from "express";
import bcrypt from "bcrypt";
import jwt, { SignOptions } from "jsonwebtoken";
import crypto from "crypto";
import { GridFSBucket } from "mongodb";
import mongoose from "mongoose";
import multer from "multer";
import { User } from "../database/models";
import { JWT_SECRET, JWT_EXPIRES_IN } from "../config/constants";

const router = express.Router();
let gridfsBucket: GridFSBucket;

// Set GridFS bucket
export const setGridFSBucket = (bucket: GridFSBucket) => {
  gridfsBucket = bucket;
};

// Configure multer for profile picture uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"));
    }
  },
});

// Utility function to upload file to GridFS
const uploadToGridFS = (buffer: Buffer, filename: string, mimetype: string): Promise<mongoose.Types.ObjectId> => {
  return new Promise((resolve, reject) => {
    const uploadStream = gridfsBucket.openUploadStream(filename, {
      metadata: { mimetype },
    });
    
    uploadStream.end(buffer);
    uploadStream.on("finish", () => resolve(uploadStream.id as mongoose.Types.ObjectId));
    uploadStream.on("error", reject);
  });
};

// Password validation function
const validatePassword = (password: string): { isValid: boolean; message?: string } => {
  if (password.length < 8) {
    return { isValid: false, message: "Password must be at least 8 characters long" };
  }
  
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
  
  const criteriaMet = [hasUpperCase, hasLowerCase, hasNumbers, hasSpecialChar].filter(Boolean).length;
  
  if (criteriaMet < 2) {
    return {
      isValid: false,
      message: "Password must contain at least 2 of: uppercase letters, lowercase letters, numbers, or special characters"
    };
  }
  
  return { isValid: true };
};

// Register endpoint
router.post("/register", upload.single("profilePicture"), async (req, res): Promise<any> => {
  try {
    const { name, email, password } = req.body;
    
    // Validate required fields
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Name, email, and password are required",
        timestamp: new Date()
      });
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Invalid email format",
        timestamp: new Date()
      });
    }
    
    // Validate password
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      return res.status(400).json({
        success: false,
        message: passwordValidation.message,
        timestamp: new Date()
      });
    }
    
    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "User with this email already exists",
        timestamp: new Date()
      });
    }
    
    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    
    // Handle profile picture upload
    let profilePicId = null;
    if (req.file && gridfsBucket) {
      try {
        profilePicId = await uploadToGridFS(
          req.file.buffer,
          `profile_${Date.now()}_${req.file.originalname}`,
          req.file.mimetype
        );
      } catch (uploadError) {
        console.error("Profile picture upload failed:", uploadError);
        // Continue without profile picture
      }
    }
    
    // Create user
    const newUser = new User({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      profilePicId,
      activityStatus: "online",
      lastSeen: new Date(),
      isEmailVerified: false,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    await newUser.save();
    
    // Generate JWT token
    const token = jwt.sign(
      {
        id: newUser._id,
        email: newUser.email,
        name: newUser.name
      },
      JWT_SECRET as string,
      { expiresIn: "24h" }
    );
    
    // Return success response
    res.status(201).json({
      success: true,
      message: "User registered successfully",
      data: {
        token,
        user: {
          userId: newUser._id,
          name: newUser.name,
          email: newUser.email,
          profilePicId: newUser.profilePicId,
          activityStatus: newUser.activityStatus
        }
      },
      timestamp: new Date()
    });
    
  } catch (error) {
    console.error("Registration error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error during registration",
      timestamp: new Date()
    });
  }
});

// Login endpoint
router.post("/login", async (req, res): Promise<any> => {
  try {
    const { email, password } = req.body;
    
    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
        timestamp: new Date()
      });
    }
    
    // Find user by email
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
        timestamp: new Date()
      });
    }
    
    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
        timestamp: new Date()
      });
    }
    
    // Update user's last seen and activity status
    await User.findByIdAndUpdate(user._id, {
      lastSeen: new Date(),
      activityStatus: "online",
      updatedAt: new Date()
    });
    
    // Generate JWT token
    const token = jwt.sign(
      {
        id: user._id,
        email: user.email,
        name: user.name
      },
      JWT_SECRET as string,
      { expiresIn: "24h" }
    );
    
    // Return success response
    res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        token,
        user: {
          userId: user._id,
          name: user.name,
          email: user.email,
          profilePicId: user.profilePicId,
          activityStatus: user.activityStatus
        }
      },
      timestamp: new Date()
    });
    
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error during login",
      timestamp: new Date()
    });
  }
});

// Password reset request endpoint
router.post("/forgot-password", async (req, res): Promise<any> => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
        timestamp: new Date()
      });
    }
    
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      // Don't reveal whether user exists or not for security
      return res.status(200).json({
        success: true,
        message: "If an account with that email exists, a password reset link has been sent",
        timestamp: new Date()
      });
    }
    
    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenHash = crypto.createHash("sha256").update(resetToken).digest("hex");
    
    // Save reset token with expiration (1 hour)
    await User.findByIdAndUpdate(user._id, {
      passwordResetToken: resetTokenHash,
      passwordResetExpires: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
      updatedAt: new Date()
    });
    
    // TODO: Send email with reset link
    // For now, just log the token (in production, this should be sent via email)
    console.log(`Password reset token for ${email}: ${resetToken}`);
    
    res.status(200).json({
      success: true,
      message: "If an account with that email exists, a password reset link has been sent",
      timestamp: new Date()
    });
    
  } catch (error) {
    console.error("Forgot password error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      timestamp: new Date()
    });
  }
});

// Password reset endpoint
router.post("/reset-password", async (req, res): Promise<any> => {
  try {
    const { token, newPassword } = req.body;
    
    if (!token || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Token and new password are required",
        timestamp: new Date()
      });
    }
    
    // Validate new password
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.isValid) {
      return res.status(400).json({
        success: false,
        message: passwordValidation.message,
        timestamp: new Date()
      });
    }
    
    // Hash the provided token
    const resetTokenHash = crypto.createHash("sha256").update(token).digest("hex");
    
    // Find user with valid reset token
    const user = await User.findOne({
      passwordResetToken: resetTokenHash,
      passwordResetExpires: { $gt: new Date() }
    });
    
    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired reset token",
        timestamp: new Date()
      });
    }
    
    // Hash new password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
    
    // Update user password and clear reset token
    await User.findByIdAndUpdate(user._id, {
      password: hashedPassword,
      passwordResetToken: undefined,
      passwordResetExpires: undefined,
      updatedAt: new Date()
    });
    
    res.status(200).json({
      success: true,
      message: "Password reset successful",
      timestamp: new Date()
    });
    
  } catch (error) {
    console.error("Reset password error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      timestamp: new Date()
    });
  }
});

export const authRoutes = router;
