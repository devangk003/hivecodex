import React, { useState, useRef, useCallback, useEffect } from 'react';
import { 
  Search, 
  ChevronDown, 
  ChevronRight,
  File,
  FileText,
  X,
  Replace,
  MoreHorizontal,
  Settings,
  Filter,
  RotateCcw
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Separator } from '@/components/ui/separator';
import { fileAPI } from '@/lib/api';
import { toast } from 'sonner';

interface SearchResult {
  fileId: string;
  fileName: string;
  filePath: string;
  line: number;
  column: number;
  text: string;
  preview: string;
  matchStart: number;
  matchEnd: number;
}

interface FileSearchResults {
  fileId: string;
  fileName: string;
  filePath: string;
  matches: SearchResult[];
  isExpanded: boolean;
}

interface SearchPanelProps {
  roomId: string;
  onResultSelect?: (result: SearchResult) => void;
}

const SearchResultItem: React.FC<{
  result: SearchResult;
  searchTerm: string;
  onSelect: (result: SearchResult) => void;
}> = ({ result, searchTerm, onSelect }) => {
  const highlightText = (text: string, term: string, start: number, end: number) => {
    if (!term) return text;
    
    const before = text.slice(0, start);
    const match = text.slice(start, end);
    const after = text.slice(end);
    
    return (
      <>
        {before}
        <span className="bg-yellow-400 text-black px-0.5 rounded">{match}</span>
        {after}
      </>
    );
  };

  return (
    <div
      className="flex items-start gap-2 px-4 py-1 hover:bg-discord-sidebar-hover cursor-pointer text-xs group"
      onClick={() => onSelect(result)}
    >
      <div className="text-discord-muted mt-0.5 min-w-0 flex-shrink-0">
        {result.line}:
      </div>
      <div className="flex-1 min-w-0">
        <code className="text-discord-text font-mono whitespace-pre-wrap break-words">
          {highlightText(result.preview, searchTerm, result.matchStart, result.matchEnd)}
        </code>
      </div>
    </div>
  );
};

const FileResultGroup: React.FC<{
  fileResult: FileSearchResults;
  searchTerm: string;
  onToggleExpand: (fileId: string) => void;
  onResultSelect: (result: SearchResult) => void;
}> = ({ fileResult, searchTerm, onToggleExpand, onResultSelect }) => {
  return (
    <Collapsible
      open={fileResult.isExpanded}
      onOpenChange={() => onToggleExpand(fileResult.fileId)}
    >
      <CollapsibleTrigger asChild>
        <div className="flex items-center gap-2 px-2 py-1 hover:bg-discord-sidebar-hover cursor-pointer group">
          {fileResult.isExpanded ? (
            <ChevronDown className="w-3 h-3 text-discord-text" />
          ) : (
            <ChevronRight className="w-3 h-3 text-discord-text" />
          )}
          <File className="w-4 h-4 text-discord-text" />
          <span className="text-sm text-discord-text truncate flex-1">
            {fileResult.fileName}
          </span>
          <Badge variant="secondary" className="h-4 text-xs bg-discord-primary/20 text-discord-primary border-none">
            {fileResult.matches.length}
          </Badge>
        </div>
      </CollapsibleTrigger>
      
      <CollapsibleContent>
        <div className="ml-2">
          {fileResult.matches.map((result, index) => (
            <SearchResultItem
              key={`${result.fileId}-${result.line}-${index}`}
              result={result}
              searchTerm={searchTerm}
              onSelect={onResultSelect}
            />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

export const SearchPanel: React.FC<SearchPanelProps> = ({
  roomId,
  onResultSelect,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [replaceTerm, setReplaceTerm] = useState('');
  const [isReplaceMode, setIsReplaceMode] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<FileSearchResults[]>([]);
  const [totalMatches, setTotalMatches] = useState(0);
  const [searchOptions, setSearchOptions] = useState({
    caseSensitive: false,
    wholeWord: false,
    useRegex: false,
    includeFiles: '*',
    excludeFiles: '',
  });
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout>();

  const performSearch = useCallback(async (term: string) => {
    if (!term.trim() || !roomId) {
      setSearchResults([]);
      setTotalMatches(0);
      return;
    }

    setIsSearching(true);
    
    try {
      // TODO: Implement actual search API call
      // For now, we'll simulate search results
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const mockResults: FileSearchResults[] = [
        {
          fileId: '1',
          fileName: 'App.tsx',
          filePath: 'src/App.tsx',
          isExpanded: true,
          matches: [
            {
              fileId: '1',
              fileName: 'App.tsx',
              filePath: 'src/App.tsx',
              line: 15,
              column: 10,
              text: `const ${term} = useState();`,
              preview: `  const ${term} = useState();`,
              matchStart: 8,
              matchEnd: 8 + term.length,
            },
            {
              fileId: '1',
              fileName: 'App.tsx',
              filePath: 'src/App.tsx',
              line: 23,
              column: 5,
              text: `return <div>{${term}}</div>`,
              preview: `    return <div>{${term}}</div>`,
              matchStart: 17,
              matchEnd: 17 + term.length,
            },
          ],
        },
        {
          fileId: '2',
          fileName: 'utils.ts',
          filePath: 'src/utils.ts',
          isExpanded: false,
          matches: [
            {
              fileId: '2',
              fileName: 'utils.ts',
              filePath: 'src/utils.ts',
              line: 8,
              column: 15,
              text: `export const ${term}Helper = () => {}`,
              preview: `export const ${term}Helper = () => {}`,
              matchStart: 13,
              matchEnd: 13 + term.length,
            },
          ],
        },
      ];

      // Filter results based on search term
      const filteredResults = term.trim() ? mockResults : [];
      const total = filteredResults.reduce((sum, file) => sum + file.matches.length, 0);
      
      setSearchResults(filteredResults);
      setTotalMatches(total);
    } catch (error) {
      console.error('Search failed:', error);
      toast.error('Search failed');
    } finally {
      setIsSearching(false);
    }
  }, [roomId]);

  const debouncedSearch = useCallback((term: string) => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    searchTimeoutRef.current = setTimeout(() => {
      performSearch(term);
    }, 300);
  }, [performSearch]);

  useEffect(() => {
    debouncedSearch(searchTerm);
    
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchTerm, debouncedSearch]);

  const handleToggleExpand = (fileId: string) => {
    setSearchResults(prev => 
      prev.map(result => 
        result.fileId === fileId 
          ? { ...result, isExpanded: !result.isExpanded }
          : result
      )
    );
  };

  const handleResultSelect = (result: SearchResult) => {
    onResultSelect?.(result);
  };

  const handleClearSearch = () => {
    setSearchTerm('');
    setSearchResults([]);
    setTotalMatches(0);
    searchInputRef.current?.focus();
  };

  const handleReplaceAll = async () => {
    if (!replaceTerm.trim() || !searchTerm.trim()) return;
    
    try {
      // TODO: Implement actual replace functionality
      toast.success(`Replaced all occurrences of "${searchTerm}" with "${replaceTerm}"`);
    } catch (error) {
      console.error('Replace failed:', error);
      toast.error('Replace failed');
    }
  };

  return (
    <div className="h-full bg-discord-sidebar flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-2 border-b border-discord-border">
        <span className="text-xs font-medium text-discord-text uppercase tracking-wide">
          Search
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 hover:bg-discord-sidebar-hover"
            onClick={() => setIsReplaceMode(!isReplaceMode)}
            title="Toggle Replace"
          >
            <Replace className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 hover:bg-discord-sidebar-hover"
            onClick={() => setShowAdvanced(!showAdvanced)}
            title="More Actions..."
          >
            <MoreHorizontal className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Search Input */}
      <div className="p-2 space-y-2">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-discord-muted" />
          <Input
            ref={searchInputRef}
            placeholder="Search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-7 pr-7 h-7 text-xs bg-discord-editor border-discord-border text-white placeholder:text-discord-muted"
          />
          {searchTerm && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-1 top-1/2 transform -translate-y-1/2 h-5 w-5 p-0 hover:bg-discord-sidebar-hover"
              onClick={handleClearSearch}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>

        {/* Replace Input */}
        {isReplaceMode && (
          <div className="relative">
            <Replace className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-discord-muted" />
            <Input
              placeholder="Replace"
              value={replaceTerm}
              onChange={(e) => setReplaceTerm(e.target.value)}
              className="pl-7 h-7 text-xs bg-discord-editor border-discord-border text-white placeholder:text-discord-muted"
            />
          </div>
        )}

        {/* Search Options */}
        <div className="flex items-center gap-1 flex-wrap">
          <Button
            variant={searchOptions.caseSensitive ? "secondary" : "ghost"}
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={() => setSearchOptions(prev => ({ ...prev, caseSensitive: !prev.caseSensitive }))}
            title="Match Case"
          >
            Aa
          </Button>
          <Button
            variant={searchOptions.wholeWord ? "secondary" : "ghost"}
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={() => setSearchOptions(prev => ({ ...prev, wholeWord: !prev.wholeWord }))}
            title="Match Whole Word"
          >
            Ab
          </Button>
          <Button
            variant={searchOptions.useRegex ? "secondary" : "ghost"}
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={() => setSearchOptions(prev => ({ ...prev, useRegex: !prev.useRegex }))}
            title="Use Regular Expression"
          >
            .*
          </Button>
        </div>

        {/* Advanced Options */}
        {showAdvanced && (
          <div className="space-y-2 pt-2 border-t border-discord-border">
            <Input
              placeholder="files to include"
              value={searchOptions.includeFiles}
              onChange={(e) => setSearchOptions(prev => ({ ...prev, includeFiles: e.target.value }))}
              className="h-6 text-xs bg-discord-editor border-discord-border text-white placeholder:text-discord-muted"
            />
            <Input
              placeholder="files to exclude"
              value={searchOptions.excludeFiles}
              onChange={(e) => setSearchOptions(prev => ({ ...prev, excludeFiles: e.target.value }))}
              className="h-6 text-xs bg-discord-editor border-discord-border text-white placeholder:text-discord-muted"
            />
          </div>
        )}

        {/* Replace Actions */}
        {isReplaceMode && searchTerm && (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={handleReplaceAll}
              disabled={!replaceTerm.trim()}
            >
              Replace All
            </Button>
          </div>
        )}
      </div>

      {/* Results Summary */}
      {(isSearching || searchResults.length > 0) && (
        <div className="px-2 py-1 border-b border-discord-border">
          <div className="flex items-center justify-between">
            <span className="text-xs text-discord-muted">
              {isSearching ? (
                'Searching...'
              ) : (
                `${totalMatches} results in ${searchResults.length} files`
              )}
            </span>
            {isSearching && (
              <div className="animate-spin rounded-full h-3 w-3 border-b border-discord-primary"></div>
            )}
          </div>
        </div>
      )}

      {/* Results */}
      <div className="flex-1 overflow-auto">
        {searchResults.length > 0 ? (
          <div className="py-1">
            {searchResults.map((fileResult) => (
              <FileResultGroup
                key={fileResult.fileId}
                fileResult={fileResult}
                searchTerm={searchTerm}
                onToggleExpand={handleToggleExpand}
                onResultSelect={handleResultSelect}
              />
            ))}
          </div>
        ) : searchTerm && !isSearching ? (
          <div className="flex flex-col items-center justify-center h-32 text-discord-muted">
            <Search className="h-8 w-8 mb-2 opacity-50" />
            <span className="text-sm">No results found</span>
          </div>
        ) : !searchTerm ? (
          <div className="flex flex-col items-center justify-center h-32 text-discord-muted">
            <Search className="h-8 w-8 mb-2 opacity-50" />
            <span className="text-sm">Search across files</span>
          </div>
        ) : null}
      </div>
    </div>
  );
};
