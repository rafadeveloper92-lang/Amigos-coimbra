import React, { useState, useEffect } from 'react';
import { 
  Users, Gamepad2, Book, Cpu, Music, Plus, Edit2, Trash2, X, Save, LucideIcon,
  Camera, Film, Code, Coffee, Heart, Globe, Briefcase, ShoppingBag, Zap, Star, 
  Shield, Target, Rocket, Palmtree, Utensils, Dumbbell, Car, Plane, Tv, Headphones,
  Search, Lock, Unlock, Key, Mic, BadgeCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { dataService } from '../services/dataService';
import { Group } from '../types';
import { useAuth } from '../contexts/AuthContext';
import GroupDetailView from './GroupDetailView';

const iconMap: Record<string, LucideIcon> = {
  'Users': Users,
  'Gamepad2': Gamepad2,
  'Book': Book,
  'Cpu': Cpu,
  'Music': Music,
  'Camera': Camera,
  'Film': Film,
  'Code': Code,
  'Coffee': Coffee,
  'Heart': Heart,
  'Globe': Globe,
  'Briefcase': Briefcase,
  'ShoppingBag': ShoppingBag,
  'Zap': Zap,
  'Star': Star,
  'Shield': Shield,
  'Target': Target,
  'Rocket': Rocket,
  'Palmtree': Palmtree,
  'Utensils': Utensils,
  'Dumbbell': Dumbbell,
  'Car': Car,
  'Plane': Plane,
  'Tv': Tv,
  'Headphones': Headphones,
  'Mic': Mic,
};

const colorOptions = [
  { name: 'Azul', value: 'bg-blue-500' },
  { name: 'Vermelho', value: 'bg-red-500' },
  { name: 'Verde', value: 'bg-emerald-500' },
  { name: 'Roxo', value: 'bg-purple-500' },
  { name: 'Laranja', value: 'bg-orange-500' },
  { name: 'Rosa', value: 'bg-pink-500' },
  { name: 'Ciano', value: 'bg-cyan-500' },
  { name: 'Amarelo', value: 'bg-yellow-500' },
];

const iconOptions = Object.keys(iconMap);

interface GroupsViewProps {
  onViewProfile?: (userId: string) => void;
  onSendMessage?: (userId: string) => void;
}

export default function GroupsView({ onViewProfile, onSendMessage }: GroupsViewProps) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    icon_name: 'Users',
    color: 'bg-red-600',
    members_count: '0 membros',
    password: '',
    cover_url: '',
    is_sales: false,
    is_jobs: false,
    is_voice: false,
    is_official: false
  });
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [passwordPromptGroup, setPasswordPromptGroup] = useState<Group | null>(null);
  const [enteredPassword, setEnteredPassword] = useState('');
  const [activeGroup, setActiveGroup] = useState<Group | null>(null);
  const [deleteConfirmGroup, setDeleteConfirmGroup] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [favoriteGroups, setFavoriteGroups] = useState<number[]>([]);
  const [groupMembers, setGroupMembers] = useState<Record<number, any[]>>({});
  const [unreadCounts, setUnreadCounts] = useState<Record<number, number>>({});
  const { profile, user } = useAuth();

  // Admin check: either role is admin or it's the specific user email
  const isAdmin = profile?.role === 'admin' || user?.email === 'rafaaprodrigu3s@gmail.com';

  const fetchGroups = async () => {
    setLoading(true);
    const data = await dataService.getGroups();
    setGroups(data);
    
    if (user) {
      const favs = await dataService.getFavoriteGroups(user.id);
      setFavoriteGroups(favs);
    }

    // Fetch members for each group to show online members
    const membersMap: Record<number, any[]> = {};
    const unreadMap: Record<number, number> = {};
    for (const group of data) {
      const members = await dataService.getGroupMembersProfiles(group.id);
      membersMap[group.id] = members;
      
      if (user) {
        const count = await dataService.getUnreadMessagesCount(group.id, user.id);
        unreadMap[group.id] = count;
      }
    }
    setGroupMembers(membersMap);
    setUnreadCounts(unreadMap);
    
    setLoading(false);
  };

  useEffect(() => {
    fetchGroups();
  }, [user]);

  const handleToggleFavorite = async (e: React.MouseEvent, groupId: number) => {
    e.stopPropagation();
    if (!user) return;
    
    const isFavorite = favoriteGroups.includes(groupId);
    
    // Optimistic update
    if (isFavorite) {
      setFavoriteGroups(prev => prev.filter(id => id !== groupId));
    } else {
      setFavoriteGroups(prev => [...prev, groupId]);
    }
    
    try {
      await dataService.toggleFavoriteGroup(user.id, groupId, isFavorite);
    } catch (error) {
      console.error('Erro ao favoritar grupo:', error);
      // Revert on error
      if (isFavorite) {
        setFavoriteGroups(prev => [...prev, groupId]);
      } else {
        setFavoriteGroups(prev => prev.filter(id => id !== groupId));
      }
    }
  };

  const handleOpenModal = (group?: Group) => {
    setCoverFile(null);
    if (group) {
      setEditingGroup(group);
      setFormData({
        name: group.name,
        description: group.description || '',
        icon_name: group.icon_name,
        color: group.color,
        members_count: group.members_count,
        password: group.password || '',
        cover_url: group.cover_url || '',
        is_sales: group.is_sales || false,
        is_jobs: group.is_jobs || false,
        is_voice: group.is_voice || false,
        is_official: group.is_official || false
      });
      setCoverPreview(group.cover_url || null);
    } else {
      setEditingGroup(null);
      setFormData({
        name: '',
        description: '',
        icon_name: 'Users',
        color: 'bg-red-600',
        members_count: '1 membro',
        password: '',
        cover_url: '',
        is_sales: false,
        is_jobs: false,
        is_voice: false,
        is_official: false
      });
      setCoverPreview(null);
    }
    setIsModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    setDeleteConfirmGroup(id);
  };

  const confirmDelete = async () => {
    if (deleteConfirmGroup === null) return;
    try {
      await dataService.deleteGroup(deleteConfirmGroup);
      fetchGroups();
      setDeleteConfirmGroup(null);
    } catch (error: any) {
      console.error('Erro ao excluir grupo:', error);
      setErrorMessage('Erro ao excluir grupo: ' + (error.message || 'Desconhecido'));
      setDeleteConfirmGroup(null);
    }
  };

  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setCoverFile(file);
      setCoverPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    setIsSubmitting(true);
    try {
      let finalCoverUrl = formData.cover_url;
      
      if (coverFile) {
        const uploadedUrl = await dataService.uploadGroupCover(coverFile);
        if (uploadedUrl) {
          finalCoverUrl = uploadedUrl;
        }
      }

      const groupData = {
        ...formData,
        cover_url: finalCoverUrl,
        is_official: formData.is_official || (user?.email?.toLowerCase().trim() === 'rafaaprodrigu3s@gmail.com'),
        created_by: editingGroup ? editingGroup.created_by : user?.id
      };

      if (editingGroup) {
        await dataService.updateGroup(editingGroup.id, groupData);
      } else {
        await dataService.createGroup(groupData);
      }
      setIsModalOpen(false);
      fetchGroups();
    } catch (error) {
      console.error('Erro ao salvar grupo:', error);
      setErrorMessage('Erro ao salvar grupo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredGroups = groups
    .filter(g => g.name.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => {
      const aFav = favoriteGroups.includes(a.id);
      const bFav = favoriteGroups.includes(b.id);
      if (aFav && !bFav) return -1;
      if (!aFav && bFav) return 1;
      return 0;
    });

  const handleEnterGroup = async (group: Group) => {
    setActiveGroup(group);
    if (user) {
      const joined = await dataService.joinGroup(group.id, user.id);
      if (joined) {
        fetchGroups(); // Refresh groups to get updated member count
      }
    }
  };

  const submitPassword = () => {
    if (passwordPromptGroup && enteredPassword === passwordPromptGroup.password) {
      setPasswordPromptGroup(null);
      handleEnterGroup(passwordPromptGroup);
      setEnteredPassword('');
      setErrorMessage(null);
    } else {
      setErrorMessage('Senha incorreta!');
    }
  };

  if (activeGroup) {
    return <GroupDetailView group={activeGroup} onBack={() => setActiveGroup(null)} onViewProfile={onViewProfile} onSendMessage={onSendMessage} />;
  }

  return (
    <div className="max-w-md mx-auto p-4 lg:p-6 min-h-screen bg-slate-50 pb-24">
      {errorMessage && (
        <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg flex justify-between items-center">
          <span>{errorMessage}</span>
          <button onClick={() => setErrorMessage(null)} className="text-red-700 font-bold hover:text-red-900">&times;</button>
        </div>
      )}

      {/* Header Card */}
      <div className="bg-white rounded-3xl p-6 shadow-sm mb-6">
        <h1 className="text-2xl font-black text-nexus-blue uppercase tracking-tighter mb-4">Grupos</h1>
        <div className="flex items-center justify-between border-t border-slate-100 pt-4">
          <div className="text-center flex-1 border-r border-slate-100">
            <div className="text-2xl font-bold text-nexus-blue">{groups.length}</div>
            <div className="text-xs text-slate-500 font-medium">Groups</div>
          </div>
          <div className="text-center flex-1">
            <div className="text-2xl font-bold text-nexus-blue">{groups.length}</div>
            <div className="text-xs text-slate-500 font-medium">Total Groups</div>
          </div>
        </div>
      </div>

      {/* Featured Groups Section */}
      {groups.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-bold text-nexus-blue mb-4 flex items-center gap-2">
            {groups.some(g => g.is_official) ? (
              <>
                <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
                Grupos Oficiais
              </>
            ) : (
              <>
                <Star className="w-5 h-5 text-amber-500" />
                Grupos em Destaque
              </>
            )}
          </h2>
          <div className="flex gap-4 overflow-x-auto pb-4 snap-x hide-scrollbar" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            {(groups.some(g => g.is_official) ? groups.filter(g => g.is_official) : groups.slice(0, 5)).map(group => {
               const Icon = iconMap[group.icon_name] || Users;
               return (
                 <div 
                   key={`featured-${group.id}`} 
                   onClick={() => {
                     if (group.password) {
                       setPasswordPromptGroup(group);
                       setEnteredPassword('');
                     } else {
                       handleEnterGroup(group);
                     }
                   }} 
                   className="min-w-[240px] max-w-[280px] shrink-0 cursor-pointer bg-slate-100 rounded-2xl text-white flex flex-col relative overflow-hidden snap-start h-40 shadow-sm border border-slate-200/50 group"
                 >
                    {group.cover_url ? (
                      <img src={group.cover_url} alt={group.name} className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                    ) : (
                      <div className={`absolute inset-0 opacity-80 ${group.color}`}></div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent"></div>
                    <div className="relative z-10 flex flex-col h-full justify-between p-4">
                      <div className="flex justify-between items-start">
                        <div className={`w-10 h-10 ${group.color} rounded-full flex items-center justify-center shadow-md border-2 border-white/20`}>
                           <Icon className="w-5 h-5 text-white" />
                        </div>
                        <div className="flex gap-2">
                          {group.is_official && (
                            <div className="bg-blue-500/80 backdrop-blur-sm p-1.5 rounded-full shadow-lg" title="Grupo Oficial">
                              <BadgeCheck className="w-3 h-3 text-white" />
                            </div>
                          )}
                          {group.password && (
                            <div className="bg-black/40 backdrop-blur-sm p-1.5 rounded-full">
                              <Lock className="w-3 h-3 text-white" />
                            </div>
                          )}
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h3 className="font-bold text-base leading-tight text-white drop-shadow-md">{group.name}</h3>
                          {group.is_official && <BadgeCheck className="w-4 h-4 text-blue-400" />}
                        </div>
                        <p className="text-xs text-white/90 mt-1 line-clamp-2 drop-shadow-md">{group.description || (group.is_official ? 'Grupo Oficial da Comunidade' : 'Destaque')}</p>
                      </div>
                    </div>
                 </div>
               )
            })}
          </div>
        </div>
      )}

      {/* Create Button (Available to all logged users) */}
      {user && (
        <button
          onClick={() => handleOpenModal()}
          className="w-full bg-nexus-blue text-white rounded-2xl py-4 font-bold uppercase tracking-widest text-sm flex items-center justify-center gap-2 mb-6 shadow-lg active:scale-95 transition-all"
        >
          <Plus className="w-5 h-5" /> CRIAR GRUPO
        </button>
      )}

      {/* Search Bar */}
      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
        <input
          type="text"
          placeholder="Pesquisar grupos..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-white border border-slate-200 rounded-2xl pl-12 pr-4 py-4 text-slate-900 focus:ring-2 focus:ring-nexus-blue/20 focus:border-nexus-blue transition-all outline-none shadow-sm"
        />
      </div>

      {/* Group List */}
      <div className="space-y-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={`group-skeleton-${i}`} className="bg-white rounded-3xl p-5 border border-slate-100 animate-pulse flex items-center gap-4 shadow-sm">
              <div className="w-16 h-16 bg-slate-100 rounded-2xl" />
              <div className="flex-1 space-y-3">
                <div className="h-5 bg-slate-100 rounded w-3/4" />
                <div className="h-4 bg-slate-100 rounded w-1/2" />
              </div>
            </div>
          ))
        ) : filteredGroups.length > 0 ? (
          filteredGroups.map((group) => {
            const Icon = iconMap[group.icon_name] || Users;
            return (
              <motion.div
                layout
                key={group.id}
                className="bg-white rounded-3xl p-5 shadow-sm relative cursor-pointer hover:shadow-md transition-all border border-slate-100"
                onClick={() => {
                  if (group.password) {
                    setPasswordPromptGroup(group);
                    setEnteredPassword('');
                  } else {
                    handleEnterGroup(group);
                  }
                }}
              >
                <div className="flex items-start gap-4">
                  <div className={`w-16 h-16 rounded-2xl ${group.color} flex items-center justify-center text-white shrink-0 shadow-md relative overflow-hidden`}>
                    <Icon className="w-8 h-8 relative z-10" />
                  </div>
                  <div className="flex-1 pt-1">
                    <h3 className="font-bold text-nexus-blue text-lg flex items-center gap-2 flex-wrap">
                      {group.name} {group.password && <Lock className="w-4 h-4 text-slate-400" />}
                      {group.is_official && (
                        <span className="bg-blue-100 text-blue-600 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
                          <BadgeCheck className="w-3 h-3" /> Oficial
                        </span>
                      )}
                      {group.is_sales && (
                        <span className="bg-amber-100 text-amber-600 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
                          <ShoppingBag className="w-3 h-3" /> Vendas
                        </span>
                      )}
                      {group.is_jobs && (
                        <span className="bg-blue-100 text-blue-600 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
                          <Briefcase className="w-3 h-3" /> Trabalho
                        </span>
                      )}
                      {group.is_voice && (
                        <span className="bg-purple-100 text-purple-600 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
                          <Mic className="w-3 h-3" /> Voz
                        </span>
                      )}
                      {unreadCounts[group.id] > 0 && (
                        <span className="bg-green-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center animate-bounce shadow-sm">
                          {unreadCounts[group.id] > 99 ? '99+' : unreadCounts[group.id]}
                        </span>
                      )}
                    </h3>
                    <p className="text-sm text-slate-500">{group.members_count}</p>
                    {group.description && <p className="text-xs text-slate-400 mt-1 line-clamp-1">{group.description}</p>}
                  </div>
                  <div className="flex flex-col gap-3 items-end">
                    {user && (
                      <button
                        onClick={(e) => handleToggleFavorite(e, group.id)}
                        className={`transition-all ${
                          favoriteGroups.includes(group.id) 
                            ? 'text-yellow-400' 
                            : 'text-slate-300 hover:text-yellow-400'
                        }`}
                      >
                        <Star className={`w-6 h-6 ${favoriteGroups.includes(group.id) ? 'fill-current' : ''}`} />
                      </button>
                    )}
                    {(isAdmin || group.created_by === user?.id) && (
                      <div className="flex gap-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleOpenModal(group); }}
                          className="text-slate-400 hover:text-nexus-blue transition-all"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(group.id); }}
                          className="text-slate-400 hover:text-red-600 transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="mt-4 pt-4 border-t border-slate-50">
                  <p className="text-xs font-bold text-nexus-blue mb-2">Online members</p>
                  <div className="flex -space-x-2">
                    {groupMembers[group.id] && groupMembers[group.id].length > 0 ? (
                      groupMembers[group.id].slice(0, 5).map((member, idx) => (
                        <div key={member.id} className="relative" style={{ zIndex: 10 - idx }}>
                          <img 
                            src={member.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(member.first_name || 'U')}&background=random`} 
                            alt={member.first_name}
                            className="w-8 h-8 rounded-full border-2 border-white object-cover"
                          />
                          {/* Mock online status for now */}
                          <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-white rounded-full"></div>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-slate-400">Nenhum membro online</p>
                    )}
                    {groupMembers[group.id] && groupMembers[group.id].length > 5 && (
                      <div className="w-8 h-8 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500 relative z-0">
                        +{groupMembers[group.id].length - 5}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })
        ) : (
          <div className="py-24 text-center bg-white rounded-3xl border-2 border-dashed border-slate-200">
            <Users className="w-16 h-16 text-slate-200 mx-auto mb-4" />
            <p className="text-slate-500 font-bold uppercase tracking-widest text-sm">Nenhum grupo disponível</p>
            {user && (
              <button 
                onClick={() => handleOpenModal()}
                className="mt-4 text-nexus-blue font-bold hover:underline uppercase text-xs tracking-widest"
              >
                Clique aqui para criar o primeiro
              </button>
            )}
          </div>
        )}
      </div>

      {/* Modal de Criação/Edição */}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-nexus-blue/40 backdrop-blur-sm"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-slate-50 flex items-center justify-between shrink-0">
                <h2 className="text-xl font-bold text-nexus-blue uppercase tracking-tighter">
                  {editingGroup ? 'Editar Grupo' : 'Novo Grupo'}
                </h2>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-nexus-blue hover:bg-slate-50 rounded-full transition-all"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Foto de Capa</label>
                  <div className="relative w-full h-32 bg-slate-100 rounded-xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center overflow-hidden group cursor-pointer hover:border-nexus-blue transition-colors">
                    {coverPreview ? (
                      <>
                        <img src={coverPreview} alt="Capa do grupo" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Camera className="w-8 h-8 text-white" />
                        </div>
                      </>
                    ) : (
                      <>
                        <Camera className="w-8 h-8 text-slate-400 mb-2 group-hover:text-nexus-blue transition-colors" />
                        <span className="text-xs text-slate-500 font-medium group-hover:text-nexus-blue transition-colors">Clique para adicionar capa</span>
                      </>
                    )}
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleCoverChange} 
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${formData.is_sales ? 'bg-amber-100 text-amber-600' : 'bg-slate-200 text-slate-500'}`}>
                    <ShoppingBag className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-slate-700">Grupo de Vendas</p>
                    <p className="text-xs text-slate-500">Ativa a opção de criar anúncios no chat</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, is_sales: !formData.is_sales })}
                    className={`w-12 h-6 rounded-full transition-all relative ${formData.is_sales ? 'bg-amber-500' : 'bg-slate-300'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${formData.is_sales ? 'right-1' : 'left-1'}`} />
                  </button>
                </div>

                <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${formData.is_jobs ? 'bg-blue-100 text-blue-600' : 'bg-slate-200 text-slate-500'}`}>
                    <Briefcase className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-slate-700">Grupo de Trabalho</p>
                    <p className="text-xs text-slate-500">Ativa a opção de criar anúncios de vagas no chat</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, is_jobs: !formData.is_jobs })}
                    className={`w-12 h-6 rounded-full transition-all relative ${formData.is_jobs ? 'bg-blue-500' : 'bg-slate-300'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${formData.is_jobs ? 'right-1' : 'left-1'}`} />
                  </button>
                </div>

                <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${formData.is_voice ? 'bg-purple-100 text-purple-600' : 'bg-slate-200 text-slate-500'}`}>
                    <Mic className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-slate-700">Grupo de Voz</p>
                    <p className="text-xs text-slate-500">Ativa o chat de voz em tempo real no grupo</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, is_voice: !formData.is_voice })}
                    className={`w-12 h-6 rounded-full transition-all relative ${formData.is_voice ? 'bg-purple-500' : 'bg-slate-300'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${formData.is_voice ? 'right-1' : 'left-1'}`} />
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Nome do Grupo</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ex: Amantes de Cinema"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-slate-900 focus:ring-2 focus:ring-nexus-blue/20 focus:border-nexus-blue transition-all outline-none placeholder:text-slate-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Descrição (Frase do Grupo)</label>
                  <input
                    type="text"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Ex: O melhor grupo para debater filmes"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-slate-900 focus:ring-2 focus:ring-nexus-blue/20 focus:border-nexus-blue transition-all outline-none placeholder:text-slate-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Senha (Opcional)</label>
                  <div className="relative">
                    <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <input
                      type="text"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      placeholder="Deixe em branco para grupo público"
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-10 pr-4 py-3 text-slate-900 focus:ring-2 focus:ring-nexus-blue/20 focus:border-nexus-blue transition-all outline-none placeholder:text-slate-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Ícone</label>
                  <div className="grid grid-cols-5 sm:grid-cols-7 gap-2 max-h-48 overflow-y-auto p-1">
                    {iconOptions.map((iconName) => {
                      const Icon = iconMap[iconName];
                      return (
                        <button
                          key={iconName}
                          type="button"
                          onClick={() => setFormData({ ...formData, icon_name: iconName })}
                          className={`p-3 rounded-lg flex items-center justify-center transition-all ${
                            formData.icon_name === iconName
                              ? 'bg-nexus-blue text-white shadow-lg'
                              : 'bg-slate-50 text-slate-400 hover:bg-slate-100'
                          }`}
                        >
                          <Icon className="w-6 h-6" />
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Cor Temática</label>
                  <div className="grid grid-cols-4 gap-2">
                    {colorOptions.map((color) => (
                      <button
                        key={color.value}
                        type="button"
                        onClick={() => setFormData({ ...formData, color: color.value })}
                        className={`h-10 rounded-lg transition-all border-2 ${color.value} ${
                          formData.color === color.value ? 'border-nexus-blue scale-110' : 'border-transparent opacity-60 hover:opacity-100'
                        }`}
                        title={color.name}
                      />
                    ))}
                  </div>
                </div>

                {isAdmin && (
                  <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-xl border border-blue-100 mb-4">
                    <BadgeCheck className="w-5 h-5 text-blue-600" />
                    <div className="flex-1">
                      <p className="text-sm font-bold text-blue-900">Grupo Oficial</p>
                      <p className="text-xs text-blue-700">Marcar este grupo como oficial da comunidade.</p>
                    </div>
                    <input 
                      type="checkbox"
                      checked={formData.is_official}
                      onChange={(e) => setFormData({...formData, is_official: e.target.checked})}
                      className="w-5 h-5 accent-blue-600"
                    />
                  </div>
                )}

                <div className="flex gap-3 pt-4 sticky bottom-0 bg-white pb-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 py-3 rounded-lg font-bold text-slate-500 bg-slate-50 hover:bg-slate-100 transition-colors uppercase text-xs tracking-widest border border-slate-200"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 py-3 rounded-lg font-bold text-white bg-nexus-blue hover:bg-nexus-blue/90 transition-all shadow-lg flex items-center justify-center gap-2 uppercase text-xs tracking-widest"
                  >
                    {isSubmitting ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <Save className="w-5 h-5" />
                        <span>{editingGroup ? 'Salvar' : 'Criar'}</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {passwordPromptGroup && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-nexus-blue/40 backdrop-blur-sm"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-2xl w-full max-w-sm shadow-2xl border border-slate-100 overflow-hidden p-6 text-center"
            >
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Lock className="w-8 h-8 text-slate-400" />
              </div>
              <h2 className="text-xl font-bold text-nexus-blue mb-2">Grupo Protegido</h2>
              <p className="text-sm text-slate-500 mb-6">Digite a senha para entrar em <strong>{passwordPromptGroup.name}</strong></p>
              
              <input
                type="password"
                value={enteredPassword}
                onChange={(e) => setEnteredPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submitPassword()}
                placeholder="Senha do grupo"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-center text-slate-900 focus:ring-2 focus:ring-nexus-blue/20 focus:border-nexus-blue transition-all outline-none mb-4"
                autoFocus
              />
              
              <div className="flex gap-2">
                <button
                  onClick={() => setPasswordPromptGroup(null)}
                  className="flex-1 py-3 rounded-lg font-bold text-slate-500 bg-slate-50 hover:bg-slate-100 transition-colors uppercase text-xs tracking-widest"
                >
                  Cancelar
                </button>
                <button
                  onClick={submitPassword}
                  className="flex-1 py-3 rounded-lg font-bold text-white bg-nexus-blue hover:bg-nexus-blue/90 transition-all shadow-lg uppercase text-xs tracking-widest"
                >
                  Entrar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal de Confirmação de Exclusão */}
      <AnimatePresence>
        {deleteConfirmGroup !== null && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-nexus-blue/40 backdrop-blur-sm"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-2xl w-full max-w-sm shadow-2xl border border-slate-100 overflow-hidden p-6 text-center"
            >
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-8 h-8 text-red-600" />
              </div>
              <h2 className="text-xl font-bold text-nexus-blue mb-2">Excluir Grupo</h2>
              <p className="text-sm text-slate-500 mb-6">Tem certeza que deseja excluir este grupo? Esta ação não pode ser desfeita.</p>
              
              <div className="flex gap-2">
                <button
                  onClick={() => setDeleteConfirmGroup(null)}
                  className="flex-1 py-3 rounded-lg font-bold text-slate-500 bg-slate-50 hover:bg-slate-100 transition-colors uppercase text-xs tracking-widest"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmDelete}
                  className="flex-1 py-3 rounded-lg font-bold text-white bg-red-600 hover:bg-red-700 transition-all shadow-lg uppercase text-xs tracking-widest"
                >
                  Excluir
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
