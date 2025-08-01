import { useState, useEffect } from 'react';
import {
  Plus,
  Users,
  Clock,
  Lock,
  Globe,
  LogOut,
  UserPlus,
  Trash2,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import SettingsModal from './SettingsModal';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { Room, roomAPI } from '@/lib/api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Loader2 } from 'lucide-react';

const Homepage = () => {
  // Dropdown state for user menu
  const [showDropdown, setShowDropdown] = useState(false);
  const navigate = useNavigate();
  const [showSettingsModal, setShowSettingsModal] = useState(false);
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
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [roomToDelete, setRoomToDelete] = useState<Room | null>(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState('');

  // Delete room mutation (must be after queryClient is defined)
  const deleteRoomMutation = useMutation({
    mutationFn: (roomId: string) => roomAPI.deleteRoom(roomId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      setShowDeleteDialog(false);
      setRoomToDelete(null);
      setDeleteConfirmName('');
    },
  });

  // Fetch user rooms
  const {
    data: rooms = [],
    isLoading: roomsLoading,
    error,
  } = useQuery({
    queryKey: ['rooms'],
    queryFn: roomAPI.getUserRooms,
  });

  // Create room mutation
  const createRoomMutation = useMutation({
    mutationFn: ({
      name,
      description,
      isPrivate,
      password,
    }: {
      name: string;
      description: string;
      isPrivate: boolean;
      password?: string;
    }) => roomAPI.createRoom(name, description, isPrivate, password),
    onSuccess: data => {
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
    onSuccess: data => {
      setShowJoinRoom(false);
      setShowJoinByIdDialog(false);
      setJoinRoomId('');
      setJoinRoomIdInput('');
      setJoinRoomPassword('');
      navigate(`/room/${data.room.id}`);
    },
  });

  // Filter rooms based on search
  const filteredRooms = rooms.filter(
    (room: Room) =>
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
        password: joinRoomPassword,
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
    <>
      <div className="min-h-screen bg-black flex flex-col relative overflow-hidden">
        {/* Animated Aurora/Blob Background */}
        <div
          aria-hidden="true"
          className="pointer-events-none select-none absolute inset-0 z-0 overflow-hidden"
        >
          <div className="absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full bg-gradient-to-tr from-blue-900 via-indigo-800 to-purple-900 opacity-70 blur-3xl animate-blob1" />
          <div className="absolute top-1/2 right-0 w-[400px] h-[400px] rounded-full bg-gradient-to-tr from-cyan-800 via-sky-900 to-blue-900 opacity-60 blur-3xl animate-blob2" />
          <div className="absolute bottom-0 left-1/3 w-[600px] h-[300px] rounded-full bg-gradient-to-tr from-fuchsia-800 via-violet-900 to-indigo-900 opacity-60 blur-3xl animate-blob3" />
          <style>{`
          @keyframes blob1 {
            0%, 100% { transform: scale(1) translateY(0) translateX(0); }
            50% { transform: scale(1.1) translateY(40px) translateX(30px); }
          }
          @keyframes blob2 {
            0%, 100% { transform: scale(1) translateY(0) translateX(0); }
            50% { transform: scale(1.05) translateY(-30px) translateX(-40px); }
          }
          @keyframes blob3 {
            0%, 100% { transform: scale(1) translateY(0) translateX(0); }
            50% { transform: scale(1.08) translateY(30px) translateX(20px); }
          }
          .animate-blob1 { animation: blob1 12s ease-in-out infinite; }
          .animate-blob2 { animation: blob2 14s ease-in-out infinite; }
          .animate-blob3 { animation: blob3 16s ease-in-out infinite; }
        `}</style>
        </div>
        {/* Minimal Header */}
        <header className="border-b border-border bg-card py-4 px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xl font-mono font-bold tracking-tight text-primary">
              HiveCodeX
            </span>
            <span className="text-xs text-muted-foreground hidden sm:inline">
              Collaborate. Code. Connect.
            </span>
          </div>
          <div className="flex items-center gap-2 relative group">
            {/* Dropdown hover logic: use timers to delay close, so mouse can move between button and dropdown */}
            {(() => {
              let closeTimeout: NodeJS.Timeout | null = null;
              const handleEnter = () => {
                if (closeTimeout) clearTimeout(closeTimeout);
                setShowDropdown(true);
              };
              const handleLeave = () => {
                closeTimeout = setTimeout(() => setShowDropdown(false), 350);
              };
              return (
                <div
                  className="relative flex items-center"
                  onMouseEnter={handleEnter}
                  onMouseLeave={handleLeave}
                >
                  <button
                    className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-[#23272f] hover:bg-[#2a2f3a] border border-[#3a3f4a] shadow-lg text-white font-mono text-base font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                    onClick={() => setShowDropdown(v => !v)}
                    aria-haspopup="true"
                    aria-expanded={showDropdown}
                    style={{ zIndex: 51 }}
                  >
                    <span className="truncate max-w-[120px]">{user?.name}</span>
                    <svg
                      className={`w-4 h-4 ml-1 transition-transform ${showDropdown ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </button>
                  {showDropdown && (
                    <div
                      className={`absolute left-0 top-full mt-2 w-48 bg-[#23272f] border border-[#3a3f4a] rounded-lg shadow-2xl z-50
                      transition-all duration-300 origin-top scale-y-100 opacity-100 pointer-events-auto sheet-unfold`}
                      style={{
                        transitionProperty: 'opacity, transform',
                        minWidth: 180,
                      }}
                      onMouseEnter={handleEnter}
                      onMouseLeave={handleLeave}
                    >
                      <button
                        className="w-full text-left px-5 py-2 hover:bg-blue-600/80 hover:text-white text-base font-medium transition-colors"
                        onClick={() => {
                          setShowDropdown(false);
                          setShowSettingsModal(true);
                        }}
                      >
                        Settings
                      </button>
                      <button
                        className="w-full text-left px-5 py-2 hover:bg-red-600/80 hover:text-white text-base font-medium text-red-400 transition-colors"
                        onClick={() => {
                          setShowDropdown(false);
                          logout();
                        }}
                      >
                        Logout
                      </button>
                    </div>
                  )}
                </div>
              );
            })()}
            <style>{`
            .sheet-unfold {
              animation: sheetUnroll 320ms cubic-bezier(0.4,0,0.2,1);
            }
            @keyframes sheetUnroll {
              0% { transform: scaleY(0) rotateX(60deg); opacity: 0; }
              60% { transform: scaleY(1.05) rotateX(-10deg); opacity: 1; }
              100% { transform: scaleY(1) rotateX(0deg); opacity: 1; }
            }
          `}</style>
          </div>
          {/* header ends above */}
        </header>

        <main className="flex-1 flex flex-col items-center justify-center px-4 py-8 w-full max-w-4xl mx-auto relative z-10">
          {/* Settings Button */}
          <Button
            variant="outline"
            className="absolute top-6 right-6 z-20"
            onClick={() => setShowSettingsModal(true)}
          >
            Settings
          </Button>
          {/* Settings Modal */}
          <SettingsModal
            open={showSettingsModal}
            onClose={() => setShowSettingsModal(false)}
          />
          {/* Hero Section */}
          <section className="w-full flex flex-col items-center mb-10">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-2 font-mono">
              Welcome, {user?.name || 'Developer'}!
            </h2>
            <p className="text-center text-muted-foreground max-w-xl mb-6">
              Instantly create or join collaborative coding rooms. Minimal,
              fast, and built for developers worldwide.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 w-full justify-center">
              <Button
                className="flex-1"
                onClick={() => setShowCreateRoom(true)}
              >
                <Plus className="w-4 h-4 mr-2" /> Create Room
              </Button>
              <Button
                className="flex-1"
                variant="outline"
                onClick={() => setShowJoinByIdDialog(true)}
              >
                <UserPlus className="w-4 h-4 mr-2" /> Join Room
              </Button>
            </div>
          </section>

          {/* Search and Rooms List */}
          <section className="w-full">
            <div className="flex flex-col sm:flex-row items-center gap-3 mb-6">
              <Input
                placeholder="Search your rooms..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="flex-1"
                aria-label="Search rooms"
              />
            </div>

            {filteredRooms.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-muted-foreground mb-4">
                  {searchTerm
                    ? 'No rooms found matching your search.'
                    : 'No rooms yet. Create your first room!'}
                </div>
                {!searchTerm && (
                  <Button onClick={() => setShowCreateRoom(true)}>
                    <Plus className="w-4 h-4 mr-2" /> Create Room
                  </Button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {filteredRooms.map((room: Room) => {
                  const { time } = formatDateTime(room.dateTime);
                  const isOwner = user && room.userId === user.id;
                  return (
                    <Card
                      key={room.id}
                      className="hover:shadow-md transition-shadow border border-border bg-card/80"
                    >
                      <CardHeader className="pb-2 flex flex-row items-center justify-between">
                        <div>
                          <CardTitle className="text-base font-mono font-semibold">
                            {room.name}
                          </CardTitle>
                          <CardDescription className="truncate max-w-xs text-xs">
                            {room.description}
                          </CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                          {room.isPrivate ? (
                            <Lock className="w-4 h-4 text-muted-foreground" />
                          ) : (
                            <Globe className="w-4 h-4 text-muted-foreground" />
                          )}
                          {isOwner && (
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label="Delete Room"
                              className="text-destructive hover:bg-destructive/10"
                              onClick={() => {
                                setRoomToDelete(room);
                                setShowDeleteDialog(true);
                              }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0 flex flex-col gap-2">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {room.participants || 0} devs
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {time}
                          </span>
                          <span className="bg-primary/10 text-primary px-2 py-0.5 rounded font-mono">
                            {room.language || 'Multiple'}
                          </span>
                        </div>
                        <Button
                          size="sm"
                          className="w-full mt-2"
                          onClick={() => handleJoinRoom(room)}
                        >
                          Join Room
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
                {/* Delete Room Confirmation Dialog */}
                <Dialog
                  open={showDeleteDialog}
                  onOpenChange={setShowDeleteDialog}
                >
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Delete Room</DialogTitle>
                    </DialogHeader>
                    {roomToDelete && (
                      <div className="space-y-4 text-center">
                        <div className="text-destructive text-sm">
                          Are you sure you want to <b>delete</b> the room{' '}
                          <b>"{roomToDelete.name}"</b>?<br />
                          This action cannot be undone.
                          <br />
                          <br />
                          Please type <b>"{roomToDelete.name}"</b> to confirm.
                        </div>
                        <Input
                          autoFocus
                          value={deleteConfirmName}
                          onChange={e => setDeleteConfirmName(e.target.value)}
                          placeholder={`Type "${roomToDelete.name}" to confirm`}
                          aria-label="Confirm room name"
                          className="text-center"
                        />
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            onClick={() => {
                              setShowDeleteDialog(false);
                              setRoomToDelete(null);
                              setDeleteConfirmName('');
                            }}
                            className="flex-1"
                          >
                            Cancel
                          </Button>
                          <Button
                            variant="destructive"
                            className="flex-1"
                            disabled={
                              deleteConfirmName !== roomToDelete.name ||
                              deleteRoomMutation.isPending
                            }
                            onClick={() =>
                              roomToDelete &&
                              deleteRoomMutation.mutate(roomToDelete.id)
                            }
                          >
                            {deleteRoomMutation.isPending ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />{' '}
                                Deleting...
                              </>
                            ) : (
                              'Delete Room'
                            )}
                          </Button>
                        </div>
                      </div>
                    )}
                  </DialogContent>
                </Dialog>
              </div>
            )}
          </section>
        </main>

        {/* Dialogs (modular, minimal) */}
        <Dialog open={showCreateRoom} onOpenChange={setShowCreateRoom}>
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
                  onChange={e => setNewRoomName(e.target.value)}
                  placeholder="Enter room name"
                  autoFocus
                />
              </div>
              <div>
                <Label htmlFor="roomDescription">Description</Label>
                <Textarea
                  id="roomDescription"
                  value={newRoomDescription}
                  onChange={e => setNewRoomDescription(e.target.value)}
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
                    onChange={e => setRoomPassword(e.target.value)}
                    placeholder="Enter room password"
                  />
                </div>
              )}
              <Button
                onClick={handleCreateRoom}
                disabled={
                  !newRoomName.trim() ||
                  (isPrivate && !roomPassword.trim()) ||
                  createRoomMutation.isPending
                }
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

        <Dialog open={showJoinByIdDialog} onOpenChange={setShowJoinByIdDialog}>
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
                  onChange={e => setJoinRoomIdInput(e.target.value)}
                  placeholder="Enter room ID"
                  autoFocus
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
                  onChange={e => setJoinRoomPassword(e.target.value)}
                  placeholder="Enter room password"
                  autoFocus
                />
              </div>
              <Button
                onClick={handleJoinRoomWithPassword}
                disabled={
                  !joinRoomPassword.trim() || joinRoomMutation.isPending
                }
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
    </>
  );
};

export default Homepage;
