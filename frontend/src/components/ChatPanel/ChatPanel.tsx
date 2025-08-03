import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  MessageSquare,
  Send,
  Smile,
  Paperclip,
  MoreHorizontal,
  Hash,
  AtSign,
  Reply,
  Edit3,
  Trash2,
  Pin,
  Search,
  Settings,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

interface ChatMessage {
  id: string;
  userId: string;
  username: string;
  displayName: string;
  avatar?: string;
  content: string;
  timestamp: Date;
  isEdited?: boolean;
  replyTo?: {
    id: string;
    username: string;
    content: string;
  };
  reactions?: Array<{
    emoji: string;
    count: number;
    users: string[];
  }>;
  attachments?: Array<{
    id: string;
    name: string;
    url: string;
    type: string;
    size: number;
  }>;
  isPinned?: boolean;
  isSystem?: boolean;
}

interface TypingUser {
  userId: string;
  username: string;
  displayName: string;
}

interface ChatPanelProps {
  roomId: string;
  currentUserId: string;
  currentUsername: string;
  isCollapsed?: boolean;
}

const MessageItem: React.FC<{
  message: ChatMessage;
  currentUserId: string;
  onReply: (message: ChatMessage) => void;
  onEdit: (message: ChatMessage) => void;
  onDelete: (messageId: string) => void;
  onPin: (messageId: string) => void;
  onReact: (messageId: string, emoji: string) => void;
}> = ({ 
  message, 
  currentUserId, 
  onReply, 
  onEdit, 
  onDelete, 
  onPin, 
  onReact 
}) => {
  const isOwnMessage = message.userId === currentUserId;
  const [showActions, setShowActions] = useState(false);
  
  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const formatTimestamp = (timestamp: Date) => {
    const now = new Date();
    const diffInHours = (now.getTime() - timestamp.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 24) {
      return timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else {
      return timestamp.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          className={cn(
            "group px-3 py-2 hover:bg-discord-sidebar-hover/50 relative",
            message.isSystem && "bg-blue-500/10 border-l-2 border-blue-500"
          )}
          onMouseEnter={() => setShowActions(true)}
          onMouseLeave={() => setShowActions(false)}
        >
          {/* Reply indicator */}
          {message.replyTo && (
            <div className="flex items-center gap-2 mb-1 text-xs text-discord-muted">
              <Reply className="w-3 h-3" />
              <span>Replying to {message.replyTo.username}</span>
              <span className="truncate italic">"{message.replyTo.content}"</span>
            </div>
          )}
          
          <div className="flex items-start gap-3">
            <Avatar className="h-8 w-8 flex-shrink-0">
              <AvatarImage src={message.avatar} alt={message.displayName} />
              <AvatarFallback className="text-xs bg-discord-primary text-white">
                {getInitials(message.displayName)}
              </AvatarFallback>
            </Avatar>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className={cn(
                  "text-sm font-medium",
                  isOwnMessage ? "text-discord-primary" : "text-white"
                )}>
                  {message.displayName}
                </span>
                
                <span className="text-xs text-discord-muted">
                  {formatTimestamp(message.timestamp)}
                </span>
                
                {message.isEdited && (
                  <Badge variant="secondary" className="h-4 text-xs bg-discord-muted/20 text-discord-muted">
                    edited
                  </Badge>
                )}
                
                {message.isPinned && (
                  <Pin className="w-3 h-3 text-yellow-400" />
                )}
              </div>
              
              <div className="text-sm text-discord-text leading-relaxed whitespace-pre-wrap break-words">
                {message.content}
              </div>
              
              {/* Attachments */}
              {message.attachments && message.attachments.length > 0 && (
                <div className="mt-2 space-y-1">
                  {message.attachments.map((attachment) => (
                    <div
                      key={attachment.id}
                      className="flex items-center gap-2 p-2 bg-discord-editor rounded border border-discord-border text-xs"
                    >
                      <Paperclip className="w-3 h-3 text-discord-muted" />
                      <span className="text-discord-text">{attachment.name}</span>
                      <span className="text-discord-muted">({(attachment.size / 1024).toFixed(1)} KB)</span>
                    </div>
                  ))}
                </div>
              )}
              
              {/* Reactions */}
              {message.reactions && message.reactions.length > 0 && (
                <div className="flex items-center gap-1 mt-2">
                  {message.reactions.map((reaction, index) => (
                    <Button
                      key={index}
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs bg-discord-editor hover:bg-discord-sidebar-hover"
                      onClick={() => onReact(message.id, reaction.emoji)}
                    >
                      <span className="mr-1">{reaction.emoji}</span>
                      <span>{reaction.count}</span>
                    </Button>
                  ))}
                </div>
              )}
            </div>
            
            {/* Message Actions */}
            {showActions && (
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 hover:bg-discord-primary/20"
                        onClick={() => onReact(message.id, '👍')}
                      >
                        <Smile className="h-3 w-3" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Add Reaction</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 hover:bg-discord-primary/20"
                        onClick={() => onReply(message)}
                      >
                        <Reply className="h-3 w-3" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Reply</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                
                {isOwnMessage && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 hover:bg-discord-primary/20"
                          onClick={() => onEdit(message)}
                        >
                          <Edit3 className="h-3 w-3" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Edit</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
            )}
          </div>
        </div>
      </ContextMenuTrigger>
      
      <ContextMenuContent className="bg-discord-sidebar border-discord-border">
        <ContextMenuItem onClick={() => onReply(message)}>
          <Reply className="w-4 h-4 mr-2" />
          Reply
        </ContextMenuItem>
        
        <ContextMenuItem onClick={() => onPin(message.id)}>
          <Pin className="w-4 h-4 mr-2" />
          {message.isPinned ? 'Unpin' : 'Pin'} Message
        </ContextMenuItem>
        
        <ContextMenuSeparator />
        
        {isOwnMessage && (
          <>
            <ContextMenuItem onClick={() => onEdit(message)}>
              <Edit3 className="w-4 h-4 mr-2" />
              Edit Message
            </ContextMenuItem>
            
            <ContextMenuItem 
              onClick={() => onDelete(message.id)}
              className="text-red-400 focus:text-red-300"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Message
            </ContextMenuItem>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
};

const TypingIndicator: React.FC<{ typingUsers: TypingUser[] }> = ({ typingUsers }) => {
  if (typingUsers.length === 0) return null;
  
  const getTypingText = () => {
    if (typingUsers.length === 1) {
      return `${typingUsers[0].displayName} is typing...`;
    } else if (typingUsers.length === 2) {
      return `${typingUsers[0].displayName} and ${typingUsers[1].displayName} are typing...`;
    } else {
      return `${typingUsers.length} people are typing...`;
    }
  };
  
  return (
    <div className="px-3 py-2 text-xs text-discord-muted italic">
      <div className="flex items-center gap-2">
        <div className="flex space-x-0.5">
          <div className="w-1 h-1 bg-discord-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="w-1 h-1 bg-discord-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="w-1 h-1 bg-discord-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
        <span>{getTypingText()}</span>
      </div>
    </div>
  );
};

export const ChatPanel: React.FC<ChatPanelProps> = ({
  roomId,
  currentUserId,
  currentUsername,
  isCollapsed = false,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(null);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadMessages = useCallback(async () => {
    try {
      setIsLoading(true);
      
      // TODO: Implement actual messages API call
      // Mock data for now
      const mockMessages: ChatMessage[] = [
        {
          id: '1',
          userId: '2',
          username: 'alice_dev',
          displayName: 'Alice Johnson',
          content: 'Hey everyone! Ready to start coding?',
          timestamp: new Date(Date.now() - 3600000), // 1 hour ago
        },
        {
          id: '2',
          userId: currentUserId,
          username: currentUsername,
          displayName: 'You',
          content: 'Absolutely! Let\'s build something amazing.',
          timestamp: new Date(Date.now() - 3300000), // 55 minutes ago
        },
        {
          id: '3',
          userId: '3',
          username: 'bob_coder',
          displayName: 'Bob Smith',
          content: 'I just pushed the latest changes to the main branch. Check it out!',
          timestamp: new Date(Date.now() - 1800000), // 30 minutes ago
          reactions: [
            { emoji: '👍', count: 2, users: ['alice_dev', currentUsername] },
            { emoji: '🚀', count: 1, users: ['alice_dev'] },
          ],
        },
        {
          id: '4',
          userId: '2',
          username: 'alice_dev',
          displayName: 'Alice Johnson',
          content: 'Great work on the UI components!',
          timestamp: new Date(Date.now() - 900000), // 15 minutes ago
          replyTo: {
            id: '3',
            username: 'bob_coder',
            content: 'I just pushed the latest changes...',
          },
        },
        {
          id: '5',
          userId: '1',
          username: 'system',
          displayName: 'System',
          content: 'Charlie Brown joined the room',
          timestamp: new Date(Date.now() - 600000), // 10 minutes ago
          isSystem: true,
        },
      ];

      setMessages(mockMessages);
    } catch (error) {
      console.error('Failed to load messages:', error);
      toast.error('Failed to load messages');
    } finally {
      setIsLoading(false);
    }
  }, [currentUserId, currentUsername]);

  useEffect(() => {
    if (roomId) {
      loadMessages();
    }
  }, [roomId, loadMessages]);

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;

    const messageToSend = newMessage.trim();
    setNewMessage('');

    try {
      const newMsg: ChatMessage = {
        id: Date.now().toString(),
        userId: currentUserId,
        username: currentUsername,
        displayName: 'You',
        content: messageToSend,
        timestamp: new Date(),
        replyTo: replyTo ? {
          id: replyTo.id,
          username: replyTo.username,
          content: replyTo.content,
        } : undefined,
      };

      setMessages(prev => [...prev, newMsg]);
      setReplyTo(null);

      // TODO: Implement actual send message API call
      toast.success('Message sent');
    } catch (error) {
      console.error('Failed to send message:', error);
      toast.error('Failed to send message');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (editingMessage) {
        handleEditMessage();
      } else {
        handleSendMessage();
      }
    }
    
    if (e.key === 'Escape') {
      setReplyTo(null);
      setEditingMessage(null);
    }
  };

  const handleTyping = () => {
    // TODO: Implement typing indicator logic
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    typingTimeoutRef.current = setTimeout(() => {
      // Stop typing indicator
    }, 3000);
  };

  const handleReply = (message: ChatMessage) => {
    setReplyTo(message);
    inputRef.current?.focus();
  };

  const handleEdit = (message: ChatMessage) => {
    setEditingMessage(message);
    setNewMessage(message.content);
    inputRef.current?.focus();
  };

  const handleEditMessage = async () => {
    if (!editingMessage || !newMessage.trim()) return;

    try {
      setMessages(prev =>
        prev.map(msg =>
          msg.id === editingMessage.id
            ? { ...msg, content: newMessage.trim(), isEdited: true }
            : msg
        )
      );

      setEditingMessage(null);
      setNewMessage('');
      toast.success('Message edited');
    } catch (error) {
      console.error('Failed to edit message:', error);
      toast.error('Failed to edit message');
    }
  };

  const handleDelete = async (messageId: string) => {
    try {
      setMessages(prev => prev.filter(msg => msg.id !== messageId));
      toast.success('Message deleted');
    } catch (error) {
      console.error('Failed to delete message:', error);
      toast.error('Failed to delete message');
    }
  };

  const handlePin = async (messageId: string) => {
    try {
      setMessages(prev =>
        prev.map(msg =>
          msg.id === messageId
            ? { ...msg, isPinned: !msg.isPinned }
            : msg
        )
      );
      toast.success('Message pin status updated');
    } catch (error) {
      console.error('Failed to update pin status:', error);
      toast.error('Failed to update pin status');
    }
  };

  const handleReact = async (messageId: string, emoji: string) => {
    try {
      setMessages(prev =>
        prev.map(msg => {
          if (msg.id !== messageId) return msg;
          
          const reactions = msg.reactions || [];
          const existingReaction = reactions.find(r => r.emoji === emoji);
          
          if (existingReaction) {
            if (existingReaction.users.includes(currentUsername)) {
              // Remove reaction
              existingReaction.count--;
              existingReaction.users = existingReaction.users.filter(u => u !== currentUsername);
              if (existingReaction.count === 0) {
                return { ...msg, reactions: reactions.filter(r => r.emoji !== emoji) };
              }
            } else {
              // Add reaction
              existingReaction.count++;
              existingReaction.users.push(currentUsername);
            }
          } else {
            // New reaction
            reactions.push({
              emoji,
              count: 1,
              users: [currentUsername],
            });
          }
          
          return { ...msg, reactions };
        })
      );
    } catch (error) {
      console.error('Failed to react to message:', error);
      toast.error('Failed to react to message');
    }
  };

  if (isCollapsed) {
    return (
      <div className="h-full bg-discord-sidebar flex flex-col items-center justify-center p-2">
        <MessageSquare className="h-6 w-6 text-discord-text mb-2" />
        <span className="text-xs text-discord-muted text-center">Chat</span>
      </div>
    );
  }

  return (
    <div className="h-full bg-discord-sidebar flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-2 border-b border-discord-border">
        <div className="flex items-center gap-2">
          <Hash className="w-4 h-4 text-discord-text" />
          <span className="text-sm font-medium text-discord-text">
            general
          </span>
        </div>
        
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 hover:bg-discord-sidebar-hover"
            title="Search Messages"
          >
            <Search className="h-3 w-3" />
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 hover:bg-discord-sidebar-hover"
            title="Chat Settings"
          >
            <Settings className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1">
        <div className="py-2">
          {isLoading ? (
            <div className="flex items-center justify-center h-20">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-discord-primary"></div>
            </div>
          ) : (
            <>
              {messages.map((message) => (
                <MessageItem
                  key={message.id}
                  message={message}
                  currentUserId={currentUserId}
                  onReply={handleReply}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onPin={handlePin}
                  onReact={handleReact}
                />
              ))}
              
              <TypingIndicator typingUsers={typingUsers} />
              <div ref={messagesEndRef} />
            </>
          )}
        </div>
      </ScrollArea>

      {/* Reply/Edit Indicator */}
      {(replyTo || editingMessage) && (
        <div className="px-3 py-2 bg-discord-editor border-t border-discord-border">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-discord-muted">
              {replyTo && (
                <>
                  <Reply className="w-3 h-3" />
                  <span>Replying to {replyTo.displayName}</span>
                </>
              )}
              {editingMessage && (
                <>
                  <Edit3 className="w-3 h-3" />
                  <span>Editing message</span>
                </>
              )}
            </div>
            
            <Button
              variant="ghost"
              size="sm"
              className="h-4 w-4 p-0"
              onClick={() => {
                setReplyTo(null);
                setEditingMessage(null);
                setNewMessage('');
              }}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}

      {/* Message Input */}
      <div className="p-3 border-t border-discord-border">
        <div className="flex items-end gap-2">
          <div className="flex-1 relative">
            <Input
              ref={inputRef}
              placeholder={`Message #general`}
              value={newMessage}
              onChange={(e) => {
                setNewMessage(e.target.value);
                handleTyping();
              }}
              onKeyDown={handleKeyDown}
              className="bg-discord-editor border-discord-border text-white placeholder:text-discord-muted pr-20"
            />
            
            <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 hover:bg-discord-sidebar-hover"
                title="Attach File"
              >
                <Paperclip className="h-3 w-3" />
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 hover:bg-discord-sidebar-hover"
                title="Add Emoji"
              >
                <Smile className="h-3 w-3" />
              </Button>
            </div>
          </div>
          
          <Button
            size="sm"
            onClick={editingMessage ? handleEditMessage : handleSendMessage}
            disabled={!newMessage.trim()}
            className="h-9 w-9 p-0"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};
