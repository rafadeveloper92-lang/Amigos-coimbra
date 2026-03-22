import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ChevronLeft, ChevronRight, MoreVertical } from 'lucide-react';
import { Story } from '../types';

interface StoryViewerProps {
  stories: Story[];
  onClose: () => void;
}

export default function StoryViewer({ stories, onClose }: StoryViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const duration = 5000; // 5 seconds per story
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  const pausedTimeRef = useRef<number>(0);
  const [isPaused, setIsPaused] = useState(false);

  const currentStory = stories[currentIndex];
  const user = currentStory.profile;

  useEffect(() => {
    startTimer();
    return () => stopTimer();
  }, [currentIndex]);

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
    if (currentIndex < stories.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setProgress(0);
      pausedTimeRef.current = 0;
    } else {
      onClose();
    }
  };

  const prevStory = () => {
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

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[300] bg-black flex items-center justify-center"
    >
      <div className="relative w-full max-w-lg h-full md:h-[90vh] md:rounded-2xl overflow-hidden bg-slate-900 shadow-2xl">
        {/* Progress Bars */}
        <div className="absolute top-4 left-4 right-4 z-20 flex gap-1">
          {stories.map((_, index) => (
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
              <p className="text-[10px] opacity-70">Há 2 horas</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="p-2 text-white hover:bg-white/10 rounded-full transition-colors">
              <MoreVertical className="w-5 h-5" />
            </button>
            <button 
              onClick={onClose}
              className="p-2 text-white hover:bg-white/10 rounded-full transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div 
          className="w-full h-full flex items-center justify-center relative"
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onTouchStart={handleMouseDown}
          onTouchEnd={handleMouseUp}
        >
          {currentStory.media_type === 'video' ? (
            <video 
              src={currentStory.media_url} 
              autoPlay 
              muted 
              playsInline 
              className="w-full h-full object-contain"
            />
          ) : (
            <img 
              src={currentStory.media_url} 
              alt="Story" 
              className="w-full h-full object-contain"
            />
          )}

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
