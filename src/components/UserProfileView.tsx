import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { dataService } from '../services/dataService';
import { supabase } from '../services/supabaseClient';
import { Post as PostType } from '../types';
import PostCard from './PostCard';
import HighlightViewer from './HighlightViewer';
import { motion } from 'motion/react';
import { 
  MapPin, 
  Calendar, 
  Edit3, 
  Grid, 
  Info, 
  Users, 
  Image as ImageIcon,
  MoreHorizontal,
  Camera,
  Globe,
  Heart,
  Briefcase,
  User as UserIcon,
  MessageCircle,
  MessageSquare,
  MoreVertical,
  UserMinus,
  ShieldAlert,
  Plus,
  Play,
  UserSquare
} from 'lucide-react';
import { nationalities, relationships } from './UserProfile';

interface UserProfileViewProps {
  onEdit: () => void;
  userId?: string;
  onSendMessage?: (userId: string) => void;
}

export default function UserProfileView({ onEdit, userId, onSendMessage }: UserProfileViewProps) {
  const { profile: currentUserProfile, user: currentUser } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [posts, setPosts] = useState<PostType[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'posts' | 'about' | 'friends' | 'photos'>('posts');
  const [highlights, setHighlights] = useState<any[]>([]);
  const [showHighlightModal, setShowHighlightModal] = useState(false);
  const [newHighlight, setNewHighlight] = useState({ title: '', cover_url: '' });
  const [uploading, setUploading] = useState(false);
  const [savingHighlight, setSavingHighlight] = useState(false);
  const [viewingHighlight, setViewingHighlight] = useState<string | null>(null);
  const [editingHighlight, setEditingHighlight] = useState<any>(null);

  const isOwnProfile = !userId || userId === currentUser?.id;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, isEdit: boolean = false) => {
    if (!e.target.files || e.target.files.length === 0) return;
    
    setUploading(true);
    const file = e.target.files[0];
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${currentUser?.id}/${Math.random()}.${fileExt}`;
      
      const { data, error } = await supabase.storage
        .from('highlights')
        .upload(fileName, file);
        
      if (error) throw error;
      
      const { data: { publicUrl } } = supabase.storage
        .from('highlights')
        .getPublicUrl(fileName);
        
      if (isEdit && editingHighlight) {
        setEditingHighlight({ ...editingHighlight, cover_url: publicUrl });
      } else {
        setNewHighlight({ ...newHighlight, cover_url: publicUrl });
      }
    } catch (error) {
      console.error('Error uploading file:', error);
    } finally {
      setUploading(false);
    }
  };

  const handleUpdateHighlight = async () => {
    if (!editingHighlight || !editingHighlight.title || !editingHighlight.cover_url) return;
    
    setSavingHighlight(true);
    try {
      const updatedData = await dataService.updateHighlight(editingHighlight.id, editingHighlight.title, editingHighlight.cover_url);
      if (updatedData && updatedData.length > 0) {
        setHighlights(prev => prev.map(h => h.id === editingHighlight.id ? updatedData[0] : h));
      }
      setEditingHighlight(null);
    } catch (error) {
      console.error('Error updating highlight:', error);
    } finally {
      setSavingHighlight(false);
    }
  };

  useEffect(() => {
    const fetchProfileAndPosts = async () => {
      setLoading(true);
      try {
        const targetUserId = userId || currentUser?.id;
        if (!targetUserId) return;

        if (isOwnProfile) {
          setProfile(currentUserProfile);
        } else {
          const fetchedProfile = await dataService.getUserProfile(targetUserId);
          setProfile(fetchedProfile);
        }

        const [userPosts, stats, userHighlights] = await Promise.all([
          dataService.getUserPosts(targetUserId),
          dataService.getProfileStats(targetUserId),
          dataService.getHighlights(targetUserId)
        ]);
        
        setPosts(userPosts);
        setProfile(prev => ({ ...prev, ...stats }));
        setHighlights(userHighlights);
      } catch (error) {
        console.error('Error fetching profile data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfileAndPosts();
  }, [userId, currentUser?.id, currentUserProfile, isOwnProfile]);

  const handleCreateHighlight = async () => {
    if (!currentUser?.id || !newHighlight.title || !newHighlight.cover_url) return;
    
    try {
      await dataService.createHighlight(currentUser.id, newHighlight.title, newHighlight.cover_url);
      setNewHighlight({ title: '', cover_url: '' });
      setShowHighlightModal(false);
      const userHighlights = await dataService.getHighlights(currentUser.id);
      setHighlights(userHighlights);
    } catch (error) {
      console.error('Error creating highlight:', error);
    }
  };

  const displayName = profile ? `${profile.first_name} ${profile.last_name}` : 'Usuário';
  const username = profile?.username || 'username';
  const avatarUrl = profile?.avatar_url || `https://picsum.photos/seed/${username}/200/200`;
  const coverUrl = profile?.cover_url || null;
  const city = profile?.city || 'Não informada';
  const joinedDate = profile?.created_at ? new Date(profile.created_at).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }) : 'Março de 2024';
  const bio = profile?.bio || 'Nenhuma biografia adicionada ainda.';

  const calculateAge = (birthdate: string) => {
    if (!birthdate) return null;
    const birth = new Date(birthdate);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  const getNationalityLabel = (code: string) => {
    const nat = nationalities.find(n => n.value === code);
    return nat ? nat.label : code;
  };

  const getRelationshipLabel = (code: string) => {
    const rel = relationships.find(r => r.value === code);
    return rel ? rel.label : code;
  };

  const genderMap: Record<string, string> = {
    male: 'Masculino',
    female: 'Feminino',
    other: 'Outro / Prefiro não dizer'
  };

  const age = calculateAge(profile?.birthdate);

  const [isAddingFriend, setIsAddingFriend] = useState(false);
  const [friendshipStatus, setFriendshipStatus] = useState<any>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [modalState, setModalState] = useState<{ isOpen: boolean, title: string, message: string, type: 'alert' | 'confirm', onConfirm?: () => void }>({
    isOpen: false, title: '', message: '', type: 'alert'
  });
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (currentUser?.id && userId) {
      const checkStatus = async () => {
        const status = await dataService.getFriendshipStatus(currentUser.id, userId);
        setFriendshipStatus(status);
      };
      checkStatus();
    }
  }, [currentUser?.id, userId]);

  const handleAddFriend = async () => {
    if (!userId || !currentUser?.id) return;
    
    setIsAddingFriend(true);
    try {
      console.log('Adicionar amigo clicado para:', userId);
      const result = await dataService.addFriend(currentUser.id, userId);
      console.log('Add friend result:', result);
      if (result) {
        setModalState({ isOpen: true, title: 'Sucesso', message: 'Pedido de amizade enviado com sucesso!', type: 'alert' });
        setFriendshipStatus({ status: 'pending' });
      } else {
        setModalState({ isOpen: true, title: 'Aviso', message: 'Não foi possível enviar o pedido de amizade. Verifique se as tabelas no Supabase estão configuradas.', type: 'alert' });
      }
    } catch (error) {
      console.error('Erro ao adicionar amigo:', error);
      setModalState({ isOpen: true, title: 'Erro', message: 'Ocorreu um erro ao tentar adicionar o amigo.', type: 'alert' });
    } finally {
      setIsAddingFriend(false);
    }
  };

  const handleRemoveFriend = () => {
    if (!userId || !currentUser?.id) return;
    setModalState({
      isOpen: true,
      title: 'Remover Amigo',
      message: 'Tem certeza que deseja remover este amigo?',
      type: 'confirm',
      onConfirm: async () => {
        const success = await dataService.removeFriend(currentUser.id, userId);
        if (success) {
          setFriendshipStatus(null);
          setShowDropdown(false);
          setModalState({ isOpen: true, title: 'Sucesso', message: 'Amigo removido.', type: 'alert' });
        } else {
          setModalState({ isOpen: false, title: '', message: '', type: 'alert' });
        }
      }
    });
  };

  const handleBlockUser = () => {
    if (!userId || !currentUser?.id) return;
    setModalState({
      isOpen: true,
      title: 'Bloquear Usuário',
      message: 'Tem certeza que deseja bloquear este usuário?',
      type: 'confirm',
      onConfirm: async () => {
        const success = await dataService.blockUser(currentUser.id, userId);
        if (success) {
          setFriendshipStatus({ status: 'blocked' });
          setShowDropdown(false);
          setModalState({ isOpen: true, title: 'Sucesso', message: 'Usuário bloqueado.', type: 'alert' });
        } else {
          setModalState({ isOpen: false, title: '', message: '', type: 'alert' });
        }
      }
    });
  };

  return (
    <div className="w-full max-w-4xl mx-auto pb-24">
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

      {/* Header / Cover Section */}
      <div className="bg-white overflow-hidden shadow-sm border-b border-slate-100">
        {/* Cover Photo */}
        <div className="h-[30vh] md:h-[45vh] bg-slate-100 relative group overflow-hidden">
          {coverUrl ? (
            <img src={coverUrl} alt="Cover" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-r from-nexus-blue to-indigo-900" />
          )}
          
          {isOwnProfile && (
            <button onClick={onEdit} className="absolute bottom-4 right-4 bg-black/50 hover:bg-black/70 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-bold transition-all backdrop-blur-sm opacity-0 group-hover:opacity-100 z-10">
              <Camera className="w-4 h-4" />
              Alterar Capa
            </button>
          )}
        </div>

        {/* Profile Info Section */}
        <div className="px-4 md:px-8 pb-6 relative -mt-14 md:-mt-20 z-10">
          {/* Avatar - Overlapping Cover */}
          <div className="flex flex-col md:flex-row items-start md:items-end gap-4 md:gap-6">
            <div className="relative group">
              <div className="w-28 h-28 md:w-40 md:h-40 rounded-full border-4 border-white shadow-lg overflow-hidden bg-slate-100">
                <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
              </div>
              {isOwnProfile && (
                <button 
                  onClick={onEdit} 
                  className="absolute bottom-1 right-1 bg-nexus-blue hover:bg-blue-700 p-2 rounded-full shadow-md border-2 border-white transition-all transform hover:scale-110 active:scale-95"
                  title="Alterar Foto de Perfil"
                >
                  <Camera className="w-4 h-4 text-white" />
                </button>
              )}
            </div>

            {/* Name and Username - Left Aligned */}
            <div className="flex-1 pb-1 mt-3 md:mt-0">
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">{displayName}</h1>
                  {profile?.role === 'admin' && (
                    <span className="bg-nexus-blue text-white text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-widest shadow-sm">
                      Admin
                    </span>
                  )}
                </div>
                <p className="text-slate-500 font-medium text-base md:text-lg">@{username}</p>
              </div>
            </div>
          </div>

          {/* Action Buttons - Centered on mobile, Right on desktop */}
          <div className="flex justify-center md:justify-start mt-6 gap-2">
            {isOwnProfile ? (
              <div className="flex gap-2 w-full md:w-auto">
                <button 
                  onClick={onEdit}
                  className="flex-1 md:flex-none bg-slate-100 hover:bg-slate-200 text-slate-900 px-6 py-2 rounded-lg font-bold flex items-center justify-center gap-2 transition-all text-sm border border-slate-200 shadow-sm"
                >
                  <Edit3 className="w-4 h-4" />
                  Editar Perfil
                </button>
                <button className="bg-slate-100 hover:bg-slate-200 text-slate-900 p-2 rounded-lg transition-all border border-slate-200 shadow-sm">
                  <MoreHorizontal className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <>
                <button 
                  onClick={handleAddFriend}
                  disabled={isAddingFriend || !!friendshipStatus}
                  className={`${
                    isAddingFriend || !!friendshipStatus
                      ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200' 
                      : 'bg-nexus-blue hover:bg-blue-700 text-white'
                  } px-6 py-2 rounded-lg font-bold flex items-center gap-2 transition-all text-sm shadow-md`}
                >
                  {isAddingFriend ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Users className="w-4 h-4" />
                  )}
                  {isAddingFriend ? 'Enviando...' : 
                    friendshipStatus?.status === 'accepted' ? 'Amigos' :
                    friendshipStatus?.status === 'pending' ? 'Pendente' : 
                    friendshipStatus?.status === 'blocked' ? 'Bloqueado' :
                    'Adicionar Amigo'}
                </button>
                {onSendMessage && friendshipStatus?.status !== 'blocked' && (
                  <button 
                    onClick={() => {
                      if (onSendMessage && userId) onSendMessage(userId);
                    }}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-6 py-2 rounded-lg font-bold flex items-center gap-2 transition-all text-sm border border-slate-200"
                  >
                    <MessageCircle className="w-4 h-4" />
                    Mensagem
                  </button>
                )}
              </>
            )}
            
            {!isOwnProfile && (
              <div className="relative" ref={dropdownRef}>
                <button 
                  onClick={() => setShowDropdown(!showDropdown)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 p-2 rounded-lg transition-all border border-slate-200"
                >
                  <MoreHorizontal className="w-5 h-5" />
                </button>
                
                {showDropdown && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden z-50">
                    {friendshipStatus?.status === 'accepted' && (
                      <button 
                        onClick={handleRemoveFriend}
                        className="w-full text-left px-4 py-3 text-sm text-red-600 hover:bg-slate-50 font-medium transition-colors"
                      >
                        Remover Amigo
                      </button>
                    )}
                    {friendshipStatus?.status !== 'blocked' && (
                      <button 
                        onClick={handleBlockUser}
                        className="w-full text-left px-4 py-3 text-sm text-red-600 hover:bg-slate-50 font-medium transition-colors border-t border-slate-100"
                      >
                        Bloquear Usuário
                      </button>
                    )}
                    {friendshipStatus?.status === 'blocked' && (
                      <button 
                        onClick={handleRemoveFriend}
                        className="w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 font-medium transition-colors"
                      >
                        Desbloquear
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Stats and Bio */}
          <div className="mt-8">
            {/* Stats - Premium Layout */}
            <div className="flex justify-between md:justify-start md:gap-12 py-6 border-y border-slate-50">
              <div className="flex flex-col items-center md:items-start">
                <span className="font-black text-xl text-slate-900">{profile?.posts_count || 0}</span>
                <span className="text-[9px] text-slate-400 font-black uppercase tracking-[0.15em] mt-0.5">Publicações</span>
              </div>
              <div className="flex flex-col items-center md:items-start">
                <span className="font-black text-xl text-slate-900">{profile?.followers_count || 0}</span>
                <span className="text-[9px] text-slate-400 font-black uppercase tracking-[0.15em] mt-0.5">Seguidores</span>
              </div>
              <div className="flex flex-col items-center md:items-start">
                <span className="font-black text-xl text-slate-900">{profile?.following_count || 0}</span>
                <span className="text-[9px] text-slate-400 font-black uppercase tracking-[0.15em] mt-0.5">A seguir</span>
              </div>
            </div>

            <p className="text-slate-600 max-w-2xl whitespace-pre-wrap text-left mt-6 leading-relaxed text-sm md:text-base">
              {bio}
            </p>

            <div className="mt-4 flex flex-wrap justify-center md:justify-start gap-4 text-sm text-slate-400 font-medium">
              {profile?.nationality && (
                <div className="flex items-center gap-1">
                  <Globe className="w-4 h-4" />
                  {getNationalityLabel(profile.nationality)}
                </div>
              )}
              {profile?.city && (
                <div className="flex items-center gap-1">
                  <MapPin className="w-4 h-4" />
                  {profile.city}
                </div>
              )}
              {profile?.occupation && (
                <div className="flex items-center gap-1">
                  <Briefcase className="w-4 h-4" />
                  {profile.occupation}
                </div>
              )}
            </div>

            {/* Highlights */}
            <div className="flex gap-4 overflow-x-auto pb-4 mt-6 scrollbar-hide">
              {isOwnProfile && (
                <div className="flex flex-col items-center gap-2 min-w-[70px]">
                  <button 
                    onClick={() => setShowHighlightModal(true)}
                    className="w-16 h-16 rounded-full border-2 border-dashed border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors bg-white shadow-sm"
                  >
                    <Plus className="w-6 h-6 text-slate-400" />
                  </button>
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Novo</span>
                </div>
              )}
              {highlights.map((highlight) => (
                <div 
                  key={highlight.id} 
                  className="flex flex-col items-center gap-2 min-w-[70px] cursor-pointer group"
                >
                  <div 
                    className="w-16 h-16 rounded-full border-2 border-nexus-blue p-0.5 relative bg-white shadow-sm transition-transform group-hover:scale-105"
                    onClick={() => setViewingHighlight(highlight.id)}
                  >
                    <div className="w-full h-full rounded-full overflow-hidden border-2 border-white">
                      <img src={highlight.cover_url} alt={highlight.title} className="w-full h-full object-cover" />
                    </div>
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-600 truncate w-full text-center" onClick={() => setViewingHighlight(highlight.id)}>{highlight.title}</span>
                  {isOwnProfile && (
                    <button 
                      onClick={() => setEditingHighlight(highlight)}
                      className="text-[9px] text-nexus-blue font-black uppercase tracking-tighter hover:underline"
                    >
                      Editar
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Highlight Viewer */}
            {viewingHighlight && (
              <HighlightViewer 
                highlightId={viewingHighlight} 
                isOwnProfile={isOwnProfile}
                onClose={() => setViewingHighlight(null)} 
              />
            )}

            {/* Edit Highlight Modal */}
            {editingHighlight && (
              <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
                  <h3 className="text-xl font-bold text-slate-800 mb-4">Editar Destaque</h3>
                  <input
                    type="text"
                    placeholder="Título"
                    value={editingHighlight.title}
                    onChange={(e) => setEditingHighlight({ ...editingHighlight, title: e.target.value })}
                    className="w-full p-3 border border-slate-200 rounded-lg mb-3"
                  />
                  <div className="mb-4">
                    <label className="block text-sm font-bold text-slate-700 mb-1">Capa do Destaque</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileUpload(e, true)}
                      className="w-full p-2 border border-slate-200 rounded-lg"
                    />
                    {uploading && <p className="text-xs text-nexus-blue mt-1">Enviando...</p>}
                    {editingHighlight.cover_url && <img src={editingHighlight.cover_url} alt="Capa" className="w-16 h-16 rounded-lg mt-2 object-cover" />}
                  </div>
                  <div className="flex justify-end gap-3">
                    <button 
                      onClick={() => setEditingHighlight(null)} 
                      disabled={savingHighlight}
                      className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                    >
                      Cancelar
                    </button>
                    <button 
                      onClick={handleUpdateHighlight} 
                      disabled={savingHighlight || uploading}
                      className="px-4 py-2 bg-nexus-blue text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                      {savingHighlight ? 'Salvando...' : 'Salvar'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Highlight Modal */}
            {showHighlightModal && (
              <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
                  <h3 className="text-xl font-bold text-slate-800 mb-4">Novo Destaque</h3>
                  <input
                    type="text"
                    placeholder="Título"
                    value={newHighlight.title}
                    onChange={(e) => setNewHighlight({ ...newHighlight, title: e.target.value })}
                    className="w-full p-3 border border-slate-200 rounded-lg mb-3"
                  />
                  <div className="mb-4">
                    <label className="block text-sm font-bold text-slate-700 mb-1">Capa do Destaque</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload}
                      className="w-full p-2 border border-slate-200 rounded-lg"
                    />
                    {uploading && <p className="text-xs text-nexus-blue mt-1">Enviando...</p>}
                    {newHighlight.cover_url && <p className="text-xs text-green-600 mt-1">Foto carregada!</p>}
                  </div>
                  <div className="flex justify-end gap-3">
                    <button onClick={() => setShowHighlightModal(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">Cancelar</button>
                    <button onClick={handleCreateHighlight} className="px-4 py-2 bg-nexus-blue text-white rounded-lg hover:bg-blue-700">Adicionar</button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Tabs */}
          <div className="mt-8 flex border-t border-slate-100">
            {[
              { id: 'posts', label: 'Publicações', icon: Grid },
              { id: 'about', label: 'Sobre', icon: Info },
              { id: 'friends', label: 'Amigos', icon: Users },
              { id: 'photos', label: 'Fotos', icon: ImageIcon },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex-1 py-4 flex items-center justify-center gap-2 text-sm font-bold transition-all relative ${
                  activeTab === tab.id ? 'text-nexus-blue' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                <span className="hidden sm:inline">{tab.label}</span>
                {activeTab === tab.id && (
                  <motion.div 
                    layoutId="activeProfileTab"
                    className="absolute bottom-0 left-0 right-0 h-1 bg-nexus-blue rounded-t-full"
                  />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="max-w-4xl mx-auto mt-4 grid grid-cols-1 lg:grid-cols-12 gap-4 px-4 lg:px-0 pb-20">
        {/* Left Column - Intro/Photos (Desktop) */}
        <div className="hidden lg:block lg:col-span-5 space-y-4">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <h2 className="text-lg font-black text-slate-900 mb-6 flex items-center gap-2">
              <Info className="w-5 h-5 text-nexus-blue" />
              Apresentação
            </h2>
            <div className="space-y-4 text-sm text-slate-600">
              {profile?.occupation && (
                <div className="flex items-center gap-3">
                  <Briefcase className="w-5 h-5 text-slate-400" />
                  <span>Trabalha como <span className="font-bold text-slate-900">{profile.occupation}</span></span>
                </div>
              )}
              {profile?.city && (
                <div className="flex items-center gap-3">
                  <MapPin className="w-5 h-5 text-slate-400" />
                  <span>Mora em <span className="font-bold text-slate-900">{profile.city}</span></span>
                </div>
              )}
              {profile?.nationality && (
                <div className="flex items-center gap-3">
                  <Globe className="w-5 h-5 text-slate-400" />
                  <span>De <span className="font-bold text-slate-900">{getNationalityLabel(profile.nationality)}</span></span>
                </div>
              )}
              {profile?.relationship && (
                <div className="flex items-center gap-3">
                  <Heart className="w-5 h-5 text-slate-400" />
                  <span><span className="font-bold text-slate-900">{getRelationshipLabel(profile.relationship)}</span></span>
                </div>
              )}
              {age !== null && (
                <div className="flex items-center gap-3">
                  <Calendar className="w-5 h-5 text-slate-400" />
                  <span>Idade: <span className="font-bold text-slate-900">{age} anos</span></span>
                </div>
              )}
              {profile?.gender && (
                <div className="flex items-center gap-3">
                  <UserIcon className="w-5 h-5 text-slate-400" />
                  <span>Gênero: <span className="font-bold text-slate-900">{genderMap[profile.gender] || profile.gender}</span></span>
                </div>
              )}
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-slate-400" />
                <span>Membro desde <span className="font-bold text-slate-900">{joinedDate}</span></span>
              </div>
            </div>
            {isOwnProfile && (
              <button onClick={onEdit} className="w-full mt-8 bg-slate-50 hover:bg-slate-100 text-slate-700 py-3 rounded-xl font-bold transition-all border border-slate-200">
                Editar Detalhes
              </button>
            )}
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-black text-slate-900">Fotos</h2>
              <button className="text-nexus-blue text-sm font-bold hover:underline">Ver todas</button>
            </div>
            <div className="grid grid-cols-3 gap-2 rounded-xl overflow-hidden">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <img 
                  key={`user-photo-${i}`} 
                  src={`https://picsum.photos/seed/${username}-photo-${i}/200/200`} 
                  alt="Photo" 
                  className="aspect-square object-cover hover:opacity-80 cursor-pointer transition-all border border-slate-100"
                />
              ))}
            </div>
          </div>
        </div>

        {/* Right Column - Posts */}
        <div className="lg:col-span-7 space-y-4">
          {activeTab === 'posts' ? (
            <>
              {loading ? (
                <div className="flex justify-center p-12">
                  <div className="w-8 h-8 border-4 border-nexus-blue/20 border-t-nexus-blue rounded-full animate-spin"></div>
                </div>
              ) : posts.length > 0 ? (
                posts.map((post) => (
                  <PostCard 
                    key={post.id} 
                    {...post}
                    onDelete={() => setPosts(prev => prev.filter(p => p.id !== post.id))}
                  />
                ))
              ) : (
                <div className="bg-white rounded-2xl p-12 text-center border border-slate-100 shadow-sm">
                  <ImageIcon className="w-16 h-16 text-slate-200 mx-auto mb-4" />
                  <p className="text-slate-400 font-black uppercase tracking-widest text-sm">Nenhuma publicação ainda</p>
                </div>
              )}
            </>
          ) : (
            <div className="bg-white rounded-2xl p-12 text-center border border-slate-100 shadow-sm">
              <p className="text-slate-500 font-bold">Esta seção está em desenvolvimento.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
