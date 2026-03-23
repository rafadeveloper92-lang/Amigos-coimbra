import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ThumbsUp, MessageCircle, Share2, MoreHorizontal, Send, Trash2, Flag, X, LogOut, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { dataService } from '../services/dataService';
import { Comment, Friend } from '../types';
import { supabase } from '../services/supabaseClient';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../contexts/AuthContext';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import BrandWatermark from './BrandWatermark';

interface PostProps {
  id: number;
  userId?: string;
  author: string;
  author_avatar?: string;
  group?: string;
  time: string;
  content: string;
  image?: string;
  media_type?: 'image' | 'video';
  likes: number;
  comments: number;
  reaction_counts?: Record<string, number>;
  isNews?: boolean;
  userReaction?: string | null;
  autoOpenComments?: boolean;
  onDelete?: () => void;
  onViewProfile?: (userId: string) => void;
  onSendMessage?: (userId: string) => void;
  key?: any;
}

const REACTIONS = [
  { id: 'like', emoji: '👍', label: 'Curti', color: 'text-blue-500' },
  { id: 'love', emoji: '❤️', label: 'Amei', color: 'text-red-500' },
  { id: 'sad', emoji: '😢', label: 'Triste', color: 'text-yellow-500' },
  { id: 'angry', emoji: '😡', label: 'Raiva', color: 'text-orange-600' },
  { id: 'wow', emoji: '😮', label: 'Uau', color: 'text-yellow-400' },
];
export default function PostCard({ id, userId, author, author_avatar, group, time, content, image, media_type, likes: initialLikes, comments: initialComments, reaction_counts: initialReactionCounts, isNews, userReaction, autoOpenComments, onDelete, onViewProfile, onSendMessage }: PostProps) {
  const [likes, setLikes] = useState(initialLikes);
  const [reactionCounts, setReactionCounts] = useState<Record<string, number>>(initialReactionCounts || {});
  const [commentsCount, setCommentsCount] = useState(initialComments);
  const [isLiked, setIsLiked] = useState(!!userReaction);
  const [selectedReaction, setSelectedReaction] = useState<string | null>(userReaction || null);
  const [showReactions, setShowReactions] = useState(false);
  const [showComments, setShowComments] = useState(autoOpenComments || false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(true);
  const [isVideoInView, setIsVideoInView] = useState(false);
  const [showSendToFriendModal, setShowSendToFriendModal] = useState(false);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [isLoadingFriends, setIsLoadingFriends] = useState(false);
  const [sendingFriendId, setSendingFriendId] = useState<string | null>(null);
  const { user, profile } = useAuth();
  
  const optionsRef = useRef<HTMLDivElement>(null);
  const reactionTimeout = useRef<any>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fullscreenVideoRef = useRef<HTMLVideoElement | null>(null);
  const mediaContainerRef = useRef<HTMLDivElement | null>(null);

  const getAvatarUrl = (url?: string, seed?: string) => {
    if (url) return url;
    return `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed || 'default'}`;
  };

  const isVideoMedia = !!image && (
    media_type === 'video' ||
    image.startsWith('data:video/') ||
    /\.(mp4|webm|ogg|mov|m4v)(\?.*)?$/i.test(image)
  );

  const getPostHandle = () => {
    const normalized = (author || 'amigoscoimbra')
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '')
      .replace(/[^a-z0-9._@]/g, '');
    if (!normalized) return '@amigoscoimbra';
    return normalized.startsWith('@') ? normalized : `@${normalized}`;
  };

  useEffect(() => {
    if (!isVideoMedia) return;
    const target = mediaContainerRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        setIsVideoInView(entry.isIntersecting && entry.intersectionRatio >= 0.55);
      },
      { threshold: [0, 0.25, 0.55, 0.8] }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [isVideoMedia, image]);

  useEffect(() => {
    if (!isVideoMedia) return;
    const video = videoRef.current;
    if (!video) return;
    if (isFullscreen) {
      video.pause();
      return;
    }

    if (isVideoInView) {
      video.play().catch(() => {
        // no-op: políticas de autoplay
      });
      return;
    }
    video.pause();
  }, [isVideoInView, isVideoMedia, image, isFullscreen]);

  useEffect(() => {
    return () => {
      if (videoRef.current) {
        videoRef.current.pause();
      }
      if (fullscreenVideoRef.current) {
        fullscreenVideoRef.current.pause();
      }
    };
  }, []);

  const fetchFriends = useCallback(async () => {
    if (isLoadingFriends) return;
    setIsLoadingFriends(true);
    try {
      const friendsData = await dataService.getFriends();
      setFriends(friendsData || []);
    } catch (error) {
      console.error('Erro ao carregar amigos para compartilhamento:', error);
      setFriends([]);
    } finally {
      setIsLoadingFriends(false);
    }
  }, [isLoadingFriends]);

  const openSendToFriendModal = useCallback(async () => {
    setShowSendToFriendModal(true);
    if (friends.length === 0 && !isLoadingFriends) {
      await fetchFriends();
    }
  }, [fetchFriends, friends.length, isLoadingFriends]);

  useEffect(() => {
    // Fetch initial comment count accurately
    const getInitialCount = async () => {
      const data = await dataService.getComments(id);
      setCommentsCount(data.length);
      if (showComments) setComments(data);
    };
    getInitialCount();
  }, [id, showComments]);

  useEffect(() => {
    // Realtime listener for post updates (likes, reactions, comments)
    const subscription = supabase
      .channel(`post_${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'posts', filter: `id=eq.${id}` }, (payload) => {
        const newPost = payload.new;
        if (newPost) {
          setLikes(newPost.likes || 0);
          setReactionCounts(newPost.reaction_counts || {});
          setCommentsCount(newPost.comments || 0);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [id]);

  useEffect(() => {
    if (showComments) {
      const subscription = supabase
        .channel(`comments_${id}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'comments', filter: `post_id=eq.${id}` }, () => {
          fetchComments();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(subscription);
      };
    }
  }, [showComments, id]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (optionsRef.current && !optionsRef.current.contains(event.target as Node)) {
        setShowOptions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchComments = async () => {
    const data = await dataService.getComments(id);
    setComments(data);
    setCommentsCount(data.length);
  };

  const handleLike = async () => {
    if (showReactions) return;
    
    const newIsLiked = !isLiked;
    setIsLiked(newIsLiked);
    const reactionType = 'like';
    
    if (newIsLiked) {
      setLikes(prev => prev + 1);
      setSelectedReaction(reactionType);
      setReactionCounts(prev => ({ ...prev, [reactionType]: (Number(prev[reactionType] || 0)) + 1 }));
    } else {
      setLikes(prev => Math.max(0, prev - 1));
      const oldReaction = selectedReaction || 'like';
      setSelectedReaction(null);
      setReactionCounts(prev => ({ ...prev, [oldReaction]: Math.max(0, (Number(prev[oldReaction] || 0)) - 1) }));
    }
    
    try {
      if (newIsLiked) {
        await dataService.likePost(id, reactionType, user?.id);
      } else {
        await dataService.unlikePost(id, selectedReaction || 'like', user?.id);
      }
    } catch (error) {
      console.error('Erro ao curtir:', error);
      // Rollback logic would go here
      setIsLiked(!newIsLiked);
      if (newIsLiked) {
        setLikes(prev => Math.max(0, prev - 1));
        setSelectedReaction(null);
        setReactionCounts(prev => ({ ...prev, [reactionType]: Math.max(0, (Number(prev[reactionType] || 0)) - 1) }));
      } else {
        setLikes(prev => prev + 1);
        setSelectedReaction(selectedReaction || 'like');
        setReactionCounts(prev => ({ ...prev, [selectedReaction || 'like']: (Number(prev[selectedReaction || 'like'] || 0)) + 1 }));
      }
    }
  };

  const handleReactionSelect = async (reactionId: string) => {
    const wasLiked = isLiked;
    const oldReaction = selectedReaction;
    
    setIsLiked(true);
    setSelectedReaction(reactionId);
    
    if (!wasLiked) {
      setLikes(prev => prev + 1);
      setReactionCounts(prev => ({ ...prev, [reactionId]: (Number(prev[reactionId] || 0)) + 1 }));
    } else if (oldReaction !== reactionId) {
      setReactionCounts(prev => {
        const next = { ...prev };
        if (oldReaction) next[oldReaction] = Math.max(0, (Number(next[oldReaction] || 0)) - 1);
        next[reactionId] = (Number(next[reactionId] || 0)) + 1;
        return next;
      });
    }

    try {
      if (wasLiked && oldReaction && oldReaction !== reactionId) {
        await dataService.unlikePost(id, oldReaction, user?.id);
      }
      if (!wasLiked || oldReaction !== reactionId) {
        await dataService.likePost(id, reactionId, user?.id);
      }
    } catch (error) {
      console.error('Erro ao reagir:', error);
      // Rollback
      setIsLiked(wasLiked);
      setSelectedReaction(oldReaction);
      if (!wasLiked) {
        setLikes(prev => Math.max(0, prev - 1));
        setReactionCounts(prev => ({ ...prev, [reactionId]: Math.max(0, (Number(prev[reactionId] || 0)) - 1) }));
      } else if (oldReaction !== reactionId) {
        setReactionCounts(prev => {
          const next = { ...prev };
          if (oldReaction) next[oldReaction] = (Number(next[oldReaction] || 0)) + 1;
          next[reactionId] = Math.max(0, (Number(next[reactionId] || 0)) - 1);
          return next;
        });
      }
    }
    setShowReactions(false);
  };

  const onTouchStart = () => {
    reactionTimeout.current = setTimeout(() => {
      setShowReactions(true);
    }, 500);
  };

  const onTouchEnd = () => {
    if (reactionTimeout.current) {
      clearTimeout(reactionTimeout.current);
    }
  };

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || isSubmittingComment) return;

    setIsSubmittingComment(true);
    try {
      const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Usuário';
      await dataService.commentPost(id, userName, newComment, user?.id);
      setNewComment('');
      fetchComments();
    } catch (error) {
      console.error('Erro ao comentar:', error);
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleShare = async () => {
    const shareData = {
      title: `Post de ${author} no CineStream Pro`,
      text: content.length > 100 ? content.substring(0, 97) + '...' : content,
      url: window.location.href,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(window.location.href);
        alert('Link do post copiado para a área de transferência!');
      }
    } catch (error) {
      console.error('Erro ao compartilhar:', error);
    }
  };

  const handleSendToFriend = async (friendIdRaw: string | number) => {
    if (!user?.id) {
      alert('Faça login para enviar este vídeo para amigos.');
      return;
    }
    const friendId = String(friendIdRaw);
    setSendingFriendId(friendId);
    try {
      const contentSnippet = content?.trim();
      const messageParts = [
        isVideoMedia
          ? `🎬 ${author} compartilhou um vídeo no feed:`
          : `📷 ${author} compartilhou uma publicação no feed:`,
        contentSnippet ? `“${contentSnippet.length > 160 ? `${contentSnippet.slice(0, 157)}...` : contentSnippet}”` : '',
        image ? image : '',
      ].filter(Boolean);

      const messagePayload = messageParts.join('\n');
      const sent = await dataService.sendDirectMessage(user.id, friendId, messagePayload);
      if (!sent) {
        throw new Error('Falha ao enviar mensagem.');
      }
      setShowSendToFriendModal(false);
      alert('Vídeo enviado para o amigo com sucesso!');
    } catch (error) {
      console.error('Erro ao enviar vídeo para amigo:', error);
      alert('Não foi possível enviar agora. Tente novamente.');
    } finally {
      setSendingFriendId(null);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await dataService.deletePost(id);
      if (onDelete) onDelete();
      setShowDeleteConfirm(false);
    } catch (error) {
      console.error('Erro ao excluir post:', error);
      alert('Erro ao excluir post. Verifique suas permissões.');
    } finally {
      setIsDeleting(false);
      setShowOptions(false);
    }
  };

  const isAuthor = user?.id === userId;

  const getReactionDisplay = () => {
    if (!selectedReaction) return <ThumbsUp className="w-4 h-4" />;
    const reaction = REACTIONS.find(r => r.id === selectedReaction);
    return <span className="text-lg leading-none">{reaction?.emoji}</span>;
  };

  const getReactionLabel = () => {
    if (!selectedReaction) return 'Curtir';
    return REACTIONS.find(r => r.id === selectedReaction)?.label;
  };

  const getReactionColor = () => {
    if (!selectedReaction) return 'text-slate-600';
    return REACTIONS.find(r => r.id === selectedReaction)?.color;
  };

  // Get top 3 reactions to show in the stats bar
  const topReactions = Object.entries(reactionCounts)
    .filter(([_, count]) => Number(count) > 0)
    .sort(([_, countA], [__, countB]) => Number(countB) - Number(countA))
    .slice(0, 3)
    .map(([id]) => REACTIONS.find(r => r.id === id)?.emoji);

  return (
    <div className="bg-white border border-slate-100 rounded-xl shadow-sm overflow-hidden mb-4 relative">
      {/* Header */}
      <div className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img 
            src={getAvatarUrl(author_avatar, author)} 
            alt={author} 
            className={`w-10 h-10 rounded-full object-cover ${userId ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
            onClick={() => userId && onViewProfile && onViewProfile(userId)}
          />
          <div>
            <div className="flex items-center gap-1.5">
              <h3 
                className={`text-sm font-bold text-slate-900 ${userId ? 'cursor-pointer hover:underline' : ''}`}
                onClick={() => userId && onViewProfile && onViewProfile(userId)}
              >
                {author}
              </h3>
              {isNews && <span className="bg-nexus-blue text-white text-[9px] font-bold px-1.5 py-0.5 rounded uppercase">News</span>}
            </div>
            <p className="text-[11px] text-slate-400">
              {group && <span className="font-bold text-nexus-blue uppercase">{group}</span>}
              {group && ' • '}
              {time}
            </p>
          </div>
        </div>
        
        <div className="relative" ref={optionsRef}>
          <button 
            onClick={() => setShowOptions(!showOptions)}
            className="text-slate-400 hover:text-nexus-blue p-1 rounded-full hover:bg-slate-50 transition-colors"
          >
            <MoreHorizontal className="w-5 h-5" />
          </button>

          <AnimatePresence>
            {showOptions && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: -10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -10 }}
                className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-100 z-50 py-2 overflow-hidden"
              >
                {isAuthor && (
                  <button 
                    onClick={() => { setShowDeleteConfirm(true); setShowOptions(false); }}
                    className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors font-medium"
                  >
                    <Trash2 className="w-4 h-4" />
                    Excluir Post
                  </button>
                )}
                {!isAuthor && userId && (
                  <button 
                    onClick={() => { setShowOptions(false); onSendMessage && onSendMessage(userId); }}
                    className="w-full flex items-center gap-3 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 transition-colors font-medium"
                  >
                    <MessageCircle className="w-4 h-4" />
                    Enviar Mensagem
                  </button>
                )}
                <button 
                  onClick={() => { setShowOptions(false); alert('Post denunciado com sucesso.'); }}
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 transition-colors font-medium"
                >
                  <Flag className="w-4 h-4" />
                  Denunciar
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white border border-slate-100 rounded-2xl p-6 w-full max-w-sm shadow-2xl"
            >
              <h3 className="text-lg font-bold text-slate-900 mb-2">Excluir Post?</h3>
              <p className="text-slate-500 text-sm mb-6">Esta ação não pode ser desfeita. Tem certeza?</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 py-2.5 rounded-xl font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="flex-1 py-2.5 rounded-xl font-bold text-white bg-red-600 hover:bg-red-700 transition-colors flex items-center justify-center"
                >
                  {isDeleting ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Excluir'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content */}
      <div className="px-4 pb-3">
        <p className="text-sm text-slate-700 leading-relaxed">{content}</p>
      </div>

      {/* Image */}
      {image && (
        <div 
          ref={isVideoMedia ? mediaContainerRef : undefined}
          className={`w-full overflow-hidden relative ${isVideoMedia ? 'bg-black cursor-pointer' : 'aspect-video cursor-pointer'}`}
          onClick={() => {
            setIsFullscreen(true);
          }}
        >
          {isVideoMedia ? (
            <video
              ref={videoRef}
              src={image}
              autoPlay
              loop
              playsInline
              preload="metadata"
              muted={isVideoMuted}
              className="w-full h-auto max-h-[74vh] object-contain mx-auto"
            />
          ) : (
            <img src={image} alt="Post content" className="w-full h-full object-cover" />
          )}
          {isVideoMedia && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                const nextMuted = !isVideoMuted;
                setIsVideoMuted(nextMuted);
                if (videoRef.current) {
                  videoRef.current.muted = nextMuted;
                  if (!nextMuted) {
                    void videoRef.current.play().catch(() => undefined);
                  }
                }
              }}
              className="absolute right-3 top-3 z-10 px-2 py-1 rounded-full text-[11px] font-bold bg-black/55 text-white border border-white/25"
            >
              {isVideoMuted ? 'Som off' : 'Som on'}
            </button>
          )}
          <div className="absolute right-3 bottom-3 z-10">
            <BrandWatermark compact handle={getPostHandle()} />
          </div>
        </div>
      )}

      {/* Fullscreen Image Modal */}
      <AnimatePresence>
        {isFullscreen && image && !isVideoMedia && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/95 flex flex-col items-center justify-center backdrop-blur-md"
          >
            {/* Header Controls */}
            <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between z-[210] bg-gradient-to-b from-black/50 to-transparent">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setIsFullscreen(false)}
                  className="p-2 text-white hover:bg-white/10 rounded-full transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
                <div className="text-white">
                  <p className="text-sm font-bold">{author}</p>
                  <p className="text-[10px] opacity-70">{time}</p>
                </div>
              </div>
            </div>

            <div className="w-full h-full flex items-center justify-center overflow-hidden">
              <TransformWrapper
                initialScale={1}
                minScale={1}
                maxScale={8}
                centerOnInit={true}
                wheel={{ step: 0.2 }}
                doubleClick={{ mode: 'toggle' }}
              >
                {({ zoomIn, zoomOut, resetTransform }) => (
                  <>
                    {/* Floating Controls */}
                    <div className="absolute bottom-10 right-6 flex flex-col gap-3 z-[210]">
                      <button 
                        onClick={() => zoomIn()}
                        className="p-3 bg-white/10 hover:bg-white/20 text-white rounded-full backdrop-blur-md border border-white/10 shadow-xl transition-all active:scale-90"
                      >
                        <ZoomIn className="w-5 h-5" />
                      </button>
                      <button 
                        onClick={() => zoomOut()}
                        className="p-3 bg-white/10 hover:bg-white/20 text-white rounded-full backdrop-blur-md border border-white/10 shadow-xl transition-all active:scale-90"
                      >
                        <ZoomOut className="w-5 h-5" />
                      </button>
                      <button 
                        onClick={() => resetTransform()}
                        className="p-3 bg-white/10 hover:bg-white/20 text-white rounded-full backdrop-blur-md border border-white/10 shadow-xl transition-all active:scale-90"
                      >
                        <RotateCcw className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="absolute bottom-10 left-1/2 -translate-x-1/2 text-white/50 text-[10px] font-medium bg-black/40 px-4 py-2 rounded-full backdrop-blur-sm z-[210] pointer-events-none">
                      Pince para zoom • Arraste para mover • Toque duplo para resetar
                    </div>

                    <div className="absolute right-6 bottom-10 z-[210]">
                      <BrandWatermark compact handle={getPostHandle()} />
                    </div>

                    <TransformComponent
                      wrapperStyle={{ width: '100vw', height: '100vh' }}
                      contentStyle={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyCenter: 'center' }}
                    >
                      <img
                        src={image}
                        alt="Fullscreen content"
                        className="max-w-full max-h-full object-contain mx-auto"
                      />
                    </TransformComponent>
                  </>
                )}
              </TransformWrapper>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Fullscreen Video Modal */}
      <AnimatePresence>
        {isFullscreen && image && isVideoMedia && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[220] bg-black/95 flex flex-col items-center justify-center backdrop-blur-md"
          >
            <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between z-[230] bg-gradient-to-b from-black/60 to-transparent">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setIsFullscreen(false)}
                  className="p-2 text-white hover:bg-white/10 rounded-full transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
                <div className="text-white">
                  <p className="text-sm font-bold">{author}</p>
                  <p className="text-[10px] opacity-70">{time}</p>
                </div>
              </div>
              <button
                onClick={() => openSendToFriendModal()}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/15 border border-white/20 text-white text-xs font-bold"
              >
                <Send className="w-3.5 h-3.5" />
                Enviar
              </button>
            </div>

            <div className="w-full h-full flex items-center justify-center p-4">
              <video
                ref={fullscreenVideoRef}
                src={image}
                autoPlay
                loop
                playsInline
                controls
                muted={isVideoMuted}
                className="w-full max-h-[86vh] object-contain rounded-xl"
              />
            </div>

            <div className="absolute right-5 top-16 z-[230]">
              <button
                onClick={() => {
                  const nextMuted = !isVideoMuted;
                  setIsVideoMuted(nextMuted);
                  if (fullscreenVideoRef.current) {
                    fullscreenVideoRef.current.muted = nextMuted;
                    if (!nextMuted) {
                      void fullscreenVideoRef.current.play().catch(() => undefined);
                    }
                  }
                  if (videoRef.current) {
                    videoRef.current.muted = nextMuted;
                  }
                }}
                className="px-2 py-1 rounded-full text-[11px] font-bold bg-black/55 text-white border border-white/25"
              >
                {isVideoMuted ? 'Som off' : 'Som on'}
              </button>
            </div>

            <div className="absolute right-4 bottom-4 z-[230]">
              <BrandWatermark compact handle={getPostHandle()} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats */}
      <div className="px-4 py-2 flex items-center justify-between border-b border-slate-50">
        <div className="flex items-center gap-1">
          <div className="flex items-center -space-x-1">
            {topReactions.length > 0 ? (
              topReactions.map((emoji, i) => (
                <span key={i} className="text-sm bg-white rounded-full px-0.5" style={{ zIndex: 3 - i }}>{emoji}</span>
              ))
            ) : (
              <div className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center border border-white/20">
                <ThumbsUp className="w-2 h-2 text-white fill-current" />
              </div>
            )}
          </div>
          <span className="text-[11px] text-slate-400 ml-1">{likes}</span>
        </div>
        <button 
          onClick={() => setShowComments(!showComments)}
          className="text-[11px] text-slate-400 hover:underline"
        >
          {commentsCount} Comentários
        </button>
      </div>

      {/* Actions */}
      <div className="px-2 py-1 flex items-center justify-between relative">
        {/* Reactions Bar */}
        <AnimatePresence>
          {showReactions && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.8 }}
              animate={{ opacity: 1, y: -45, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.8 }}
              className="absolute left-4 bg-white rounded-full shadow-xl border border-slate-100 p-1.5 flex items-center gap-2 z-[60]"
            >
              {REACTIONS.map((reaction) => (
                <motion.button
                  key={reaction.id}
                  whileHover={{ scale: 1.3 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => handleReactionSelect(reaction.id)}
                  className="p-2 hover:bg-slate-50 rounded-full transition-colors text-xl"
                >
                  {reaction.emoji}
                </motion.button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        <button 
          onMouseDown={onTouchStart}
          onMouseUp={onTouchEnd}
          onMouseLeave={onTouchEnd}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          onClick={handleLike}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg transition-colors text-xs font-bold ${
            isLiked ? getReactionColor() + ' bg-slate-50' : 'text-slate-500 hover:bg-slate-50'
          }`}
        >
          {getReactionDisplay()}
          <span>{getReactionLabel()}</span>
        </button>
        <button 
          onClick={() => setShowComments(!showComments)}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg transition-colors text-xs font-bold ${
            showComments ? 'text-nexus-blue bg-nexus-blue/10' : 'text-slate-500 hover:bg-slate-50'
          }`}
        >
          <MessageCircle className="w-4 h-4" />
          <span>Comentar</span>
        </button>
        <button 
          onClick={openSendToFriendModal}
          className="flex-1 flex items-center justify-center gap-2 py-2 text-slate-500 hover:bg-slate-50 rounded-lg transition-colors text-xs font-bold"
        >
          <Send className="w-4 h-4" />
          <span>Enviar</span>
        </button>
        <button 
          onClick={handleShare}
          className="flex-1 flex items-center justify-center gap-2 py-2 text-slate-500 hover:bg-slate-50 rounded-lg transition-colors text-xs font-bold"
        >
          <Share2 className="w-4 h-4" />
          <span>Compartilhar</span>
        </button>
      </div>

      {/* Send to friend modal */}
      <AnimatePresence>
        {showSendToFriendModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[240] bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center"
          >
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.98 }}
              className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-2xl border border-slate-100 shadow-2xl max-h-[72vh] overflow-hidden"
            >
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900">Enviar para um amigo</h3>
                <button
                  onClick={() => setShowSendToFriendModal(false)}
                  className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-3 overflow-y-auto max-h-[56vh]">
                {isLoadingFriends ? (
                  <div className="py-10 flex items-center justify-center">
                    <div className="w-6 h-6 border-2 border-nexus-blue/30 border-t-nexus-blue rounded-full animate-spin" />
                  </div>
                ) : friends.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-8">
                    Nenhum amigo disponível para enviar no momento.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {friends.map((friend) => {
                      const friendId = String(friend.id);
                      const isSending = sendingFriendId === friendId;
                      return (
                        <div
                          key={friendId}
                          className="flex items-center justify-between gap-3 p-2.5 rounded-xl border border-slate-100"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <img
                              src={friend.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${friendId}`}
                              alt={friend.name}
                              className="w-10 h-10 rounded-full object-cover"
                            />
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-slate-900 truncate">{friend.name}</p>
                              <p className="text-[11px] text-slate-400">{friend.status}</p>
                            </div>
                          </div>
                          <button
                            onClick={() => handleSendToFriend(friend.id)}
                            disabled={!!sendingFriendId}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-nexus-blue text-white text-xs font-bold disabled:opacity-60"
                          >
                            {isSending ? (
                              <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                              <Send className="w-3.5 h-3.5" />
                            )}
                            Enviar
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Comments Section */}
      {showComments && (
        <div className="bg-slate-50/50 border-t border-slate-100 p-4 animate-in slide-in-from-top duration-200">
          <div className="space-y-4 mb-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
            {comments.length > 0 ? (
              comments.map((comment) => (
                <div key={comment.id} className="flex gap-3">
                  <img src={getAvatarUrl(comment.author_avatar, comment.author)} alt={comment.author} className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                  <div className="bg-white p-3 rounded-2xl shadow-sm flex-1 border border-slate-100">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="text-xs font-bold text-slate-900">{comment.author}</h4>
                      <span className="text-[10px] text-slate-400">
                        {new Date(comment.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600">{comment.content}</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-center text-xs text-slate-400 py-4">Nenhum comentário ainda. Seja o primeiro!</p>
            )}
          </div>

          <form onSubmit={handleCommentSubmit} className="flex items-center gap-2">
            <img src={getAvatarUrl(profile?.avatar_url, profile?.username || user?.email)} alt="Me" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
            <div className="relative flex-1">
              <input
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Escreva um comentário..."
                className="w-full bg-white border border-slate-200 rounded-full py-2 px-4 pr-10 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-nexus-blue/20 transition-all"
              />
              <button 
                type="submit"
                disabled={!newComment.trim() || isSubmittingComment}
                className={`absolute right-1 top-1/2 -translate-y-1/2 p-1.5 rounded-full transition-colors ${
                  !newComment.trim() || isSubmittingComment ? 'text-slate-200' : 'text-nexus-blue hover:bg-nexus-blue/10'
                }`}
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
