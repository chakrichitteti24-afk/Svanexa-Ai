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
} from 'lucide-react';
import { useNotifications } from '@/context/NotificationContext';
import { NotificationCategory, NotificationItem } from '@/types/notifications';
import { formatDistanceToNow, parseISO, isValid } from 'date-fns';
import Link from 'next/link';

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
  } = useNotifications();

  const [activeTab, setActiveTab] = useState<FilterTab>('all');

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
      if (activeTab === 'luna') return item.category === 'luna' || item.category === 'system';
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

  return (
    <div className="flex flex-col h-[520px] max-h-[85vh] w-full max-w-[420px] bg-[#0d0a1a]/95 backdrop-blur-2xl border border-purple-500/20 rounded-3xl shadow-2xl shadow-purple-950/40 text-foreground overflow-hidden">
      {/* ─────────────────────────────────────────────────────────────────
          HEADER
          ───────────────────────────────────────────────────────────────── */}
      <div className="p-4 border-b border-border/40 flex items-center justify-between shrink-0 bg-secondary/10">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-pink-500/15 border border-pink-500/30 flex items-center justify-center text-pink-400">
            <BellRing className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold tracking-tight text-white flex items-center gap-2">
              Notifications & Alerts
              {unreadCount > 0 && (
                <span className="px-2 py-0.2 rounded-full text-[10px] font-extrabold bg-gradient-to-r from-pink-500 to-violet-500 text-white shadow-sm">
                  {unreadCount} new
                </span>
              )}
            </h2>
            <p className="text-[11px] text-[#9d91c4]">Personalized wellness & cycle reminders</p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {notifications.length > 0 && (
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
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────
          CATEGORY FILTER TABS
          ───────────────────────────────────────────────────────────────── */}
      <div className="px-3 pt-2.5 pb-2 flex items-center gap-1.5 overflow-x-auto scrollbar-none shrink-0 border-b border-border/20">
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
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                isActive
                  ? 'bg-gradient-to-r from-pink-500/25 to-purple-500/20 text-white border border-pink-500/40 shadow-sm'
                  : 'bg-secondary/20 text-[#9d91c4] hover:bg-secondary/40 hover:text-white border border-transparent'
              }`}
            >
              <span>{tab.label}</span>
              {typeof (tab as any).count === 'number' && (tab as any).count > 0 && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    isActive ? 'bg-pink-500 text-white' : 'bg-secondary/50 text-[#9d91c4]'
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
                    ? 'bg-secondary/10 border-border/20 opacity-80 hover:opacity-100 hover:bg-secondary/20'
                    : 'bg-gradient-to-br from-purple-950/40 via-card/80 to-purple-900/20 border-purple-500/35 shadow-md shadow-purple-950/20'
                }`}
              >
                {/* Unread Glow Dot */}
                {!item.read && (
                  <span className="absolute top-3.5 right-3.5 flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-pink-500"></span>
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
                        className={`text-xs font-bold truncate ${
                          item.read ? 'text-slate-200' : 'text-white'
                        }`}
                      >
                        {item.title}
                      </h4>
                    </div>

                    <p className="text-[11px] text-[#b4a9d9] leading-relaxed mb-2.5">
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
                          className="text-[#7c71a4] hover:text-white p-1 rounded-md transition-colors"
                        >
                          <X className="w-3 h-3" />
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
            <span className="text-[11px] text-[#b4a9d9] flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              Enable browser push alerts
            </span>
            <button
              type="button"
              onClick={requestPushPermission}
              className="px-3 py-1 rounded-full bg-gradient-to-r from-pink-500 to-purple-600 hover:opacity-95 text-white text-[11px] font-bold shadow-sm transition-all active:scale-95 cursor-pointer"
            >
              Enable
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between w-full">
            <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Push Notifications Active
            </span>
            <Link
              href="/profile"
              onClick={onClose}
              className="text-[11px] text-[#9d91c4] hover:text-white flex items-center gap-1 transition-colors"
            >
              <Settings className="w-3 h-3" />
              <span>Settings</span>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
