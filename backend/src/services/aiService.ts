import { GoogleGenerativeAI } from "@google/generative-ai";

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

class AIService {
  private genAI: GoogleGenerativeAI;
  private modelName: string;
  private isConnected: boolean = false;

  constructor(apiKey: string, modelName: string) {
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.modelName = modelName;
  }

  async initialize(): Promise<void> {
    try {
      // Minimal connectivity check by attempting to get a model instance
      this.genAI.getGenerativeModel({ model: this.modelName });
      this.isConnected = true;
      console.log('✅ AI Service connected to Gemini');
    } catch (error) {
      console.error('❌ Failed to connect to Gemini:', error);
      this.isConnected = false;
      throw new Error('Gemini connection failed. Ensure GEMINI_API_KEY is valid.');
    }
  }

  // Optional: static list or configured
  async getAvailableModels(): Promise<string[]> {
    return [this.modelName];
  }

  async generateCodeSuggestions(request: AICompletionRequest): Promise<AICompletionResponse> {
    if (!this.isConnected) {
      throw new Error('AI Service not connected');
    }

    try {
      const prompt = this.buildCompletionPrompt(request);
      
      const model = this.genAI.getGenerativeModel({ model: this.modelName });
      const response = await model.generateContent(prompt);
      const text = response.response.text();

      // Parse response to extract suggestions
      const suggestions = this.parseCompletionResponse(text, request.language);

      return {
        suggestions,
        confidence: this.calculateConfidence(text),
        model: this.modelName,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Error generating code suggestions:', error);
      throw error;
    }
  }

  async chatWithAI(request: AIChatRequest): Promise<AIChatResponse> {
    if (!this.isConnected) {
      throw new Error('AI Service not connected');
    }

    try {
      const prompt = this.buildChatPrompt(request);
      
      const model = this.genAI.getGenerativeModel({ model: this.modelName });
      const chat = model.startChat();
      const result = await chat.sendMessage(prompt);
      const text = result.response.text();

      return {
        response: text.trim(),
        conversationId: request.conversationId || this.generateConversationId(),
        model: this.modelName,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Error in AI chat:', error);
      throw error;
    }
  }

  private buildCompletionPrompt(request: AICompletionRequest): string {
    const { content, language, context, fileContent, cursorPosition } = request;
    
    let prompt = `You are an expert ${language || 'code'} developer. Provide code completion suggestions for the following context.\n\n`;
    
    if (context) {
      prompt += `Context: ${context}\n\n`;
    }
    
    if (fileContent && cursorPosition !== undefined) {
      const beforeCursor = fileContent.substring(0, cursorPosition);
      const afterCursor = fileContent.substring(cursorPosition);
      
      prompt += `File content before cursor:\n\`\`\`${language}\n${beforeCursor}\n\`\`\`\n\n`;
      prompt += `File content after cursor:\n\`\`\`${language}\n${afterCursor}\n\`\`\`\n\n`;
    }
    
    prompt += `Complete this ${language || 'code'} snippet:\n\`\`\`${language}\n${content}\n\`\`\`\n\n`;
    prompt += `Provide only the completion code without explanations. Focus on:\n`;
    prompt += `- Syntactically correct ${language || 'code'}\n`;
    prompt += `- Following best practices\n`;
    prompt += `- Maintaining consistent style\n`;
    prompt += `- Logical progression from the context\n\n`;
    prompt += `Completion:`;
    
    return prompt;
  }

  private buildChatPrompt(request: AIChatRequest): string {
    let prompt = `You are HiveCodex AI, a helpful coding assistant. You help developers with code analysis, debugging, explanations, and improvements.\n\n`;
    
    if (request.context) {
      prompt += `Context: ${request.context}\n\n`;
    }
    
    if (request.attachments && request.attachments.length > 0) {
      prompt += `Attached files:\n`;
      request.attachments.forEach((file, index) => {
        prompt += `File ${index + 1} (${file.language}):\n\`\`\`${file.language}\n${file.content}\n\`\`\`\n\n`;
      });
    }
    
    prompt += `User: ${request.message}\n\n`;
    prompt += `Assistant:`;
    
    return prompt;
  }

  private parseCompletionResponse(response: string, language?: string): string[] {
    // Clean up the response and extract code suggestions
    const cleaned = response
      .replace(/```[\w]*\n?/g, '') // Remove code block markers
      .replace(/^(Completion:|Here's the completion:|The completion is:)/i, '') // Remove common prefixes
      .trim();
    
    // Split into multiple suggestions if there are clear separators
    const suggestions = cleaned
      .split(/\n(?:or|alternatively|another option:|option \d+:)/i)
      .map(s => s.trim())
      .filter(s => s.length > 0)
      .slice(0, 3); // Limit to 3 suggestions max
    
    return suggestions.length > 0 ? suggestions : [cleaned];
  }

  private calculateConfidence(response: string): number {
    // Simple confidence calculation based on response characteristics
    let confidence = 0.5; // Base confidence
    
    // Increase confidence for well-structured responses
    if (response.includes('function') || response.includes('const') || response.includes('class')) {
      confidence += 0.2;
    }
    
    // Increase confidence for responses with proper syntax patterns
    if (response.match(/[{}();]/)) {
      confidence += 0.2;
    }
    
    // Decrease confidence for very short or very long responses
    if (response.length < 10 || response.length > 500) {
      confidence -= 0.2;
    }
    
    return Math.max(0.1, Math.min(1.0, confidence));
  }

  private generateConversationId(): string {
    return `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  isServiceConnected(): boolean {
    return this.isConnected;
  }

  getModel(): string {
    return this.modelName;
  }
}

export default AIService;
