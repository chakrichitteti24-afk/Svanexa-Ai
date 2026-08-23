export type NotificationCategory =
  | 'cycle'
  | 'checkin'
  | 'hydration'
  | 'supplements'
  | 'skin'
  | 'luna'
  | 'system';

export type NotificationPriority = 'high' | 'normal' | 'low';

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  category: NotificationCategory;
  priority: NotificationPriority;
  timestamp: string; // ISO string
  read: boolean;
  actionUrl?: string;
  actionLabel?: string;
  iconType?: string;
  dismissed?: boolean;
}

export interface ReminderSchedule {
  morningTime: string; // e.g. "08:30"
  afternoonTime: string; // e.g. "14:00"
  eveningTime: string; // e.g. "21:30"
}

export interface NotificationPreferences {
  enabled: boolean; // Master ON / OFF
  browserPush: boolean;
  soundEnabled: boolean;
  // Individual controls
  morningCheckin: boolean;
  afternoonCheckin: boolean;
  eveningCheckin: boolean;
  wellnessTasks: boolean;
  wellnessPlan: boolean;
  coinsRewards: boolean;
  cycleTracker: boolean;
  aiCompanion: boolean;
  // Legacy / supplemental
  cycleAlerts?: boolean;
  checkinAlerts?: boolean;
  hydrationAlerts?: boolean;
  supplementAlerts?: boolean;
  skinAlerts?: boolean;
  lunaInsights?: boolean;
  repeatUntilCheckinComplete?: boolean;
  recurringIntervalMinutes?: number;
  timezone?: string;
  reminderSchedule: ReminderSchedule;
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  enabled: true,
  browserPush: true,
  soundEnabled: true,
  morningCheckin: true,
  afternoonCheckin: true,
  eveningCheckin: true,
  wellnessTasks: true,
  wellnessPlan: true,
  coinsRewards: true,
  cycleTracker: true,
  aiCompanion: true,
  cycleAlerts: true,
  checkinAlerts: true,
  hydrationAlerts: true,
  supplementAlerts: true,
  skinAlerts: true,
  lunaInsights: true,
  repeatUntilCheckinComplete: false,
  recurringIntervalMinutes: 30,
  timezone: 'Asia/Kolkata',
  reminderSchedule: {
    morningTime: '08:30',
    afternoonTime: '14:00',
    eveningTime: '21:30',
  },
};

