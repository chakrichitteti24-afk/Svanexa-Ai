'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell,
  CheckCheck,
  Trash2,
  CalendarHeart,
  Droplets,
  CheckSquare,
  Sparkles,
  Pill,
  ExternalLink,
  X,
  ShieldAlert,
  Settings,
  BellRing,
  Info,
  Coins,
  BarChart3,
  Volume2,
  ArrowLeft,
  Smartphone,
  Check,
} from 'lucide-react';
import { useNotifications } from '@/context/NotificationContext';
import { NotificationCategory, NotificationItem } from '@/types/notifications';
import { playWellnessChime } from '@/utils/sound-effects';
import { formatDistanceToNow, parseISO, isValid } from 'date-fns';
import { toast } from 'sonner';

interface NotificationCenterProps {
  onClose?: () => void;
}

type FilterTab = 'all' | 'unread' | 'cycle' | 'checkin' | 'luna';

export function NotificationCenter({ onClose }: NotificationCenterProps) {
  const router = useRouter();
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    dismissNotification,
    clearAll,
    permissionStatus,
    requestPushPermission,
    preferences,
    updatePreferences,
    sendTestNotification,
  } = useNotifications();

  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [showSettings, setShowSettings] = useState(false);

  const filteredNotifications = useMemo(() => {
    return notifications.filter(item => {
      if (activeTab === 'all') return true;
      if (activeTab === 'unread') return !item.read;
      if (activeTab === 'cycle') return item.category === 'cycle';
      if (activeTab === 'checkin')
        return (
          item.category === 'checkin' ||
          item.category === 'hydration' ||
          item.category === 'supplements' ||
          item.category === 'skin'
        );
      if (activeTab === 'luna')
        return (
          item.category === 'luna' ||
          item.category === 'system' ||
          item.category === 'rewards' ||
          item.category === 'reports'
        );
      return true;
    });
  }, [notifications, activeTab]);

  const getCategoryIcon = (category: NotificationCategory) => {
    switch (category) {
      case 'cycle':
        return <CalendarHeart className="w-4 h-4 text-pink-400" />;
      case 'hydration':
        return <Droplets className="w-4 h-4 text-cyan-400" />;
      case 'checkin':
        return <CheckSquare className="w-4 h-4 text-violet-400" />;
      case 'supplements':
        return <Pill className="w-4 h-4 text-amber-400" />;
      case 'skin':
        return <Sparkles className="w-4 h-4 text-rose-400" />;
      case 'luna':
        return <Sparkles className="w-4 h-4 text-purple-400" />;
      case 'rewards':
        return <Coins className="w-4 h-4 text-yellow-400" />;
      case 'reports':
        return <BarChart3 className="w-4 h-4 text-emerald-400" />;
      case 'system':
      default:
        return <Info className="w-4 h-4 text-indigo-400" />;
    }
  };

  const formatTimestamp = (isoString: string) => {
    try {
      const date = parseISO(isoString);
      if (!isValid(date)) return 'Just now';
      return formatDistanceToNow(date, { addSuffix: true });
    } catch {
      return 'Recently';
    }
  };

  const handleActionClick = (item: NotificationItem) => {
    markAsRead(item.id);
    if (item.actionUrl) {
      router.push(item.actionUrl);
      if (onClose) onClose();
    }
  };

  const handleTogglePreference = (key: keyof typeof preferences, value: boolean) => {
    updatePreferences({ [key]: value });
  };

  const handleTestChime = () => {
    playWellnessChime();
    toast.success('Chime test played ✨');
  };

  return (
    <div className="flex flex-col h-[min(540px,calc(100dvh-5.5rem))] w-full max-w-[420px] bg-[#1c1c1e]/95 backdrop-blur-2xl border border-white/[0.12] rounded-3xl shadow-2xl text-foreground overflow-hidden">
      {/* ─────────────────────────────────────────────────────────────────
          HEADER
          ───────────────────────────────────────────────────────────────── */}
      <div className="p-3 sm:p-4 border-b border-border/40 flex items-center justify-between shrink-0 bg-secondary/10 gap-2">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          {showSettings ? (
            <button
              onClick={() => setShowSettings(false)}
              className="p-1.5 rounded-xl hover:bg-white/10 text-[#9d91c4] hover:text-white transition-colors cursor-pointer shrink-0"
              title="Back to notifications"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          ) : (
            <div className="w-8 h-8 rounded-xl bg-pink-500/15 border border-pink-500/30 flex items-center justify-center text-pink-400 shrink-0">
              <BellRing className="w-4 h-4" />
            </div>
          )}

          <div className="min-w-0 flex-1">
            <h2 className="text-xs sm:text-sm font-bold tracking-tight text-white flex items-center gap-1.5 truncate">
              <span>{showSettings ? 'Alert Preferences' : 'Notifications'}</span>
              {!showSettings && unreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary text-white shadow-sm shrink-0">
                  {unreadCount} new
                </span>
              )}
            </h2>
            <p className="text-[11px] text-[#9d91c4] truncate">
              {showSettings ? 'Manage push, sound & cycle reminders' : 'Personalized wellness & cycle reminders'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setShowSettings(prev => !prev)}
            title={showSettings ? 'View notifications' : 'Notification settings'}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              showSettings
                ? 'bg-purple-500/25 text-pink-300 ring-1 ring-purple-500/40'
                : 'hover:bg-white/10 text-[#9d91c4] hover:text-white'
            }`}
          >
            <Settings className="w-4 h-4" />
          </button>

          {!showSettings && notifications.length > 0 && (
            <>
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  title="Mark all as read"
                  className="p-1.5 rounded-lg hover:bg-white/10 text-[#9d91c4] hover:text-white transition-colors cursor-pointer"
                >
                  <CheckCheck className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={clearAll}
                title="Clear all notifications"
                className="p-1.5 rounded-lg hover:bg-rose-500/20 text-[#9d91c4] hover:text-rose-400 transition-colors cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-white/10 text-[#9d91c4] hover:text-white transition-colors cursor-pointer"
              title="Close notifications"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────
          SETTINGS VIEW (when showSettings === true)
          ───────────────────────────────────────────────────────────────── */}
      {showSettings ? (
        <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
          <div className="space-y-3">
            {/* Master Toggle */}
            <div className="p-3 rounded-2xl bg-secondary/15 border border-border/20 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-white">Enable Notifications</p>
                <p className="text-[11px] text-[#9d91c4]">Receive all intelligent health alerts</p>
              </div>
              <button
                type="button"
                onClick={() => handleTogglePreference('enabled', !preferences.enabled)}
                className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                  preferences.enabled ? 'bg-pink-500' : 'bg-secondary/40 border border-border/30'
                }`}
              >
                <span
                  className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${
                    preferences.enabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Browser Push */}
            <div className="p-3 rounded-2xl bg-secondary/15 border border-border/20 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-purple-400 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-white">Browser Push Notifications</p>
                  <p className="text-[11px] text-[#9d91c4]">
                    {permissionStatus === 'granted' ? 'Active on this device' : 'Allow notifications from browser'}
                  </p>
                </div>
              </div>
              {permissionStatus !== 'granted' ? (
                <button
                  type="button"
                  onClick={requestPushPermission}
                  className="px-2.5 py-1 rounded-full bg-pink-500 hover:bg-pink-600 text-white text-[10px] font-bold shadow-sm transition-all"
                >
                  Allow
                </button>
              ) : (
                <span className="text-emerald-400 flex items-center gap-1 text-[11px] font-semibold">
                  <Check className="w-3.5 h-3.5" />
                  Enabled
                </span>
              )}
            </div>

            {/* Sound Chime */}
            <div className="p-3 rounded-2xl bg-secondary/15 border border-border/20 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-cyan-400 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-white">Chime Sound Effects</p>
                  <p className="text-[11px] text-[#9d91c4]">Calming harmonic chime on reminders</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleTestChime}
                  title="Test Sound"
                  className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-white text-[10px] font-semibold border border-border/20"
                >
                  Test
                </button>
                <button
                  type="button"
                  onClick={() => handleTogglePreference('soundEnabled', !preferences.soundEnabled)}
                  className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                    preferences.soundEnabled ? 'bg-pink-500' : 'bg-secondary/40 border border-border/30'
                  }`}
                >
                  <span
                    className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${
                      preferences.soundEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Alert Categories Divider */}
            <div className="pt-2">
              <p className="text-[10px] uppercase font-bold text-[#7c71a4] tracking-wider mb-2">
                Category Subscriptions
              </p>
              <div className="space-y-2">
                {[
                  { key: 'cycleAlerts', label: '🌸 Menstrual & Ovulation Alerts', desc: 'Period predictions & phase shifts' },
                  { key: 'checkinAlerts', label: '✨ Daily Check-In Reminders', desc: 'Morning, midday & evening pauses' },
                  { key: 'hydrationAlerts', label: '💧 Hydration Check-ins', desc: 'Gentle water reminders throughout the day' },
                  { key: 'supplementAlerts', label: '💊 Supplement Reminders', desc: 'Daily vitamin & supplement routines' },
                  { key: 'skinAlerts', label: '💆‍♀️ Skin Care Logs', desc: 'Morning & evening routine prompts' },
                ].map(item => {
                  const isChecked = !!(preferences as any)[item.key];
                  return (
                    <div
                      key={item.key}
                      onClick={() => handleTogglePreference(item.key as any, !isChecked)}
                      className="p-2.5 rounded-xl bg-secondary/10 hover:bg-secondary/20 border border-border/15 flex items-center justify-between cursor-pointer transition-colors"
                    >
                      <div>
                        <p className="text-xs font-semibold text-white">{item.label}</p>
                        <p className="text-[10px] text-[#9d91c4]">{item.desc}</p>
                      </div>
                      <div
                        className={`w-5 h-5 rounded-md flex items-center justify-center border transition-colors ${
                          isChecked ? 'bg-pink-500 border-pink-400 text-white' : 'border-border/30 bg-transparent'
                        }`}
                      >
                        {isChecked && <Check className="w-3.5 h-3.5" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Live Test Alert Action */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => {
                  sendTestNotification();
                  toast.success('Test notification triggered!');
                  setShowSettings(false);
                }}
                className="w-full py-2.5 rounded-full bg-white/[0.08] hover:bg-white/[0.12] border border-white/[0.12] text-foreground font-semibold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-[0.98]"
              >
                <Sparkles className="w-3.5 h-3.5 text-primary" />
                <span>Trigger Live Test Alert</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* ─────────────────────────────────────────────────────────────────
              CATEGORY FILTER TABS (Apple Segmented Control Style)
              ───────────────────────────────────────────────────────────────── */}
          <div className="px-3 py-2 flex items-center gap-1.5 overflow-x-auto scrollbar-none shrink-0 border-b border-white/[0.08] touch-pan-x">
            {(
              [
                { id: 'all', label: 'All', count: notifications.length },
                { id: 'unread', label: 'Unread', count: unreadCount },
                { id: 'cycle', label: '🌸 Cycle' },
                { id: 'checkin', label: '✨ Habits' },
                { id: 'luna', label: '🤖 AI Insights' },
              ] as const
            ).map(tab => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as FilterTab)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer active:scale-[0.98] ${
                    isActive
                      ? 'bg-white/[0.16] text-white border border-white/[0.18] shadow-sm'
                      : 'bg-white/[0.04] text-muted-foreground hover:bg-white/[0.08] hover:text-foreground border border-transparent'
                  }`}
                >
                  <span>{tab.label}</span>
                  {typeof (tab as any).count === 'number' && (tab as any).count > 0 && (
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                        isActive ? 'bg-primary text-white' : 'bg-white/[0.08] text-muted-foreground'
                      }`}
                    >
                      {(tab as any).count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* ─────────────────────────────────────────────────────────────────
              NOTIFICATION FEED LIST
              ───────────────────────────────────────────────────────────────── */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2.5 scrollbar-thin">
            <AnimatePresence mode="popLayout">
              {filteredNotifications.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center justify-center h-full py-12 text-center px-4 space-y-3"
                >
                  <div className="w-14 h-14 rounded-full bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-300 shadow-inner">
                    <Bell className="w-6 h-6 stroke-[1.5]" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-white">You&apos;re all caught up!</p>
                    <p className="text-xs text-[#9d91c4] max-w-xs">
                      {activeTab === 'unread'
                        ? 'No unread alerts. Check back later for daily habit & cycle reminders.'
                        : 'No notifications in this category right now.'}
                    </p>
                  </div>
                </motion.div>
              ) : (
                filteredNotifications.map(item => (
                  <motion.div
                    key={item.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    className={`group relative p-3.5 rounded-2xl border transition-all ${
                      item.read
                        ? 'bg-white/[0.03] border-white/[0.06] opacity-75 hover:opacity-100 hover:bg-white/[0.06]'
                        : 'bg-white/[0.08] border-white/[0.14] shadow-sm'
                    }`}
                  >
                    {/* Unread Indicator Dot */}
                    {!item.read && (
                      <span className="absolute top-3.5 right-3.5 flex h-2 w-2 pointer-events-none">
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                      </span>
                    )}

                    <div className="flex items-start gap-3">
                      {/* Category Badge Icon */}
                      <div className="p-2 rounded-xl bg-background/80 border border-border/30 shrink-0 mt-0.5 shadow-sm">
                        {getCategoryIcon(item.category)}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0 pr-4">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <h4
                            className={`text-xs font-bold truncate flex items-center gap-1.5 ${
                              item.read ? 'text-slate-200' : 'text-white'
                            }`}
                          >
                            <span className="truncate">{item.title}</span>
                            {item.priority === 'high' && !item.read && (
                              <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-pink-500/25 text-pink-300 border border-pink-500/40 shrink-0">
                                Urgent
                              </span>
                            )}
                          </h4>
                        </div>

                        <p className="text-[11px] text-[#b4a9d9] leading-relaxed mb-2.5 break-words">
                          {item.message}
                        </p>

                        <div className="flex items-center justify-between gap-2 flex-wrap pt-1 border-t border-border/15">
                          <span className="text-[10px] text-[#7c71a4]">
                            {formatTimestamp(item.timestamp)}
                          </span>

                          <div className="flex items-center gap-2">
                            {item.actionUrl && (
                              <button
                                type="button"
                                onClick={() => handleActionClick(item)}
                                className="px-2.5 py-1 rounded-lg bg-pink-500/20 hover:bg-pink-500/30 border border-pink-500/30 text-pink-300 text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer shadow-sm active:scale-95"
                              >
                                <span>{item.actionLabel || 'View'}</span>
                                <ExternalLink className="w-3 h-3" />
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => dismissNotification(item.id)}
                              title="Dismiss"
                              className="text-[#7c71a4] hover:text-white p-1 rounded-md transition-colors cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>

          {/* ─────────────────────────────────────────────────────────────────
              FOOTER / PUSH PERMISSION BANNER
              ───────────────────────────────────────────────────────────────── */}
          <div className="p-3 border-t border-border/30 bg-secondary/15 shrink-0 flex items-center justify-between gap-2">
            {permissionStatus !== 'granted' ? (
              <div className="flex items-center justify-between w-full">
                <span className="text-[11px] text-[#b4a9d9] flex items-center gap-1.5 truncate">
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  Enable browser push alerts
                </span>
                <button
                  type="button"
                  onClick={requestPushPermission}
                  className="px-3 py-1 rounded-full bg-primary hover:opacity-95 text-white text-[11px] font-semibold shadow-sm transition-all active:scale-[0.98] cursor-pointer shrink-0"
                >
                  Enable
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between w-full">
                <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1.5 truncate">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                  Push Notifications Active
                </span>
                <button
                  type="button"
                  onClick={() => setShowSettings(true)}
                  className="text-[11px] text-[#9d91c4] hover:text-white flex items-center gap-1 transition-colors cursor-pointer shrink-0"
                >
                  <Settings className="w-3 h-3" />
                  <span>Preferences</span>
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
