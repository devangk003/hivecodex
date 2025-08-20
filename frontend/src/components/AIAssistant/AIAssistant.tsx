import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  Loader2,
  Send,
  User,
  Copy,
  Check,
  X,
  Paperclip,
  FileText,
  Code,
  Sparkles,
  MessageSquare,
  RefreshCw,
  Plus,
  Settings,
  Zap,
  Brain,
  Terminal,
  ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { aiService } from '@/services/aiService';
import { getLanguageFromExtension, formatFileSize } from '@/utils';

// --- INTERFACES (UNCHANGED) ---
interface FileAttachment {
  id: string;
  name: string;
  content: string;
  language: string;
  size: number;
  type: 'code';
  preview?: string;
  mimeType?: string;
}

interface CodeSuggestion {
  id: string;
  title: string;
  description: string;
  code: string;
  language: string;
  insertPosition?: { line: number; column: number };
  fileName?: string;
  confidence?: number;
  category?: 'optimization' | 'bug_fix' | 'feature' | 'refactor' | 'security';
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  id: string;
  timestamp: Date;
  attachments?: FileAttachment[];
  suggestions?: CodeSuggestion[];
  type?: 'chat' | 'code_review' | 'suggestion' | 'error_fix' | 'optimization';
  tokens?: number;
  model?: string;
}

interface AIAssistantProps {
  onInsertCode?: (
    code: string,
    fileName?: string,
    position?: { line: number; column: number }
  ) => void;
  onRunCode?: (code: string, language: string) => void;
  activeFileName?: string;
  activeFileContent?: string;
  activeFileLanguage?: string;
  cursorPosition?: { line: number; column: number };
  theme?: 'dark' | 'light';
  workspaceFiles?: Array<{
    name: string;
    path: string;
    content: string;
    language: string;
  }>;
  onAttachWorkspaceFile?: (filePath: string) => void;
}


// --- SUB-COMPONENTS (LARGELY UNCHANGED) ---
const MessageTypeIndicator: React.FC<{
  type?: string;
  model?: string;
  tokens?: number;
}> = ({ type, model, tokens }) => {
  const getTypeConfig = (type?: string) => {
    switch (type) {
      case 'code_review':
        return { icon: Code, color: 'text-blue-400', label: 'Code Review' };
      case 'suggestion':
        return {
          icon: Sparkles,
          color: 'text-purple-400',
          label: 'Suggestion',
        };
      case 'error_fix':
        return { icon: RefreshCw, color: 'text-red-400', label: 'Error Fix' };
      case 'optimization':
        return { icon: Zap, color: 'text-yellow-400', label: 'Optimization' };
      default:
        return { icon: MessageSquare, color: 'text-zinc-400', label: 'Chat' };
    }
  };

  const config = getTypeConfig(type);
  const Icon = config.icon;

  return (
    <div className="flex items-center justify-between mb-2">
      <div className="flex items-center gap-1">
        <Icon className={cn('h-3 w-3', config.color)} />
        <span className={cn('text-xs font-medium', config.color)}>
          {config.label}
        </span>
      </div>
      <div className="flex items-center gap-2 text-xs text-zinc-500">
        {model && <span>{model}</span>}
        {tokens && <span>{tokens} tokens</span>}
      </div>
    </div>
  );
};

const CodeBlock: React.FC<{
  children: string;
  className?: string;
  inline?: boolean;
  onInsert?: (code: string) => void;
  onRun?: (code: string, language: string) => void;
  fileName?: string;
}> = ({ children, className, inline, onInsert, onRun, fileName }) => {
  const [copied, setCopied] = useState(false);
  
  const match = /language-(\w+)/.exec(className || '');
  const language = match ? match[1] : '';

  const handleCopy = async () => {
    await navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (inline) {
    return (
      <code className="bg-zinc-800 px-1 py-0.5 rounded text-xs font-mono text-zinc-100">
        {children}
      </code>
    );
  }

  return (
    <div className="relative group my-2 rounded-lg overflow-hidden border border-zinc-800">
      <div className="flex items-center justify-between bg-zinc-800/50 px-3 py-1.5 text-xs text-zinc-400">
        <span>{language || 'code'}</span>
        <div className="flex items-center gap-2">
          {fileName && (
            <span className="text-zinc-500">{fileName}</span>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            className="h-6 w-6 p-0 opacity-50 group-hover:opacity-100 transition-opacity"
          >
            {copied ? (
              <Check className="h-3 w-3 text-green-400" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
          </Button>
          {onInsert && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onInsert(children)}
              className="h-6 w-6 p-0 opacity-50 group-hover:opacity-100 transition-opacity"
            >
              <Plus className="h-3 w-3" />
            </Button>
          )}
          {onRun && language && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onRun(children, language)}
              className="h-6 w-6 p-0 opacity-50 group-hover:opacity-100 transition-opacity"
            >
              <Terminal className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>
      <pre className="bg-zinc-900/70 p-3 overflow-x-auto text-xs">
        <code className={cn('font-mono text-zinc-100', className)}>
          {children}
        </code>
      </pre>
    </div>
  );
};


const CodeSuggestionCard: React.FC<{
  suggestion: CodeSuggestion;
  onInsert: () => void;
  onCopy: () => void;
  onRun?: (code: string, language: string) => void;
  activeFileName?: string;
}> = ({ suggestion, onInsert, onCopy, onRun, activeFileName }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await onCopy();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getCategoryColor = (category?: string) => {
    switch (category) {
      case 'optimization':
        return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
      case 'bug_fix':
        return 'bg-red-500/10 text-red-400 border-red-500/20';
      case 'feature':
        return 'bg-green-500/10 text-green-400 border-green-500/20';
      case 'refactor':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'security':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
      default:
        return 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20';
    }
  };

  return (
    <div className="border border-zinc-700/50 rounded-lg overflow-hidden bg-zinc-900/30 my-3 group hover:bg-zinc-900/50 transition-colors">
      <div className="p-3 bg-zinc-800/30">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="text-sm font-medium text-zinc-200">
                {suggestion.title}
              </h4>
              {suggestion.category && (
                <Badge
                  variant="outline"
                  className={cn(
                    'text-xs',
                    getCategoryColor(suggestion.category)
                  )}
                >
                  {suggestion.category}
                </Badge>
              )}
            </div>
            <p className="text-xs text-zinc-400 mb-2">
              {suggestion.description}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" onClick={handleCopy} className="h-6 w-6 p-0 text-zinc-400 hover:text-zinc-200">
                  {copied ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Copy code</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" onClick={onInsert} className="h-6 w-6 p-0 text-zinc-400 hover:text-zinc-200">
                  <Plus className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {activeFileName ? `Insert into ${activeFileName}` : 'No active file'}
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>
      <div className="border-t border-zinc-700/50">
        <CodeBlock className={`language-${suggestion.language}`} onInsert={() => onInsert()} onRun={onRun} fileName={suggestion.fileName}>
          {suggestion.code}
        </CodeBlock>
      </div>
    </div>
  );
};


// --- NEW WELCOME SCREEN COMPONENT ---
const HiveAIWelcomeScreen = () => (
    <div className="flex flex-col items-center justify-center h-full text-center p-8">
      <Brain className="w-16 h-16 text-zinc-500 mb-6" />
      <h1 className="text-3xl font-bold text-zinc-100 ">Build with HiveAI</h1>
      <p className="text-zinc-400 mt-2 mb-4 text-[12px]">Agent Mode</p>
      <p className="max-w-md text-sm text-zinc-400 leading-relaxed mb-8 text-[12px]">
        Ask HiveAI to edit your files in agent mode. HiveAI will automatically use
        multiple requests to pick files to edit, run terminal commands, and
        iterate on errors. So mistakes are possible. Review output carefully before use.
      </p>
      <div className="flex items-center text-sm text-zinc-500 text-[12px]">
        <Paperclip className="w-4 h-4 mr-2 text-[12px]" />
        to attach workspace files
      </div>
    </div>
);


// --- MAIN AI ASSISTANT COMPONENT (REDESIGNED) ---
export const AIAssistant: React.FC<AIAssistantProps> = ({
  onInsertCode,
  onRunCode,
  activeFileName,
  activeFileContent,
  activeFileLanguage,
  cursorPosition,
  theme = 'dark',
  workspaceFiles = [],
  onAttachWorkspaceFile,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);
  const [isAIOnline, setIsAIOnline] = useState(true);
  const [selectedModel, setSelectedModel] = useState('Gemini 2.5 Pro');
  const [showFilePicker, setShowFilePicker] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // --- LOGIC (UNCHANGED) ---
  const addFileAttachment = (fileName: string, content: string, language?: string) => {
    const newAttachment: FileAttachment = {
      id: Date.now().toString(),
      name: fileName,
      content,
      language: language || activeFileLanguage || 'text',
      size: content.length,
      type: 'code',
      preview: content.substring(0, 200) + (content.length > 200 ? '...' : ''),
    };

    setAttachments(prev => [
      ...prev.filter(a => a.name !== fileName),
      newAttachment,
    ]);
  };

  const removeAttachment = (id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
  };

  // File attachment handling - for workspace files
  const handleFileAttachment = () => {
    if (workspaceFiles.length > 0) {
      setShowFilePicker(true);
    } else {
      console.log('No workspace files available');
    }
  };

  const triggerFileAttachment = () => {
    handleFileAttachment();
  };

  const attachWorkspaceFile = (filePath: string) => {
    const file = workspaceFiles.find(f => f.path === filePath);
    if (file) {
      addFileAttachment(file.name, file.content, file.language);
      if (onAttachWorkspaceFile) {
        onAttachWorkspaceFile(filePath);
      }
    }
    setShowFilePicker(false);
  };

  const generateCodeSuggestions = (input: string): CodeSuggestion[] => {
    if (input.toLowerCase().includes('optimize') || input.toLowerCase().includes('performance')) {
      return [{
        id: 'perf-1',
        title: 'Performance Optimization',
        description: 'Consider using efficient algorithms and data structures',
        code: '// Use Map instead of array.find() for O(1) lookup\nconst userMap = new Map(users.map(u => [u.id, u]));\nconst user = userMap.get(userId);',
        language: 'javascript',
        category: 'optimization',
        confidence: 0.8,
      }];
    }
    return [];
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || !isAIOnline) return;

    const newMessage: ChatMessage = {
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
      attachments: [...attachments],
      id: Date.now().toString(),
      type: 'chat',
    };

    setMessages(prev => [...prev, newMessage]);
    setInput('');
    setIsLoading(true);

    try {
      let contextualMessage = input.trim();
      if (attachments.length > 0) {
        contextualMessage += '\n\nAttached files:\n';
        attachments.forEach(file => {
          contextualMessage += `\n**${file.name}** (${file.language}):\n\`\`\`${file.language}\n${file.content.substring(0, 1000)}\n\`\`\`\n`;
        });
      }

      const response = await aiService.chat({
        message: contextualMessage,
        context: `Room coding session. Active file: ${activeFileName || 'none'}`,
        attachments: attachments.map(file => ({
          fileId: file.id,
          content: file.content,
          language: file.language,
        })),
      });

      if (response.success && response.data) {
        const suggestions = generateCodeSuggestions(input.trim());
        setMessages(prev => [
          ...prev,
          {
            role: 'assistant',
            content: response.data.response,
            timestamp: new Date(),
            suggestions: suggestions.length > 0 ? suggestions : undefined,
            id: Date.now().toString(),
            type: 'chat',
            model: response.data.model || 'HiveAI Assistant',
          },
        ]);
      } else {
        setMessages(prev => [
          ...prev,
          {
            role: 'assistant',
            content: response.error || 'Sorry, an error occurred.',
            timestamp: new Date(),
            id: Date.now().toString(),
          },
        ]);
      }
    } catch (error) {
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: "I'm having trouble connecting. Please try again.",
          timestamp: new Date(),
          id: Date.now().toString(),
        },
      ]);
    } finally {
      setIsLoading(false);
      setAttachments([]);
    }
  };

  const handleInsertCode = (
    code: string,
    fileName?: string,
    position?: { line: number; column: number }
  ) => {
    if (onInsertCode) {
      onInsertCode(
        code,
        fileName || activeFileName,
        position || cursorPosition
      );
    }
  };

  const handleCopySuggestion = async (code: string) => {
    await navigator.clipboard.writeText(code);
  };


  return (
    <TooltipProvider>
      <div className="h-full flex flex-col bg-zinc-950 text-zinc-100">
        {/* --- SIMPLIFIED HEADER --- */}
        <div className="flex items-center justify-between p-2 border-b border-zinc-800">
            <span className="font-medium text-sm pl-2">CHAT</span>
            <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-zinc-400 hover:text-zinc-100">
                    <Plus className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-zinc-400 hover:text-zinc-100">
                    <RefreshCw className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-zinc-400 hover:text-zinc-100">
                    <Settings className="h-4 w-4" />
                </Button>
            </div>
        </div>

        {/* --- MESSAGES OR WELCOME SCREEN --- */}
        <div className="flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            <HiveAIWelcomeScreen />
          ) : (
            <div className="p-4 space-y-4">
              {messages.map((msg) => (
                <div key={msg.id} className="space-y-4">
                  <div className={cn('flex items-start gap-4 group', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                    {/* AVATAR REMOVED FROM HERE */}
                    <div className={cn('max-w-[85%] rounded-lg shadow-sm p-4', msg.role === 'user' ? 'bg-blue-600/80 text-white' : 'bg-zinc-800/80 text-zinc-100')}>
                      {msg.role === 'assistant' && <MessageTypeIndicator type={msg.type} model={msg.model} tokens={msg.tokens} />}
                      {/* TEXT SIZE DECREASED HERE */}
                      <div className="prose prose-invert prose-xs max-w-none">
                        <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
                          code: (props: any) => {
                            const { children, className, inline } = props;
                            return (
                              <CodeBlock className={className} inline={inline as boolean} onInsert={onInsertCode ? code => handleInsertCode(code) : undefined} onRun={onRunCode}>
                                {String(children).replace(/\n$/, '')}
                              </CodeBlock>
                            );
                          },
                        }}>
                          {msg.content}
                        </ReactMarkdown>
                      </div>
                    </div>
                    {msg.role === 'user' && (
                      <Avatar className="h-8 w-8 border border-zinc-700 bg-zinc-800 shrink-0">
                        <AvatarFallback className="bg-zinc-700 text-zinc-300">
                          <User className="h-4 w-4" />
                        </AvatarFallback>
                      </Avatar>
                    )}
                  </div>

                  {msg.role === 'assistant' && msg.suggestions && msg.suggestions.length > 0 && (
                      <div className="ml-12 space-y-2">
                          <div className="text-sm font-medium text-zinc-300 flex items-center gap-2">
                              <Sparkles className="h-4 w-4 text-purple-400" />
                              Smart Suggestions:
                          </div>
                          {msg.suggestions.map(suggestion => (
                              <CodeSuggestionCard key={suggestion.id} suggestion={suggestion} onInsert={() => handleInsertCode(suggestion.code, suggestion.fileName, suggestion.insertPosition)} onCopy={() => handleCopySuggestion(suggestion.code)} onRun={onRunCode} activeFileName={activeFileName} />
                          ))}
                      </div>
                  )}
                </div>
              ))}
                {isLoading && (
                    <div className="flex items-start gap-4 justify-start">
                        <div className="bg-zinc-800/80 p-4 rounded-lg flex items-center gap-3">
                            <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
                            <span className="text-sm text-zinc-300">Thinking...</span>
                        </div>
                    </div>
                )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* --- FILE ATTACHMENTS PREVIEW --- */}
        {attachments.length > 0 && (
          <div className="px-3 py-2 border-t border-zinc-800 bg-zinc-900/50">
            <div className="flex flex-wrap gap-2">
              {attachments.map((attachment) => (
                <div
                  key={attachment.id}
                  className="flex items-center gap-2 bg-zinc-800/70 rounded-lg px-3 py-2 text-xs"
                >
                  <FileText className="h-3 w-3 text-blue-400" />
                  <span className="text-zinc-300">{attachment.name}</span>
                  <span className="text-zinc-500">({formatFileSize(attachment.size)})</span>
                  <Badge variant="outline" className="text-xs bg-zinc-700/50 text-zinc-400 border-zinc-600">
                    {attachment.language}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeAttachment(attachment.id)}
                    className="h-5 w-5 p-0 text-zinc-500 hover:text-zinc-300"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* --- REDESIGNED INPUT AREA WITH PROPER ALIGNMENT --- */}
        <div className="p-3 border-t border-zinc-800 bg-zinc-950">
          <div className="relative">
            {/* Text Input - Full Width Container */}
            <Textarea
              ref={inputRef}
              placeholder="Provide instructions..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage(e as any);
                }
              }}
              disabled={isLoading || !isAIOnline}
              className="w-full bg-zinc-900 border-zinc-700/50 rounded-lg text-zinc-100 placeholder:text-zinc-500 resize-none min-h-[50px] max-h-[200px] pr-32"
              rows={1}
            />
            
            {/* Controls positioned inside the text box */}
            <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center gap-2">
              {/* File Attachment Button */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={triggerFileAttachment}
                    className="h-8 w-8 p-0 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50"
                    disabled={isLoading || !isAIOnline}
                  >
                    <Paperclip className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Attach workspace files</TooltipContent>
              </Tooltip>

              {/* Model Selection */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-8 px-2 text-xs text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50 border border-zinc-700/50"
                    disabled={isLoading || !isAIOnline}
                  >
                    <Brain className="h-3 w-3 mr-1" />
                    {selectedModel}
                    <ChevronDown className="h-3 w-3 ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => setSelectedModel('Gemini 2.5 Pro')}>
                    Gemini 2.5 Pro
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled className='line-through'>Claude 3 Sonnet</DropdownMenuItem>
                  <DropdownMenuItem disabled className='line-through'>GPT-4o</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Send Button */}
              <Button
                type="submit"
                onClick={handleSendMessage}
                disabled={!input.trim() || isLoading || !isAIOnline}
                className="h-8 w-8 p-0 hover:bg-blue-700 disabled:opacity-50 bg-blue-600 hover:bg-blue-700"
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>

        {/* File Picker Modal */}
        {showFilePicker && (
          <div 
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={() => setShowFilePicker(false)}
          >
            <div 
              className="bg-zinc-900 border border-zinc-700 rounded-lg p-6 w-96 max-h-96 overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-zinc-100">Attach Workspace File</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowFilePicker(false)}
                  className="h-8 w-8 p-0 text-zinc-400 hover:text-zinc-100"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {workspaceFiles.length > 0 ? (
                  workspaceFiles.map((file) => (
                    <div
                      key={file.path}
                      className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg hover:bg-zinc-800/70 cursor-pointer transition-colors"
                      onClick={() => attachWorkspaceFile(file.path)}
                    >
                      <div className="flex items-center gap-3">
                        <FileText className="h-4 w-4 text-blue-400" />
                        <div>
                          <div className="text-sm font-medium text-zinc-200">{file.name}</div>
                          <div className="text-xs text-zinc-500">{file.path}</div>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-xs bg-zinc-700/50 text-zinc-400 border-zinc-600">
                        {file.language}
                      </Badge>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-zinc-500">
                    <FileText className="h-12 w-12 mx-auto mb-3 text-zinc-600" />
                    <p>No workspace files available</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

      </div>
    </TooltipProvider>
  );
};

export default AIAssistant;