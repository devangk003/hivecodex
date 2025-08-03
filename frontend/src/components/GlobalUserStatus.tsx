import React, { useState, useEffect } from 'react';
import { Circle, Moon, Wifi, WifiOff, Users, Crown } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { activityAPI } from '@/lib/api';

interface GlobalUser {
  id: string;
  name: string;
  email: string;
  profilePicId?: string;
  activityStatus: string;
  currentRoomId?: string;
  isOnline: boolean;
  lastLogin?: string;
}

const getStatusIcon = (status: string, isOnline: boolean) => {
  if (!isOnline) return <WifiOff className="w-3 h-3" />;
  if (status === 'away') return <Moon className="w-3 h-3" />;
  if (status === 'in-room') return <Users className="w-3 h-3" />;
  return <Circle className="w-3 h-3 fill-current" />;
};

const getStatusColor = (status: string, isOnline: boolean) => {
  if (!isOnline) return 'text-red-500';
  if (status === 'away') return 'text-yellow-500';
  if (status === 'in-room') return 'text-blue-500';
  return 'text-green-500';
};

const getStatusText = (status: string, isOnline: boolean, currentRoomId?: string) => {
  if (!isOnline) return 'Offline';
  if (status === 'away') return 'Away';
  if (status === 'in-room' && currentRoomId) return `In Room: ${currentRoomId.slice(0, 8)}...`;
  return 'Online';
};

const UserAvatar: React.FC<{ user: GlobalUser; size?: number }> = ({
  user,
  size = 32,
}) => {
  const statusColor = getStatusColor(user.activityStatus, user.isOnline);

  return (
    <div className="relative">
      <div
        className="rounded-full overflow-hidden bg-discord-sidebar flex items-center justify-center"
        style={{ width: size, height: size }}
      >
        {user.profilePicId ? (
          <img
            src={`/api/auth/profile/picture/${user.profilePicId}`}
            alt={user.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-discord-primary flex items-center justify-center text-white font-medium">
            {user.name.charAt(0).toUpperCase()}
          </div>
        )}
      </div>
      {user.isOnline && (
        <div
          className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-discord-activity ${statusColor.replace('text-', 'bg-')}`}
        />
      )}
    </div>
  );
};

export const GlobalUserStatus: React.FC = () => {
  const [users, setUsers] = useState<GlobalUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchGlobalUserStatus = async () => {
      try {
        setLoading(true);
        const userData = await activityAPI.getGlobalUserStatus();
        setUsers(userData);
        setError(null);
      } catch (err) {
        console.error('Failed to fetch global user status:', err);
        setError('Failed to load user status');
      } finally {
        setLoading(false);
      }
    };

    fetchGlobalUserStatus();

    // Refresh every 30 seconds
    const interval = setInterval(fetchGlobalUserStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const onlineUsers = users.filter(user => user.isOnline);
  const offlineUsers = users.filter(user => !user.isOnline);
  const usersInRooms = users.filter(user => user.activityStatus === 'in-room');

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Global User Activity</CardTitle>
          <CardDescription>See what everyone is up to</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            Loading user activity...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Global User Activity</CardTitle>
          <CardDescription>See what everyone is up to</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            {error}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Global User Activity
          <Badge variant="secondary" className="text-xs">
            {onlineUsers.length} online
          </Badge>
        </CardTitle>
        <CardDescription>
          {usersInRooms.length} user{usersInRooms.length !== 1 ? 's' : ''} in rooms, {onlineUsers.length - usersInRooms.length} available
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-64">
          <div className="space-y-4">
            {/* Online Users */}
            {onlineUsers.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-muted-foreground uppercase mb-2">
                  Online — {onlineUsers.length}
                </h4>
                <div className="space-y-2">
                  {onlineUsers.map(user => (
                    <div
                      key={user.id}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/50 transition-colors"
                    >
                      <UserAvatar user={user} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium truncate">
                            {user.name}
                          </span>
                          <div className={`flex items-center gap-1 ${getStatusColor(user.activityStatus, user.isOnline)}`}>
                            {getStatusIcon(user.activityStatus, user.isOnline)}
                            <span className="text-xs">
                              {getStatusText(user.activityStatus, user.isOnline, user.currentRoomId)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Offline Users */}
            {offlineUsers.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-muted-foreground uppercase mb-2">
                  Offline — {offlineUsers.length}
                </h4>
                <div className="space-y-2">
                  {offlineUsers.slice(0, 5).map(user => (
                    <div
                      key={user.id}
                      className="flex items-center gap-3 p-2 rounded-lg opacity-50"
                    >
                      <UserAvatar user={user} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium truncate">
                            {user.name}
                          </span>
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <WifiOff className="w-3 h-3" />
                            <span className="text-xs">Offline</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  {offlineUsers.length > 5 && (
                    <div className="text-center text-xs text-muted-foreground">
                      And {offlineUsers.length - 5} more offline...
                    </div>
                  )}
                </div>
              </div>
            )}

            {users.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No users found
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
