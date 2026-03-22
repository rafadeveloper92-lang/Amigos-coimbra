import { useState, useEffect, useRef } from 'react';
import { UserPlus, Search, UserCheck, Clock, MoreVertical, MessageSquare, UserMinus } from 'lucide-react';
import { dataService } from '../services/dataService';
import { Friend } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../contexts/AuthContext';

interface FriendsViewProps {
  onViewProfile?: (userId: string) => void;
  onSendMessage?: (userId: string) => void;
}

export default function FriendsView({ onViewProfile, onSendMessage }: FriendsViewProps) {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [pendingRequests, setPendingRequests] = useState<{ incoming: any[], outgoing: any[] }>({ incoming: [], outgoing: [] });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'ALL' | 'ONLINE' | 'PENDING'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const { user: currentUser } = useAuth();
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [modalState, setModalState] = useState<{ isOpen: boolean, title: string, message: string, type: 'alert' | 'confirm', onConfirm?: () => void }>({
    isOpen: false, title: '', message: '', type: 'alert'
  });
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setActiveDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchFriends = async () => {
    setLoading(true);
    const data = await dataService.getFriends();
    const pending = await dataService.getPendingFriendRequests();
    setFriends(data);
    setPendingRequests(pending);
    setLoading(false);
  };

  useEffect(() => {
    fetchFriends();
  }, []);

  const handleAccept = async (friendshipId: number) => {
    const success = await dataService.acceptFriendRequest(friendshipId);
    if (success) fetchFriends();
  };

  const handleDecline = async (friendshipId: number) => {
    const success = await dataService.declineFriendRequest(friendshipId);
    if (success) fetchFriends();
  };

  const handleRemoveFriend = (friendId: string) => {
    if (!currentUser?.id) return;
    setModalState({
      isOpen: true,
      title: 'Remover Amigo',
      message: 'Tem certeza que deseja remover este amigo?',
      type: 'confirm',
      onConfirm: async () => {
        const success = await dataService.removeFriend(currentUser.id, friendId);
        if (success) {
          setActiveDropdown(null);
          setModalState({ isOpen: true, title: 'Sucesso', message: 'Amigo removido.', type: 'alert' });
          fetchFriends(); // Refresh the list
        } else {
          setModalState({ isOpen: false, title: '', message: '', type: 'alert' });
        }
      }
    });
  };

  const handleBlockUser = (friendId: string) => {
    if (!currentUser?.id) return;
    setModalState({
      isOpen: true,
      title: 'Bloquear Usuário',
      message: 'Tem certeza que deseja bloquear este usuário?',
      type: 'confirm',
      onConfirm: async () => {
        const success = await dataService.blockUser(currentUser.id, friendId);
        if (success) {
          setActiveDropdown(null);
          setModalState({ isOpen: true, title: 'Sucesso', message: 'Usuário bloqueado.', type: 'alert' });
          fetchFriends(); // Refresh the list
        } else {
          setModalState({ isOpen: false, title: '', message: '', type: 'alert' });
        }
      }
    });
  };

  const filteredFriends = friends.filter(friend => {
    const matchesSearch = friend.name.toLowerCase().includes(searchQuery.toLowerCase());
    if (activeTab === 'ONLINE') return matchesSearch && (friend.status === 'Online' || friend.status === 'Idle');
    return matchesSearch;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Online': return 'bg-emerald-500';
      case 'Idle': return 'bg-amber-500';
      default: return 'bg-slate-400';
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4 lg:p-6 min-h-screen">
      {/* Custom Modal */}
      {modalState.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden"
          >
            <div className="p-6">
              <h3 className="text-xl font-bold text-slate-800 mb-2">{modalState.title}</h3>
              <p className="text-slate-600">{modalState.message}</p>
            </div>
            <div className="bg-slate-50 px-6 py-4 flex justify-end gap-3">
              {modalState.type === 'confirm' && (
                <button 
                  onClick={() => setModalState({ ...modalState, isOpen: false })}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg font-medium transition-colors"
                >
                  Cancelar
                </button>
              )}
              <button 
                onClick={() => {
                  if (modalState.type === 'confirm' && modalState.onConfirm) {
                    modalState.onConfirm();
                  } else {
                    setModalState({ ...modalState, isOpen: false });
                  }
                }}
                className="px-4 py-2 bg-nexus-blue hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
              >
                {modalState.type === 'confirm' ? 'Confirmar' : 'OK'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8"
      >
        <div>
          <h1 className="text-3xl font-black tracking-tighter uppercase text-nexus-blue flex items-center gap-3">
            <UserPlus className="w-8 h-8 text-nexus-gold" />
            Amigos
          </h1>
          <p className="text-slate-500 text-sm font-medium mt-1">Gerencie suas conexões no Portal Amigos Coimbra</p>
        </div>
        
        <button className="bg-nexus-blue hover:bg-nexus-blue/90 text-white px-6 py-2.5 rounded-lg font-bold transition-all shadow-lg flex items-center justify-center gap-2 uppercase text-xs tracking-widest active:scale-95">
          <UserPlus className="w-4 h-4" />
          Adicionar Amigo
        </button>
      </motion.div>

      {/* Tabs & Search */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="flex bg-white p-1 rounded-lg border border-slate-100 shadow-sm">
          {(['ALL', 'ONLINE', 'PENDING'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-md text-[10px] font-black tracking-widest transition-all uppercase ${
                activeTab === tab 
                  ? 'bg-nexus-blue text-white shadow-md' 
                  : 'text-slate-400 hover:text-nexus-blue'
              }`}
            >
              {tab === 'ALL' ? 'Todos' : tab === 'ONLINE' ? 'Online' : 'Pendentes'}
            </button>
          ))}
        </div>

        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
          <input 
            type="text" 
            placeholder="Procurar amigos..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-lg py-2.5 pl-10 pr-4 text-sm focus:ring-2 focus:ring-nexus-blue/20 focus:border-nexus-blue outline-none transition-all placeholder:text-slate-400 text-slate-900"
          />
        </div>
      </div>

      {/* Friends List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <AnimatePresence mode="popLayout">
          {loading ? (
            Array(4).fill(0).map((_, i) => (
              <div key={`friend-skeleton-${i}`} className="bg-white border border-slate-100 rounded-xl p-4 animate-pulse shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-slate-100 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-slate-100 rounded w-1/2" />
                    <div className="h-3 bg-slate-100 rounded w-1/4" />
                  </div>
                </div>
              </div>
            ))
          ) : activeTab === 'PENDING' ? (
            <motion.div 
              key="pending-tab"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="col-span-full grid grid-cols-1 md:grid-cols-2 gap-4"
            >
              {pendingRequests.incoming.length === 0 && pendingRequests.outgoing.length === 0 && (
                <div className="col-span-full py-20 text-center bg-white rounded-2xl border-2 border-dashed border-slate-200">
                  <Clock className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                  <p className="text-slate-500 font-bold uppercase tracking-widest text-sm">Nenhum pedido pendente</p>
                </div>
              )}
              
              {pendingRequests.incoming.map((req) => (
                <motion.div
                  key={`incoming-${req.friendshipId}`}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-white border border-slate-100 rounded-xl p-4 shadow-sm flex items-center justify-between"
                >
                  <div className="flex items-center gap-4">
                    <img 
                      src={req.avatar_url || `https://picsum.photos/seed/${req.id}/100/100`} 
                      className="w-12 h-12 rounded-full object-cover"
                    />
                    <div>
                      <h3 className="font-bold text-nexus-blue">{req.name}</h3>
                      <p className="text-[10px] text-nexus-gold font-black uppercase tracking-widest">Pedido Recebido</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => handleAccept(req.friendshipId)}
                      className="bg-emerald-500 hover:bg-emerald-600 text-white p-2 rounded-lg transition-all"
                      title="Aceitar"
                    >
                      <UserCheck className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleDecline(req.friendshipId)}
                      className="bg-rose-500 hover:bg-rose-600 text-white p-2 rounded-lg transition-all"
                      title="Recusar"
                    >
                      <UserMinus className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              ))}

              {pendingRequests.outgoing.map((req) => (
                <motion.div
                  key={`outgoing-${req.friendshipId}`}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-white border border-slate-100 rounded-xl p-4 shadow-sm flex items-center justify-between opacity-75"
                >
                  <div className="flex items-center gap-4">
                    <img 
                      src={req.avatar_url || `https://picsum.photos/seed/${req.id}/100/100`} 
                      className="w-12 h-12 rounded-full object-cover grayscale"
                    />
                    <div>
                      <h3 className="font-bold text-slate-600">{req.name}</h3>
                      <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Aguardando Resposta</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => handleDecline(req.friendshipId)}
                    className="text-slate-400 hover:text-rose-500 p-2 transition-all"
                    title="Cancelar Pedido"
                  >
                    <UserMinus className="w-4 h-4" />
                  </button>
                </motion.div>
              ))}
            </motion.div>
          ) : filteredFriends.length > 0 ? (
            filteredFriends.map((friend) => (
              <motion.div
                key={friend.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="bg-white border border-slate-100 rounded-xl p-4 hover:border-nexus-gold/30 hover:shadow-md transition-all group relative shadow-sm"
              >
                <div className="flex items-center justify-between relative z-10 w-full">
                  <div className="flex items-center gap-4 flex-1">
                    <div className="relative cursor-pointer flex-shrink-0" onClick={() => onViewProfile && onViewProfile(friend.id)}>
                      <img 
                        src={friend.avatar_url || `https://picsum.photos/seed/${friend.id}/100/100`} 
                        alt={friend.name} 
                        className="w-14 h-14 rounded-full object-cover border-2 border-slate-100 group-hover:border-nexus-gold/50 transition-colors" 
                      />
                      <div className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-white ${getStatusColor(friend.status)}`} />
                    </div>
                    <div className="cursor-pointer flex-1 min-w-0" onClick={() => onViewProfile && onViewProfile(friend.id)}>
                      <h3 className="font-bold text-nexus-blue tracking-tight text-lg leading-tight group-hover:text-nexus-gold transition-colors hover:underline truncate">{friend.name}</h3>
                      <p className="text-xs text-slate-500 font-medium">{friend.status}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button 
                      onClick={() => onSendMessage && onSendMessage(friend.id)}
                      className="p-2 bg-slate-50 hover:bg-nexus-blue rounded-lg transition-all text-slate-400 hover:text-white group/btn"
                      title="Enviar Mensagem"
                    >
                      <MessageSquare className="w-4 h-4" />
                    </button>
                    <div className="relative">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveDropdown(activeDropdown === friend.id ? null : friend.id);
                        }}
                        className="p-2 bg-slate-50 hover:bg-slate-100 rounded-lg transition-all text-slate-400 hover:text-nexus-blue"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                      
                      {activeDropdown === friend.id && (
                        <div 
                          ref={dropdownRef}
                          className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden z-[9999]"
                        >
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveFriend(friend.id);
                            }}
                            className="w-full text-left px-4 py-3 text-sm text-red-600 hover:bg-red-50 font-medium transition-colors"
                          >
                            Remover Amigo
                          </button>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleBlockUser(friend.id);
                            }}
                            className="w-full text-left px-4 py-3 text-sm text-red-600 hover:bg-red-50 font-medium transition-colors border-t border-slate-100"
                          >
                            Bloquear Usuário
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Hover Effect Background */}
                <div className="absolute inset-0 bg-gradient-to-r from-nexus-gold/0 to-nexus-gold/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
              </motion.div>
            ))
          ) : (
            <div className="col-span-full py-20 text-center bg-white rounded-2xl border-2 border-dashed border-slate-200">
              <UserMinus className="w-12 h-12 text-slate-200 mx-auto mb-4" />
              <p className="text-slate-500 font-bold uppercase tracking-widest text-sm">Nenhum amigo encontrado</p>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
