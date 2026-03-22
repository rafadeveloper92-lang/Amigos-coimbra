import { useState, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import { dataService } from '../services/dataService';
import { Post } from '../types';
import PostCard from './PostCard';

interface PostDetailViewProps {
  postId: number;
  onBack: () => void;
  onViewProfile?: (userId: string) => void;
  onSendMessage?: (userId: string) => void;
}

export default function PostDetailView({ postId, onBack, onViewProfile, onSendMessage }: PostDetailViewProps) {
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPost = async () => {
      setLoading(true);
      try {
        const data = await dataService.getPostById(postId);
        setPost(data);
      } catch (error) {
        console.error('Error fetching post:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPost();
  }, [postId]);

  return (
    <div className="max-w-2xl mx-auto p-4 lg:p-0">
      <div className="flex items-center gap-4 mb-6">
        <button 
          onClick={onBack}
          className="p-2 bg-white rounded-full shadow-sm hover:bg-slate-50 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </button>
        <h1 className="text-xl font-bold text-slate-800">Visualizar Post</h1>
      </div>

      {loading ? (
        <div className="flex justify-center p-12">
          <div className="w-8 h-8 border-4 border-nexus-blue/30 border-t-nexus-blue rounded-full animate-spin"></div>
        </div>
      ) : post ? (
        <PostCard 
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
          onDelete={() => onBack()}
          onViewProfile={onViewProfile}
          onSendMessage={onSendMessage}
          autoOpenComments={true}
        />
      ) : (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-100 shadow-sm">
          <p className="text-slate-500 font-bold">Post não encontrado ou foi excluído.</p>
          <button 
            onClick={onBack}
            className="mt-4 text-nexus-blue font-bold hover:underline"
          >
            Voltar para o Feed
          </button>
        </div>
      )}
    </div>
  );
}
