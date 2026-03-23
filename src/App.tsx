import Navbar from './components/Navbar';
import SidebarLeft from './components/SidebarLeft';
import SidebarRight from './components/SidebarRight';
import Feed from './components/Feed';
import BottomNav from './components/BottomNav';
import Auth from './components/Auth';
import ProfileSetup from './components/ProfileSetup';
import UserProfile from './components/UserProfile';
import UserProfileView from './components/UserProfileView';
import GroupsView from './components/GroupsView';
import FriendsView from './components/FriendsView';
import DirectMessagesView from './components/DirectMessagesView';
import MessagesListView from './components/MessagesListView';
import PostDetailView from './components/PostDetailView';
import AdManager from './components/AdManager';
import { useAuth } from './contexts/AuthContext';
import { dataService } from './services/dataService';
import { motion } from 'motion/react';
import { useState, useEffect } from 'react';

export type ViewType = 'feed' | 'profile' | 'groups' | 'friends' | 'messages' | 'post_detail' | 'admin';

export default function App() {
  const { user, profile, loading, profileError } = useAuth();
  const [currentView, setCurrentView] = useState<ViewType>('feed');
  const [profileSubView, setProfileSubView] = useState<'view' | 'edit'>('view');
  const [viewingUserId, setViewingUserId] = useState<string | null>(null);
  const [messagingUserId, setMessagingUserId] = useState<string | null>(null);
  const [viewingPostId, setViewingPostId] = useState<number | null>(null);

  const handleNavigate = (view: ViewType | string | { view: ViewType; userId?: string; postId?: number }) => {
    if (typeof view === 'object') {
      if (view.view === 'profile' && view.userId) {
        handleViewProfile(view.userId);
      } else if (view.view === 'messages' && view.userId) {
        handleSendMessage(view.userId);
      } else if (view.view === 'post_detail' && view.postId) {
        setViewingPostId(view.postId);
        setCurrentView('post_detail');
      } else {
        setCurrentView(view.view);
      }
    } else if (typeof view === 'string' && view.startsWith('post_')) {
      const postId = parseInt(view.replace('post_', ''), 10);
      if (!isNaN(postId)) {
        setViewingPostId(postId);
        setCurrentView('post_detail');
      }
    } else {
      if (view === 'profile') {
        setViewingUserId(null); // Reset to own profile when clicking profile tab
      }
      setCurrentView(view as ViewType);
    }
  };

  const handleViewProfile = (userId: string) => {
    setViewingUserId(userId);
    setCurrentView('profile');
  };

  const handleSendMessage = (userId: string) => {
    setMessagingUserId(userId);
    setCurrentView('messages');
  };

  useEffect(() => {
    if (user) {
      // Initial update
      dataService.updateLastSeen(user.id);
      
      // Update every 2 minutes
      const interval = setInterval(() => {
        dataService.updateLastSeen(user.id);
      }, 120000);
      
      return () => clearInterval(interval);
    }
  }, [user]);

  useEffect(() => {
    const testSupabase = async () => {
      const result = await dataService.checkConnection();
      console.log('Supabase Connection Test:', result);
      if (!result.connected) {
        console.error('Supabase is not connected:', result.message);
      }
    };
    testSupabase();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-nexus-bg flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-blue-600/30 border-t-blue-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return <Auth />;
  }

  // Se houver erro crítico no perfil (ex: tabela não existe)
  if (profileError && profileError.includes('relation "public.profiles" does not exist')) {
    return (
      <div className="min-h-screen bg-nexus-bg flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-red-500/10 border border-red-500/50 p-8 rounded-2xl max-w-md">
          <h2 className="text-xl font-bold text-red-500 mb-4">Erro de Configuração</h2>
          <p className="text-slate-500 text-sm mb-6">
            A tabela "profiles" não foi encontrada no seu banco de dados Supabase.
            Por favor, execute o script SQL de configuração no seu painel do Supabase.
          </p>
          <button 
            onClick={() => window.location.reload()}
            className="bg-red-500 hover:bg-red-600 text-white px-6 py-2 rounded-xl font-bold transition-colors"
          >
            Tentar Novamente
          </button>
        </div>
      </div>
    );
  }

  // Se o usuário está logado mas não tem perfil completo, redireciona para o setup
  if (!profile) {
    return <ProfileSetup />;
  }

  const renderView = () => {
    switch (currentView) {
      case 'feed':
        return <Feed onNavigate={handleNavigate} onViewProfile={handleViewProfile} onSendMessage={handleSendMessage} />;
      case 'profile':
        if (profileSubView === 'edit' && !viewingUserId) {
          return <UserProfile onBack={() => setProfileSubView('view')} />;
        }
        return <UserProfileView onEdit={() => setProfileSubView('edit')} userId={viewingUserId || undefined} onSendMessage={handleSendMessage} />;
      case 'groups':
        return <GroupsView onViewProfile={handleViewProfile} onSendMessage={handleSendMessage} />;
      case 'friends':
        return <FriendsView onViewProfile={handleViewProfile} onSendMessage={handleSendMessage} />;
      case 'messages':
        if (messagingUserId) {
          return (
            <DirectMessagesView
              targetUserId={messagingUserId}
              onBack={() => setMessagingUserId(null)}
              onViewProfile={handleViewProfile}
              onOpenPost={(postId) => {
                setViewingPostId(postId);
                setCurrentView('post_detail');
              }}
            />
          );
        }
        return <MessagesListView onSelectConversation={handleSendMessage} />;
      case 'post_detail':
        if (viewingPostId) {
          return <PostDetailView postId={viewingPostId} onBack={() => setCurrentView('feed')} onViewProfile={handleViewProfile} onSendMessage={handleSendMessage} />;
        }
        return <Feed onNavigate={handleNavigate} onViewProfile={handleViewProfile} onSendMessage={handleSendMessage} />;
      case 'admin':
        return <AdManager />;
      default:
        return (
          <div className="flex flex-col items-center justify-center py-20 text-slate-500">
            <p className="text-lg font-bold">Em breve...</p>
            <button 
              onClick={() => setCurrentView('feed')}
              className="mt-4 text-nexus-blue font-bold hover:underline"
            >
              Voltar para o Feed
            </button>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-nexus-bg">
      {/* Top Navigation */}
      <Navbar onNavigate={handleNavigate} />

      {/* Main Content Area */}
      <div className="flex-1 w-full max-w-7xl mx-auto flex items-start justify-center lg:gap-4 pb-20 lg:pb-0">
        {/* Left Sidebar - Groups (Desktop Only) */}
        {(currentView === 'feed' || currentView === 'groups' || currentView === 'friends') && (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="hidden lg:block"
          >
            <SidebarLeft onNavigate={handleNavigate} />
          </motion.div>
        )}

        {/* Central Content */}
        <motion.div
          className="flex-1 w-full max-w-2xl"
          key={currentView}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* Tabs - Only show on Feed, Groups, Friends */}
          {(currentView === 'feed' || currentView === 'groups' || currentView === 'friends') && (
            <div className="bg-white rounded-xl shadow-sm mb-4 sticky top-[68px] z-40 mx-4 lg:mx-0">
              <div className="flex items-center">
                {[
                  { id: 'feed', label: 'FEED' },
                  { id: 'groups', label: 'GROUPS' },
                  { id: 'friends', label: 'FRIENDS' }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => handleNavigate(tab.id as ViewType)}
                    className={`flex-1 py-3 text-xs font-bold tracking-wider transition-all relative ${
                      currentView === tab.id ? 'text-nexus-blue' : 'text-slate-500'
                    }`}
                  >
                    {tab.label}
                    {currentView === tab.id && (
                      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-1 bg-nexus-blue rounded-t-full"></div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
          {renderView()}
        </motion.div>

        {/* Right Sidebar - Friends (Desktop Only) */}
        {(currentView === 'feed' || currentView === 'friends' || currentView === 'groups') && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="hidden lg:block"
          >
            <SidebarRight onViewProfile={handleViewProfile} onSendMessage={handleSendMessage} />
          </motion.div>
        )}
      </div>

      {/* Mobile Bottom Navigation */}
      <BottomNav currentView={currentView} onNavigate={handleNavigate} />
    </div>
  );
}
