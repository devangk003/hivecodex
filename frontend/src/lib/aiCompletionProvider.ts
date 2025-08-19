import { editor, languages, IRange, Position } from 'monaco-editor';
import { aiService, AICompletionRequest } from '@/services/aiService';

export interface AICompletionItem extends languages.CompletionItem {
  confidence?: number;
  aiGenerated: boolean;
}

export class AICompletionProvider implements languages.CompletionItemProvider {
  private isEnabled: boolean = true;
  private lastRequestTime: number = 0;
  private debounceMs: number = 300;
  private cache = new Map<string, AICompletionItem[]>();

  constructor() {
    this.triggerCharacters = ['.', ' ', '(', '{', '['];
  }

  triggerCharacters?: string[];

  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
  }

  private getCacheKey(
    model: editor.ITextModel,
    position: Position,
    context: languages.CompletionContext
  ): string {
    const lineContent = model.getLineContent(position.lineNumber);
    const beforeCursor = lineContent.substring(0, position.column - 1);
    return `${model.uri.toString()}-${beforeCursor}-${context.triggerKind}`;
  }

  private async generateAISuggestions(
    model: editor.ITextModel,
    position: Position,
    context: languages.CompletionContext
  ): Promise<AICompletionItem[]> {
    try {
      // Get current line and surrounding context
      const lineContent = model.getLineContent(position.lineNumber);
      const beforeCursor = lineContent.substring(0, position.column - 1);
      const afterCursor = lineContent.substring(position.column - 1);
      
      // Get more context from surrounding lines
      const startLine = Math.max(1, position.lineNumber - 5);
      const endLine = Math.min(model.getLineCount(), position.lineNumber + 5);
      const contextLines: string[] = [];
      
      for (let i = startLine; i <= endLine; i++) {
        contextLines.push(model.getLineContent(i));
      }
      
      const contextContent = contextLines.join('\n');
      const language = model.getLanguageId();
      
      // Prepare AI request
      const request: AICompletionRequest = {
        content: beforeCursor,
        language,
        context: contextContent,
        cursorPosition: position.column - 1,
        fileContent: model.getValue(),
      };

      const response = await aiService.generateSuggestions(request);
      
      if (!response.success || !response.data) {
        return [];
      }

      // Convert AI suggestions to Monaco completion items
      const completionItems: AICompletionItem[] = response.data.suggestions.map((suggestion, index) => {
        // Calculate range for replacement
        const wordAtPosition = model.getWordAtPosition(position);
        const range: IRange = wordAtPosition
          ? {
              startLineNumber: position.lineNumber,
              startColumn: wordAtPosition.startColumn,
              endLineNumber: position.lineNumber,
              endColumn: wordAtPosition.endColumn,
            }
          : {
              startLineNumber: position.lineNumber,
              startColumn: position.column,
              endLineNumber: position.lineNumber,
              endColumn: position.column,
            };

        return {
          label: {
            label: suggestion.substring(0, 50) + (suggestion.length > 50 ? '...' : ''),
            description: 'AI Suggestion',
          },
          kind: languages.CompletionItemKind.Snippet,
          insertText: suggestion,
          insertTextRules: languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range,
          detail: `AI Generated (${Math.round(response.data!.confidence * 100)}% confidence)`,
          documentation: {
            value: `**AI Suggestion**\n\n\`\`\`${language}\n${suggestion}\n\`\`\`\n\nConfidence: ${Math.round(response.data!.confidence * 100)}%`,
            isTrusted: true,
          },
          sortText: `00${index}`, // Sort AI suggestions at the top
          filterText: suggestion,
          confidence: response.data.confidence,
          aiGenerated: true,
          command: {
            id: 'ai.suggestion.applied',
            title: 'AI Suggestion Applied',
          },
        };
      });

      return completionItems;
    } catch (error) {
      console.error('Error generating AI suggestions:', error);
      return [];
    }
  }

  async provideCompletionItems(
    model: editor.ITextModel,
    position: Position,
    context: languages.CompletionContext,
    token: any
  ): Promise<languages.CompletionList | null> {
    if (!this.isEnabled) {
      return null;
    }

    // Rate limiting
    const now = Date.now();
    if (now - this.lastRequestTime < this.debounceMs) {
      return null;
    }
    this.lastRequestTime = now;

    // Check cache first
    const cacheKey = this.getCacheKey(model, position, context);
    const cached = this.cache.get(cacheKey);
    if (cached && cached.length > 0) {
      return {
        suggestions: cached,
        incomplete: false,
      };
    }

    try {
      // Generate AI suggestions
      const aiSuggestions = await this.generateAISuggestions(model, position, context);
      
      // Cache the results
      if (aiSuggestions.length > 0) {
        this.cache.set(cacheKey, aiSuggestions);
        
        // Clean cache periodically
        if (this.cache.size > 100) {
          const keys = Array.from(this.cache.keys());
          const toDelete = keys.slice(0, 50);
          toDelete.forEach(key => this.cache.delete(key));
        }
      }

      return {
        suggestions: aiSuggestions,
        incomplete: false,
      };
    } catch (error) {
      console.error('AI completion provider error:', error);
      return null;
    }
  }

  clearCache(): void {
    this.cache.clear();
  }
}

// Singleton instance
export const aiCompletionProvider = new AICompletionProvider();

// Register the completion provider for multiple languages
export const registerAICompletionProvider = (monaco: any) => {
  const languages = [
    'javascript',
    'typescript',
    'python',
    'java',
    'cpp',
    'csharp',
    'go',
    'rust',
    'php',
    'ruby',
    'html',
    'css',
    'json',
    'markdown',
  ];

  languages.forEach(language => {
    monaco.languages.registerCompletionItemProvider(language, aiCompletionProvider);
  });

  console.log('AI completion provider registered for languages:', languages);
};

export default aiCompletionProvider;
