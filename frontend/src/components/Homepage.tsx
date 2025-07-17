import { useState, useEffect } from 'react';
import { Plus, Users, Clock, Lock, Globe, LogOut, UserPlus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { Room, roomAPI } from '@/lib/api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Loader2 } from 'lucide-react';

const Homepage = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [showJoinRoom, setShowJoinRoom] = useState(false);
  const [showJoinByIdDialog, setShowJoinByIdDialog] = useState(false);
  const [joinRoomId, setJoinRoomId] = useState('');
  const [joinRoomIdInput, setJoinRoomIdInput] = useState('');
  const [joinRoomPassword, setJoinRoomPassword] = useState('');
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomDescription, setNewRoomDescription] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [roomPassword, setRoomPassword] = useState('');

  // Fetch user rooms
  const { data: rooms = [], isLoading: roomsLoading, error } = useQuery({
    queryKey: ['rooms'],
    queryFn: roomAPI.getUserRooms,
  });

  // Create room mutation
  const createRoomMutation = useMutation({
    mutationFn: ({ name, description, isPrivate, password }: { name: string; description: string; isPrivate: boolean; password?: string }) =>
      roomAPI.createRoom(name, description, isPrivate, password),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      setShowCreateRoom(false);
      setNewRoomName('');
      setNewRoomDescription('');
      setIsPrivate(false);
      setRoomPassword('');
      // Navigate to the newly created room
      navigate(`/room/${data.room.id}`);
    },
  });

  // Join room mutation
  const joinRoomMutation = useMutation({
    mutationFn: ({ roomId, password }: { roomId: string; password?: string }) =>
      roomAPI.joinRoom(roomId, password),
    onSuccess: (data) => {
      setShowJoinRoom(false);
      setShowJoinByIdDialog(false);
      setJoinRoomId('');
      setJoinRoomIdInput('');
      setJoinRoomPassword('');
      navigate(`/room/${data.room.id}`);
    },
  });

  // Filter rooms based on search
  const filteredRooms = rooms.filter((room: Room) =>
    (room.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (room.description || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCreateRoom = async () => {
    if (newRoomName.trim()) {
      if (isPrivate && !roomPassword.trim()) {
        // Could add error state here
        return;
      }
      
      createRoomMutation.mutate({
        name: newRoomName,
        description: newRoomDescription,
        isPrivate,
        password: isPrivate ? roomPassword : undefined,
      });
    }
  };

  const handleJoinRoom = (room: Room) => {
    if (room.isPrivate) {
      // Show password dialog for private rooms
      setJoinRoomId(room.id);
      setShowJoinRoom(true);
    } else {
      // Join public room directly
      joinRoomMutation.mutate({ roomId: room.id });
    }
  };

  const handleJoinRoomWithPassword = () => {
    if (joinRoomId) {
      joinRoomMutation.mutate({ 
        roomId: joinRoomId, 
        password: joinRoomPassword 
      });
    }
  };

  const handleJoinRoomById = async () => {
    if (joinRoomIdInput.trim()) {
      try {
        // First try to get room info to check if it's private
        const roomInfo = await roomAPI.getRoom(joinRoomIdInput.trim());
        
        if (roomInfo.isPrivate) {
          // If private, show password dialog
          setJoinRoomId(joinRoomIdInput.trim());
          setShowJoinByIdDialog(false);
          setShowJoinRoom(true);
        } else {
          // If public, join directly
          joinRoomMutation.mutate({ roomId: joinRoomIdInput.trim() });
          setShowJoinByIdDialog(false);
          setJoinRoomIdInput('');
        }
      } catch (error) {
        // If room doesn't exist or other error, show error
        console.error('Error getting room info:', error);
        // For now, just try to join and let the backend handle the error
        joinRoomMutation.mutate({ roomId: joinRoomIdInput.trim() });
        setShowJoinByIdDialog(false);
        setJoinRoomIdInput('');
      }
    }
  };

  const formatDateTime = (dateTimeString: string) => {
    const date = new Date(dateTimeString);
    return {
      date: date.toLocaleDateString(),
      time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
  };

  if (roomsLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex items-center gap-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Loading rooms...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold">HiveCodeX</h1>
            <span className="text-sm text-muted-foreground">
              Welcome back, {user?.name}!
            </span>
          </div>
          <Button variant="ghost" size="sm" onClick={logout}>
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Search and Create */}
        <div className="flex items-center gap-4 mb-8">
          <div className="flex-1">
            <Input
              placeholder="Search rooms..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full"
            />
          </div>
          <Dialog open={showJoinByIdDialog} onOpenChange={setShowJoinByIdDialog}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <UserPlus className="w-4 h-4 mr-2" />
                Join Room
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Join Room by ID</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="joinRoomIdInput">Room ID</Label>
                  <Input
                    id="joinRoomIdInput"
                    value={joinRoomIdInput}
                    onChange={(e) => setJoinRoomIdInput(e.target.value)}
                    placeholder="Enter room ID"
                  />
                </div>
                <Button 
                  onClick={handleJoinRoomById}
                  disabled={!joinRoomIdInput.trim() || joinRoomMutation.isPending}
                  className="w-full"
                >
                  {joinRoomMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Joining...
                    </>
                  ) : (
                    'Join Room'
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={showCreateRoom} onOpenChange={setShowCreateRoom}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Create Room
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Room</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="roomName">Room Name</Label>
                  <Input
                    id="roomName"
                    value={newRoomName}
                    onChange={(e) => setNewRoomName(e.target.value)}
                    placeholder="Enter room name"
                  />
                </div>
                <div>
                  <Label htmlFor="roomDescription">Description</Label>
                  <Textarea
                    id="roomDescription"
                    value={newRoomDescription}
                    onChange={(e) => setNewRoomDescription(e.target.value)}
                    placeholder="Enter room description"
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="private"
                    checked={isPrivate}
                    onCheckedChange={setIsPrivate}
                  />
                  <Label htmlFor="private">Private room</Label>
                </div>
                {isPrivate && (
                  <div>
                    <Label htmlFor="roomPassword">Room Password</Label>
                    <Input
                      id="roomPassword"
                      type="password"
                      value={roomPassword}
                      onChange={(e) => setRoomPassword(e.target.value)}
                      placeholder="Enter room password"
                    />
                  </div>
                )}
                <Button 
                  onClick={handleCreateRoom} 
                  disabled={!newRoomName.trim() || (isPrivate && !roomPassword.trim()) || createRoomMutation.isPending}
                  className="w-full"
                >
                  {createRoomMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create Room'
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          
          {/* Join Room Dialog */}
          <Dialog open={showJoinRoom} onOpenChange={setShowJoinRoom}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Join Private Room</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="joinPassword">Room Password</Label>
                  <Input
                    id="joinPassword"
                    type="password"
                    value={joinRoomPassword}
                    onChange={(e) => setJoinRoomPassword(e.target.value)}
                    placeholder="Enter room password"
                  />
                </div>
                <Button 
                  onClick={handleJoinRoomWithPassword}
                  disabled={!joinRoomPassword.trim() || joinRoomMutation.isPending}
                  className="w-full"
                >
                  {joinRoomMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Joining...
                    </>
                  ) : (
                    'Join Room'
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Rooms Grid */}
        {filteredRooms.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-muted-foreground mb-4">
              {searchTerm ? 'No rooms found matching your search.' : 'No rooms yet. Create your first room!'}
            </div>
            {!searchTerm && (
              <Button onClick={() => setShowCreateRoom(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Create Room
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredRooms.map((room: Room) => {
              const { date, time } = formatDateTime(room.dateTime);
              return (
                <Card key={room.id} className="cursor-pointer hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{room.name}</CardTitle>
                      <div className="flex items-center gap-2">
                        {room.isPrivate ? (
                          <Lock className="w-4 h-4 text-muted-foreground" />
                        ) : (
                          <Globe className="w-4 h-4 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                    <CardDescription>{room.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between text-sm text-muted-foreground mb-4">
                      <div className="flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        <span>{room.participants || 0} participants</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        <span>{time}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded">
                        {room.language || 'Multiple'}
                      </span>
                      <Button 
                        size="sm" 
                        onClick={() => handleJoinRoom(room)}
                      >
                        Join Room
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Homepage;