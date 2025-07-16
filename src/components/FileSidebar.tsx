import { ChevronDown, ChevronRight, File, FileText, Folder, FolderOpen, Mic, MicOff, Headphones, Settings, Upload } from 'lucide-react';
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
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);

  return (
    <div className="w-64 bg-discord-sidebar border-r border-border h-screen flex flex-col">
      <div className="p-4 border-b border-border">
        <h2 className="text-sm font-semibold text-foreground">EXPLORER</h2>
      </div>
      
      <div className="flex-1 p-2 overflow-y-auto">
        {files.map((item, index) => (
          <FileTreeItem key={index} item={item} />
        ))}
        
        {/* Drag and Drop Area */}
        <div className="mt-4 border-2 border-dashed border-border rounded-lg p-4 text-center">
          <div className="w-12 h-12 mx-auto mb-2 border-2 border-border rounded-lg flex items-center justify-center">
            <Upload className="w-6 h-6 text-muted-foreground" />
          </div>
          <p className="text-xs text-foreground font-medium mb-1">Drag and Drop Files to</p>
          <p className="text-xs text-foreground font-medium">Upload in Room</p>
        </div>
      </div>
      
      {/* Audio/Video Controls */}
      <div className="p-2 border-t border-border bg-discord-sidebar">
        <div className="flex items-center gap-2 p-2 rounded hover:bg-discord-sidebar-hover transition-colors">
          <div className="flex items-center gap-2 flex-1">
            <img 
              src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=32&h=32&fit=crop&crop=face" 
              alt="Devang"
              className="w-8 h-8 rounded-full"
            />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-foreground truncate">Devang</div>
              <div className="text-xs text-muted-foreground">#1001</div>
            </div>
          </div>
          
          <div className="flex items-center gap-1">
            <button 
              className={`p-1 rounded hover:bg-discord-sidebar-hover transition-colors ${
                isMuted ? 'bg-red-500' : ''
              }`}
              onClick={() => setIsMuted(!isMuted)}
            >
              {isMuted ? (
                <MicOff className="w-4 h-4 text-white" />
              ) : (
                <Mic className="w-4 h-4 text-muted-foreground" />
              )}
            </button>
            
            <button 
              className={`p-1 rounded hover:bg-discord-sidebar-hover transition-colors ${
                isDeafened ? 'bg-red-500' : ''
              }`}
              onClick={() => setIsDeafened(!isDeafened)}
            >
              <Headphones className={`w-4 h-4 ${isDeafened ? 'text-white' : 'text-muted-foreground'}`} />
            </button>
            
            <button className="p-1 rounded hover:bg-discord-sidebar-hover transition-colors">
              <Settings className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};