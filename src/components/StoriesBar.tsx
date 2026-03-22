import { useState, useEffect, useRef, ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, ChevronLeft, ChevronRight } from 'lucide-react';
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
        .single();
      setCurrentUser(profile);
    }
  };

  const handleFileSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser) return;

    setUploading(true);
    try {
      const mediaUrl = await dataService.uploadStoryMedia(file);
      if (mediaUrl) {
        await dataService.createStory({
          user_id: currentUser.id,
          media_url: mediaUrl,
          media_type: file.type.startsWith('video') ? 'video' : 'image'
        });
        fetchStories();
      }
    } catch (error) {
      console.error('Error creating story:', error);
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
            if (!user) return null;
            
            return (
              <div key={user.id} className="flex flex-col items-center gap-1 shrink-0">
                <button 
                  onClick={() => openViewer(userStories)}
                  className="w-16 h-16 rounded-full p-[3px] bg-gradient-to-tr from-amber-400 via-rose-500 to-fuchsia-600"
                >
                  <div className="w-full h-full rounded-full p-[2px] bg-white">
                    <img 
                      src={user.avatar_url || `https://ui-avatars.com/api/?name=${user.username}`} 
                      alt={user.username} 
                      className="w-full h-full rounded-full object-cover"
                    />
                  </div>
                </button>
                <span className="text-[10px] font-medium text-slate-500 truncate w-16 text-center">
                  {user.username}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileSelect} 
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
    </div>
  );
}
