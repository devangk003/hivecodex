import mongoose from "mongoose";
import { GridFSBucket } from "mongodb";
import { Readable } from "stream";

let bucket: GridFSBucket | null = null;

export function getGridFSBucket(): GridFSBucket {
  if (bucket) return bucket;
  const db = mongoose.connection.db;
  if (!db) {
    throw new Error("MongoDB connection not established");
  }
  bucket = new GridFSBucket(db, { bucketName: "uploads" });
  return bucket;
}

export function uploadFileStream(filename: string, options?: { contentType?: string; metadata?: any }) {
  const b = getGridFSBucket();
  return b.openUploadStream(filename, {
    contentType: options?.contentType,
    metadata: options?.metadata,
  });
}

export function downloadFileStream(fileIdOrName: string | mongoose.Types.ObjectId) {
  const b = getGridFSBucket();
  if (typeof fileIdOrName === "string") {
    // Try by filename
    return b.openDownloadStreamByName(fileIdOrName);
  }
  return b.openDownloadStream(fileIdOrName);
}

export async function deleteFile(fileId: mongoose.Types.ObjectId): Promise<void> {
  const b = getGridFSBucket();
  await b.delete(fileId);
}


