import React, { useState, useRef } from 'react';
import { X, Send, Image as ImageIcon, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { dataService } from '../services/dataService';
import { useAuth } from '../contexts/AuthContext';

interface CreatePostModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPostCreated: () => void;
}

export default function CreatePostModal({ isOpen, onClose, onPostCreated }: CreatePostModalProps) {
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() && !selectedImage) return;

    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Usuário';
      
      let imageUrl = null;
      if (selectedImage) {
        imageUrl = await dataService.uploadImage(selectedImage);
        // Se falhar o upload real (bucket não existe), usamos o preview Base64 para demonstração
        if (!imageUrl) {
          imageUrl = imagePreview;
        }
      }

      const success = await dataService.createPost({
        user_id: user?.id,
        author: userName,
        content: content,
        image: imageUrl || undefined
      });
      
      if (success) {
        setContent('');
        removeImage();
        onPostCreated();
        onClose();
      }
    } catch (error: any) {
      console.error('Erro ao criar post:', error);
      setErrorMessage(error.message || 'Erro desconhecido ao postar');
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
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="bg-[#1a1a1a] border border-white/10 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/5">
              <h2 className="text-lg font-bold text-white">Criar Novo Post</h2>
              <button 
                onClick={onClose}
                className="p-2 hover:bg-white/5 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-white/40" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-4">
              {errorMessage && (
                <div className="mb-4 p-3 bg-red-900/20 border border-red-900/50 text-red-400 text-sm rounded-xl font-medium">
                  ⚠️ {errorMessage}
                </div>
              )}
              <textarea
                autoFocus
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="O que você está pensando?"
                className="w-full min-h-[120px] p-4 text-white bg-white/5 rounded-xl border-none focus:ring-2 focus:ring-[#E50914]/50 outline-none resize-none text-lg placeholder:text-white/20"
              />

              {/* Image Preview */}
              <AnimatePresence>
                {imagePreview && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="relative mt-4 rounded-xl overflow-hidden border border-white/10"
                  >
                    <img src={imagePreview} alt="Preview" className="w-full max-h-[300px] object-cover" />
                    <button
                      type="button"
                      onClick={removeImage}
                      className="absolute top-2 right-2 p-2 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors backdrop-blur-sm"
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
                    onChange={handleImageSelect}
                    accept="image/*"
                    className="hidden"
                  />
                  <button 
                    type="button" 
                    onClick={() => fileInputRef.current?.click()}
                    className={`p-2 rounded-full transition-colors ${imagePreview ? 'text-[#E50914] bg-[#E50914]/10' : 'text-white/40 hover:bg-white/5'}`}
                  >
                    <ImageIcon className="w-5 h-5" />
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={(!content.trim() && !selectedImage) || isSubmitting}
                  className={`flex items-center gap-2 px-6 py-2.5 rounded-full font-bold transition-all ${
                    (!content.trim() && !selectedImage) || isSubmitting
                      ? 'bg-white/5 text-white/20 cursor-not-allowed'
                      : 'bg-[#E50914] text-white hover:bg-[#b20710] shadow-lg shadow-[#E50914]/20 active:scale-95'
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
