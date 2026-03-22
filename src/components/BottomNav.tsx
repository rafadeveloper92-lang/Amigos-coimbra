import { Home, Users, UserPlus, MessageSquare, User } from 'lucide-react';
import { ViewType } from '../App';

interface BottomNavProps {
  currentView: ViewType;
  onNavigate: (view: ViewType) => void;
}

export default function BottomNav({ currentView, onNavigate }: BottomNavProps) {
  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 px-2 py-1 z-50 shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
      <div className="flex items-center justify-around">
        <button 
          onClick={() => onNavigate('feed')}
          className={`flex flex-col items-center gap-1 p-2 transition-colors ${currentView === 'feed' ? 'text-nexus-blue' : 'text-slate-400'}`}
        >
          <Home className="w-5 h-5" />
          <span className="text-[10px] font-bold uppercase tracking-tighter">Feed</span>
        </button>
        <button 
          onClick={() => onNavigate('groups')}
          className={`flex flex-col items-center gap-1 p-2 transition-colors ${currentView === 'groups' ? 'text-nexus-blue' : 'text-slate-400'}`}
        >
          <Users className="w-5 h-5" />
          <span className="text-[10px] font-bold uppercase tracking-tighter">Grupos</span>
        </button>
        <button 
          onClick={() => onNavigate('friends')}
          className={`flex flex-col items-center gap-1 p-2 transition-colors ${currentView === 'friends' ? 'text-nexus-blue' : 'text-slate-400'}`}
        >
          <UserPlus className="w-5 h-5" />
          <span className="text-[10px] font-bold uppercase tracking-tighter">Amigos</span>
        </button>
        <button 
          onClick={() => onNavigate('messages')}
          className={`flex flex-col items-center gap-1 p-2 transition-colors relative ${currentView === 'messages' ? 'text-nexus-blue' : 'text-slate-400'}`}
        >
          <MessageSquare className="w-5 h-5" />
          <span className="text-[10px] font-bold uppercase tracking-tighter">Mensagens</span>
        </button>
        <button 
          onClick={() => onNavigate('profile')}
          className={`flex flex-col items-center gap-1 p-2 transition-colors ${currentView === 'profile' ? 'text-nexus-blue' : 'text-slate-400'}`}
        >
          <User className="w-5 h-5" />
          <span className="text-[10px] font-bold uppercase tracking-tighter">Perfil</span>
        </button>
      </div>
    </nav>
  );
}
