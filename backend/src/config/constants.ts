import dotenv from "dotenv";

// Load environment variables
dotenv.config();

export const JWT_SECRET = process.env.JWT_SECRET || "supersecret";
export const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "24h";
export const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || "7d";
export const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/hivecodex";
export const PORT = Number(process.env.PORT) || 5000;
