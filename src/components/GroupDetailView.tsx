import React, { useState, useEffect, useRef } from 'react';
import { 
  ArrowLeft, Send, Users, Lock, Shield, X, MessageCircle, User as UserIcon, LogOut,
  Gamepad2, Book, Cpu, Music, Camera, Film, Code, Coffee, Heart, Globe, Briefcase, 
  ShoppingBag, Zap, Star, Target, Rocket, Palmtree, Utensils, Dumbbell, Car, Plane, 
  Tv, Headphones, LucideIcon, Tag, Sparkles, ImagePlus, Euro, ExternalLink, MessageSquare, Maximize2,
  Phone, Mail, BadgeCheck
} from 'lucide-react';
import { Group } from '../types';
import { dataService } from '../services/dataService';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabaseClient';
import VoiceChannel from './VoiceChannel';
import { motion, AnimatePresence } from 'motion/react';

const iconMap: Record<string, LucideIcon> = {
  'Users': Users,
  'Gamepad2': Gamepad2,
  'Book': Book,
  'Cpu': Cpu,
  'Music': Music,
  'Camera': Camera,
  'Film': Film,
  'Code': Code,
  'Coffee': Coffee,
  'Heart': Heart,
  'Globe': Globe,
  'Briefcase': Briefcase,
  'ShoppingBag': ShoppingBag,
  'Zap': Zap,
  'Star': Star,
  'Shield': Shield,
  'Target': Target,
  'Rocket': Rocket,
  'Palmtree': Palmtree,
  'Utensils': Utensils,
  'Dumbbell': Dumbbell,
  'Car': Car,
  'Plane': Plane,
  'Tv': Tv,
  'Headphones': Headphones,
};

interface GroupDetailViewProps {
  group: Group;
  onBack: () => void;
  onViewProfile?: (userId: string) => void;
  onSendMessage?: (userId: string) => void;
}

const COUNTRIES = [
  { name: 'Portugal', flag: '🇵🇹', code: 'PT' },
  { name: 'Brasil', flag: '🇧🇷', code: 'BR' },
  { name: 'Espanha', flag: '🇪🇸', code: 'ES' },
  { name: 'França', flag: '🇫🇷', code: 'FR' },
  { name: 'Alemanha', flag: '🇩🇪', code: 'DE' },
  { name: 'Reino Unido', flag: '🇬🇧', code: 'UK' },
  { name: 'EUA', flag: '🇺🇸', code: 'US' },
  { name: 'Suíça', flag: '🇨🇭', code: 'CH' },
  { name: 'Luxemburgo', flag: '🇱🇺', code: 'LU' },
  { name: 'Angola', flag: '🇦🇴', code: 'AO' },
  { name: 'Moçambique', flag: '🇲🇿', code: 'MZ' },
];

export default function GroupDetailView({ group, onBack, onViewProfile, onSendMessage }: GroupDetailViewProps) {
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [members, setMembers] = useState<any[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  
  // Announcement state
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementDesc, setAnnouncementDesc] = useState('');
  const [announcementPrice, setAnnouncementPrice] = useState('');
  const [announcementImages, setAnnouncementImages] = useState<File[]>([]);
  const [isSubmittingAnnouncement, setIsSubmittingAnnouncement] = useState(false);
  const [announcementError, setAnnouncementError] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // Job Opportunity state
  const [showJobModal, setShowJobModal] = useState(false);
  const [jobForm, setJobForm] = useState({
    title: '',
    description: '',
    contract: 'Contrato',
    hours: '',
    location: '',
    salary: '',
    workedHours: '',
    country: 'Portugal',
    phone: '',
    email: ''
  });
  const [isPostingJob, setIsPostingJob] = useState(false);
  const [jobError, setJobError] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<'admin' | 'member' | null>(null);

  const handlePostJob = async () => {
    if (!jobForm.title.trim() || !jobForm.description.trim()) return;
    setIsPostingJob(true);
    setJobError(null);

    try {
      const jobData = {
        ...jobForm,
        author_name: displayName,
        created_at: new Date().toISOString()
      };

      const content = `[JOB_OPPORTUNITY]${JSON.stringify(jobData)}`;
      await dataService.sendGroupMessage(group.id, user?.id, displayName, content);
      
      fetchMessages();
      setShowJobModal(false);
      setJobForm({
        title: '',
        description: '',
        contract: 'Contrato',
        hours: '',
        location: '',
        salary: '',
        workedHours: '',
        country: 'Portugal',
        phone: '',
        email: ''
      });
    } catch (error) {
      console.error('Error posting job:', error);
      setJobError('Erro ao publicar vaga. Tente novamente.');
    } finally {
      setIsPostingJob(false);
    }
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { profile, user } = useAuth();
  
  const Icon = iconMap[group.icon_name] || Users;

  const displayName = profile ? `${profile.first_name} ${profile.last_name}` : 'Usuário';

  const fetchUserRole = async () => {
    if (!user) return;
    
    // Check if user is the creator of the group
    if (group.created_by === user.id) {
      setUserRole('admin');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('group_members')
        .select('role')
        .match({ group_id: group.id, user_id: user.id })
        .maybeSingle();
      
      if (data) {
        setUserRole(data.role as 'admin' | 'member');
      } else {
        setUserRole('member');
      }
    } catch (error) {
      console.error('Error fetching user role:', error);
      setUserRole('member');
    }
  };

  const handleSendAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!announcementTitle.trim() || !announcementDesc.trim()) return;
    setIsSubmittingAnnouncement(true);
    setAnnouncementError(null);

    try {
      // upload images
      const imageUrls = [];
      for (const file of announcementImages) {
        const url = await dataService.uploadImage(file);
        if (url) imageUrls.push(url);
      }

      const formattedPrice = announcementPrice.trim() 
        ? (announcementPrice.includes('€') || announcementPrice.toLowerCase().includes('r$') || isNaN(Number(announcementPrice.replace(',', '.')))
            ? announcementPrice 
            : `€ ${announcementPrice}`)
        : '';

      const announcementData = {
        type: 'announcement',
        title: announcementTitle,
        description: announcementDesc,
        price: formattedPrice,
        images: imageUrls
      };

      const content = `[ANNOUNCEMENT]${JSON.stringify(announcementData)}`;
      await dataService.sendGroupMessage(group.id, user?.id, displayName, content);
      
      // Realtime will fetch the message, or we can fetch manually if realtime fails
      fetchMessages();
      setErrorMessage(null);
      
      setShowAnnouncementModal(false);
      setAnnouncementTitle('');
      setAnnouncementDesc('');
      setAnnouncementPrice('');
      setAnnouncementImages([]);
    } catch (err: any) {
      console.error('Error sending announcement:', err);
      if (err.message?.includes('too long') || err.message?.includes('varying')) {
        setAnnouncementError('Erro: O texto é muito longo. Altere a coluna "content" da tabela "group_messages" para TEXT no Supabase.');
      } else {
        setAnnouncementError('Erro ao enviar anúncio: ' + (err.message || 'Verifique o console.'));
      }
    } finally {
      setIsSubmittingAnnouncement(false);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      const remainingSlots = 3 - announcementImages.length;
      const filesToAdd = filesArray.slice(0, remainingSlots);
      setAnnouncementImages(prev => [...prev, ...filesToAdd]);
    }
  };

  const removeImage = (index: number) => {
    setAnnouncementImages(prev => prev.filter((_, i) => i !== index));
  };

  const fetchMessages = async () => {
    const data = await dataService.getGroupMessages(group.id);
    setMessages(data);
    setLoading(false);
    scrollToBottom();
  };

  const fetchMembers = async () => {
    setLoadingMembers(true);
    try {
      const data = await dataService.getGroupMembersProfiles(group.id);
      
      // If the current user is in the group, make sure they are included properly
      // if the data returned is dummy data
      if (data && data.length > 0 && data[0].id.startsWith('dummy-') && user && profile) {
        data[0] = {
          id: user.id,
          first_name: profile.first_name || 'Você',
          last_name: profile.last_name || '',
          avatar_url: profile.avatar_url,
          joined_at: new Date().toISOString(),
          role: 'admin'
        };
      }
      
      setMembers(data || []);
    } catch (error) {
      console.error("Error fetching members:", error);
      setMembers([]);
    } finally {
      setLoadingMembers(false);
    }
  };

  const handleOpenMembers = () => {
    setShowMembersModal(true);
    fetchMembers();
  };

  useEffect(() => {
    fetchMessages();
    fetchUserRole();
    
    // Mark as read when entering
    if (user) {
      dataService.updateGroupLastRead(group.id, user.id);
    }

    // Realtime subscription for new messages
    if (supabase) {
      const subscription = supabase
        .channel(`group_${group.id}`)
        .on('postgres_changes', { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'group_messages',
          filter: `group_id=eq.${group.id}`
        }, (payload) => {
          setMessages(prev => [...prev, payload.new]);
          scrollToBottom();
          
          // Mark as read when a new message arrives and we are in the group
          if (user) {
            dataService.updateGroupLastRead(group.id, user.id);
          }
        })
        .subscribe();

      return () => {
        subscription.unsubscribe();
      };
    }
  }, [group.id, user]);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    const content = newMessage;
    setNewMessage(''); // Optimistic clear

    try {
      await dataService.sendGroupMessage(group.id, user?.id, displayName, content);
      // Realtime will fetch the message, or we can fetch manually if realtime fails
      fetchMessages();
      setErrorMessage(null);
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      setErrorMessage('Erro ao enviar mensagem.');
    }
  };

  const handleLeaveGroup = async () => {
    if (!user) return;
    setIsLeaving(true);
    try {
      const success = await dataService.leaveGroup(group.id, user.id);
      if (success) {
        onBack();
      } else {
        setErrorMessage('Erro ao sair do grupo.');
      }
    } catch (error) {
      console.error('Erro ao sair do grupo:', error);
      setErrorMessage('Erro ao sair do grupo.');
    } finally {
      setIsLeaving(false);
      setShowLeaveConfirm(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto bg-white min-h-[calc(100vh-80px)] md:min-h-[calc(100vh-120px)] flex flex-col rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      {/* Header */}
      <div className={`p-3 md:p-4 ${group.color} text-white flex items-center gap-3 md:gap-4 sticky top-0 z-20 shadow-md relative overflow-hidden shrink-0`}>
        {group.cover_url && (
          <img src={group.cover_url} alt={group.name} className="absolute inset-0 w-full h-full object-cover opacity-40 mix-blend-luminosity" />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/40 to-transparent"></div>
        <button 
          onClick={onBack}
          className="p-2 hover:bg-white/20 rounded-full transition-colors relative z-10"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <div className="flex-1 relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center shrink-0">
            <Icon className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              {group.name}
              {group.is_official && <BadgeCheck className="w-5 h-5 text-blue-300" />}
              {group.password && <Lock className="w-4 h-4 opacity-80" />}
            </h2>
            <button 
              onClick={handleOpenMembers}
              className="text-sm opacity-90 flex items-center gap-1 hover:opacity-100 hover:underline transition-all"
            >
              <Users className="w-3 h-3" /> {group.members_count}
            </button>
          </div>
        </div>
        <button 
          onClick={() => setShowLeaveConfirm(true)}
          className="p-2 hover:bg-red-500/20 text-white rounded-full transition-colors flex items-center gap-2 text-xs font-bold uppercase tracking-widest relative z-10"
          title="Sair do Grupo"
        >
          <LogOut className="w-5 h-5" />
          <span className="hidden sm:inline">Sair</span>
        </button>
      </div>

      {/* Messages Area */}
      <div className="flex-1 p-4 overflow-y-auto bg-slate-50 space-y-4">
        {errorMessage && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg flex justify-between items-center text-sm">
            <span>{errorMessage}</span>
            <button onClick={() => setErrorMessage(null)} className="text-red-700 font-bold hover:text-red-900">&times;</button>
          </div>
        )}
        <div className="text-center py-6">
          {group.cover_url ? (
            <div className="w-full max-w-md mx-auto h-40 md:h-48 rounded-2xl overflow-hidden relative shadow-md mb-8 mt-2">
              <img src={group.cover_url} alt={group.name} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
              <div className="absolute bottom-4 left-0 right-0 flex justify-center">
                <div className={`w-16 h-16 rounded-full ${group.color} flex items-center justify-center text-white shadow-lg border-4 border-white`}>
                  <Icon className="w-8 h-8" />
                </div>
              </div>
            </div>
          ) : (
            <div className={`w-20 h-20 mx-auto ${group.color} rounded-full flex items-center justify-center text-white shadow-lg mb-4`}>
              <Icon className="w-10 h-10" />
            </div>
          )}
          <h3 className="text-lg font-bold text-slate-800">Bem-vindo ao grupo {group.name}!</h3>
          <p className="text-sm text-slate-500 mt-1">Este é o início do chat.</p>
        </div>

        {loading ? (
          <div className="flex justify-center p-4">
            <div className="w-6 h-6 border-2 border-nexus-blue/30 border-t-nexus-blue rounded-full animate-spin"></div>
          </div>
        ) : (
          messages.map((msg, idx) => {
            const isMe = msg.user_id === user?.id || msg.author_name === displayName;
            
            const isAnnouncement = msg.content?.startsWith('[ANNOUNCEMENT]');
            const isJob = msg.content?.startsWith('[JOB_OPPORTUNITY]');
            let announcementData = null;
            let jobData = null;
            if (isAnnouncement) {
              try {
                announcementData = JSON.parse(msg.content.replace('[ANNOUNCEMENT]', ''));
              } catch (e) {
                // ignore
              }
            }
            if (isJob) {
              try {
                jobData = JSON.parse(msg.content.replace('[JOB_OPPORTUNITY]', ''));
              } catch (e) {
                // ignore
              }
            }

            return (
              <div key={msg.id || `gmsg-${idx}`} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                <span 
                  className={`text-xs text-slate-400 font-medium mb-1 px-1 ${!isMe ? 'cursor-pointer hover:underline hover:text-nexus-blue' : ''}`}
                  onClick={() => {
                    if (!isMe && onViewProfile && msg.user_id) {
                      onViewProfile(msg.user_id);
                    }
                  }}
                >
                  {msg.author_name}
                </span>
                <div className={`max-w-[85%] sm:max-w-[80%] px-4 py-2.5 rounded-2xl ${
                  isMe 
                    ? 'bg-nexus-blue text-white rounded-tr-sm' 
                    : 'bg-white border border-slate-200 text-slate-800 rounded-tl-sm shadow-sm'
                }`}>
                  {isAnnouncement && announcementData ? (
                    <div className="flex flex-col gap-2 min-w-[200px] sm:min-w-[250px]">
                      <div className="flex items-center justify-between mb-1">
                        <span className="bg-gradient-to-r from-amber-400 to-orange-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse flex items-center gap-1 shadow-sm">
                          <Sparkles className="w-3 h-3" /> Novo Anúncio
                        </span>
                        {announcementData.price && (
                          <span className={`font-bold text-sm flex items-center gap-0.5 ${isMe ? 'text-white' : 'text-emerald-600'}`}>
                            {!announcementData.price.includes('€') && !announcementData.price.toLowerCase().includes('r$') && <Euro className="w-3 h-3" />}
                            {announcementData.price}
                          </span>
                        )}
                      </div>
                      <h4 className="font-bold text-base leading-tight">{announcementData.title}</h4>
                      <p className={`text-sm opacity-90 whitespace-pre-wrap break-words ${isMe ? 'text-white/90' : 'text-slate-600'}`}>
                        {announcementData.description}
                      </p>
                      {announcementData.images && announcementData.images.length > 0 && (
                        <div className={`grid gap-1 mt-2 ${announcementData.images.length === 1 ? 'grid-cols-1' : announcementData.images.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                          {announcementData.images.map((img: string, i: number) => (
                            <div key={i} className="relative group/img cursor-zoom-in" onClick={() => setSelectedImage(img)}>
                              <img src={img} alt="Anúncio" className="w-full h-24 object-cover rounded-lg" />
                              <div className="absolute inset-0 bg-black/20 opacity-0 group-hover/img:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                                <Maximize2 className="w-5 h-5 text-white" />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      
                      {!isMe && (
                        <button 
                          onClick={() => {
                            if (onViewProfile && msg.user_id) {
                              onViewProfile(msg.user_id);
                            }
                          }}
                          className={`mt-2 w-full py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                            isMe 
                              ? 'bg-white/20 hover:bg-white/30 border border-white/30 text-white' 
                              : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-200'
                          }`}
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          Contatar Vendedor
                        </button>
                      )}
                    </div>
                  ) : isJob && jobData ? (
                    <div className="flex flex-col gap-3 min-w-[220px] sm:min-w-[280px]">
                      <div className="flex items-center justify-between">
                        <span className="bg-blue-600 text-white text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-tighter flex items-center gap-1 shadow-sm">
                          <Briefcase className="w-2.5 h-2.5" /> VAGA DE TRABALHO
                        </span>
                        <span className={`text-[10px] font-bold uppercase tracking-widest flex items-center gap-1 ${isMe ? 'text-white/70' : 'text-slate-400'}`}>
                          {COUNTRIES.find(c => c.name === jobData.country)?.flag || '🌍'} {jobData.country || 'Portugal'}
                        </span>
                      </div>
                      
                      <div className="space-y-1">
                        <h4 className="font-black text-lg leading-none uppercase tracking-tighter">{jobData.title}</h4>
                        <p className={`text-xs font-medium italic ${isMe ? 'text-white/80' : 'text-slate-500'}`}>
                          {jobData.location}
                        </p>
                      </div>

                      <div className={`grid grid-cols-2 gap-2 p-2 rounded-lg border ${isMe ? 'bg-white/10 border-white/20' : 'bg-slate-50 border-slate-200'}`}>
                        <div className="flex flex-col">
                          <span className={`text-[8px] font-bold uppercase tracking-widest ${isMe ? 'text-white/60' : 'text-slate-400'}`}>Tipo</span>
                          <span className="text-[10px] font-bold">{jobData.contract}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className={`text-[8px] font-bold uppercase tracking-widest ${isMe ? 'text-white/60' : 'text-slate-400'}`}>Horário</span>
                          <span className="text-[10px] font-bold">{jobData.hours}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className={`text-[8px] font-bold uppercase tracking-widest ${isMe ? 'text-white/60' : 'text-slate-400'}`}>Salário</span>
                          <span className="text-[10px] font-bold text-emerald-500">{jobData.salary}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className={`text-[8px] font-bold uppercase tracking-widest ${isMe ? 'text-white/60' : 'text-slate-400'}`}>Carga</span>
                          <span className="text-[10px] font-bold">{jobData.workedHours}</span>
                        </div>
                      </div>

                      {(jobData.phone || jobData.email) && (
                        <div className={`flex flex-col gap-1 p-2 rounded-lg border ${isMe ? 'bg-white/5 border-white/10' : 'bg-blue-50/50 border-blue-100'}`}>
                          {jobData.phone && (
                            <div className="flex items-center gap-2">
                              <Phone className={`w-3 h-3 ${isMe ? 'text-white/60' : 'text-blue-500'}`} />
                              <span className="text-[10px] font-bold">{jobData.phone}</span>
                            </div>
                          )}
                          {jobData.email && (
                            <div className="flex items-center gap-2">
                              <Mail className={`w-3 h-3 ${isMe ? 'text-white/60' : 'text-blue-500'}`} />
                              <span className="text-[10px] font-bold truncate">{jobData.email}</span>
                            </div>
                          )}
                        </div>
                      )}

                      <div className={`text-xs leading-relaxed border-l-2 pl-3 ${isMe ? 'border-white/30 text-white/90' : 'border-blue-500/30 text-slate-600'}`}>
                        {jobData.description}
                      </div>

                      {!isMe && (
                        <button 
                          onClick={() => {
                            if (onViewProfile && msg.user_id) {
                              onViewProfile(msg.user_id);
                            }
                          }}
                          className={`mt-1 py-2 rounded text-[10px] font-black uppercase tracking-tighter transition-all shadow-md flex items-center justify-center gap-2 ${
                            isMe 
                              ? 'bg-white/20 text-white hover:bg-white/30' 
                              : 'bg-blue-600 text-white hover:bg-blue-700'
                          }`}
                        >
                          <ExternalLink className="w-3 h-3" /> CANDIDATAR-SE AGORA
                        </button>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
                      {msg.content}
                    </p>
                  )}
                </div>
                <span className="text-[10px] text-slate-400 mt-1 px-1">
                  {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            );
          })
        )}
        {group.is_voice && profile && (
          <VoiceChannel 
            groupId={group.id} 
            profile={profile} 
            isAdmin={userRole === 'admin'} 
            groupCreatorId={group.created_by}
          />
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white border-t border-slate-100">
        <form onSubmit={handleSendMessage} className="flex gap-2">
          {group.is_sales && (
            <button
              type="button"
              onClick={() => setShowAnnouncementModal(true)}
              className="bg-amber-100 text-amber-600 p-3 rounded-full hover:bg-amber-200 transition-colors shadow-sm shrink-0"
              title="Criar Anúncio"
            >
              <Tag className="w-5 h-5" />
            </button>
          )}
          {group.is_jobs && (
            <button
              type="button"
              onClick={() => setShowJobModal(true)}
              className="bg-blue-100 text-blue-600 p-3 rounded-full hover:bg-blue-200 transition-colors shadow-sm shrink-0"
              title="Postar Vaga"
            >
              <Briefcase className="w-5 h-5" />
            </button>
          )}
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Digite sua mensagem..."
            className="flex-1 bg-slate-50 border border-slate-200 rounded-full px-4 sm:px-6 py-3 text-sm focus:outline-none focus:border-nexus-blue focus:ring-1 focus:ring-nexus-blue transition-all"
          />
          <button 
            type="submit"
            disabled={!newMessage.trim()}
            className="bg-nexus-blue text-white p-3 rounded-full hover:bg-nexus-blue/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md shrink-0"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
      </div>

      {/* Announcement Modal */}
      {showAnnouncementModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-xl flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <Tag className="w-5 h-5 text-amber-500" />
                Criar Anúncio
              </h3>
              <button 
                onClick={() => setShowAnnouncementModal(false)}
                className="p-2 hover:bg-slate-200 rounded-full transition-colors"
                disabled={isSubmittingAnnouncement}
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            
            <div className="p-4 overflow-y-auto flex-1">
              {announcementError && (
                <div className="mb-4 bg-red-50 border-l-4 border-red-500 p-3 rounded-r-lg flex items-start gap-2">
                  <Shield className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700">{announcementError}</p>
                </div>
              )}
              <form id="announcement-form" onSubmit={handleSendAnnouncement} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Título do Anúncio</label>
                  <input
                    type="text"
                    required
                    value={announcementTitle}
                    onChange={(e) => setAnnouncementTitle(e.target.value)}
                    placeholder="Ex: Vendo Bicicleta Aro 29"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-nexus-blue focus:ring-1 focus:ring-nexus-blue transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Preço (Opcional)</label>
                  <input
                    type="text"
                    value={announcementPrice}
                    onChange={(e) => setAnnouncementPrice(e.target.value)}
                    placeholder="Ex: 500 ou Doação"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-nexus-blue focus:ring-1 focus:ring-nexus-blue transition-all"
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                    <Euro className="w-4 h-4" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Descrição</label>
                  <textarea
                    required
                    value={announcementDesc}
                    onChange={(e) => setAnnouncementDesc(e.target.value)}
                    placeholder="Descreva o item, estado de conservação, etc..."
                    rows={3}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-nexus-blue focus:ring-1 focus:ring-nexus-blue transition-all resize-none"
                  ></textarea>
                </div>
                
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-sm font-medium text-slate-700">Fotos (Máx 3)</label>
                    <span className="text-xs text-slate-500">{announcementImages.length}/3</span>
                  </div>
                  
                  {announcementImages.length < 3 && (
                    <div className="mb-3">
                      <input
                        type="file"
                        id="announcement-images"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={handleImageSelect}
                        disabled={isSubmittingAnnouncement}
                      />
                      <label 
                        htmlFor="announcement-images"
                        className="flex items-center justify-center gap-2 w-full py-3 border-2 border-dashed border-slate-300 rounded-xl text-slate-500 hover:text-nexus-blue hover:border-nexus-blue hover:bg-slate-50 cursor-pointer transition-all"
                      >
                        <ImagePlus className="w-5 h-5" />
                        <span className="text-sm font-medium">Adicionar Fotos</span>
                      </label>
                    </div>
                  )}
                  
                  {announcementImages.length > 0 && (
                    <div className="grid grid-cols-3 gap-2">
                      {announcementImages.map((file, idx) => (
                        <div key={idx} className="relative aspect-square rounded-lg overflow-hidden border border-slate-200 group">
                          <img 
                            src={URL.createObjectURL(file)} 
                            alt={`Preview ${idx}`} 
                            className="w-full h-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => removeImage(idx)}
                            className="absolute top-1 right-1 bg-black/50 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                            disabled={isSubmittingAnnouncement}
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </form>
            </div>
            
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex gap-3">
              <button
                type="button"
                onClick={() => setShowAnnouncementModal(false)}
                className="flex-1 py-3 rounded-xl font-bold text-slate-600 hover:bg-slate-200 transition-colors"
                disabled={isSubmittingAnnouncement}
              >
                Cancelar
              </button>
              <button
                type="submit"
                form="announcement-form"
                disabled={isSubmittingAnnouncement || !announcementTitle.trim() || !announcementDesc.trim()}
                className="flex-1 py-3 rounded-xl font-bold bg-amber-500 text-white hover:bg-amber-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSubmittingAnnouncement ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Publicar
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Members Modal */}
      {showMembersModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-xl flex flex-col max-h-[80vh]">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <Users className="w-5 h-5 text-nexus-blue" />
                Membros do Grupo
              </h3>
              <button 
                onClick={() => setShowMembersModal(false)}
                className="p-2 hover:bg-slate-200 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            
            <div className="p-4 overflow-y-auto flex-1">
              {loadingMembers ? (
                <div className="flex justify-center py-8">
                  <div className="w-8 h-8 border-4 border-nexus-blue/30 border-t-nexus-blue rounded-full animate-spin"></div>
                </div>
              ) : members.length === 0 ? (
                <p className="text-center text-slate-500 py-8">Nenhum membro encontrado.</p>
              ) : (
                <div className="space-y-3">
                  {members.map((member) => (
                    <div key={member.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 hover:border-nexus-blue/30 transition-colors">
                      <div className="flex items-center gap-3 cursor-pointer" onClick={() => {
                        setShowMembersModal(false);
                        if (onViewProfile) onViewProfile(member.id);
                      }}>
                        <img 
                          src={member.avatar_url || `https://picsum.photos/seed/${member.id}/100/100`} 
                          alt={member.first_name} 
                          className="w-10 h-10 rounded-full object-cover"
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-slate-800 text-sm hover:underline">{member.first_name} {member.last_name}</p>
                            {member.role === 'admin' && (
                              <span className="bg-nexus-blue text-white text-[10px] font-bold px-1.5 py-0.5 rounded uppercase">Admin</span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500">
                            Entrou em {new Date(member.joined_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex gap-2">
                        {member.id !== user?.id && (
                          <>
                            {members.find(m => m.id === user?.id)?.role === 'admin' && (
                              <>
                                {member.role !== 'admin' && (
                                  <button 
                                    onClick={async () => {
                                      await dataService.promoteMember(group.id, member.id);
                                      fetchMembers();
                                    }}
                                    className="p-2 bg-green-100 text-green-700 hover:bg-green-200 rounded-full transition-colors"
                                    title="Promover a Admin"
                                  >
                                    <Shield className="w-4 h-4" />
                                  </button>
                                )}
                                <button 
                                  onClick={async () => {
                                    await dataService.banMember(group.id, member.id);
                                    fetchMembers();
                                  }}
                                  className="p-2 bg-red-100 text-red-700 hover:bg-red-200 rounded-full transition-colors"
                                  title="Banir do Grupo"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </>
                            )}
                            <button 
                              onClick={() => {
                                setShowMembersModal(false);
                                if (onViewProfile) onViewProfile(member.id);
                              }}
                              className="p-2 bg-white border border-slate-200 hover:border-nexus-blue hover:text-nexus-blue text-slate-600 rounded-full transition-colors"
                              title="Visitar Perfil"
                            >
                              <UserIcon className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => {
                                setShowMembersModal(false);
                                if (onSendMessage) onSendMessage(member.id);
                              }}
                              className="p-2 bg-nexus-blue text-white hover:bg-blue-700 rounded-full transition-colors"
                              title="Enviar Mensagem"
                            >
                              <MessageCircle className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Leave Confirmation Modal */}
      <AnimatePresence>
        {showLeaveConfirm && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-nexus-blue/40 backdrop-blur-sm"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-2xl w-full max-w-sm shadow-2xl border border-slate-100 overflow-hidden p-6 text-center"
            >
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <LogOut className="w-8 h-8 text-red-600" />
              </div>
              <h2 className="text-xl font-bold text-nexus-blue mb-2 uppercase tracking-tighter">Sair do Grupo</h2>
              <p className="text-sm text-slate-500 mb-6">Tem certeza que deseja sair de <strong>{group.name}</strong>?</p>
              
              <div className="flex gap-2">
                <button
                  onClick={() => setShowLeaveConfirm(false)}
                  className="flex-1 py-3 rounded-lg font-bold text-slate-500 bg-slate-50 hover:bg-slate-100 transition-colors uppercase text-xs tracking-widest border border-slate-200"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleLeaveGroup}
                  disabled={isLeaving}
                  className="flex-1 py-3 rounded-lg font-bold text-white bg-red-600 hover:bg-red-700 transition-all shadow-lg uppercase text-xs tracking-widest flex items-center justify-center gap-2"
                >
                  {isLeaving ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    'Sair'
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Image Lightbox */}
      <AnimatePresence>
        {selectedImage && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedImage(null)}
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md cursor-zoom-out"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="relative max-w-5xl w-full h-full flex items-center justify-center"
              onClick={(e) => e.stopPropagation()}
            >
              <img 
                src={selectedImage} 
                alt="Visualização ampliada" 
                className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
              />
              <button 
                onClick={() => setSelectedImage(null)}
                className="absolute top-4 right-4 p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all backdrop-blur-sm border border-white/20"
              >
                <X className="w-6 h-6" />
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Job Opportunity Modal */}
      <AnimatePresence>
        {showJobModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-4 bg-blue-600 text-white flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Briefcase className="w-5 h-5" />
                  <h2 className="text-lg font-black uppercase tracking-tighter">Postar Vaga de Trabalho</h2>
                </div>
                <button 
                  onClick={() => setShowJobModal(false)}
                  className="p-1 hover:bg-white/20 rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Título da Vaga</label>
                  <input
                    type="text"
                    value={jobForm.title}
                    onChange={(e) => setJobForm({...jobForm, title: e.target.value})}
                    placeholder="Ex: Ajudante de Cozinha, Pedreiro..."
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Tipo de Contrato</label>
                    <select
                      value={jobForm.contract}
                      onChange={(e) => setJobForm({...jobForm, contract: e.target.value})}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
                    >
                      <option value="Contrato">Contrato</option>
                      <option value="Recibos Verdes">Recibos Verdes</option>
                      <option value="Temporário">Temporário</option>
                      <option value="Informal">Informal</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Horário</label>
                    <input
                      type="text"
                      value={jobForm.hours}
                      onChange={(e) => setJobForm({...jobForm, hours: e.target.value})}
                      placeholder="Ex: 08h às 17h"
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">País</label>
                    <select
                      value={jobForm.country}
                      onChange={(e) => setJobForm({...jobForm, country: e.target.value})}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
                    >
                      {COUNTRIES.map(c => (
                        <option key={c.code} value={c.name}>{c.flag} {c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Localização (Cidade)</label>
                    <input
                      type="text"
                      value={jobForm.location}
                      onChange={(e) => setJobForm({...jobForm, location: e.target.value})}
                      placeholder="Ex: Lisboa, Porto, Braga..."
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Telefone para Contato</label>
                    <input
                      type="text"
                      value={jobForm.phone}
                      onChange={(e) => setJobForm({...jobForm, phone: e.target.value})}
                      placeholder="Ex: +351 9xx xxx xxx"
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Email para Contato</label>
                    <input
                      type="email"
                      value={jobForm.email}
                      onChange={(e) => setJobForm({...jobForm, email: e.target.value})}
                      placeholder="Ex: rh@empresa.com"
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Valor/Salário</label>
                    <input
                      type="text"
                      value={jobForm.salary}
                      onChange={(e) => setJobForm({...jobForm, salary: e.target.value})}
                      placeholder="Ex: 820€, 5€/hora"
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Carga Horária</label>
                    <input
                      type="text"
                      value={jobForm.workedHours}
                      onChange={(e) => setJobForm({...jobForm, workedHours: e.target.value})}
                      placeholder="Ex: 40h semanais"
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Descrição Detalhada</label>
                  <textarea
                    value={jobForm.description}
                    onChange={(e) => setJobForm({...jobForm, description: e.target.value})}
                    placeholder="Descreva as tarefas, requisitos e benefícios..."
                    rows={4}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none resize-none"
                  />
                </div>
              </div>

              <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-2">
                <button
                  onClick={() => setShowJobModal(false)}
                  className="flex-1 py-3 rounded-xl font-black text-slate-500 bg-white hover:bg-slate-100 transition-colors uppercase text-xs tracking-widest border border-slate-200 shadow-sm"
                >
                  Cancelar
                </button>
                <button
                  onClick={handlePostJob}
                  disabled={isPostingJob}
                  className="flex-1 py-3 rounded-xl font-black text-white bg-blue-600 hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 uppercase text-xs tracking-widest flex items-center justify-center gap-2"
                >
                  {isPostingJob ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      Publicar Vaga
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
