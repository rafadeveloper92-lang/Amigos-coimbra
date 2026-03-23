import React, { useState, useEffect } from 'react';
import { MessageSquare, Search, User as UserIcon, ChevronRight } from 'lucide-react';
import { dataService } from '../services/dataService';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabaseClient';
import { getConversationPreviewText } from '../utils/storyReplyMessage';

interface MessagesListViewProps {
  onSelectConversation: (userId: string) => void;
}

export default function MessagesListView({ onSelectConversation }: MessagesListViewProps) {
  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const ONLINE_THRESHOLD_MINUTES = 3;

  const isRecentlyOnline = (updatedAt?: string) => {
    if (!updatedAt) return false;
    const lastSeen = new Date(updatedAt);
    if (Number.isNaN(lastSeen.getTime())) return false;
    const now = new Date();
    const diffInMinutes = (now.getTime() - lastSeen.getTime()) / (1000 * 60);
    return diffInMinutes >= 0 && diffInMinutes <= ONLINE_THRESHOLD_MINUTES;
  };

  const fetchConversations = async () => {
    if (!user) return;
    try {
      // Fetch all messages where user is sender or receiver
      const { data, error } = await supabase
        .from('direct_messages')
        .select('*')
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Group by the other user
      const conversationMap = new Map();
      
      for (const msg of (data || [])) {
        const otherId = msg.sender_id === user.id ? msg.receiver_id : msg.sender_id;
        if (!conversationMap.has(otherId)) {
          conversationMap.set(otherId, {
            otherId,
            lastMessage: msg.content,
            timestamp: msg.created_at,
            isMe: msg.sender_id === user.id
          });
        }
      }

      const convList = Array.from(conversationMap.values());
      
      // Fetch profiles for all other users
      const enrichedConvs = await Promise.all(convList.map(async (conv) => {
        const profile = await dataService.getUserProfile(conv.otherId);
        return { ...conv, profile };
      }));

      setConversations(enrichedConvs);
    } catch (error) {
      console.error('Error fetching conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConversations();
    
    // Subscribe to new messages to update the list
    if (user) {
      const subscription = supabase
        .channel('conversations_list')
        .on('postgres_changes', { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'direct_messages' 
        }, (payload) => {
          if (payload.new.sender_id === user.id || payload.new.receiver_id === user.id) {
            fetchConversations();
          }
        })
        .subscribe();
        
      return () => {
        subscription.unsubscribe();
      };
    }
  }, [user?.id]);

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
        <h2 className="text-lg font-bold text-nexus-blue flex items-center gap-2">
          <MessageSquare className="w-5 h-5" />
          Mensagens Diretas
        </h2>
      </div>

      <div className="p-4 bg-white">
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
          <input 
            type="text" 
            placeholder="Pesquisar conversas..." 
            className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-nexus-blue transition-all"
          />
        </div>

        <div className="space-y-1">
          {loading ? (
            <div className="flex justify-center py-10">
              <div className="w-6 h-6 border-2 border-nexus-blue/30 border-t-nexus-blue rounded-full animate-spin"></div>
            </div>
          ) : conversations.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p className="text-sm">Nenhuma conversa iniciada ainda.</p>
              <p className="text-[10px] mt-1">Visite o perfil de um amigo para enviar uma mensagem.</p>
            </div>
          ) : (
            conversations.map((conv) => {
              const isOnline = isRecentlyOnline(conv.profile?.updated_at);
              return (
                <button
                  key={conv.otherId}
                  onClick={() => onSelectConversation(conv.otherId)}
                  className="w-full flex items-center gap-4 p-3 rounded-xl hover:bg-slate-50 transition-colors group text-left"
                >
                  <div className="relative">
                    <img 
                      src={conv.profile?.avatar_url || `https://picsum.photos/seed/${conv.otherId}/100/100`} 
                      alt={conv.profile?.first_name} 
                      className="w-12 h-12 rounded-full object-cover border border-slate-100"
                    />
                    {isOnline && (
                      <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full"></div>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-0.5">
                      <h3 className="font-bold text-slate-900 truncate">
                        {conv.profile ? `${conv.profile.first_name} ${conv.profile.last_name}` : 'Usuário'}
                      </h3>
                      <span className="text-[10px] text-slate-400">
                        {new Date(conv.timestamp).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 truncate">
                      {conv.isMe ? 'Você: ' : ''}{getConversationPreviewText(conv.lastMessage || '')}
                    </p>
                  </div>
                  
                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-nexus-blue transition-colors" />
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
