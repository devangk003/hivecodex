import React, { useState, useEffect } from 'react';
import { 
  Users, 
  UserPlus, 
  UserMinus, 
  Settings, 
  Shield, 
  Crown, 
  Eye,
  EyeOff,
  MoreVertical,
  MessageCircle,
  Video,
  Phone
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from './avatar';
import { Button } from './button';
import { Card, CardContent, CardHeader, CardTitle } from './card';
import { Badge } from './badge';
import { ScrollArea } from './scroll-area';
import { Input } from './input';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from './dropdown-menu';
import { UserPresence } from '../../types/socket';

interface UserWithPermissions extends UserPresence {
  role: 'owner' | 'admin' | 'member' | 'guest';
  permissions: string[];
  joinedAt: Date;
  lastActivity?: Date;
  isTyping?: boolean;
  currentFile?: string;
  userAvatar?: string;
}

interface UserManagementHubProps {
  users: UserWithPermissions[];
  currentUserId: string;
  onInviteUser?: () => void;
  onRemoveUser?: (userId: string) => void;
  onChangeRole?: (userId: string, role: string) => void;
  onStartChat?: (userId: string) => void;
  onStartVideo?: (userId: string) => void;
  onViewUserFiles?: (userId: string) => void;
  onToggleUserVisibility?: (userId: string, visible: boolean) => void;
  maxVisible?: number;
}

const roleColors = {
  owner: 'bg-purple-100 text-purple-800 border-purple-200',
  admin: 'bg-red-100 text-red-800 border-red-200',
  member: 'bg-blue-100 text-blue-800 border-blue-200',
  guest: 'bg-gray-100 text-gray-800 border-gray-200'
};

const roleIcons = {
  owner: Crown,
  admin: Shield,
  member: Users,
  guest: Eye
};

const statusColors = {
  online: 'bg-green-500',
  away: 'bg-yellow-500',
  busy: 'bg-red-500',
  offline: 'bg-gray-400'
};

export const UserManagementHub: React.FC<UserManagementHubProps> = ({
  users = [],
  currentUserId,
  onInviteUser,
  onRemoveUser,
  onChangeRole,
  onStartChat,
  onStartVideo,
  onViewUserFiles,
  onToggleUserVisibility,
  maxVisible = 10
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [visibleUsers, setVisibleUsers] = useState<UserWithPermissions[]>([]);

  // Filter and sort users
  useEffect(() => {
    let filteredUsers = users;

    // Filter by search term
    if (searchTerm) {
      filteredUsers = users.filter(user =>
        user.username.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Sort by status, role, and activity
    filteredUsers.sort((a, b) => {
      // Online users first
      if (a.isOnline !== b.isOnline) {
        return a.isOnline ? -1 : 1;
      }

      // Then by role priority
      const rolePriority = { owner: 1, admin: 2, member: 3, guest: 4 };
      if (a.role !== b.role) {
        return rolePriority[a.role] - rolePriority[b.role];
      }

      // Then by recent activity
      const aActivity = a.lastActivity || a.joinedAt;
      const bActivity = b.lastActivity || b.joinedAt;
      return bActivity.getTime() - aActivity.getTime();
    });

    setVisibleUsers(isExpanded ? filteredUsers : filteredUsers.slice(0, maxVisible));
  }, [users, searchTerm, maxVisible, isExpanded]);

  const formatLastSeen = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    if (diff < 60000) {
      return 'Just now';
    } else if (diff < 3600000) {
      const minutes = Math.floor(diff / 60000);
      return `${minutes}m ago`;
    } else if (diff < 86400000) {
      const hours = Math.floor(diff / 3600000);
      return `${hours}h ago`;
    } else {
      const days = Math.floor(diff / 86400000);
      return `${days}d ago`;
    }
  };

  const getCurrentUser = () => users.find(user => user.userId === currentUserId);
  const currentUser = getCurrentUser();
  const canManageUsers = currentUser?.role === 'owner' || currentUser?.role === 'admin';

  return (
    <Card className="w-80">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            <span>Users ({users.length})</span>
          </div>
          {canManageUsers && onInviteUser && (
            <Button variant="ghost" size="sm" onClick={onInviteUser}>
              <UserPlus className="w-4 h-4" />
            </Button>
          )}
        </CardTitle>
        
        {users.length > 3 && (
          <Input
            placeholder="Search users..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-8"
          />
        )}
      </CardHeader>
      
      <CardContent className="pt-0">
        <ScrollArea className={isExpanded ? "h-96" : "h-auto"}>
          <div className="space-y-2">
            {visibleUsers.map((user) => {
              const RoleIcon = roleIcons[user.role];
              const isCurrentUser = user.userId === currentUserId;
              
              return (
                <div
                  key={user.userId}
                  className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                    isCurrentUser 
                      ? 'bg-primary/10 border border-primary/20' 
                      : 'hover:bg-muted/50'
                  }`}
                >
                  <div className="relative">
                    <Avatar className="w-8 h-8">
                      <AvatarImage src={user.userAvatar} />
                      <AvatarFallback className="text-xs">
                        {user.username.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div 
                      className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-white ${
                        statusColors[user.status]
                      }`}
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium truncate">
                        {user.username}
                        {isCurrentUser && (
                          <span className="text-xs text-muted-foreground ml-1">(You)</span>
                        )}
                      </span>
                      {user.isTyping && (
                        <span className="text-xs text-blue-600 animate-pulse">typing...</span>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className={`text-xs ${roleColors[user.role]}`}>
                        <RoleIcon className="w-3 h-3 mr-1" />
                        {user.role}
                      </Badge>
                      
                      {!user.isOnline && (
                        <span className="text-xs text-muted-foreground">
                          {formatLastSeen(user.lastSeen)}
                        </span>
                      )}
                    </div>

                    {user.currentFile && (
                      <p className="text-xs text-blue-600 mt-1 truncate font-mono">
                        {user.currentFile}
                      </p>
                    )}
                  </div>

                  {!isCurrentUser && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                          <MoreVertical className="w-3 h-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {onStartChat && (
                          <DropdownMenuItem onClick={() => onStartChat(user.userId)}>
                            <MessageCircle className="w-4 h-4 mr-2" />
                            Start Chat
                          </DropdownMenuItem>
                        )}
                        
                        {onStartVideo && user.isOnline && (
                          <DropdownMenuItem onClick={() => onStartVideo(user.userId)}>
                            <Video className="w-4 h-4 mr-2" />
                            Video Call
                          </DropdownMenuItem>
                        )}
                        
                        {onViewUserFiles && (
                          <DropdownMenuItem onClick={() => onViewUserFiles(user.userId)}>
                            <Eye className="w-4 h-4 mr-2" />
                            View Files
                          </DropdownMenuItem>
                        )}
                        
                        {canManageUsers && user.role !== 'owner' && (
                          <>
                            <DropdownMenuSeparator />
                            {onToggleUserVisibility && (
                              <DropdownMenuItem 
                                onClick={() => onToggleUserVisibility(user.userId, !user.isOnline)}
                              >
                                {user.isOnline ? <EyeOff className="w-4 h-4 mr-2" /> : <Eye className="w-4 h-4 mr-2" />}
                                {user.isOnline ? 'Hide User' : 'Show User'}
                              </DropdownMenuItem>
                            )}
                            
                            {onChangeRole && (
                              <>
                                <DropdownMenuItem 
                                  onClick={() => onChangeRole(user.userId, 'admin')}
                                  disabled={user.role === 'admin'}
                                >
                                  <Shield className="w-4 h-4 mr-2" />
                                  Make Admin
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => onChangeRole(user.userId, 'member')}
                                  disabled={user.role === 'member'}
                                >
                                  <Users className="w-4 h-4 mr-2" />
                                  Make Member
                                </DropdownMenuItem>
                              </>
                            )}
                            
                            {onRemoveUser && (
                              <DropdownMenuItem 
                                onClick={() => onRemoveUser(user.userId)}
                                className="text-red-600"
                              >
                                <UserMinus className="w-4 h-4 mr-2" />
                                Remove User
                              </DropdownMenuItem>
                            )}
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>

        {users.length > maxVisible && (
          <div className="pt-3 border-t mt-3">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? 'Show Less' : `View All ${users.length} Users`}
            </Button>
          </div>
        )}

        {/* Quick Stats */}
        <div className="pt-3 border-t mt-3">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="text-center p-2 bg-muted/50 rounded">
              <div className="font-medium text-green-600">
                {users.filter(u => u.isOnline).length}
              </div>
              <div className="text-muted-foreground">Online</div>
            </div>
            <div className="text-center p-2 bg-muted/50 rounded">
              <div className="font-medium text-blue-600">
                {users.filter(u => u.isTyping).length}
              </div>
              <div className="text-muted-foreground">Typing</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default UserManagementHub;