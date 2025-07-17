import { editor } from 'monaco-editor';
import * as monaco from 'monaco-editor';
import socketService from './socket';

export interface TextOperation {
  type: 'retain' | 'insert' | 'delete';
  length?: number;
  text?: string;
}

export interface CollaborativeChange {
  id: string;
  userId: string;
  userName: string;
  fileId: string;
  operations: TextOperation[];
  baseVersion: number;
  timestamp: number;
}

export interface UserCursor {
  userId: string;
  userName: string;
  fileId: string;
  position: {
    lineNumber: number;
    column: number;
  };
  selection?: {
    startLineNumber: number;
    startColumn: number;
    endLineNumber: number;
    endColumn: number;
  };
  color: string;
}

export interface FileVersion {
  fileId: string;
  version: number;
  content: string;
  lastModified: Date;
}

class CollaborationService {
  private editor: editor.IStandaloneCodeEditor | null = null;
  private fileVersions: Map<string, FileVersion> = new Map();
  private pendingOperations: Map<string, CollaborativeChange[]> = new Map();
  private userCursors: Map<string, UserCursor> = new Map();
  private currentUser: { id: string; name: string } | null = null;
  private roomId: string | null = null;
  private isApplyingRemoteChange = false;
  private changeTimeout: NodeJS.Timeout | null = null;

  // User colors for cursors/selections
  private userColors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
    '#DDA0DD', '#98D8C8', '#FFB6C1', '#87CEEB', '#F0E68C'
  ];

  setEditor(editorInstance: editor.IStandaloneCodeEditor) {
    console.log('🎯 Setting editor instance');
    this.editor = editorInstance;
    this.setupEditorListeners();
  }

  setUser(user: { id: string; name: string }) {
    this.currentUser = user;
  }

  setRoomId(roomId: string) {
    this.roomId = roomId;
  }

  initializeFile(fileId: string, content: string, version: number = 0) {
    console.log('📂 Initializing file:', fileId, 'with version:', version);
    this.fileVersions.set(fileId, {
      fileId,
      version,
      content,
      lastModified: new Date()
    });
  }

  getFileState(fileId: string): FileVersion | undefined {
    return this.fileVersions.get(fileId);
  }

  private setupEditorListeners() {
    console.log('🎧 Setting up editor listeners');
    if (!this.editor) {
      console.log('❌ No editor to setup listeners on');
      return;
    }

    // Listen for content changes
    this.editor.onDidChangeModelContent((event) => {
      console.log('📝 Content changed, applying remote change:', this.isApplyingRemoteChange);
      if (this.isApplyingRemoteChange) return;
      
      const model = this.editor?.getModel();
      if (!model) return;

      // Debounce changes to avoid flooding
      if (this.changeTimeout) {
        clearTimeout(this.changeTimeout);
      }

      this.changeTimeout = setTimeout(() => {
        this.handleLocalChange(event);
      }, 100); // Reduced timeout for better responsiveness
    });

    // Listen for cursor position changes
    this.editor.onDidChangeCursorPosition((event) => {
      if (this.isApplyingRemoteChange) return;
      this.handleCursorChange(event);
    });

    // Listen for selection changes
    this.editor.onDidChangeCursorSelection((event) => {
      if (this.isApplyingRemoteChange) return;
      this.handleSelectionChange(event);
    });
    
    console.log('✅ Editor listeners setup complete');
  }

  private handleLocalChange(event: editor.IModelContentChangedEvent) {
    console.log('🔥 Local change detected:', event.changes);
    const model = this.editor?.getModel();
    if (!model || !this.currentUser || !this.roomId) {
      console.log('❌ Missing requirements:', { model: !!model, user: !!this.currentUser, roomId: this.roomId });
      return;
    }

    const fileId = this.getCurrentFileId();
    if (!fileId) {
      console.log('❌ No fileId');
      return;
    }
    
    const fileVersion = this.fileVersions.get(fileId);
    if (!fileVersion) {
      console.log('❌ No file version for:', fileId);
      return;
    }

    const operations = this.convertMonacoChangesToOperations(event.changes, model);
    if (operations.length === 0) {
      console.log('❌ No operations generated');
      return;
    }

    const change: CollaborativeChange = {
      id: this.generateId(),
      userId: this.currentUser.id,
      userName: this.currentUser.name,
      fileId,
      operations,
      baseVersion: fileVersion.version,
      timestamp: Date.now()
    };

    console.log('✅ Sending collaborative change:', change);

    // Update local version
    const newContent = model.getValue();
    this.fileVersions.set(fileId, {
      ...fileVersion,
      version: fileVersion.version + 1,
      content: newContent,
      lastModified: new Date(),
    });

    // Send to server
    socketService.sendCollaborativeChange(change);
  }

  private handleCursorChange(event: editor.ICursorPositionChangedEvent) {
    console.log('🎯 Cursor change detected:', event.position);
    if (!this.currentUser || !this.roomId) {
      console.log('❌ Missing user or room:', { user: !!this.currentUser, roomId: this.roomId });
      return;
    }
    const fileId = this.getCurrentFileId();
    if (!fileId) {
      console.log('❌ No fileId for cursor');
      return;
    }

    const cursor: UserCursor = {
      userId: this.currentUser.id,
      userName: this.currentUser.name,
      fileId: fileId,
      position: {
        lineNumber: event.position.lineNumber,
        column: event.position.column
      },
      color: this.getUserColor(this.currentUser.id)
    };

    console.log('✅ Sending cursor update:', cursor);
    socketService.sendCursorUpdate(cursor);
  }

  private handleSelectionChange(event: editor.ICursorSelectionChangedEvent) {
    if (!this.currentUser || !this.roomId) return;
    const fileId = this.getCurrentFileId();
    if (!fileId) return;

    const selection = event.selection;
    const cursor: UserCursor = {
      userId: this.currentUser.id,
      userName: this.currentUser.name,
      fileId: fileId,
      position: {
        lineNumber: selection.positionLineNumber,
        column: selection.positionColumn
      },
      selection: {
        startLineNumber: selection.startLineNumber,
        startColumn: selection.startColumn,
        endLineNumber: selection.endLineNumber,
        endColumn: selection.endColumn
      },
      color: this.getUserColor(this.currentUser.id)
    };

    socketService.sendCursorUpdate(cursor);
  }

  applyRemoteChange(change: CollaborativeChange) {
    console.log('📥 Received remote change:', change);
    if (!this.editor || change.userId === this.currentUser?.id) {
      console.log('❌ Ignoring change:', { noEditor: !this.editor, ownChange: change.userId === this.currentUser?.id });
      return;
    }

    const model = this.editor.getModel();
    const fileId = this.getCurrentFileId();
    if (!model || !fileId || fileId !== change.fileId) {
      console.log('❌ Model/file mismatch:', { model: !!model, fileId, changeFileId: change.fileId });
      return;
    }

    const fileVersion = this.fileVersions.get(change.fileId);
    if (!fileVersion) {
        console.log('❌ No file version, requesting sync');
        socketService.requestFileSync(change.fileId);
        return;
    }

    this.isApplyingRemoteChange = true;

    try {
      if (change.baseVersion !== fileVersion.version) {
        console.log('❌ Version mismatch. Local:', fileVersion.version, 'Remote:', change.baseVersion);
        socketService.requestFileSync(change.fileId);
        this.isApplyingRemoteChange = false;
        return;
      }
      
      console.log('✅ Applying operations:', change.operations);
      this.applyOperationsToEditor(change.operations);

      // Update file version
      const newContent = model.getValue();
      this.fileVersions.set(fileId, {
        ...fileVersion,
        version: fileVersion.version + 1,
        content: newContent,
        lastModified: new Date(),
      });

      console.log('✅ Remote change applied successfully');

    } finally {
      this.isApplyingRemoteChange = false;
    }
  }

  updateRemoteCursor(cursor: UserCursor) {
    console.log('👆 Remote cursor update:', cursor);
    if (!this.editor || cursor.userId === this.currentUser?.id) {
      console.log('❌ Ignoring cursor:', { noEditor: !this.editor, ownCursor: cursor.userId === this.currentUser?.id });
      return;
    }
    const fileId = this.getCurrentFileId();
    if (!fileId || fileId !== cursor.fileId) {
      console.log('❌ Cursor file mismatch:', { fileId, cursorFileId: cursor.fileId });
      return;
    }

    this.userCursors.set(cursor.userId, cursor);
    console.log('✅ Rendering cursors. Total cursors:', this.userCursors.size);
    this.renderUserCursors();
  }

  private convertMonacoChangesToOperations(
    changes: editor.IModelContentChange[],
    model: editor.ITextModel
  ): TextOperation[] {
    const operations: TextOperation[] = [];
    let lastOffset = 0;

    // Sort changes by offset to process them in order
    const sortedChanges = [...changes].sort((a, b) => a.rangeOffset - b.rangeOffset);

    for (const change of sortedChanges) {
      const retainLength = change.rangeOffset - lastOffset;
      if (retainLength > 0) {
        operations.push({ type: 'retain', length: retainLength });
      }

      if (change.rangeLength > 0) {
        operations.push({ type: 'delete', length: change.rangeLength });
      }

      if (change.text) {
        operations.push({ type: 'insert', text: change.text });
      }

      lastOffset = change.rangeOffset + change.rangeLength;
    }

    const documentLength = model.getValueLength();
    const finalRetain = documentLength - lastOffset;
    if (finalRetain > 0) {
        operations.push({ type: 'retain', length: finalRetain });
    }

    return operations;
  }

  private applyOperationsToEditor(operations: TextOperation[]) {
    if (!this.editor) return;

    const model = this.editor.getModel();
    if (!model) return;

    const edits: editor.IIdentifiedSingleEditOperation[] = [];
    let offset = 0;

    for (const op of operations) {
      const start = model.getPositionAt(offset);
      if (op.type === 'retain' && op.length) {
        offset += op.length;
      } else if (op.type === 'insert' && op.text) {
        edits.push({
          range: new monaco.Range(start.lineNumber, start.column, start.lineNumber, start.column),
          text: op.text,
          forceMoveMarkers: true,
        });
      } else if (op.type === 'delete' && op.length) {
        const end = model.getPositionAt(offset + op.length);
        edits.push({
          range: new monaco.Range(start.lineNumber, start.column, end.lineNumber, end.column),
          text: '',
          forceMoveMarkers: true,
        });
        offset += op.length;
      }
    }

    if (edits.length > 0) {
      model.pushEditOperations([], edits, () => null);
    }
  }

  private transformOperations(operations: TextOperation[], currentVersion: number, baseVersion: number): TextOperation[] {
    // Simple operational transformation - in a production app, you'd want a more sophisticated OT library
    if (currentVersion === baseVersion) {
      return operations;
    }

    // For now, return operations as-is
    // In a real implementation, you'd need to transform based on concurrent operations
    return operations;
  }

  private renderUserCursors() {
    console.log('🎨 Rendering user cursors. Count:', this.userCursors.size);
    if (!this.editor) {
      console.log('❌ No editor to render cursors on');
      return;
    }

    // Clear existing decorations
    this.editor.removeDecorations(['user-cursor', 'user-selection']);

    const decorations: editor.IModelDeltaDecoration[] = [];

    for (const cursor of this.userCursors.values()) {
      console.log('👤 Adding cursor decoration for:', cursor.userName, 'at', cursor.position);
      
      // Add cursor decoration
      decorations.push({
        range: new monaco.Range(cursor.position.lineNumber, cursor.position.column, cursor.position.lineNumber, cursor.position.column),
        options: {
          className: 'user-cursor',
          hoverMessage: { value: `${cursor.userName}'s cursor` },
          beforeContentClassName: 'user-cursor-before',
          afterContentClassName: 'user-cursor-after',
          stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges
        }
      });

      // Add selection decoration if exists
      if (cursor.selection) {
        console.log('📋 Adding selection decoration for:', cursor.userName);
        decorations.push({
          range: new monaco.Range(
            cursor.selection.startLineNumber,
            cursor.selection.startColumn,
            cursor.selection.endLineNumber,
            cursor.selection.endColumn
          ),
          options: {
            className: 'user-selection',
            hoverMessage: { value: `${cursor.userName}'s selection` },
            stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges
          }
        });
      }
    }

    console.log('✅ Applying', decorations.length, 'decorations');
    this.editor.deltaDecorations([], decorations);
  }

  private getUserColor(userId: string): string {
    const hash = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return this.userColors[hash % this.userColors.length];
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private getCurrentFileId(): string | null {
    const model = this.editor?.getModel();
    if (!model) return null;
    // This assumes the model's URI is the fileId. This needs to be consistent
    // with how tabs and files are managed in MonacoEditor.tsx
    return model.uri.toString();
  }

  getUserCursors(): Map<string, UserCursor> {
    return this.userCursors;
  }

  cleanup() {
    if (this.changeTimeout) {
      clearTimeout(this.changeTimeout);
    }
    this.userCursors.clear();
    this.fileVersions.clear();
    this.pendingOperations.clear();
  }
}

export const collaborationService = new CollaborationService();
