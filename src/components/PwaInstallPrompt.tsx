import { useEffect, useMemo, useState } from 'react';
import { Download, Share2, Smartphone, X } from 'lucide-react';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

const isStandaloneMode = () => {
  if (typeof window === 'undefined') return false;
  const navigatorWithStandalone = window.navigator as Navigator & { standalone?: boolean };
  return window.matchMedia('(display-mode: standalone)').matches || navigatorWithStandalone.standalone === true;
};

const isIosDevice = () => /iphone|ipad|ipod/i.test(window.navigator.userAgent);
const isSafariBrowser = () => /^((?!chrome|android).)*safari/i.test(window.navigator.userAgent);

export default function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [installed, setInstalled] = useState(false);

  const isIosManualInstall = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return isIosDevice() && isSafariBrowser() && !isStandaloneMode();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (isStandaloneMode()) {
      setInstalled(true);
      return;
    }

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
      setShowPrompt(true);
    };

    const handleAppInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
      setShowPrompt(false);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt as EventListener);
    window.addEventListener('appinstalled', handleAppInstalled);

    if (isIosManualInstall) {
      setShowPrompt(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt as EventListener);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [isIosManualInstall]);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setShowPrompt(false);
      }
    } catch (error) {
      console.error('Erro ao abrir prompt de instalação:', error);
    } finally {
      setDeferredPrompt(null);
    }
  };

  if (installed || !showPrompt || isStandaloneMode()) {
    return null;
  }

  return (
    <div className="fixed bottom-24 lg:bottom-6 left-3 right-3 lg:left-auto lg:right-6 z-[120]">
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
              onClick={() => setShowPrompt(false)}
              className="p-1.5 rounded-full hover:bg-white/15 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-4">
          {deferredPrompt ? (
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
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-slate-600">
                No iPhone: toque em <span className="font-bold">Partilhar</span> e depois em{' '}
                <span className="font-bold">Adicionar ao Ecrã principal</span>.
              </p>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-slate-100 text-slate-700 text-[11px] font-semibold">
                <Share2 className="w-3.5 h-3.5" />
                Partilhar → Adicionar ao ecrã principal
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
