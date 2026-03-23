import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { dataService } from '../services/dataService';
import { motion } from 'motion/react';
import { Camera, User, MapPin, Check, AlertCircle, Loader2 } from 'lucide-react';
import Logo from './Logo';

export default function ProfileSetup() {
  const { user, checkProfile, signOut } = useAuth();
  const [loading, setLoading] = useState(false);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    username: '',
    city: '',
    gender: 'other',
  });
  
  const [dbStatus, setDbStatus] = useState<{ connected: boolean; message: string } | null>(null);

  useEffect(() => {
    dataService.checkConnection().then(setDbStatus);
  }, []);
  
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setError(null);
    
    if (name === 'username') {
      checkUsername(value);
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
        .maybeSingle(); // Use maybeSingle to avoid error if not found
      
      if (checkError) throw checkError;
      
      setCheckingUsername(false);
      setUsernameAvailable(!data);
    } catch (err: any) {
      console.error('Erro ao verificar username:', err);
      setCheckingUsername(false);
      // Se der erro (ex: tabela não existe), assumimos disponível mas logamos
      setUsernameAvailable(true);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
      setError(null);
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
    
    try {
      let avatarUrl = '';
      
      if (avatarFile) {
        const fileExt = avatarFile.name.split('.').pop();
        const fileName = `${user.id}-${Date.now()}.${fileExt}`;
        const filePath = `avatars/${fileName}`;
        
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, avatarFile);
          
        if (uploadError) {
          console.error('Erro no upload:', uploadError);
          // Não bloqueamos o cadastro se o upload falhar, apenas avisamos
          console.warn('Falha no upload da foto, continuando sem foto.');
        } else {
          const { data: { publicUrl } } = supabase.storage
            .from('avatars')
            .getPublicUrl(filePath);
          avatarUrl = publicUrl;
        }
      }
      
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          first_name: formData.firstName,
          last_name: formData.lastName,
          username: formData.username.toLowerCase(),
          city: formData.city,
          gender: formData.gender,
          avatar_url: avatarUrl,
          updated_at: new Date().toISOString(),
        });
        
      if (profileError) {
        console.error('Erro no perfil:', profileError);
        if (profileError.message.includes('relation "public.profiles" does not exist')) {
          throw new Error('A tabela "profiles" não existe no seu Supabase. Por favor, execute o script SQL fornecido.');
        }
        throw profileError;
      }
      
      // Forçar atualização do perfil no contexto
      await checkProfile();
      
    } catch (err: any) {
      console.error('Erro no cadastro:', err);
      setError(err.message || 'Ocorreu um erro ao salvar seu perfil.');
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Tenta criar um perfil básico para pular a tela
      const { error: skipError } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          first_name: user.user_metadata?.full_name?.split(' ')[0] || 'Usuário',
          last_name: user.user_metadata?.full_name?.split(' ')[1] || 'Novo',
          username: `user_${user.id.substring(0, 5)}`,
          updated_at: new Date().toISOString(),
        });
      
      if (skipError) throw skipError;
      await checkProfile();
    } catch (err: any) {
      console.error('Erro ao pular:', err);
      setError('Não foi possível pular. Verifique se a tabela "profiles" existe.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#141414] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-[#1a1a1a] w-full max-w-md rounded-2xl p-8 border border-white/10 shadow-2xl"
      >
        <div className="flex flex-col items-center mb-8">
          <Logo className="w-20 h-20 mb-4" />
          <h2 className="text-2xl font-bold text-white">Complete seu Perfil</h2>
          <p className="text-gray-400 text-sm mt-2 text-center">
            Conte-nos um pouco mais sobre você para começar.
          </p>
          
          {dbStatus && !dbStatus.connected && (
            <div className="mt-4 p-2 bg-yellow-500/10 border border-yellow-500/50 rounded-lg flex items-center gap-2">
              <AlertCircle className="text-yellow-500 w-4 h-4" />
              <p className="text-yellow-500 text-[10px]">Banco de dados não conectado. Verifique o SQL.</p>
            </div>
          )}
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/50 rounded-xl flex items-center gap-3">
            <AlertCircle className="text-red-500 w-5 h-5 shrink-0" />
            <p className="text-red-500 text-xs font-medium">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Avatar Upload */}
          <div className="flex flex-col items-center mb-6">
            <div className="relative group cursor-pointer">
              <div className="w-24 h-24 rounded-full bg-[#2a2a2a] border-2 border-dashed border-white/20 flex items-center justify-center overflow-hidden">
                {avatarPreview ? (
                  <img src={avatarPreview} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <Camera className="text-gray-500 w-8 h-8" />
                )}
              </div>
              <input 
                type="file" 
                accept="image/*" 
                onChange={handleFileChange}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              <div className="absolute bottom-0 right-0 bg-[#E50914] p-1.5 rounded-full border-2 border-[#1a1a1a]">
                <Camera className="text-white w-4 h-4" />
              </div>
            </div>
            <span className="text-xs text-gray-500 mt-2">Foto de Perfil</span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Nome</label>
              <div className="relative">
                <input
                  type="text"
                  name="firstName"
                  required
                  value={formData.firstName}
                  onChange={handleInputChange}
                  className="w-full bg-[#2a2a2a] border border-white/10 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-[#E50914] transition-colors"
                  placeholder="Seu nome"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Sobrenome</label>
              <div className="relative">
                <input
                  type="text"
                  name="lastName"
                  required
                  value={formData.lastName}
                  onChange={handleInputChange}
                  className="w-full bg-[#2a2a2a] border border-white/10 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-[#E50914] transition-colors"
                  placeholder="Sobrenome"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Nome de Usuário Único</label>
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">@</div>
              <input
                type="text"
                name="username"
                required
                value={formData.username}
                onChange={handleInputChange}
                className={`w-full bg-[#2a2a2a] border ${
                  usernameAvailable === true ? 'border-green-500' : 
                  usernameAvailable === false ? 'border-red-500' : 'border-white/10'
                } rounded-xl py-3 pl-10 pr-10 text-white focus:outline-none focus:border-[#E50914] transition-colors`}
                placeholder="username"
              />
              <div className="absolute right-4 top-1/2 -translate-y-1/2">
                {checkingUsername ? (
                  <Loader2 className="w-4 h-4 text-gray-500 animate-spin" />
                ) : usernameAvailable === true ? (
                  <Check className="w-4 h-4 text-green-500" />
                ) : usernameAvailable === false ? (
                  <AlertCircle className="w-4 h-4 text-red-500" />
                ) : null}
              </div>
            </div>
            {usernameAvailable === false && (
              <p className="text-red-500 text-[10px] mt-1">Este nome de usuário já está em uso.</p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Cidade</label>
            <div className="relative">
              <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
              <input
                type="text"
                name="city"
                required
                value={formData.city}
                onChange={handleInputChange}
                className="w-full bg-[#2a2a2a] border border-white/10 rounded-xl py-3 pl-10 px-4 text-white focus:outline-none focus:border-[#E50914] transition-colors"
                placeholder="Sua cidade"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Sexo</label>
            <select
              name="gender"
              value={formData.gender}
              onChange={handleInputChange}
              className="w-full bg-[#2a2a2a] border border-white/10 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-[#E50914] transition-colors appearance-none"
            >
              <option value="male">Masculino</option>
              <option value="female">Feminino</option>
              <option value="other">Outro / Prefiro não dizer</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={loading || !usernameAvailable}
            className="w-full bg-[#E50914] text-white font-bold py-4 rounded-xl hover:bg-[#b20710] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Salvando...
              </>
            ) : (
              'Finalizar Perfil'
            )}
          </button>

          <button
            type="button"
            onClick={handleSkip}
            disabled={loading}
            className="w-full bg-transparent text-gray-400 hover:text-white font-medium py-2 rounded-xl transition-colors text-sm"
          >
            Pular por enquanto (Preencher depois)
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-white/10 text-center">
          <button 
            onClick={() => signOut()}
            className="text-gray-500 hover:text-white text-sm transition-colors"
          >
            Sair e entrar com outra conta
          </button>
        </div>
      </motion.div>
    </div>
  );
}
