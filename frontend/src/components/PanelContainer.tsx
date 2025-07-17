import React from 'react';
import { ExplorerPanel } from './ExplorerPanel';
import { SearchPanel } from './SearchPanel';
import { GitPanel } from './GitPanel';
import { ExtensionsPanel } from './ExtensionsPanel';

interface FileTreeItem {
  id: string;
  name: string;
  type: 'file' | 'folder';
  path: string;
  size?: number;
  content?: string;
  extension?: string;
  children?: FileTreeItem[];
  isExpanded?: boolean;
  isSelected?: boolean;
  lastModified?: Date;
  fileId?: string;
  isCorrupted?: boolean;
}

interface PanelContainerProps {
  activeView: string;
  isOpen: boolean;
  roomId: string;
  onFileSelect: (file: FileTreeItem) => void;
}

export const PanelContainer: React.FC<PanelContainerProps> = ({
  activeView,
  isOpen,
  roomId,
  onFileSelect
}) => {
  const renderPanel = () => {
    switch (activeView) {
      case 'files':
        return (
          <ExplorerPanel
            onFileSelect={onFileSelect}
            roomId={roomId}
            isOpen={isOpen}
          />
        );
      case 'search':
        return (
          <SearchPanel
            isOpen={isOpen}
            roomId={roomId}
          />
        );
      case 'git':
        return (
          <GitPanel
            isOpen={isOpen}
            roomId={roomId}
          />
        );
      case 'extensions':
        return (
          <ExtensionsPanel
            isOpen={isOpen}
            roomId={roomId}
          />
        );
      default:
        return (
          <ExplorerPanel
            onFileSelect={onFileSelect}
            roomId={roomId}
            isOpen={isOpen}
          />
        );
    }
  };

  if (!isOpen) return null;

  return (
    <div className="h-full bg-discord-sidebar border-r border-discord-border">
      {renderPanel()}
    </div>
  );
};
