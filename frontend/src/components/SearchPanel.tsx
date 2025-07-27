import React from "react";
import { Search, Filter, Replace } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

interface SearchPanelProps {
  isOpen: boolean;
  roomId: string;
}

export const SearchPanel: React.FC<SearchPanelProps> = ({ isOpen, roomId }) => {
  if (!isOpen) return null;

  return (
    <div className="h-full bg-discord-sidebar flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-discord-border">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Search
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 hover:bg-discord-sidebar-hover"
          >
            <Filter className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Search Content */}
      <div className="flex-1 p-3">
        <div className="space-y-3">
          <div className="space-y-2">
            <Input
              placeholder="Search files..."
              className="h-8 bg-discord-primary border-discord-border"
            />
            <Input
              placeholder="Replace with..."
              className="h-8 bg-discord-primary border-discord-border"
            />
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-7">
              <Search className="w-3 h-3 mr-1" />
              Search
            </Button>
            <Button variant="outline" size="sm" className="h-7">
              <Replace className="w-3 h-3 mr-1" />
              Replace
            </Button>
          </div>
        </div>

        <ScrollArea className="mt-4 h-full">
          <div className="text-sm text-muted-foreground text-center py-8">
            <Search className="w-8 h-8 mx-auto mb-2" />
            <p>Search functionality coming soon!</p>
          </div>
        </ScrollArea>
      </div>
    </div>
  );
};
