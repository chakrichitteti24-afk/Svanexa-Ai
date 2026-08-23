'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Bell,
  Volume2,
  CalendarHeart,
  CheckSquare,
  Droplets,
  Coins,
  Sparkles,
  ShieldCheck,
  AlertCircle,
  Play,
  Smartphone,
  BellRing,
  Sun,
  Sunset,
  Moon,
  ListTodo,
  FileHeart,
  Bot,
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { useNotifications } from '@/context/NotificationContext';
import { playWellnessChime } from '@/utils/sound-effects';
import { toast } from 'sonner';

export function NotificationSettings() {
  const {
    preferences,
    updatePreferences,
    permissionStatus,
    requestPushPermission,
    sendDeviceTestPush,
    sendTestNotification,
  } = useNotifications();

  const [isSecure, setIsSecure] = useState<boolean>(true);
  const [isIOS, setIsIOS] = useState<boolean>(false);
  const [isStandalone, setIsStandalone] = useState<boolean>(true);
  const [isTesting, setIsTesting] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsSecure(window.isSecureContext);
      const isApple = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
      setIsIOS(isApple);
      const standalone =
        window.matchMedia('(display-mode: standalone)').matches ||
        (navigator as any).standalone;
      setIsStandalone(Boolean(standalone));
    }
  }, []);

  const handleTestAlert = async () => {
    setIsTesting(true);
    try {
      await sendDeviceTestPush();
    } catch {
      toast.error('Could not send test push alert');
    } finally {
      setIsTesting(false);
    }
  };

  const isEnabled = preferences.enabled;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.18 }}
      className="p-6 rounded-3xl bg-card/60 backdrop-blur-md border border-border/40 shadow-sm space-y-6"
    >
      {/* ─────────────────────────────────────────────────────────────────
          IPHONE PWA SETUP BANNER
          ───────────────────────────────────────────────────────────────── */}
      {isIOS && !isStandalone && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-pink-500/15 via-purple-500/15 to-violet-500/15 border border-pink-500/30 flex items-start gap-3 shadow-md">
          <Smartphone className="w-5 h-5 text-pink-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-xs font-bold text-foreground">
              📱 iPhone Required Step for Lock-Screen Alerts
            </p>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Apple iOS only allows lock-screen notifications for apps added to the Home Screen.
              Tap the <strong>Share button</strong> (square with up arrow at bottom of Safari), then tap <strong>&ldquo;Add to Home Screen&rdquo;</strong> 📲 and open Svanexa from your home screen.
            </p>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────
          HEADER: MASTER NOTIFICATION SWITCH (ON / OFF)
          ───────────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-b border-border/30 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-pink-500/20 to-violet-500/20 border border-pink-500/30 text-pink-400">
            <Bell className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-foreground">Notifications</h2>
              <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                isEnabled ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-secondary/40 text-muted-foreground'
              }`}>
                {isEnabled ? 'ACTIVE' : 'MUTED'}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Control your gentle reminders and wellness updates
            </p>
          </div>
        </div>

        {/* Master ON / OFF Switch */}
        <div className="flex items-center gap-2.5">
          <span className="text-xs font-bold text-foreground">
            {isEnabled ? 'ON' : 'OFF'}
          </span>
          <Switch
            checked={isEnabled}
            onCheckedChange={(checked) => {
              updatePreferences({ enabled: checked });
              if (checked && permissionStatus !== 'granted') {
                requestPushPermission();
              }
            }}
          />
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────
          INDIVIDUAL NOTIFICATION CONTROLS
          ───────────────────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-bold text-foreground/90 uppercase tracking-wider text-muted-foreground">
            Individual Controls
          </p>
          <span className="text-[10px] text-muted-foreground">
            Saved to your profile in Supabase
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* 1. Morning Check-in */}
          <div className="p-3.5 rounded-2xl bg-secondary/15 border border-border/25 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 shrink-0">
                <Sun className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-foreground">Morning Check-in</p>
                <p className="text-[10px] text-muted-foreground">60-second morning wellness check</p>
              </div>
            </div>
            <Switch
              checked={preferences.morningCheckin ?? true}
              disabled={!isEnabled}
              onCheckedChange={(checked) => updatePreferences({ morningCheckin: checked })}
            />
          </div>

          {/* 2. Afternoon Check-in */}
          <div className="p-3.5 rounded-2xl bg-secondary/15 border border-border/25 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-orange-500/10 text-orange-400 shrink-0">
                <Sunset className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-foreground">Afternoon Check-in</p>
                <p className="text-[10px] text-muted-foreground">Midday energy & mood check</p>
              </div>
            </div>
            <Switch
              checked={preferences.afternoonCheckin ?? true}
              disabled={!isEnabled}
              onCheckedChange={(checked) => updatePreferences({ afternoonCheckin: checked })}
            />
          </div>

          {/* 3. Evening Check-in */}
          <div className="p-3.5 rounded-2xl bg-secondary/15 border border-border/25 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 shrink-0">
                <Moon className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-foreground">Evening Check-in</p>
                <p className="text-[10px] text-muted-foreground">Evening reflection & habits</p>
              </div>
            </div>
            <Switch
              checked={preferences.eveningCheckin ?? true}
              disabled={!isEnabled}
              onCheckedChange={(checked) => updatePreferences({ eveningCheckin: checked })}
            />
          </div>

          {/* 4. Wellness Tasks */}
          <div className="p-3.5 rounded-2xl bg-secondary/15 border border-border/25 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-violet-500/10 text-violet-400 shrink-0">
                <ListTodo className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-foreground">Wellness Tasks</p>
                <p className="text-[10px] text-muted-foreground">Pending daily care task reminders</p>
              </div>
            </div>
            <Switch
              checked={preferences.wellnessTasks ?? true}
              disabled={!isEnabled}
              onCheckedChange={(checked) => updatePreferences({ wellnessTasks: checked })}
            />
          </div>

          {/* 5. Wellness Plan */}
          <div className="p-3.5 rounded-2xl bg-secondary/15 border border-border/25 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 shrink-0">
                <FileHeart className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-foreground">Wellness Plan</p>
                <p className="text-[10px] text-muted-foreground">Daily personalized care plan ready</p>
              </div>
            </div>
            <Switch
              checked={preferences.wellnessPlan ?? true}
              disabled={!isEnabled}
              onCheckedChange={(checked) => updatePreferences({ wellnessPlan: checked })}
            />
          </div>

          {/* 6. Coins & Rewards */}
          <div className="p-3.5 rounded-2xl bg-secondary/15 border border-border/25 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-yellow-500/10 text-yellow-400 shrink-0">
                <Coins className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-foreground">Coins & Rewards</p>
                <p className="text-[10px] text-muted-foreground">Check-in coin reward claims</p>
              </div>
            </div>
            <Switch
              checked={preferences.coinsRewards ?? true}
              disabled={!isEnabled}
              onCheckedChange={(checked) => updatePreferences({ coinsRewards: checked })}
            />
          </div>

          {/* 7. Cycle Tracker */}
          <div className="p-3.5 rounded-2xl bg-secondary/15 border border-border/25 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-pink-500/10 text-pink-400 shrink-0">
                <CalendarHeart className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-foreground">Cycle Tracker</p>
                <p className="text-[10px] text-muted-foreground">Period forecast & phase updates</p>
              </div>
            </div>
            <Switch
              checked={preferences.cycleTracker ?? true}
              disabled={!isEnabled}
              onCheckedChange={(checked) => updatePreferences({ cycleTracker: checked })}
            />
          </div>

          {/* 8. AI Companion */}
          <div className="p-3.5 rounded-2xl bg-secondary/15 border border-border/25 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 shrink-0">
                <Bot className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-foreground">AI Companion</p>
                <p className="text-[10px] text-muted-foreground">Luna thoughts & wellness tips</p>
              </div>
            </div>
            <Switch
              checked={preferences.aiCompanion ?? true}
              disabled={!isEnabled}
              onCheckedChange={(checked) => updatePreferences({ aiCompanion: checked })}
            />
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────
          DEVICE REGISTRATION & SOUND
          ───────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
        {/* Device Push Registration Status */}
        <div className="p-3.5 rounded-2xl bg-secondary/15 border border-border/25 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-violet-500/10 text-violet-400 shrink-0">
              <Smartphone className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground">Browser / Push Status</p>
              <p className="text-[10px] text-muted-foreground">
                {permissionStatus === 'granted'
                  ? 'Push notifications enabled'
                  : permissionStatus === 'denied'
                  ? 'Blocked in browser settings'
                  : 'Permission needed'}
              </p>
            </div>
          </div>
          {permissionStatus === 'granted' ? (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1 shrink-0">
              <ShieldCheck className="w-3 h-3" /> Enabled ✅
            </span>
          ) : (
            <button
              type="button"
              onClick={requestPushPermission}
              className="px-2.5 py-1 rounded-lg bg-pink-500/20 text-pink-200 text-xs font-bold hover:bg-pink-500/30 shrink-0"
            >
              Enable
            </button>
          )}
        </div>

        {/* Sound Chime */}
        <div className="p-3.5 rounded-2xl bg-secondary/15 border border-border/25 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-pink-500/10 text-pink-400 shrink-0">
              <Volume2 className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground">Sound & Chime</p>
              <button
                type="button"
                onClick={playWellnessChime}
                className="text-[10px] font-semibold text-pink-400 hover:text-pink-300 flex items-center gap-1 mt-0.5"
              >
                <Play className="w-2.5 h-2.5" /> Play Chime
              </button>
            </div>
          </div>
          <Switch
            checked={preferences.soundEnabled}
            disabled={!isEnabled}
            onCheckedChange={(checked) => updatePreferences({ soundEnabled: checked })}
          />
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────
          LIVE TESTING SECTION
          ───────────────────────────────────────────────────────────────── */}
      <div className="pt-2 border-t border-border/30 space-y-2.5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <BellRing className="w-3.5 h-3.5 text-pink-400" /> Test Delivery
            </h3>
            <p className="text-[10px] text-muted-foreground">
              Send a test notification to your current device.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleTestAlert}
              disabled={isTesting}
              className="px-3 py-1.5 rounded-xl bg-pink-500/15 hover:bg-pink-500/25 border border-pink-500/30 text-pink-300 text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer disabled:opacity-50"
            >
              <Smartphone className="w-3.5 h-3.5" /> {isTesting ? 'Sending...' : 'Send Test Alert'}
            </button>
            <button
              type="button"
              onClick={sendTestNotification}
              className="px-3 py-1.5 rounded-xl bg-secondary/30 hover:bg-secondary/50 border border-border/40 text-muted-foreground hover:text-foreground text-xs font-semibold transition-all active:scale-95 cursor-pointer"
            >
              In-App Alert
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}