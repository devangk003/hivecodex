import React, { useState, useCallback, useRef } from "react";
import {
  File,
  Folder,
  FolderOpen,
  FileText,
  ChevronDown,
  ChevronRight,
  Upload,
  Trash2,
  Plus,
  Download,
  AlertTriangle,
} from "lucide-react";
import { ZipUploadIcon } from "./ui/ZipUploadIcon";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";

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
  isCorrupted?: boolean;
}

interface VSCodeFileExplorerProps {
  files: FileTreeItem[];
  onFileSelect: (file: FileTreeItem) => void;
  onFileUpload: (files: File[], parentId?: string) => void;
  onFileDelete: (fileId: string) => void;
  onZipUpload: (files: FileTreeItem[]) => void;
  selectedFolder?: string | null;
  onMove?: () => void;
}

const getFileIcon = (item: FileTreeItem) => {
  if (item.type === "folder") {
    return item.isExpanded ? (
      <FolderOpen className="w-4 h-4 text-blue-400" />
    ) : (
      <Folder className="w-4 h-4 text-blue-400" />
    );
  }

  switch (item.extension) {
    case "py":
      return <File className="w-4 h-4 text-blue-400" />;
    case "js":
      return <File className="w-4 h-4 text-yellow-400" />;
    case "tsx":
    case "ts":
      return <File className="w-4 h-4 text-blue-300" />;
    case "env":
      return <File className="w-4 h-4 text-green-400" />;
    case "json":
      return <File className="w-4 h-4 text-orange-400" />;
    case "md":
      return <File className="w-4 h-4 text-purple-400" />;
    default:
      return <FileText className="w-4 h-4 text-muted-foreground" />;
  }
};

interface FileTreeItemProps {
  item: FileTreeItem;
  depth?: number;
  onSelect: (file: FileTreeItem) => void;
  onDelete: (fileId: string) => void;
  onMove?: () => void;
  onFileUpload?: (files: File[], parentId?: string) => void;
}

const FileTreeItem: React.FC<FileTreeItemProps> = ({
  item,
  depth = 0,
  onSelect,
  onDelete,
  onMove,
  onFileUpload,
}) => {
  const [isExpanded, setIsExpanded] = useState(item.isExpanded || false);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleClick = () => {
    if (item.type === "folder") {
      setIsExpanded(!isExpanded);
    } else {
      onSelect(item);
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Allow deletion for both files and folders
    if (item.fileId || item.id) {
      onDelete(item.fileId || item.id);
    }
  };

  // Drag-and-drop move logic
  const handleDragStart = (e: React.DragEvent) => {
    e.stopPropagation();
    e.dataTransfer.setData("application/x-hivecodex-id", item.id);
    e.dataTransfer.effectAllowed = "move";
  };
  const handleDragOver = (e: React.DragEvent) => {
    if (item.type === "folder") {
      e.preventDefault();
      setIsDragOver(true);
    }
  };
  const handleDragLeave = (e: React.DragEvent) => {
    setIsDragOver(false);
  };
  const handleDrop = async (e: React.DragEvent) => {
    setIsDragOver(false);
    e.preventDefault();
    const draggedId = e.dataTransfer.getData("application/x-hivecodex-id");
    if (draggedId && draggedId !== item.id && item.type === "folder") {
      try {
        const api = await import("@/lib/api");
        const roomId = window.location.pathname.split("/").pop();
        await api.fileAPI.moveFileOrFolder(roomId, draggedId, item.id);
        if (typeof onMove === "function") onMove();
      } catch (err) {
        toast.error("Failed to move item");
      }
    } else if (
      e.dataTransfer.files &&
      e.dataTransfer.files.length > 0 &&
      item.type === "folder"
    ) {
      // Upload files to this folder
      if (typeof onFileUpload === "function") {
        onFileUpload(Array.from(e.dataTransfer.files), item.id);
      }
    }
  };

  return (
    <div className="min-w-0">
      <div
        className={`flex items-center gap-2 py-1 px-2 hover:bg-discord-sidebar-hover rounded-sm cursor-pointer text-sm transition-colors group min-w-0 ${
          item.isSelected
            ? "bg-discord-primary/20 text-discord-primary"
            : "text-foreground"
        } ${isDragOver ? "bg-discord-primary/10 border border-discord-primary" : ""}`}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
        onClick={handleClick}
        draggable
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {item.type === "folder" && (
          <div className="w-4 h-4 flex items-center justify-center flex-shrink-0">
            {isExpanded ? (
              <ChevronDown className="w-3 h-3" />
            ) : (
              <ChevronRight className="w-3 h-3" />
            )}
          </div>
        )}
        <div className="flex-shrink-0">
          {getFileIcon({ ...item, isExpanded })}
        </div>
        {item.isCorrupted && (
          <div
            className="flex-shrink-0 text-yellow-500"
            title="File is corrupted or missing"
          >
            <AlertTriangle className="w-3 h-3" />
          </div>
        )}
        <span
          className={`flex-1 truncate min-w-0 ${item.isCorrupted ? "text-yellow-500" : ""}`}
          title={item.name}
        >
          {item.name}
        </span>
        {(item.type === "file" || item.type === "folder") && (
          <Button
            variant="ghost"
            size="sm"
            className="w-5 h-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
            onClick={handleDelete}
            title={`Delete ${item.type}`}
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        )}
      </div>
      {item.type === "folder" && isExpanded && item.children && (
        <div>
          {item.children.map((child) => (
            <FileTreeItem
              key={child.id}
              item={child}
              depth={depth + 1}
              onSelect={onSelect}
              onDelete={onDelete}
              onMove={onMove}
              onFileUpload={onFileUpload}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const VSCodeFileExplorer: React.FC<VSCodeFileExplorerProps> = ({
  files,
  onFileSelect,
  onFileUpload,
  onFileDelete,
  onZipUpload,
  onMove,
}) => {
  // Root-level drop zone for moving files/folders to root
  const explorerRef = useRef<HTMLDivElement>(null);
  // Unified drop handler for explorer background (root)
  const handleExplorerDragOver = (e: React.DragEvent) => {
    // Only highlight if not over a folder
    if (e.target === explorerRef.current) {
      e.preventDefault();
    }
  };
  const handleExplorerDrop = async (e: React.DragEvent) => {
    if (e.target !== explorerRef.current) return;
    e.preventDefault();
    const draggedId = e.dataTransfer.getData("application/x-hivecodex-id");
    if (draggedId) {
      // Internal move to root
      try {
        const api = await import("@/lib/api");
        const roomId = window.location.pathname.split("/").pop();
        await api.fileAPI.moveFileOrFolder(roomId, draggedId, undefined);
        if (typeof onMove === "function") onMove();
      } catch (err) {
        toast.error("Failed to move item");
      }
    } else if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      // Upload to root
      handleDrop(Array.from(e.dataTransfer.files));
    }
  };
  // Always use uploadFolder API if any file has webkitRelativePath
  const handleDrop = useCallback(
    (acceptedFiles: File[]) => {
      // If any file has a webkitRelativePath with a slash, treat as folder upload
      if (
        acceptedFiles.some(
          (f) =>
          (typeof (f as File & { webkitRelativePath?: string }).webkitRelativePath === 'string' &&
            (f as File & { webkitRelativePath?: string }).webkitRelativePath.includes("/")),
        )
      ) {
        // Use the uploadFolder API from lib/api.ts
        import("@/lib/api").then((apiModule) => {
          const roomId = window.location.pathname.split("/").pop();
          if (roomId) {
            apiModule.fileAPI.uploadFolder(roomId, acceptedFiles);
          } else {
            toast.error("Room ID not found in URL.");
          }
        });
      } else {
        onFileUpload(acceptedFiles);
      }
    },
    [onFileUpload],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: handleDrop,
    noClick: false, // allow click
    noKeyboard: false,
    accept: {
      "text/*": [
        ".txt",
        ".js",
        ".ts",
        ".tsx",
        ".py",
        ".json",
        ".md",
        ".html",
        ".css",
      ],
      "application/javascript": [".js"],
      "application/json": [".json"],
      "application/zip": [".zip"],
    },
    multiple: true,
  });

  const handleFileSelect = useCallback(
    (file: FileTreeItem) => {
      onFileSelect(file);
    },
    [onFileSelect],
  );

  const handleFileDelete = useCallback(
    (fileId: string) => {
      onFileDelete(fileId);
    },
    [onFileDelete],
  );

  // Unified explorer drop zone for move-to-root and upload
  return (
    <div
      ref={explorerRef}
      className="relative min-h-[200px]"
      onDragOver={handleExplorerDragOver}
      onDrop={handleExplorerDrop}
      style={{ outline: isDragActive ? "2px dashed #5865f2" : undefined }}
    >
      {/* Hidden input for drag-and-drop only, not click */}
      <input {...getInputProps()} style={{ display: "none" }} />
      <div className="border-b border-discord-border px-2 py-1 text-xs text-muted-foreground select-none">
        Root
      </div>
      <div className="p-2">
        {files.map((file) => (
          <FileTreeItem
            key={file.id}
            item={file}
            onSelect={handleFileSelect}
            onDelete={handleFileDelete}
            onMove={onMove}
            onFileUpload={handleDrop}
          />
        ))}
      </div>
      {/* Drop zone overlay */}
      {isDragActive && (
        <div className="absolute inset-0 bg-discord-primary/20 border-2 border-discord-primary border-dashed rounded-lg flex items-center justify-center z-10">
          <ZipUploadIcon className="w-12 h-12 mx-auto mb-4 text-discord-primary" />
          <p className="text-lg font-medium text-discord-primary">
            Drop files here
          </p>
        </div>
      )}
    </div>
  );

  return (
    <div className="relative">
      <div className="p-2">
        {files.map((file) => (
          <FileTreeItem
            key={file.id}
            item={file}
            onSelect={handleFileSelect}
            onDelete={handleFileDelete}
            onMove={onMove}
          />
        ))}
      </div>

      {/* Drop zone overlay */}
      {isDragActive && (
        <div
          {...getRootProps()}
          className="absolute inset-0 bg-discord-primary/20 border-2 border-discord-primary border-dashed rounded-lg flex items-center justify-center z-10"
        >
          <input {...getInputProps()} />
          <div className="text-center">
            <ZipUploadIcon className="w-12 h-12 mx-auto mb-4 text-discord-primary" />
            <p className="text-lg font-medium text-discord-primary">
              Drop files here
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
