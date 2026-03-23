import React, { useEffect, useState, useRef } from 'react';
import { X, Send, Image as ImageIcon, Trash2, Film } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { dataService } from '../services/dataService';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabaseClient';

interface CreatePostModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPostCreated: () => void;
}

export default function CreatePostModal({ isOpen, onClose, onPostCreated }: CreatePostModalProps) {
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedMedia, setSelectedMedia] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video' | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();

  useEffect(() => {
    return () => {
      if (mediaPreview) {
        URL.revokeObjectURL(mediaPreview);
      }
    };
  }, [mediaPreview]);

  const handleMediaSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const nextType: 'image' | 'video' = file.type.startsWith('video') ? 'video' : 'image';
      if (mediaPreview) {
        URL.revokeObjectURL(mediaPreview);
      }
      setSelectedMedia(file);
      setMediaType(nextType);
      setMediaPreview(URL.createObjectURL(file));
    }
  };

  const removeMedia = () => {
    setSelectedMedia(null);
    setMediaType(null);
    if (mediaPreview) {
      URL.revokeObjectURL(mediaPreview);
    }
    setMediaPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() && !selectedMedia) return;

    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      const sessionUser = authUser || user;
      if (!sessionUser?.id) {
        throw new Error('Sessão inválida. Faça login novamente para postar.');
      }

      const userName = sessionUser.user_metadata?.full_name || sessionUser.email?.split('@')[0] || 'Usuário';
      
      let mediaUrl: string | null = null;
      if (selectedMedia) {
        mediaUrl = await dataService.uploadImage(selectedMedia);
        if (!mediaUrl) {
          throw new Error('Não foi possível enviar a mídia. Verifique o bucket de storage.');
        }
      }

      const success = await dataService.createPost({
        user_id: sessionUser.id,
        author: userName,
        content: content,
        image: mediaUrl || undefined,
        media_type: mediaType || undefined,
      });
      
      if (success) {
        setContent('');
        removeMedia();
        onPostCreated();
        onClose();
      }
    } catch (error: any) {
      console.error('Erro ao criar post:', error);
      const normalized = String(error?.message || '').toLowerCase();
      if (normalized.includes('row-level security policy')) {
        setErrorMessage('Permissão bloqueada no banco (RLS). Rode o SQL "fix_posts_rls.sql" no Supabase e tente novamente.');
      } else {
        setErrorMessage(error.message || 'Erro desconhecido ao postar');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/45 backdrop-blur-sm"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="bg-white border border-slate-200 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50">
              <h2 className="text-lg font-bold text-slate-800">Criar Novo Post</h2>
              <button 
                onClick={onClose}
                className="p-2 hover:bg-slate-200 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-4">
              {errorMessage && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl font-medium">
                  ⚠️ {errorMessage}
                </div>
              )}
              <textarea
                autoFocus
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="O que você está pensando?"
                className="w-full min-h-[120px] p-4 text-slate-800 bg-slate-50 rounded-xl border border-slate-200 focus:ring-2 focus:ring-nexus-blue/25 focus:border-nexus-blue/40 outline-none resize-none text-lg placeholder:text-slate-400"
              />

              {/* Media Preview */}
              <AnimatePresence>
                {mediaPreview && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="relative mt-4 rounded-xl overflow-hidden border border-slate-200 bg-slate-900"
                  >
                    {mediaType === 'video' ? (
                      <video
                        src={mediaPreview}
                        controls
                        playsInline
                        preload="metadata"
                        className="w-full max-h-[300px] object-cover"
                      />
                    ) : (
                      <img src={mediaPreview} alt="Preview" className="w-full max-h-[300px] object-cover" />
                    )}
                    <button
                      type="button"
                      onClick={removeMedia}
                      className="absolute top-2 right-2 p-2 bg-black/55 text-white rounded-full hover:bg-black/75 transition-colors backdrop-blur-sm"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex items-center justify-between mt-4">
                <div className="flex items-center gap-2">
                  <input 
                    type="file" 
                    ref={fileInputRef}
                    onChange={handleMediaSelect}
                    accept="image/*,video/*"
                    className="hidden"
                  />
                  <button 
                    type="button" 
                    onClick={() => fileInputRef.current?.click()}
                    className={`p-2 rounded-full transition-colors ${mediaPreview ? 'text-nexus-blue bg-nexus-blue/10' : 'text-slate-500 hover:bg-slate-100'}`}
                    title="Adicionar foto ou vídeo"
                  >
                    {mediaType === 'video' ? <Film className="w-5 h-5" /> : <ImageIcon className="w-5 h-5" />}
                  </button>
                  <span className="text-xs font-semibold text-slate-500">
                    {mediaType === 'video' ? 'Vídeo selecionado' : mediaType === 'image' ? 'Foto selecionada' : 'Foto/Vídeo'}
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={(!content.trim() && !selectedMedia) || isSubmitting}
                  className={`flex items-center gap-2 px-6 py-2.5 rounded-full font-bold transition-all ${
                    (!content.trim() && !selectedMedia) || isSubmitting
                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      : 'bg-nexus-blue text-white hover:bg-nexus-blue/90 shadow-lg shadow-nexus-blue/20 active:scale-95'
                  }`}
                >
                  {isSubmitting ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>Postar</span>
                      <Send className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
