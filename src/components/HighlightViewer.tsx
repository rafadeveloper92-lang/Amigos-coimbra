import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X, ChevronLeft, ChevronRight, Plus, Trash2, MoreVertical } from 'lucide-react';
import { dataService } from '../services/dataService';
import { HighlightItem } from '../types';
import { supabase } from '../services/supabaseClient';

interface Props {
  highlightId: string;
  isOwnProfile: boolean;
  onClose: () => void;
}

export default function HighlightViewer({ highlightId, isOwnProfile, onClose }: Props) {
  const HIGHLIGHT_DURATION_MS = 5000;
  const [items, setItems] = useState<HighlightItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const progressTimerRef = useRef<NodeJS.Timeout | null>(null);

  const prevItem = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(i => i - 1);
      setProgress(0);
    }
  }, [currentIndex]);

  const nextItem = useCallback(() => {
    if (currentIndex < items.length - 1) {
      setCurrentIndex(i => i + 1);
      setProgress(0);
    } else {
      onClose();
    }
  }, [currentIndex, items.length, onClose]);

  useEffect(() => {
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }

    if (items.length === 0 || uploading) return;

    const startTime = Date.now();
    progressTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const newProgress = Math.min((elapsed / HIGHLIGHT_DURATION_MS) * 100, 100);

      if (newProgress >= 100) {
        if (progressTimerRef.current) {
          clearInterval(progressTimerRef.current);
          progressTimerRef.current = null;
        }
        nextItem();
      } else {
        setProgress(newProgress);
      }
    }, 50);

    return () => {
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current);
        progressTimerRef.current = null;
      }
    };
  }, [currentIndex, items.length, uploading, nextItem]);

  useEffect(() => {
    const fetchItems = async () => {
      try {
        const fetchedItems = await dataService.getHighlightItems(highlightId);
        setItems(fetchedItems);
      } catch (err) {
        setError('Erro ao carregar fotos.');
      }
    };
    fetchItems();
  }, [highlightId]);

  const handleAddPhotos = async (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log('handleAddPhotos chamado');
    if (!e.target.files || e.target.files.length === 0) {
      console.log('Nenhum arquivo selecionado');
      return;
    }
    
    setUploading(true);
    setError(null);
    const files = Array.from(e.target.files) as File[];
    console.log('Arquivos selecionados:', files.length);
    setUploadProgress(0);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        console.log(`Processando arquivo ${i + 1}:`, file.name, file.size);
        
        // Verifica se o arquivo é válido
        if (!file || file.size === 0) {
          console.warn('Arquivo inválido ou vazio, pulando:', file.name);
          continue;
        }

        const fileExt = file.name.split('.').pop();
        const fileName = `${highlightId}/${Math.random()}.${fileExt}`;
        
        console.log('Iniciando upload para o Supabase...');
        const { error: uploadError } = await supabase.storage
          .from('highlights')
          .upload(fileName, file);
          
        if (uploadError) {
          console.error('Erro no upload:', uploadError);
          throw uploadError;
        }
        
        const { data: { publicUrl } } = supabase.storage
          .from('highlights')
          .getPublicUrl(fileName);
          
        await dataService.addHighlightItem(highlightId, publicUrl);
        setUploadProgress(Math.round(((i + 1) / files.length) * 100));
        console.log(`Arquivo ${i + 1} enviado com sucesso`);
      }
      
      const updatedItems = await dataService.getHighlightItems(highlightId);
      setItems(updatedItems);
      setCurrentIndex(updatedItems.length - 1);
    } catch (err) {
      console.error('Error uploading files:', err);
      setError('Erro ao enviar fotos. Verifique as permissões do banco.');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDeletePhoto = async (itemId: string) => {
    try {
      await dataService.deleteHighlightItem(itemId);
      const updatedItems = items.filter(item => item.id !== itemId);
      setItems(updatedItems);
      if (currentIndex >= updatedItems.length) {
        setCurrentIndex(Math.max(0, updatedItems.length - 1));
      }
    } catch (err) {
      console.error('Error deleting file:', err);
      setError('Erro ao excluir foto.');
    }
  };

  if (items.length === 0 && !isOwnProfile) return null;

  return (
    <div className="fixed inset-0 z-[200] bg-black flex items-center justify-center">
      {/* Instagram-style Progress Bars */}
      <div className="absolute top-0 left-0 w-full p-2 flex gap-1 z-20">
        {items.map((_, index) => (
          <div key={index} className="flex-1 h-1 bg-gray-700/50 rounded-full overflow-hidden">
            <div
              className="h-full bg-white"
              style={{
                width:
                  index < currentIndex
                    ? '100%'
                    : index === currentIndex
                      ? `${progress}%`
                      : '0%',
                transition: index === currentIndex ? 'width 50ms linear' : 'none',
              }}
            />
          </div>
        ))}
      </div>

      <button 
        onClick={onClose} 
        disabled={uploading}
        className={`absolute top-8 right-4 text-white p-2 z-30 ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <X />
      </button>
      
      {items.length > 0 ? (
        <>
          {error && (
            <div className="absolute top-20 left-0 w-full text-center z-[1000]">
              <p className="bg-red-600 text-white px-4 py-2 rounded-lg inline-block">{error}</p>
            </div>
          )}
          <img 
            src={items[currentIndex].image_url} 
            className="max-h-full max-w-full object-contain" 
            alt="Story" 
          />
          
          {/* Navigation Overlay - Split into Left and Right */}
          <div className="absolute inset-0 z-10 flex pointer-events-auto">
            <div 
              className="w-1/3 h-full cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                prevItem();
              }}
            />
            <div 
              className="w-2/3 h-full cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                nextItem();
              }}
            />
          </div>

          {isOwnProfile && (
            <div className="absolute top-8 left-4 z-[1000]">
              <button 
                onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
                className="p-2 bg-black/50 text-white rounded-full hover:bg-black/70"
              >
                <MoreVertical className="w-6 h-6" />
              </button>
              {showMenu && (
                <div className="absolute top-12 left-0 bg-white rounded-lg shadow-xl p-2 w-32">
                  <button 
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      setShowConfirmDelete(true);
                      setShowMenu(false);
                    }}
                    className="flex items-center gap-2 text-red-600 w-full p-2 hover:bg-gray-100 rounded"
                  >
                    <Trash2 className="w-4 h-4" />
                    Excluir
                  </button>
                </div>
              )}
            </div>
          )}

          {showConfirmDelete && (
            <div className="absolute inset-0 z-[1001] bg-black/70 flex items-center justify-center p-4">
              <div className="bg-white rounded-xl p-6 w-full max-w-sm">
                <h3 className="text-lg font-bold mb-4 text-black">Excluir foto?</h3>
                <p className="text-gray-600 mb-6">Esta ação não pode ser desfeita.</p>
                <div className="flex gap-3">
                  <button 
                    onClick={() => setShowConfirmDelete(false)}
                    className="flex-1 py-2 rounded-lg bg-gray-200 text-gray-800 font-bold"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={() => {
                      handleDeletePhoto(items[currentIndex].id);
                      setShowConfirmDelete(false);
                    }}
                    className="flex-1 py-2 rounded-lg bg-red-600 text-white font-bold"
                  >
                    Excluir
                  </button>
                </div>
              </div>
            </div>
          )}

          {currentIndex > 0 && (
            <button 
              onClick={(e) => { e.stopPropagation(); setCurrentIndex(i => i - 1); }} 
              className="absolute left-4 text-white p-2 z-[1000] pointer-events-auto"
            >
              <ChevronLeft />
            </button>
          )}
          {currentIndex < items.length - 1 && (
            <button 
              onClick={(e) => { e.stopPropagation(); setCurrentIndex(i => i + 1); }} 
              className="absolute right-4 text-white p-2 z-[1000] pointer-events-auto"
            >
              <ChevronRight />
            </button>
          )}
        </>
      ) : (
        <div className="text-center">
          <p className="text-white mb-4">Nenhuma foto neste destaque.</p>
          {error && <p className="text-red-500">{error}</p>}
        </div>
      )}

      {isOwnProfile && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[1001]">
          <label 
            className="bg-white/95 text-nexus-blue px-4 py-2 rounded-full font-bold cursor-pointer flex items-center gap-2 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <Plus className="w-4 h-4" />
            {uploading ? `Enviando (${uploadProgress}%)...` : 'Postar mais fotos'}
            <input type="file" accept="image/*" multiple onChange={handleAddPhotos} className="hidden" />
          </label>
        </div>
      )}
      {uploading && (
        <div className="absolute inset-0 z-[1002] bg-black/50 flex items-center justify-center">
          <div className="text-white text-xl font-bold">{uploadProgress}%</div>
        </div>
      )}
    </div>
  );
}
