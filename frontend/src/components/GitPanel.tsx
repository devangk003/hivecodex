import React from "react";
import { GitBranch, GitCommit, GitMerge, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

interface GitPanelProps {
  isOpen: boolean;
  roomId: string;
}

export const GitPanel: React.FC<GitPanelProps> = ({ isOpen, roomId }) => {
  if (!isOpen) return null;

  return (
    <div className="h-full bg-discord-sidebar flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-discord-border">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Source Control
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 hover:bg-discord-sidebar-hover"
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Git Content */}
      <div className="flex-1 p-3">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <GitBranch className="w-4 h-4" />
            <span className="text-sm font-medium">main</span>
            <Badge variant="outline" className="h-5 text-xs">
              origin
            </Badge>
          </div>

          <div className="space-y-2">
            <div className="text-xs text-muted-foreground uppercase tracking-wider">
              Changes
            </div>
            <div className="text-sm text-muted-foreground">No changes</div>
          </div>
        </div>

        <ScrollArea className="mt-4 h-full">
          <div className="text-sm text-muted-foreground text-center py-8">
            <GitCommit className="w-8 h-8 mx-auto mb-2" />
            <p>Git integration coming soon!</p>
            <p className="text-xs mt-1">Track changes and collaborate</p>
          </div>
        </ScrollArea>
      </div>
    </div>
  );
};
