export interface AICompletionRequest {
  content: string;
  language?: string;
  context?: string;
  userId: string;
  cursorPosition?: number;
  fileContent?: string;
}

export interface AICompletionResponse {
  suggestions: string[];
  confidence: number;
  model: string;
  timestamp: string;
}

export interface AIChatRequest {
  message: string;
  context?: string;
  conversationId?: string;
  userId: string;
  attachments?: {
    fileId: string;
    content: string;
    language: string;
  }[];
}

export interface AIChatResponse {
  response: string;
  conversationId: string;
  model: string;
  timestamp: string;
}
