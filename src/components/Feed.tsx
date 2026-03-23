import { useState, useEffect, useCallback } from 'react';
import PostCard from './PostCard';
import AdCarousel from './AdCarousel';
import StoriesBar from './StoriesBar';
import { Plus } from 'lucide-react';
import { dataService } from '../services/dataService';
import { Post } from '../types';
import CreatePostModal from './CreatePostModal';
import { supabase } from '../services/supabaseClient';
import { ViewType } from '../App';

interface FeedProps {
  onNavigate?: (view: ViewType) => void;
  onViewProfile?: (userId: string) => void;
  onSendMessage?: (userId: string) => void;
}

export default function Feed({ onNavigate, onViewProfile, onSendMessage }: FeedProps) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchPosts = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    const data = await dataService.getPosts();
    setPosts(data);
    if (showLoading) setLoading(false);
  }, []);

  const handlePostDeleted = (deletedId: number) => {
    setPosts(prev => prev.filter(p => p.id !== deletedId));
  };

  useEffect(() => {
    fetchPosts(true); // Show loading only on first mount

    // Real-time subscription
    const subscription = supabase
      .channel('posts_channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, (payload) => {
        if (payload.eventType === 'DELETE') {
          handlePostDeleted(payload.old.id);
        } else {
          fetchPosts(false); // Update without showing spinner
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [fetchPosts]);

  return (
    <main className="flex-1 w-full p-4 pb-24 lg:pb-4 lg:p-0">
      <AdCarousel />
      <StoriesBar onSendMessage={onSendMessage} />
      
      {/* Posts */}
      <div className="space-y-4">
        {loading ? (
          <div className="flex justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : posts.length > 0 ? (
          posts.map((post) => (
            <PostCard 
              key={post.id} 
              id={post.id}
              userId={post.user_id}
              author={post.author}
              author_avatar={post.author_avatar}
              group={post.group}
              time={post.time}
              content={post.content}
              image={post.image}
              likes={post.likes}
              comments={post.comments}
              reaction_counts={post.reaction_counts}
              isNews={post.is_news}
              userReaction={post.userReaction}
              onDelete={() => handlePostDeleted(post.id)}
              onViewProfile={onViewProfile}
              onSendMessage={onSendMessage}
            />
          ))
        ) : (
          <div className="bg-white rounded-xl p-8 text-center text-slate-500 shadow-sm">
            Nenhum post encontrado. Conecte seu banco de dados ou crie o primeiro post!
          </div>
        )}
      </div>

      {/* FAB - Mobile Only */}
      <button 
        onClick={() => setIsModalOpen(true)}
        className="fixed bottom-20 right-4 lg:bottom-8 lg:right-8 w-14 h-14 bg-nexus-blue text-white rounded-full shadow-lg flex items-center justify-center hover:scale-110 active:scale-95 transition-all z-50"
      >
        <Plus className="w-8 h-8" />
      </button>

      {/* Create Post Modal */}
      <CreatePostModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onPostCreated={fetchPosts}
      />
    </main>
  );
}
