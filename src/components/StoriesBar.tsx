import { useState, useEffect, useRef, ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, ChevronLeft, ChevronRight, Type, Palette, MapPin, Music, X } from 'lucide-react';
import { dataService } from '../services/dataService';
import { Story, Profile } from '../types';
import { supabase } from '../services/supabaseClient';
import StoryViewer from './StoryViewer';

export default function StoriesBar() {
  const [stories, setStories] = useState<Story[]>([]);
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [selectedUserStories, setSelectedUserStories] = useState<Story[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [storyForm, setStoryForm] = useState({
    caption: '',
    textColor: '#ffffff',
    textFont: 'inherit',
    locationName: '',
    musicTitle: '',
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchStories();
    fetchCurrentUser();

    const subscription = supabase
      .channel('stories_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stories' }, () => {
        fetchStories();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const fetchStories = async () => {
    const data = await dataService.getStories();
    setStories(data);
  };

  const fetchCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (profile) {
        setCurrentUser(profile);
      } else {
        // Fallback para não bloquear postagem de story caso o select do profile falhe.
        setCurrentUser({
          id: user.id,
          username: user.user_metadata?.username || user.email?.split('@')[0] || 'usuario',
          first_name: user.user_metadata?.first_name || '',
          last_name: user.user_metadata?.last_name || '',
          avatar_url: user.user_metadata?.avatar_url || '',
        } as Profile);
      }
    }
  };

  const resetStoryComposer = () => {
    setSelectedFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    setStoryForm({
      caption: '',
      textColor: '#ffffff',
      textFont: 'inherit',
      locationName: '',
      musicTitle: '',
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSelectStoryMedia = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handlePublishStory = async () => {
    if (!selectedFile) return;

    setUploading(true);
    setUploadError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const userId = currentUser?.id || user?.id;
      if (!userId) {
        throw new Error('Usuário não autenticado para criar story.');
      }

      const mediaUrl = await dataService.uploadStoryMedia(selectedFile);
      if (!mediaUrl) {
        throw new Error('Não foi possível enviar a mídia do story.');
      }

      await dataService.createStory({
        user_id: userId,
        media_url: mediaUrl,
        media_type: selectedFile.type.startsWith('video') ? 'video' : 'image',
        caption: storyForm.caption.trim() || undefined,
        text_color: storyForm.textColor || undefined,
        text_font: storyForm.textFont || undefined,
        location_name: storyForm.locationName.trim() || undefined,
        music_title: storyForm.musicTitle.trim() || undefined,
      });
      await fetchStories();
      setShowCreateModal(false);
      resetStoryComposer();
    } catch (error) {
      console.error('Error creating story:', error);
      setUploadError('Não foi possível publicar o story. Tente novamente.');
    } finally {
      setUploading(false);
    }
  };

  const groupedStories = stories.reduce((acc, story) => {
    const userId = story.user_id;
    if (!acc[userId]) acc[userId] = [];
    acc[userId].push(story);
    return acc;
  }, {} as Record<string, Story[]>);

  const usersWithStories = (Object.values(groupedStories) as Story[][]).sort((a, b) => {
    // Current user first
    if (currentUser && a[0].user_id === currentUser.id) return -1;
    if (currentUser && b[0].user_id === currentUser.id) return 1;
    return 0;
  });

  const openViewer = (userStories: Story[]) => {
    setSelectedUserStories(userStories);
    setIsViewerOpen(true);
  };

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = 300;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  return (
    <div className="relative w-full bg-white border-b border-slate-100 py-4 mb-4">
      <div className="max-w-6xl mx-auto relative px-4">
        {/* Scroll Buttons */}
        <button 
          onClick={() => scroll('left')}
          className="absolute left-2 top-1/2 -translate-y-1/2 z-10 p-1 bg-white rounded-full shadow-md border border-slate-100 text-slate-400 hover:text-nexus-blue transition-colors hidden md:block"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <button 
          onClick={() => scroll('right')}
          className="absolute right-2 top-1/2 -translate-y-1/2 z-10 p-1 bg-white rounded-full shadow-md border border-slate-100 text-slate-400 hover:text-nexus-blue transition-colors hidden md:block"
        >
          <ChevronRight className="w-5 h-5" />
        </button>

        <div 
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto no-scrollbar scroll-smooth"
        >
          {/* Add Story Button */}
          <div className="flex flex-col items-center gap-1 shrink-0">
            <button 
              onClick={() => {
                setUploadError(null);
                setShowCreateModal(true);
              }}
              disabled={uploading}
              className="relative w-16 h-16 rounded-full p-[2px] bg-slate-100 overflow-hidden group"
            >
              {currentUser?.avatar_url ? (
                <img 
                  src={currentUser.avatar_url} 
                  alt="Your story" 
                  className="w-full h-full rounded-full object-cover group-hover:scale-110 transition-transform"
                />
              ) : (
                <div className="w-full h-full rounded-full bg-slate-200 flex items-center justify-center">
                  <Plus className="w-6 h-6 text-slate-400" />
                </div>
              )}
              <div className="absolute bottom-0 right-0 bg-nexus-blue text-white p-1 rounded-full border-2 border-white">
                <Plus className="w-3 h-3" />
              </div>
              {uploading && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </button>
            <span className="text-[10px] font-medium text-slate-500">Seu Story</span>
          </div>

          {/* User Stories */}
          {usersWithStories.map((userStories) => {
            const user = userStories[0].profile;
            const storyOwnerId = userStories[0].user_id;
            const isCurrentUserStories = !!currentUser && storyOwnerId === currentUser.id;
            const displayName = isCurrentUserStories
              ? 'Você'
              : (user?.username || 'Story');
            const avatarUrl = user?.avatar_url
              || (isCurrentUserStories ? currentUser?.avatar_url : '')
              || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}`;
            
            return (
              <div key={storyOwnerId} className="flex flex-col items-center gap-1 shrink-0">
                <button 
                  onClick={() => openViewer(userStories)}
                  className="w-16 h-16 rounded-full p-[3px] bg-gradient-to-tr from-amber-400 via-rose-500 to-fuchsia-600"
                >
                  <div className="w-full h-full rounded-full p-[2px] bg-white">
                    <img 
                      src={avatarUrl}
                      alt={displayName}
                      className="w-full h-full rounded-full object-cover"
                    />
                  </div>
                </button>
                <span className="text-[10px] font-medium text-slate-500 truncate w-16 text-center">
                  {displayName}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleSelectStoryMedia}
        accept="image/*,video/*" 
        className="hidden" 
      />

      {/* Story Viewer Modal */}
      <AnimatePresence>
        {isViewerOpen && (
          <StoryViewer 
            stories={selectedUserStories} 
            onClose={() => setIsViewerOpen(false)} 
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[400] bg-black/60 backdrop-blur-sm p-4 flex items-center justify-center"
          >
            <motion.div
              initial={{ y: 16, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 16, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">Novo Story</h3>
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    resetStoryComposer();
                  }}
                  disabled={uploading}
                  className="p-1.5 rounded-full text-slate-500 hover:bg-slate-100"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-4 space-y-4">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="w-full border border-dashed border-slate-300 rounded-xl p-4 text-sm font-bold text-slate-600 hover:bg-slate-50"
                >
                  {selectedFile ? 'Trocar foto/vídeo' : 'Selecionar foto/vídeo'}
                </button>

                {previewUrl && (
                  <div className="relative rounded-xl overflow-hidden border border-slate-100 bg-black">
                    {selectedFile?.type.startsWith('video') ? (
                      <video src={previewUrl} controls className="w-full max-h-64 object-contain" />
                    ) : (
                      <img src={previewUrl} alt="Preview story" className="w-full max-h-64 object-contain" />
                    )}

                    {storyForm.caption && (
                      <div
                        className="absolute inset-x-4 bottom-4 text-center text-lg font-bold drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)] break-words"
                        style={{ color: storyForm.textColor, fontFamily: storyForm.textFont }}
                      >
                        {storyForm.caption}
                      </div>
                    )}
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1">
                    <Type className="w-3.5 h-3.5" />
                    Texto
                  </label>
                  <textarea
                    value={storyForm.caption}
                    onChange={(e) => setStoryForm((prev) => ({ ...prev, caption: e.target.value }))}
                    placeholder="Escreva algo para o seu story..."
                    rows={2}
                    className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-nexus-blue/30"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1">
                      <Palette className="w-3.5 h-3.5" />
                      Cor do texto
                    </label>
                    <input
                      type="color"
                      value={storyForm.textColor}
                      onChange={(e) => setStoryForm((prev) => ({ ...prev, textColor: e.target.value }))}
                      className="w-full h-10 border border-slate-200 rounded-lg p-1"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Fonte</label>
                    <select
                      value={storyForm.textFont}
                      onChange={(e) => setStoryForm((prev) => ({ ...prev, textFont: e.target.value }))}
                      className="w-full h-10 border border-slate-200 rounded-lg px-2 text-sm focus:outline-none focus:ring-2 focus:ring-nexus-blue/30"
                    >
                      <option value="inherit">Padrão</option>
                      <option value="serif">Serif</option>
                      <option value="monospace">Monospace</option>
                      <option value="cursive">Cursive</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" />
                    Localização
                  </label>
                  <input
                    type="text"
                    value={storyForm.locationName}
                    onChange={(e) => setStoryForm((prev) => ({ ...prev, locationName: e.target.value }))}
                    placeholder="Ex: Coimbra, Portugal"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-nexus-blue/30"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1">
                    <Music className="w-3.5 h-3.5" />
                    Música
                  </label>
                  <input
                    type="text"
                    value={storyForm.musicTitle}
                    onChange={(e) => setStoryForm((prev) => ({ ...prev, musicTitle: e.target.value }))}
                    placeholder="Ex: Nome da música - Artista"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-nexus-blue/30"
                  />
                </div>
              </div>

              <div className="px-4 py-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    resetStoryComposer();
                  }}
                  disabled={uploading}
                  className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  onClick={handlePublishStory}
                  disabled={!selectedFile || uploading}
                  className="px-4 py-2 text-sm font-bold text-white bg-nexus-blue rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {uploading ? 'Publicando...' : 'Publicar Story'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {uploadError && (
        <div className="max-w-6xl mx-auto px-4 mt-3">
          <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-semibold px-3 py-2 rounded-lg">
            {uploadError}
          </div>
        </div>
      )}
    </div>
  );
}
