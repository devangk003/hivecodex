// AI Service for Frontend
export interface AICompletionRequest {
  content: string;
  language?: string;
  context?: string;
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

export interface AIModel {
  name: string;
  size?: string;
  modified?: string;
}

export interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

class AIService {
  private baseURL: string;
  
  constructor() {
    this.baseURL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
  }

  private async makeRequest<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<APIResponse<T>> {
    try {
      const response = await fetch(`${this.baseURL}/api/ai${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        ...options,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('AI Service request failed:', error);
      throw error;
    }
  }

  async getStatus() {
    return this.makeRequest<{
      connected: boolean;
      service: string;
      config: {
        host: string;
        port: number;
        model: string;
      };
    }>('/status');
  }

  async getModels() {
    return this.makeRequest<{
      models: string[];
      currentModel: string;
      config: {
        host: string;
        port: number;
      };
    }>('/models');
  }

  async generateSuggestions(request: AICompletionRequest): Promise<APIResponse<AICompletionResponse>> {
    return this.makeRequest<AICompletionResponse>('/suggestions', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async chat(request: AIChatRequest): Promise<APIResponse<AIChatResponse>> {
    return this.makeRequest<AIChatResponse>('/chat', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async testConnection(): Promise<APIResponse<AICompletionResponse & { message: string }>> {
    return this.makeRequest<AICompletionResponse & { message: string }>('/test', {
      method: 'POST',
      body: JSON.stringify({}),
    });
  }
}

export const aiService = new AIService();
export default aiService;
