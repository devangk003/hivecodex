import React from "react";
import { Package, Download, Star, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

interface ExtensionsPanelProps {
  isOpen: boolean;
  roomId: string;
}

export const ExtensionsPanel: React.FC<ExtensionsPanelProps> = ({
  isOpen,
  roomId,
}) => {
  if (!isOpen) return null;

  const recommendedExtensions = [
    { name: "Prettier", description: "Code formatter", installed: true },
    { name: "ESLint", description: "JavaScript linter", installed: false },
    {
      name: "Python",
      description: "Python language support",
      installed: false,
    },
    {
      name: "Live Share",
      description: "Real-time collaboration",
      installed: true,
    },
  ];

  return (
    <div className="h-full bg-discord-sidebar flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-discord-border">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Extensions
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 hover:bg-discord-sidebar-hover"
          >
            <Download className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Extensions Content */}
      <div className="flex-1">
        <ScrollArea className="h-full">
          <div className="p-3 space-y-3">
            <div className="text-xs text-muted-foreground uppercase tracking-wider">
              Installed
            </div>

            {recommendedExtensions
              .filter((ext) => ext.installed)
              .map((extension, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 p-2 rounded bg-discord-primary/10"
                >
                  <Package className="w-4 h-4 text-green-500" />
                  <div className="flex-1">
                    <div className="text-sm font-medium">{extension.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {extension.description}
                    </div>
                  </div>
                  <Badge variant="outline" className="h-5 text-xs">
                    Installed
                  </Badge>
                </div>
              ))}

            <div className="text-xs text-muted-foreground uppercase tracking-wider mt-6">
              Recommended
            </div>

            {recommendedExtensions
              .filter((ext) => !ext.installed)
              .map((extension, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 p-2 rounded hover:bg-discord-sidebar-hover"
                >
                  <Package className="w-4 h-4 text-blue-500" />
                  <div className="flex-1">
                    <div className="text-sm font-medium">{extension.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {extension.description}
                    </div>
                  </div>
                  <Button variant="outline" size="sm" className="h-6 text-xs">
                    Install
                  </Button>
                </div>
              ))}

            <div className="text-sm text-muted-foreground text-center py-8 mt-6">
              <Zap className="w-8 h-8 mx-auto mb-2" />
              <p>Extensions marketplace coming soon!</p>
              <p className="text-xs mt-1">Enhance your coding experience</p>
            </div>
          </div>
        </ScrollArea>
      </div>
    </div>
  );
};
