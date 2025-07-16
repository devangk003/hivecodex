import { ChevronDown, ChevronRight, File, FileText, Folder, FolderOpen } from 'lucide-react';
import { useState } from 'react';

interface FileItem {
  name: string;
  type: 'file' | 'folder';
  children?: FileItem[];
  extension?: string;
}

const files: FileItem[] = [
  {
    name: 'Discord Bot',
    type: 'folder',
    children: [
      {
        name: 'cogs',
        type: 'folder',
        children: [
          { name: 'music.py', type: 'file', extension: 'py' },
          { name: 'moderation.py', type: 'file', extension: 'py' },
        ]
      },
      { name: 'bot.py', type: 'file', extension: 'py' },
      { name: '.env', type: 'file', extension: 'env' },
      { name: 'App.js', type: 'file', extension: 'js' },
      { name: 'routes.tsx', type: 'file', extension: 'tsx' },
      { name: 'server.js', type: 'file', extension: 'js' },
    ]
  }
];

const getFileIcon = (item: FileItem) => {
  if (item.type === 'folder') {
    return <Folder className="w-4 h-4 text-muted-foreground" />;
  }
  
  switch (item.extension) {
    case 'py':
      return <File className="w-4 h-4 text-blue-400" />;
    case 'js':
      return <File className="w-4 h-4 text-yellow-400" />;
    case 'tsx':
      return <File className="w-4 h-4 text-blue-300" />;
    case 'env':
      return <File className="w-4 h-4 text-green-400" />;
    default:
      return <FileText className="w-4 h-4 text-muted-foreground" />;
  }
};

const FileTreeItem = ({ item, depth = 0 }: { item: FileItem; depth?: number }) => {
  const [isOpen, setIsOpen] = useState(item.name === 'Discord Bot');
  
  return (
    <div>
      <div 
        className={`flex items-center gap-2 py-1 px-2 hover:bg-discord-sidebar-hover rounded-sm cursor-pointer text-sm transition-colors`}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
        onClick={() => item.type === 'folder' && setIsOpen(!isOpen)}
      >
        {item.type === 'folder' && (
          <div className="w-4 h-4 flex items-center justify-center">
            {isOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          </div>
        )}
        {getFileIcon(item)}
        <span className="text-foreground">{item.name}</span>
      </div>
      
      {item.type === 'folder' && isOpen && item.children && (
        <div>
          {item.children.map((child, index) => (
            <FileTreeItem key={index} item={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
};

export const FileSidebar = () => {
  return (
    <div className="w-64 bg-discord-sidebar border-r border-border h-screen overflow-y-auto">
      <div className="p-4 border-b border-border">
        <h2 className="text-sm font-semibold text-foreground">EXPLORER</h2>
      </div>
      
      <div className="p-2">
        {files.map((item, index) => (
          <FileTreeItem key={index} item={item} />
        ))}
      </div>
    </div>
  );
};