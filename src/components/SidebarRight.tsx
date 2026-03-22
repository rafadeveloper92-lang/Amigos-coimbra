import { useState, useEffect } from 'react';
import { dataService } from '../services/dataService';
import { Friend } from '../types';

interface SidebarRightProps {
  onViewProfile?: (userId: string) => void;
  onSendMessage?: (userId: string) => void;
}

export default function SidebarRight({ onViewProfile, onSendMessage }: SidebarRightProps) {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFriends = async () => {
      const data = await dataService.getFriends();
      setFriends(data);
      setLoading(false);
    };
    fetchFriends();
  }, []);

  const onlineFriends = friends.filter(f => f.status === 'Online' || f.status === 'Idle');
  const offlineFriends = friends.filter(f => f.status === 'Offline');

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Online': return 'bg-emerald-500';
      case 'Idle': return 'bg-amber-500';
      default: return 'bg-slate-300';
    }
  };

  return (
    <aside className="hidden lg:block w-72 h-[calc(100vh-64px)] overflow-y-auto p-4 sticky top-16">
      <div className="space-y-6">
        {/* Online Friends */}
        <div className="bg-white border border-slate-100 rounded-xl shadow-sm p-4">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Amigos Online</h2>
          <div className="space-y-4">
            {loading ? (
              <div className="flex justify-center p-4">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-nexus-blue"></div>
              </div>
            ) : onlineFriends.length > 0 ? (
              onlineFriends.map((friend) => (
                <div key={friend.id} className="flex items-center justify-between group cursor-pointer">
                  <div className="flex items-center gap-3" onClick={() => onViewProfile && onViewProfile(friend.id)}>
                    <div className="relative">
                      <img src={friend.avatar_url || `https://picsum.photos/seed/${friend.id}/100/100`} alt={friend.name} className="w-8 h-8 rounded-full object-cover" />
                      <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white ${getStatusColor(friend.status)}`}></div>
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 leading-tight group-hover:underline">{friend.name}</h3>
                      <p className="text-[10px] text-slate-400">{friend.status}</p>
                    </div>
                  </div>
                  {onSendMessage && (
                    <button 
                      onClick={(e) => { e.stopPropagation(); onSendMessage(friend.id); }}
                      className="p-1.5 text-slate-400 hover:text-nexus-blue hover:bg-slate-50 rounded-full transition-colors opacity-0 group-hover:opacity-100"
                      title="Enviar Mensagem"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
                    </button>
                  )}
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-300 text-center">Ninguém online no momento.</p>
            )}
          </div>
        </div>

        {/* All Friends */}
        <div className="bg-white border border-slate-100 rounded-xl shadow-sm p-4">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Amigos</h2>
          <div className="space-y-4">
            {loading ? (
              <div className="flex justify-center p-4">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-nexus-blue"></div>
              </div>
            ) : offlineFriends.length > 0 ? (
              offlineFriends.map((friend) => (
                <div key={friend.id} className="flex items-center justify-between group cursor-pointer opacity-70 hover:opacity-100 transition-opacity">
                  <div className="flex items-center gap-3" onClick={() => onViewProfile && onViewProfile(friend.id)}>
                    <div className="relative">
                      <img src={friend.avatar_url || `https://picsum.photos/seed/${friend.id + 10}/100/100`} alt={friend.name} className="w-8 h-8 rounded-full object-cover grayscale" />
                      <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white ${getStatusColor(friend.status)}`}></div>
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 leading-tight group-hover:underline">{friend.name}</h3>
                      <p className="text-[10px] text-slate-400">{friend.status}</p>
                    </div>
                  </div>
                  {onSendMessage && (
                    <button 
                      onClick={(e) => { e.stopPropagation(); onSendMessage(friend.id); }}
                      className="p-1.5 text-slate-400 hover:text-nexus-blue hover:bg-slate-50 rounded-full transition-colors opacity-0 group-hover:opacity-100"
                      title="Enviar Mensagem"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
                    </button>
                  )}
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-300 text-center">Lista de amigos vazia.</p>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}
