'use client';

import { useEffect, useState } from 'react';
import { Download, X, WifiOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { flushOfflineQueue } from '@/utils/offline-sync';
import { apiFetch } from '@/utils/api-client';

export function PWAInstaller() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    // Purge any stale service workers and clear CacheStorage across all mobile, tablet, and desktop clients
    if (typeof window !== 'undefined') {
      try {
        if ('serviceWorker' in navigator && typeof navigator.serviceWorker?.getRegistrations === 'function') {
          navigator.serviceWorker.getRegistrations().then((registrations) => {
            if (Array.isArray(registrations)) {
              for (const registration of registrations) {
                registration.unregister().catch(() => {});
              }
            }
          }).catch(() => {});
        }
      } catch {}

      try {
        if ('caches' in window && typeof caches?.keys === 'function') {
          caches.keys().then((keys) => {
            if (Array.isArray(keys)) {
              for (const key of keys) {
                caches.delete(key).catch(() => {});
              }
            }
          }).catch(() => {});
        }
      } catch {}
    }


    // 2. Listen for install prompt
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBanner(true);
    };

    // 3. Listen for network status & auto-flush queue
    const handleOnline = async () => {
      setIsOffline(false);
      const synced = await flushOfflineQueue(apiFetch);
      if (synced > 0) {
        toast.success(`Online! Synced ${synced} pending check-in(s).`);
      }
    };

    const handleOffline = () => {
      setIsOffline(true);
      toast.warning('You are offline. Logs will be saved locally & synced when online.');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setIsOffline(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      toast.success('Thank you for installing Svanexa AI!');
    }
    setDeferredPrompt(null);
    setShowInstallBanner(false);
  };

  return (
    <>
      {/* Offline Status Badge */}
      <AnimatePresence>
        {isOffline && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-20 left-4 right-4 md:left-auto md:right-8 z-50 bg-amber-500/90 text-slate-950 px-4 py-2.5 rounded-2xl shadow-xl backdrop-blur-md flex items-center justify-between gap-3 text-xs font-bold"
          >
            <div className="flex items-center gap-2">
              <WifiOff className="w-4 h-4" />
              <span>Offline Mode Active. Logging locally.</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* PWA Install Banner */}
      <AnimatePresence>
        {showInstallBanner && deferredPrompt && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-20 left-4 right-4 md:left-auto md:right-8 md:w-80 z-50 bg-slate-900/95 border border-purple-500/30 text-white p-4 rounded-3xl shadow-2xl backdrop-blur-2xl flex flex-col gap-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-bold text-white">Install Svanexa AI</p>
                <p className="text-[11px] text-[#9d91c4]">Add to home screen for faster access & offline logging.</p>
              </div>
              <button
                onClick={() => setShowInstallBanner(false)}
                className="text-[#9d91c4] hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <button
              onClick={handleInstallClick}
              className="w-full py-2 px-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-md flex items-center justify-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" /> Install App
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
