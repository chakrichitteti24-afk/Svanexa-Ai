'use client';

import React from 'react';
import { motion } from 'framer-motion';
import {
  Bell,
  Volume2,
  Globe,
  CalendarHeart,
  CheckSquare,
  Droplets,
  Pill,
  Sparkles,
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.18 }}
      className="p-6 rounded-3xl bg-card/60 backdrop-blur-md border border-border/40 shadow-sm space-y-6"
    >
      {/* ─────────────────────────────────────────────────────────────────
          HEADER
          ───────────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-b border-border/30 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-pink-500/10 border border-pink-500/20 text-pink-400">
            <Bell className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-foreground">Notification & Alert Settings</h2>
            <p className="text-[11px] text-muted-foreground">
              Customize cycle reminders, habit check-ins & background phone alerts
            </p>
          </div>
        </div>

        {/* Master Switch */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground hidden sm:inline">
            {preferences.enabled ? 'Enabled' : 'Disabled'}
          </span>
          <Switch
            checked={preferences.enabled}
            onCheckedChange={checked => updatePreferences({ enabled: checked })}
          />
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────
          PHONE REGISTRATION BANNER
          ───────────────────────────────────────────────────────────────── */}
      {permissionStatus !== 'granted' && (
        <div className="p-4 rounded-2xl bg-violet-500/10 border border-violet-500/30 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-violet-400 shrink-0" />
            <p className="text-xs font-bold text-violet-300">
              Register THIS Phone to Receive Notifications
            </p>
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Push notifications go to <strong>this specific device</strong>. You must click the button below on
            <strong> each phone or browser</strong> you want to receive reminders on.
          </p>
          <button
            type="button"
            onClick={requestPushPermission}
            className="w-full py-2.5 rounded-xl bg-violet-500/20 hover:bg-violet-500/30 border border-violet-500/40 text-violet-200 text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
          >
            <Smartphone className="w-4 h-4" /> 📱 Register This Phone for Push Alerts
          </button>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────
          BROWSER & PHONE PUSH NOTIFICATIONS & SOUND CUES
          ───────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        {/* Browser & Phone Push */}
        <div className="p-4 rounded-2xl bg-secondary/20 border border-border/30 flex flex-col justify-between gap-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-bold text-foreground">
              <Globe className="w-4 h-4 text-violet-400" />
              <span>Phone & Background Push</span>
            </div>
            {permissionStatus === 'granted' ? (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" /> Registered ✅
              </span>
            ) : permissionStatus === 'denied' ? (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> Blocked in Browser
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> Not Yet Registered
              </span>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Delivers alerts to <strong>this phone's</strong> lock screen & tray even when the app is completely closed.
          </p>
          {permissionStatus === 'granted' && isPushSubscribed && (
            <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-medium pt-1 border-t border-border/20">
              <ShieldCheck className="w-3 h-3" /> This device will receive daily check-in reminders
            </div>
          )}
          {permissionStatus === 'granted' && !isPushSubscribed && (
            <button
              type="button"
              onClick={requestPushPermission}
              className="mt-1 text-[10px] font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer"
            >
              <Smartphone className="w-3 h-3" /> Re-register this device
            </button>
          )}
          {permissionStatus === 'denied' && (
            <p className="text-[10px] text-rose-400 pt-1 border-t border-border/20">
              ⚠️ Blocked in browser settings. Go to browser Site Settings → Notifications → Allow for this site.
            </p>
          )}
        </div>

        {/* Audio Chime */}
        <div className="p-4 rounded-2xl bg-secondary/20 border border-border/30 flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-bold text-foreground">
              <Volume2 className="w-4 h-4 text-pink-400" />
              <span>Wellness Sound Chime</span>
            </div>
            <Switch
              checked={preferences.soundEnabled}
              disabled={!preferences.enabled}
              onCheckedChange={checked => updatePreferences({ soundEnabled: checked })}
            />
          </div>
          <div className="flex items-center justify-between">
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Gentle harmonic chime for new health reminders.
            </p>
            <button
              type="button"
              onClick={playWellnessChime}
              className="text-[10px] font-semibold text-pink-400 hover:text-pink-300 flex items-center gap-1 px-2 py-0.5 rounded-md hover:bg-pink-500/10 transition-colors shrink-0"
            >
              <Play className="w-2.5 h-2.5" /> Test Sound
            </button>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────
          GRANULAR CATEGORY TOGGLES
          ───────────────────────────────────────────────────────────────── */}
      <div className="space-y-3 pt-1">
        <p className="text-xs font-bold text-foreground/90 uppercase tracking-wider text-[10px] text-muted-foreground">
          Alert Categories
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Daily Check-In & Streak */}
          <div className="p-3.5 rounded-2xl bg-secondary/15 border border-border/25 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-violet-500/10 text-violet-400">
                <CheckSquare className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-foreground">Daily Check-In & Streak Protection</p>
                <p className="text-[10px] text-muted-foreground">Reminds you when daily check-in is pending</p>
              </div>
            </div>
            <Switch
              checked={preferences.checkinAlerts}
              disabled={!preferences.enabled}
              onCheckedChange={checked => updatePreferences({ checkinAlerts: checked })}
            />
          </div>

          {/* Core Feature: Every 5-Minute Continuous Reminder */}
          <div className="p-3.5 rounded-2xl bg-gradient-to-br from-violet-500/15 via-purple-500/10 to-pink-500/10 border border-violet-500/30 flex flex-col gap-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-violet-500/20 text-violet-300">
                  <Timer className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-bold text-foreground">Every 5-Min Gentle Reminders</p>
                    <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-violet-500/30 text-violet-200 border border-violet-500/40">
                      MAIN FEATURE
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Repeats every 5 min until check-in is logged
                  </p>
                </div>
              </div>
              <Switch
                checked={preferences.repeatUntilCheckinComplete ?? true}
                disabled={!preferences.enabled || !preferences.checkinAlerts}
                onCheckedChange={checked =>
                  updatePreferences({ repeatUntilCheckinComplete: checked })
                }
              />
            </div>
            <div className="flex items-center gap-1.5 pt-1 border-t border-border/20">
              <span className="text-[10px] text-muted-foreground font-medium">Interval:</span>
              {[5, 10, 15, 30].map(mins => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => updatePreferences({ recurringIntervalMinutes: mins })}
                  className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all ${
                    (preferences.recurringIntervalMinutes || 5) === mins
                      ? 'bg-violet-500/30 text-violet-200 border border-violet-500/50'
                      : 'bg-secondary/30 text-muted-foreground hover:bg-secondary/50'
                  }`}
                >
                  {mins} min {mins === 5 ? '(Default)' : ''}
                </button>
              ))}
            </div>
          </div>

          {/* Cycle Alerts */}
          <div className="p-3.5 rounded-2xl bg-secondary/15 border border-border/25 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-pink-500/10 text-pink-400">
                <CalendarHeart className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-foreground">Cycle & Period Forecasts</p>
                <p className="text-[10px] text-muted-foreground">2-3 day period predictions & fertile window</p>
              </div>
            </div>
            <Switch
              checked={preferences.cycleAlerts}
              disabled={!preferences.enabled}
              onCheckedChange={checked => updatePreferences({ cycleAlerts: checked })}
            />
          </div>

          {/* Hydration */}
          <div className="p-3.5 rounded-2xl bg-secondary/15 border border-border/25 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400">
                <Droplets className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-foreground">Hydration & Water Targets</p>
                <p className="text-[10px] text-muted-foreground">Afternoon water intake progress reminders</p>
              </div>
            </div>
            <Switch
              checked={preferences.hydrationAlerts}
              disabled={!preferences.enabled}
              onCheckedChange={checked => updatePreferences({ hydrationAlerts: checked })}
            />
          </div>

          {/* Supplements & Care Plan */}
          <div className="p-3.5 rounded-2xl bg-secondary/15 border border-border/25 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
                <Pill className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-foreground">PCOS & Prenatal Supplements</p>
                <p className="text-[10px] text-muted-foreground">Inositol, Vitamin D, Spearmint & vitamins</p>
              </div>
            </div>
            <Switch
              checked={preferences.supplementAlerts}
              disabled={!preferences.enabled}
              onCheckedChange={checked => updatePreferences({ supplementAlerts: checked })}
            />
          </div>

          {/* Skin Tracker */}
          <div className="p-3.5 rounded-2xl bg-secondary/15 border border-border/25 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-foreground">Skin Health & Evening Routine</p>
                <p className="text-[10px] text-muted-foreground">Evening flare-up & acne condition check-in</p>
              </div>
            </div>
            <Switch
              checked={preferences.skinAlerts}
              disabled={!preferences.enabled}
              onCheckedChange={checked => updatePreferences({ skinAlerts: checked })}
            />
          </div>

          {/* AI Luna Insights */}
          <div className="p-3.5 rounded-2xl bg-secondary/15 border border-border/25 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-foreground">Luna AI Proactive Insights</p>
                <p className="text-[10px] text-muted-foreground">Correlations between stress, sleep & symptoms</p>
              </div>
            </div>
            <Switch
              checked={preferences.lunaInsights}
              disabled={!preferences.enabled}
              onCheckedChange={checked => updatePreferences({ lunaInsights: checked })}
            />
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────
          PERSONAL ROUTINE & CHECK-IN CLOCK
          ───────────────────────────────────────────────────────────────── */}
      <div className="space-y-3 pt-2 border-t border-border/30">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <span>⏰</span> My Daily Routine & Reminder Clock
            </p>
            <p className="text-[11px] text-muted-foreground">
              Personalize reminder times so notifications arrive when you are actually free
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Morning Routine */}
          <div className="p-3.5 rounded-2xl bg-secondary/15 border border-border/25 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                🌅 Morning
              </span>
              <span className="text-[10px] text-muted-foreground">Wake-Up</span>
            </div>
            <input
              type="time"
              value={preferences.reminderSchedule?.morningTime || '08:30'}
              disabled={!preferences.enabled}
              onChange={e =>
                updatePreferences({
                  reminderSchedule: {
                    ...preferences.reminderSchedule,
                    morningTime: e.target.value,
                  },
                })
              }
              className="w-full bg-background/60 border border-border/40 rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-pink-500/50"
            />
            <div className="flex gap-1">
              {['07:00', '08:30', '09:30'].map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() =>
                    updatePreferences({
                      reminderSchedule: { ...preferences.reminderSchedule, morningTime: t },
                    })
                  }
                  className={`flex-1 py-1 rounded-lg text-[10px] font-medium transition-all ${
                    preferences.reminderSchedule?.morningTime === t
                      ? 'bg-pink-500/25 border border-pink-500/40 text-pink-300 font-bold'
                      : 'bg-secondary/30 text-muted-foreground hover:bg-secondary/50'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Midday Break */}
          <div className="p-3.5 rounded-2xl bg-secondary/15 border border-border/25 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                ☀️ Afternoon
              </span>
              <span className="text-[10px] text-muted-foreground">Lunch Break</span>
            </div>
            <input
              type="time"
              value={preferences.reminderSchedule?.afternoonTime || '14:00'}
              disabled={!preferences.enabled}
              onChange={e =>
                updatePreferences({
                  reminderSchedule: {
                    ...preferences.reminderSchedule,
                    afternoonTime: e.target.value,
                  },
                })
              }
              className="w-full bg-background/60 border border-border/40 rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-violet-500/50"
            />
            <div className="flex gap-1">
              {['12:30', '14:00', '15:30'].map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() =>
                    updatePreferences({
                      reminderSchedule: { ...preferences.reminderSchedule, afternoonTime: t },
                    })
                  }
                  className={`flex-1 py-1 rounded-lg text-[10px] font-medium transition-all ${
                    preferences.reminderSchedule?.afternoonTime === t
                      ? 'bg-violet-500/25 border border-violet-500/40 text-violet-300 font-bold'
                      : 'bg-secondary/30 text-muted-foreground hover:bg-secondary/50'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Evening Wind-Down */}
          <div className="p-3.5 rounded-2xl bg-secondary/15 border border-border/25 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                🌙 Evening
              </span>
              <span className="text-[10px] text-muted-foreground">Bedtime</span>
            </div>
            <input
              type="time"
              value={preferences.reminderSchedule?.eveningTime || '21:30'}
              disabled={!preferences.enabled}
              onChange={e =>
                updatePreferences({
                  reminderSchedule: {
                    ...preferences.reminderSchedule,
                    eveningTime: e.target.value,
                  },
                })
              }
              className="w-full bg-background/60 border border-border/40 rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-purple-500/50"
            />
            <div className="flex gap-1">
              {['20:30', '21:30', '22:30'].map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() =>
                    updatePreferences({
                      reminderSchedule: { ...preferences.reminderSchedule, eveningTime: t },
                    })
                  }
                  className={`flex-1 py-1 rounded-lg text-[10px] font-medium transition-all ${
                    preferences.reminderSchedule?.eveningTime === t
                      ? 'bg-purple-500/25 border border-purple-500/40 text-purple-300 font-bold'
                      : 'bg-secondary/30 text-muted-foreground hover:bg-secondary/50'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────
          LIVE TESTING & MISSED CHECK-IN ALERT SIMULATION
          ───────────────────────────────────────────────────────────────── */}
      <div className="pt-3 border-t border-border/30 space-y-3.5">
        <div>
          <h3 className="text-xs font-bold text-foreground flex items-center gap-1.5">
            <BellRing className="w-3.5 h-3.5 text-pink-400" /> Test Phone Push Notifications
          </h3>
          <p className="text-[11px] text-muted-foreground">
            Verify how gentle reminder notifications appear on your phone lock screen when you don't open the app.
          </p>
        </div>

        {/* 5-minute explanation card */}
        <div className="p-3 rounded-2xl bg-violet-500/10 border border-violet-500/25 flex items-start gap-2.5">
          <Timer className="w-4 h-4 text-violet-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-xs font-bold text-violet-300">
              How to test the background check-in reminder on your phone:
            </p>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Tap <strong>&ldquo;⏱️ In 5 Minutes&rdquo;</strong>, then lock your phone and put it aside. In 5 minutes, your phone will ring and vibrate with:
              <span className="text-pink-300 font-semibold block mt-0.5">
                &ldquo;🌅 Hey! Don&apos;t forget your check-in today — it only takes 60 seconds!&rdquo;
              </span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Test in 5 minutes */}
          <button
            type="button"
            onClick={() => scheduleReminderPush(300)}
            className="px-3.5 py-2 rounded-xl bg-violet-500/20 hover:bg-violet-500/30 border border-violet-500/40 text-violet-200 text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-sm"
          >
            <Clock className="w-3.5 h-3.5 text-violet-400" /> ⏱️ In 5 Minutes (Lock Phone)
          </button>

          {/* Test in 10 seconds */}
          <button
            type="button"
            onClick={() => scheduleReminderPush(10)}
            className="px-3 py-2 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 text-purple-300 text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-sm"
          >
            <Timer className="w-3.5 h-3.5" /> In 10 Seconds (Quick Test)
          </button>

          {/* Test Right Now */}
          <button
            type="button"
            onClick={sendDeviceTestPush}
            className="px-3 py-2 rounded-xl bg-pink-500/15 hover:bg-pink-500/25 border border-pink-500/30 text-pink-300 text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-sm"
          >
            <Smartphone className="w-3.5 h-3.5" /> Send Right Now
          </button>

          {/* Simulate Missed Check-In Alert */}
          <button
            type="button"
            onClick={() => simulateMissedCheckinAlert('streak')}
            className="px-3 py-2 rounded-xl bg-secondary/30 hover:bg-secondary/50 border border-border/40 text-muted-foreground hover:text-foreground text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
          >
            <CheckSquare className="w-3.5 h-3.5" /> Check Missed Check-Ins
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
