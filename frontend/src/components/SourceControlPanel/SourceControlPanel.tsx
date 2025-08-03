import React, { useState, useCallback, useEffect } from 'react';
import { 
  GitBranch,
  GitCommit,
  GitPullRequest,
  Plus,
  Minus,
  MoreHorizontal,
  RefreshCw,
  Upload,
  Download,
  Check,
  X,
  FileText,
  ChevronRight,
  ChevronDown,
  Circle,
  Dot
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { toast } from 'sonner';

type ChangeType = 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked';

interface FileChange {
  id: string;
  path: string;
  type: ChangeType;
  staged: boolean;
  additions?: number;
  deletions?: number;
  oldPath?: string; // for renamed files
}

interface Commit {
  hash: string;
  message: string;
  author: string;
  date: Date;
  shortHash: string;
}

interface SourceControlPanelProps {
  roomId: string;
  onFileSelect?: (filePath: string) => void;
}

const getChangeIcon = (type: ChangeType) => {
  switch (type) {
    case 'modified':
      return <Circle className="w-3 h-3 text-yellow-400 fill-current" />;
    case 'added':
      return <Plus className="w-3 h-3 text-green-400" />;
    case 'deleted':
      return <Minus className="w-3 h-3 text-red-400" />;
    case 'renamed':
      return <FileText className="w-3 h-3 text-blue-400" />;
    case 'untracked':
      return <Dot className="w-3 h-3 text-green-400 fill-current" />;
    default:
      return <Circle className="w-3 h-3 text-discord-muted" />;
  }
};

const getChangeTypeLabel = (type: ChangeType) => {
  switch (type) {
    case 'modified':
      return 'M';
    case 'added':
      return 'A';
    case 'deleted':
      return 'D';
    case 'renamed':
      return 'R';
    case 'untracked':
      return 'U';
    default:
      return '?';
  }
};

const FileChangeItem: React.FC<{
  change: FileChange;
  onStage: (id: string) => void;
  onUnstage: (id: string) => void;
  onSelect: (path: string) => void;
}> = ({ change, onStage, onUnstage, onSelect }) => {
  const handleToggleStage = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (change.staged) {
      onUnstage(change.id);
    } else {
      onStage(change.id);
    }
  };

  return (
    <div
      className="flex items-center gap-2 px-3 py-1 hover:bg-discord-sidebar-hover cursor-pointer group"
      onClick={() => onSelect(change.path)}
    >
      <Button
        variant="ghost"
        size="sm"
        className="h-4 w-4 p-0 opacity-0 group-hover:opacity-100 hover:bg-discord-primary/20"
        onClick={handleToggleStage}
        title={change.staged ? 'Unstage changes' : 'Stage changes'}
      >
        {change.staged ? (
          <Minus className="h-3 w-3 text-red-400" />
        ) : (
          <Plus className="h-3 w-3 text-green-400" />
        )}
      </Button>
      
      {getChangeIcon(change.type)}
      
      <span className="text-xs text-discord-muted font-mono min-w-0 flex-shrink-0">
        {getChangeTypeLabel(change.type)}
      </span>
      
      <span className="text-sm text-discord-text truncate flex-1 min-w-0">
        {change.path}
      </span>
      
      {change.type === 'renamed' && change.oldPath && (
        <span className="text-xs text-discord-muted">
          ← {change.oldPath.split('/').pop()}
        </span>
      )}
    </div>
  );
};

const CommitItem: React.FC<{ commit: Commit }> = ({ commit }) => {
  return (
    <div className="px-3 py-2 hover:bg-discord-sidebar-hover cursor-pointer">
      <div className="flex items-start gap-2">
        <GitCommit className="w-4 h-4 text-discord-muted mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-sm text-discord-text font-medium leading-tight mb-1">
            {commit.message}
          </div>
          <div className="flex items-center gap-2 text-xs text-discord-muted">
            <span className="font-mono">{commit.shortHash}</span>
            <span>•</span>
            <span>{commit.author}</span>
            <span>•</span>
            <span>{commit.date.toLocaleDateString()}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export const SourceControlPanel: React.FC<SourceControlPanelProps> = ({
  roomId,
  onFileSelect,
}) => {
  const [changes, setChanges] = useState<FileChange[]>([]);
  const [commits, setCommits] = useState<Commit[]>([]);
  const [commitMessage, setCommitMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentBranch, setCurrentBranch] = useState('main');
  const [isCommitting, setIsCommitting] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    staged: true,
    changes: true,
    commits: false,
  });

  const loadGitStatus = useCallback(async () => {
    try {
      setIsLoading(true);
      
      // TODO: Implement actual git status API call
      // Mock data for now
      const mockChanges: FileChange[] = [
        {
          id: '1',
          path: 'src/components/App.tsx',
          type: 'modified',
          staged: false,
          additions: 5,
          deletions: 2,
        },
        {
          id: '2',
          path: 'src/utils/helpers.ts',
          type: 'added',
          staged: true,
          additions: 15,
          deletions: 0,
        },
        {
          id: '3',
          path: 'README.md',
          type: 'modified',
          staged: true,
          additions: 3,
          deletions: 1,
        },
        {
          id: '4',
          path: 'package.json',
          type: 'modified',
          staged: false,
          additions: 1,
          deletions: 0,
        },
        {
          id: '5',
          path: 'src/temp.js',
          type: 'untracked',
          staged: false,
        },
      ];

      const mockCommits: Commit[] = [
        {
          hash: 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0',
          shortHash: 'a1b2c3d',
          message: 'Add new component functionality',
          author: 'John Doe',
          date: new Date(Date.now() - 86400000), // 1 day ago
        },
        {
          hash: 'b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0a1',
          shortHash: 'b2c3d4e',
          message: 'Fix bug in user authentication',
          author: 'Jane Smith',
          date: new Date(Date.now() - 172800000), // 2 days ago
        },
        {
          hash: 'c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0a1b2',
          shortHash: 'c3d4e5f',
          message: 'Update dependencies and improve performance',
          author: 'Bob Johnson',
          date: new Date(Date.now() - 259200000), // 3 days ago
        },
      ];

      setChanges(mockChanges);
      setCommits(mockCommits);
    } catch (error) {
      console.error('Failed to load git status:', error);
      toast.error('Failed to load git status');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (roomId) {
      loadGitStatus();
    }
  }, [roomId, loadGitStatus]);

  const handleStageChange = (id: string) => {
    setChanges(prev => 
      prev.map(change => 
        change.id === id ? { ...change, staged: true } : change
      )
    );
  };

  const handleUnstageChange = (id: string) => {
    setChanges(prev => 
      prev.map(change => 
        change.id === id ? { ...change, staged: false } : change
      )
    );
  };

  const handleStageAll = () => {
    setChanges(prev => 
      prev.map(change => ({ ...change, staged: true }))
    );
  };

  const handleUnstageAll = () => {
    setChanges(prev => 
      prev.map(change => ({ ...change, staged: false }))
    );
  };

  const handleCommit = async () => {
    if (!commitMessage.trim()) {
      toast.error('Please enter a commit message');
      return;
    }

    const stagedChanges = changes.filter(change => change.staged);
    if (stagedChanges.length === 0) {
      toast.error('No staged changes to commit');
      return;
    }

    try {
      setIsCommitting(true);
      
      // TODO: Implement actual git commit API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Simulate successful commit
      const newCommit: Commit = {
        hash: Date.now().toString(),
        shortHash: Date.now().toString().slice(-7),
        message: commitMessage,
        author: 'Current User',
        date: new Date(),
      };

      setCommits(prev => [newCommit, ...prev]);
      setChanges(prev => prev.filter(change => !change.staged));
      setCommitMessage('');
      
      toast.success('Changes committed successfully');
    } catch (error) {
      console.error('Commit failed:', error);
      toast.error('Failed to commit changes');
    } finally {
      setIsCommitting(false);
    }
  };

  const handleFileSelect = (path: string) => {
    onFileSelect?.(path);
  };

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const stagedChanges = changes.filter(change => change.staged);
  const unstagedChanges = changes.filter(change => !change.staged);

  return (
    <div className="h-full bg-discord-sidebar flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-2 border-b border-discord-border">
        <span className="text-xs font-medium text-discord-text uppercase tracking-wide">
          Source Control
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 hover:bg-discord-sidebar-hover"
            onClick={loadGitStatus}
            title="Refresh"
          >
            <RefreshCw className="h-3 w-3" />
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

      {/* Branch Info */}
      <div className="flex items-center gap-2 p-2 border-b border-discord-border">
        <GitBranch className="w-4 h-4 text-discord-text" />
        <span className="text-sm text-discord-text font-medium">{currentBranch}</span>
        <div className="flex items-center gap-1 ml-auto">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs hover:bg-discord-sidebar-hover"
            title="Pull"
          >
            <Download className="h-3 w-3 mr-1" />
            Pull
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs hover:bg-discord-sidebar-hover"
            title="Push"
          >
            <Upload className="h-3 w-3 mr-1" />
            Push
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-20">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-discord-primary"></div>
          </div>
        ) : (
          <>
            {/* Commit Message */}
            {(stagedChanges.length > 0 || unstagedChanges.length > 0) && (
              <div className="p-3 border-b border-discord-border">
                <Textarea
                  placeholder="Message (press Ctrl+Enter to commit)"
                  value={commitMessage}
                  onChange={(e) => setCommitMessage(e.target.value)}
                  className="min-h-[60px] text-sm bg-discord-editor border-discord-border text-white placeholder:text-discord-muted resize-none"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && e.ctrlKey) {
                      handleCommit();
                    }
                  }}
                />
                <div className="flex items-center justify-between mt-2">
                  <Badge variant="secondary" className="text-xs bg-discord-primary/20 text-discord-primary">
                    {stagedChanges.length} staged
                  </Badge>
                  <Button
                    size="sm"
                    onClick={handleCommit}
                    disabled={!commitMessage.trim() || stagedChanges.length === 0 || isCommitting}
                    className="h-6 px-3 text-xs"
                  >
                    {isCommitting ? (
                      <>
                        <div className="animate-spin rounded-full h-3 w-3 border-b border-white mr-1"></div>
                        Committing...
                      </>
                    ) : (
                      <>
                        <Check className="h-3 w-3 mr-1" />
                        Commit
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}

            {/* Staged Changes */}
            {stagedChanges.length > 0 && (
              <Collapsible
                open={expandedSections.staged}
                onOpenChange={() => toggleSection('staged')}
              >
                <CollapsibleTrigger asChild>
                  <div className="flex items-center justify-between px-3 py-2 hover:bg-discord-sidebar-hover cursor-pointer">
                    <div className="flex items-center gap-2">
                      {expandedSections.staged ? (
                        <ChevronDown className="w-3 h-3 text-discord-text" />
                      ) : (
                        <ChevronRight className="w-3 h-3 text-discord-text" />
                      )}
                      <span className="text-xs font-medium text-discord-text uppercase tracking-wide">
                        Staged Changes
                      </span>
                      <Badge variant="secondary" className="h-4 text-xs bg-green-500/20 text-green-400">
                        {stagedChanges.length}
                      </Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-4 w-4 p-0 hover:bg-discord-primary/20"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleUnstageAll();
                      }}
                      title="Unstage All Changes"
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  {stagedChanges.map((change) => (
                    <FileChangeItem
                      key={change.id}
                      change={change}
                      onStage={handleStageChange}
                      onUnstage={handleUnstageChange}
                      onSelect={handleFileSelect}
                    />
                  ))}
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* Unstaged Changes */}
            {unstagedChanges.length > 0 && (
              <Collapsible
                open={expandedSections.changes}
                onOpenChange={() => toggleSection('changes')}
              >
                <CollapsibleTrigger asChild>
                  <div className="flex items-center justify-between px-3 py-2 hover:bg-discord-sidebar-hover cursor-pointer">
                    <div className="flex items-center gap-2">
                      {expandedSections.changes ? (
                        <ChevronDown className="w-3 h-3 text-discord-text" />
                      ) : (
                        <ChevronRight className="w-3 h-3 text-discord-text" />
                      )}
                      <span className="text-xs font-medium text-discord-text uppercase tracking-wide">
                        Changes
                      </span>
                      <Badge variant="secondary" className="h-4 text-xs bg-yellow-500/20 text-yellow-400">
                        {unstagedChanges.length}
                      </Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-4 w-4 p-0 hover:bg-discord-primary/20"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStageAll();
                      }}
                      title="Stage All Changes"
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  {unstagedChanges.map((change) => (
                    <FileChangeItem
                      key={change.id}
                      change={change}
                      onStage={handleStageChange}
                      onUnstage={handleUnstageChange}
                      onSelect={handleFileSelect}
                    />
                  ))}
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* No Changes */}
            {changes.length === 0 && (
              <div className="flex flex-col items-center justify-center h-32 text-discord-muted">
                <Check className="h-8 w-8 mb-2 opacity-50" />
                <span className="text-sm">No changes</span>
              </div>
            )}

            <Separator className="bg-discord-border" />

            {/* Recent Commits */}
            <Collapsible
              open={expandedSections.commits}
              onOpenChange={() => toggleSection('commits')}
            >
              <CollapsibleTrigger asChild>
                <div className="flex items-center gap-2 px-3 py-2 hover:bg-discord-sidebar-hover cursor-pointer">
                  {expandedSections.commits ? (
                    <ChevronDown className="w-3 h-3 text-discord-text" />
                  ) : (
                    <ChevronRight className="w-3 h-3 text-discord-text" />
                  )}
                  <span className="text-xs font-medium text-discord-text uppercase tracking-wide">
                    Recent Commits
                  </span>
                  <Badge variant="secondary" className="h-4 text-xs bg-discord-primary/20 text-discord-primary">
                    {commits.length}
                  </Badge>
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                {commits.map((commit) => (
                  <CommitItem key={commit.hash} commit={commit} />
                ))}
              </CollapsibleContent>
            </Collapsible>
          </>
        )}
      </div>
    </div>
  );
};
