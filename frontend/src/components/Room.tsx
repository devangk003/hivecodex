  const [selectedFile, setSelectedFile] = useState<SelectedFile | null>(null);
import FloatingUserCard from "./FloatingUserCard";
import type { SelectedFile } from "@/components/MonacoEditor";
import { API_BASE_URL } from "@/lib/api";
import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect, useCallback } from "react";
import {
  ArrowLeft,
  MessageSquare,
  Users,
  ChevronRight,
  Mic,
  MicOff,
  Headphones,
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ActivityBar } from "@/components/ActivityBar";
import { PanelContainer } from "@/components/PanelContainer";
import { MonacoEditor } from "@/components/MonacoEditor";
import { ActivityPanel } from "@/components/ActivityPanel";
import Chat from "@/components/Chat";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import socketService from "@/lib/socket";

interface FileTreeItem {
  id: string;
  name: string;
  type: "file" | "folder";
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

import { User, Participant as APIParticipant } from "@/lib/api";

interface Participant {
  id: string;
  name: string;
  avatar?: string;
  profilePicId?: string;
  isOnline: boolean;
  status: "online" | "away" | "offline";
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
  const [activeView, setActiveView] = useState("files");

  // Voice state
  const [isVoiceConnected, setIsVoiceConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);

  // Participant state
  const [participants, setParticipants] = useState<Participant[]>([]);

  // Initialize socket connection and listeners
  useEffect(() => {
    if (!roomId || !user) return;

    // Join room with user info
    socketService.joinRoom(roomId, user);

    // Listen for participant updates
    const handleParticipantJoined = (participant: APIParticipant) => {
      setParticipants((prev) => {
        const existing = prev.find((p) => p.id === participant.id);
        if (existing) {
          return prev.map((p) =>
            p.id === participant.id
              ? {
                  ...p,
                  isOnline: true,
                  status: "online" as const,
                }
              : p,
          );
        }
        return [
          ...prev,
          {
            id: participant.id,
            name: participant.name,
            isOnline: true,
            status: "online" as const,
            profilePicId: participant.profilePicId,
          },
        ];
      });

      // Add system message for user joining (if not current user)
      if (participant.id !== user?.id) {
        // Here you could emit a system message or handle it via socket
      }
    };

    const handleParticipantLeft = (data: { userId: string; name: string }) => {
      setParticipants((prev) =>
        prev.map((p) =>
          p.id === data.userId
            ? {
                ...p,
                isOnline: false,
                status: "offline" as const,
                lastSeen: new Date(),
              }
            : p,
        ),
      );

      // Add system message for user leaving
    };

    // Updates the participants list by merging the latest participant data from the server
    // with the current state, ensuring online status and profile photos are up-to-date.
    const handleParticipantList = (participantList: APIParticipant[]) => {
      setParticipants((prev) => {
        // Create a map of current participants to preserve offline ones
        const currentParticipants = new Map(prev.map((p) => [p.id, p]));

        // Process new participant list
        const updatedParticipants = participantList.map((p) => {
          const isOnline = p.online || false;
          const status = isOnline ? ("online" as const) : ("offline" as const);

          return {
            id: p.id,
            name: p.name,
            isOnline: isOnline,
            status: status,
            profilePicId: p.profilePicId,
            lastSeen: !isOnline ? new Date() : undefined,
          };
        });
  const [selectedFile, setSelectedFile] = useState<SelectedFile | null>(null);
        // Merge with existing offline participants that aren't in the new list
        const newParticipantIds = new Set(updatedParticipants.map((p) => p.id));
        const preservedOfflineParticipants = prev.filter(
          (p) => !p.isOnline && !newParticipantIds.has(p.id),
        );

        const finalParticipants = [
          ...updatedParticipants,
          ...preservedOfflineParticipants,
        ];
        return finalParticipants;
      });
    };

    const handleUserStatusUpdate = (data: {
      userId: string;
      userName: string;
      status: string;
    }) => {
      setParticipants((prev) =>
        prev.map((p) =>
          p.id === data.userId
            ? {
                ...p,
                status: data.status as "online" | "away" | "offline",
                isOnline: data.status !== "offline",
              }
            : p,
        ),
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
    setIsVoiceConnected((prev) => !prev);
    // TODO: Implement actual voice connect/disconnect logic
  }, []);

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
    if (!file.fileId) return;
    setSelectedFile({
      id: file.id,
      name: file.name,
      content: file.content,
      extension: file.extension,
      fileId: file.fileId,
      path: file.path,
    });
    // TODO: Load file content and display in code editor
  }, []);

  const onlineCount = participants.filter(
    (p) => p.status === "online" && p.isOnline,
  ).length;
  const awayCount = participants.filter(
    (p) => p.status === "away" && p.isOnline,
  ).length;
  const offlineCount = participants.filter((p) => !p.isOnline).length;
  const activeParticipants = participants.filter((p) => p.isOnline);
  const totalCount = participants.length; // Include all participants (online and offline)

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      {/* Room Header */}
      <header className="h-12 border-b border-border bg-card flex items-center px-4 flex-shrink-0 z-10">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/")}
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
              <span className="text-xs text-red-500">
                Offline: {offlineCount}
              </span>
            </>
          )}
          <span className="text-xs text-muted-foreground">•</span>
          <span className="text-xs text-muted-foreground">
            Total: {totalCount}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className={`h-8 w-8 p-0 panel-button ${isRightPanelOpen && !isRightPanelMinimized ? "bg-discord-primary" : "hover:bg-discord-sidebar-hover"}`}
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
              roomId={roomId || ""}
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
                  roomId={roomId || ""}
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
                roomId={roomId || ""}
                selectedFile={selectedFile}
                onFileContentChange={(fileId, content) => {
                  // TODO: Implement real-time collaboration
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
                  <Tabs
                    defaultValue="activity"
                    className="h-full flex flex-col"
                  >
                    <div className="flex items-center justify-between p-2 border-b border-discord-border">
                      <TabsList className="grid w-full grid-cols-2 bg-transparent h-8">
                        <TabsTrigger
                          value="activity"
                          className="text-xs data-[state=active]:bg-discord-primary"
                        >
                          <Users className="h-3 w-3 mr-1" />
                          Activity
                        </TabsTrigger>
                        <TabsTrigger
                          value="chat"
                          className="text-xs data-[state=active]:bg-discord-primary"
                        >
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
                    <TabsContent
                      value="activity"
                      className="flex-1 m-0 p-0 overflow-hidden"
                    >
                      <ActivityPanel
                        participants={participants}
                        roomId={roomId || ""}
                      />
                    </TabsContent>
                    <TabsContent
                      value="chat"
                      className="flex-1 m-0 p-0 overflow-hidden"
                    >
                      <Chat roomId={roomId || ""} />
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

        <FloatingUserCard user={user} />
      </div>
    </div>
  );
};

export default Room;
