'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, Share, X, Smartphone, PlusSquare, Sparkles } from 'lucide-react';
import Image from 'next/image';
import { triggerHaptic } from '@/utils/haptics';

export function PwaInstallPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isIos] = useState(() => {
    if (typeof window !== 'undefined') {
      const userAgent = window.navigator.userAgent.toLowerCase();
      return /iphone|ipad|ipod/.test(userAgent);
    }
    return false;
  });
  const [showIosGuide, setShowIosGuide] = useState(false);

  useEffect(() => {
    // Check if already installed in standalone mode
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;

    if (isStandalone) {
      return;
    }

    // Check if user dismissed prompt in the last 7 days
    const dismissedAt = localStorage.getItem('svanexa_pwa_dismissed_at');
    if (dismissedAt) {
      const diffDays = (Date.now() - Number(dismissedAt)) / (1000 * 60 * 60 * 24);
      if (diffDays < 7) {
        return;
      }
    }

    if (isIos) {
      // Delay prompt slightly for smoother entry
      const timer = setTimeout(() => setShowPrompt(true), 3000);
      return () => clearTimeout(timer);
    }

    // Listen for beforeinstallprompt event (Android / Chromium)
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, [isIos]);

  const handleDismiss = () => {
    triggerHaptic('light');
    setShowPrompt(false);
    setShowIosGuide(false);
    localStorage.setItem('svanexa_pwa_dismissed_at', String(Date.now()));
  };

  const handleInstallClick = async () => {
    triggerHaptic('medium');
    if (isIos) {
      setShowIosGuide(true);
      return;
    }

    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        triggerHaptic('success');
      }
      setDeferredPrompt(null);
      setShowPrompt(false);
    }
  };

  if (!showPrompt) return null;

  return (
    <AnimatePresence>
      <div className="fixed bottom-20 md:bottom-6 left-4 right-4 max-w-sm mx-auto z-50 print:hidden pointer-events-auto">
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          className="p-4 rounded-3xl bg-card/95 border border-pink-500/30 backdrop-blur-2xl shadow-2xl shadow-pink-500/20 flex flex-col gap-3"
        >
          <div className="flex items-start justify-between gap-2.5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl overflow-hidden shadow-md shadow-pink-500/25 relative shrink-0 border border-pink-500/30">
                <Image src="/logo.jpg" alt="Svanexa AI" fill className="object-cover" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <span>Install Svanexa App</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-pink-500/20 text-pink-300 font-bold">
                    Fast & Offline
                  </span>
                </h4>
                <p className="text-[11px] text-muted-foreground">
                  Get full-screen native experience & instant check-in access
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleDismiss}
              className="p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* iOS Guide Expanded Step */}
          {showIosGuide && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="p-3 rounded-2xl bg-secondary/30 border border-border/30 text-xs space-y-2 text-foreground"
            >
              <p className="font-semibold text-pink-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" /> 2 Easy Steps on iPhone:
              </p>
              <div className="space-y-1 text-[11px] text-muted-foreground">
                <p className="flex items-center gap-1.5">
                  <span>1. Tap Safari&apos;s</span>
                  <Share className="w-3.5 h-3.5 text-blue-400 inline" />
                  <span className="font-semibold text-foreground">Share</span> button below.
                </p>
                <p className="flex items-center gap-1.5">
                  <span>2. Scroll down &amp; tap</span>
                  <PlusSquare className="w-3.5 h-3.5 text-pink-400 inline" />
                  <span className="font-semibold text-foreground">&quot;Add to Home Screen&quot;</span>.
                </p>
              </div>
            </motion.div>
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleInstallClick}
              className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-pink-500 to-violet-500 hover:opacity-95 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-pink-500/25 transition-all active:scale-95 cursor-pointer"
            >
              {isIos ? (
                <>
                  <Share className="w-3.5 h-3.5" />
                  <span>How to Add to Home Screen</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  <span>Install Web App</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleDismiss}
              className="py-2 px-3 rounded-xl bg-secondary/40 hover:bg-secondary/60 text-muted-foreground text-xs font-semibold transition-all cursor-pointer"
            >
              Maybe Later
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
