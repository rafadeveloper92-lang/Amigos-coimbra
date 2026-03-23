import { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { X, ChevronLeft, ChevronRight, MoreVertical, Trash2, MapPin, Music, Play, Pause, Heart, MessageCircle, Send, Star, Volume2, VolumeX } from 'lucide-react';
import { Story } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { dataService } from '../services/dataService';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import BrandWatermark from './BrandWatermark';
import { serializeStoryReplyMessage } from '../utils/storyReplyMessage';

interface StoryViewerProps {
  stories: Story[];
  initialIndex?: number;
  onClose: () => void;
  onOpenMessages?: (userId: string) => void;
}

interface FavoriteMusicTrack {
  trackId: number;
  trackName: string;
  artistName?: string;
  artworkUrl100?: string;
  previewUrl?: string;
}

interface StoryCommentItem {
  id: string;
  content: string;
  createdAt: string;
  authorUsername?: string;
  authorAvatarUrl?: string;
}

const toDeterministicTrackId = (title: string, artist?: string) => {
  const source = `${title}::${artist || ''}`;
  let hash = 0;
  for (let i = 0; i < source.length; i += 1) {
    hash = (hash << 5) - hash + source.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) || 1;
};

export default function StoryViewer({ stories, initialIndex = 0, onClose, onOpenMessages }: StoryViewerProps) {
  const { user: authUser } = useAuth();
  const [localStories, setLocalStories] = useState<Story[]>(stories);
  const [currentIndex, setCurrentIndex] = useState(
    stories.length > 0 ? Math.min(initialIndex, stories.length - 1) : 0
  );
  const [progress, setProgress] = useState(0);
  const duration = 25000; // 25 seconds por story
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  const pausedTimeRef = useRef<number>(0);
  const [isPaused, setIsPaused] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isMusicPlaying, setIsMusicPlaying] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  const [videoAudioHint, setVideoAudioHint] = useState<string | null>(null);
  const [nowTick, setNowTick] = useState(Date.now());
  const [likedStories, setLikedStories] = useState<Record<string, boolean>>({});
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  const [showComments, setShowComments] = useState(false);
  const [commentsByStory, setCommentsByStory] = useState<Record<string, StoryCommentItem[]>>({});
  const [commentInput, setCommentInput] = useState('');
  const [messageInput, setMessageInput] = useState('');
  const [favoriteTracks, setFavoriteTracks] = useState<FavoriteMusicTrack[]>([]);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionInfo, setActionInfo] = useState<string | null>(null);
  const endSoundPlayedRef = useRef<string | null>(null);

  const currentStory = localStories[currentIndex];
  const user = currentStory?.profile;
  const isOwnStory = !!authUser && !!currentStory && currentStory.user_id === authUser.id;

  useEffect(() => {
    setLocalStories(stories);
    setCurrentIndex(stories.length > 0 ? Math.min(initialIndex, stories.length - 1) : 0);
    setProgress(0);
    setShowMenu(false);
    setDeleteError(null);
    setActionError(null);
    setActionInfo(null);
  }, [stories, initialIndex]);

  useEffect(() => {
    endSoundPlayedRef.current = null;
  }, [currentStory?.id]);

  useEffect(() => {
    if (localStories.length === 0) {
      onClose();
    }
  }, [localStories.length, onClose]);

  useEffect(() => {
    const interval = setInterval(() => setNowTick(Date.now()), 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!authUser?.id) {
      setFavoriteTracks([]);
      return;
    }

    let cancelled = false;
    const loadFavorites = async () => {
      const tracks = await dataService.getFavoriteTracks(authUser.id);
      if (!cancelled) {
        setFavoriteTracks(tracks as FavoriteMusicTrack[]);
      }
    };

    void loadFavorites();
    return () => {
      cancelled = true;
    };
  }, [authUser?.id]);

  useEffect(() => {
    if (!audioRef.current) return;

    if (!currentStory?.music_preview_url || currentStory.media_type === 'video') {
      audioRef.current.pause();
      audioRef.current.src = '';
      setIsMusicPlaying(false);
      return;
    }

    const audio = audioRef.current;
    audio.src = currentStory.music_preview_url;
    audio.currentTime = 0;
    audio.play().then(() => {
      setIsMusicPlaying(true);
    }).catch(() => {
      setIsMusicPlaying(false);
    });
  }, [currentStory?.id, currentStory?.music_preview_url]);

  useEffect(() => {
    if (currentStory?.media_type !== 'video') {
      setIsVideoMuted(false);
      setVideoAudioHint(null);
      return;
    }

    const video = videoRef.current;
    if (!video) return;
    video.muted = false;
    setIsVideoMuted(false);
    setVideoAudioHint(null);

    video.play().catch(async () => {
      // Fallback para políticas de autoplay: inicia mudo e permite ativar no botão.
      video.muted = true;
      setIsVideoMuted(true);
      setVideoAudioHint('Toque no som para ouvir o áudio do vídeo');
      try {
        await video.play();
      } catch {
        // no-op
      }
    });
  }, [currentStory?.id, currentStory?.media_type, currentStory?.media_url]);

  useEffect(() => {
    setShowComments(false);
    setCommentInput('');
    setMessageInput('');
    setActionError(null);
    setActionInfo(null);
  }, [currentStory?.id]);

  useEffect(() => {
    if (!currentStory?.id) return;

    let cancelled = false;
    const loadInteractions = async () => {
      const state = await dataService.getStoryInteractionState(currentStory.id, authUser?.id);
      if (cancelled) return;

      setLikedStories((prev) => ({ ...prev, [currentStory.id]: state.isLiked }));
      setLikeCounts((prev) => ({ ...prev, [currentStory.id]: state.likesCount }));
      setCommentsByStory((prev) => ({
        ...prev,
        [currentStory.id]: state.comments.map((comment) => ({
          id: comment.id,
          content: comment.content,
          createdAt: comment.created_at,
          authorUsername: comment.author_username,
          authorAvatarUrl: comment.author_avatar_url,
        })),
      }));
    };

    void loadInteractions();
    return () => {
      cancelled = true;
    };
  }, [currentStory?.id, authUser?.id]);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      if (videoRef.current) {
        videoRef.current.pause();
      }
    };
  }, []);

  useEffect(() => {
    if (localStories.length === 0) return;
    startTimer();
    return () => stopTimer();
  }, [currentIndex, localStories.length]);

  const startTimer = () => {
    stopTimer();
    startTimeRef.current = Date.now() - (pausedTimeRef.current || 0);
    
    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      const newProgress = (elapsed / duration) * 100;
      
      if (newProgress >= 100) {
        nextStory();
      } else {
        setProgress(newProgress);
      }
    }, 50);
  };

  const stopTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const nextStory = () => {
    setShowMenu(false);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
    setIsMusicPlaying(false);
    if (currentIndex < localStories.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setProgress(0);
      pausedTimeRef.current = 0;
    } else {
      onClose();
    }
  };

  const prevStory = () => {
    setShowMenu(false);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
    setIsMusicPlaying(false);
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      setProgress(0);
      pausedTimeRef.current = 0;
    }
  };

  const handleMouseDown = () => {
    setIsPaused(true);
    stopTimer();
    pausedTimeRef.current = Date.now() - startTimeRef.current;
  };

  const handleMouseUp = () => {
    setIsPaused(false);
    startTimer();
  };

  const handleDeleteCurrentStory = async () => {
    if (!currentStory?.id) return;

    setDeleting(true);
    setDeleteError(null);
    try {
      await dataService.deleteStory(currentStory.id);
      const updatedStories = localStories.filter((story) => story.id !== currentStory.id);
      setLocalStories(updatedStories);

      if (updatedStories.length === 0) {
        onClose();
        return;
      }

      const nextIndex = Math.min(currentIndex, updatedStories.length - 1);
      setCurrentIndex(nextIndex);
      setProgress(0);
      pausedTimeRef.current = 0;
      setShowMenu(false);
    } catch (error) {
      console.error('Erro ao excluir story:', error);
      setDeleteError('Não foi possível excluir este story.');
    } finally {
      setDeleting(false);
    }
  };

  if (!currentStory) return null;

  const closeViewer = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
    setIsMusicPlaying(false);
    onClose();
  };

  const storyTimeAgo = currentStory.created_at
    ? formatDistanceToNow(new Date(currentStory.created_at), { addSuffix: true, locale: ptBR })
    : 'agora';
  const isFavoriteMusic = currentStory.music_title
    ? favoriteTracks.some(
        (track) =>
          track.trackName === currentStory.music_title &&
          (track.artistName || '') === (currentStory.music_artist || '')
      )
    : false;
  void nowTick;

  const toggleMusic = async () => {
    if (!audioRef.current || !currentStory.music_preview_url) return;
    if (isMusicPlaying) {
      audioRef.current.pause();
      setIsMusicPlaying(false);
      return;
    }
    try {
      await audioRef.current.play();
      setIsMusicPlaying(true);
    } catch {
      setIsMusicPlaying(false);
    }
  };

  const toggleVideoSound = async () => {
    if (currentStory.media_type !== 'video') return;
    const video = videoRef.current;
    if (!video) return;

    const nextMuted = !isVideoMuted;
    video.muted = nextMuted;
    setIsVideoMuted(nextMuted);
    if (!nextMuted) {
      setVideoAudioHint(null);
      try {
        await video.play();
      } catch {
        setVideoAudioHint('Não foi possível ativar o áudio automaticamente');
      }
    }
  };

  const playEndBrandSound = () => {
    if (typeof window === 'undefined') return;
    try {
      const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;

      const ctx = new AudioContextClass();
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.035, ctx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.42);
      gain.connect(ctx.destination);

      const osc1 = ctx.createOscillator();
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(660, ctx.currentTime);
      osc1.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.22);
      osc1.connect(gain);
      osc1.start(ctx.currentTime);
      osc1.stop(ctx.currentTime + 0.24);

      const osc2 = ctx.createOscillator();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(990, ctx.currentTime + 0.18);
      osc2.frequency.exponentialRampToValueAtTime(740, ctx.currentTime + 0.4);
      osc2.connect(gain);
      osc2.start(ctx.currentTime + 0.16);
      osc2.stop(ctx.currentTime + 0.42);

      setTimeout(() => {
        void ctx.close();
      }, 600);
    } catch {
      // no-op
    }
  };

  const handleStoryTap = (direction: 'prev' | 'next') => {
    // Instagram-like: primeiro toque no vídeo ativa áudio.
    if (currentStory.media_type === 'video' && isVideoMuted) {
      void toggleVideoSound();
      return;
    }

    if (direction === 'prev') {
      prevStory();
      return;
    }
    nextStory();
  };

  const showEndBrandOverlay = progress >= 88;

  useEffect(() => {
    if (!currentStory?.id) return;
    if (!showEndBrandOverlay) return;
    if (endSoundPlayedRef.current === currentStory.id) return;
    endSoundPlayedRef.current = currentStory.id;
    playEndBrandSound();
  }, [showEndBrandOverlay, currentStory?.id]);

  const storyId = currentStory.id;
  const isLiked = !!likedStories[storyId];
  const likesCount = likeCounts[storyId] || 0;
  const comments = commentsByStory[storyId] || [];
  const commentsCount = comments.length;

  const refreshCurrentStoryInteractions = async () => {
    const state = await dataService.getStoryInteractionState(storyId, authUser?.id);
    setLikedStories((prev) => ({ ...prev, [storyId]: state.isLiked }));
    setLikeCounts((prev) => ({ ...prev, [storyId]: state.likesCount }));
    setCommentsByStory((prev) => ({
      ...prev,
      [storyId]: state.comments.map((comment) => ({
        id: comment.id,
        content: comment.content,
        createdAt: comment.created_at,
        authorUsername: comment.author_username,
        authorAvatarUrl: comment.author_avatar_url,
      })),
    }));
  };

  const handleToggleLike = async () => {
    if (!authUser?.id) {
      setActionError('Faça login para curtir stories.');
      return;
    }
    setActionError(null);
    try {
      await dataService.setStoryLike(storyId, authUser.id, !isLiked);
      await refreshCurrentStoryInteractions();
    } catch (error) {
      console.error('Erro ao curtir story:', error);
      setActionError('Não foi possível atualizar a curtida.');
    }
  };

  const handleAddComment = async () => {
    const content = commentInput.trim();
    if (!content) return;
    if (!authUser?.id) {
      setActionError('Faça login para comentar stories.');
      return;
    }

    setActionError(null);
    try {
      await dataService.addStoryComment(storyId, authUser.id, content);
      setCommentInput('');
      await refreshCurrentStoryInteractions();
    } catch (error) {
      console.error('Erro ao comentar story:', error);
      setActionError('Não foi possível enviar o comentário.');
    }
  };

  const handleSendDirectMessage = async () => {
    const content = messageInput.trim();
    if (!content || !authUser?.id || !currentStory.user_id || currentStory.user_id === authUser.id) return;
    setActionError(null);
    setActionInfo(null);
    try {
      const storyContextMessage = serializeStoryReplyMessage({
        v: 1,
        storyId: currentStory.id,
        mediaUrl: currentStory.media_url,
        mediaType: currentStory.media_type,
        ownerUsername: user?.username,
        text: content,
      });
      const sent = await dataService.sendDirectMessage(authUser.id, currentStory.user_id, storyContextMessage);
      if (!sent) {
        setActionError('Não foi possível enviar a mensagem para o PV.');
        return;
      }
      setMessageInput('');
      setActionInfo('Mensagem enviada no PV.');
      if (onOpenMessages) {
        onOpenMessages(currentStory.user_id);
        onClose();
      }
    } catch (error) {
      console.error('Erro ao enviar DM pelo story:', error);
      setActionError('Não foi possível enviar a mensagem para o PV.');
    }
  };

  const handleSaveFavoriteMusic = async () => {
    if (!authUser?.id || !currentStory.music_title) return;

    const exists = favoriteTracks.some(
      (track) =>
        track.trackName === currentStory.music_title &&
        (track.artistName || '') === (currentStory.music_artist || '')
    );
    setActionError(null);
    try {
      if (exists) {
        const existing = favoriteTracks.find(
          (track) =>
            track.trackName === currentStory.music_title &&
            (track.artistName || '') === (currentStory.music_artist || '')
        );
        if (existing) {
          await dataService.removeFavoriteTrack(authUser.id, existing.trackId);
          setFavoriteTracks((prev) => prev.filter((track) => track.trackId !== existing.trackId));
        }
        return;
      }

      const nextTrack: FavoriteMusicTrack = {
        trackId: toDeterministicTrackId(currentStory.music_title, currentStory.music_artist),
        trackName: currentStory.music_title,
        artistName: currentStory.music_artist,
        artworkUrl100: currentStory.music_cover_url,
        previewUrl: currentStory.music_preview_url,
      };
      await dataService.saveFavoriteTrack(authUser.id, nextTrack);
      const latest = await dataService.getFavoriteTracks(authUser.id);
      setFavoriteTracks(latest as FavoriteMusicTrack[]);
    } catch (error) {
      console.error('Erro ao salvar música favorita:', error);
      setActionError('Não foi possível atualizar favoritas.');
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[300] bg-black flex items-center justify-center"
    >
      <audio
        ref={audioRef}
        onEnded={() => setIsMusicPlaying(false)}
        onPause={() => setIsMusicPlaying(false)}
        onPlay={() => setIsMusicPlaying(true)}
      />
      <div className="relative w-full max-w-lg h-full md:h-[90vh] md:rounded-2xl overflow-hidden bg-slate-900 shadow-2xl">
        {/* Progress Bars */}
        <div className="absolute top-4 left-4 right-4 z-20 flex gap-1">
          {localStories.map((_, index) => (
            <div key={index} className="h-1 flex-1 bg-white/20 rounded-full overflow-hidden">
              <div 
                className="h-full bg-white transition-all duration-50 ease-linear"
                style={{ 
                  width: index < currentIndex ? '100%' : index === currentIndex ? `${progress}%` : '0%' 
                }}
              />
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="absolute top-8 left-4 right-4 z-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full border-2 border-white overflow-hidden">
              <img 
                src={user?.avatar_url || `https://ui-avatars.com/api/?name=${user?.username}`} 
                alt={user?.username} 
                className="w-full h-full object-cover"
              />
            </div>
            <div className="text-white">
              <p className="text-sm font-bold">{user?.username}</p>
              <p className="text-[10px] opacity-70">{storyTimeAgo}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 relative">
            {isOwnStory && (
              <>
                <button
                  onClick={() => setShowMenu((prev) => !prev)}
                  className="p-2 text-white hover:bg-white/10 rounded-full transition-colors"
                >
                  <MoreVertical className="w-5 h-5" />
                </button>
                {showMenu && (
                  <div className="absolute right-10 top-10 bg-white rounded-xl shadow-xl py-1.5 min-w-[140px]">
                    <button
                      onClick={handleDeleteCurrentStory}
                      disabled={deleting}
                      className="w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 font-semibold flex items-center gap-2 disabled:opacity-50"
                    >
                      <Trash2 className="w-4 h-4" />
                      {deleting ? 'Excluindo...' : 'Excluir story'}
                    </button>
                  </div>
                )}
              </>
            )}
            <button 
              onClick={closeViewer}
              className="p-2 text-white hover:bg-white/10 rounded-full transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Metadata */}
        {currentStory.location_name && (
          <div
            className="absolute left-1/2 top-1/2 z-20 pointer-events-none"
            style={{
              transform: `translate(-50%, -50%) translate(${currentStory.location_x ?? 0}px, ${currentStory.location_y ?? -320}px) scale(${currentStory.location_scale ?? 1})`,
            }}
          >
            <div className="px-3 py-1 rounded-full bg-black/50 text-white text-xs font-semibold flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5" />
              {currentStory.location_name}
            </div>
          </div>
        )}

        {currentStory.music_title && currentStory.music_display_mode !== 'lyrics' && (
          <div
            className="absolute left-1/2 top-1/2 z-20 px-3 py-1 rounded-full bg-black/50 text-white text-xs font-semibold flex items-center gap-1 max-w-[320px]"
            style={{
              transform: `translate(-50%, -50%) translate(${currentStory.music_x ?? 0}px, ${currentStory.music_y ?? -260}px) scale(${currentStory.music_scale ?? 1})`,
              transformOrigin: 'center center',
            }}
          >
            {currentStory.music_cover_url ? (
              <img
                src={currentStory.music_cover_url}
                alt={currentStory.music_title}
                className="w-4 h-4 rounded-full object-cover"
              />
            ) : (
              <Music className="w-3.5 h-3.5" />
            )}
            <button onClick={toggleMusic} className="truncate text-left">
              {currentStory.music_title}
              {currentStory.music_artist ? ` - ${currentStory.music_artist}` : ''}
            </button>
            {currentStory.music_preview_url && (
              <button onClick={toggleMusic} className="ml-1">
                {isMusicPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
              </button>
            )}
            <button onClick={() => { void handleSaveFavoriteMusic(); }} title="Salvar música favorita" className="ml-1">
              <Star className={`w-3.5 h-3.5 ${isFavoriteMusic ? 'fill-current text-amber-300' : 'text-white'}`} />
            </button>
          </div>
        )}

        {currentStory.music_title && currentStory.music_display_mode === 'lyrics' && (
          <div
            className="absolute left-1/2 top-1/2 z-20 overflow-hidden pointer-events-none w-[80vw]"
            style={{
              transform: `translate(-50%, -50%) translate(${currentStory.music_x ?? 0}px, ${currentStory.music_y ?? -260}px) scale(${currentStory.music_scale ?? 1})`,
            }}
          >
            <motion.div
              className="text-white text-base font-bold whitespace-nowrap drop-shadow-[0_2px_8px_rgba(0,0,0,0.85)]"
              initial={{ x: '100%' }}
              animate={{ x: '-120%' }}
              transition={{ repeat: Infinity, duration: 9, ease: 'linear' }}
            >
              {currentStory.lyrics_text || `${currentStory.music_title}${currentStory.music_artist ? ` - ${currentStory.music_artist}` : ''}`}
            </motion.div>
          </div>
        )}

        {currentStory.mention_tags && currentStory.mention_tags.length > 0 && (
          <div
            className="absolute left-1/2 top-1/2 z-20 flex flex-wrap gap-2 justify-center pointer-events-none max-w-[80vw]"
            style={{
              transform: `translate(-50%, -50%) translate(${currentStory.mention_x ?? 0}px, ${currentStory.mention_y ?? -220}px) scale(${currentStory.mention_scale ?? 1})`,
            }}
          >
            {currentStory.mention_tags.map((mention) => (
              <span
                key={mention}
                className="px-2.5 py-1 rounded-full bg-black/55 text-white text-xs font-semibold"
              >
                @{mention}
              </span>
            ))}
          </div>
        )}

        {deleteError && (
          <div className="absolute top-24 left-4 right-4 z-20">
            <div className="bg-red-600/90 text-white text-xs font-semibold px-3 py-2 rounded-lg">
              {deleteError}
            </div>
          </div>
        )}

        {actionError && (
          <div className="absolute top-36 left-4 right-4 z-20">
            <div className="bg-red-600/90 text-white text-xs font-semibold px-3 py-2 rounded-lg">
              {actionError}
            </div>
          </div>
        )}

        {actionInfo && (
          <div className="absolute top-36 left-4 right-4 z-20">
            <div className="bg-emerald-600/90 text-white text-xs font-semibold px-3 py-2 rounded-lg">
              {actionInfo}
            </div>
          </div>
        )}

        {/* Content */}
        <div 
          className="w-full h-full flex items-center justify-center relative"
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onTouchStart={handleMouseDown}
          onTouchEnd={handleMouseUp}
        >
          <div
            className="w-full h-full"
            style={{
              transform: `translate(${currentStory.media_x ?? 0}px, ${currentStory.media_y ?? 0}px) scale(${currentStory.media_scale ?? 1})`,
              transformOrigin: 'center center',
            }}
          >
            {currentStory.media_type === 'video' ? (
              <video
                ref={videoRef}
                src={currentStory.media_url}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
                muted={isVideoMuted}
              />
            ) : (
              <img
                src={currentStory.media_url}
                alt="Story"
                className="w-full h-full object-cover"
              />
            )}
          </div>

          {currentStory.stickers && currentStory.stickers.map((sticker) => (
            <div
              key={sticker.id}
              className="absolute z-20 text-3xl md:text-4xl drop-shadow-[0_2px_10px_rgba(0,0,0,0.85)] pointer-events-none"
              style={{
                left: '50%',
                top: '50%',
                transform: `translate(${sticker.x ?? 0}px, ${sticker.y ?? 0}px) scale(${sticker.scale ?? 1})`,
              }}
            >
              {sticker.label}
            </div>
          ))}

          {/* Navigation Overlay */}
          <div className="absolute inset-0 flex">
            <div 
              className="w-1/3 h-full cursor-pointer" 
              onClick={(e) => {
                e.stopPropagation();
                handleStoryTap('prev');
              }}
            />
            <div 
              className="w-2/3 h-full cursor-pointer" 
              onClick={(e) => {
                e.stopPropagation();
                handleStoryTap('next');
              }}
            />
          </div>
        </div>

        {/* Caption Overlay */}
        {currentStory.caption && (
          <div
            className="absolute left-1/2 top-1/2 z-20 text-center pointer-events-none px-4"
            style={{
              transform: `translate(-50%, -50%) translate(${currentStory.caption_x ?? 0}px, ${currentStory.caption_y ?? 0}px) scale(${currentStory.caption_scale ?? 1})`,
            }}
          >
            <p
              className="text-2xl md:text-3xl font-black break-words drop-shadow-[0_2px_10px_rgba(0,0,0,0.85)]"
              style={{
                color: currentStory.text_color || '#ffffff',
                fontFamily: currentStory.text_font || 'inherit',
              }}
            >
              {currentStory.caption}
            </p>
          </div>
        )}

        {currentStory.media_type === 'video' && (
          <div className="absolute right-4 bottom-36 z-20">
            <button
              onClick={() => { void toggleVideoSound(); }}
              className="p-2 rounded-full bg-black/55 border border-white/25 text-white"
              title={isVideoMuted ? 'Ativar áudio do vídeo' : 'Silenciar vídeo'}
            >
              {isVideoMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
          </div>
        )}

        {videoAudioHint && currentStory.media_type === 'video' && (
          <div className="absolute right-4 bottom-44 z-20">
            <div className="bg-black/65 border border-white/20 text-white text-[10px] font-semibold px-2 py-1 rounded-lg">
              {videoAudioHint}
            </div>
          </div>
        )}

        {currentStory.media_type === 'video' && isVideoMuted && (
          <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
            <motion.div
              className="bg-black/55 border border-white/25 rounded-full px-4 py-2 text-white text-xs font-bold"
              animate={{ opacity: [0.55, 1, 0.55], scale: [1, 1.03, 1] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
            >
              Toque no vídeo para ativar o som
            </motion.div>
          </div>
        )}

        <div className="absolute right-4 bottom-24 z-20">
          <BrandWatermark handle={`@${(user?.username || 'amigoscoimbra').replace(/^@/, '')}`} />
        </div>

        {showEndBrandOverlay && (
          <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.8, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="flex flex-col items-center gap-3"
            >
              <BrandWatermark
                variant="center"
                handle={`@${(user?.username || 'amigoscoimbra').replace(/^@/, '')}`}
              />
              <div className="text-[11px] font-bold tracking-wide text-white/90 bg-black/45 border border-white/20 rounded-full px-3 py-1">
                Som original
              </div>
            </motion.div>
          </div>
        )}

        {/* Footer / Actions */}
        <div className="absolute bottom-6 left-4 right-4 z-20 flex items-center gap-2">
          <div className="flex-1 flex items-center gap-2 bg-black/40 border border-white/30 rounded-full px-3 py-2">
            <input
              type="text"
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              placeholder="Enviar mensagem..."
              className="flex-1 bg-transparent text-white text-sm placeholder:text-white/60 focus:outline-none"
            />
            <button
              onClick={handleSendDirectMessage}
              className="text-white hover:text-white/80"
              title="Enviar no PV"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
          <button
            onClick={() => { void handleToggleLike(); }}
            className="p-2 rounded-full bg-black/40 text-white border border-white/20"
            title="Curtir"
          >
            <Heart className={`w-5 h-5 ${isLiked ? 'fill-red-500 text-red-500' : ''}`} />
          </button>
          <button
            onClick={() => setShowComments((prev) => !prev)}
            className="p-2 rounded-full bg-black/40 text-white border border-white/20"
            title="Comentários"
          >
            <MessageCircle className="w-5 h-5" />
          </button>
        </div>

        <div className="absolute bottom-0 left-4 right-4 z-20 text-[11px] text-white/80 flex items-center justify-between pb-1">
          <span>{likesCount} curtidas</span>
          <span>{commentsCount} comentários</span>
        </div>

        {showComments && (
          <div className="absolute left-3 right-3 bottom-20 z-30 bg-black/70 border border-white/20 rounded-xl p-3">
            <div className="max-h-32 overflow-y-auto space-y-1 mb-2">
              {comments.length === 0 ? (
                <p className="text-white/60 text-xs">Sem comentários ainda.</p>
              ) : (
                comments.map((comment) => (
                  <div key={comment.id} className="text-white text-xs bg-white/10 rounded-md px-2 py-1 flex items-start gap-2">
                    <img
                      src={comment.authorAvatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(comment.authorUsername || 'U')}`}
                      alt={comment.authorUsername || 'Usuário'}
                      className="w-5 h-5 rounded-full object-cover mt-0.5"
                    />
                    <p className="leading-4">
                      <span className="font-bold mr-1">{comment.authorUsername || 'Usuário'}:</span>
                      {comment.content}
                    </p>
                  </div>
                ))
              )}
            </div>
            <div className="flex gap-2">
              <input
                value={commentInput}
                onChange={(e) => setCommentInput(e.target.value)}
                placeholder="Comentar..."
                className="flex-1 bg-white/10 border border-white/20 rounded-full px-3 py-1.5 text-white text-xs placeholder:text-white/60 focus:outline-none"
              />
              <button
                onClick={() => { void handleAddComment(); }}
                className="px-3 py-1.5 rounded-full bg-white text-slate-900 text-xs font-bold"
              >
                Enviar
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Desktop Navigation Buttons */}
      <button 
        onClick={prevStory}
        className="hidden md:flex absolute left-8 top-1/2 -translate-y-1/2 w-12 h-12 items-center justify-center bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors"
      >
        <ChevronLeft className="w-8 h-8" />
      </button>
      <button 
        onClick={nextStory}
        className="hidden md:flex absolute right-8 top-1/2 -translate-y-1/2 w-12 h-12 items-center justify-center bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors"
      >
        <ChevronRight className="w-8 h-8" />
      </button>
    </motion.div>
  );
}
