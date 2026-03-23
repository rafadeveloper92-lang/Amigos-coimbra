import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { User, Session } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  profile: any | null;
  profileError: string | null;
  checkProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const checkProfile = async (userId: string) => {
    setProfileError(null);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      
      if (error) {
        console.error('Erro Supabase ao buscar perfil:', error);
        setProfileError(error.message);
        setProfile(null);
        return;
      }

      if (data) {
        setProfile(data);
      } else {
        setProfile(null);
      }
    } catch (err: any) {
      console.error('Erro ao verificar perfil:', err);
      setProfileError(err.message || 'Erro desconhecido');
      setProfile(null);
    }
  };

  useEffect(() => {
    // Check active sessions and sets the user
    const getSession = async () => {
      
      // Timeout de 10 segundos para o carregamento inicial
      const timeoutId = setTimeout(() => {
        setLoading(false);
      }, 10000);
      
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          // Buscamos o perfil mas não bloqueamos o carregamento inicial do app
          checkProfile(session.user.id).finally(() => {
            clearTimeout(timeoutId);
            setLoading(false);
          });
        } else {
          clearTimeout(timeoutId);
          setLoading(false);
        }
      } catch (err) {
        console.error('Erro ao obter sessão:', err);
        clearTimeout(timeoutId);
        setLoading(false);
      }
    };

    getSession();

    // Listen for changes on auth state (logged in, signed out, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        // Buscamos o perfil mas não bloqueamos o estado de loading
        checkProfile(session.user.id).finally(() => {
          setLoading(false);
        });
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      session, 
      loading, 
      profile, 
      profileError,
      checkProfile: () => user ? checkProfile(user.id) : Promise.resolve(), 
      signOut 
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
