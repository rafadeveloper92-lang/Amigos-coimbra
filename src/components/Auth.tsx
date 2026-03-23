import React, { useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { motion } from 'motion/react';
import { Mail, Lock, User, AlertCircle } from 'lucide-react';
import Logo from './Logo';

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setLoading(true);
    setError(null);

    if (!supabase) {
      setError('Erro de configuração: Cliente Supabase não inicializado.');
      setLoading(false);
      return;
    }

    // Timeout de 15 segundos para evitar que fique preso
    const timeoutId = setTimeout(() => {
      if (loading) {
        setLoading(false);
        setError('A autenticação demorou muito. Verifique sua conexão e tente novamente.');
      }
    }, 15000);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: name,
            },
          },
        });
        if (error) throw error;
        alert('Cadastro realizado! Verifique seu e-mail para confirmar a sua conta antes de tentar logar.');
        setIsLogin(true);
      }
    } catch (err: any) {
      console.error('Erro de autenticação:', err);
      let message = err.message || 'Ocorreu um erro na autenticação.';
      
      if (message.includes('Email not confirmed')) {
        message = 'Seu e-mail ainda não foi confirmado. Por favor, clique no link enviado para o seu e-mail (verifique também a pasta de Spam).';
      } else if (message.includes('Invalid login credentials')) {
        message = 'E-mail ou senha incorretos. Por favor, tente novamente.';
      } else if (message.includes('rate limit')) {
        message = 'Muitas tentativas em pouco tempo. Por favor, aguarde alguns minutos.';
      }
      
      setError(message);
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-nexus-bg flex flex-col items-center justify-center p-4 font-sans">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white p-10 rounded-2xl shadow-xl border border-nexus-gold/20"
      >
        <div className="flex flex-col items-center mb-10">
          <Logo className="w-40 h-40" showText={true} />
        </div>

        {error && (
          <motion.div 
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-red-50 border border-red-100 p-3 rounded-lg flex items-center gap-3 mb-6"
          >
            <AlertCircle className="text-red-600 w-5 h-5 flex-shrink-0" />
            <p className="text-red-600 text-xs font-medium">{error}</p>
          </motion.div>
        )}

        <form onSubmit={handleAuth} className="space-y-5">
          {!isLogin && (
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 text-nexus-blue/30 w-5 h-5" />
              <input
                type="text"
                placeholder="Nome Completo"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required={!isLogin}
                className="w-full bg-slate-50 text-nexus-blue border border-slate-200 rounded-lg py-3 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-nexus-gold/50 focus:border-nexus-gold transition-all"
              />
            </div>
          )}

          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-nexus-blue/30 w-5 h-5" />
            <input
              type="email"
              placeholder="E-mail Corporativo"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-slate-50 text-nexus-blue border border-slate-200 rounded-lg py-3 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-nexus-gold/50 focus:border-nexus-gold transition-all"
            />
          </div>

          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-nexus-blue/30 w-5 h-5" />
            <input
              type="password"
              placeholder="Senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full bg-slate-50 text-nexus-blue border border-slate-200 rounded-lg py-3 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-nexus-gold/50 focus:border-nexus-gold transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-nexus-blue text-white font-bold py-3.5 rounded-lg hover:bg-nexus-blue/90 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed mt-4 shadow-lg shadow-nexus-blue/20"
          >
            {loading ? (
              <div className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                <span>Autenticando...</span>
              </div>
            ) : (
              isLogin ? 'Acessar Portal' : 'Solicitar Acesso'
            )}
          </button>
        </form>

        <div className="mt-10 text-center border-t border-slate-100 pt-6">
          <p className="text-slate-500 text-sm">
            {isLogin ? 'Não possui acesso?' : 'Já possui uma conta?'}
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-nexus-gold hover:text-nexus-gold/80 ml-1 font-bold transition-colors"
            >
              {isLogin ? 'Cadastre-se aqui.' : 'Entre aqui.'}
            </button>
          </p>
        </div>
      </motion.div>

      <div className="mt-12 text-nexus-blue/30 text-[10px] uppercase tracking-[0.2em] font-bold">
        Amigos Coimbra • União & Cultura
      </div>
    </div>
  );
}
