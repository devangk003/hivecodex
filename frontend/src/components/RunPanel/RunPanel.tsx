import React, { useState, useCallback, useRef, useEffect } from 'react';
import { 
  Play,
  Square,
  RotateCcw,
  Settings,
  ChevronRight,
  ChevronDown,
  Terminal,
  FileText,
  AlertCircle,
  CheckCircle,
  Clock,
  MoreHorizontal,
  Trash2,
  Download
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';

type ExecutionStatus = 'idle' | 'running' | 'completed' | 'error' | 'timeout';

interface ExecutionResult {
  id: string;
  fileName: string;
  language: string;
  status: ExecutionStatus;
  output?: string;
  error?: string;
  executionTime?: number;
  timestamp: Date;
  exitCode?: number;
}

interface RunConfiguration {
  id: string;
  name: string;
  language: string;
  command: string;
  args?: string[];
  workingDirectory?: string;
}

interface RunPanelProps {
  roomId: string;
  currentFile?: {
    name: string;
    content: string;
    language: string;
  };
}

const SUPPORTED_LANGUAGES = [
  { value: 'javascript', label: 'JavaScript (Node.js)', ext: 'js' },
  { value: 'typescript', label: 'TypeScript', ext: 'ts' },
  { value: 'python', label: 'Python', ext: 'py' },
  { value: 'java', label: 'Java', ext: 'java' },
  { value: 'cpp', label: 'C++', ext: 'cpp' },
  { value: 'c', label: 'C', ext: 'c' },
  { value: 'csharp', label: 'C#', ext: 'cs' },
  { value: 'php', label: 'PHP', ext: 'php' },
  { value: 'ruby', label: 'Ruby', ext: 'rb' },
  { value: 'go', label: 'Go', ext: 'go' },
  { value: 'rust', label: 'Rust', ext: 'rs' },
];

const getStatusIcon = (status: ExecutionStatus) => {
  switch (status) {
    case 'running':
      return <div className="animate-spin rounded-full h-3 w-3 border-b border-yellow-400" />;
    case 'completed':
      return <CheckCircle className="w-3 h-3 text-green-400" />;
    case 'error':
      return <AlertCircle className="w-3 h-3 text-red-400" />;
    case 'timeout':
      return <Clock className="w-3 h-3 text-orange-400" />;
    default:
      return <Terminal className="w-3 h-3 text-discord-muted" />;
  }
};

const getStatusColor = (status: ExecutionStatus) => {
  switch (status) {
    case 'running':
      return 'text-yellow-400';
    case 'completed':
      return 'text-green-400';
    case 'error':
      return 'text-red-400';
    case 'timeout':
      return 'text-orange-400';
    default:
      return 'text-discord-muted';
  }
};

const ExecutionResultItem: React.FC<{
  result: ExecutionResult;
  onClear: (id: string) => void;
  isExpanded: boolean;
  onToggleExpand: (id: string) => void;
}> = ({ result, onClear, isExpanded, onToggleExpand }) => {
  return (
    <div className="border-b border-discord-border last:border-b-0">
      <div
        className="flex items-center gap-2 px-3 py-2 hover:bg-discord-sidebar-hover cursor-pointer"
        onClick={() => onToggleExpand(result.id)}
      >
        {isExpanded ? (
          <ChevronDown className="w-3 h-3 text-discord-text" />
        ) : (
          <ChevronRight className="w-3 h-3 text-discord-text" />
        )}
        
        {getStatusIcon(result.status)}
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm text-discord-text truncate">
              {result.fileName}
            </span>
            <Badge 
              variant="secondary" 
              className={cn(
                "h-4 text-xs border-none",
                result.status === 'completed' && "bg-green-500/20 text-green-400",
                result.status === 'error' && "bg-red-500/20 text-red-400",
                result.status === 'running' && "bg-yellow-500/20 text-yellow-400",
                result.status === 'timeout' && "bg-orange-500/20 text-orange-400",
                result.status === 'idle' && "bg-discord-primary/20 text-discord-primary"
              )}
            >
              {result.status}
            </Badge>
          </div>
          <div className="text-xs text-discord-muted">
            {result.executionTime ? `${result.executionTime}ms` : ''} • {result.timestamp.toLocaleTimeString()}
          </div>
        </div>
        
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 hover:bg-red-500/20"
          onClick={(e) => {
            e.stopPropagation();
            onClear(result.id);
          }}
          title="Clear Result"
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
      
      {isExpanded && (
        <div className="px-3 pb-3">
          {result.output && (
            <div className="mb-2">
              <div className="text-xs text-discord-muted mb-1">Output:</div>
              <ScrollArea className="h-32 bg-discord-editor rounded border border-discord-border">
                <pre className="p-2 text-xs text-green-400 font-mono whitespace-pre-wrap">
                  {result.output}
                </pre>
              </ScrollArea>
            </div>
          )}
          
          {result.error && (
            <div className="mb-2">
              <div className="text-xs text-discord-muted mb-1">Error:</div>
              <ScrollArea className="h-32 bg-discord-editor rounded border border-discord-border">
                <pre className="p-2 text-xs text-red-400 font-mono whitespace-pre-wrap">
                  {result.error}
                </pre>
              </ScrollArea>
            </div>
          )}
          
          <div className="flex items-center gap-2 text-xs text-discord-muted">
            {result.exitCode !== undefined && (
              <span>Exit code: {result.exitCode}</span>
            )}
            {result.executionTime && (
              <span>Execution time: {result.executionTime}ms</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export const RunPanel: React.FC<RunPanelProps> = ({
  roomId,
  currentFile,
}) => {
  const [executionResults, setExecutionResults] = useState<ExecutionResult[]>([]);
  const [selectedLanguage, setSelectedLanguage] = useState<string>('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [expandedResults, setExpandedResults] = useState<Set<string>>(new Set());
  const [expandedSections, setExpandedSections] = useState({
    quickRun: true,
    configurations: false,
    results: true,
  });
  const [runConfigurations] = useState<RunConfiguration[]>([
    {
      id: '1',
      name: 'Node.js App',
      language: 'javascript',
      command: 'node',
      args: ['index.js'],
    },
    {
      id: '2',
      name: 'Python Script',
      language: 'python',
      command: 'python',
      args: ['main.py'],
    },
  ]);

  const abortControllerRef = useRef<AbortController | null>(null);

  // Auto-detect language from current file
  useEffect(() => {
    if (currentFile?.language && !selectedLanguage) {
      const language = SUPPORTED_LANGUAGES.find(
        lang => lang.value === currentFile.language || lang.ext === currentFile.name.split('.').pop()
      );
      if (language) {
        setSelectedLanguage(language.value);
      }
    }
  }, [currentFile, selectedLanguage]);

  const executeCode = useCallback(async (code: string, language: string, fileName: string) => {
    if (!code.trim()) {
      toast.error('No code to execute');
      return;
    }

    const executionId = Date.now().toString();
    const startTime = Date.now();

    // Create initial result
    const initialResult: ExecutionResult = {
      id: executionId,
      fileName,
      language,
      status: 'running',
      timestamp: new Date(),
    };

    setExecutionResults(prev => [initialResult, ...prev]);
    setExpandedResults(prev => new Set([...prev, executionId]));
    setIsExecuting(true);

    // Create abort controller for this execution
    abortControllerRef.current = new AbortController();

    try {
      // TODO: Replace with actual Judge0 CE API integration
      // For now, simulate code execution
      const response = await fetch('/api/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          source_code: code,
          language_id: getLanguageId(language),
          stdin: '',
        }),
        signal: abortControllerRef.current.signal,
      }).catch(() => {
        // Simulate execution for demo purposes
        return new Promise<Response>((resolve) => {
          setTimeout(() => {
            const mockResponse = {
              ok: true,
              json: () => Promise.resolve({
                stdout: `Hello from ${language}!\nExecution completed successfully.`,
                stderr: null,
                exit_code: 0,
                time: Math.random() * 1000 + 100,
              }),
            } as Response;
            resolve(mockResponse);
          }, 1000 + Math.random() * 2000);
        });
      });

      if (!response.ok) {
        throw new Error('Execution failed');
      }

      const result = await response.json();
      const executionTime = Date.now() - startTime;

      // Update result with execution output
      setExecutionResults(prev =>
        prev.map(r =>
          r.id === executionId
            ? {
                ...r,
                status: result.exit_code === 0 ? 'completed' : 'error',
                output: result.stdout || undefined,
                error: result.stderr || undefined,
                executionTime,
                exitCode: result.exit_code,
              }
            : r
        )
      );

      if (result.exit_code === 0) {
        toast.success('Code executed successfully');
      } else {
        toast.error('Code execution failed');
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        // Execution was cancelled
        setExecutionResults(prev =>
          prev.map(r =>
            r.id === executionId
              ? {
                  ...r,
                  status: 'error',
                  error: 'Execution cancelled',
                  executionTime: Date.now() - startTime,
                }
              : r
          )
        );
        toast.info('Execution cancelled');
      } else {
        console.error('Execution error:', error);
        setExecutionResults(prev =>
          prev.map(r =>
            r.id === executionId
              ? {
                  ...r,
                  status: 'error',
                  error: error.message || 'Unknown execution error',
                  executionTime: Date.now() - startTime,
                }
              : r
          )
        );
        toast.error('Execution failed');
      }
    } finally {
      setIsExecuting(false);
      abortControllerRef.current = null;
    }
  }, []);

  const getLanguageId = (language: string): number => {
    // Judge0 CE language IDs
    const languageMap: { [key: string]: number } = {
      javascript: 63, // Node.js
      typescript: 74, // TypeScript
      python: 71, // Python 3
      java: 62, // Java
      cpp: 54, // C++
      c: 50, // C
      csharp: 51, // C#
      php: 68, // PHP
      ruby: 72, // Ruby
      go: 60, // Go
      rust: 73, // Rust
    };
    return languageMap[language] || 63; // Default to Node.js
  };

  const handleQuickRun = () => {
    if (!currentFile) {
      toast.error('No file selected');
      return;
    }

    if (!selectedLanguage) {
      toast.error('Please select a language');
      return;
    }

    executeCode(currentFile.content, selectedLanguage, currentFile.name);
  };

  const handleStopExecution = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const handleClearResult = (id: string) => {
    setExecutionResults(prev => prev.filter(result => result.id !== id));
    setExpandedResults(prev => {
      const newSet = new Set(prev);
      newSet.delete(id);
      return newSet;
    });
  };

  const handleClearAllResults = () => {
    setExecutionResults([]);
    setExpandedResults(new Set());
  };

  const handleToggleResultExpand = (id: string) => {
    setExpandedResults(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  return (
    <div className="h-full bg-discord-sidebar flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-2 border-b border-discord-border">
        <span className="text-xs font-medium text-discord-text uppercase tracking-wide">
          Run & Debug
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 hover:bg-discord-sidebar-hover"
            title="Settings"
          >
            <Settings className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 hover:bg-discord-sidebar-hover"
            title="More Actions..."
          >
            <MoreHorizontal className="h-3 w-3" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {/* Quick Run Section */}
        <Collapsible
          open={expandedSections.quickRun}
          onOpenChange={() => toggleSection('quickRun')}
        >
          <CollapsibleTrigger asChild>
            <div className="flex items-center gap-2 px-3 py-2 hover:bg-discord-sidebar-hover cursor-pointer">
              {expandedSections.quickRun ? (
                <ChevronDown className="w-3 h-3 text-discord-text" />
              ) : (
                <ChevronRight className="w-3 h-3 text-discord-text" />
              )}
              <span className="text-xs font-medium text-discord-text uppercase tracking-wide">
                Quick Run
              </span>
            </div>
          </CollapsibleTrigger>
          
          <CollapsibleContent className="px-3 pb-3">
            <div className="space-y-3">
              <div>
                <label className="text-xs text-discord-muted mb-1 block">Language</label>
                <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
                  <SelectTrigger className="h-7 text-xs bg-discord-editor border-discord-border">
                    <SelectValue placeholder="Select language..." />
                  </SelectTrigger>
                  <SelectContent className="bg-discord-sidebar border-discord-border">
                    {SUPPORTED_LANGUAGES.map((lang) => (
                      <SelectItem key={lang.value} value={lang.value} className="text-xs">
                        {lang.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={handleQuickRun}
                  disabled={!currentFile || !selectedLanguage || isExecuting}
                  className="flex-1 h-7 text-xs"
                >
                  {isExecuting ? (
                    <>
                      <div className="animate-spin rounded-full h-3 w-3 border-b border-white mr-1" />
                      Running...
                    </>
                  ) : (
                    <>
                      <Play className="h-3 w-3 mr-1" />
                      Run
                    </>
                  )}
                </Button>
                
                {isExecuting && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleStopExecution}
                    className="h-7 w-7 p-0"
                    title="Stop Execution"
                  >
                    <Square className="h-3 w-3" />
                  </Button>
                )}
              </div>

              {currentFile && (
                <div className="text-xs text-discord-muted">
                  Current file: {currentFile.name}
                </div>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>

        <Separator className="bg-discord-border" />

        {/* Run Configurations */}
        <Collapsible
          open={expandedSections.configurations}
          onOpenChange={() => toggleSection('configurations')}
        >
          <CollapsibleTrigger asChild>
            <div className="flex items-center gap-2 px-3 py-2 hover:bg-discord-sidebar-hover cursor-pointer">
              {expandedSections.configurations ? (
                <ChevronDown className="w-3 h-3 text-discord-text" />
              ) : (
                <ChevronRight className="w-3 h-3 text-discord-text" />
              )}
              <span className="text-xs font-medium text-discord-text uppercase tracking-wide">
                Configurations
              </span>
              <Badge variant="secondary" className="h-4 text-xs bg-discord-primary/20 text-discord-primary">
                {runConfigurations.length}
              </Badge>
            </div>
          </CollapsibleTrigger>
          
          <CollapsibleContent>
            {runConfigurations.map((config) => (
              <div
                key={config.id}
                className="flex items-center gap-2 px-6 py-1 hover:bg-discord-sidebar-hover cursor-pointer"
              >
                <Play className="w-3 h-3 text-discord-text" />
                <span className="text-sm text-discord-text flex-1">{config.name}</span>
                <Badge variant="outline" className="h-4 text-xs">
                  {config.language}
                </Badge>
              </div>
            ))}
          </CollapsibleContent>
        </Collapsible>

        <Separator className="bg-discord-border" />

        {/* Execution Results */}
        <Collapsible
          open={expandedSections.results}
          onOpenChange={() => toggleSection('results')}
        >
          <CollapsibleTrigger asChild>
            <div className="flex items-center justify-between px-3 py-2 hover:bg-discord-sidebar-hover cursor-pointer">
              <div className="flex items-center gap-2">
                {expandedSections.results ? (
                  <ChevronDown className="w-3 h-3 text-discord-text" />
                ) : (
                  <ChevronRight className="w-3 h-3 text-discord-text" />
                )}
                <span className="text-xs font-medium text-discord-text uppercase tracking-wide">
                  Results
                </span>
                <Badge variant="secondary" className="h-4 text-xs bg-discord-primary/20 text-discord-primary">
                  {executionResults.length}
                </Badge>
              </div>
              
              {executionResults.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-4 w-4 p-0 hover:bg-red-500/20"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleClearAllResults();
                  }}
                  title="Clear All Results"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </div>
          </CollapsibleTrigger>
          
          <CollapsibleContent>
            {executionResults.length > 0 ? (
              <div>
                {executionResults.map((result) => (
                  <ExecutionResultItem
                    key={result.id}
                    result={result}
                    onClear={handleClearResult}
                    isExpanded={expandedResults.has(result.id)}
                    onToggleExpand={handleToggleResultExpand}
                  />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-32 text-discord-muted">
                <Terminal className="h-8 w-8 mb-2 opacity-50" />
                <span className="text-sm">No execution results</span>
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>
      </div>
    </div>
  );
};
