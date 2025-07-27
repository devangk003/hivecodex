import React from "react";
import {
  File,
  Search,
  GitBranch,
  Package,
  Settings,
  User,
  LogOut,
  UserCheck,
  Crown,
  Copy,
  Mic,
  MicOff,
  Headphones,
  Circle,
  Moon,
  Wifi,
  WifiOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";

interface ActivityBarItem {
  id: string;
  icon: React.ReactNode;
  label: string;
  isActive?: boolean;
}

const activityBarItems: ActivityBarItem[] = [
  { id: "files", icon: <File className="w-5 h-5" />, label: "Explorer" },
  { id: "search", icon: <Search className="w-5 h-5" />, label: "Search" },
  {
    id: "git",
    icon: <GitBranch className="w-5 h-5" />,
    label: "Source Control",
  },
  {
    id: "extensions",
    icon: <Package className="w-5 h-5" />,
    label: "Extensions",
  },
];

interface ActivityBarProps {
  activeView: string;
  onViewChange: (viewId: string) => void;
  isPanelOpen: boolean;
  onPanelToggle: () => void;
  // Voice controls
  isVoiceConnected: boolean;
  onVoiceToggle: () => void;
  isMuted: boolean;
  onMuteToggle: () => void;
  isDeafened: boolean;
  onDeafenToggle: () => void;
  // Room info
  roomId: string;
}

export const ActivityBar: React.FC<ActivityBarProps> = ({
  activeView,
  onViewChange,
  isPanelOpen,
  onPanelToggle,
  isVoiceConnected,
  onVoiceToggle,
  isMuted,
  onMuteToggle,
  isDeafened,
  onDeafenToggle,
  roomId,
}) => {
  const { user, logout, activityStatus, setActivityStatus } = useAuth();
  const navigate = useNavigate();
  // Map activityStatus to booleans for UI
  const status = activityStatus?.toLowerCase() || "online";
  const isOnline = status === "online";
  const isAway = status === "away";
  const isOffline = status === "offline";

  const handleViewChange = (viewId: string) => {
    console.log("ActivityBar - handleViewChange called:", {
      viewId,
      activeView,
      isPanelOpen,
    });

    if (activeView === viewId) {
      // If clicking the same view, toggle panel open/closed
      console.log("ActivityBar - Same view clicked, toggling panel");
      onPanelToggle();
    } else {
      // If clicking different view, switch to it and ensure panel is open
      console.log(
        "ActivityBar - Different view clicked, switching and opening panel",
      );
      onViewChange(viewId);
      if (!isPanelOpen) {
        console.log("ActivityBar - Panel was closed, opening it");
        onPanelToggle();
      }
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const handleLeaveRoom = () => {
    navigate("/");
  };

  const handleCopyRoomId = () => {
    navigator.clipboard.writeText(roomId);
  };

  const getMicIcon = () => {
    if (isDeafened) return <Headphones className="w-4 h-4" />;
    if (isMuted) return <MicOff className="w-4 h-4" />;
    return <Mic className="w-4 h-4" />;
  };

  const getMicColor = () => {
    if (isDeafened) return "text-red-500";
    if (isMuted) return "text-yellow-500";
    return isVoiceConnected ? "text-green-500" : "text-muted-foreground";
  };

  const getStatusIcon = () => {
    if (isOffline) return <WifiOff className="w-3 h-3" />;
    if (isAway) return <Moon className="w-3 h-3" />;
    return <Circle className="w-3 h-3 fill-current" />;
  };

  const getStatusColor = () => {
    if (isOffline) return "text-red-500";
    if (isAway) return "text-yellow-500";
    return "text-green-500";
  };

  const getStatusText = () => {
    if (isOffline) return "Offline";
    if (isAway) return "Away";
    return "Online";
  };

  const handleStatusChange = async (newStatus: string) => {
    await setActivityStatus(
      newStatus.charAt(0).toUpperCase() + newStatus.slice(1),
    );
  };

  return (
    <TooltipProvider>
      <div className="w-12 bg-discord-sidebar border-r border-discord-border flex flex-col items-center py-2 gap-1">
        {/* Top Activity Items */}
        <div className="flex flex-col gap-1">
          {activityBarItems.map((item) => (
            <Tooltip key={item.id}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={`h-10 w-10 p-0 rounded-sm transition-colors duration-200 flex items-center justify-center ${
                    activeView === item.id && isPanelOpen
                      ? "bg-discord-primary/20 text-discord-primary border-l-2 border-discord-primary"
                      : "text-muted-foreground hover:bg-discord-sidebar-hover hover:text-foreground"
                  }`}
                  onClick={() => handleViewChange(item.id)}
                >
                  {item.icon}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p>{item.label}</p>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>

        <Separator className="w-8 my-2" />

        {/* Voice Controls */}
        <div className="flex flex-col gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={`h-10 w-10 p-0 rounded-sm transition-colors duration-200 flex items-center justify-center ${getMicColor()} hover:bg-discord-sidebar-hover`}
                onClick={onVoiceToggle}
              >
                {getMicIcon()}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>
                {isVoiceConnected
                  ? isDeafened
                    ? "Deafened"
                    : isMuted
                      ? "Muted"
                      : "Connected"
                  : "Connect Voice"}
              </p>
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Bottom Section - User Account */}
        <div className="flex flex-col gap-1">
          <Separator className="w-8 mb-2" />
          {/* Status Indicator and menu fully removed as requested. */}
        </div>
        <div className="flex-1" />
      </div>
    </TooltipProvider>
  );
};
