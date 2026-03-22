import { useState, useEffect } from 'react';
import { Search, MessageSquare, Bell, User, Database, LogOut, Check, X } from 'lucide-react';
import { dataService } from '../services/dataService';
import { supabase } from '../services/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { Notification } from '../types';
import Logo from './Logo';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';

interface NavbarProps {
  onNavigate?: (view: any) => void;
}

export default function Navbar({ onNavigate }: NavbarProps) {
  const [dbStatus, setDbStatus] = useState<{ connected: boolean; message: string }>({ connected: false, message: '...' });
  const { user, profile, signOut } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [newNotificationToast, setNewNotificationToast] = useState<string | null>(null);

  useEffect(() => {
    if (newNotificationToast) {
      const timer = setTimeout(() => setNewNotificationToast(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [newNotificationToast]);

  useEffect(() => {
    const checkStatus = async () => {
      const status = await dataService.checkConnection();
      setDbStatus(status);
    };
    checkStatus();
    // Re-check every 30 seconds
    const interval = setInterval(checkStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!user) return;

    const fetchNotifications = async () => {
      try {
        console.log('DEBUG: Navbar fetching notifications for user:', user.id);
        const data = await dataService.getNotifications(user.id);
        console.log('DEBUG: Navbar notifications result:', data);
        setNotifications(data || []);
      } catch (err) {
        console.error('DEBUG: Error in fetchNotifications:', err);
      }
    };

    fetchNotifications();
    
    // Real-time subscription for notifications
    const channel = supabase
      .channel(`notifications_${user.id}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'notifications',
        filter: `user_id=eq.${user.id}`
      }, (payload) => {
        console.log('DEBUG: New notification received via Realtime:', payload);
        const newNotif = payload.new as Notification;
        setNotifications(prev => [newNotif, ...prev]);
        setNewNotificationToast(newNotif.content);
      })
      .subscribe((status) => {
        console.log('DEBUG: Notification subscription status:', status);
      });
    
    // Polling as fallback
    const interval = setInterval(fetchNotifications, 10000);
    return () => {
      clearInterval(interval);
      channel.unsubscribe();
    };
  }, [user]);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const handleMarkAsRead = async (id: number) => {
    const success = await dataService.markNotificationAsRead(id);
    if (success) {
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    }
  };

  const handleMarkAllAsRead = async () => {
    const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id);
    for (const id of unreadIds) {
      await dataService.markNotificationAsRead(id);
    }
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  const handleNotificationClick = (notification: any) => {
    handleMarkAsRead(notification.id);
    setShowNotifications(false);
    
    if (notification.type === 'friend_request' && notification.from_user_id) {
      onNavigate?.({ view: 'profile', userId: notification.from_user_id });
    } else if (notification.type === 'message' && notification.from_user_id) {
      onNavigate?.({ view: 'messages', userId: notification.from_user_id });
    } else if (notification.link_to) {
      onNavigate?.(notification.link_to);
    }
  };

  const displayName = profile ? `${profile.first_name} ${profile.last_name}` : (user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Usuário');
  const avatarUrl = profile?.avatar_url || `https://picsum.photos/seed/${displayName}/100/100`;

  const isAdmin = profile?.role === 'admin' || user?.email?.toLowerCase().trim() === 'rafaaprodrigu3s@gmail.com';

  const handleProfileClick = () => {
    if (onNavigate) {
      onNavigate('profile');
      setShowUserMenu(false);
    }
  };

  return (
    <>
      {/* Notification Toast */}
      <AnimatePresence>
        {newNotificationToast && (
          <motion.div
            initial={{ opacity: 0, y: 50, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 20, x: '-50%' }}
            className="fixed bottom-24 left-1/2 z-[100] bg-nexus-blue text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 border border-nexus-gold/30"
          >
            <div className="w-8 h-8 bg-nexus-gold rounded-full flex items-center justify-center shrink-0">
              <Bell className="w-4 h-4 text-nexus-blue" />
            </div>
            <p className="text-sm font-bold truncate max-w-[200px]">{newNotificationToast}</p>
            <button 
              onClick={() => setNewNotificationToast(null)}
              className="ml-2 hover:text-nexus-gold"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <nav className="bg-nexus-blue text-white p-3 sticky top-0 z-50 shadow-lg border-b border-nexus-gold/30">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Logo & Status */}
        <div className="flex items-center gap-3 shrink-0">
          <div 
            className="flex items-center gap-2 cursor-pointer"
            onClick={() => onNavigate?.('feed')}
          >
            <Logo className="w-10 h-10" />
            <div className="hidden sm:block">
              <h1 className="font-serif font-bold text-lg leading-tight tracking-tight uppercase">Amigos Coimbra</h1>
              <p className="text-[9px] opacity-70 font-serif italic tracking-widest uppercase">União & Cultura</p>
            </div>
          </div>
          
          {/* Status Indicator */}
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-nexus-gold/10 border border-nexus-gold/20 shadow-inner max-w-[180px]">
            <div className={`w-2 h-2 rounded-full shrink-0 ${
              dbStatus.connected 
                ? (dbStatus.message === 'Conectado' ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]') 
                : 'bg-rose-400 shadow-[0_0_8px_rgba(251,113,133,0.8)] animate-pulse'
            }`} />
            <span className="text-[9px] font-black text-nexus-gold uppercase tracking-tighter truncate">
              {dbStatus.message}
            </span>
          </div>
        </div>

        {/* Navigation Links - Desktop Only */}
        <div className="hidden md:flex items-center gap-1">
          {[
            { id: 'feed', label: 'Feed' },
            { id: 'groups', label: 'Grupos' },
            { id: 'friends', label: 'Amigos' }
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => onNavigate?.(item.id)}
              className="px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-white/10 transition-colors"
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Search Bar */}
        <div className="flex-1 max-w-md relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 w-4 h-4" />
          <input 
            type="text" 
            placeholder="Pesquisar no Portal..." 
            className="w-full bg-white/10 border border-white/20 rounded-lg py-1.5 pl-10 pr-4 text-sm focus:ring-2 focus:ring-nexus-gold/50 focus:bg-white/20 outline-none transition-all placeholder:text-white/30"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-4 shrink-0">
          <button 
            onClick={() => onNavigate?.('messages')}
            className="relative hover:bg-white/10 p-2 rounded-lg transition-colors group"
          >
            <MessageSquare className="w-5 h-5 text-white/70 group-hover:text-white" />
          </button>
          
          <div className="relative">
            <button 
              onClick={() => {
                setShowNotifications(!showNotifications);
                setShowUserMenu(false);
              }}
              className="relative hover:bg-white/10 p-2 rounded-lg transition-colors group"
            >
              <Bell className="w-5 h-5 text-white/70 group-hover:text-white" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 bg-nexus-gold text-[9px] w-4 h-4 rounded-full flex items-center justify-center border-2 border-nexus-blue font-bold text-nexus-blue">
                  {unreadCount}
                </span>
              )}
            </button>

            {showNotifications && (
              <div className="absolute right-0 mt-3 w-80 bg-white rounded-xl shadow-2xl border border-slate-100 py-2 z-50 overflow-hidden">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                  <p className="text-xs font-bold text-nexus-blue uppercase tracking-wider">Notificações</p>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={async () => {
                        if (!user) return;
                        await dataService.createNotification(user.id, 'system', 'Notificação de teste enviada com sucesso!');
                      }}
                      className="text-[10px] text-nexus-gold hover:underline font-bold mr-2"
                    >
                      Testar
                    </button>
                    {unreadCount > 0 && (
                      <button 
                        onClick={handleMarkAllAsRead}
                        className="text-[10px] text-nexus-blue hover:underline font-bold"
                      >
                        Marcar todas como lidas
                      </button>
                    )}
                    <span className="text-[10px] bg-nexus-gold/20 text-nexus-gold px-2 py-0.5 rounded-full font-bold">
                      {unreadCount} novas
                    </span>
                  </div>
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="px-4 py-8 text-center">
                      <Bell className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                      <p className="text-xs text-slate-400">Nenhuma notificação por enquanto</p>
                    </div>
                  ) : (
                    notifications.map((notification) => (
                      <div 
                        key={notification.id}
                        onClick={() => handleNotificationClick(notification)}
                        className={`px-4 py-3 border-b border-slate-50 hover:bg-slate-50 transition-colors relative group cursor-pointer ${!notification.is_read ? 'bg-nexus-gold/5' : ''}`}
                      >
                        <div className="flex gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                            notification.type === 'friend_request' ? 'bg-blue-100 text-blue-600' : 
                            notification.type === 'message' ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-600'
                          }`}>
                            {notification.type === 'friend_request' ? <User className="w-4 h-4" /> : 
                             notification.type === 'message' ? <MessageSquare className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-xs ${!notification.is_read ? 'font-bold text-slate-900' : 'text-slate-600'}`}>
                              {notification.content}
                            </p>
                            <p className="text-[10px] text-slate-400 mt-1">
                              {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true, locale: ptBR })}
                            </p>
                          </div>
                          {!notification.is_read && (
                            <button 
                              onClick={() => handleMarkAsRead(notification.id)}
                              className="opacity-0 group-hover:opacity-100 p-1 hover:bg-nexus-gold/20 rounded transition-all"
                              title="Marcar como lida"
                            >
                              <Check className="w-3 h-3 text-nexus-gold" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 text-center">
                  <button className="text-[10px] font-bold text-nexus-blue uppercase hover:underline">Ver todas</button>
                </div>
              </div>
            )}
          </div>
          
          <div className="relative">
            <button 
              onClick={() => {
                setShowUserMenu(!showUserMenu);
                setShowNotifications(false);
              }}
              className="w-9 h-9 rounded-full overflow-hidden border-2 border-nexus-gold cursor-pointer hover:scale-105 transition-transform shadow-md"
            >
              <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
            </button>

            {showUserMenu && (
              <div className="absolute right-0 mt-3 w-56 bg-white rounded-xl shadow-2xl border border-slate-100 py-2 z-50 overflow-hidden">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
                  <p className="text-xs font-bold text-nexus-blue truncate">{displayName}</p>
                  <p className="text-[10px] text-slate-500 truncate">{user?.email}</p>
                  {profile?.username && (
                    <p className="text-[9px] text-nexus-gold font-bold mt-0.5">@{profile.username}</p>
                  )}
                </div>
                <div className="py-1">
                  <button 
                    onClick={handleProfileClick}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    <User className="w-4 h-4 text-slate-400" />
                    Meu Perfil
                  </button>
                  {isAdmin && (
                    <button 
                      onClick={() => {
                        onNavigate?.('admin');
                        setShowUserMenu(false);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      <Database className="w-4 h-4 text-slate-400" />
                      Administração
                    </button>
                  )}
                </div>
                <div className="border-t border-slate-100 mt-1">
                  <button 
                    onClick={() => signOut()}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors font-bold"
                  >
                    <LogOut className="w-4 h-4" />
                    Encerrar Sessão
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
    </>
  );
}
