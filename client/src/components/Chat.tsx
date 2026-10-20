import React, { useEffect, useRef, useState } from 'react';
import { Send, MessageSquare } from 'lucide-react';
import { ChatMessageDTO } from '@syncnshare/shared';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';

interface ChatProps {
  roomId: string;
}

export const Chat: React.FC<ChatProps> = ({ roomId }) => {
  const { socket } = useSocket();
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessageDTO[]>([]);
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Initial messages load
  useEffect(() => {
    let isMounted = true;
    api.chat.getMessages(roomId).then((res) => {
      if (isMounted) {
        setMessages(res.messages);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [roomId]);

  // Real-time socket message listener
  useEffect(() => {
    if (!socket) return;

    const handleMessage = (msg: ChatMessageDTO) => {
      if (msg.roomId === roomId) {
        setMessages((prev) => [...prev, msg]);
      }
    };

    socket.on('chat:message', handleMessage);

    return () => {
      socket.off('chat:message', handleMessage);
    };
  }, [socket, roomId]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = content.trim();
    if (!text || sending) return;

    setSending(true);

    if (socket && socket.connected) {
      socket.emit('chat:send', { roomId, content: text }, (res) => {
        setSending(false);
        if (res?.ok) {
          setContent('');
        }
      });
    } else {
      api.chat.send(roomId, text).then(() => {
        setSending(false);
        setContent('');
      }).catch(() => setSending(false));
    }
  };

  const formatTime = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  return (
    <div className="glass-card rounded-2xl p-5 flex flex-col h-full shadow-lg">
      {/* Header */}
      <div className="flex items-center space-x-2 pb-4 border-b border-surface-border mb-4">
        <MessageSquare className="w-5 h-5 text-accent-cyan" />
        <h3 className="font-bold text-white text-base">Lounge Chat</h3>
      </div>

      {/* Message List */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1 max-h-[360px] min-h-[240px]">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-center p-6 text-slate-400 text-xs italic">
            No messages yet. Say hello to everyone!
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.sender?.id === user?.id;

            return (
              <div
                key={msg.id}
                className={`flex items-start space-x-2.5 ${isMe ? 'flex-row-reverse space-x-reverse' : ''}`}
              >
                <img
                  src={msg.sender?.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${msg.sender?.displayName || 'User'}`}
                  alt={msg.sender?.displayName || 'User'}
                  className="w-7 h-7 rounded-full bg-surface-card border border-surface-border flex-shrink-0 mt-0.5"
                />
                <div
                  className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-xs ${
                    isMe
                      ? 'bg-primary text-white rounded-tr-none'
                      : 'bg-surface border border-surface-border text-slate-200 rounded-tl-none'
                  }`}
                >
                  <div className="flex items-center space-x-2 mb-1">
                    <span
                      className={`font-semibold text-[11px] truncate ${
                        isMe ? 'text-purple-200' : 'text-accent-cyan'
                      }`}
                    >
                      {msg.sender?.displayName || 'User'}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {formatTime(msg.createdAt)}
                    </span>
                  </div>
                  <p className="break-words leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="mt-4 pt-3 border-t border-surface-border flex items-center space-x-2">
        <input
          type="text"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Send a message..."
          maxLength={500}
          className="flex-1 px-3.5 py-2 rounded-xl bg-surface border border-surface-border text-white placeholder-slate-500 focus:outline-none focus:border-accent-cyan transition-colors text-xs"
        />
        <button
          type="submit"
          disabled={!content.trim() || sending}
          className="p-2 rounded-xl bg-accent-cyan/20 hover:bg-accent-cyan/30 border border-accent-cyan/40 text-accent-cyan disabled:opacity-30 transition-colors"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
