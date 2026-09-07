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
        className="relative overflow-hidden p-3.5 sm:p-4.5 rounded-3xl bg-white/[0.05] border border-white/[0.1] shadow-sm backdrop-blur-2xl mb-5 text-foreground"
      >
        <div className="flex items-start justify-between gap-2.5 sm:gap-3">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <div className="p-2.5 rounded-2xl bg-white/[0.08] border border-white/[0.12] text-primary shrink-0 mt-0.5 shadow-sm">
              <BellRing className="w-5 h-5" />
            </div>

            <div className="space-y-1 min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="text-xs sm:text-sm font-semibold text-foreground tracking-tight">
                  Stay in rhythm with your daily wellness
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-semibold bg-white/[0.08] text-muted-foreground border border-white/[0.12] hidden sm:inline-block">
                  Privacy-First
                </span>
              </div>

              <p className="text-[11px] sm:text-xs text-muted-foreground leading-relaxed max-w-xl">
                Receive gentle check-in reminders and daily care plan updates. We never share sensitive health data on lock screens or send spam.
              </p>

              {permissionStatus === 'denied' ? (
                <div className="pt-2 flex items-center gap-3 flex-wrap">
                  <span className="text-[11px] text-amber-400 flex items-center gap-1.5 font-medium">
                    Notifications are blocked in your browser.
                  </span>
                  <Link
                    href="/profile"
                    className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-1 underline-offset-2"
                  >
                    <Settings className="w-3 h-3" /> Go to Settings
                  </Link>
                </div>
              ) : (
                <div className="pt-2 flex items-center gap-2.5 flex-wrap">
                  <button
                    type="button"
                    onClick={handleEnable}
                    disabled={isRequesting}
                    className="px-4 py-2 rounded-full bg-primary hover:opacity-95 text-white text-xs font-semibold shadow-[inset_0_1px_0_0_rgba(255,255,255,0.22),0_2px_8px_rgba(0,0,0,0.24)] active:scale-[0.98] transition-all cursor-pointer disabled:opacity-60"
                  >
                    {isRequesting ? 'Enabling...' : 'Enable Notifications'}
                  </button>
                  <button
                    type="button"
                    onClick={handleDismiss}
                    className="px-4 py-2 rounded-full bg-white/[0.06] hover:bg-white/[0.1] text-muted-foreground hover:text-foreground text-xs font-medium transition-colors cursor-pointer active:scale-[0.98]"
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
            className="p-1 rounded-lg text-[#7c71a4] hover:text-white hover:bg-white/10 transition-colors shrink-0 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}