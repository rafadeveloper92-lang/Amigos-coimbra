import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Play, Send, User as UserIcon } from 'lucide-react';
import { dataService } from '../services/dataService';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabaseClient';
import { parsePostShareMessage, parseStoryReplyMessage } from '../utils/storyReplyMessage';

interface DirectMessagesViewProps {
  targetUserId: string;
  onBack: () => void;
  onViewProfile?: (userId: string) => void;
  onOpenPost?: (postId: number) => void;
}

export default function DirectMessagesView({ targetUserId, onBack, onViewProfile, onOpenPost }: DirectMessagesViewProps) {
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [targetProfile, setTargetProfile] = useState<any>(null);
  const [, setPresenceTick] = useState(0);
  const [isRemoteTyping, setIsRemoteTyping] = useState(false);
  const [isMeTyping, setIsMeTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingStopTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const remoteTypingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const { user } = useAuth();
  const ONLINE_THRESHOLD_MINUTES = 3;

  const getPresenceMeta = (updatedAt?: string) => {
    if (!updatedAt) {
      return { isOnline: false, label: 'Visto há algum tempo' };
    }

    const lastSeen = new Date(updatedAt);
    if (Number.isNaN(lastSeen.getTime())) {
      return { isOnline: false, label: 'Visto há algum tempo' };
    }

    const now = new Date();
    const diffMs = now.getTime() - lastSeen.getTime();
    if (diffMs < 0) {
      return { isOnline: false, label: 'Visto há alguns instantes' };
    }

    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    if (diffMinutes <= ONLINE_THRESHOLD_MINUTES) {
      return { isOnline: true, label: 'Online agora' };
    }
    if (diffMinutes < 60) {
      return { isOnline: false, label: `Visto há ${diffMinutes} min` };
    }

    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) {
      return { isOnline: false, label: `Visto há ${diffHours} h` };
    }

    return {
      isOnline: false,
      label: `Visto em ${lastSeen.toLocaleDateString('pt-BR')}`,
    };
  };

  const sendTypingEvent = (isTyping: boolean) => {
    if (!typingChannelRef.current || !user?.id) return;
    void typingChannelRef.current.send({
      type: 'broadcast',
      event: 'typing',
      payload: {
        senderId: user.id,
        receiverId: targetUserId,
        isTyping,
        at: Date.now(),
      },
    });
  };

  useEffect(() => {
    const fetchTargetProfile = async () => {
      const p = await dataService.getUserProfile(targetUserId);
      setTargetProfile(p);
    };

    fetchTargetProfile();

    const profilePresenceChannel = supabase
      .channel(`profile_presence_${targetUserId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${targetUserId}`,
        },
        (payload) => {
          setTargetProfile(payload.new);
        }
      )
      .subscribe();

    const profileRefreshInterval = setInterval(fetchTargetProfile, 45000);
    const presenceRecalcInterval = setInterval(() => {
      setPresenceTick((prev) => prev + 1);
    }, 30000);

    return () => {
      profilePresenceChannel.unsubscribe();
      clearInterval(profileRefreshInterval);
      clearInterval(presenceRecalcInterval);
    };
  }, [targetUserId]);

  useEffect(() => {
    if (!user?.id) return;

    const roomKey = [user.id, targetUserId].sort().join('_');
    const channel = supabase
      .channel(`dm_typing_${roomKey}`, {
        config: {
          broadcast: { self: false },
        },
      })
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        const senderId = payload?.senderId as string | undefined;
        const receiverId = payload?.receiverId as string | undefined;
        const isTyping = Boolean(payload?.isTyping);

        if (senderId !== targetUserId) return;
        if (receiverId && receiverId !== user.id) return;

        setIsRemoteTyping(isTyping);

        if (remoteTypingTimeoutRef.current) {
          clearTimeout(remoteTypingTimeoutRef.current);
          remoteTypingTimeoutRef.current = null;
        }

        // Fallback para apagar "digitando..." caso o evento de stop não chegue.
        if (isTyping) {
          remoteTypingTimeoutRef.current = setTimeout(() => {
            setIsRemoteTyping(false);
            remoteTypingTimeoutRef.current = null;
          }, 2200);
        }
      })
      .subscribe();

    typingChannelRef.current = channel;

    return () => {
      if (typingStopTimeoutRef.current) {
        clearTimeout(typingStopTimeoutRef.current);
        typingStopTimeoutRef.current = null;
      }
      if (remoteTypingTimeoutRef.current) {
        clearTimeout(remoteTypingTimeoutRef.current);
        remoteTypingTimeoutRef.current = null;
      }

      void channel.send({
        type: 'broadcast',
        event: 'typing',
        payload: {
          senderId: user.id,
          receiverId: targetUserId,
          isTyping: false,
          at: Date.now(),
        },
      });

      supabase.removeChannel(channel);
      if (typingChannelRef.current === channel) {
        typingChannelRef.current = null;
      }
      setIsRemoteTyping(false);
      setIsMeTyping(false);
    };
  }, [user?.id, targetUserId]);

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

    if (typingStopTimeoutRef.current) {
      clearTimeout(typingStopTimeoutRef.current);
      typingStopTimeoutRef.current = null;
    }
    if (isMeTyping) {
      setIsMeTyping(false);
      sendTypingEvent(false);
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

  const handleMessageInputChange = (value: string) => {
    setNewMessage(value);

    const hasText = value.trim().length > 0;
    if (!hasText) {
      if (typingStopTimeoutRef.current) {
        clearTimeout(typingStopTimeoutRef.current);
        typingStopTimeoutRef.current = null;
      }
      if (isMeTyping) {
        setIsMeTyping(false);
        sendTypingEvent(false);
      }
      return;
    }

    if (!isMeTyping) {
      setIsMeTyping(true);
      sendTypingEvent(true);
    }

    if (typingStopTimeoutRef.current) {
      clearTimeout(typingStopTimeoutRef.current);
    }
    typingStopTimeoutRef.current = setTimeout(() => {
      setIsMeTyping(false);
      sendTypingEvent(false);
      typingStopTimeoutRef.current = null;
    }, 1300);
  };

  const displayName = targetProfile ? `${targetProfile.first_name} ${targetProfile.last_name}` : 'Usuário';
  const presenceMeta = getPresenceMeta(targetProfile?.updated_at);
  const headerPresenceLabel = presenceMeta.label;

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
          <div className="relative">
            <img 
              src={targetProfile?.avatar_url || `https://picsum.photos/seed/${targetUserId}/100/100`} 
              alt={displayName} 
              className="w-10 h-10 rounded-full object-cover border-2 border-white/20"
            />
            {(presenceMeta.isOnline || isRemoteTyping) && (
              <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-400 border-2 border-nexus-blue rounded-full" />
            )}
          </div>
          <div className="flex flex-col min-w-0">
            <h2 className="text-xl font-bold hover:underline truncate">{displayName}</h2>
            <p className={`text-xs font-medium ${isRemoteTyping ? 'text-emerald-100' : presenceMeta.isOnline ? 'text-emerald-200' : 'text-slate-200'}`}>
              {isRemoteTyping ? (
                <span className="inline-flex items-center gap-1.5">
                  <span>digitando</span>
                  <span className="inline-flex items-center gap-1" aria-hidden="true">
                    <span className="typing-dot typing-dot-1" />
                    <span className="typing-dot typing-dot-2" />
                    <span className="typing-dot typing-dot-3" />
                  </span>
                </span>
              ) : (
                headerPresenceLabel
              )}
            </p>
          </div>
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
            const postShare = parsePostShareMessage(msg.content || '');
            const storyReply = parseStoryReplyMessage(msg.content || '');
            const canOpenPost = !!onOpenPost && Number.isFinite(postShare?.postId);
            return (
              <div key={msg.id || `dm-${idx}`} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                <div className={`max-w-[84%] px-4 py-2.5 rounded-2xl ${
                  isMe 
                    ? 'bg-nexus-blue text-white rounded-tr-sm' 
                    : 'bg-white border border-slate-200 text-slate-800 rounded-tl-sm shadow-sm'
                }`}>
                  {postShare ? (
                    <div className="space-y-2">
                      <div
                        className={`group rounded-2xl overflow-hidden border ${isMe ? 'border-white/25' : 'border-slate-200'} bg-black/10 transition-transform ${canOpenPost ? 'cursor-pointer active:scale-[0.99]' : ''}`}
                        onClick={() => {
                          if (onOpenPost && Number.isFinite(postShare.postId)) {
                            onOpenPost(postShare.postId);
                          }
                        }}
                      >
                        {postShare.mediaUrl ? (
                          <div className="relative w-full h-44 bg-black">
                            {postShare.mediaType === 'video' ? (
                              <video
                                src={postShare.mediaUrl}
                                muted
                                playsInline
                                preload="metadata"
                                className="w-full h-full object-cover opacity-95"
                              />
                            ) : (
                              <img
                                src={postShare.mediaUrl}
                                alt="Prévia da publicação"
                                className="w-full h-full object-cover"
                              />
                            )}
                            <div className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/55 border border-white/20 px-2 py-1 text-[10px] font-extrabold text-white tracking-wide">
                              {postShare.mediaType === 'video' ? (
                                <>
                                  <Play className="w-3 h-3 fill-white" />
                                  VÍDEO
                                </>
                              ) : (
                                'FOTO'
                              )}
                            </div>

                            {postShare.mediaType === 'video' && (
                              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <div className="w-12 h-12 rounded-full bg-black/45 border border-white/35 flex items-center justify-center group-hover:scale-105 transition-transform">
                                  <Play className="w-6 h-6 text-white fill-white ml-0.5" />
                                </div>
                              </div>
                            )}

                            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent p-2.5">
                              <p className="text-[10px] font-bold text-white/95 tracking-wide">
                                Publicação compartilhada
                              </p>
                              <p className="text-[11px] text-white font-semibold truncate">
                                {postShare.ownerUsername ? `@${postShare.ownerUsername.replace(/^@/, '')}` : 'Comunidade'}
                              </p>
                              {canOpenPost && (
                                <p className="text-[10px] text-white/80 mt-0.5">Toque para abrir</p>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className={`p-3 rounded-xl ${isMe ? 'bg-white/10' : 'bg-slate-50'}`}>
                            <p className={`text-xs font-semibold ${isMe ? 'text-white' : 'text-slate-700'}`}>
                              Publicação compartilhada
                              {postShare.ownerUsername ? ` de @${postShare.ownerUsername.replace(/^@/, '')}` : ''}
                            </p>
                          </div>
                        )}
                      </div>
                      <div className={`rounded-xl px-3 py-2 ${isMe ? 'bg-white/10' : 'bg-slate-50 border border-slate-200'}`}>
                        <p className="text-sm whitespace-pre-wrap break-words">{postShare.text}</p>
                      </div>
                      {onOpenPost && Number.isFinite(postShare.postId) && (
                        <button
                          onClick={() => onOpenPost(postShare.postId)}
                          className={`text-[11px] font-bold underline underline-offset-2 transition-colors ${
                            isMe ? 'text-white/90 hover:text-white' : 'text-nexus-blue hover:text-nexus-blue/80'
                          }`}
                        >
                          Ver publicação
                        </button>
                      )}
                    </div>
                  ) : storyReply ? (
                    <div className="space-y-2">
                      <div className={`rounded-2xl overflow-hidden border ${isMe ? 'border-white/25' : 'border-slate-200'} bg-black/10`}>
                        <div className="relative w-full h-32 bg-black">
                          {storyReply.mediaType === 'video' ? (
                            <video
                              src={storyReply.mediaUrl}
                              muted
                              playsInline
                              preload="metadata"
                              className="w-full h-full object-cover opacity-90"
                            />
                          ) : (
                            <img
                              src={storyReply.mediaUrl}
                              alt="Prévia do story"
                              className="w-full h-full object-cover"
                            />
                          )}
                          <div className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/55 border border-white/20 px-2 py-1 text-[10px] font-extrabold text-white tracking-wide">
                            STORY
                          </div>
                          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2.5">
                            <p className="text-[10px] font-bold text-white tracking-wide">
                              Respondeu ao story {storyReply.ownerUsername ? `de @${storyReply.ownerUsername.replace(/^@/, '')}` : ''}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className={`rounded-xl px-3 py-2 ${isMe ? 'bg-white/10' : 'bg-slate-50 border border-slate-200'}`}>
                        <p className="text-sm whitespace-pre-wrap break-words">{storyReply.text}</p>
                      </div>
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
            onChange={(e) => handleMessageInputChange(e.target.value)}
            onBlur={() => {
              if (!isMeTyping) return;
              if (typingStopTimeoutRef.current) {
                clearTimeout(typingStopTimeoutRef.current);
                typingStopTimeoutRef.current = null;
              }
              setIsMeTyping(false);
              sendTypingEvent(false);
            }}
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
