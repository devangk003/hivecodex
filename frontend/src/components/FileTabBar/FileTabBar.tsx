import React, { useRef, useEffect, useState } from 'react';
import { X, FileText, FileCode, Image, Database, File, ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useEditor } from '@/contexts/EditorContext';
import { getEditorLanguage } from '@/lib/editor-config';
import type { FileTab } from '@/types';

interface FileTabBarProps {
  roomId?: string;
  // Legacy props for backward compatibility
  tabs?: FileTab[];
  activeTabId?: string | null;
  onTabSelect?: (fileId: string) => void;
  onTabClose?: (fileId: string) => void;
}

const getFileIcon = (fileName: string) => {
  const extension = fileName.split('.').pop()?.toLowerCase();
  
  switch (extension) {
    case 'js':
    case 'jsx':
    case 'ts':
    case 'tsx':
      return FileCode;
    case 'html':
    case 'css':
    case 'scss':
    case 'less':
      return FileCode;
    case 'json':
    case 'xml':
    case 'yml':
    case 'yaml':
      return Database;
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'svg':
      return Image;
    case 'md':
    case 'txt':
      return FileText;
    default:
      return File;
  }
};

export const FileTabBar: React.FC<FileTabBarProps> = ({
  roomId,
  // Legacy props for backward compatibility
  tabs: legacyTabs,
  activeTabId,
  onTabSelect,
  onTabClose,
}) => {
  // Use EditorContext if available, otherwise fall back to legacy props
  let editorContext;
  try {
    editorContext = useEditor();
  } catch {
    // Not wrapped in EditorProvider, use legacy mode
    editorContext = null;
  }
  
  const isUsingContext = !!editorContext;
  
  // State management
  const tabs = isUsingContext ? editorContext.state.tabs : (legacyTabs || []);
  const activeTabIndex = isUsingContext ? editorContext.state.activeTabIndex : -1;
  const canScrollLeft = isUsingContext ? editorContext.state.canScrollLeft : false;
  const canScrollRight = isUsingContext ? editorContext.state.canScrollRight : false;
  
  // Context actions (only available when using context)
  const {
    closeTab,
    closeAllTabs,
    setActiveTab,
    duplicateTab,
    reorderTabs,
  } = editorContext || {};
  
  const tabsContainerRef = useRef<HTMLDivElement>(null);
  const [draggedTab, setDraggedTab] = useState<number | null>(null);
  const [dragOverTab, setDragOverTab] = useState<number | null>(null);

  // Update scroll state
  const updateScrollState = () => {
    if (tabsContainerRef.current && isUsingContext) {
      const container = tabsContainerRef.current;
      const newCanScrollLeft = container.scrollLeft > 0;
      const newCanScrollRight = 
        container.scrollLeft < container.scrollWidth - container.clientWidth - 1;
      
      // Dispatch scroll state update if needed
      if (editorContext && (canScrollLeft !== newCanScrollLeft || canScrollRight !== newCanScrollRight)) {
        editorContext.dispatch({
          type: 'SET_SCROLL_STATE',
          payload: { canScrollLeft: newCanScrollLeft, canScrollRight: newCanScrollRight }
        });
      }
    }
  };

  useEffect(() => {
    updateScrollState();
    const container = tabsContainerRef.current;
    if (container) {
      container.addEventListener('scroll', updateScrollState);
      return () => container.removeEventListener('scroll', updateScrollState);
    }
  }, [tabs]);

  // Scroll functions
  const scrollLeft = () => {
    if (tabsContainerRef.current) {
      tabsContainerRef.current.scrollBy({ left: -150, behavior: 'smooth' });
    }
  };

  const scrollRight = () => {
    if (tabsContainerRef.current) {
      tabsContainerRef.current.scrollBy({ left: 150, behavior: 'smooth' });
    }
  };

  // Handle tab close
  const handleCloseTab = (index: number, event: React.MouseEvent) => {
    event.stopPropagation();
    
    if (isUsingContext && closeTab) {
      closeTab(index);
    } else if (onTabClose && tabs[index]) {
      onTabClose(tabs[index].fileId);
    }
  };

  // Handle tab click
  const handleTabClick = (index: number) => {
    if (isUsingContext && setActiveTab) {
      setActiveTab(index);
    } else if (onTabSelect && tabs[index]) {
      onTabSelect(tabs[index].fileId);
    }
  };

  // Drag and drop handlers (only for context mode)
  const handleDragStart = (event: React.DragEvent, index: number) => {
    if (!isUsingContext) return;
    setDraggedTab(index);
    event.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (event: React.DragEvent, index: number) => {
    if (!isUsingContext) return;
    event.preventDefault();
    setDragOverTab(index);
  };

  const handleDragLeave = () => {
    if (!isUsingContext) return;
    setDragOverTab(null);
  };

  const handleDrop = (event: React.DragEvent, dropIndex: number) => {
    if (!isUsingContext) return;
    event.preventDefault();
    if (draggedTab !== null && draggedTab !== dropIndex && reorderTabs) {
      reorderTabs(draggedTab, dropIndex);
    }
    setDraggedTab(null);
    setDragOverTab(null);
  };

  // Get language badge color
  const getLanguageBadgeColor = (language: string) => {
    const colorMap: Record<string, string> = {
      javascript: 'bg-yellow-500/20 text-yellow-400',
      typescript: 'bg-blue-500/20 text-blue-400',
      html: 'bg-orange-500/20 text-orange-400',
      css: 'bg-purple-500/20 text-purple-400',
      json: 'bg-green-500/20 text-green-400',
      python: 'bg-green-600/20 text-green-300',
      markdown: 'bg-gray-500/20 text-gray-400',
    };
    return colorMap[language] || 'bg-gray-500/20 text-gray-400';
  };

  if (tabs.length === 0) {
    return null;
  }

  return (
    <div className="flex items-stretch bg-discord-editor border-b border-discord-border h-10">
      {/* Left scroll button */}
      {canScrollLeft && isUsingContext && (
        <Button
          variant="ghost"
          size="sm"
          className="h-full w-8 p-0 text-discord-muted hover:text-discord-text flex-shrink-0"
          onClick={scrollLeft}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
      )}

      {/* Tabs container */}
      <div
        ref={tabsContainerRef}
        className="flex-1 flex overflow-x-auto overflow-y-hidden h-full"
        style={{ 
          scrollbarWidth: 'none', 
          msOverflowStyle: 'none',
          WebkitOverflowScrolling: 'touch'
        }}
      >
        {tabs.map((tab, index) => {
          const Icon = getFileIcon(tab.name);
          const isActive = isUsingContext 
            ? index === activeTabIndex
            : tab.fileId === activeTabId;
          const language = getEditorLanguage(tab.name.split('.').pop() || '');
          
          return (
            <div
              key={tab.fileId}
              className={cn(
                'flex items-center min-w-[120px] max-w-[200px] h-full px-3 cursor-pointer flex-shrink-0',
                'border-r border-discord-border relative group',
                isActive
                  ? 'bg-discord-sidebar text-discord-text'
                  : 'bg-discord-editor text-discord-muted hover:bg-discord-sidebar-hover',
                dragOverTab === index && isUsingContext ? 'bg-blue-600/20' : ''
              )}
              onClick={() => handleTabClick(index)}
              draggable={isUsingContext}
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, index)}
            >
              {/* Active tab indicator */}
              {isActive && (
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-discord-primary" />
              )}

              {/* File icon */}
              <Icon className="w-3 h-3 flex-shrink-0 mr-2" />

              {/* Language badge (only in context mode) */}
              {isUsingContext && (
                <Badge
                  variant="secondary"
                  className={cn(
                    'h-4 text-xs mr-2 px-1.5 py-0 border-none font-mono',
                    getLanguageBadgeColor(language)
                  )}
                >
                  {language.slice(0, 2).toUpperCase()}
                </Badge>
              )}

              {/* File name */}
              <span className="flex-1 truncate text-sm font-medium" title={tab.name}>
                {tab.name}
              </span>

              {/* Modified indicator */}
              {tab.isModified && (
                <div className="w-2 h-2 rounded-full bg-discord-primary ml-2 flex-shrink-0" />
              )}

              {/* Close button */}
              <Button
                variant="ghost"
                size="sm"
                className="h-4 w-4 p-0 ml-2 opacity-0 group-hover:opacity-100 text-discord-muted hover:text-discord-text"
                onClick={(e) => handleCloseTab(index, e)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          );
        })}
      </div>

      {/* Right scroll button */}
      {canScrollRight && isUsingContext && (
        <Button
          variant="ghost"
          size="sm"
          className="h-full w-8 p-0 text-discord-muted hover:text-discord-text flex-shrink-0"
          onClick={scrollRight}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      )}

      {/* Tab actions menu (only in context mode) */}
      {isUsingContext && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-full w-8 p-0 ml-1 text-discord-muted hover:text-discord-text flex-shrink-0"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={closeAllTabs}>
              Close All Tabs
            </DropdownMenuItem>
            {activeTabIndex >= 0 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => duplicateTab?.(activeTabIndex)}>
                  Duplicate Tab
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => closeTab?.(activeTabIndex)}>
                  Close Current Tab
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
};
