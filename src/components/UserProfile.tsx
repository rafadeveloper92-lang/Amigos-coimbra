import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { motion } from 'motion/react';
import { 
  Camera, MapPin, Check, AlertCircle, Loader2, ArrowLeft, Save, 
  User as UserIcon, Image as ImageIcon, Globe, Heart, Briefcase, Calendar 
} from 'lucide-react';

interface UserProfileProps {
  onBack: () => void;
}

export const nationalities = [
  { value: 'BR', label: '🇧🇷 Brasil' },
  { value: 'PT', label: '🇵🇹 Portugal' },
  { value: 'US', label: '🇺🇸 Estados Unidos' },
  { value: 'ES', label: '🇪🇸 Espanha' },
  { value: 'FR', label: '🇫🇷 França' },
  { value: 'IT', label: '🇮🇹 Itália' },
  { value: 'DE', label: '🇩🇪 Alemanha' },
  { value: 'JP', label: '🇯🇵 Japão' },
  { value: 'AO', label: '🇦🇴 Angola' },
  { value: 'MZ', label: '🇲🇿 Moçambique' },
  { value: 'CV', label: '🇨🇻 Cabo Verde' },
  { value: 'AR', label: '🇦🇷 Argentina' },
];

export const relationships = [
  { value: 'single', label: 'Solteiro(a)' },
  { value: 'dating', label: 'Em um relacionamento sério' },
  { value: 'engaged', label: 'Noivo(a)' },
  { value: 'married', label: 'Casado(a)' },
  { value: 'complicated', label: 'É complicado' },
  { value: 'open', label: 'Em um relacionamento aberto' },
];

export default function UserProfile({ onBack }: UserProfileProps) {
  const { user, profile, checkProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    firstName: profile?.first_name || '',
    lastName: profile?.last_name || '',
    username: profile?.username || '',
    city: profile?.city || '',
    gender: profile?.gender || 'other',
    bio: profile?.bio || '',
    birthdate: profile?.birthdate || '',
    nationality: profile?.nationality || 'BR',
    relationship: profile?.relationship || 'single',
    occupation: profile?.occupation || '',
  });
  
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(profile?.avatar_url || null);

  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(profile?.cover_url || null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setError(null);
    setSuccess(null);
    
    if (name === 'username' && value !== profile?.username) {
      checkUsername(value);
    } else if (name === 'username' && value === profile?.username) {
      setUsernameAvailable(true);
    }
  };

  const checkUsername = async (username: string) => {
    if (username.length < 3) {
      setUsernameAvailable(null);
      return;
    }
    
    setCheckingUsername(true);
    try {
      const { data, error: checkError } = await supabase
        .from('profiles')
        .select('username')
        .eq('username', username.toLowerCase())
        .maybeSingle();
      
      if (checkError) throw checkError;
      
      setCheckingUsername(false);
      setUsernameAvailable(!data || data.username === profile?.username);
    } catch (err: any) {
      console.error('Erro ao verificar username:', err);
      setCheckingUsername(false);
      setUsernameAvailable(true);
    }
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
      setError(null);
      setSuccess(null);
    }
  };

  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setCoverFile(file);
      setCoverPreview(URL.createObjectURL(file));
      setError(null);
      setSuccess(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setError('Usuário não autenticado.');
      return;
    }
    
    if (!usernameAvailable) {
      setError('Por favor, escolha um nome de usuário disponível.');
      return;
    }
    
    setLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      let avatarUrl = profile?.avatar_url || '';
      let coverUrl = profile?.cover_url || '';
      
      // Upload Avatar
      if (avatarFile) {
        const fileExt = avatarFile.name.split('.').pop();
        const fileName = `avatar-${user.id}-${Date.now()}.${fileExt}`;
        const filePath = `avatars/${fileName}`;
        
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, avatarFile);
          
        if (uploadError) throw new Error(`Erro no upload do avatar: ${uploadError.message}`);
        
        const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath);
        avatarUrl = publicUrl;
      }

      // Upload Cover
      if (coverFile) {
        const fileExt = coverFile.name.split('.').pop();
        const fileName = `cover-${user.id}-${Date.now()}.${fileExt}`;
        const filePath = `covers/${fileName}`;
        
        // Using 'avatars' bucket for covers too if 'covers' bucket doesn't exist, 
        // but let's try 'avatars' bucket with a 'covers/' prefix path to be safe.
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, coverFile);
          
        if (uploadError) {
          console.warn('Erro ao fazer upload da capa no bucket avatars, tentando bucket images...', uploadError);
          // Fallback to images bucket
          const { error: fallbackError } = await supabase.storage.from('images').upload(filePath, coverFile);
          if (fallbackError) throw new Error(`Erro no upload da capa: ${fallbackError.message}`);
          const { data: { publicUrl } } = supabase.storage.from('images').getPublicUrl(filePath);
          coverUrl = publicUrl;
        } else {
          const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath);
          coverUrl = publicUrl;
        }
      }
      
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          first_name: formData.firstName,
          last_name: formData.lastName,
          username: formData.username.toLowerCase(),
          city: formData.city,
          gender: formData.gender,
          avatar_url: avatarUrl,
          cover_url: coverUrl,
          bio: formData.bio,
          birthdate: formData.birthdate,
          nationality: formData.nationality,
          relationship: formData.relationship,
          occupation: formData.occupation,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);
        
      if (profileError) {
        console.error('Erro no perfil:', profileError);
        if (profileError.message.includes('column') && profileError.message.includes('does not exist')) {
          throw new Error('Erro: O banco de dados precisa ser atualizado. Adicione as colunas (bio, cover_url, birthdate, nationality, relationship, occupation) na tabela "profiles" do Supabase.');
        }
        throw profileError;
      }
      
      await checkProfile();
      setSuccess('Perfil atualizado com sucesso!');
      
    } catch (err: any) {
      console.error('Erro ao atualizar perfil:', err);
      setError(err.message || 'Ocorreu um erro ao salvar seu perfil.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto p-4 pb-24 bg-[#141414] min-h-screen text-white">
      <div className="flex items-center gap-4 mb-8">
        <button 
          onClick={onBack}
          className="p-2 hover:bg-white/10 rounded-full transition-colors"
        >
          <ArrowLeft className="w-6 h-6 text-white/70" />
        </button>
        <h2 className="text-2xl font-bold text-[#f3dd9b]">Editar Perfil</h2>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-[#1a1a1a] rounded-2xl shadow-2xl border border-white/10 overflow-hidden"
      >
        <form onSubmit={handleSubmit}>
          {/* Cover Upload */}
          <div className="relative h-48 md:h-64 bg-[#141414] group overflow-hidden">
            {coverPreview ? (
              <img src={coverPreview} alt="Cover Preview" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-r from-[#d7bb76]/25 to-[#1d4e89]/25 flex items-center justify-center">
                <ImageIcon className="w-12 h-12 text-white/20" />
              </div>
            )}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <label className="cursor-pointer bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-all">
                <Camera className="w-5 h-5" />
                Alterar Foto de Capa
                <input type="file" accept="image/*" onChange={handleCoverChange} className="hidden" />
              </label>
            </div>
          </div>

          <div className="px-6 pb-6">
            {/* Avatar Upload (Overlapping Cover) */}
            <div className="relative flex justify-center -mt-16 mb-8">
              <div className="relative group cursor-pointer">
                <div className="w-32 h-32 rounded-full bg-[#1a1a1a] border-4 border-[#141414] shadow-2xl overflow-hidden flex items-center justify-center">
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <UserIcon className="text-white/20 w-16 h-16" />
                  )}
                </div>
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={handleAvatarChange}
                  className="absolute inset-0 opacity-0 cursor-pointer z-10"
                />
                <div className="absolute bottom-1 right-1 bg-[#d7bb76] p-2 rounded-full border-4 border-[#141414] shadow-md z-20 pointer-events-none group-hover:scale-110 transition-transform">
                  <Camera className="text-[#0f172a] w-5 h-5" />
                </div>
              </div>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-500/10 border border-red-500/50 rounded-xl flex items-center gap-3">
                <AlertCircle className="text-red-500 w-5 h-5 shrink-0" />
                <p className="text-red-500 text-sm font-medium">{error}</p>
              </div>
            )}

            {success && (
              <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/50 rounded-xl flex items-center gap-3">
                <Check className="text-emerald-500 w-5 h-5 shrink-0" />
                <p className="text-emerald-500 text-sm font-medium">{success}</p>
              </div>
            )}

            <div className="space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-white/40 uppercase tracking-wider ml-1">Nome</label>
                  <input
                    type="text"
                    name="firstName"
                    required
                    value={formData.firstName}
                    onChange={handleInputChange}
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-[#d7bb76] focus:ring-2 focus:ring-[#d7bb76]/20 transition-all"
                    placeholder="Seu nome"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-white/40 uppercase tracking-wider ml-1">Sobrenome</label>
                  <input
                    type="text"
                    name="lastName"
                    required
                    value={formData.lastName}
                    onChange={handleInputChange}
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-[#d7bb76] focus:ring-2 focus:ring-[#d7bb76]/20 transition-all"
                    placeholder="Sobrenome"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-white/40 uppercase tracking-wider ml-1">Nome de Usuário</label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 font-bold">@</div>
                  <input
                    type="text"
                    name="username"
                    required
                    value={formData.username}
                    onChange={handleInputChange}
                    className={`w-full bg-white/5 border ${
                      usernameAvailable === true ? 'border-emerald-500' : 
                      usernameAvailable === false ? 'border-red-500' : 'border-white/10'
                    } rounded-xl py-3 pl-10 pr-10 text-white focus:outline-none focus:border-[#d7bb76] focus:ring-2 focus:ring-[#d7bb76]/20 transition-all`}
                    placeholder="username"
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2">
                    {checkingUsername ? (
                      <Loader2 className="w-4 h-4 text-white/40 animate-spin" />
                    ) : usernameAvailable === true ? (
                      <Check className="w-4 h-4 text-emerald-500" />
                    ) : usernameAvailable === false ? (
                      <AlertCircle className="w-4 h-4 text-red-500" />
                    ) : null}
                  </div>
                </div>
                {usernameAvailable === false && (
                  <p className="text-red-500 text-[10px] mt-1 font-bold ml-1">Este nome de usuário já está em uso.</p>
                )}
              </div>

              {/* Bio */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-white/40 uppercase tracking-wider ml-1">Biografia</label>
                <textarea
                  name="bio"
                  value={formData.bio}
                  onChange={handleInputChange}
                  rows={3}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-[#d7bb76] focus:ring-2 focus:ring-[#d7bb76]/20 transition-all resize-none"
                  placeholder="Conte um pouco sobre você..."
                />
              </div>

              {/* Personal Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-white/40 uppercase tracking-wider ml-1">Data de Nascimento</label>
                  <div className="relative">
                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 w-4 h-4" />
                    <input
                      type="date"
                      name="birthdate"
                      value={formData.birthdate}
                      onChange={handleInputChange}
                      className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 px-4 text-white focus:outline-none focus:border-[#d7bb76] focus:ring-2 focus:ring-[#d7bb76]/20 transition-all [color-scheme:dark]"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-white/40 uppercase tracking-wider ml-1">Nacionalidade</label>
                  <div className="relative">
                    <Globe className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 w-4 h-4" />
                    <select
                      name="nationality"
                      value={formData.nationality}
                      onChange={handleInputChange}
                      className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 px-4 text-white focus:outline-none focus:border-[#d7bb76] focus:ring-2 focus:ring-[#d7bb76]/20 transition-all appearance-none"
                    >
                      {nationalities.map(nat => (
                        <option key={nat.value} value={nat.value} className="bg-[#1a1a1a]">{nat.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-white/40 uppercase tracking-wider ml-1">Sexo</label>
                  <select
                    name="gender"
                    value={formData.gender}
                    onChange={handleInputChange}
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-[#d7bb76] focus:ring-2 focus:ring-[#d7bb76]/20 transition-all appearance-none"
                  >
                    <option value="male" className="bg-[#1a1a1a]">Masculino</option>
                    <option value="female" className="bg-[#1a1a1a]">Feminino</option>
                    <option value="other" className="bg-[#1a1a1a]">Outro / Prefiro não dizer</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-white/40 uppercase tracking-wider ml-1">Relacionamento</label>
                  <div className="relative">
                    <Heart className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 w-4 h-4" />
                    <select
                      name="relationship"
                      value={formData.relationship}
                      onChange={handleInputChange}
                      className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 px-4 text-white focus:outline-none focus:border-[#d7bb76] focus:ring-2 focus:ring-[#d7bb76]/20 transition-all appearance-none"
                    >
                      {relationships.map(rel => (
                        <option key={rel.value} value={rel.value} className="bg-[#1a1a1a]">{rel.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-white/40 uppercase tracking-wider ml-1">Cidade Atual</label>
                  <div className="relative">
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 w-4 h-4" />
                    <input
                      type="text"
                      name="city"
                      value={formData.city}
                      onChange={handleInputChange}
                      className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 px-4 text-white focus:outline-none focus:border-[#d7bb76] focus:ring-2 focus:ring-[#d7bb76]/20 transition-all"
                      placeholder="Sua cidade"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-white/40 uppercase tracking-wider ml-1">Profissão / Ocupação</label>
                  <div className="relative">
                    <Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 w-4 h-4" />
                    <input
                      type="text"
                      name="occupation"
                      value={formData.occupation}
                      onChange={handleInputChange}
                      className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 px-4 text-white focus:outline-none focus:border-[#d7bb76] focus:ring-2 focus:ring-[#d7bb76]/20 transition-all"
                      placeholder="Ex: Desenvolvedor, Estudante..."
                    />
                  </div>
                </div>
              </div>

              <div className="pt-6">
                <button
                  type="submit"
                  disabled={loading || !usernameAvailable}
                  className="w-full bg-gradient-to-r from-[#d7bb76] to-[#b78a37] text-[#0f172a] font-bold py-4 rounded-xl hover:from-[#e2c78f] hover:to-[#c59641] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-[#d7bb76]/25"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Salvando Alterações...
                    </>
                  ) : (
                    <>
                      <Save className="w-5 h-5" />
                      Salvar Perfil
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
