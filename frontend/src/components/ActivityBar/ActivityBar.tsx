import React from 'react';
import { 
  Files, 
  Search, 
  GitBranch, 
  Play, 
  Settings,
  User
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type ActivityBarPanel = 
  | 'explorer' 
  | 'search' 
  | 'sourceControl' 
  | 'run' 
  | 'settings';

interface ActivityBarProps {
  activePanel: ActivityBarPanel;
  onPanelChange: (panel: ActivityBarPanel) => void;
  roomId?: string;
}

export const ActivityBar: React.FC<ActivityBarProps> = ({
  activePanel,
  onPanelChange,
  roomId,
}) => {
  const activityItems = [
    {
      id: 'explorer' as ActivityBarPanel,
      icon: Files,
      label: 'Explorer',
      shortcut: 'Ctrl+Shift+E',
    },
    {
      id: 'search' as ActivityBarPanel,
      icon: Search,
      label: 'Search',
      shortcut: 'Ctrl+Shift+F',
    },
    {
      id: 'sourceControl' as ActivityBarPanel,
      icon: GitBranch,
      label: 'Source Control',
      shortcut: 'Ctrl+Shift+G',
    },
    {
      id: 'run' as ActivityBarPanel,
      icon: Play,
      label: 'Run and Debug',
      shortcut: 'Ctrl+Shift+D',
    },
  ];

  const bottomItems = [
    {
      id: 'settings' as ActivityBarPanel,
      icon: Settings,
      label: 'Settings',
      shortcut: 'Ctrl+,',
    },
  ];

  return (
    <div className="w-12 bg-discord-sidebar border-r border-discord-border flex flex-col h-full">
      {/* Main Activity Items */}
      <div className="flex flex-col flex-1">
        {activityItems.map((item) => {
          const Icon = item.icon;
          const isActive = activePanel === item.id;
          
          return (
            <button
              key={item.id}
              onClick={() => onPanelChange(item.id)}
              title={`${item.label} (${item.shortcut})`}
              className={cn(
                'w-12 h-12 flex items-center justify-center transition-colors relative group',
                'hover:bg-discord-sidebar-hover',
                isActive && 'bg-discord-sidebar-hover'
              )}
            >
              <Icon 
                className={cn(
                  'w-6 h-6 transition-colors',
                  isActive ? 'text-white' : 'text-discord-text'
                )} 
              />
              
              {/* Active indicator */}
              {isActive && (
                <div className="absolute left-0 top-1/2 transform -translate-y-1/2 w-0.5 h-6 bg-white rounded-r" />
              )}
              
              {/* Tooltip */}
              <div className="absolute left-12 ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                {item.label}
                <div className="text-xs text-gray-400">{item.shortcut}</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Bottom Items */}
      <div className="flex flex-col">
        {bottomItems.map((item) => {
          const Icon = item.icon;
          const isActive = activePanel === item.id;
          
          return (
            <button
              key={item.id}
              onClick={() => onPanelChange(item.id)}
              title={`${item.label} (${item.shortcut})`}
              className={cn(
                'w-12 h-12 flex items-center justify-center transition-colors relative group',
                'hover:bg-discord-sidebar-hover',
                isActive && 'bg-discord-sidebar-hover'
              )}
            >
              <Icon 
                className={cn(
                  'w-5 h-5 transition-colors',
                  isActive ? 'text-white' : 'text-discord-text'
                )} 
              />
              
              {/* Active indicator */}
              {isActive && (
                <div className="absolute left-0 top-1/2 transform -translate-y-1/2 w-0.5 h-6 bg-white rounded-r" />
              )}
              
              {/* Tooltip */}
              <div className="absolute left-12 ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                {item.label}
                <div className="text-xs text-gray-400">{item.shortcut}</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
