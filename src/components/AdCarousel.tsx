import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Ad } from '../types';
import { dataService } from '../services/dataService';
import { ExternalLink, ChevronLeft, ChevronRight, MapPin, Phone, X } from 'lucide-react';

export default function AdCarousel() {
  const [ads, setAds] = useState<Ad[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    const fetchAds = async () => {
      const data = await dataService.getAds();
      setAds(data);
      setLoading(false);
    };
    fetchAds();
  }, []);

  useEffect(() => {
    if (ads.length <= 1) return;
    
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % ads.length);
    }, 5000);

    return () => clearInterval(timer);
  }, [ads]);

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % ads.length);
  };

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + ads.length) % ads.length);
  };

  if (loading) {
    return (
      <div className="w-full h-48 bg-slate-100 animate-pulse rounded-2xl mb-6"></div>
    );
  }

  if (ads.length === 0) return null;

  const currentAd = ads[currentIndex];

  return (
    <>
      <div 
        className="relative w-full h-48 md:h-64 mb-6 group overflow-hidden rounded-2xl shadow-lg border border-nexus-gold/20 cursor-pointer"
        onClick={() => setIsModalOpen(true)}
      >
        <AnimatePresence mode="wait">
        <motion.div
          key={currentAd.id}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.5 }}
          className="absolute inset-0"
        >
          <img 
            src={currentAd.image_url} 
            alt={currentAd.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-nexus-blue/90 via-nexus-blue/60 to-transparent flex flex-col justify-center p-6 md:p-10">
            <span className="text-nexus-gold text-[10px] uppercase tracking-[0.2em] font-black mb-2 drop-shadow-sm">Patrocinado</span>
            <h2 className="text-2xl md:text-4xl font-bold text-white mb-2 leading-tight drop-shadow-md">
              {currentAd.title}
            </h2>
            <p className="text-white/90 text-sm md:text-lg max-w-md mb-4 line-clamp-2 font-medium">
              {currentAd.description}
            </p>
            
            <div className="flex flex-wrap gap-4 mb-6">
              {currentAd.location && (
                <div className="flex items-center gap-1.5 text-white/80 text-xs font-bold">
                  <MapPin className="w-3.5 h-3.5 text-nexus-gold" />
                  <span>{currentAd.location}</span>
                </div>
              )}
              {currentAd.phone && (
                <div className="flex items-center gap-1.5 text-white/80 text-xs font-bold">
                  <Phone className="w-3.5 h-3.5 text-nexus-gold" />
                  <span>{currentAd.phone}</span>
                </div>
              )}
            </div>

            {currentAd.link_url && (
              <a 
                href={currentAd.link_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-nexus-gold hover:bg-nexus-gold/90 text-nexus-blue px-6 py-2 rounded-lg font-black text-sm transition-all w-fit shadow-lg hover:scale-105 active:scale-95 uppercase tracking-wider"
              >
                <span>Saiba Mais</span>
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
          </div>
        </motion.div>
      </AnimatePresence>

      {ads.length > 1 && (
        <>
          <button 
            onClick={handlePrev}
            className="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity z-20"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <button 
            onClick={handleNext}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity z-20"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
          
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-20">
            {ads.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentIndex(idx)}
                className={`w-2 h-2 rounded-full transition-all ${
                  idx === currentIndex ? 'bg-amber-400 w-6' : 'bg-white/40'
                }`}
              />
            ))}
          </div>
        </>
      )}
      </div>

      {/* Fullscreen Ad Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-10">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-black/90 backdrop-blur-sm"
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-5xl bg-white rounded-3xl overflow-hidden shadow-2xl flex flex-col md:flex-row max-h-[90vh]"
            >
              <button 
                onClick={() => setIsModalOpen(false)}
                className="absolute top-4 right-4 z-10 p-2 bg-black/20 hover:bg-black/40 text-white rounded-full transition-all backdrop-blur-md"
              >
                <X className="w-6 h-6" />
              </button>

              {/* Image Section */}
              <div className="w-full md:w-3/5 h-64 md:h-auto overflow-hidden bg-slate-100">
                <img 
                  src={currentAd.image_url} 
                  alt={currentAd.title}
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Content Section */}
              <div className="w-full md:w-2/5 p-6 md:p-10 flex flex-col bg-white overflow-y-auto">
                <div className="mb-auto">
                  <span className="text-nexus-blue text-[10px] uppercase tracking-[0.2em] font-black mb-2 block">Anúncio Patrocinado</span>
                  <h2 className="text-2xl md:text-4xl font-black text-slate-900 mb-4 leading-tight">
                    {currentAd.title}
                  </h2>
                  <p className="text-slate-600 text-base md:text-lg mb-8 leading-relaxed">
                    {currentAd.description}
                  </p>
                  
                  <div className="space-y-4 mb-8">
                    {currentAd.location && (
                      <div className="flex items-center gap-3 text-slate-700 font-bold">
                        <div className="p-2 bg-nexus-blue/5 rounded-lg">
                          <MapPin className="w-5 h-5 text-nexus-blue" />
                        </div>
                        <span>{currentAd.location}</span>
                      </div>
                    )}
                    {currentAd.phone && (
                      <div className="flex items-center gap-3 text-slate-700 font-bold">
                        <div className="p-2 bg-nexus-blue/5 rounded-lg">
                          <Phone className="w-5 h-5 text-nexus-blue" />
                        </div>
                        <span>{currentAd.phone}</span>
                      </div>
                    )}
                  </div>
                </div>

                {currentAd.link_url && (
                  <a 
                    href={currentAd.link_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 bg-nexus-blue hover:bg-blue-700 text-white px-8 py-4 rounded-xl font-black text-base transition-all shadow-lg hover:scale-[1.02] active:scale-[0.98] uppercase tracking-wider mt-6"
                  >
                    <span>Visitar Website</span>
                    <ExternalLink className="w-5 h-5" />
                  </a>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
