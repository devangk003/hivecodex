import express from 'express';
import rateLimit from 'express-rate-limit';
import AIService from '../services/aiService';
import { AIChatRequest, AICompletionRequest } from '../types';

const router = express.Router();

// Initialize Gemini AI Service
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
const aiService = new AIService(GEMINI_API_KEY, GEMINI_MODEL);

// Rate limiting configurations
const aiSuggestionLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute per user
  message: {
    success: false,
    error: 'Too many AI suggestion requests. Please try again later.',
    timestamp: new Date().toISOString(),
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const aiChatLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10, // 10 chat requests per minute per user
  message: {
    success: false,
    error: 'Too many AI chat requests. Please try again later.',
    timestamp: new Date().toISOString(),
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// API Response helper
const createAPIResponse = (success: boolean, data?: any, error?: string) => ({
  success,
  data,
  error,
  timestamp: new Date().toISOString(),
});

// Initialize AI service on startup
aiService.initialize().catch(error => {
  console.error('Failed to initialize AI service:', error);
});

// Middleware to check AI service status
const checkAIService = (req: express.Request, res: express.Response, next: express.NextFunction): void => {
  if (!aiService.isServiceConnected()) {
    res.status(503).json(createAPIResponse(false, null, 'AI service is not available'));
    return;
  }
  next();
};

// GET /api/ai/models - Get available AI models
router.get('/models', async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    const models = await aiService.getAvailableModels();
    res.json(createAPIResponse(true, { 
      models,
      currentModel: GEMINI_MODEL,
      config: { provider: 'gemini' }
    }));
  } catch (error) {
    console.error('Error fetching models:', error);
    res.status(500).json(
      createAPIResponse(false, null, 'Failed to fetch available models')
    );
  }
});

// POST /api/ai/suggestions - Generate code suggestions
router.post('/suggestions', aiSuggestionLimiter, checkAIService, async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    const { content, language, context, cursorPosition, fileContent } = req.body;
    
    // Validation
    if (!content || typeof content !== 'string') {
      res.status(400).json(
        createAPIResponse(false, null, 'Content is required and must be a string')
      );
      return;
    }

    // Get user ID from auth middleware (assuming it's available)
    const userId = (req as any).user?.id || 'anonymous';

    const request: AICompletionRequest = {
      content: content.trim(),
      language: language || 'javascript',
      context: context || '',
      userId,
      cursorPosition,
      fileContent,
    };

    const suggestions = await aiService.generateCodeSuggestions(request);
    
    res.json(createAPIResponse(true, suggestions));
  } catch (error) {
    console.error('Error generating AI suggestions:', error);
    res.status(500).json(
      createAPIResponse(false, null, 'Failed to generate AI suggestions')
    );
  }
});

// POST /api/ai/chat - AI chat conversation
router.post('/chat', aiChatLimiter, checkAIService, async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    const { message, context, conversationId, attachments } = req.body;
    
    // Validation
    if (!message || typeof message !== 'string') {
      res.status(400).json(
        createAPIResponse(false, null, 'Message is required and must be a string')
      );
      return;
    }

    // Get user ID from auth middleware
    const userId = (req as any).user?.id || 'anonymous';

    const request: AIChatRequest = {
      message: message.trim(),
      context: context || '',
      conversationId,
      userId,
      attachments: attachments || [],
    };

    const chatResponse = await aiService.chatWithAI(request);
    
    res.json(createAPIResponse(true, chatResponse));
  } catch (error) {
    console.error('Error in AI chat:', error);
    res.status(500).json(
      createAPIResponse(false, null, 'Failed to process AI chat request')
    );
  }
});

// GET /api/ai/status - Check AI service status
router.get('/status', (req: express.Request, res: express.Response) => {
  const isConnected = aiService.isServiceConnected();
  res.json(createAPIResponse(true, {
    connected: isConnected,
    service: 'Gemini',
    config: { model: GEMINI_MODEL },
    timestamp: new Date().toISOString(),
  }));
});

// POST /api/ai/test - Test AI service with a simple request
router.post('/test', aiSuggestionLimiter, checkAIService, async (req: express.Request, res: express.Response) => {
  try {
    const testRequest: AICompletionRequest = {
      content: 'function hello',
      language: 'javascript',
      context: 'Testing AI service',
      userId: 'test-user',
    };

    const result = await aiService.generateCodeSuggestions(testRequest);
    
    res.json(createAPIResponse(true, {
      ...result,
      message: 'AI service test successful',
    }));
  } catch (error) {
    console.error('AI service test failed:', error);
    res.status(500).json(
      createAPIResponse(false, null, 'AI service test failed')
    );
  }
});

export default router;
