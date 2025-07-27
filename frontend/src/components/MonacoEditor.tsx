
  // Correctly placed useEffect for file selection
  // Place this just before the return statement inside MonacoEditor

  // Place this after loadFileContent and handleTabClick, before return
import React, { useState, useEffect, useRef, useCallback } from "react";
import { Editor, useMonaco } from "@monaco-editor/react";
import { editor } from "monaco-editor";
import { UserCursor, CollaborativeChange } from "@/lib/collaboration";
import {
  X,
  Save,
  Undo,
  Redo,
  Copy,
  Search,
  Replace,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { fileAPI } from "@/lib/api";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { collaborationService } from "@/lib/collaboration";
import socketService from "@/lib/socket";
import { Badge } from "@/components/ui/badge";

interface FileTab {
  fileId: string;
  name: string;
  content: string;
  language: string;
  isModified: boolean;
  isActive: boolean;
  path: string;
}

export type SelectedFile = {
  id: string;
  name: string;
  content?: string;
  extension?: string;
  fileId: string;
  path: string;
};

interface MonacoEditorProps {
  roomId: string;
  selectedFile?: SelectedFile | null;
  onFileContentChange?: (fileId: string, content: string) => void;
}

const getLanguageFromExtension = (extension: string): string => {
  const languageMap: { [key: string]: string } = {
    js: "javascript",
    jsx: "javascript",
    ts: "typescript",
    tsx: "typescript",
    py: "python",
    java: "java",
    cpp: "cpp",
    c: "c",
    cs: "csharp",
    php: "php",
    rb: "ruby",
    go: "go",
    rs: "rust",
    swift: "swift",
    kt: "kotlin",
    scala: "scala",
    html: "html",
    css: "css",
    scss: "scss",
    sass: "sass",
    less: "less",
    json: "json",
    xml: "xml",
    yaml: "yaml",
    yml: "yaml",
    md: "markdown",
    sql: "sql",
    sh: "shell",
    bash: "shell",
    zsh: "shell",
    ps1: "powershell",
    dockerfile: "dockerfile",
    env: "properties",
    properties: "properties",
    ini: "ini",
    toml: "toml",
    gitignore: "gitignore",
    txt: "plaintext",
  };

  return languageMap[extension.toLowerCase()] || "plaintext";
};

export const MonacoEditor: React.FC<MonacoEditorProps> = ({
  roomId,
  selectedFile,
  onFileContentChange,
}) => {
  const [tabs, setTabs] = useState<FileTab[]>([]);
  const [activeTabIndex, setActiveTabIndex] = useState(-1);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [collaborators, setCollaborators] = useState<Map<string, UserCursor>>(new Map());
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const { user } = useAuth();
  const monaco = useMonaco();

  // Initialize collaboration service
  useEffect(() => {
    if (user && roomId) {
      collaborationService.setUser({ id: user.id, name: user.name });
      collaborationService.setRoomId(roomId);

      // change: { fileId: string, ... }
      const handleRemoteChange = (change: CollaborativeChange) => {
        collaborationService.applyRemoteChange(change);
        const activeTab = tabs[activeTabIndex];
        if (activeTab && activeTab.fileId === change.fileId) {
          const model = editorRef.current?.getModel();
          if (model) {
            setTabs((prev) =>
              prev.map((tab, index) =>
                index === activeTabIndex
                  ? { ...tab, content: model.getValue() }
                  : tab,
              ),
            );
          }
        }
      };

      // cursor: UserCursor
      const handleCursorUpdate = (cursor: UserCursor) => {
        collaborationService.updateRemoteCursor(cursor);
        setCollaborators(new Map(collaborationService.getUserCursors()));
      };

      // data: { fileId: string, content: string, version: number }
      const handleFileSync = (data: { fileId: string; content: string; version: number }) => {
        collaborationService.initializeFile(
          data.fileId,
          data.content,
          data.version,
        );
        const tabIndex = tabs.findIndex((t) => t.fileId === data.fileId);
        if (tabIndex > -1) {
          setTabs((prev) =>
            prev.map((tab, index) =>
              index === tabIndex ? { ...tab, content: data.content } : tab,
            ),
          );
        }
      };

      const handleRequestFileSyncFromPeer = (data: {
        fileId: string;
        requesterId: string;
      }) => {
        const fileState = collaborationService.getFileState(data.fileId);
        if (fileState) {
          socketService.sendFileSyncToPeer({
            requesterId: data.requesterId,
            fileId: data.fileId,
            content: fileState.content,
            version: fileState.version,
          });
        }
      };

      socketService.onCollaborativeChange(handleRemoteChange);
      socketService.onCursorUpdate(handleCursorUpdate);
      socketService.onFileSync(handleFileSync);
      socketService.onRequestFileSyncFromPeer(handleRequestFileSyncFromPeer);

      return () => {
        collaborationService.cleanup();
        // The socket listeners are managed within the socketService,
        // so we don't need to manually turn them off here.
        // The socket connection itself is managed by the AuthContext
        // and will be disconnected on logout.
      };
    }
  }, [user, roomId, tabs, activeTabIndex]);

  // ...existing code...



  // file: { fileId: string, name: string, extension?: string, path: string }
  const loadFileContent = async (file: { fileId: string; name: string; extension?: string; path: string }) => {
    if (!file.fileId) return;

    setIsLoading(true);
    try {
      const fileData = await fileAPI.getFileContent(file.fileId);
      const language = getLanguageFromExtension(file.extension || "");

      const newTab: FileTab = {
        fileId: file.fileId,
        name: file.name,
        content: fileData.content || "",
        language,
        isModified: false,
        isActive: true,
        path: file.path || file.name,
      };

      setTabs((prev) => {
        const newTabs = prev.map((tab) => ({ ...tab, isActive: false }));
        newTabs.push(newTab);
        return newTabs;
      });

      setActiveTabIndex(tabs.length);
      collaborationService.initializeFile(newTab.fileId, newTab.content, 0);
      socketService.requestFileSync(newTab.fileId);
    } catch (error) {
      console.error("Failed to load file content:", error);
      toast.error("Failed to load file content");
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditorChange = useCallback(
    (value: string | undefined) => {
      if (
        value === undefined ||
        activeTabIndex < 0 ||
        activeTabIndex >= tabs.length
      )
        return;

      const currentTab = tabs[activeTabIndex];
      if (currentTab) {
        setTabs((prev) =>
          prev.map((tab, index) =>
            index === activeTabIndex
              ? { ...tab, content: value, isModified: true }
              : tab,
          ),
        );

        if (onFileContentChange) {
          onFileContentChange(currentTab.fileId, value);
        }
      }
    },
    [activeTabIndex, tabs, onFileContentChange],
  );

  const handleSaveFile = async (tabIndex: number) => {
    const tab = tabs[tabIndex];
    if (!tab || !tab.isModified) return;

    setIsSaving(true);
    try {
      await fileAPI.updateFileContent(tab.fileId, tab.content);

      setTabs((prev) =>
        prev.map((t, index) =>
          index === tabIndex ? { ...t, isModified: false } : t,
        ),
      );

      toast.success(`${tab.name} saved successfully`);
    } catch (error) {
      console.error("Failed to save file:", error);
      toast.error("Failed to save file");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCloseTab = (tabIndex: number) => {
    const tab = tabs[tabIndex];

    if (tab.isModified) {
      const confirmed = window.confirm(
        `${tab.name} has unsaved changes. Close anyway?`,
      );
      if (!confirmed) return;
    }

    const newTabs = tabs.filter((_, index) => index !== tabIndex);

    if (newTabs.length === 0) {
      setActiveTabIndex(-1);
    } else if (tabIndex === activeTabIndex) {
      setActiveTabIndex(Math.max(0, tabIndex - 1));
    } else if (tabIndex < activeTabIndex) {
      setActiveTabIndex((prev) => prev - 1);
    }

    setTabs(
      newTabs.map((t, i) => ({
        ...t,
        isActive:
          i ===
          (tabIndex === activeTabIndex
            ? Math.max(0, tabIndex - 1)
            : activeTabIndex),
      })),
    );
  };

  const handleTabClick = (tabIndex: number) => {
    console.log("🗂️ Switching to tab:", tabIndex);
    if (activeTabIndex === tabIndex) return;

    setActiveTabIndex(tabIndex);
    setTabs((prev) =>
      prev.map((tab, index) => ({
        ...tab,
        isActive: index === tabIndex,
      })),
    );

    const newActiveTab = tabs[tabIndex];
    if (editorRef.current && newActiveTab && monaco) {
      console.log("📋 Switching editor model to:", newActiveTab.fileId);

      // Get or create the model for this file
      let model = monaco.editor.getModel(monaco.Uri.parse(newActiveTab.fileId));
      if (!model) {
        model = monaco.editor.createModel(
          newActiveTab.content,
          newActiveTab.language,
          monaco.Uri.parse(newActiveTab.fileId),
        );
      }

      editorRef.current.setModel(model);

      // Initialize collaboration for this file
      collaborationService.initializeFile(
        newActiveTab.fileId,
        newActiveTab.content,
        0,
      );
      socketService.requestFileSync(newActiveTab.fileId);
    }
  };

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === "s") {
          e.preventDefault();
          if (activeTabIndex >= 0 && activeTabIndex < tabs.length) {
            handleSaveFile(activeTabIndex);
          }
        }
      }
    },
    [activeTabIndex, tabs, handleSaveFile],
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleKeyDown]);

  const activeTab = activeTabIndex >= 0 ? tabs[activeTabIndex] : null;

  useEffect(() => {
    if (!selectedFile) return;
    const existingTabIndex = tabs.findIndex(
      (tab) => tab.fileId === selectedFile.fileId,
    );
    if (existingTabIndex >= 0) {
      handleTabClick(existingTabIndex);
    } else if (selectedFile.fileId) {
      loadFileContent({
        fileId: selectedFile.fileId,
        name: selectedFile.name,
        extension: selectedFile.extension,
        path: selectedFile.path,
      });
    }
  }, [selectedFile, handleTabClick, loadFileContent, tabs]);

  useEffect(() => {
    if (!selectedFile) return;
    const existingTabIndex = tabs.findIndex(
      (tab) => tab.fileId === selectedFile.fileId,
    );
    if (existingTabIndex >= 0) {
      handleTabClick(existingTabIndex);
    } else if (selectedFile.fileId) {
      loadFileContent({
        fileId: selectedFile.fileId,
        name: selectedFile.name,
        extension: selectedFile.extension,
        path: selectedFile.path,
      });
    }
  }, [selectedFile, handleTabClick, loadFileContent, tabs]);

  return (
    <div className="flex-1 bg-discord-editor flex flex-col h-full">
      {/* Tabs */}
      <div className="flex bg-discord-sidebar border-b border-border overflow-x-auto">
        {tabs.map((tab, index) => (
          <div
            key={tab.fileId}
            className={`flex items-center gap-2 px-4 py-2 text-sm border-r border-border cursor-pointer transition-colors min-w-0 ${
              tab.isActive
                ? "bg-discord-editor text-foreground"
                : "bg-discord-sidebar text-muted-foreground hover:bg-discord-sidebar-hover"
            }`}
            onClick={() => handleTabClick(index)}
          >
            <span className="truncate flex-1">
              {tab.name}
              {tab.isModified && (
                <span className="text-discord-primary ml-1">●</span>
              )}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="w-4 h-4 p-0 hover:bg-discord-sidebar-hover"
              onClick={(e) => {
                e.stopPropagation();
                handleCloseTab(index);
              }}
            >
              <X className="w-3 h-3" />
            </Button>
          </div>
        ))}
      </div>

      {/* Editor Header */}
      {activeTab && (
        <div className="px-4 py-2 bg-discord-editor border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>{activeTab.path}</span>
            {activeTab.isModified && (
              <span className="text-discord-primary">● Modified</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Collaboration indicator */}
            {collaborators.size > 0 && (
              <div className="flex items-center gap-1">
                <Users className="w-4 h-4 text-green-500" />
                <span className="text-xs text-muted-foreground">
                  {collaborators.size} collaborator
                  {collaborators.size > 1 ? "s" : ""}
                </span>
                <div className="flex gap-1">
                  {Array.from(collaborators.values())
                    .slice(0, 3)
                    .map((cursor) => (
                      <Badge
                        key={cursor.userId}
                        variant="secondary"
                        className="text-xs px-1 py-0 h-5"
                        style={{
                          backgroundColor: cursor.color + "40",
                          color: cursor.color,
                        }}
                      >
                        {cursor.userName.charAt(0).toUpperCase()}
                      </Badge>
                    ))}
                  {collaborators.size > 3 && (
                    <Badge
                      variant="secondary"
                      className="text-xs px-1 py-0 h-5"
                    >
                      +{collaborators.size - 3}
                    </Badge>
                  )}
                </div>
              </div>
            )}
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="w-8 h-8 p-0"
                onClick={() => handleSaveFile(activeTabIndex)}
                disabled={!activeTab.isModified || isSaving}
              >
                <Save className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="w-8 h-8 p-0"
                onClick={() => editorRef.current?.trigger("keyboard", "undo", null)}
              >
                <Undo className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="w-8 h-8 p-0"
                onClick={() => editorRef.current?.trigger("keyboard", "redo", null)}
              >
                <Redo className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="w-8 h-8 p-0"
                onClick={() =>
                  editorRef.current?.trigger("keyboard", "actions.find", null)
                }
              >
                <Search className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Editor Content */}
      <div className="flex-1 relative">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-discord-primary"></div>
          </div>
        ) : activeTab ? (
          <Editor
            height="100%"
            language={activeTab.language}
            value={activeTab.content}
            onChange={handleEditorChange}
            onMount={(editor) => {
              console.log("🎬 Monaco Editor mounted for tab:", activeTab?.name);
              editorRef.current = editor;
              collaborationService.setEditor(editor);
              if (activeTab && monaco) {
                const model = monaco.editor.createModel(
                  activeTab.content,
                  activeTab.language,
                  monaco.Uri.parse(activeTab.fileId),
                );
                editor.setModel(model);

                console.log("📋 Initializing file:", activeTab.fileId);
                collaborationService.initializeFile(
                  activeTab.fileId,
                  activeTab.content,
                  0,
                );
                socketService.requestFileSync(activeTab.fileId);
              }
            }}
            theme="vs-dark"
            options={{
              minimap: { enabled: true },
              fontSize: 14,
              fontFamily: 'JetBrains Mono, Consolas, "Courier New", monospace',
              wordWrap: "on",
              automaticLayout: true,
              scrollBeyondLastLine: false,
              renderWhitespace: "selection",
              tabSize: 2,
              insertSpaces: true,
              detectIndentation: true,
              formatOnPaste: true,
              formatOnType: true,
              suggestOnTriggerCharacters: true,
              acceptSuggestionOnEnter: "on",
              quickSuggestions: true,
              parameterHints: { enabled: true },
              folding: true,
              lineNumbers: "on",
              glyphMargin: true,
              rulers: [80, 120],
              bracketPairColorization: { enabled: true },
              guides: {
                bracketPairs: true,
                indentation: true,
              },
            }}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-center">
            <div className="text-muted-foreground">
              <div className="w-16 h-16 mx-auto mb-4 bg-discord-sidebar rounded-lg flex items-center justify-center">
                <span className="text-2xl">📝</span>
              </div>
              <h3 className="text-lg font-medium mb-2">No file selected</h3>
              <p className="text-sm">
                Select a file from the sidebar to start editing
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
