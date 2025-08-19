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
  isTyping?: boolean;
  lastActivity?: number;
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
  private cursorDecorations: string[] = [];
  private cursorElements: Map<string, HTMLElement> = new Map();
  private cursorUpdateTimeout: NodeJS.Timeout | null = null;
  private typingIndicators: Map<string, NodeJS.Timeout> = new Map();
  private currentFileId: string | null = null;

  // User colors for cursors/selections
  private userColors = [
    '#FF6B6B',
    '#4ECDC4',
    '#45B7D1',
    '#96CEB4',
    '#FFEAA7',
    '#DDA0DD',
    '#98D8C8',
    '#FFB6C1',
    '#87CEEB',
    '#F0E68C',
  ];

  setEditor(editorInstance: editor.IStandaloneCodeEditor) {
    this.editor = editorInstance;
    this.setupEditorListeners();
  }

  setUser(user: { id: string; name: string }) {
    this.currentUser = user;
  }

  setRoomId(roomId: string) {
    this.roomId = roomId;
    // Install listeners once a room is set
    socketService.onCollaborativeChange((change) => this.receiveRemoteChange(change));
    socketService.onCollaborativeAck(({ fileId, ackVersion }) => this.handleAck(fileId, ackVersion));
    socketService.onFileSync(({ fileId, content, version }) => this.applyFileSync(fileId, content, version));
  }

  initializeFile(fileId: string, content: string, version: number = 0) {
    console.log('📂 Initializing file:', fileId, 'with version:', version);
    this.fileVersions.set(fileId, {
      fileId,
      version,
      content,
      lastModified: new Date(),
    });
    if (!this.pendingOperations.has(fileId)) {
      this.pendingOperations.set(fileId, []);
    }
  }

  setCurrentFile(fileId: string) {
    this.currentFileId = fileId;
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
    this.editor.onDidChangeModelContent(event => {
      console.log(
        '📝 Content changed, applying remote change:',
        this.isApplyingRemoteChange
      );
      if (this.isApplyingRemoteChange) return;

      const model = this.editor?.getModel();
      if (!model) return;

      // Debounce changes to avoid flooding
      if (this.changeTimeout) {
        clearTimeout(this.changeTimeout);
      }

      this.changeTimeout = setTimeout(() => {
        this.handleLocalChange(event);
      }, 20);
    });

    // Listen for cursor position changes
    this.editor.onDidChangeCursorPosition(event => {
      if (this.isApplyingRemoteChange) return;
      this.handleCursorChange(event);
    });

    // Listen for selection changes
    this.editor.onDidChangeCursorSelection(event => {
      if (this.isApplyingRemoteChange) return;
      this.handleSelectionChange(event);
    });

    console.log('✅ Editor listeners setup complete');
  }

  private handleLocalChange(event: editor.IModelContentChangedEvent) {
    console.log('🔥 Local change detected:', event.changes);
    const model = this.editor?.getModel();
    if (!model || !this.currentUser || !this.roomId) {
      console.log('❌ Missing requirements:', {
        model: !!model,
        user: !!this.currentUser,
        roomId: this.roomId,
      });
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

    // Send typing indicator immediately
    this.sendTypingIndicator(true);

    const operations = this.convertMonacoChangesToOperations(
      event.changes,
      model,
      fileVersion.content.length
    );
    // If the net effect is only whitespace/selection changes, skip
    if (operations.length === 1 && operations[0].type === 'retain') {
      return;
    }
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
      timestamp: Date.now(),
    };

    console.log('✅ Sending collaborative change:', change);

    // Optimistically update local version and queue pending op
    const optimisticContent = this.applyOperationsToContent(fileVersion.content, operations);
    this.fileVersions.set(fileId, {
      ...fileVersion,
      version: fileVersion.version + 1,
      content: optimisticContent,
      lastModified: new Date(),
    });

    const queue = this.pendingOperations.get(fileId)!;
    queue.push(change);

    // Send to server
    socketService.sendCollaborativeChange(change);

    // Stop typing indicator after 1 second of no activity
    setTimeout(() => {
      this.sendTypingIndicator(false);
    }, 1000);
  }

  private sendTypingIndicator(isTyping: boolean) {
    if (!this.currentUser || !this.roomId) return;
    
    const fileId = this.getCurrentFileId();
    if (!fileId) return;

    // Clear existing typing timeout
    const existingTimeout = this.typingIndicators.get(this.currentUser.id);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    if (isTyping) {
      // Set timeout to automatically stop typing indicator
      const timeout = setTimeout(() => {
        this.sendTypingIndicator(false);
      }, 2000);
      this.typingIndicators.set(this.currentUser.id, timeout);
    } else {
      this.typingIndicators.delete(this.currentUser.id);
    }

    // Get current cursor position
    const position = this.editor?.getPosition();
    if (position) {
      const cursor: UserCursor = {
        userId: this.currentUser.id,
        userName: this.currentUser.name,
        fileId,
        position: {
          lineNumber: position.lineNumber,
          column: position.column,
        },
        color: this.getUserColor(this.currentUser.id),
        isTyping,
        lastActivity: Date.now(),
      };

      socketService.sendCursorUpdate(cursor);
    }
  }

  private handleCursorChange(event: editor.ICursorPositionChangedEvent) {
    console.log('🎯 Cursor change detected:', event.position);
    if (!this.currentUser || !this.roomId) {
      console.log('❌ Missing user or room:', {
        user: !!this.currentUser,
        roomId: this.roomId,
      });
      return;
    }
    const fileId = this.getCurrentFileId();
    if (!fileId) {
      console.log('❌ No fileId for cursor');
      return;
    }

    // Throttle cursor updates to avoid flooding
    if (this.cursorUpdateTimeout) {
      clearTimeout(this.cursorUpdateTimeout);
    }

    this.cursorUpdateTimeout = setTimeout(() => {
      const cursor: UserCursor = {
        userId: this.currentUser!.id,
        userName: this.currentUser!.name,
        fileId: fileId,
        position: {
          lineNumber: event.position.lineNumber,
          column: event.position.column,
        },
        color: this.getUserColor(this.currentUser!.id),
        isTyping: false,
        lastActivity: Date.now(),
      };

      console.log('✅ Sending cursor update:', cursor);
      socketService.sendCursorUpdate(cursor);
    }, 16); // ~60fps update rate
  }

  private handleSelectionChange(event: editor.ICursorSelectionChangedEvent) {
    if (!this.currentUser || !this.roomId) return;
    const fileId = this.getCurrentFileId();
    if (!fileId) return;

    // Throttle selection updates
    if (this.cursorUpdateTimeout) {
      clearTimeout(this.cursorUpdateTimeout);
    }

    this.cursorUpdateTimeout = setTimeout(() => {
      const selection = event.selection;
      const cursor: UserCursor = {
        userId: this.currentUser!.id,
        userName: this.currentUser!.name,
        fileId: fileId,
        position: {
          lineNumber: selection.positionLineNumber,
          column: selection.positionColumn,
        },
        selection: {
          startLineNumber: selection.startLineNumber,
          startColumn: selection.startColumn,
          endLineNumber: selection.endLineNumber,
          endColumn: selection.endColumn,
        },
        color: this.getUserColor(this.currentUser!.id),
      };

      socketService.sendCursorUpdate(cursor);
    }, 16); // ~60fps update rate
  }

  applyRemoteChange(change: CollaborativeChange) {
    console.log('📥 Received remote change:', change);
    if (!this.editor || change.userId === this.currentUser?.id) {
      console.log('❌ Ignoring change:', {
        noEditor: !this.editor,
        ownChange: change.userId === this.currentUser?.id,
      });
      return;
    }

    const model = this.editor.getModel();
    const fileId = this.getCurrentFileId();
    if (!model || !fileId || fileId !== change.fileId) {
      console.log('❌ Model/file mismatch:', {
        model: !!model,
        fileId,
        changeFileId: change.fileId,
      });
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
      // Transform incoming op against our pending local ops for this file
      const queue = this.pendingOperations.get(change.fileId) || [];
      let transformed = change.operations;
      for (const local of queue) {
        transformed = this.transformOperations(transformed, local.operations);
      }

      console.log('✅ Applying transformed operations:', transformed);
      const currentContent = fileVersion.content;
      const newContent = this.applyOperationsToContent(currentContent, transformed);
      this.isApplyingRemoteChange = true;
      try {
        model.setValue(newContent);
      } finally {
        this.isApplyingRemoteChange = false;
      }

      // Update file version
      this.fileVersions.set(fileId, {
        ...fileVersion,
        version: (change as any).appliedVersion || fileVersion.version + 1,
        content: newContent,
        lastModified: new Date(),
      });

      console.log('✅ Remote change applied successfully');
    } finally {
      this.isApplyingRemoteChange = false;
    }
  }

  private receiveRemoteChange(change: any) {
    this.applyRemoteChange(change as CollaborativeChange);
  }

  private handleAck(fileId: string, ackVersion: number) {
    const queue = this.pendingOperations.get(fileId);
    if (!queue || queue.length === 0) return;
    // Drop the first pending operation (assumes FIFO)
    queue.shift();
    const file = this.fileVersions.get(fileId);
    if (file) {
      this.fileVersions.set(fileId, { ...file, version: ackVersion, lastModified: new Date() });
    }
  }

  private applyFileSync(fileId: string, content: string, version: number) {
    this.fileVersions.set(fileId, {
      fileId,
      version,
      content,
      lastModified: new Date(),
    });
    if (this.editor) {
      const model = this.editor.getModel();
      if (model) {
        this.isApplyingRemoteChange = true;
        try {
          model.setValue(content);
        } finally {
          this.isApplyingRemoteChange = false;
        }
      }
    }
  }

  updateRemoteCursor(cursor: UserCursor) {
    console.log('👆 Remote cursor update:', cursor);
    if (!this.editor || cursor.userId === this.currentUser?.id) {
      console.log('❌ Ignoring cursor:', {
        noEditor: !this.editor,
        ownCursor: cursor.userId === this.currentUser?.id,
      });
      return;
    }
    const fileId = this.getCurrentFileId();
    if (!fileId || fileId !== cursor.fileId) {
      console.log('❌ Cursor file mismatch:', {
        fileId,
        cursorFileId: cursor.fileId,
      });
      return;
    }

    // Update cursor with latest activity
    const updatedCursor = {
      ...cursor,
      lastActivity: Date.now(),
    };
    
    this.userCursors.set(cursor.userId, updatedCursor);
    console.log('✅ Rendering cursors. Total cursors:', this.userCursors.size);
    this.renderUserCursors();

    // Clear typing status after inactivity
    if (cursor.isTyping) {
      const existingTimeout = this.typingIndicators.get(cursor.userId);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
      }

      const timeout = setTimeout(() => {
        const currentCursor = this.userCursors.get(cursor.userId);
        if (currentCursor) {
          this.userCursors.set(cursor.userId, {
            ...currentCursor,
            isTyping: false,
          });
          this.renderUserCursors();
        }
        this.typingIndicators.delete(cursor.userId);
      }, 3000);

      this.typingIndicators.set(cursor.userId, timeout);
    }
  }

  private convertMonacoChangesToOperations(
    changes: editor.IModelContentChange[],
    model: editor.ITextModel,
    oldContentLength: number
  ): TextOperation[] {
    const operations: TextOperation[] = [];
    let lastOffset = 0;

    // Sort changes by offset to process them in order
    const sortedChanges = [...changes].sort(
      (a, b) => a.rangeOffset - b.rangeOffset
    );

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

    // Use OLD document length here; Monaco changes are relative to previous content
    const finalRetain = oldContentLength - lastOffset;
    if (finalRetain > 0) {
      operations.push({ type: 'retain', length: finalRetain });
    }

    return operations;
  }

  private applyOperationsToContent(content: string, operations: TextOperation[]): string {
    let index = 0;
    let result = '';
    for (const op of operations) {
      if (op.type === 'retain') {
        const len = op.length || 0;
        result += content.slice(index, index + len);
        index += len;
      } else if (op.type === 'insert') {
        result += op.text || '';
      } else if (op.type === 'delete') {
        index += op.length || 0;
      }
    }
    if (index < content.length) {
      result += content.slice(index);
    }
    return result;
  }

  private transformOperations(incoming: TextOperation[], against: TextOperation[]): TextOperation[] {
    // Transform incoming operation against another operation
    const a = [...incoming];
    const b = [...against];
    const result: TextOperation[] = [];
    let i = 0, j = 0;
    let aOffset = 0, bOffset = 0;

    const pushRetain = (len: number) => {
      if (len <= 0) return;
      const prev = result[result.length - 1];
      if (prev && prev.type === 'retain') prev.length = (prev.length || 0) + len;
      else result.push({ type: 'retain', length: len });
    };
    const pushInsert = (text: string) => {
      if (!text) return;
      const prev = result[result.length - 1];
      if (prev && prev.type === 'insert') prev.text = (prev.text || '') + text;
      else result.push({ type: 'insert', text });
    };
    const pushDelete = (len: number) => {
      if (len <= 0) return;
      const prev = result[result.length - 1];
      if (prev && prev.type === 'delete') prev.length = (prev.length || 0) + len;
      else result.push({ type: 'delete', length: len });
    };

    let aOp = a[i];
    let bOp = b[j];
    while (aOp || bOp) {
      if (bOp && bOp.type === 'insert') {
        pushRetain((bOp.text || '').length - bOffset);
        j++; bOp = b[j]; bOffset = 0;
        continue;
      }
      if (aOp && aOp.type === 'insert') {
        pushInsert((aOp.text || '').slice(aOffset));
        i++; aOp = a[i]; aOffset = 0;
        continue;
      }
      const aLen = aOp ? (aOp.type !== 'insert' ? (aOp.length || 0) - aOffset : 0) : 0;
      const bLen = bOp ? (bOp.type !== 'insert' ? (bOp.length || 0) - bOffset : 0) : 0;
      if (!bOp || bOp.type === 'retain') {
        if (aOp && aOp.type === 'retain') { pushRetain(aLen); i++; aOp = a[i]; aOffset = 0; }
        else if (aOp && aOp.type === 'delete') { pushDelete(aLen); i++; aOp = a[i]; aOffset = 0; }
        else { j++; bOp = b[j]; bOffset = 0; }
      } else if (bOp.type === 'delete') {
        const consume = Math.min(aLen, bLen);
        if (aOp && aOp.type === 'retain') {
          // Skip retain over deleted text
          aOffset += consume;
        } else if (aOp && aOp.type === 'delete') {
          // Deleting same region: shrink our delete
          aOffset += consume;
        }
        if (aOffset === (aOp?.length || 0)) { i++; aOp = a[i]; aOffset = 0; }
        if (consume === bLen) { j++; bOp = b[j]; bOffset = 0; } else { bOffset += consume; }
      }
    }
    return result;
  }

  private renderUserCursors() {
    console.log('🎨 Rendering user cursors. Count:', this.userCursors.size);
    if (!this.editor) {
      console.log('❌ No editor to render cursors on');
      return;
    }

    // Clear existing decorations
    if (this.cursorDecorations.length > 0) {
      this.editor.deltaDecorations(this.cursorDecorations, []);
      this.cursorDecorations = [];
    }

    // Clear existing cursor label elements
    this.cursorElements.forEach(element => {
      element.remove();
    });
    this.cursorElements.clear();

    const decorations: editor.IModelDeltaDecoration[] = [];
    const currentFileId = this.getCurrentFileId();

    for (const cursor of this.userCursors.values()) {
      // Only render cursors for the current file
      if (cursor.fileId !== currentFileId) continue;

      console.log(
        '👤 Adding cursor decoration for:',
        cursor.userName,
        'at',
        cursor.position
      );

      const userColorIndex = this.getUserColorIndex(cursor.userId);
      const userColor = this.userColors[userColorIndex];

      // Add cursor line decoration
      decorations.push({
        range: new monaco.Range(
          cursor.position.lineNumber,
          cursor.position.column,
          cursor.position.lineNumber,
          cursor.position.column
        ),
        options: {
          className: `user-cursor cursor-color-${userColorIndex}`,
          hoverMessage: { value: `${cursor.userName} is here` },
          beforeContentClassName: 'user-cursor-before',
          afterContentClassName: 'user-cursor-after',
          stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
        },
      });

      // Add selection decoration if exists
      if (cursor.selection && this.hasSelection(cursor.selection)) {
        console.log('📋 Adding selection decoration for:', cursor.userName);
        decorations.push({
          range: new monaco.Range(
            cursor.selection.startLineNumber,
            cursor.selection.startColumn,
            cursor.selection.endLineNumber,
            cursor.selection.endColumn
          ),
          options: {
            className: `user-selection cursor-color-${userColorIndex}`,
            hoverMessage: { value: `${cursor.userName}'s selection` },
            stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
          },
        });
      }

      // Create floating cursor label
      this.createCursorLabel(cursor, userColor, userColorIndex);
    }

    // Apply all decorations
    if (decorations.length > 0) {
      this.cursorDecorations = this.editor.deltaDecorations([], decorations);
      console.log('✅ Applied', decorations.length, 'cursor decorations');
    }
  }

  private hasSelection(selection: { 
    startLineNumber: number; 
    endLineNumber: number; 
    startColumn: number; 
    endColumn: number; 
  }): boolean {
    return selection.startLineNumber !== selection.endLineNumber || 
           selection.startColumn !== selection.endColumn;
  }

  private getUserColorIndex(userId: string): number {
    const hash = userId
      .split('')
      .reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return hash % this.userColors.length;
  }

  private createCursorLabel(cursor: UserCursor, color: string, colorIndex: number) {
    if (!this.editor) return;

    try {
      // Check if editor is still mounted and accessible
      const editorContainer = this.editor.getDomNode();
      if (!editorContainer || !editorContainer.parentNode) {
        console.warn('⚠️ Editor DOM node not available for cursor label');
        return;
      }

      // Get the position in pixels
      const position = this.editor.getScrolledVisiblePosition({
        lineNumber: cursor.position.lineNumber,
        column: cursor.position.column
      });

      if (!position) return;

      // Create label element
      const label = document.createElement('div');
      const typingClass = cursor.isTyping ? ' user-typing-indicator' : '';
      label.className = `user-cursor-label cursor-color-${colorIndex}${typingClass}`;
      label.textContent = cursor.isTyping ? `${cursor.userName} (typing...)` : cursor.userName;
      label.style.cssText = `
        position: absolute;
        top: ${position.top - 24}px;
        left: ${position.left - 1}px;
        background-color: ${color};
        color: white;
        padding: 2px 6px;
        border-radius: 3px;
        font-size: 11px;
        font-weight: 500;
        white-space: nowrap;
        z-index: 1002;
        pointer-events: none;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        animation: cursorLabelFadeIn 0.2s ease-out;
        transform-origin: bottom left;
        ${cursor.isTyping ? 'border: 1px solid rgba(255, 255, 255, 0.3);' : ''}
      `;

      // Add arrow
      const arrow = document.createElement('div');
      arrow.style.cssText = `
        position: absolute;
        top: 100%;
        left: 6px;
        width: 0;
        height: 0;
        border-left: 4px solid transparent;
        border-right: 4px solid transparent;
        border-top: 4px solid ${color};
      `;
      label.appendChild(arrow);

      // Remove existing label for this user
      const existingLabel = this.cursorElements.get(cursor.userId);
      if (existingLabel && existingLabel.parentNode) {
        existingLabel.remove();
      }

      editorContainer.appendChild(label);
      this.cursorElements.set(cursor.userId, label);

      // Auto-hide label after time (longer for typing users)
      const hideDelay = cursor.isTyping ? 5000 : 3000;
      setTimeout(() => {
        if (this.cursorElements.get(cursor.userId) === label) {
          label.style.opacity = '0';
          label.style.transition = 'opacity 0.3s ease-out';
          setTimeout(() => {
            if (label.parentNode) {
              label.remove();
            }
            if (this.cursorElements.get(cursor.userId) === label) {
              this.cursorElements.delete(cursor.userId);
            }
          }, 300);
        }
      }, hideDelay);

    } catch (error) {
      console.warn('Failed to create cursor label:', error);
    }
  }

  private getUserColor(userId: string): string {
    const hash = userId
      .split('')
      .reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return this.userColors[hash % this.userColors.length];
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private getCurrentFileId(): string | null {
    return this.currentFileId;
  }

  getUserCursors(): Map<string, UserCursor> {
    return this.userCursors;
  }

  cleanup() {
    if (this.changeTimeout) {
      clearTimeout(this.changeTimeout);
    }
    
    if (this.cursorUpdateTimeout) {
      clearTimeout(this.cursorUpdateTimeout);
    }

    // Clear typing indicator timeouts
    this.typingIndicators.forEach(timeout => clearTimeout(timeout));
    this.typingIndicators.clear();
    
    // Clear cursor decorations
    if (this.editor && this.cursorDecorations.length > 0) {
      this.editor.deltaDecorations(this.cursorDecorations, []);
      this.cursorDecorations = [];
    }
    
    // Remove cursor label elements
    this.cursorElements.forEach(element => {
      if (element.parentNode) {
        element.remove();
      }
    });
    this.cursorElements.clear();
    
    this.userCursors.clear();
    this.fileVersions.clear();
    this.pendingOperations.clear();
  }
}

export const collaborationService = new CollaborationService();
