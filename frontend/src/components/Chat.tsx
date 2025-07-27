import React, { useState, useEffect, useRef } from "react";
import { Send, Smile, Plus, Hash, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import { Message, chatAPI, Reaction } from "@/lib/api";
import socketService from "@/lib/socket";
import { toast } from "sonner";

interface ChatProps {
  roomId: string;
  onClose?: () => void;
}

const Chat: React.FC<ChatProps> = ({ roomId, onClose }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [reactingMessageId, setReactingMessageId] = useState<string | null>(
    null,
  );
  const [newMessage, setNewMessage] = useState("");
  const [typingUsers, setTypingUsers] = useState<
    Array<{ userId: string; userName: string }>
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();

  // Handle add/remove reaction
  const handleReaction = async (messageId: string, emoji: string) => {
    if (!user) return;
    const message = messages.find((m) => m.id === messageId);
    if (!message) return;
    const hasReacted = message.reactions?.some(
      (r) => r.emoji === emoji && r.userId === user.id,
    );
    try {
      let updatedReactions: Reaction[] = [];
      if (hasReacted) {
        const res = await chatAPI.removeReaction(messageId, emoji);
        updatedReactions = res.reactions;
      } else {
        const res = await chatAPI.addReaction(messageId, emoji);
        updatedReactions = res.reactions;
      }
      setMessages((msgs) =>
        msgs.map((m) =>
          m.id === messageId ? { ...m, reactions: updatedReactions } : m,
        ),
      );
    } catch (err) {
      toast.error("Failed to update reaction");
    }
  };

  // Load existing messages when component mounts
  useEffect(() => {
    const loadMessages = async () => {
      if (!roomId) return;
      try {
        setIsLoading(true);
        const response = await chatAPI.getRoomMessages(roomId);
        if (response.messages && Array.isArray(response.messages)) {
          setMessages(response.messages);
        } else {
          setMessages([]);
        }
      } catch (error) {
        setMessages([]);
      } finally {
        setIsLoading(false);
      }
    };
    loadMessages();
  }, [roomId]);

  // Socket listeners
  useEffect(() => {
    if (!roomId) return;

    const handleNewMessage = (message: Message) => {
      setMessages((prev) => {
        const messageExists = prev.some((m) => m.id === message.id);
        if (messageExists) return prev;
        return [...prev, message];
      });
    };

    const handleTyping = (data: {
      userId: string;
      userName: string;
      isTyping: boolean;
    }) => {
      setTypingUsers((prev) => {
        if (data.isTyping) {
          if (!prev.some((u) => u.userId === data.userId)) {
            return [...prev, { userId: data.userId, userName: data.userName }];
          }
        } else {
          return prev.filter((u) => u.userId !== data.userId);
        }
        return prev;
      });
    };

    socketService.onNewMessage(handleNewMessage);
    socketService.onTypingUpdate(handleTyping);

    return () => {
      // Listeners are managed by socketService now
    };
  }, [roomId]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Handle message send
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user) return;

    try {
      const messageData: Message = {
        id: `${user.id}-${Date.now()}`,
        sender: user.name,
        senderId: user.id,
        text: newMessage.trim(),
        timestamp: new Date().toISOString(),
      };

      setNewMessage("");
      socketService.sendMessage(messageData);
      socketService.stopTyping(roomId);
    } catch (error) {
      toast.error("Failed to send message");
    }
  };

  // Handle typing indicators
  const handleTyping = (value: string) => {
    setNewMessage(value);
    if (value.trim()) {
      socketService.startTyping(roomId);
    } else {
      socketService.stopTyping(roomId);
    }
  };

  // Format timestamp
  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    if (isToday) {
      return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    } else {
      return date.toLocaleDateString([], { month: "short", day: "numeric" });
    }
  };

  return (
    <main className="flex flex-col h-full bg-discord-activity relative">
      {/* Chat Header */}
      <div className="px-4 py-3 border-b border-[#232428] flex items-center gap-2 flex-shrink-0">
        <Hash className="w-5 h-5 text-[#80848e]" />
        <h2 className="font-semibold text-white text-base">general</h2>
        <div className="w-px h-4 bg-[#3f4248] mx-2" />
        <span className="text-xs text-[#b5bac1]">
          This is the beginning of the #general channel.
        </span>
        {onClose && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 hover:bg-[#35373c] ml-auto"
            onClick={onClose}
          >
            <X className="h-4 w-4 text-[#b5bac1]" />
          </Button>
        )}
      </div>

      {/* Messages Wrapper */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full overflow-y-auto vscode-scrollbar">
          <div className="flex flex-col">
            {/* Welcome Message */}
            <div className="px-4 py-6">
              <div className="flex items-start gap-4 mb-4">
                <div className="w-16 h-16 bg-[#5865f2] rounded-full flex items-center justify-center flex-shrink-0">
                  <Hash className="w-8 h-8 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="text-white text-xl font-bold mb-1">
                    Welcome to #general!
                  </h3>
                  <p className="text-[#b5bac1] text-sm leading-relaxed">
                    This is the start of the #general channel.
                  </p>
                </div>
              </div>
            </div>

            {/* Date Divider */}
            {messages.length > 0 && (
              <div className="relative mx-4 mb-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="flex-1 border-t border-[#3f4248]"></div>
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-[#313338] px-2 text-xs text-[#949ba4] font-medium">
                    {new Date(messages[0]?.timestamp).toLocaleDateString(
                      "en-US",
                      {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      },
                    )}
                  </span>
                </div>
              </div>
            )}

            {/* Messages */}
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-sm text-[#b5bac1]">
                  Loading messages...
                </div>
              </div>
            ) : (
              <div className="px-4 pb-4">
                {messages.map((message, index) => {
                  const isConsecutive =
                    index > 0 &&
                    messages[index - 1].senderId === message.senderId &&
                    new Date(message.timestamp).getTime() -
                      new Date(messages[index - 1].timestamp).getTime() <
                      420000; // 7 minutes

                  return (
                    <div
                      key={message.id}
                      className={`group flex gap-4 py-0.5 px-4 -mx-4 hover:bg-[#2e3035] relative ${
                        isConsecutive ? "mt-0.5" : "mt-4"
                      }`}
                    >
                      {!isConsecutive ? (
                        <Avatar className="w-10 h-10 flex-shrink-0 mt-0.5">
                          {message.profilePicId ? (
                            <AvatarImage
                              src={`/api/files/${message.profilePicId}`}
                              alt={message.sender}
                            />
                          ) : (
                            <AvatarImage
                              src={`https://ui-avatars.com/api/?name=${encodeURIComponent(message.sender)}&background=5865f2&color=fff&size=40`}
                              alt={message.sender}
                            />
                          )}
                          <AvatarFallback className="bg-[#5865f2] text-white font-medium">
                            {message.sender.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      ) : (
                        <div className="w-10 flex-shrink-0 flex items-center justify-center">
                          <span className="text-xs text-[#72767d] opacity-0 group-hover:opacity-100 transition-opacity">
                            {formatTimestamp(message.timestamp)}
                          </span>
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        {!isConsecutive && (
                          <div className="flex items-baseline gap-2 mb-1">
                            <span className="font-medium text-white text-sm hover:underline cursor-pointer">
                              {message.sender}
                            </span>
                            <span className="text-xs text-[#72767d]">
                              {formatTimestamp(message.timestamp)}
                            </span>
                          </div>
                        )}
                        <div className="text-[#dcddde] text-sm leading-relaxed break-words">
                          {message.text}
                        </div>
                        {/* Reactions Row */}
                        {message.reactions && message.reactions.length > 0 && (
                          <div className="flex gap-1 mt-1">
                            {Array.from(
                              new Set(message.reactions.map((r) => r.emoji)),
                            ).map((emoji) => {
                              const count =
                                message.reactions?.filter(
                                  (r) => r.emoji === emoji,
                                ).length || 0;
                              const reacted = message.reactions?.some(
                                (r) =>
                                  r.emoji === emoji && r.userId === user?.id,
                              );
                              return (
                                <button
                                  key={emoji}
                                  className={`px-2 py-0.5 rounded-full text-xs border ${reacted ? "bg-[#5865f2] text-white border-[#5865f2]" : "bg-[#232428] text-[#b5bac1] border-[#35373c]"} hover:bg-[#35373c]`}
                                  onClick={() =>
                                    handleReaction(message.id, emoji)
                                  }
                                >
                                  <span>{emoji}</span> <span>{count}</span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Message Actions (visible on hover) */}
                      <div className="absolute top-0 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="flex items-center gap-1 bg-[#2e3035] border border-[#3f4248] rounded px-1 py-0.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 hover:bg-[#35373c] text-[#b5bac1] hover:text-white"
                            onClick={() => setReactingMessageId(message.id)}
                          >
                            <Smile className="w-4 h-4" />
                          </Button>
                          {/* Emoji Picker (simple) */}
                          {reactingMessageId === message.id && (
                            <div className="absolute z-50 right-8 top-0 bg-[#232428] border border-[#35373c] rounded shadow p-2 flex gap-1">
                              {[
                                "👍",
                                "😂",
                                "😮",
                                "😢",
                                "🎉",
                                "❤️",
                                "🔥",
                                "👀",
                              ].map((emoji) => (
                                <button
                                  key={emoji}
                                  className="text-xl hover:scale-125 transition-transform"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleReaction(message.id, emoji);
                                    setReactingMessageId(null);
                                  }}
                                >
                                  {emoji}
                                </button>
                              ))}
                              <button
                                className="ml-2 text-xs text-[#b5bac1]"
                                onClick={() => setReactingMessageId(null)}
                              >
                                ×
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Typing indicators */}
                {typingUsers.length > 0 && (
                  <div className="flex items-center gap-3 mt-4 px-4 -mx-4">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-[#b5bac1] rounded-full animate-bounce"></div>
                      <div
                        className="w-2 h-2 bg-[#b5bac1] rounded-full animate-bounce"
                        style={{ animationDelay: "0.1s" }}
                      ></div>
                      <div
                        className="w-2 h-2 bg-[#b5bac1] rounded-full animate-bounce"
                        style={{ animationDelay: "0.2s" }}
                      ></div>
                    </div>
                    <span className="text-sm text-[#b5bac1]">
                      {typingUsers.length === 1
                        ? `${typingUsers[0].userName} is typing...`
                        : `${typingUsers.length} people are typing...`}
                    </span>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Message Input */}
      <form onSubmit={handleSendMessage} className="p-4 flex-shrink-0">
        <div className="bg-[#383a40] rounded-lg flex items-center">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-11 w-11 p-0 hover:bg-[#3f4248] rounded-l-lg rounded-r-none text-[#b5bac1] hover:text-white"
          >
            <Plus className="w-5 h-5" />
          </Button>

          <div className="flex-1 relative">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => handleTyping(e.target.value)}
              placeholder={`Message #general`}
              className="w-full h-11 px-4 bg-transparent text-[#dcddde] placeholder-[#72767d] text-sm focus:outline-none"
            />
          </div>

          <div className="flex items-center pr-3">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 hover:bg-[#3f4248] text-[#b5bac1] hover:text-white"
            >
              <Smile className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </form>
    </main>
  );
};

export default Chat;
