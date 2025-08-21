import React, { useState, useCallback, useEffect } from 'react';
import { 
  Users as UsersIcon,
  UserPlus,
  UserMinus,
  Crown,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Video,
  VideoOff,
  MoreHorizontal,
  Settings,
  Shield,
  Eye,
  EyeOff,
  Dot,
  RefreshCw,
  MessageSquare,
  Code
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { 
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { userAPI } from '@/lib/api';

type UserStatus = 'online' | 'away' | 'busy' | 'offline';
type UserRole = 'owner' | 'admin' | 'member' | 'viewer';

interface User {
  id: string;
  username: string;
  displayName: string;
  avatar?: string;
  status: UserStatus;
  role: UserRole;
  isTyping: boolean;
  isInVoice: boolean;
  isInVideo: boolean;
  isMuted: boolean;
  isDeafened: boolean;
  currentFile?: string;
  cursorPosition?: {
    line: number;
    column: number;
  };
  lastActivity: Date;
  joinedAt: Date;
}

interface UsersPanelProps {
  roomId: string;
  currentUserId: string;
  onUserSelect?: (user: User) => void;
  onInviteUser?: () => void;
}

const getStatusColor = (status: UserStatus) => {
  switch (status) {
    case 'online':
      return 'bg-green-400';
    case 'away':
      return 'bg-yellow-400';
    case 'busy':
      return 'bg-red-400';
    case 'offline':
      return 'bg-gray-400';
    default:
      return 'bg-gray-400';
  }
};

const getRoleIcon = (role: UserRole) => {
  switch (role) {
    case 'owner':
      return <Crown className="w-3 h-3 text-yellow-400" />;
    case 'admin':
      return <Shield className="w-3 h-3 text-blue-400" />;
    case 'member':
      return <UsersIcon className="w-3 h-3 text-green-400" />;
    case 'viewer':
      return <Eye className="w-3 h-3 text-gray-400" />;
    default:
      return null;
  }
};

const getRoleColor = (role: UserRole) => {
  switch (role) {
    case 'owner':
      return 'text-yellow-400';
    case 'admin':
      return 'text-blue-400';
    case 'member':
      return 'text-green-400';
    case 'viewer':
      return 'text-gray-400';
    default:
      return 'text-discord-muted';
  }
};

const UserItem: React.FC<{
  user: User;
  currentUserId: string;
  onSelect: (user: User) => void;
  onKickUser: (userId: string) => void;
  onPromoteUser: (userId: string) => void;
  onDemoteUser: (userId: string) => void;
  onMuteUser: (userId: string) => void;
  onToggleRole: (userId: string, role: UserRole) => void;
}> = ({ 
  user, 
  currentUserId, 
  onSelect, 
  onKickUser, 
  onPromoteUser, 
  onDemoteUser, 
  onMuteUser,
  onToggleRole 
}) => {
  const isCurrentUser = user.id === currentUserId;
  
  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          className="flex items-center gap-3 px-3 py-2 hover:bg-discord-sidebar-hover cursor-pointer group"
          onClick={() => onSelect(user)}
        >
          <div className="relative">
            <Avatar className="h-8 w-8">
              <AvatarImage src={user.avatar} alt={user.displayName} />
              <AvatarFallback className="text-xs bg-discord-primary text-white">
                {getInitials(user.displayName)}
              </AvatarFallback>
            </Avatar>
            
            {/* Status indicator */}
            <div className={cn(
              "absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-discord-sidebar",
              getStatusColor(user.status)
            )} />
            
            {/* Voice/Video indicators */}
            {user.isInVoice && (
              <div className="absolute -top-1 -right-1 bg-discord-sidebar rounded-full p-0.5">
                {user.isMuted ? (
                  <MicOff className="w-2.5 h-2.5 text-red-400" />
                ) : (
                  <Mic className="w-2.5 h-2.5 text-green-400" />
                )}
              </div>
            )}
            
            {user.isInVideo && (
              <div className="absolute -top-1 -left-1 bg-discord-sidebar rounded-full p-0.5">
                <Video className="w-2.5 h-2.5 text-blue-400" />
              </div>
            )}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className={cn(
                "text-sm font-medium truncate",
                isCurrentUser ? "text-discord-primary" : "text-discord-text"
              )}>
                {user.displayName}
                {isCurrentUser && " (You)"}
              </span>
              
              {getRoleIcon(user.role)}
              
              {user.isTyping && (
                <div className="flex items-center gap-1">
                  <div className="flex space-x-0.5">
                    <div className="w-1 h-1 bg-discord-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-1 h-1 bg-discord-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-1 h-1 bg-discord-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              )}
            </div>
            
            <div className="flex items-center gap-2 text-xs text-discord-muted">
              <span className={getRoleColor(user.role)}>
                {user.role}
              </span>
              
              {user.currentFile && (
                <>
                  <span>•</span>
                  <Code className="w-3 h-3" />
                  <span className="truncate">{user.currentFile}</span>
                </>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 hover:bg-discord-primary/20"
                    onClick={(e) => {
                      e.stopPropagation();
                      // TODO: Start direct message
                    }}
                  >
                    <MessageSquare className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Direct Message</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </ContextMenuTrigger>
      
      {!isCurrentUser && (
        <ContextMenuContent className="bg-discord-sidebar border-discord-border">
          <ContextMenuItem onClick={() => onSelect(user)}>
            <Eye className="w-4 h-4 mr-2" />
            View Profile
          </ContextMenuItem>
          
          <ContextMenuItem>
            <MessageSquare className="w-4 h-4 mr-2" />
            Direct Message
          </ContextMenuItem>
          
          <ContextMenuSeparator />
          
          {user.role !== 'owner' && (
            <>
              <ContextMenuItem onClick={() => onPromoteUser(user.id)}>
                <Crown className="w-4 h-4 mr-2" />
                Promote
              </ContextMenuItem>
              
              <ContextMenuItem onClick={() => onDemoteUser(user.id)}>
                <Shield className="w-4 h-4 mr-2" />
                Change Role
              </ContextMenuItem>
              
              <ContextMenuSeparator />
              
              <ContextMenuItem onClick={() => onMuteUser(user.id)}>
                <MicOff className="w-4 h-4 mr-2" />
                Mute User
              </ContextMenuItem>
              
              <ContextMenuItem 
                onClick={() => onKickUser(user.id)}
                className="text-red-400 focus:text-red-300"
              >
                <UserMinus className="w-4 h-4 mr-2" />
                Kick User
              </ContextMenuItem>
            </>
          )}
        </ContextMenuContent>
      )}
    </ContextMenu>
  );
};

export const UsersPanel: React.FC<UsersPanelProps> = ({
  roomId,
  currentUserId,
  onUserSelect,
  onInviteUser,
}) => {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [voiceChannelUsers, setVoiceChannelUsers] = useState<User[]>([]);

  const loadUsers = useCallback(async () => {
    try {
      setIsLoading(true);
      
      // Load users from real API
      const usersData = await userAPI.getUsersInRoom(roomId);
      
      if (usersData && usersData.data && Array.isArray(usersData.data)) {
        // Transform API response to our User interface
        const transformedUsers: User[] = usersData.data
          .filter((participant: any) => participant && participant.userId) // Filter out invalid participants
          .map((participant: any) => {
            // Handle both populated and non-populated userId
            const user = typeof participant.userId === 'object' && participant.userId._id 
              ? participant.userId 
              : { _id: participant.userId, name: participant.name || 'Unknown User', email: null, activityStatus: 'offline' };
            
            return {
              id: user._id || user.id || participant.userId,
              username: user.email?.split('@')[0] || user.name?.toLowerCase().replace(/\s+/g, '_') || 'user',
              displayName: user.name || participant.name || 'Unknown User',
              avatar: user.profilePicId ? `/api/v1/files/${user.profilePicId}` : undefined,
              status: user.activityStatus === 'Online' ? 'online' : 
                     user.activityStatus === 'Away' ? 'away' :
                     user.activityStatus === 'Busy' ? 'busy' : 'offline',
              role: participant.role as UserRole || 'member',
              isTyping: false, // Would come from socket data
              isInVoice: false, // Would come from socket data
              isInVideo: false, // Would come from socket data
              isMuted: false, // Would come from socket data
              isDeafened: false, // Would come from socket data
              currentFile: undefined, // Would come from socket data
              cursorPosition: undefined, // Would come from socket data
              lastActivity: new Date(user.lastSeen || Date.now()),
              joinedAt: new Date(participant.joinedAt || Date.now()),
            };
          });

        setUsers(transformedUsers);
        setVoiceChannelUsers(transformedUsers.filter(user => user.isInVoice));
      } else {
        // Fallback to mock data if API doesn't return expected format
        const mockUsers: User[] = [
          {
            id: currentUserId,
            username: 'currentuser',
            displayName: 'You',
            status: 'online',
            role: 'owner',
            isTyping: false,
            isInVoice: true,
            isInVideo: false,
            isMuted: false,
            isDeafened: false,
            currentFile: 'App.tsx',
            cursorPosition: { line: 15, column: 20 },
            lastActivity: new Date(),
            joinedAt: new Date(Date.now() - 3600000), // 1 hour ago
          },
        ];

        setUsers(mockUsers);
        setVoiceChannelUsers(mockUsers.filter(user => user.isInVoice));
      }
    } catch (error) {
      console.error('Failed to load users:', error);
      toast.error('Failed to load users');
      
      // Fallback to empty array on error
      setUsers([]);
      setVoiceChannelUsers([]);
    } finally {
      setIsLoading(false);
    }
  }, [roomId, currentUserId]);

  useEffect(() => {
    if (roomId) {
      loadUsers();
    }
  }, [roomId, loadUsers]);

  const handleUserSelect = (user: User) => {
    onUserSelect?.(user);
  };

  const handleKickUser = async (userId: string) => {
    try {
      await userAPI.kickUser(roomId, userId);
      setUsers(prev => prev.filter(user => user.id !== userId));
      toast.success('User kicked successfully');
    } catch (error) {
      console.error('Failed to kick user:', error);
      toast.error('Failed to kick user');
    }
  };

  const handlePromoteUser = async (userId: string) => {
    try {
      const user = users.find(u => u.id === userId);
      if (!user) return;
      
      const newRole = user.role === 'member' ? 'admin' : 'member';
      await userAPI.updateUserRole(roomId, userId, newRole);
      
      setUsers(prev => 
        prev.map(user => 
          user.id === userId 
            ? { ...user, role: newRole as UserRole }
            : user
        )
      );
      toast.success('User role updated');
    } catch (error) {
      console.error('Failed to promote user:', error);
      toast.error('Failed to update user role');
    }
  };

  const handleDemoteUser = async (userId: string) => {
    try {
      await userAPI.updateUserRole(roomId, userId, 'member');
      setUsers(prev => 
        prev.map(user => 
          user.id === userId 
            ? { ...user, role: 'member' as UserRole }
            : user
        )
      );
      toast.success('User demoted');
    } catch (error) {
      console.error('Failed to demote user:', error);
      toast.error('Failed to demote user');
    }
  };

  const handleMuteUser = async (userId: string) => {
    try {
      // Note: Mute functionality would typically be handled by voice/video service
      // For now, just update local state
      setUsers(prev => 
        prev.map(user => 
          user.id === userId 
            ? { ...user, isMuted: !user.isMuted }
            : user
        )
      );
      toast.success('User mute status updated');
    } catch (error) {
      console.error('Failed to mute user:', error);
      toast.error('Failed to update mute status');
    }
  };

  const handleToggleRole = async (userId: string, role: UserRole) => {
    try {
      await userAPI.updateUserRole(roomId, userId, role);
      setUsers(prev => 
        prev.map(user => 
          user.id === userId 
            ? { ...user, role }
            : user
        )
      );
      toast.success('User role updated');
    } catch (error) {
      console.error('Failed to update user role:', error);
      toast.error('Failed to update user role');
    }
  };

  const handleInviteUser = async (email: string) => {
    try {
      await userAPI.inviteUserToRoom(roomId, email);
      toast.success('User invited successfully');
      // Refresh the user list
      loadUsers();
    } catch (error) {
      console.error('Failed to invite user:', error);
      toast.error('Failed to invite user');
    }
  };

  const onlineUsers = users.filter(user => user.status === 'online');
  const offlineUsers = users.filter(user => user.status !== 'online');

  return (
    <div className="h-full bg-discord-sidebar flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-2 border-b border-discord-border">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-discord-text uppercase tracking-wide">
            Users
          </span>
          <Badge variant="secondary" className="h-4 text-xs bg-discord-primary/20 text-discord-primary">
            {users.length}
          </Badge>
        </div>
        
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 hover:bg-discord-sidebar-hover"
            onClick={() => {
              const email = prompt('Enter email address to invite:');
              if (email) {
                handleInviteUser(email);
              }
            }}
            title="Invite User"
          >
            <UserPlus className="h-3 w-3" />
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 hover:bg-discord-sidebar-hover"
            onClick={loadUsers}
            title="Refresh"
          >
            <RefreshCw className="h-3 w-3" />
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 hover:bg-discord-sidebar-hover"
            title="Settings"
          >
            <Settings className="h-3 w-3" />
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
            {/* Voice Channel */}
            {voiceChannelUsers.length > 0 && (
              <>
                <div className="flex items-center gap-2 px-3 py-2 border-b border-discord-border">
                  <Volume2 className="w-4 h-4 text-discord-text" />
                  <span className="text-xs font-medium text-discord-text uppercase tracking-wide">
                    Voice Channel
                  </span>
                  <Badge variant="secondary" className="h-4 text-xs bg-green-500/20 text-green-400">
                    {voiceChannelUsers.length}
                  </Badge>
                </div>
                
                {voiceChannelUsers.map((user) => (
                  <UserItem
                    key={`voice-${user.id}`}
                    user={user}
                    currentUserId={currentUserId}
                    onSelect={handleUserSelect}
                    onKickUser={handleKickUser}
                    onPromoteUser={handlePromoteUser}
                    onDemoteUser={handleDemoteUser}
                    onMuteUser={handleMuteUser}
                    onToggleRole={handleToggleRole}
                  />
                ))}
                
                <Separator className="bg-discord-border my-2" />
              </>
            )}

            {/* Online Users */}
            {onlineUsers.length > 0 && (
              <>
                <div className="flex items-center gap-2 px-3 py-2">
                  <span className="text-xs font-medium text-discord-text uppercase tracking-wide">
                    Online
                  </span>
                  <Badge variant="secondary" className="h-4 text-xs bg-green-500/20 text-green-400">
                    {onlineUsers.length}
                  </Badge>
                </div>
                
                {onlineUsers.map((user) => (
                  <UserItem
                    key={user.id}
                    user={user}
                    currentUserId={currentUserId}
                    onSelect={handleUserSelect}
                    onKickUser={handleKickUser}
                    onPromoteUser={handlePromoteUser}
                    onDemoteUser={handleDemoteUser}
                    onMuteUser={handleMuteUser}
                    onToggleRole={handleToggleRole}
                  />
                ))}
              </>
            )}

            {/* Offline Users */}
            {offlineUsers.length > 0 && (
              <>
                <div className="flex items-center gap-2 px-3 py-2 mt-2">
                  <span className="text-xs font-medium text-discord-text uppercase tracking-wide">
                    Offline
                  </span>
                  <Badge variant="secondary" className="h-4 text-xs bg-gray-500/20 text-gray-400">
                    {offlineUsers.length}
                  </Badge>
                </div>
                
                {offlineUsers.map((user) => (
                  <UserItem
                    key={user.id}
                    user={user}
                    currentUserId={currentUserId}
                    onSelect={handleUserSelect}
                    onKickUser={handleKickUser}
                    onPromoteUser={handlePromoteUser}
                    onDemoteUser={handleDemoteUser}
                    onMuteUser={handleMuteUser}
                    onToggleRole={handleToggleRole}
                  />
                ))}
              </>
            )}

            {/* No Users */}
            {users.length === 0 && (
              <div className="flex flex-col items-center justify-center h-32 text-discord-muted">
                <UsersIcon className="h-8 w-8 mb-2 opacity-50" />
                <span className="text-sm">No users in this room</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2 text-xs"
                  onClick={() => {
                    const email = prompt('Enter email address to invite:');
                    if (email) {
                      handleInviteUser(email);
                    }
                  }}
                >
                  <UserPlus className="h-3 w-3 mr-1" />
                  Invite Users
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
