import React, { useRef, useEffect, useCallback, useState, useContext } from 'react';
import Editor, { type Monaco } from '@monaco-editor/react';
import { configureMonaco, defaultEditorOptions, getEditorLanguage } from '@/lib/editor-config';
import { FileTabBar } from '@/components/FileTabBar/FileTabBar';
import { EditorContext, useEditor } from '@/contexts/EditorContext';
import { collaborationService } from '@/lib/collaboration';
import socketService from '@/lib/socket';
import { fileAPI } from '@/lib/api';
import { toast } from 'sonner';
import type { SelectedFile } from '@/types';
import './MonacoEditor.css';
import { useAuth } from '@/contexts/AuthContext';

interface MonacoEditorProps {
  roomId: string;
  selectedFile?: SelectedFile | null;
  onFileContentChange?: (fileId: string, content: string) => void;
}

export const MonacoEditor: React.FC<MonacoEditorProps> = ({
  roomId,
  selectedFile,
  onFileContentChange,
}) => {
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const editorContext = useEditor();
  const { user } = useAuth();
  const lastProcessedSelectedFileId = useRef<string | null>(null);

  // Determine which state to use
  const { state: { tabs, activeTabIndex }, addTab, closeTab, setActiveTab, updateTabContent } = editorContext;
  const activeTab = tabs[activeTabIndex];

  const closeTabByFileId = useCallback((fileId: string) => {
    const index = tabs.findIndex(tab => tab.fileId === fileId);
    if (index >= 0) {
      closeTab(index);
    }
  }, [tabs, closeTab]);

  const setActiveTabByFileId = useCallback((fileId: string) => {
    const index = tabs.findIndex(tab => tab.fileId === fileId);
    if (index >= 0) {
      setActiveTab(index);
    }
  }, [tabs, setActiveTab]);

  // Handle editor content changes
  const handleEditorChange = useCallback((value: string | undefined) => {
    if (value === undefined || !activeTab) return;

    // Update tab content
    updateTabContent(activeTabIndex, value);

    // Notify parent component
    if (onFileContentChange) {
      onFileContentChange(activeTab.fileId, value);
    }
  }, [activeTab, activeTabIndex, onFileContentChange, updateTabContent]);

  // Handle file selection from parent (only when selected file actually changes)
  useEffect(() => {
    let isCancelled = false;

    const loadFile = async () => {
      if (!selectedFile) return;

      // Only process new selections
      if (lastProcessedSelectedFileId.current === selectedFile.fileId) {
        return;
      }

      // If already active on this file, do nothing
      if (activeTab && activeTab.fileId === selectedFile.fileId) {
        lastProcessedSelectedFileId.current = selectedFile.fileId;
        return;
      }

      // Check if file is already open in any tab
      const existingTabIndex = tabs.findIndex(tab => tab.fileId === selectedFile.fileId);
      if (existingTabIndex >= 0) {
        setActiveTab(existingTabIndex);
        lastProcessedSelectedFileId.current = selectedFile.fileId;
        return;
      }

      setIsLoading(true);
      try {
        const fileData = await fileAPI.getFileContent(selectedFile.fileId);
        const language = getEditorLanguage(selectedFile.extension || '');

        if (isCancelled) return;

        const newTab = {
          fileId: selectedFile.fileId,
          name: selectedFile.name,
          content: fileData.content || '',
          language,
          isModified: false,
          isActive: true,
          path: selectedFile.path || selectedFile.name,
        };

        addTab(newTab);
        lastProcessedSelectedFileId.current = selectedFile.fileId;

        // Initialize collaboration
        collaborationService.initializeFile(newTab.fileId, newTab.content, 0);
        socketService.requestFileSync(newTab.fileId);
      } catch (error) {
        console.error('Failed to load file content:', error);
        toast.error('Failed to load file content');
      } finally {
        if (!isCancelled) setIsLoading(false);
      }
    };

    loadFile();

    return () => {
      isCancelled = true;
    };
  }, [selectedFile?.fileId, selectedFile?.name, selectedFile?.path, activeTab?.fileId, tabs.length, setActiveTab, addTab]);

  // Handle saving files
  const handleSaveFile = useCallback(async (tabIndex: number) => {
    const tab = tabs[tabIndex];
    if (!tab || !tab.isModified) return;

    try {
      await fileAPI.updateFileContent(tab.fileId, tab.content);
      
      // Update tab to mark as saved
      editorContext.setTabModified(tabIndex, false);

      toast.success(`${tab.name} saved successfully`);
    } catch (error) {
      console.error('Error saving file:', error);
      toast.error(`Failed to save ${tab.name}`);
    }
  }, [tabs, editorContext]);

  // Handle editor mount
  const handleEditorMount = useCallback((editor: any, monaco: Monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    
    // Configure Monaco
    configureMonaco(monaco);
    
    // Set up collaboration
    collaborationService.setEditor(editor);
    collaborationService.setRoomId(roomId);
    if (user?.id) {
      collaborationService.setUser({ id: user.id, name: user.name || 'User' });
    }

    console.log('Monaco editor mounted successfully');
  }, [roomId, user?.id, user?.name]);

  // Register Ctrl/Cmd+S for saving
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const disposable = editor.addCommand(
      monacoRef.current!.KeyMod.CtrlCmd | monacoRef.current!.KeyCode.KeyS,
      () => {
        if (typeof activeTabIndex === 'number' && activeTabIndex >= 0) {
          handleSaveFile(activeTabIndex);
        }
      }
    );
    return () => {
      if (disposable && disposable.dispose) disposable.dispose();
    };
  }, [handleSaveFile, activeTabIndex]);

  // Update collaboration current file when active tab changes
  useEffect(() => {
    if (activeTab?.fileId) {
      collaborationService.setCurrentFile(activeTab.fileId);
    }
  }, [activeTab?.fileId]);

  // Ensure collaboration has file state for the active tab
  useEffect(() => {
    if (activeTab?.fileId) {
      const state = collaborationService.getFileState(activeTab.fileId);
      if (!state) {
        collaborationService.initializeFile(activeTab.fileId, activeTab.content || '', 0);
        socketService.requestFileSync(activeTab.fileId);
      }
    }
  }, [activeTab?.fileId]);

  return (
    <div className="flex flex-col h-full">
      {/* File Tab Bar */}
      <FileTabBar
        tabs={tabs}
        activeTabId={activeTab?.fileId || null}
        onTabSelect={setActiveTabByFileId}
        onTabClose={closeTabByFileId}
      />

      {/* Editor */}
      <div className="flex-1 relative">
        {/* Editor actions */}
        <div className="absolute top-2 right-2 z-10 flex gap-2">
          {activeTab && (
            <button
              className="px-2 py-1 text-xs bg-grey-100 opacity-75 text-white rounded hover:bg-blue-500"
              onClick={() => handleSaveFile(activeTabIndex)}
              title="Save (Ctrl/Cmd+S)"
            >
              Save
            </button>
          )}
        </div>
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        ) : activeTab ? (
          <Editor
            height="100%"
            value={activeTab.content}
            language={activeTab.language}
            path={activeTab.fileId}
            onChange={handleEditorChange}
            onMount={handleEditorMount}
            theme="hivecodex-dark"
            options={{
              ...defaultEditorOptions,
              fontSize: 14,
              fontFamily: 'JetBrains Mono, Consolas, "Courier New", monospace',
              wordWrap: 'on',
              automaticLayout: true,
              scrollBeyondLastLine: false,
              minimap: { enabled: true },
              bracketPairColorization: { enabled: true },
              guides: {
                bracketPairs: true,
                indentation: true,
              },
            }}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-center bg-gray-900">
            <div className="text-gray-400">
              <div className="w-16 h-16 mx-auto mb-4 bg-gray-800 rounded-lg flex items-center justify-center">
                <span className="text-2xl">📝</span>
              </div>
              <h3 className="text-lg font-medium mb-2">
                No file selected
              </h3>
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

export default MonacoEditor;