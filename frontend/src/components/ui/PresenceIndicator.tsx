import React from 'react';
import { User, Users, Eye, Crown, Shield } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from './avatar';
import { Badge } from './badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './tooltip';
import { UserPresence } from '../../types/socket';

export interface PresenceIndicatorProps {
  users: UserPresence[];
  maxVisible?: number;
  showDetails?: boolean;
  size?: 'sm' | 'md' | 'lg';
  layout?: 'horizontal' | 'vertical' | 'grid';
  showRoles?: boolean;
  currentUserId?: string;
}

const statusColors = {
  online: 'bg-green-500',
  away: 'bg-yellow-500',
  busy: 'bg-red-500',
  offline: 'bg-gray-400'
};

const roleIcons = {
  owner: Crown,
  admin: Shield,
  member: User,
  guest: Eye
};

const sizeConfig = {
  sm: { avatar: 'w-6 h-6', indicator: 'w-2 h-2', text: 'text-xs' },
  md: { avatar: 'w-8 h-8', indicator: 'w-3 h-3', text: 'text-sm' },
  lg: { avatar: 'w-10 h-10', indicator: 'w-4 h-4', text: 'text-base' }
};

export const PresenceIndicator: React.FC<PresenceIndicatorProps> = ({
  users = [],
  maxVisible = 5,
  showDetails = false,
  size = 'md',
  layout = 'horizontal',
  showRoles = false,
  currentUserId
}) => {
  const sizeClasses = sizeConfig[size];
  const onlineUsers = users.filter(user => user.isOnline);
  const visibleUsers = onlineUsers.slice(0, maxVisible);
  const hiddenCount = Math.max(0, onlineUsers.length - maxVisible);

  const getUserRole = (userId: string): string => {
    // This would typically come from user data or props
    return userId === currentUserId ? 'owner' : 'member';
  };

  const formatLastSeen = (lastSeen: Date) => {
    const now = new Date();
    const diff = now.getTime() - lastSeen.getTime();
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  };

  const UserAvatar: React.FC<{ user: UserPresence; showTooltip?: boolean }> = ({ 
    user, 
    showTooltip = true 
  }) => {
    const userRole = getUserRole(user.userId);
    const RoleIcon = roleIcons[userRole as keyof typeof roleIcons];
    
    const avatarContent = (
      <div className="relative">
        <Avatar className={sizeClasses.avatar}>
          <AvatarImage 
            src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`} 
            alt={user.username}
          />
          <AvatarFallback className={sizeClasses.text}>
            {user.username.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        
        {/* Status indicator */}
        <div 
          className={`absolute -bottom-1 -right-1 rounded-full border-2 border-white ${
            statusColors[user.status]
          } ${sizeClasses.indicator}`}
        />
        
        {/* Role indicator */}
        {showRoles && (
          <div className="absolute -top-1 -left-1 bg-white rounded-full p-1 border shadow-sm">
            <RoleIcon className="w-2 h-2 text-gray-600" />
          </div>
        )}
      </div>
    );

    if (!showTooltip) return avatarContent;

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            {avatarContent}
          </TooltipTrigger>
          <TooltipContent>
            <div className="text-center">
              <p className="font-medium">{user.username}</p>
              <p className="text-xs text-muted-foreground capitalize">
                {user.status}
                {!user.isOnline && ` • ${formatLastSeen(user.lastSeen)}`}
              </p>
              {user.currentFile && (
                <p className="text-xs text-muted-foreground">
                  Viewing: {user.currentFile}
                </p>
              )}
              {showRoles && (
                <p className="text-xs text-muted-foreground capitalize">
                  {userRole}
                </p>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  const CompactView = () => (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1">
        <Users className={`${sizeClasses.indicator} text-muted-foreground`} />
        <span className={`${sizeClasses.text} text-muted-foreground`}>
          {onlineUsers.length}
        </span>
      </div>
      
      <div className="flex -space-x-1">
        {visibleUsers.map((user) => (
          <UserAvatar key={user.userId} user={user} />
        ))}
        
        {hiddenCount > 0 && (
          <div className={`flex items-center justify-center rounded-full bg-gray-100 border-2 border-white ${sizeClasses.avatar}`}>
            <span className={`${sizeClasses.text} font-medium text-gray-600`}>
              +{hiddenCount}
            </span>
          </div>
        )}
      </div>
    </div>
  );

  const DetailedView = () => {
    const layoutClasses = {
      horizontal: 'flex flex-wrap gap-2',
      vertical: 'flex flex-col gap-2',
      grid: 'grid grid-cols-3 gap-2'
    };

    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-muted-foreground" />
          <span className={`${sizeClasses.text} font-medium`}>
            {onlineUsers.length} Online
          </span>
          <Badge variant="secondary" className="text-xs">
            {users.length} Total
          </Badge>
        </div>
        
        <div className={layoutClasses[layout]}>
          {visibleUsers.map((user) => (
            <div key={user.userId} className="flex items-center gap-2">
              <UserAvatar user={user} />
              <div className="min-w-0 flex-1">
                <p className={`${sizeClasses.text} font-medium truncate`}>
                  {user.username}
                  {user.userId === currentUserId && ' (You)'}
                </p>
                <p className="text-xs text-muted-foreground capitalize">
                  {user.status}
                  {user.currentFile && ` • ${user.currentFile}`}
                </p>
              </div>
              {showRoles && (
                <Badge variant="outline" className="text-xs">
                  {getUserRole(user.userId)}
                </Badge>
              )}
            </div>
          ))}
        </div>
        
        {hiddenCount > 0 && (
          <p className="text-xs text-muted-foreground text-center">
            And {hiddenCount} more users...
          </p>
        )}
      </div>
    );
  };

  if (users.length === 0) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Users className={sizeClasses.indicator} />
        <span className={sizeClasses.text}>No users online</span>
      </div>
    );
  }

  return showDetails ? <DetailedView /> : <CompactView />;
};

export default PresenceIndicator;