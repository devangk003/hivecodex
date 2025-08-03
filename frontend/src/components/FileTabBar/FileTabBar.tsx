import React from 'react';
import { X, FileText, FileCode, Image, Database, File } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { FileTab } from '@/types';

interface FileTabBarProps {
  tabs: FileTab[];
  activeTabId: string | null;
  onTabSelect: (fileId: string) => void;
  onTabClose: (fileId: string) => void;
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
  tabs,
  activeTabId,
  onTabSelect,
  onTabClose,
}) => {
  if (tabs.length === 0) {
    return null;
  }

  return (
    <div className="flex h-8 bg-discord-editor border-b border-discord-border overflow-x-auto">
      {tabs.map((tab) => {
        const Icon = getFileIcon(tab.name);
        const isActive = tab.fileId === activeTabId;
        
        return (
          <div
            key={tab.fileId}
            className={cn(
              'flex items-center gap-2 px-3 py-1 cursor-pointer border-r border-discord-border group min-w-0 flex-shrink-0',
              isActive
                ? 'bg-discord-sidebar text-discord-text'
                : 'bg-discord-editor text-discord-muted hover:bg-discord-sidebar-hover'
            )}
            onClick={() => onTabSelect(tab.fileId)}
          >
            <Icon className="w-3 h-3 flex-shrink-0" />
            <span className="text-xs truncate max-w-[120px]" title={tab.name}>
              {tab.name}
            </span>
            {tab.isModified && (
              <div className="w-1.5 h-1.5 bg-discord-primary rounded-full flex-shrink-0" />
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-4 w-4 p-0 ml-1 opacity-0 group-hover:opacity-100 hover:bg-discord-primary/20 flex-shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                onTabClose(tab.fileId);
              }}
            >
              <X className="h-2.5 w-2.5" />
            </Button>
          </div>
        );
      })}
    </div>
  );
};
