import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Send, User as UserIcon } from 'lucide-react';
import { dataService } from '../services/dataService';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabaseClient';
import { parseStoryReplyMessage } from '../utils/storyReplyMessage';

interface DirectMessagesViewProps {
  targetUserId: string;
  onBack: () => void;
  onViewProfile?: (userId: string) => void;
}

export default function DirectMessagesView({ targetUserId, onBack, onViewProfile }: DirectMessagesViewProps) {
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [targetProfile, setTargetProfile] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { user, profile } = useAuth();

  useEffect(() => {
    const fetchTargetProfile = async () => {
      const p = await dataService.getUserProfile(targetUserId);
      setTargetProfile(p);
    };
    fetchTargetProfile();
  }, [targetUserId]);

  const fetchMessages = async () => {
    console.log('Fetching messages for:', user?.id, targetUserId);
    if (!user) {
      console.log('User is null, cannot fetch messages');
      return;
    }
    try {
      const data = await dataService.getDirectMessages(user.id, targetUserId);
      console.log('Messages fetched:', data);
      setMessages(data);
    } catch (error: any) {
      console.error('Error fetching direct messages:', error);
      if (error.message?.includes('relation "public.direct_messages" does not exist')) {
        alert('A tabela de mensagens não existe no Supabase. Por favor, crie a tabela "direct_messages".');
      }
    } finally {
      setLoading(false);
      scrollToBottom();
    }
  };

  useEffect(() => {
    fetchMessages();

    if (supabase && user) {
      const subscription = supabase
        .channel(`dm_${user.id}_${targetUserId}`)
        .on('postgres_changes', { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'direct_messages',
        }, (payload) => {
          console.log('New message received via subscription:', payload);
          // Only add if it's sent to us by the target user OR sent by us to the target user
          if (
            (payload.new.sender_id === targetUserId && payload.new.receiver_id === user.id) ||
            (payload.new.sender_id === user.id && payload.new.receiver_id === targetUserId)
          ) {
            // Check if we already have this message (e.g., from optimistic update)
            setMessages(prev => {
              if (prev.some(m => m.id === payload.new.id)) return prev;
              return [...prev, payload.new];
            });
            scrollToBottom();
          }
        })
        .subscribe();

      return () => {
        subscription.unsubscribe();
      };
    }
  }, [user?.id, targetUserId]);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Sending message:', newMessage, 'to:', targetUserId);
    if (!newMessage.trim() || !user) {
      console.log('Cannot send message, newMessage is empty or user is null');
      return;
    }

    const content = newMessage;
    setNewMessage('');

    try {
      const newMsg = await dataService.sendDirectMessage(user.id, targetUserId, content);
      console.log('Message sent result:', newMsg);
      if (newMsg) {
        setMessages(prev => [...prev, newMsg]);
        scrollToBottom();
      } else {
        alert('Erro ao enviar mensagem. Verifique se a tabela "direct_messages" existe no Supabase.');
      }
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      alert('Erro de rede ao enviar mensagem.');
    }
  };

  const displayName = targetProfile ? `${targetProfile.first_name} ${targetProfile.last_name}` : 'Usuário';

  return (
    <div className="max-w-4xl mx-auto bg-white min-h-[calc(100vh-80px)] md:min-h-[calc(100vh-120px)] flex flex-col rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      {/* Header */}
      <div className="p-4 bg-nexus-blue text-white flex items-center gap-4 sticky top-0 z-10 shadow-md">
        <button 
          onClick={onBack}
          className="p-2 hover:bg-white/20 rounded-full transition-colors"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <div className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => onViewProfile && onViewProfile(targetUserId)}>
          <img 
            src={targetProfile?.avatar_url || `https://picsum.photos/seed/${targetUserId}/100/100`} 
            alt={displayName} 
            className="w-10 h-10 rounded-full object-cover border-2 border-white/20"
          />
          <h2 className="text-xl font-bold hover:underline">{displayName}</h2>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 p-4 overflow-y-auto bg-slate-50 space-y-4">
        {loading ? (
          <div className="flex justify-center p-4">
            <div className="w-6 h-6 border-2 border-nexus-blue/30 border-t-nexus-blue rounded-full animate-spin"></div>
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-10 text-slate-500">
            <UserIcon className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p>Envie uma mensagem para iniciar a conversa com {displayName}.</p>
          </div>
        ) : (
          messages.map((msg, idx) => {
            const isMe = msg.sender_id === user?.id;
            const storyReply = parseStoryReplyMessage(msg.content || '');
            return (
              <div key={msg.id || `dm-${idx}`} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                <div className={`max-w-[80%] px-4 py-2.5 rounded-2xl ${
                  isMe 
                    ? 'bg-nexus-blue text-white rounded-tr-sm' 
                    : 'bg-white border border-slate-200 text-slate-800 rounded-tl-sm shadow-sm'
                }`}>
                  {storyReply ? (
                    <div className="space-y-2">
                      <div className={`rounded-xl overflow-hidden border ${isMe ? 'border-white/25' : 'border-slate-200'} bg-black/10`}>
                        <div className="relative w-full h-28 bg-black">
                          {storyReply.mediaType === 'video' ? (
                            <video
                              src={storyReply.mediaUrl}
                              muted
                              playsInline
                              preload="metadata"
                              className="w-full h-full object-cover opacity-85"
                            />
                          ) : (
                            <img
                              src={storyReply.mediaUrl}
                              alt="Prévia do story"
                              className="w-full h-full object-cover"
                            />
                          )}
                          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                            <p className="text-[10px] font-bold text-white tracking-wide">
                              Respondeu ao story {storyReply.ownerUsername ? `de @${storyReply.ownerUsername.replace(/^@/, '')}` : ''}
                            </p>
                          </div>
                        </div>
                      </div>
                      <p className="text-sm whitespace-pre-wrap break-words">{storyReply.text}</p>
                    </div>
                  ) : (
                    <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                  )}
                </div>
                <span className="text-[10px] text-slate-400 mt-1 px-1">
                  {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white border-t border-slate-100">
        <form onSubmit={handleSendMessage} className="flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Digite sua mensagem..."
            className="flex-1 bg-slate-50 border border-slate-200 rounded-full px-6 py-3 text-sm focus:outline-none focus:border-nexus-blue focus:ring-1 focus:ring-nexus-blue transition-all"
          />
          <button 
            type="submit"
            disabled={!newMessage.trim()}
            className="bg-nexus-blue text-white p-3 rounded-full hover:bg-nexus-blue/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
      </div>
    </div>
  );
}
