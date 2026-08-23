'use client';

import React from 'react';
import { motion } from 'framer-motion';
import {
  Bell,
  Volume2,
  CalendarHeart,
  CheckSquare,
  Droplets,
  Pill,
  Send,
  ShieldCheck,
  AlertCircle,
  Play,
  Smartphone,
  BellRing,
  Timer,
  Clock,
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { useNotifications } from '@/context/NotificationContext';
import { playWellnessChime } from '@/utils/sound-effects';

export function NotificationSettings() {
  const {
    preferences,
    updatePreferences,
    permissionStatus,
    isPushSubscribed,
    requestPushPermission,
    sendTestNotification,
    sendDeviceTestPush,
    scheduleReminderPush,
    simulateMissedCheckinAlert,
  } = useNotifications();

  const [countdown, setCountdown] = React.useState<number | null>(null);
  const [isSecure, setIsSecure] = React.useState<boolean>(true);

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsSecure(window.isSecureContext);
    }
  }, []);

  React.useEffect(() => {
    if (countdown === null || countdown <= 0) {
      if (countdown === 0) {
        setCountdown(null);
      }
      return;
    }
    const timer = setTimeout(() => {
      setCountdown((prev) => (prev !== null && prev > 0 ? prev - 1 : null));
    }, 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const handleStartCountdown = (seconds: number) => {
    setCountdown(seconds);
    scheduleReminderPush(seconds);
  };

  const currentInterval = preferences.recurringIntervalMinutes || 5;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.18 }}
      className="p-6 rounded-3xl bg-card/60 backdrop-blur-md border border-border/40 shadow-sm space-y-6"
    >
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
              <h2 className="text-sm font-bold text-foreground">Notifications & Reminders</h2>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-violet-500/20 text-violet-300 border border-violet-500/30">
                CORE FEATURE
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Gentle health check-in reminders so you never forget your wellness routine
            </p>
          </div>
        </div>

        {/* Master ON / OFF Switch */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-foreground">
            {preferences.enabled ? 'ON' : 'OFF'}
          </span>
          <Switch
            checked={preferences.enabled}
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
          MAIN CORE OPTION: 5m / 10m / 30m / 1h REPEATING REMINDER TIMER
          ───────────────────────────────────────────────────────────────── */}
      <div className="p-4 rounded-2xl bg-gradient-to-br from-violet-500/15 via-purple-500/10 to-pink-500/10 border border-violet-500/30 space-y-3.5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-violet-500/20 text-violet-300 shrink-0 mt-0.5">
              <Timer className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-bold text-foreground">
                  Check-In Reminder Timer Interval
                </h3>
                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-violet-500/25 text-violet-200 border border-violet-500/35">
                  Default: 5 Min
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">
                When daily check-in is pending, Svanexa will gently notify your phone every{' '}
                <strong className="text-violet-300">
                  {currentInterval >= 60 ? '1 hour' : `${currentInterval} minutes`}
                </strong>{' '}
                until completed.
              </p>
            </div>
          </div>

          {/* Repeat On/Off Switch */}
          <Switch
            checked={preferences.repeatUntilCheckinComplete ?? true}
            disabled={!preferences.enabled}
            onCheckedChange={(checked) =>
              updatePreferences({ repeatUntilCheckinComplete: checked })
            }
          />
        </div>

        {/* Timer Interval Selector: 5m, 10m, 30m, 1h */}
        <div className="space-y-1.5 pt-1 border-t border-border/20">
          <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">
            Choose Reminder Interval:
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { label: '5 Min (Default)', value: 5 },
              { label: '10 Min', value: 10 },
              { label: '30 Min', value: 30 },
              { label: '1 Hour', value: 60 },
            ].map((item) => {
              const isSelected = currentInterval === item.value;
              return (
                <button
                  key={item.value}
                  type="button"
                  disabled={!preferences.enabled || !preferences.repeatUntilCheckinComplete}
                  onClick={() => updatePreferences({ recurringIntervalMinutes: item.value })}
                  className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border text-center ${
                    isSelected
                      ? 'bg-violet-500/30 border-violet-500 text-violet-200 shadow-sm'
                      : 'bg-card/60 border-border/40 text-muted-foreground hover:bg-secondary/60 hover:text-foreground'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────
          DEVICE REGISTRATION & SOUND
          ───────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        {/* Device Registration Status */}
        <div className="p-3.5 rounded-2xl bg-secondary/15 border border-border/25 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-violet-500/10 text-violet-400 shrink-0">
              <Smartphone className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground">Phone Registration</p>
              <p className="text-[10px] text-muted-foreground">
                {permissionStatus === 'granted'
                  ? 'This device is registered for push alerts'
                  : 'Tap button to enable push on this device'}
              </p>
            </div>
          </div>
          {permissionStatus === 'granted' ? (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1 shrink-0">
              <ShieldCheck className="w-3 h-3" /> Active ✅
            </span>
          ) : (
            <button
              type="button"
              onClick={requestPushPermission}
              className="px-2.5 py-1 rounded-lg bg-violet-500/20 text-violet-200 text-xs font-bold hover:bg-violet-500/30 shrink-0"
            >
              Enable
            </button>
          )}
        </div>

        {/* Wellness Sound Chime */}
        <div className="p-3.5 rounded-2xl bg-secondary/15 border border-border/25 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-pink-500/10 text-pink-400 shrink-0">
              <Volume2 className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground">Wellness Sound Chime</p>
              <button
                type="button"
                onClick={playWellnessChime}
                className="text-[10px] font-semibold text-pink-400 hover:text-pink-300 flex items-center gap-1 mt-0.5"
              >
                <Play className="w-2.5 h-2.5" /> Test Sound
              </button>
            </div>
          </div>
          <Switch
            checked={preferences.soundEnabled}
            disabled={!preferences.enabled}
            onCheckedChange={(checked) => updatePreferences({ soundEnabled: checked })}
          />
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────
          CATEGORY TOGGLES
          ───────────────────────────────────────────────────────────────── */}
      <div className="space-y-2.5 pt-1">
        <p className="text-xs font-bold text-foreground/90 uppercase tracking-wider text-[10px] text-muted-foreground">
          Alert Categories
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Daily Check-In */}
          <div className="p-3 rounded-2xl bg-secondary/15 border border-border/25 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-violet-500/10 text-violet-400">
                <CheckSquare className="w-3.5 h-3.5" />
              </div>
              <div>
                <p className="text-xs font-semibold text-foreground">Daily Check-In & Streak</p>
                <p className="text-[10px] text-muted-foreground">Pending check-in reminders</p>
              </div>
            </div>
            <Switch
              checked={preferences.checkinAlerts}
              disabled={!preferences.enabled}
              onCheckedChange={(checked) => updatePreferences({ checkinAlerts: checked })}
            />
          </div>

          {/* Cycle Alerts */}
          <div className="p-3 rounded-2xl bg-secondary/15 border border-border/25 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-pink-500/10 text-pink-400">
                <CalendarHeart className="w-3.5 h-3.5" />
              </div>
              <div>
                <p className="text-xs font-semibold text-foreground">Cycle & Forecasts</p>
                <p className="text-[10px] text-muted-foreground">Period predictions & fertile window</p>
              </div>
            </div>
            <Switch
              checked={preferences.cycleAlerts}
              disabled={!preferences.enabled}
              onCheckedChange={(checked) => updatePreferences({ cycleAlerts: checked })}
            />
          </div>

          {/* Hydration */}
          <div className="p-3 rounded-2xl bg-secondary/15 border border-border/25 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400">
                <Droplets className="w-3.5 h-3.5" />
              </div>
              <div>
                <p className="text-xs font-semibold text-foreground">Hydration Alerts</p>
                <p className="text-[10px] text-muted-foreground">Daily water progress reminders</p>
              </div>
            </div>
            <Switch
              checked={preferences.hydrationAlerts}
              disabled={!preferences.enabled}
              onCheckedChange={(checked) => updatePreferences({ hydrationAlerts: checked })}
            />
          </div>

          {/* Supplements */}
          <div className="p-3 rounded-2xl bg-secondary/15 border border-border/25 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400">
                <Pill className="w-3.5 h-3.5" />
              </div>
              <div>
                <p className="text-xs font-semibold text-foreground">Supplements & Care</p>
                <p className="text-[10px] text-muted-foreground">Inositol, vitamins & herbs</p>
              </div>
            </div>
            <Switch
              checked={preferences.supplementAlerts}
              disabled={!preferences.enabled}
              onCheckedChange={(checked) => updatePreferences({ supplementAlerts: checked })}
            />
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────
          LIVE TESTING SECTION
          ───────────────────────────────────────────────────────────────── */}
      <div className="pt-3 border-t border-border/30 space-y-3">
        <div>
          <h3 className="text-xs font-bold text-foreground flex items-center gap-1.5">
            <BellRing className="w-3.5 h-3.5 text-pink-400" /> Test Notification Delivery
          </h3>
          <p className="text-[11px] text-muted-foreground">
            Test how gentle check-in reminders arrive on your phone lock screen.
          </p>
        </div>

        {/* Warning if on plain HTTP on mobile */}
        {!isSecure && (
          <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              ⚠️ Mobile browsers require HTTPS for push notifications. For phone testing, please use your Vercel URL (<strong>https://...vercel.app</strong>).
            </p>
          </div>
        )}

        {/* Active Live Countdown Banner */}
        {countdown !== null && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-3.5 rounded-2xl bg-gradient-to-r from-violet-500/20 via-purple-500/20 to-pink-500/20 border border-violet-500/40 flex items-center justify-between gap-3 shadow-lg"
          >
            <div className="flex items-center gap-2.5">
              <Clock className="w-5 h-5 text-violet-300 animate-pulse" />
              <div>
                <p className="text-xs font-bold text-violet-200">
                  ⏱️ Reminder Armed! Lock phone now.
                </p>
                <p className="text-[10px] text-muted-foreground">Notification arriving in:</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-base font-black text-pink-300 bg-background/60 px-2.5 py-0.5 rounded-lg border border-pink-500/30">
                {Math.floor(countdown / 60)}:{String(countdown % 60).padStart(2, '0')}
              </span>
              <button
                type="button"
                onClick={() => setCountdown(null)}
                className="text-[10px] text-muted-foreground hover:text-foreground px-1.5 py-0.5"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {/* Test Right Now */}
          <button
            type="button"
            onClick={sendDeviceTestPush}
            className="px-3.5 py-2 rounded-xl bg-pink-500/15 hover:bg-pink-500/25 border border-pink-500/30 text-pink-300 text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-sm"
          >
            <Smartphone className="w-3.5 h-3.5" /> ⚡ Send Test Alert Now
          </button>

          {/* Test in 5 minutes */}
          <button
            type="button"
            onClick={() => handleStartCountdown(300)}
            className="px-3.5 py-2 rounded-xl bg-violet-500/20 hover:bg-violet-500/30 border border-violet-500/40 text-violet-200 text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-sm"
          >
            <Clock className="w-3.5 h-3.5 text-violet-400" /> ⏱️ In 5 Min (Test Lock Screen)
          </button>

          {/* Test in 10 seconds */}
          <button
            type="button"
            onClick={() => handleStartCountdown(10)}
            className="px-3 py-2 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 text-purple-300 text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-sm"
          >
            <Timer className="w-3.5 h-3.5" /> In 10s (Quick Test)
          </button>

          {/* In-App Test */}
          <button
            type="button"
            onClick={sendTestNotification}
            className="px-3 py-2 rounded-xl bg-secondary/30 hover:bg-secondary/50 border border-border/40 text-muted-foreground hover:text-foreground text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
          >
            <Send className="w-3 h-3" /> In-App Chime
          </button>
        </div>
      </div>
    </motion.div>
  );
}
