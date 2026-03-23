import { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { X, ChevronLeft, ChevronRight, MoreVertical, Trash2, MapPin, Music, Play, Pause } from 'lucide-react';
import { Story } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { dataService } from '../services/dataService';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface StoryViewerProps {
  stories: Story[];
  onClose: () => void;
}

export default function StoryViewer({ stories, onClose }: StoryViewerProps) {
  const { user: authUser } = useAuth();
  const [localStories, setLocalStories] = useState<Story[]>(stories);
  const [currentIndex, setCurrentIndex] = useState(0);
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
  const [isMusicPlaying, setIsMusicPlaying] = useState(false);
  const [nowTick, setNowTick] = useState(Date.now());

  const currentStory = localStories[currentIndex];
  const user = currentStory?.profile;
  const isOwnStory = !!authUser && !!currentStory && currentStory.user_id === authUser.id;

  useEffect(() => {
    setLocalStories(stories);
    setCurrentIndex(0);
    setProgress(0);
    setShowMenu(false);
    setDeleteError(null);
  }, [stories]);

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
    if (!audioRef.current) return;

    if (!currentStory?.music_preview_url) {
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
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
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
    setIsMusicPlaying(false);
    onClose();
  };

  const storyTimeAgo = currentStory.created_at
    ? formatDistanceToNow(new Date(currentStory.created_at), { addSuffix: true, locale: ptBR })
    : 'agora';
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
          <div className="absolute top-24 left-4 right-4 z-20 flex flex-wrap gap-2 pointer-events-none">
            {currentStory.location_name && (
              <div className="px-3 py-1 rounded-full bg-black/50 text-white text-xs font-semibold flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" />
                {currentStory.location_name}
              </div>
            )}
          </div>
        )}

        {currentStory.music_title && currentStory.music_display_mode !== 'lyrics' && (
          <button
            onClick={toggleMusic}
            className="absolute left-1/2 top-1/2 z-20 px-3 py-1 rounded-full bg-black/50 text-white text-xs font-semibold flex items-center gap-1 max-w-[280px]"
            style={{
              transform: `translate(-50%, -50%) translate(${currentStory.music_x || 0}px, ${currentStory.music_y || -260}px) scale(${currentStory.music_scale || 1})`,
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
            <span className="truncate">
              {currentStory.music_title}
              {currentStory.music_artist ? ` - ${currentStory.music_artist}` : ''}
            </span>
            {currentStory.music_preview_url && (
              <span className="ml-1">{isMusicPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}</span>
            )}
          </button>
        )}

        {currentStory.music_title && currentStory.music_display_mode === 'lyrics' && (
          <div
            className="absolute left-1/2 top-1/2 z-20 overflow-hidden pointer-events-none w-[80vw]"
            style={{
              transform: `translate(-50%, -50%) translate(${currentStory.music_x || 0}px, ${currentStory.music_y || -260}px) scale(${currentStory.music_scale || 1})`,
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
              transform: `translate(-50%, -50%) translate(${currentStory.mention_x || 0}px, ${currentStory.mention_y || -220}px) scale(${currentStory.mention_scale || 1})`,
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
              transform: `translate(${currentStory.media_x || 0}px, ${currentStory.media_y || 0}px) scale(${currentStory.media_scale || 1})`,
              transformOrigin: 'center center',
            }}
          >
            {currentStory.media_type === 'video' ? (
              <video
                src={currentStory.media_url}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover"
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
                transform: `translate(${sticker.x || 0}px, ${sticker.y || 0}px) scale(${sticker.scale || 1})`,
              }}
            >
              {sticker.label}
            </div>
          ))}

          {/* Navigation Overlay */}
          <div className="absolute inset-0 flex">
            <div 
              className="w-1/3 h-full cursor-pointer" 
              onClick={(e) => { e.stopPropagation(); prevStory(); }}
            />
            <div 
              className="w-2/3 h-full cursor-pointer" 
              onClick={(e) => { e.stopPropagation(); nextStory(); }}
            />
          </div>
        </div>

        {/* Caption Overlay */}
        {currentStory.caption && (
          <div
            className="absolute left-1/2 top-1/2 z-20 text-center pointer-events-none px-4"
            style={{
              transform: `translate(-50%, -50%) translate(${currentStory.caption_x || 0}px, ${currentStory.caption_y || 0}px) scale(${currentStory.caption_scale || 1})`,
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

        {/* Footer / Reply */}
        <div className="absolute bottom-6 left-4 right-4 z-20 flex gap-3">
          <input 
            type="text" 
            placeholder="Enviar mensagem..." 
            className="flex-1 bg-transparent border border-white/30 rounded-full px-4 py-2 text-white text-sm placeholder:text-white/50 focus:outline-none focus:border-white transition-colors"
          />
        </div>
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
