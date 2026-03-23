import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { dataService } from '../services/dataService';
import { supabase } from '../services/supabaseClient';
import { Post as PostType, AlbumItem } from '../types';
import PostCard from './PostCard';
import HighlightViewer from './HighlightViewer';
import { motion, AnimatePresence } from 'motion/react';
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
  UserSquare,
  Moon,
  Sun,
  Upload,
  Trash2,
  Sparkles,
  X,
  Crown,
  GripVertical,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import { nationalities, relationships } from './UserProfile';

interface UserProfileViewProps {
  onEdit: () => void;
  userId?: string;
  onSendMessage?: (userId: string) => void;
}

const ALBUM_MAX_ITEMS = 10;
const PREMIUM_MAGAZINE_TITLES = [
  'Edição de Ouro',
  'Style & Power',
  'Iconic Moments',
  'Legendary Mood',
  'Spotlight Issue',
  'Vibe de Elite',
  'Urban Prestige',
  'Collection Prime',
];

export default function UserProfileView({ onEdit, userId, onSendMessage }: UserProfileViewProps) {
  const { profile: currentUserProfile, user: currentUser } = useAuth();
  const { isDark, mode, toggleMode, isSavingTheme } = useTheme();
  const [profile, setProfile] = useState<any>(null);
  const [posts, setPosts] = useState<PostType[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'posts' | 'about' | 'friends' | 'photos'>('posts');
  const [highlights, setHighlights] = useState<any[]>([]);
  const [showHighlightModal, setShowHighlightModal] = useState(false);
  const [newHighlight, setNewHighlight] = useState({ title: '', cover_url: '' });
  const [uploading, setUploading] = useState(false);
  const [savingHighlight, setSavingHighlight] = useState(false);
  const [viewingHighlight, setViewingHighlight] = useState<{ id: string; canManage: boolean } | null>(null);
  const [editingHighlight, setEditingHighlight] = useState<any>(null);
  const [albumItems, setAlbumItems] = useState<AlbumItem[]>([]);
  const [albumUploading, setAlbumUploading] = useState(false);
  const [albumError, setAlbumError] = useState<string | null>(null);
  const [selectedAlbumItem, setSelectedAlbumItem] = useState<AlbumItem | null>(null);
  const [isAlbumManageMode, setIsAlbumManageMode] = useState(false);
  const [draggedAlbumItemId, setDraggedAlbumItemId] = useState<number | null>(null);
  const [dragOverAlbumItemId, setDragOverAlbumItemId] = useState<number | null>(null);
  const [dragPointer, setDragPointer] = useState<{ x: number; y: number } | null>(null);
  const [albumSavingLayout, setAlbumSavingLayout] = useState(false);

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

        const [userPosts, stats, userHighlights, userAlbumItems] = await Promise.all([
          dataService.getUserPosts(targetUserId),
          dataService.getProfileStats(targetUserId),
          dataService.getHighlights(targetUserId),
          dataService.getUserAlbumItems(targetUserId),
        ]);
        
        setPosts(userPosts);
        setProfile(prev => ({ ...prev, ...stats }));
        setHighlights(userHighlights);
        setAlbumItems(userAlbumItems);
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
  const [showOwnProfileMenu, setShowOwnProfileMenu] = useState(false);
  const [modalState, setModalState] = useState<{ isOpen: boolean, title: string, message: string, type: 'alert' | 'confirm', onConfirm?: () => void }>({
    isOpen: false, title: '', message: '', type: 'alert'
  });
  const dropdownRef = useRef<HTMLDivElement>(null);
  const ownProfileMenuRef = useRef<HTMLDivElement>(null);
  const albumUploadInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
      if (ownProfileMenuRef.current && !ownProfileMenuRef.current.contains(event.target as Node)) {
        setShowOwnProfileMenu(false);
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

  const getAlbumTileClass = (index: number, total: number) => {
    if (index === 0) return 'col-span-2 md:col-span-2 row-span-2';
    if (total <= 3) return 'col-span-1 row-span-2';
    if (index % 5 === 1) return 'col-span-1 row-span-2';
    if (index % 5 === 4) return 'col-span-1 row-span-2';
    return 'col-span-1 row-span-1';
  };

  const refreshAlbumItems = async () => {
    const targetUserId = userId || currentUser?.id;
    if (!targetUserId) return;
    const updated = await dataService.getUserAlbumItems(targetUserId);
    setAlbumItems(updated);
  };

  const handleAlbumUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!isOwnProfile || !currentUser?.id || !event.target.files?.length) return;

    setAlbumError(null);
    const allFiles = Array.from(event.target.files as FileList) as File[];
    const remainingSlots = ALBUM_MAX_ITEMS - albumItems.length;

    if (remainingSlots <= 0) {
      setAlbumError('Seu álbum já atingiu o limite de 10 itens.');
      event.target.value = '';
      return;
    }

    const filesToUpload = allFiles.slice(0, remainingSlots);
    setAlbumUploading(true);

    try {
      for (const file of filesToUpload) {
        const uploadResult = await dataService.uploadAlbumMedia(file, currentUser.id);
        if (!uploadResult?.url) {
          throw new Error('Falha ao enviar mídia do álbum.');
        }

        await dataService.createUserAlbumItem(currentUser.id, {
          mediaUrl: uploadResult.url,
          mediaType: uploadResult.mediaType,
        });
      }

      if (allFiles.length > filesToUpload.length) {
        setAlbumError(`Apenas ${filesToUpload.length} ficheiro(s) foram enviados. Limite total: 10 itens.`);
      }

      await refreshAlbumItems();
    } catch (error: any) {
      console.error('Erro ao enviar mídia para o álbum:', error);
      setAlbumError(error?.message || 'Não foi possível enviar o álbum agora.');
    } finally {
      setAlbumUploading(false);
      event.target.value = '';
    }
  };

  const handleDeleteAlbumItem = async (itemId: number) => {
    if (!currentUser?.id) return;
    const confirmed = window.confirm('Excluir este item do álbum?');
    if (!confirmed) return;

    try {
      await dataService.deleteUserAlbumItem(itemId, currentUser.id);
      setAlbumItems((prev) => prev.filter((item) => item.id !== itemId));
      if (selectedAlbumItem?.id === itemId) {
        setSelectedAlbumItem(null);
      }
    } catch (error) {
      console.error('Erro ao excluir item do álbum:', error);
      setAlbumError('Não foi possível excluir este item.');
    }
  };

  const getSortedAlbumIds = (items: AlbumItem[]) => {
    return items.map((item) => item.id);
  };

  const persistAlbumOrder = async (nextItems: AlbumItem[]) => {
    if (!currentUser?.id || !isOwnProfile) return;
    const orderedIds = getSortedAlbumIds(nextItems);
    setAlbumSavingLayout(true);
    try {
      await dataService.reorderUserAlbumItems(currentUser.id, orderedIds);
    } catch (error) {
      console.error('Erro ao salvar ordem do álbum:', error);
      setAlbumError('Não foi possível salvar a ordem do álbum.');
      await refreshAlbumItems();
    } finally {
      setAlbumSavingLayout(false);
    }
  };

  const handleSetAlbumCover = async (itemId: number) => {
    if (!currentUser?.id || !isOwnProfile) return;
    setAlbumSavingLayout(true);
    setAlbumError(null);
    try {
      await dataService.setUserAlbumCover(currentUser.id, itemId);
      await refreshAlbumItems();
    } catch (error) {
      console.error('Erro ao definir capa do álbum:', error);
      setAlbumError('Não foi possível definir esta mídia como capa.');
    } finally {
      setAlbumSavingLayout(false);
    }
  };

  const handleMoveAlbumItem = async (itemId: number, direction: 'up' | 'down') => {
    const coverItem = albumItems[0];
    const tail = albumItems.slice(1);
    const currentIndex = tail.findIndex((item) => item.id === itemId);
    if (currentIndex < 0) return;

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= tail.length) return;

    const reorderedTail = [...tail];
    const [moved] = reorderedTail.splice(currentIndex, 1);
    reorderedTail.splice(targetIndex, 0, moved);

    const nextItems = coverItem ? [coverItem, ...reorderedTail] : reorderedTail;
    setAlbumItems(nextItems);
    await persistAlbumOrder(nextItems);
  };

  const handleAlbumDragStart = (itemId: number, event: React.DragEvent<HTMLButtonElement>) => {
    setDraggedAlbumItemId(itemId);
    setDragPointer({ x: event.clientX, y: event.clientY });
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', String(itemId));
  };

  const handleAlbumDragOver = (event: React.DragEvent<HTMLButtonElement>, targetItemId?: number) => {
    event.preventDefault();
    setDragPointer({ x: event.clientX, y: event.clientY });
    if (typeof targetItemId === 'number') {
      setDragOverAlbumItemId(targetItemId);
    }
  };

  const handleAlbumDrop = async (targetItemId: number) => {
    if (!draggedAlbumItemId || draggedAlbumItemId === targetItemId) return;

    const coverItem = albumItems[0];
    const tail = albumItems.slice(1);
    const fromIndex = tail.findIndex((item) => item.id === draggedAlbumItemId);
    const toIndex = tail.findIndex((item) => item.id === targetItemId);
    if (fromIndex < 0 || toIndex < 0) return;

    const reorderedTail = [...tail];
    const [moved] = reorderedTail.splice(fromIndex, 1);
    reorderedTail.splice(toIndex, 0, moved);

    const nextItems = coverItem ? [coverItem, ...reorderedTail] : reorderedTail;
    setAlbumItems(nextItems);
    setDraggedAlbumItemId(null);
    setDragOverAlbumItemId(null);
    setDragPointer(null);
    await persistAlbumOrder(nextItems);
  };

  const handleAlbumDragEnd = () => {
    setDraggedAlbumItemId(null);
    setDragOverAlbumItemId(null);
    setDragPointer(null);
  };

  const coverAlbumItem = albumItems[0] || null;
  const nonCoverAlbumItems = albumItems.slice(1);
  const draggedAlbumItem = draggedAlbumItemId
    ? nonCoverAlbumItems.find((item) => item.id === draggedAlbumItemId) || null
    : null;
  const premiumCoverTitle = coverAlbumItem
    ? PREMIUM_MAGAZINE_TITLES[Math.abs(coverAlbumItem.id) % PREMIUM_MAGAZINE_TITLES.length]
    : 'Edição Premium';
  const premiumCoverIssue = coverAlbumItem
    ? new Date(coverAlbumItem.created_at).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    : '';

  return (
    <div className={`w-full max-w-4xl mx-auto pb-24 ${isDark ? 'profile-dark-moody' : ''}`}>
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
      <div className={`overflow-hidden shadow-sm border-b ${isDark ? 'bg-slate-900/75 border-slate-700/40 backdrop-blur-xl' : 'bg-white border-slate-100'}`}>
        {/* Cover Photo */}
        <div className={`h-[30vh] md:h-[45vh] relative group overflow-hidden ${isDark ? 'bg-slate-900' : 'bg-slate-100'}`}>
          {coverUrl ? (
            <img src={coverUrl} alt="Cover" className="w-full h-full object-cover" />
          ) : (
            <div className={`w-full h-full ${isDark ? 'bg-gradient-to-br from-[#101b35] via-[#0f172a] to-[#060b17]' : 'bg-gradient-to-r from-nexus-blue to-indigo-900'}`} />
          )}
          {isDark && <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/20 to-[#020617]/85 pointer-events-none" />}
          
          {isOwnProfile && (
            <button onClick={onEdit} className={`absolute bottom-4 right-4 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-bold transition-all backdrop-blur-sm opacity-0 group-hover:opacity-100 z-10 ${isDark ? 'bg-slate-900/55 hover:bg-slate-900/75 border border-white/15' : 'bg-black/50 hover:bg-black/70'}`}>
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
              {isDark && (
                <>
                  <div className="absolute -inset-[4px] rounded-full bg-gradient-to-br from-[#f8e6b0] via-[#d7bb76] to-[#8a6a2b] shadow-[0_0_28px_rgba(215,187,118,0.38)]" />
                  <div className="absolute -inset-[1px] rounded-full border border-white/35 pointer-events-none" />
                </>
              )}
              <div className={`relative w-28 h-28 md:w-40 md:h-40 rounded-full border-4 overflow-hidden ${isDark ? 'border-[#d7bb76] shadow-[0_0_0_3px_rgba(15,23,42,0.9),0_14px_40px_rgba(0,0,0,0.55)] bg-slate-900' : 'border-white shadow-lg bg-slate-100'}`}>
                <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
              </div>
              {isOwnProfile && (
                <button 
                  onClick={onEdit} 
                  className={`absolute bottom-1 right-1 p-2 rounded-full shadow-md border-2 transition-all transform hover:scale-110 active:scale-95 ${isDark ? 'bg-[#c5a059] hover:bg-[#b5904c] border-[#0f172a]' : 'bg-nexus-blue hover:bg-blue-700 border-white'}`}
                  title="Alterar Foto de Perfil"
                >
                  <Camera className={`w-4 h-4 ${isDark ? 'text-[#0f172a]' : 'text-white'}`} />
                </button>
              )}
            </div>

            {/* Name and Username - Left Aligned */}
            <div className="flex-1 pb-1 mt-3 md:mt-0">
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <h1 className={`text-2xl md:text-3xl font-black tracking-tight ${isDark ? 'text-slate-100 drop-shadow-[0_2px_6px_rgba(0,0,0,0.35)]' : 'text-slate-900'}`}>{displayName}</h1>
                  {profile?.role === 'admin' && (
                    <span className={`text-[9px] font-black px-2.5 py-0.5 rounded-md uppercase tracking-widest shadow-sm border ${isDark ? 'bg-gradient-to-r from-[#f8e6b0] to-[#d7bb76] text-[#1e293b] border-[#b8934f]' : 'bg-nexus-blue text-white border-transparent'}`}>
                      Admin
                    </span>
                  )}
                </div>
                <p className={`font-medium text-base md:text-lg ${isDark ? 'text-slate-300/95' : 'text-slate-500'}`}>@{username}</p>
              </div>
            </div>
          </div>

          {/* Action Buttons - Centered on mobile, Right on desktop */}
          <div className="flex justify-center md:justify-start mt-6 gap-2">
            {isOwnProfile ? (
              <div className="flex gap-2 w-full md:w-auto">
                <button 
                  onClick={onEdit}
                  className={`flex-1 md:flex-none px-6 py-2 rounded-lg font-bold flex items-center justify-center gap-2 transition-all text-sm border shadow-sm ${isDark ? 'bg-slate-900/55 hover:bg-slate-900/70 text-slate-100 border-[#d7bb76]/45 backdrop-blur-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_10px_26px_rgba(2,6,23,0.45)]' : 'bg-slate-100 hover:bg-slate-200 text-slate-900 border-slate-200'}`}
                >
                  {isDark ? (
                    <span className="w-5 h-5 rounded-full bg-[#d7bb76]/20 border border-[#d7bb76]/45 inline-flex items-center justify-center">
                      <Edit3 className="w-3.5 h-3.5 text-[#f3dd9b]" />
                    </span>
                  ) : (
                    <Edit3 className="w-4 h-4" />
                  )}
                  Editar Perfil
                </button>
                <div className="relative" ref={ownProfileMenuRef}>
                  <button
                    onClick={() => setShowOwnProfileMenu((prev) => !prev)}
                    className={`p-2 rounded-lg transition-all border shadow-sm ${isDark ? 'bg-slate-900/55 hover:bg-slate-900/70 text-slate-100 border-[#d7bb76]/40 backdrop-blur-xl' : 'bg-slate-100 hover:bg-slate-200 text-slate-900 border-slate-200'}`}
                    title="Mais opções"
                  >
                    <MoreHorizontal className="w-5 h-5" />
                  </button>

                  {showOwnProfileMenu && (
                    <div className={`absolute right-0 mt-2 w-56 rounded-xl shadow-xl overflow-hidden z-50 ${isDark ? 'bg-slate-900/95 border border-white/15 backdrop-blur-2xl' : 'bg-white border border-slate-100'}`}>
                      <button
                        onClick={async () => {
                          await toggleMode();
                          setShowOwnProfileMenu(false);
                        }}
                        disabled={isSavingTheme}
                        className={`w-full text-left px-4 py-3 text-sm font-medium transition-colors flex items-center justify-between gap-3 disabled:opacity-60 ${isDark ? 'text-slate-100 hover:bg-white/10' : 'text-slate-700 hover:bg-slate-50'}`}
                      >
                        <span className="inline-flex items-center gap-2">
                          {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-nexus-blue" />}
                          {isDark ? 'Mudar para modo claro' : 'Mudar para modo escuro'}
                        </span>
                        {isSavingTheme ? (
                          <div className={`w-4 h-4 border-2 rounded-full animate-spin ${isDark ? 'border-slate-500 border-t-slate-100' : 'border-slate-300 border-t-slate-500'}`} />
                        ) : (
                          <span className={`text-[11px] font-bold uppercase ${isDark ? 'text-slate-300' : 'text-slate-400'}`}>{mode}</span>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <>
                <button 
                  onClick={handleAddFriend}
                  disabled={isAddingFriend || !!friendshipStatus}
                  className={`${
                    isAddingFriend || !!friendshipStatus
                      ? isDark
                        ? 'bg-white/10 text-slate-400 cursor-not-allowed border border-white/15'
                        : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                      : isDark
                        ? 'bg-gradient-to-r from-[#24406e] to-[#1d4e89] hover:from-[#2f4f86] hover:to-[#2360a8] text-white border border-white/15'
                        : 'bg-nexus-blue hover:bg-blue-700 text-white'
                  } px-6 py-2 rounded-lg font-bold flex items-center gap-2 transition-all text-sm shadow-md ${isDark ? 'backdrop-blur-xl' : ''}`}
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
                    className={`px-6 py-2 rounded-lg font-bold flex items-center gap-2 transition-all text-sm border ${isDark ? 'bg-white/10 hover:bg-white/15 text-slate-100 border-white/20 backdrop-blur-xl' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'}`}
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
                  className={`p-2 rounded-lg transition-all border ${isDark ? 'bg-white/10 hover:bg-white/15 text-slate-100 border-white/20 backdrop-blur-xl' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'}`}
                >
                  <MoreHorizontal className="w-5 h-5" />
                </button>
                
                {showDropdown && (
                  <div className={`absolute right-0 mt-2 w-48 rounded-xl shadow-xl overflow-hidden z-50 ${isDark ? 'bg-slate-900/95 border border-white/15 backdrop-blur-2xl' : 'bg-white border border-slate-100'}`}>
                    {friendshipStatus?.status === 'accepted' && (
                      <button 
                        onClick={handleRemoveFriend}
                        className={`w-full text-left px-4 py-3 text-sm text-red-500 font-medium transition-colors ${isDark ? 'hover:bg-white/10' : 'hover:bg-slate-50'}`}
                      >
                        Remover Amigo
                      </button>
                    )}
                    {friendshipStatus?.status !== 'blocked' && (
                      <button 
                        onClick={handleBlockUser}
                        className={`w-full text-left px-4 py-3 text-sm text-red-500 font-medium transition-colors border-t ${isDark ? 'hover:bg-white/10 border-white/10' : 'hover:bg-slate-50 border-slate-100'}`}
                      >
                        Bloquear Usuário
                      </button>
                    )}
                    {friendshipStatus?.status === 'blocked' && (
                      <button 
                        onClick={handleRemoveFriend}
                        className={`w-full text-left px-4 py-3 text-sm font-medium transition-colors ${isDark ? 'text-slate-100 hover:bg-white/10' : 'text-slate-700 hover:bg-slate-50'}`}
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
            {isDark ? (
              <div className="grid grid-cols-3 gap-2 md:gap-3 py-5 border-y border-white/10">
                {[
                  { value: profile?.posts_count || 0, label: 'Publicações' },
                  { value: profile?.followers_count || 0, label: 'Seguidores' },
                  { value: profile?.following_count || 0, label: 'A seguir' },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-2xl px-3 py-3.5 text-center bg-gradient-to-b from-white/15 to-white/6 border border-white/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_8px_24px_rgba(2,6,23,0.35)] backdrop-blur-xl"
                  >
                    <p className="font-black text-2xl text-[#f3dd9b] leading-none">{item.value}</p>
                    <p className="text-[9px] mt-2 uppercase tracking-[0.16em] text-slate-300 font-black">{item.label}</p>
                  </div>
                ))}
              </div>
            ) : (
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
            )}

            <p className={`max-w-2xl whitespace-pre-wrap text-left mt-6 leading-relaxed text-sm md:text-base ${isDark ? 'text-slate-200/95' : 'text-slate-600'}`}>
              {bio}
            </p>

            <div className={`mt-4 flex flex-wrap justify-center md:justify-start gap-3 text-sm font-medium ${isDark ? 'text-slate-300' : 'text-slate-400'}`}>
              {profile?.nationality && (
                <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full ${isDark ? 'bg-white/10 border border-white/15' : ''}`}>
                  <Globe className="w-4 h-4" />
                  {getNationalityLabel(profile.nationality)}
                </div>
              )}
              {profile?.city && (
                <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full ${isDark ? 'bg-white/10 border border-white/15' : ''}`}>
                  <MapPin className="w-4 h-4" />
                  {profile.city}
                </div>
              )}
              {profile?.occupation && (
                <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full ${isDark ? 'bg-white/10 border border-white/15' : ''}`}>
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
                    className={`w-16 h-16 rounded-full border-2 border-dashed flex items-center justify-center transition-colors shadow-sm ${isDark ? 'border-white/25 hover:bg-white/10 bg-white/10' : 'border-slate-200 hover:bg-slate-50 bg-white'}`}
                  >
                    <Plus className="w-6 h-6 text-slate-400" />
                  </button>
                  <span className={`text-[10px] font-black uppercase tracking-widest ${isDark ? 'text-slate-300' : 'text-slate-500'}`}>Novo</span>
                </div>
              )}
              {highlights.map((highlight) => {
                const canManageHighlight = isOwnProfile || highlight.user_id === currentUser?.id;
                return (
                <div 
                  key={highlight.id} 
                  className="flex flex-col items-center gap-2 min-w-[70px] cursor-pointer group"
                >
                  <div 
                    className={`w-16 h-16 rounded-full border-2 p-0.5 relative shadow-sm transition-transform group-hover:scale-105 ${isDark ? 'border-[#d7bb76] bg-slate-900/80' : 'border-nexus-blue bg-white'}`}
                    onClick={() => setViewingHighlight({ id: highlight.id, canManage: canManageHighlight })}
                  >
                    <div className={`w-full h-full rounded-full overflow-hidden border-2 ${isDark ? 'border-slate-800' : 'border-white'}`}>
                      <img src={highlight.cover_url} alt={highlight.title} className="w-full h-full object-cover" />
                    </div>
                  </div>
                  <span className={`text-[10px] font-black uppercase tracking-widest truncate w-full text-center ${isDark ? 'text-slate-200' : 'text-slate-600'}`} onClick={() => setViewingHighlight({ id: highlight.id, canManage: canManageHighlight })}>{highlight.title}</span>
                  {isOwnProfile && (
                    <button 
                      onClick={() => setEditingHighlight(highlight)}
                      className={`text-[9px] font-black uppercase tracking-tighter hover:underline ${isDark ? 'text-[#d7bb76]' : 'text-nexus-blue'}`}
                    >
                      Editar
                    </button>
                  )}
                </div>
              )})}
            </div>

            {/* Highlight Viewer */}
            {viewingHighlight && (
              <HighlightViewer 
                highlightId={viewingHighlight.id} 
                isOwnProfile={viewingHighlight.canManage}
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
          <div className={`mt-8 flex border-t ${isDark ? 'border-white/10' : 'border-slate-100'}`}>
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
                  activeTab === tab.id
                    ? isDark
                      ? 'text-[#f3dd9b]'
                      : 'text-nexus-blue'
                    : isDark
                      ? 'text-slate-400 hover:text-slate-200'
                      : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                <span className="hidden sm:inline">{tab.label}</span>
                {activeTab === tab.id && (
                  <motion.div 
                    layoutId="activeProfileTab"
                    className={`absolute bottom-0 left-0 right-0 h-1 rounded-t-full ${isDark ? 'bg-[#d7bb76]' : 'bg-nexus-blue'}`}
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
          <div className={`rounded-2xl p-6 shadow-sm border ${isDark ? 'bg-white/10 backdrop-blur-xl border-white/15' : 'bg-white border-slate-100'}`}>
            <h2 className={`text-lg font-black mb-6 flex items-center gap-2 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
              <Info className={`w-5 h-5 ${isDark ? 'text-[#d7bb76]' : 'text-nexus-blue'}`} />
              Apresentação
            </h2>
            <div className={`space-y-4 text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
              {profile?.occupation && (
                <div className="flex items-center gap-3">
                  <Briefcase className={`w-5 h-5 ${isDark ? 'text-[#d7bb76]' : 'text-slate-400'}`} />
                  <span>Trabalha como <span className={`font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{profile.occupation}</span></span>
                </div>
              )}
              {profile?.city && (
                <div className="flex items-center gap-3">
                  <MapPin className={`w-5 h-5 ${isDark ? 'text-[#d7bb76]' : 'text-slate-400'}`} />
                  <span>Mora em <span className={`font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{profile.city}</span></span>
                </div>
              )}
              {profile?.nationality && (
                <div className="flex items-center gap-3">
                  <Globe className={`w-5 h-5 ${isDark ? 'text-[#d7bb76]' : 'text-slate-400'}`} />
                  <span>De <span className={`font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{getNationalityLabel(profile.nationality)}</span></span>
                </div>
              )}
              {profile?.relationship && (
                <div className="flex items-center gap-3">
                  <Heart className={`w-5 h-5 ${isDark ? 'text-[#d7bb76]' : 'text-slate-400'}`} />
                  <span><span className={`font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{getRelationshipLabel(profile.relationship)}</span></span>
                </div>
              )}
              {age !== null && (
                <div className="flex items-center gap-3">
                  <Calendar className={`w-5 h-5 ${isDark ? 'text-[#d7bb76]' : 'text-slate-400'}`} />
                  <span>Idade: <span className={`font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{age} anos</span></span>
                </div>
              )}
              {profile?.gender && (
                <div className="flex items-center gap-3">
                  <UserIcon className={`w-5 h-5 ${isDark ? 'text-[#d7bb76]' : 'text-slate-400'}`} />
                  <span>Gênero: <span className={`font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{genderMap[profile.gender] || profile.gender}</span></span>
                </div>
              )}
              <div className="flex items-center gap-3">
                <Calendar className={`w-5 h-5 ${isDark ? 'text-[#d7bb76]' : 'text-slate-400'}`} />
                <span>Membro desde <span className={`font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{joinedDate}</span></span>
              </div>
            </div>
            {isOwnProfile && (
              <button onClick={onEdit} className={`w-full mt-8 py-3 rounded-xl font-bold transition-all border ${isDark ? 'bg-white/10 hover:bg-white/15 text-slate-100 border-white/20 backdrop-blur-xl' : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'}`}>
                Editar Detalhes
              </button>
            )}
          </div>

          <div className={`rounded-2xl p-6 shadow-sm border ${isDark ? 'bg-white/10 backdrop-blur-xl border-white/15' : 'bg-white border-slate-100'}`}>
            <div className="flex items-center justify-between mb-6">
              <h2 className={`text-lg font-black ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>Fotos</h2>
              <button
                onClick={() => setActiveTab('photos')}
                className={`text-sm font-bold hover:underline ${isDark ? 'text-[#d7bb76]' : 'text-nexus-blue'}`}
              >
                Ver todas
              </button>
            </div>
            {albumItems.length > 0 ? (
              <div className="grid grid-cols-3 gap-2 rounded-xl overflow-hidden">
                {albumItems.slice(0, 6).map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab('photos');
                      setSelectedAlbumItem(item);
                    }}
                    className={`relative aspect-square overflow-hidden ${isDark ? 'border border-white/10' : 'border border-slate-100'}`}
                  >
                    {item.media_type === 'video' ? (
                      <>
                        <video
                          src={item.media_url}
                          muted
                          playsInline
                          preload="metadata"
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Play className="w-6 h-6 text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.7)] fill-white" />
                        </div>
                      </>
                    ) : (
                      <img src={item.media_url} alt="Álbum" className="w-full h-full object-cover" />
                    )}
                  </button>
                ))}
              </div>
            ) : (
              <div className={`rounded-xl p-5 text-center border ${isDark ? 'border-white/10 bg-white/5 text-slate-400' : 'border-slate-100 bg-slate-50 text-slate-500'}`}>
                Sem itens no álbum ainda.
              </div>
            )}
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
                <div className={`rounded-2xl p-12 text-center border shadow-sm ${isDark ? 'bg-white/10 border-white/15 backdrop-blur-xl' : 'bg-white border-slate-100'}`}>
                  <ImageIcon className={`w-16 h-16 mx-auto mb-4 ${isDark ? 'text-slate-600' : 'text-slate-200'}`} />
                  <p className={`font-black uppercase tracking-widest text-sm ${isDark ? 'text-slate-300' : 'text-slate-400'}`}>Nenhuma publicação ainda</p>
                </div>
              )}
            </>
          ) : activeTab === 'photos' ? (
            <div className={`rounded-2xl p-4 md:p-6 border shadow-sm ${isDark ? 'bg-white/10 border-white/15 backdrop-blur-xl' : 'bg-white border-slate-100'}`}>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div>
                  <h3 className={`text-lg font-black flex items-center gap-2 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                    <Sparkles className={`w-4 h-4 ${isDark ? 'text-[#d7bb76]' : 'text-nexus-blue'}`} />
                    Álbum Premium
                  </h3>
                  <p className={`text-xs mt-1 ${isDark ? 'text-slate-300' : 'text-slate-500'}`}>
                    Montagem automática personalizada • {albumItems.length}/{ALBUM_MAX_ITEMS} itens
                  </p>
                </div>

                {isOwnProfile && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setIsAlbumManageMode(true)}
                      disabled={albumItems.length <= 1}
                      className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border disabled:opacity-60 ${
                        isDark
                          ? 'bg-[#d7bb76]/15 hover:bg-[#d7bb76]/25 text-[#f3dd9b] border-[#d7bb76]/35'
                          : 'bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200'
                      }`}
                      title="Editar capa da revista"
                    >
                      <Crown className="w-3.5 h-3.5" />
                      Editar capa
                    </button>
                    <button
                      onClick={() => setIsAlbumManageMode((prev) => !prev)}
                      disabled={albumItems.length <= 1}
                      className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border disabled:opacity-60 ${isDark ? 'bg-white/10 hover:bg-white/15 text-slate-100 border-white/20' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'}`}
                    >
                      <GripVertical className="w-3.5 h-3.5" />
                      {isAlbumManageMode ? 'Concluir ordem' : 'Organizar'}
                    </button>
                    <input
                      ref={albumUploadInputRef}
                      type="file"
                      accept="image/*,video/*"
                      multiple
                      onChange={handleAlbumUpload}
                      className="hidden"
                    />
                    <button
                      onClick={() => albumUploadInputRef.current?.click()}
                      disabled={albumUploading || albumItems.length >= ALBUM_MAX_ITEMS}
                      className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold border transition-colors disabled:opacity-60 ${isDark ? 'bg-white/10 hover:bg-white/15 text-slate-100 border-white/20' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'}`}
                    >
                      {albumUploading ? (
                        <div className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                      ) : (
                        <Upload className="w-4 h-4" />
                      )}
                      {albumUploading ? 'Enviando...' : 'Adicionar mídia'}
                    </button>
                  </div>
                )}
              </div>

              {albumSavingLayout && (
                <div className={`mb-3 text-[11px] px-3 py-2 rounded-lg border inline-flex items-center gap-2 ${isDark ? 'bg-white/10 border-white/20 text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
                  <div className="w-3.5 h-3.5 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                  Salvando organização do álbum...
                </div>
              )}

              {!isAlbumManageMode && isOwnProfile && albumItems.length > 1 && (
                <div className={`mb-3 text-[11px] px-3 py-2 rounded-lg border ${isDark ? 'bg-white/10 border-white/20 text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
                  Dica: use <span className="font-bold">Editar capa</span> ou toque na <span className="font-bold">👑</span> das miniaturas para escolher a capa da revista.
                </div>
              )}

              {isAlbumManageMode && (
                <div className={`mb-3 text-[11px] px-3 py-2 rounded-lg border ${isDark ? 'bg-[#d7bb76]/10 border-[#d7bb76]/30 text-[#f3dd9b]' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>
                  Modo organizar ativo: arraste as miniaturas para reordenar e toque na 👑 para definir a nova capa.
                </div>
              )}

              {albumError && (
                <div className={`mb-3 text-xs px-3 py-2 rounded-lg border ${isDark ? 'bg-red-500/10 border-red-400/30 text-red-300' : 'bg-red-50 border-red-200 text-red-600'}`}>
                  {albumError}
                </div>
              )}

              {albumItems.length > 0 ? (
                <div className="space-y-3">
                  {coverAlbumItem && (
                    <div
                      className={`relative rounded-2xl p-[2px] ${
                        isDark
                          ? 'bg-gradient-to-br from-[#f6e0a1] via-[#d7bb76] to-[#6f5321]'
                          : 'bg-gradient-to-br from-amber-200 via-amber-300 to-orange-300'
                      }`}
                    >
                      <button
                        onClick={() => setSelectedAlbumItem(coverAlbumItem)}
                        className="relative w-full h-52 md:h-64 rounded-[14px] overflow-hidden border border-black/30"
                        style={coverAlbumItem.accent_color ? { boxShadow: `inset 0 0 0 1px ${coverAlbumItem.accent_color}66` } : undefined}
                      >
                        {coverAlbumItem.media_type === 'video' ? (
                          <video
                            src={coverAlbumItem.media_url}
                            muted
                            playsInline
                            preload="metadata"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <img src={coverAlbumItem.media_url} alt="Capa do álbum" className="w-full h-full object-cover" />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/10" />
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_0%,rgba(255,255,255,0.36),transparent_38%)]" />
                        <div className="absolute left-2 top-2 h-6 w-6 border-l-2 border-t-2 border-[#f3dd9b]/80 rounded-tl-md" />
                        <div className="absolute right-2 top-2 h-6 w-6 border-r-2 border-t-2 border-[#f3dd9b]/80 rounded-tr-md" />
                        <div className="absolute left-2 bottom-2 h-6 w-6 border-l-2 border-b-2 border-[#f3dd9b]/80 rounded-bl-md" />
                        <div className="absolute right-2 bottom-2 h-6 w-6 border-r-2 border-b-2 border-[#f3dd9b]/80 rounded-br-md" />

                        <div className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-[#d7bb76]/92 text-[#1e293b] px-2.5 py-1 text-[10px] font-black uppercase tracking-wider">
                          <Crown className="w-3 h-3" />
                          Capa atual
                        </div>

                        <div className="absolute left-3 right-3 top-11 text-left">
                          <p className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.24em] text-[#f7e7ba] drop-shadow-[0_1px_3px_rgba(0,0,0,0.7)]">
                            Amigos Magazine • Premium Cover
                          </p>
                          <p className="mt-1 text-xl md:text-2xl font-black uppercase tracking-[0.08em] text-white leading-[1.04] drop-shadow-[0_3px_10px_rgba(0,0,0,0.7)]">
                            {premiumCoverTitle}
                          </p>
                          <p className="mt-1 text-[10px] md:text-[11px] font-semibold uppercase tracking-[0.18em] text-white/80">
                            @{username} • {premiumCoverIssue}
                          </p>
                        </div>

                        <div className="absolute left-3 right-3 bottom-3 flex items-end justify-between gap-3">
                          <div className="text-left">
                            <p className="text-[11px] font-black text-white/95">Editorial Edition</p>
                            <p className="text-[10px] text-white/80">
                              {new Date(coverAlbumItem.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {coverAlbumItem.media_type === 'video' && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-black/45 px-2.5 py-1 text-[10px] font-bold text-white">
                                <Play className="w-3 h-3 fill-white" />
                                Vídeo
                              </span>
                            )}
                            {isOwnProfile && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-[#d7bb76]/85 text-[#1e293b] px-2.5 py-1 text-[10px] font-black uppercase tracking-wider">
                                <Crown className="w-3 h-3" />
                                Capa
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    </div>
                  )}

                  {!isAlbumManageMode && nonCoverAlbumItems.length > 0 && (
                    <div className="grid grid-cols-3 gap-2">
                      {nonCoverAlbumItems.slice(0, 3).map((item) => (
                        <button
                          key={`editorial-${item.id}`}
                          onClick={() => setSelectedAlbumItem(item)}
                          className={`relative h-24 md:h-28 rounded-xl overflow-hidden border ${isDark ? 'border-white/15' : 'border-slate-100'}`}
                        >
                          {item.media_type === 'video' ? (
                            <video src={item.media_url} muted playsInline preload="metadata" className="w-full h-full object-cover" />
                          ) : (
                            <img src={item.media_url} alt="Editorial" className="w-full h-full object-cover" />
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/55 to-transparent" />
                          <div className="absolute left-1.5 bottom-1.5 text-[9px] font-black uppercase tracking-wider text-white/90">
                            Editorial
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  <motion.div layout className="grid grid-cols-2 md:grid-cols-3 auto-rows-[110px] md:auto-rows-[130px] gap-2">
                    {(isAlbumManageMode ? nonCoverAlbumItems : nonCoverAlbumItems.slice(3)).map((item, index) => {
                      const absoluteIndex = albumItems.findIndex((albumItem) => albumItem.id === item.id);
                      return (
                      <motion.button
                        layout
                        key={item.id}
                        onClick={() => setSelectedAlbumItem(item)}
                        draggable={isAlbumManageMode}
                        onDragStart={(event) => handleAlbumDragStart(item.id, event)}
                        onDragOver={(event) => handleAlbumDragOver(event, item.id)}
                        onDragLeave={() => setDragOverAlbumItemId(null)}
                        onDrop={() => handleAlbumDrop(item.id)}
                        onDragEnd={handleAlbumDragEnd}
                        className={`relative overflow-hidden rounded-2xl border transition-all duration-200 ${
                          isDark ? 'border-white/15' : 'border-slate-100'
                        } ${getAlbumTileClass(index, Math.max(1, albumItems.length - 1))} ${
                          draggedAlbumItemId === item.id ? 'opacity-30 scale-95 rotate-[1deg]' : ''
                        } ${
                          dragOverAlbumItemId === item.id && draggedAlbumItemId !== item.id
                            ? isDark
                              ? 'ring-2 ring-[#d7bb76]/80 ring-offset-2 ring-offset-[#0f172a]'
                              : 'ring-2 ring-nexus-blue/70 ring-offset-2 ring-offset-white'
                            : ''
                        }`}
                        style={item.accent_color ? { boxShadow: `inset 0 0 0 1px ${item.accent_color}55` } : undefined}
                        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                      >
                        {item.media_type === 'video' ? (
                          <video
                            src={item.media_url}
                            muted
                            playsInline
                            preload="metadata"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <img src={item.media_url} alt="Álbum" className="w-full h-full object-cover" />
                        )}

                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/10" />

                        <div className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/45 px-2 py-1 text-[10px] text-white font-bold">
                          {item.media_type === 'video' ? (
                            <>
                              <Play className="w-3 h-3 fill-white" />
                              Vídeo
                            </>
                          ) : (
                            'Foto'
                          )}
                        </div>

                        {isOwnProfile && (
                          <div className="absolute right-2 top-2 flex items-center gap-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSetAlbumCover(item.id);
                              }}
                              disabled={albumSavingLayout}
                              className="p-1.5 rounded-full bg-gradient-to-br from-[#f6e0a1] to-[#d7bb76] text-[#1e293b] hover:from-[#f8e6b0] hover:to-[#dcbf79] shadow-[0_0_0_1px_rgba(15,23,42,0.4)] disabled:opacity-60"
                              title="Definir como capa"
                            >
                              <Crown className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteAlbumItem(item.id);
                              }}
                              className="p-1.5 rounded-full bg-black/55 text-white hover:bg-black/75"
                              title="Excluir item"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}

                        <div className="absolute left-2 right-2 bottom-2 flex items-center justify-between">
                          <span className="text-[10px] font-bold text-white/90">
                            #{absoluteIndex + 1}
                          </span>
                          <span className="text-[10px] font-semibold text-white/80">
                            {new Date(item.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                          </span>
                        </div>

                        {isAlbumManageMode && (
                          <div className="absolute left-2 top-2 flex items-center gap-1">
                            <span className="p-1 rounded-full bg-black/45 text-white">
                              <GripVertical className="w-3 h-3" />
                            </span>
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                await handleMoveAlbumItem(item.id, 'up');
                              }}
                              className="p-1 rounded-full bg-black/45 text-white"
                              title="Subir"
                            >
                              <ArrowUp className="w-3 h-3" />
                            </button>
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                await handleMoveAlbumItem(item.id, 'down');
                              }}
                              className="p-1 rounded-full bg-black/45 text-white"
                              title="Descer"
                            >
                              <ArrowDown className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </motion.button>
                    )})}

                    {isOwnProfile && albumItems.length < ALBUM_MAX_ITEMS && (
                      <motion.button
                        layout
                        onClick={() => albumUploadInputRef.current?.click()}
                        className={`rounded-2xl border-2 border-dashed transition-colors flex flex-col items-center justify-center gap-1 ${isDark ? 'border-white/25 bg-white/5 hover:bg-white/10 text-slate-200' : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600'}`}
                      >
                        <Plus className="w-5 h-5" />
                        <span className="text-[11px] font-bold">Adicionar</span>
                      </motion.button>
                    )}
                  </motion.div>
                </div>
              ) : (
                <div className={`rounded-2xl border p-10 text-center ${isDark ? 'border-white/15 bg-white/5 text-slate-300' : 'border-slate-100 bg-slate-50 text-slate-500'}`}>
                  <Sparkles className={`w-8 h-8 mx-auto mb-3 ${isDark ? 'text-[#d7bb76]' : 'text-nexus-blue'}`} />
                  <p className="text-sm font-bold">Seu álbum premium ainda está vazio.</p>
                  <p className="text-xs mt-1 opacity-80">
                    Carregue fotos e vídeos para gerar uma montagem automática personalizada.
                  </p>
                  {isOwnProfile && (
                    <button
                      onClick={() => albumUploadInputRef.current?.click()}
                      className={`mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold border ${isDark ? 'bg-white/10 hover:bg-white/15 text-slate-100 border-white/20' : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'}`}
                    >
                      <Upload className="w-4 h-4" />
                      Enviar primeira mídia
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className={`rounded-2xl p-12 text-center border shadow-sm ${isDark ? 'bg-white/10 border-white/15 backdrop-blur-xl' : 'bg-white border-slate-100'}`}>
              <p className={`font-bold ${isDark ? 'text-slate-300' : 'text-slate-500'}`}>Esta seção está em desenvolvimento.</p>
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {isAlbumManageMode && draggedAlbumItem && dragPointer && (
          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 0.95, scale: 1 }}
            exit={{ opacity: 0, scale: 0.92 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            className="fixed pointer-events-none z-[140] w-32 h-32 rounded-2xl overflow-hidden border border-white/35 shadow-[0_20px_35px_rgba(2,6,23,0.55)]"
            style={{
              left: dragPointer.x - 64,
              top: dragPointer.y - 72,
            }}
          >
            {draggedAlbumItem.media_type === 'video' ? (
              <video
                src={draggedAlbumItem.media_url}
                muted
                playsInline
                preload="metadata"
                className="w-full h-full object-cover"
              />
            ) : (
              <img src={draggedAlbumItem.media_url} alt="Prévia arraste" className="w-full h-full object-cover" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/5 to-transparent" />
            <div className="absolute left-2 bottom-2 inline-flex items-center gap-1 px-2 py-1 rounded-full bg-black/45 text-white text-[10px] font-bold">
              <GripVertical className="w-3 h-3" />
              A mover
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {selectedAlbumItem && (
        <div
          className="fixed inset-0 z-[130] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setSelectedAlbumItem(null)}
        >
          <div
            className="relative w-full max-w-3xl rounded-2xl overflow-hidden border border-white/20 bg-black"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setSelectedAlbumItem(null)}
              className="absolute top-3 right-3 z-10 p-2 rounded-full bg-black/55 text-white hover:bg-black/75"
            >
              <X className="w-5 h-5" />
            </button>
            {selectedAlbumItem.media_type === 'video' ? (
              <video
                src={selectedAlbumItem.media_url}
                controls
                autoPlay
                playsInline
                className="w-full max-h-[82vh] object-contain bg-black"
              />
            ) : (
              <img
                src={selectedAlbumItem.media_url}
                alt="Mídia do álbum"
                className="w-full max-h-[82vh] object-contain bg-black"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
