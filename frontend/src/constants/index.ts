// Time constants (in milliseconds)
export const SOCKET_RECONNECT_DELAY = 3000;
export const SOCKET_MAX_RETRIES = 5;
export const FILE_UPLOAD_TIMEOUT = 30000;
export const DEBOUNCE_DELAY = 300;
export const SAVE_DEBOUNCE_DELAY = 1000;

// UI constants
export const MAX_TAB_COUNT = 10;
export const SIDEBAR_MIN_WIDTH = 200;
export const SIDEBAR_MAX_WIDTH = 600;
export const EDITOR_MIN_WIDTH = 400;

// File size limits (in bytes)
export const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
export const MAX_ZIP_SIZE = 100 * 1024 * 1024; // 100MB

// Language mappings
export const LANGUAGE_MAP: Record<string, string> = {
  js: 'javascript',
  jsx: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  py: 'python',
  java: 'java',
  cpp: 'cpp',
  c: 'c',
  cs: 'csharp',
  php: 'php',
  rb: 'ruby',
  go: 'go',
  rs: 'rust',
  swift: 'swift',
  kt: 'kotlin',
  scala: 'scala',
  html: 'html',
  css: 'css',
  scss: 'scss',
  sass: 'sass',
  less: 'less',
  json: 'json',
  xml: 'xml',
  yaml: 'yaml',
  yml: 'yaml',
  md: 'markdown',
  sql: 'sql',
  sh: 'shell',
  bash: 'shell',
  zsh: 'shell',
  ps1: 'powershell',
  dockerfile: 'dockerfile',
  env: 'properties',
  properties: 'properties',
  ini: 'ini',
  toml: 'toml',
  gitignore: 'gitignore',
  txt: 'plaintext',
};

// Socket event names
export const SOCKET_EVENTS = {
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  JOIN_ROOM: 'join-room',
  LEAVE_ROOM: 'leave-room',
  PARTICIPANT_JOINED: 'participant-joined',
  PARTICIPANT_LEFT: 'participant-left',
  PARTICIPANT_LIST: 'participant-list',
  USER_STATUS_UPDATE: 'user-status-update',
  FILE_CHANGE: 'file-change',
  CURSOR_UPDATE: 'cursor-update',
  FILE_SYNC: 'file-sync',
  REQUEST_FILE_SYNC: 'request-file-sync',
  REQUEST_FILE_SYNC_FROM_PEER: 'request-file-sync-from-peer',
} as const;

// API endpoints
export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: '/auth/login',
    REGISTER: '/auth/register',
    LOGOUT: '/auth/logout',
    PROFILE: '/auth/profile',
  },
  FILES: {
    LIST: '/files',
    CONTENT: '/files/content',
    UPLOAD: '/files/upload',
    DELETE: '/files/delete',
  },
  ROOMS: {
    LIST: '/rooms',
    CREATE: '/rooms',
    JOIN: '/rooms/join',
    LEAVE: '/rooms/leave',
  },
} as const;
