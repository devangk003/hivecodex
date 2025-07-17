import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, MessageSquare, Users, ChevronRight, Mic, MicOff, Headphones, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ActivityBar } from '@/components/ActivityBar';
import { PanelContainer } from '@/components/PanelContainer';
import { MonacoEditor } from '@/components/MonacoEditor';
import { ActivityPanel } from '@/components/ActivityPanel';
import { Chat } from '@/components/Chat';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import socketService from '@/lib/socket';

interface FileTreeItem {
  id: string;
  name: string;
  type: 'file' | 'folder';
  path: string;
  size?: number;
  content?: string;
  extension?: string;
  children?: FileTreeItem[];
  isExpanded?: boolean;
  isSelected?: boolean;
  lastModified?: Date;
  fileId?: string;
}

interface Participant {
  id: string;
  name: string;
  avatar?: string;
  isOnline: boolean;
  status: 'online' | 'away' | 'offline';
  lastSeen?: Date;
}

const Room = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // Panel state
  const [isExplorerOpen, setIsExplorerOpen] = useState(true);
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(true);
  const [isRightPanelMinimized, setIsRightPanelMinimized] = useState(false);
  const [activeView, setActiveView] = useState('files');
  
  // Voice state
  const [isVoiceConnected, setIsVoiceConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  
  // Participant state
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [selectedFile, setSelectedFile] = useState<FileTreeItem | null>(null);

  // Initialize socket connection and listeners
  useEffect(() => {
    if (!roomId || !user) return;

    // Join room with user info
    socketService.joinRoom(roomId, user);

    // Listen for participant updates
    const handleParticipantJoined = (participant: any) => {
      setParticipants(prev => {
        const existing = prev.find(p => p.id === participant.userId);
        if (existing) {
          return prev.map(p => p.id === participant.userId ? { 
            ...p, 
            isOnline: true, 
            status: 'online' as const 
          } : p);
        }
        return [...prev, { 
          id: participant.userId, 
          name: participant.userName || participant.name, 
          isOnline: true,
          status: 'online' as const
        }];
      });
      
      // Add system message for user joining (if not current user)
      if (participant.userId !== user?.id) {
        // Here you could emit a system message or handle it via socket
        console.log(`${participant.userName || participant.name} joined the room`);
      }
    };

    const handleParticipantLeft = (data: { userId: string; name: string }) => {
      setParticipants(prev => 
        prev.map(p => p.id === data.userId ? { ...p, isOnline: false, status: 'offline' as const, lastSeen: new Date() } : p)
      );
      
      // Add system message for user leaving
      console.log(`${data.name} left the room`);
    };

    const handleParticipantList = (participantList: any[]) => {
      console.log('Received participant list:', participantList);
      
      setParticipants(prev => {
        // Create a map of current participants to preserve offline ones
        const currentParticipants = new Map(prev.map(p => [p.id, p]));
        
        // Process new participant list
        const updatedParticipants = participantList.map(p => {
          const isOnline = p.online || false;
          const status = isOnline ? 'online' as const : 'offline' as const;
          console.log(`Participant ${p.userName || p.name}: online=${p.online}, isOnline=${isOnline}, status=${status}`);
          
          return {
            id: p.userId || p.id,
            name: p.userName || p.name,
            isOnline: isOnline,
            status: status,
            avatar: p.avatar,
            lastSeen: !isOnline ? new Date() : undefined
          };
        });
        
        // Merge with existing offline participants that aren't in the new list
        const newParticipantIds = new Set(updatedParticipants.map(p => p.id));
        const preservedOfflineParticipants = prev.filter(p => 
          !p.isOnline && !newParticipantIds.has(p.id)
        );
        
        const finalParticipants = [...updatedParticipants, ...preservedOfflineParticipants];
        console.log('Final participants:', finalParticipants);
        return finalParticipants;
      });
    };

    const handleUserStatusUpdate = (data: { userId: string; userName: string; status: string }) => {
      setParticipants(prev => 
        prev.map(p => p.id === data.userId ? { 
          ...p, 
          status: data.status as 'online' | 'away' | 'offline',
          isOnline: data.status !== 'offline'
        } : p)
      );
    };

    // Set up socket listeners
    socketService.onUserJoined(handleParticipantJoined);
    socketService.onUserLeft(handleParticipantLeft);
    socketService.onRoomParticipants(handleParticipantList);
    socketService.onUserStatusUpdate(handleUserStatusUpdate);

    // Cleanup
    return () => {
      // Listeners are now managed by socketService
    };
  }, [roomId, user]);

  // Voice controls
  const handleVoiceToggle = useCallback(() => {
    setIsVoiceConnected(!isVoiceConnected);
    // TODO: Implement actual voice connection logic
  }, [isVoiceConnected]);

  const handleMuteToggle = useCallback(() => {
    setIsMuted(!isMuted);
    // TODO: Implement actual mute logic
  }, [isMuted]);

  const handleDeafenToggle = useCallback(() => {
    setIsDeafened(!isDeafened);
    if (!isDeafened) {
      setIsMuted(true); // Deafening also mutes
    }
    // TODO: Implement actual deafen logic
  }, [isDeafened]);

  // File selection handler
  const handleFileSelect = useCallback((file: FileTreeItem) => {
    setSelectedFile(file);
    // TODO: Load file content and display in code editor
  }, []);

  const onlineCount = participants.filter(p => p.status === 'online' && p.isOnline).length;
  const awayCount = participants.filter(p => p.status === 'away' && p.isOnline).length;
  const offlineCount = participants.filter(p => !p.isOnline).length;
  const activeParticipants = participants.filter(p => p.isOnline);
  const totalCount = participants.length; // Include all participants (online and offline)

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      {/* Room Header */}
      <header className="h-12 border-b border-border bg-card flex items-center px-4 flex-shrink-0 z-10">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/')}
          className="mr-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Rooms
        </Button>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <h1 className="text-sm font-medium truncate">Room {roomId}</h1>
          <span className="text-xs text-muted-foreground">•</span>
          <span className="text-xs text-muted-foreground">HiveCodeX</span>
          <span className="text-xs text-muted-foreground">•</span>
          <span className="text-xs text-green-500">Online: {onlineCount}</span>
          {awayCount > 0 && (
            <>
              <span className="text-xs text-muted-foreground">•</span>
              <span className="text-xs text-yellow-500">Away: {awayCount}</span>
            </>
          )}
          {offlineCount > 0 && (
            <>
              <span className="text-xs text-muted-foreground">•</span>
              <span className="text-xs text-red-500">Offline: {offlineCount}</span>
            </>
          )}
          <span className="text-xs text-muted-foreground">•</span>
          <span className="text-xs text-muted-foreground">Total: {totalCount}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className={`h-8 w-8 p-0 panel-button ${isRightPanelOpen && !isRightPanelMinimized ? 'bg-discord-primary' : 'hover:bg-discord-sidebar-hover'}`}
            onClick={() => {
              if (isRightPanelMinimized) {
                setIsRightPanelMinimized(false);
              } else {
                setIsRightPanelOpen(!isRightPanelOpen);
              }
            }}
          >
            <MessageSquare className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Room Content */}
      <div className="flex-1 flex min-h-0 overflow-hidden relative">
        <PanelGroup direction="horizontal" className="h-full">
          {/* Activity Bar - Always visible */}
          <div className="flex">
            <ActivityBar
              activeView={activeView}
              onViewChange={setActiveView}
              isPanelOpen={isExplorerOpen}
              onPanelToggle={() => setIsExplorerOpen(!isExplorerOpen)}
              isVoiceConnected={isVoiceConnected}
              onVoiceToggle={handleVoiceToggle}
              isMuted={isMuted}
              onMuteToggle={handleMuteToggle}
              isDeafened={isDeafened}
              onDeafenToggle={handleDeafenToggle}
              roomId={roomId || ''}
            />
          </div>

          {/* Left Panel - Conditionally show based on explorer state */}
          {isExplorerOpen && (
            <>
              <Panel
                id="explorer-panel"
                order={2}
                defaultSize={20}
                minSize={15}
                maxSize={35}
                className="bg-discord-sidebar border-r border-discord-border border-animated flex-shrink-0"
              >
                <PanelContainer
                  activeView={activeView}
                  isOpen={isExplorerOpen}
                  roomId={roomId || ''}
                  onFileSelect={handleFileSelect}
                />
              </Panel>
              <PanelResizeHandle className="w-1 bg-discord-border hover:bg-discord-primary transition-colors duration-200" />
            </>
          )}

          {/* Main Editor */}
          <Panel
            id="editor-panel"
            order={isExplorerOpen ? 3 : 2}
            defaultSize={isExplorerOpen ? 60 : 80}
            minSize={30}
            className="bg-discord-primary"
          >
            <div className="h-full overflow-hidden">
              <MonacoEditor 
                roomId={roomId || ''}
                selectedFile={selectedFile}
                onFileContentChange={(fileId, content) => {
                  // TODO: Implement real-time collaboration
                  console.log('File content changed:', fileId, content);
                }}
              />
            </div>
          </Panel>

          {/* Right Panel - Chat & Activity */}
          {isRightPanelOpen && !isRightPanelMinimized && (
            <>
              <PanelResizeHandle className="w-1 bg-discord-border hover:bg-discord-primary transition-colors duration-200" />
              <Panel
                id="right-panel"
                order={isExplorerOpen ? 4 : 3}
                defaultSize={20}
                minSize={15}
                maxSize={35}
                className="bg-discord-secondary border-l border-discord-border border-animated"
              >
                <div className="h-full flex flex-col">
                  <Tabs defaultValue="activity" className="h-full flex flex-col">
                    <div className="flex items-center justify-between p-2 border-b border-discord-border">
                      <TabsList className="grid w-full grid-cols-2 bg-transparent h-8">
                        <TabsTrigger value="activity" className="text-xs data-[state=active]:bg-discord-primary">
                          <Users className="h-3 w-3 mr-1" />
                          Activity
                        </TabsTrigger>
                        <TabsTrigger value="chat" className="text-xs data-[state=active]:bg-discord-primary">
                          <MessageSquare className="h-3 w-3 mr-1" />
                          Chat
                        </TabsTrigger>
                      </TabsList>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 hover:bg-discord-sidebar-hover ml-2 panel-button"
                        onClick={() => setIsRightPanelMinimized(true)}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                    <TabsContent value="activity" className="flex-1 m-0 p-0 overflow-hidden">
                      <ActivityPanel participants={participants} roomId={roomId || ''} />
                    </TabsContent>
                    <TabsContent value="chat" className="flex-1 m-0 p-0 overflow-hidden">
                      <Chat roomId={roomId || ''} />
                    </TabsContent>
                  </Tabs>
                </div>
              </Panel>
            </>
          )}
        </PanelGroup>

        {/* Minimized Right Panel Pill */}
        {isRightPanelMinimized && (
          <div className="absolute top-0 right-0 h-full flex items-center z-10">
            <div className="bg-discord-sidebar border-l border-discord-border h-full w-12 flex flex-col items-center justify-center gap-2 minimized-pill">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 hover:bg-discord-sidebar-hover panel-button flex items-center justify-center"
                onClick={() => setIsRightPanelMinimized(false)}
                title="Activity Panel"
              >
                <Users className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 hover:bg-discord-sidebar-hover panel-button flex items-center justify-center"
                onClick={() => setIsRightPanelMinimized(false)}
                title="Chat Panel"
              >
                <MessageSquare className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Floating User Profile */}
        <div className="absolute bottom-4 left-16 z-20">
          <div className="bg-discord-sidebar border border-discord-border rounded-lg shadow-lg p-3 w-60">
            <div className="flex items-center">
              <div className="relative">
                <div className="w-10 h-10 relative">
                  <div className="w-10 h-10 rounded-full overflow-hidden">
                    <img 
                      src={user?.profilePicId ? `${API_BASE_URL}/api/files/${user.profilePicId}` : "https://cdn.discordapp.com/embed/avatars/0.png"} 
                      alt={user?.name || "User"} 
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 rounded-full border-2 border-discord-sidebar"></div>
                </div>
              </div>
              <div className="ml-3 flex-1">
                <div className="text-sm font-medium text-white">{user?.name || "User"}</div>
                <div className="text-xs text-discord-text-secondary">
                  <div className="flex items-center">
                    <div className="w-2 h-2 bg-green-500 rounded-full mr-1"></div>
                    Online
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between mt-3">
              <div className="flex items-center gap-2">
                <button className="w-8 h-8 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center transition-colors">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                    <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                  </svg>
                </button>
                <button className="w-8 h-8 bg-discord-button hover:bg-discord-button-hover rounded-full flex items-center justify-center transition-colors">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                  </svg>
                </button>
              </div>
              <button className="w-8 h-8 bg-discord-button hover:bg-discord-button-hover rounded-full flex items-center justify-center transition-colors">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Room;