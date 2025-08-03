import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, Users, ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { activityAPI } from '@/lib/api';
import { formatDistanceToNow } from 'date-fns';

interface JoinedRoom {
  roomId: string;
  roomName: string;
  lastJoined: string;
  joinCount: number;
}

export const JoinedRoomsList: React.FC = () => {
  const [joinedRooms, setJoinedRooms] = useState<JoinedRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchJoinedRooms = async () => {
      try {
        setLoading(true);
        const rooms = await activityAPI.getJoinedRooms();
        setJoinedRooms(rooms);
        setError(null);
      } catch (err) {
        console.error('Failed to fetch joined rooms:', err);
        setError('Failed to load joined rooms');
      } finally {
        setLoading(false);
      }
    };

    fetchJoinedRooms();
  }, []);

  const handleJoinRoom = (roomId: string) => {
    navigate(`/room/${roomId}`);
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recently Joined Rooms</CardTitle>
          <CardDescription>Rooms you've participated in before</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="ml-2">Loading your rooms...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recently Joined Rooms</CardTitle>
          <CardDescription>Rooms you've participated in before</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            {error}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (joinedRooms.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recently Joined Rooms</CardTitle>
          <CardDescription>Rooms you've participated in before</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No rooms joined yet</p>
            <p className="text-sm mt-2">Join or create a room to get started!</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recently Joined Rooms</CardTitle>
        <CardDescription>
          {joinedRooms.length} room{joinedRooms.length !== 1 ? 's' : ''} you've participated in
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {joinedRooms.slice(0, 10).map((room) => (
            <div
              key={room.roomId}
              className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <h4 className="font-medium truncate">
                  {room.roomName}
                </h4>
                <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatDistanceToNow(new Date(room.lastJoined), { addSuffix: true })}
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    Joined {room.joinCount} time{room.joinCount !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleJoinRoom(room.roomId)}
                className="ml-2 hover:bg-primary hover:text-primary-foreground"
              >
                Join <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
          ))}
          
          {joinedRooms.length > 10 && (
            <div className="text-center pt-2">
              <span className="text-sm text-muted-foreground">
                And {joinedRooms.length - 10} more...
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
