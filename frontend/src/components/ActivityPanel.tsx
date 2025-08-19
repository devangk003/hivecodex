import React, { useState } from 'react';
import {
  Circle,
  UserPlus,
  X,
  Moon,
  Wifi,
  WifiOff,
  Crown,
  Zap,
  Copy,
  Check,
  Share,
  Link,
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { useUserStatus, UserStatus } from '@/hooks/useUserStatus';
import { useAuth } from '@/contexts/AuthContext';
import type { RoomParticipant } from '@/types/userStatus';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

interface User {
  name: string;
  avatar?: string;
  status: 'online' | 'idle' | 'offline';
  activity?: string;
}

interface ActivityPanelProps {
  participants: RoomParticipant[];
  onClose?: () => void;
  roomId?: string;
}

const getStatusColor = (status: 'in-room' | 'away' | 'offline' | 'online') => {
  switch (status) {
    case 'in-room':
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

const getStatusText = (status: 'in-room' | 'away' | 'offline' | 'online') => {
  switch (status) {
    case 'in-room':
      return 'In Room';
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

const UserAvatar: React.FC<{ participant: RoomParticipant; size?: number }> = ({
  participant,
  size = 32,
}) => {
  // Defensive guards in case participant is temporarily undefined or missing fields
  if (!participant) {
    return (
      <div
        className="relative rounded-full overflow-hidden bg-discord-sidebar flex items-center justify-center"
        style={{ width: size, height: size }}
      >
        <div className="w-full h-full bg-discord-primary flex items-center justify-center text-white font-medium">
          ?
        </div>
      </div>
    );
  }

  const safeName = participant.name || '?';
  const statusColor = getStatusColor(participant.status || 'offline');
  const isOnline = participant.status === 'in-room' || participant.status === 'online';

  return (
    <div className="relative">
      <div
        className="rounded-full overflow-hidden bg-discord-sidebar flex items-center justify-center"
        style={{ width: size, height: size }}
      >
        {participant.profilePicId ? (
          <img
            src={`/api/files/${participant.profilePicId}`}
            alt={participant.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-discord-primary flex items-center justify-center text-white font-medium">
            {safeName.charAt(0).toUpperCase()}
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

export const ActivityPanel: React.FC<ActivityPanelProps> = ({
  participants,
  onClose,
  roomId,
}) => {
  const { user } = useAuth();
  const { status, isOnline, isAway, isOffline, setStatus } =
    useUserStatus(roomId);

  // Invite functionality state
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // Generate room invite link
  const roomInviteLink = `${window.location.origin}/room/${roomId}`;

  // Copy invite link to clipboard
  const copyInviteLink = async () => {
    try {
      await navigator.clipboard.writeText(roomInviteLink);
      setCopied(true);
      toast.success('Room link copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error('Failed to copy link');
    }
  };

  // Share room link (if Web Share API is available)
  const shareRoomLink = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join my coding room',
          text: 'Join me for collaborative coding!',
          url: roomInviteLink,
        });
      } catch (error) {
        // User cancelled sharing or share failed
        copyInviteLink(); // Fallback to copy
      }
    } else {
      copyInviteLink(); // Fallback for browsers without Web Share API
    }
  };

  // Separate participants by status
  const onlineParticipants = participants.filter(
    p => p.isOnline && (p.status === 'online' || p.status === 'in-room')
  );
  const awayParticipants = participants.filter(
    p => p.isOnline && p.status === 'away'
  );
  const offlineParticipants = participants.filter(
    p => !p.isOnline || p.status === 'offline'
  );

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

  const MemberItem: React.FC<{
    participant: RoomParticipant;
    isOffline?: boolean;
  }> = ({ participant, isOffline = false }) => (
    <div
      className={`flex items-center px-2 py-1 rounded hover:bg-discord-sidebar-hover transition-colors cursor-pointer ${isOffline ? 'opacity-50' : ''}`}
    >
      <UserAvatar participant={participant} />
      <div className="ml-3 flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span
            className={`text-sm font-medium ${isOffline ? 'text-muted-foreground' : 'text-foreground'} truncate`}
          >
            {participant.name}
          </span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="w-full bg-discord-activity border-l border-border flex flex-col h-full">
      <div className="p-4 border-b border-border flex-shrink-0">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">
            Participants ({onlineParticipants.length} Online,{' '}
            {awayParticipants.length} Away, {offlineParticipants.length}{' '}
            Offline)
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
          {totalParticipants === 0 ? (
            <div className="mb-6">
              <p className="text-sm text-muted-foreground mb-4">
                No participants yet...
              </p>
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
                    {onlineParticipants.map(participant => (
                      <MemberItem
                        key={participant.id}
                        participant={participant}
                      />
                    ))}
                    {awayParticipants.map(participant => (
                      <MemberItem
                        key={participant.id}
                        participant={participant}
                      />
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
                    {offlineParticipants.map(participant => (
                      <MemberItem
                        key={participant.id}
                        participant={participant}
                        isOffline
                      />
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
        <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
          <DialogTrigger asChild>
            <button className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-md transition-colors text-sm font-medium">
              <UserPlus className="w-4 h-4" />
              Invite to Room
            </button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Invite Others to Room</DialogTitle>
              <DialogDescription>
                Share this link with others to invite them to collaborate in this room.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Room ID</label>
                <div className="flex items-center space-x-2">
                  <Input
                    value={roomId || 'Loading...'}
                    readOnly
                    className="bg-muted"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (roomId) {
                        navigator.clipboard.writeText(roomId);
                        toast.success('Room ID copied!');
                      }
                    }}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Invite Link</label>
                <div className="flex items-center space-x-2">
                  <Input
                    value={roomInviteLink}
                    readOnly
                    className="bg-muted text-xs"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={copyInviteLink}
                    disabled={copied}
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={shareRoomLink}
                  className="flex-1 flex items-center gap-2"
                >
                  <Share className="w-4 h-4" />
                  Share Link
                </Button>
                <Button
                  variant="outline"
                  onClick={copyInviteLink}
                  className="flex items-center gap-2"
                >
                  <Link className="w-4 h-4" />
                  Copy
                </Button>
              </div>

              <div className="text-xs text-muted-foreground bg-muted p-3 rounded-md">
                💡 <strong>Tip:</strong> Anyone with this link can join your room. 
                Make sure to only share it with people you trust!
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};
