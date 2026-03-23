import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, Share2, Smartphone, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabaseClient';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

type InstallPromptPreference = {
  permanentlyHidden?: boolean;
  dismissedUntil?: string;
};

const PREFERENCE_KEY = 'pwa_install_prompt';
const REMIND_LATER_HOURS = 72;

const isStandaloneMode = () => {
  if (typeof window === 'undefined') return false;
  const navigatorWithStandalone = window.navigator as Navigator & { standalone?: boolean };
  return window.matchMedia('(display-mode: standalone)').matches || navigatorWithStandalone.standalone === true;
};

const isIosDevice = () => /iphone|ipad|ipod/i.test(window.navigator.userAgent);
const isSafariBrowser = () => /^((?!chrome|android).)*safari/i.test(window.navigator.userAgent);

export default function PwaInstallPrompt() {
  const { user } = useAuth();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [suppressedByPreference, setSuppressedByPreference] = useState(false);
  const [isSavingPreference, setIsSavingPreference] = useState(false);
  const [sessionDismissed, setSessionDismissed] = useState(false);

  const isIosManualInstall = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return isIosDevice() && isSafariBrowser() && !isStandaloneMode();
  }, []);

  useEffect(() => {
    const rawPreference = (user?.user_metadata?.[PREFERENCE_KEY] || null) as InstallPromptPreference | null;
    if (!rawPreference || typeof rawPreference !== 'object') {
      setSuppressedByPreference(false);
      return;
    }

    if (rawPreference.permanentlyHidden) {
      setSuppressedByPreference(true);
      return;
    }

    if (rawPreference.dismissedUntil) {
      const dismissedUntilDate = new Date(rawPreference.dismissedUntil);
      if (!Number.isNaN(dismissedUntilDate.getTime()) && dismissedUntilDate.getTime() > Date.now()) {
        setSuppressedByPreference(true);
        return;
      }
    }

    setSuppressedByPreference(false);
  }, [user?.id, user?.user_metadata]);

  const persistPreference = useCallback(async (preference: InstallPromptPreference) => {
    if (!user) return;
    setIsSavingPreference(true);
    try {
      const currentMetadata = user.user_metadata || {};
      await supabase.auth.updateUser({
        data: {
          ...currentMetadata,
          [PREFERENCE_KEY]: preference,
        },
      });
    } catch (error) {
      console.error('Erro ao salvar preferência de instalação:', error);
    } finally {
      setIsSavingPreference(false);
    }
  }, [user]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (isStandaloneMode()) {
      setInstalled(true);
      return;
    }

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
      if (!suppressedByPreference) {
        setShowPrompt(true);
      }
    };

    const handleAppInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
      setShowPrompt(false);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt as EventListener);
    window.addEventListener('appinstalled', handleAppInstalled);

    if (isIosManualInstall && !suppressedByPreference) {
      setShowPrompt(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt as EventListener);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [isIosManualInstall, suppressedByPreference]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (isStandaloneMode() || installed || suppressedByPreference || sessionDismissed) {
      return;
    }

    const timer = setTimeout(() => {
      setShowPrompt(true);
    }, 1200);

    return () => clearTimeout(timer);
  }, [installed, suppressedByPreference, sessionDismissed]);

  useEffect(() => {
    if (suppressedByPreference) {
      setShowPrompt(false);
    }
  }, [suppressedByPreference]);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setShowPrompt(false);
        setSuppressedByPreference(true);
        await persistPreference({ permanentlyHidden: true });
      }
    } catch (error) {
      console.error('Erro ao abrir prompt de instalação:', error);
    } finally {
      setDeferredPrompt(null);
    }
  };

  const handleRemindLater = async () => {
    const dismissedUntil = new Date(Date.now() + REMIND_LATER_HOURS * 60 * 60 * 1000).toISOString();
    setShowPrompt(false);
    setSuppressedByPreference(true);
    await persistPreference({ dismissedUntil });
  };

  const handleHideForever = async () => {
    setShowPrompt(false);
    setSuppressedByPreference(true);
    await persistPreference({ permanentlyHidden: true });
  };

  const handleClose = async () => {
    setSessionDismissed(true);
    setShowPrompt(false);
  };

  if (installed || !showPrompt || isStandaloneMode()) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.98 }}
        transition={{ duration: 0.24, ease: 'easeOut' }}
        className="fixed bottom-24 lg:bottom-6 left-3 right-3 lg:left-auto lg:right-6 z-[120]"
      >
        <div className="max-w-md ml-auto bg-white border border-slate-200 shadow-2xl rounded-2xl overflow-hidden">
          <div className="p-4 bg-gradient-to-r from-nexus-blue to-blue-500 text-white">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center shrink-0">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-extrabold">Instalar app Amigos Coimbra</p>
                  <p className="text-[11px] text-white/85">
                    Abra direto na tela do celular, com experiência de app nativo.
                  </p>
                </div>
              </div>
              <button
                onClick={handleClose}
                disabled={isSavingPreference}
                className="p-1.5 rounded-full hover:bg-white/15 transition-colors disabled:opacity-60"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="p-4">
            {deferredPrompt ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs text-slate-600">
                    Toque em <span className="font-bold text-slate-800">Instalar</span> para adicionar ao ecrã inicial.
                  </p>
                  <button
                    onClick={handleInstall}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-nexus-blue text-white text-xs font-bold shadow-lg hover:bg-nexus-blue/90 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Instalar
                  </button>
                </div>
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={handleRemindLater}
                    disabled={isSavingPreference}
                    className="px-3 py-1.5 rounded-full text-[11px] font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 disabled:opacity-60"
                  >
                    Lembrar depois
                  </button>
                  <button
                    onClick={handleHideForever}
                    disabled={isSavingPreference}
                    className="px-3 py-1.5 rounded-full text-[11px] font-semibold text-slate-500 hover:text-slate-700"
                  >
                    Não mostrar
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-2">
                  {isIosManualInstall ? (
                    <>
                      <p className="text-xs text-slate-600">
                        No iPhone: toque em <span className="font-bold">Partilhar</span> e depois em{' '}
                        <span className="font-bold">Adicionar ao Ecrã principal</span>.
                      </p>
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-slate-100 text-slate-700 text-[11px] font-semibold">
                        <Share2 className="w-3.5 h-3.5" />
                        Partilhar → Adicionar ao ecrã principal
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="text-xs text-slate-600">
                        Se o botão de instalar não apareceu, abra o menu do navegador (<span className="font-bold">⋮</span>)
                        e toque em <span className="font-bold">Instalar app</span> / <span className="font-bold">Adicionar ao ecrã inicial</span>.
                      </p>
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-slate-100 text-slate-700 text-[11px] font-semibold">
                        <Download className="w-3.5 h-3.5" />
                        Menu do navegador → Instalar app
                      </div>
                    </>
                  )}
                </div>
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={handleRemindLater}
                    disabled={isSavingPreference}
                    className="px-3 py-1.5 rounded-full text-[11px] font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 disabled:opacity-60"
                  >
                    Lembrar depois
                  </button>
                  <button
                    onClick={handleHideForever}
                    disabled={isSavingPreference}
                    className="px-3 py-1.5 rounded-full text-[11px] font-semibold text-slate-500 hover:text-slate-700"
                  >
                    Não mostrar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
