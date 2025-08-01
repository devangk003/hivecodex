import { LANGUAGE_MAP } from '@/constants';
import type { APIError } from '@/types';

/**
 * Gets Monaco editor language from file extension
 * @param extension - File extension (without dot)
 * @returns Monaco language identifier
 */
export const getLanguageFromExtension = (extension: string): string => {
  return LANGUAGE_MAP[extension.toLowerCase()] || 'plaintext';
};

/**
 * Formats file size in human readable format
 * @param bytes - Size in bytes
 * @returns Formatted size string
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * Debounces a function call
 * @param func - Function to debounce
 * @param wait - Wait time in milliseconds
 * @returns Debounced function
 */
export const debounce = <T extends (...args: never[]) => void>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout;

  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

/**
 * Extracts error message from API error response
 * @param error - Error object
 * @returns Human readable error message
 */
export const getErrorMessage = (error: unknown): string => {
  if (typeof error === 'string') {
    return error;
  }

  const apiError = error as APIError;

  if (apiError?.response?.data?.message) {
    return apiError.response.data.message;
  }

  if (apiError?.message) {
    return apiError.message;
  }

  return 'An unexpected error occurred';
};

/**
 * Validates file type for upload
 * @param file - File object
 * @param allowedTypes - Array of allowed MIME types
 * @returns True if file type is allowed
 */
export const validateFileType = (
  file: File,
  allowedTypes: string[]
): boolean => {
  return allowedTypes.includes(file.type);
};

/**
 * Validates file size
 * @param file - File object
 * @param maxSize - Maximum size in bytes
 * @returns True if file size is within limit
 */
export const validateFileSize = (file: File, maxSize: number): boolean => {
  return file.size <= maxSize;
};

/**
 * Generates a random color for user cursors
 * @returns Hex color string
 */
export const generateRandomColor = (): string => {
  const colors = [
    '#FF6B6B',
    '#4ECDC4',
    '#45B7D1',
    '#96CEB4',
    '#FFEAA7',
    '#DDA0DD',
    '#98D8C8',
    '#F7DC6F',
    '#BB8FCE',
    '#85C1E9',
  ];

  return colors[Math.floor(Math.random() * colors.length)];
};

/**
 * Truncates text to specified length
 * @param text - Text to truncate
 * @param maxLength - Maximum length
 * @returns Truncated text with ellipsis
 */
export const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
};

/**
 * Checks if a value is not null or undefined
 * @param value - Value to check
 * @returns Type guard for non-null values
 */
export const isNotNullish = <T>(value: T | null | undefined): value is T => {
  return value !== null && value !== undefined;
};
