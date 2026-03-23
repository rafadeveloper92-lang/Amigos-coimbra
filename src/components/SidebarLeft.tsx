import { useState, useEffect } from 'react';
import { Users, Gamepad2, Book, Cpu, Music, LucideIcon } from 'lucide-react';
import { dataService } from '../services/dataService';
import { Group } from '../types';

const iconMap: Record<string, LucideIcon> = {
  'Users': Users,
  'Gamepad2': Gamepad2,
  'Book': Book,
  'Cpu': Cpu,
  'Music': Music,
};

import { ViewType } from '../App';

interface SidebarLeftProps {
  onNavigate?: (view: ViewType) => void;
}

export default function SidebarLeft({ onNavigate }: SidebarLeftProps) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [dbStatus, setDbStatus] = useState<{ connected: boolean; message: string }>({ connected: false, message: 'Verificando...' });

  useEffect(() => {
    const fetchGroups = async () => {
      // Check connection status
      const status = await dataService.checkConnection();
      setDbStatus(status);

      const data = await dataService.getGroups();
      setGroups(data);
      setLoading(false);
    };
    fetchGroups();
  }, []);

  return (
    <aside className="hidden lg:block w-72 h-[calc(100vh-64px)] overflow-y-auto p-4 sticky top-16">
      {/* Status da Conexão */}
      <div className="bg-white rounded-xl p-4 mb-4 border border-slate-100 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Supabase Status</span>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${
              dbStatus.connected 
                ? (dbStatus.message === 'Conectado' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' : 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)]') 
                : 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.4)]'
            }`} />
            <span className={`text-[10px] font-bold uppercase tracking-widest ${
              dbStatus.connected ? 'text-slate-600' : 'text-rose-500'
            }`}>{dbStatus.message}</span>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-100 rounded-xl shadow-sm p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Meus Grupos</h2>
          <button 
            onClick={() => onNavigate?.('groups')}
            className="text-[10px] font-bold text-nexus-blue hover:underline uppercase tracking-wider"
          >
            Ver Todos
          </button>
        </div>
        <div className="space-y-4">
          {loading ? (
            <div className="flex justify-center p-4">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-nexus-blue"></div>
            </div>
          ) : groups.length > 0 ? (
            groups.map((group) => {
              const Icon = iconMap[group.icon_name] || Users;
              return (
                <div 
                  key={group.id} 
                  onClick={() => onNavigate?.('groups')}
                  className="flex items-center gap-3 cursor-pointer hover:bg-slate-50 p-2 rounded-lg transition-colors group"
                >
                  <div className={`w-10 h-10 rounded-lg ${group.color} flex items-center justify-center text-white shadow-sm group-hover:scale-105 transition-transform`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 leading-tight">{group.name}</h3>
                    <p className="text-[11px] text-slate-400">{group.members_count}</p>
                  </div>
                </div>
              );
            })
          ) : (
            <p className="text-xs text-slate-300 text-center">Nenhum grupo encontrado.</p>
          )}
        </div>
      </div>
    </aside>
  );
}
