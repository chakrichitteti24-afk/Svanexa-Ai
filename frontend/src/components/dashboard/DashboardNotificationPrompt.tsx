'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BellRing, ShieldCheck, X, Sparkles, Settings } from 'lucide-react';
import { useNotifications } from '@/context/NotificationContext';
import Link from 'next/link';

export function DashboardNotificationPrompt() {
  const { permissionStatus, requestPushPermission } = useNotifications();
  const [isDismissed, setIsDismissed] = useState(true);
  const [isRequesting, setIsRequesting] = useState(false);

  useEffect(() => {
    try {
      const dismissedKey = 'svanexa_notif_prompt_dismissed';
      const lastDismissed = localStorage.getItem(dismissedKey);
      if (lastDismissed) {
        const timeDiff = Date.now() - parseInt(lastDismissed, 10);
        // If dismissed within last 3 days, don't show
        if (timeDiff < 3 * 24 * 60 * 60 * 1000) {
          setIsDismissed(true);
          return;
        }
      }
      setIsDismissed(false);
    } catch {
      setIsDismissed(false);
    }
  }, []);

  if (permissionStatus === 'granted' || isDismissed) {
    return null;
  }

  const handleDismiss = () => {
    setIsDismissed(true);
    try {
      localStorage.setItem('svanexa_notif_prompt_dismissed', Date.now().toString());
    } catch {}
  };

  const handleEnable = async () => {
    setIsRequesting(true);
    try {
      await requestPushPermission();
    } finally {
      setIsRequesting(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -8, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -8, scale: 0.98 }}
        transition={{ duration: 0.22 }}
        className="relative overflow-hidden p-4 sm:p-4.5 rounded-3xl bg-gradient-to-r from-violet-950/40 via-purple-900/30 to-pink-950/30 border border-purple-500/30 shadow-lg shadow-purple-950/20 backdrop-blur-md mb-5 text-foreground"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-pink-500/20 to-purple-500/20 border border-pink-500/30 text-pink-400 shrink-0 mt-0.5 shadow-sm">
              <BellRing className="w-5 h-5 animate-pulse" />
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h3 className="text-xs sm:text-sm font-bold text-white tracking-tight">
                  Stay in rhythm with your daily wellness
                </h3>
                <span className="px-2 py-0.2 rounded-full text-[9px] font-bold bg-pink-500/20 text-pink-300 border border-pink-500/30 hidden sm:inline-block">
                  Privacy-First
                </span>
              </div>

              <p className="text-[11px] sm:text-xs text-[#b4a9d9] leading-relaxed max-w-xl">
                Receive gentle check-in reminders and daily care plan updates. We never share sensitive health data on lock screens or send spam.
              </p>

              {permissionStatus === 'denied' ? (
                <div className="pt-2 flex items-center gap-3">
                  <span className="text-[11px] text-amber-400 flex items-center gap-1.5 font-medium">
                    Notifications are blocked in your browser.
                  </span>
                  <Link
                    href="/profile"
                    className="text-[11px] font-bold text-pink-300 hover:text-white flex items-center gap-1 underline underline-offset-2"
                  >
                    <Settings className="w-3 h-3" /> Go to Settings
                  </Link>
                </div>
              ) : (
                <div className="pt-2 flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={handleEnable}
                    disabled={isRequesting}
                    className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 hover:opacity-95 text-white text-xs font-bold shadow-md shadow-pink-500/20 active:scale-95 transition-all cursor-pointer disabled:opacity-60"
                  >
                    {isRequesting ? 'Enabling...' : 'Enable Notifications'}
                  </button>
                  <button
                    type="button"
                    onClick={handleDismiss}
                    className="px-3 py-1.5 rounded-xl bg-secondary/30 hover:bg-secondary/60 text-[#9d91c4] hover:text-white text-xs font-medium transition-colors cursor-pointer"
                  >
                    Maybe Later
                  </button>
                </div>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={handleDismiss}
            title="Dismiss"
            className="p-1 rounded-lg text-[#7c71a4] hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}