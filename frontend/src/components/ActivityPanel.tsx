import { Circle, UserPlus, X, Moon, Wifi, WifiOff, Crown, Zap } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { useUserStatus, UserStatus } from '@/hooks/useUserStatus';
import { useAuth } from '@/contexts/AuthContext';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';

interface User {
  name: string;
  avatar?: string;
  status: 'online' | 'idle' | 'offline';
  activity?: string;
}

interface Participant {
  id: string;
  name: string;
  avatar?: string;
  isOnline: boolean;
  status: 'online' | 'away' | 'offline';
  lastSeen?: Date;
  isOwner?: boolean;
  isBot?: boolean;
  activity?: string;
}

interface ActivityPanelProps {
  participants: Participant[];
  onClose?: () => void;
  roomId?: string;
}

const getStatusColor = (status: 'online' | 'away' | 'offline') => {
  switch (status) {
    case 'online':
      return '#43a25a';
    case 'away':
      return '#f0b132';
    case 'offline':
      return '#747f8d';
    default:
      return '#747f8d';
  }
};

const getStatusText = (status: 'online' | 'away' | 'offline') => {
  switch (status) {
    case 'online':
      return 'Online';
    case 'away':
      return 'Away';
    case 'offline':
      return 'Offline';
    default:
      return 'Offline';
  }
};

const UserAvatar: React.FC<{ participant: Participant; size?: number }> = ({ participant, size = 32 }) => {
  const statusColor = getStatusColor(participant.status);
  const isOnline = participant.status === 'online';
  
  return (
    <div className="relative">
      <div 
        className="rounded-full overflow-hidden bg-discord-sidebar flex items-center justify-center"
        style={{ width: size, height: size }}
      >
        {participant.avatar ? (
          <img 
            src={participant.avatar} 
            alt={participant.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-discord-primary flex items-center justify-center text-white font-medium">
            {participant.name.charAt(0).toUpperCase()}
          </div>
        )}
      </div>
      {isOnline && (
        <div 
          className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-discord-activity"
          style={{ backgroundColor: statusColor }}
        />
      )}
    </div>
  );
};

export const ActivityPanel: React.FC<ActivityPanelProps> = ({ participants, onClose, roomId }) => {
  const { user } = useAuth();
  const { status, isOnline, isAway, isOffline, setStatus } = useUserStatus(roomId);
  
  // Separate participants by status
  const onlineParticipants = participants.filter(p => p.isOnline && p.status === 'online');
  const awayParticipants = participants.filter(p => p.isOnline && p.status === 'away');
  const offlineParticipants = participants.filter(p => !p.isOnline || p.status === 'offline');
  
  const totalOnline = onlineParticipants.length + awayParticipants.length;
  const totalParticipants = participants.length;

  const handleStatusChange = (newStatus: UserStatus) => {
    console.log('ActivityPanel - handleStatusChange called with:', newStatus);
    setStatus(newStatus);
  };

  const getUserStatusIcon = () => {
    if (isOffline) return <WifiOff className="w-3 h-3" />;
    if (isAway) return <Moon className="w-3 h-3" />;
    return <Circle className="w-3 h-3 fill-current" />;
  };

  const getUserStatusColor = () => {
    if (isOffline) return 'text-red-500';
    if (isAway) return 'text-yellow-500';
    return 'text-green-500';
  };

  const getUserStatusText = () => {
    if (isOffline) return 'Offline';
    if (isAway) return 'Away';
    return 'Online';
  };

  const MemberItem: React.FC<{ participant: Participant; isOffline?: boolean }> = ({ participant, isOffline = false }) => (
    <div className={`flex items-center px-2 py-1 rounded hover:bg-discord-sidebar-hover transition-colors cursor-pointer ${isOffline ? 'opacity-50' : ''}`}>
      <UserAvatar participant={participant} />
      <div className="ml-3 flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`text-sm font-medium ${isOffline ? 'text-muted-foreground' : 'text-foreground'} truncate`}>
            {participant.name}
          </span>
          {participant.isOwner && (
            <Crown className="w-3 h-3 text-yellow-500" />
          )}
          {participant.isBot && (
            <span className="bg-discord-primary text-white text-xs px-1 py-0.5 rounded text-[10px] font-medium">
              BOT
            </span>
          )}
        </div>
        {participant.activity && (
          <p className="text-xs text-muted-foreground truncate">
            {participant.activity}
          </p>
        )}
      </div>
    </div>
  );

  return (
    <div className="w-full bg-discord-activity border-l border-border flex flex-col h-full">
      <div className="p-4 border-b border-border flex-shrink-0">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">
            Participants ({onlineParticipants.length} Online, {awayParticipants.length} Away, {offlineParticipants.length} Offline)
          </h2>
          {onClose && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 hover:bg-discord-sidebar-hover"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
      
      <ScrollArea className="flex-1 custom-scrollbar">
        <div className="p-4">
          {/* Current User Status Control */}
          <div className="mb-6 p-3 bg-discord-sidebar rounded-lg border border-border">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="relative">
                  <img 
                    src={`https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || 'User')}&background=5865f2&color=fff&size=32`} 
                    alt={user?.name || 'User'}
                    className="w-8 h-8 rounded-full"
                  />
                  <Circle 
                    className={`w-3 h-3 absolute -bottom-1 -right-1 bg-discord-sidebar rounded-full fill-current ${getUserStatusColor()}`}
                  />
                </div>
                <div>
                  <div className="text-sm font-medium text-foreground">{user?.name || 'User'}</div>
                  <div className={`text-xs ${getUserStatusColor()}`}>
                    {getUserStatusText()}
                  </div>
                </div>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 hover:bg-discord-sidebar-hover"
                  >
                    {getUserStatusIcon()}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="left" align="end" className="w-48">
                  <DropdownMenuLabel className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${getUserStatusColor()}`}>
                      {getUserStatusIcon()}
                    </div>
                    <span className="text-sm">Set Status</span>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  
                  <DropdownMenuItem 
                    onClick={() => handleStatusChange('online')}
                    className={`flex items-center gap-2 ${isOnline ? 'bg-accent' : ''}`}
                  >
                    <Circle className="w-3 h-3 fill-current text-green-500" />
                    Online
                    {isOnline && <span className="ml-auto text-xs text-green-500">●</span>}
                  </DropdownMenuItem>
                  
                  <DropdownMenuItem 
                    onClick={() => handleStatusChange('away')}
                    className={`flex items-center gap-2 ${isAway ? 'bg-accent' : ''}`}
                  >
                    <Moon className="w-3 h-3 text-yellow-500" />
                    Away
                    {isAway && <span className="ml-auto text-xs text-yellow-500">●</span>}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {totalParticipants === 0 ? (
            <div className="mb-6">
              <p className="text-sm text-muted-foreground mb-4">No participants yet...</p>
              <p className="text-xs text-muted-foreground">
                When users join this room, they will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Online participants */}
              {totalOnline > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-2">
                    Online — {totalOnline}
                  </h3>
                  <div className="space-y-2">
                    {onlineParticipants.map((participant) => (
                      <MemberItem key={participant.id} participant={participant} />
                    ))}
                    {awayParticipants.map((participant) => (
                      <MemberItem key={participant.id} participant={participant} />
                    ))}
                  </div>
                </div>
              )}

              {/* Offline participants */}
              {offlineParticipants.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-2">
                    Offline — {offlineParticipants.length}
                  </h3>
                  <div className="space-y-2">
                    {offlineParticipants.map((participant) => (
                      <MemberItem key={participant.id} participant={participant} isOffline />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </ScrollArea>
      
      {/* Invite to Room Button - Fixed at bottom */}
      <div className="p-4 border-t border-border flex-shrink-0">
        <button className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-md transition-colors text-sm font-medium">
          <UserPlus className="w-4 h-4" />
          Invite to Room
        </button>
      </div>
    </div>
  );
};