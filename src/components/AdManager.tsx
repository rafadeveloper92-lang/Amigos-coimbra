import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Ad } from '../types';
import { dataService } from '../services/dataService';
import { 
  Plus, Trash2, Edit2, X, ImagePlus, Save, AlertCircle, 
  ExternalLink, ChevronLeft, ChevronRight, LayoutGrid, List,
  MapPin, Phone
} from 'lucide-react';

export default function AdManager() {
  const [ads, setAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAd, setEditingAd] = useState<Ad | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    image_url: '',
    link_url: '',
    location: '',
    phone: ''
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAds();
  }, []);

  const fetchAds = async () => {
    setLoading(true);
    const data = await dataService.getAds();
    setAds(data);
    setLoading(false);
  };

  const handleOpenModal = (ad?: Ad) => {
    if (ad) {
      setEditingAd(ad);
      setFormData({
        title: ad.title,
        description: ad.description,
        image_url: ad.image_url,
        link_url: ad.link_url || '',
        location: ad.location || '',
        phone: ad.phone || ''
      });
      setImagePreview(ad.image_url);
    } else {
      setEditingAd(null);
      setFormData({
        title: '',
        description: '',
        image_url: '',
        link_url: '',
        location: '',
        phone: ''
      });
      setImagePreview(null);
    }
    setImageFile(null);
    setError(null);
    setIsModalOpen(true);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.description.trim()) {
      setError('Título e descrição são obrigatórios.');
      return;
    }

    if (!imagePreview && !imageFile) {
      setError('Uma imagem é obrigatória.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      let finalImageUrl = formData.image_url;
      
      if (imageFile) {
        const uploadedUrl = await dataService.uploadAdImage(imageFile);
        if (uploadedUrl) {
          finalImageUrl = uploadedUrl;
        } else {
          throw new Error('Falha ao fazer upload da imagem.');
        }
      }

      const adData = {
        ...formData,
        image_url: finalImageUrl
      };

      if (editingAd) {
        await dataService.updateAd(editingAd.id, adData);
      } else {
        await dataService.createAd(adData);
      }
      
      setIsModalOpen(false);
      fetchAds();
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar anúncio.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await dataService.deleteAd(id);
      fetchAds();
    } catch (err: any) {
      setError(err.message || 'Erro ao excluir anúncio.');
    }
  };

  return (
    <div className="p-4 md:p-6 bg-slate-50 min-h-screen">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Gerenciador de Anúncios</h1>
            <p className="text-slate-500 text-sm">Crie e gerencie os banners de patrocínio do feed.</p>
          </div>
          <button 
            onClick={() => handleOpenModal()}
            className="flex items-center justify-center gap-2 bg-nexus-blue text-white px-6 py-3 rounded-xl font-bold shadow-lg hover:bg-nexus-blue/90 transition-all active:scale-95"
          >
            <Plus className="w-5 h-5" />
            <span>Novo Anúncio</span>
          </button>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white rounded-2xl h-64 animate-pulse border border-slate-100"></div>
            ))}
          </div>
        ) : ads.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center border-2 border-dashed border-slate-200">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <LayoutGrid className="w-10 h-10 text-slate-300" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Nenhum anúncio cadastrado</h3>
            <p className="text-slate-500 max-w-xs mx-auto mb-6">Comece criando seu primeiro banner de patrocínio para exibir no topo do feed.</p>
            <button 
              onClick={() => handleOpenModal()}
              className="text-nexus-blue font-bold hover:underline"
            >
              Criar agora
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {ads.map(ad => (
              <motion.div 
                layout
                key={ad.id}
                className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-100 group flex flex-col h-full"
              >
                <div className="relative h-40 overflow-hidden">
                  <img 
                    src={ad.image_url} 
                    alt={ad.title} 
                    className="w-full h-full object-cover transition-transform group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button 
                      onClick={() => handleOpenModal(ad)}
                      className="p-2 bg-white rounded-full text-slate-900 shadow-lg hover:scale-110 transition-transform"
                    >
                      <Edit2 className="w-5 h-5" />
                    </button>
                    <button 
                      onClick={() => handleDelete(ad.id)}
                      className="p-2 bg-white rounded-full text-red-600 shadow-lg hover:scale-110 transition-transform"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
                <div className="p-4 flex-1 flex flex-col">
                  <h3 className="font-bold text-slate-900 mb-1 line-clamp-1">{ad.title}</h3>
                  <p className="text-slate-500 text-sm line-clamp-2 mb-3 flex-1">{ad.description}</p>
                  
                  <div className="flex flex-wrap gap-3 mb-4">
                    {ad.location && (
                      <div className="flex items-center gap-1 text-[10px] text-slate-400">
                        <MapPin className="w-3 h-3" />
                        <span>{ad.location}</span>
                      </div>
                    )}
                    {ad.phone && (
                      <div className="flex items-center gap-1 text-[10px] text-slate-400">
                        <Phone className="w-3 h-3" />
                        <span>{ad.phone}</span>
                      </div>
                    )}
                  </div>

                  {ad.link_url && (
                    <div className="flex items-center gap-2 text-xs text-nexus-blue font-medium bg-blue-50 p-2 rounded-lg truncate">
                      <ExternalLink className="w-3 h-3 shrink-0" />
                      <span className="truncate">{ad.link_url}</span>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Modal de Cadastro */}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between shrink-0">
                <h2 className="text-xl font-bold text-slate-900">
                  {editingAd ? 'Editar Anúncio' : 'Novo Anúncio'}
                </h2>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                  <X className="w-6 h-6 text-slate-400" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6">
                {error && (
                  <div className="p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 text-red-700 text-sm">
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    <p>{error}</p>
                  </div>
                )}

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Imagem do Banner</label>
                    <div 
                      onClick={() => document.getElementById('ad-image-input')?.click()}
                      className="relative h-48 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl overflow-hidden cursor-pointer hover:border-nexus-blue/40 transition-all group"
                    >
                      {imagePreview ? (
                        <>
                          <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <div className="bg-white/20 backdrop-blur-md p-3 rounded-full">
                              <ImagePlus className="w-6 h-6 text-white" />
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 gap-2">
                          <ImagePlus className="w-10 h-10" />
                          <span className="text-xs font-bold uppercase tracking-widest">Upar Imagem</span>
                        </div>
                      )}
                      <input 
                        id="ad-image-input"
                        type="file" 
                        accept="image/*" 
                        onChange={handleImageChange}
                        className="hidden" 
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Título do Anúncio</label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      placeholder="Ex: Patrocínio: Ganhe Prêmios!"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 focus:ring-2 focus:ring-nexus-blue/20 focus:border-nexus-blue outline-none transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Descrição / Chamada</label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Descreva o que o usuário vai encontrar ao clicar..."
                      rows={3}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 focus:ring-2 focus:ring-nexus-blue/20 focus:border-nexus-blue outline-none transition-all resize-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Link de Destino (Opcional)</label>
                    <input
                      type="url"
                      value={formData.link_url}
                      onChange={(e) => setFormData({ ...formData, link_url: e.target.value })}
                      placeholder="https://exemplo.com"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 focus:ring-2 focus:ring-nexus-blue/20 focus:border-nexus-blue outline-none transition-all"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Localização (Opcional)</label>
                      <div className="relative">
                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                        <input
                          type="text"
                          value={formData.location}
                          onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                          placeholder="Ex: Coimbra, PT"
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-slate-900 focus:ring-2 focus:ring-nexus-blue/20 focus:border-nexus-blue outline-none transition-all"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Telefone (Opcional)</label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                        <input
                          type="text"
                          value={formData.phone}
                          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                          placeholder="Ex: +351 912 345 678"
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-slate-900 focus:ring-2 focus:ring-nexus-blue/20 focus:border-nexus-blue outline-none transition-all"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 py-4 rounded-xl font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 transition-colors uppercase text-xs tracking-widest"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 py-4 rounded-xl font-bold text-white bg-nexus-blue hover:bg-nexus-blue/90 transition-all shadow-lg flex items-center justify-center gap-2 uppercase text-xs tracking-widest"
                  >
                    {isSubmitting ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <Save className="w-5 h-5" />
                        <span>{editingAd ? 'Salvar' : 'Criar'}</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
