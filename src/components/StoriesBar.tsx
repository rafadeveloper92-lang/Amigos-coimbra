import { useState, useEffect, useRef, ChangeEvent } from 'react';
import { AnimatePresence } from 'motion/react';
import { Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { dataService } from '../services/dataService';
import { Story, Profile } from '../types';
import { supabase } from '../services/supabaseClient';
import StoryViewer from './StoryViewer';
import StoryComposer, { StoryComposerPayload } from './StoryComposer';

interface StoriesBarProps {
  onSendMessage?: (userId: string) => void;
}

export default function StoriesBar({ onSendMessage }: StoriesBarProps) {
  const [stories, setStories] = useState<Story[]>([]);
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [selectedUserStories, setSelectedUserStories] = useState<Story[]>([]);
  const [viewerInitialIndex, setViewerInitialIndex] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showComposer, setShowComposer] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
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
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSelectStoryMedia = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError(null);
    setSelectedFile(file);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(URL.createObjectURL(file));
    setShowComposer(true);
  };

  const handlePublishStory = async (payload: StoryComposerPayload) => {
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
        caption: payload.caption,
        text_color: payload.textColor,
        text_font: payload.textFont,
        location_name: payload.locationName,
        location_x: payload.locationX,
        location_y: payload.locationY,
        location_scale: payload.locationScale,
        music_title: payload.music?.title,
        music_artist: payload.music?.artist,
        music_cover_url: payload.music?.coverUrl,
        music_preview_url: payload.music?.previewUrl,
        music_display_mode: payload.musicDisplayMode,
        lyrics_text: payload.lyricsText,
        mention_tags: payload.mentionTags,
        stickers: payload.stickers,
        mention_x: payload.mentionX,
        mention_y: payload.mentionY,
        mention_scale: payload.mentionScale,
        music_x: payload.musicX,
        music_y: payload.musicY,
        music_scale: payload.musicScale,
        media_scale: payload.mediaScale,
        media_x: payload.mediaX,
        media_y: payload.mediaY,
        caption_x: payload.captionX,
        caption_y: payload.captionY,
        caption_scale: payload.captionScale,
      });
      await fetchStories();
      setShowComposer(false);
      resetStoryComposer();
    } catch (error) {
      console.error('Error creating story:', error);
      setUploadError('Não foi possível publicar o story. Tente novamente.');
    } finally {
      setUploading(false);
    }
  };

  const handleCloseComposer = () => {
    if (uploading) return;
    setShowComposer(false);
    resetStoryComposer();
  };

  const groupedStories = stories.reduce((acc, story) => {
    const userId = story.user_id;
    if (!acc[userId]) acc[userId] = [];
    acc[userId].push(story);
    return acc;
  }, {} as Record<string, Story[]>);

  (Object.values(groupedStories) as Story[][]).forEach((userStories) => {
    userStories.sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  });

  const usersWithStories = (Object.values(groupedStories) as Story[][]).sort((a, b) => {
    // Current user first
    if (currentUser && a[0].user_id === currentUser.id) return -1;
    if (currentUser && b[0].user_id === currentUser.id) return 1;
    return 0;
  });

  const openViewer = (userStories: Story[]) => {
    const ownerId = userStories[0]?.user_id;
    const isOwnStories = !!currentUser && ownerId === currentUser.id;
    setSelectedUserStories(userStories);
    setViewerInitialIndex(isOwnStories ? Math.max(0, userStories.length - 1) : 0);
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
              onClick={() => fileInputRef.current?.click()}
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
            initialIndex={viewerInitialIndex}
            onOpenMessages={onSendMessage}
            onClose={() => setIsViewerOpen(false)} 
          />
        )}
      </AnimatePresence>

      <StoryComposer
        isOpen={showComposer}
        file={selectedFile}
        previewUrl={previewUrl}
        uploading={uploading}
        error={uploadError}
        onClose={handleCloseComposer}
        onSelectMedia={() => fileInputRef.current?.click()}
        onPublish={handlePublishStory}
      />

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
