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
  enabled: boolean;
  browserPush: boolean;
  soundEnabled: boolean;
  cycleAlerts: boolean;
  checkinAlerts: boolean;
  hydrationAlerts: boolean;
  supplementAlerts: boolean;
  skinAlerts: boolean;
  lunaInsights: boolean;
  reminderSchedule: ReminderSchedule;
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  enabled: true,
  browserPush: false,
  soundEnabled: true,
  cycleAlerts: true,
  checkinAlerts: true,
  hydrationAlerts: true,
  supplementAlerts: true,
  skinAlerts: true,
  lunaInsights: true,
  reminderSchedule: {
    morningTime: '08:30',
    afternoonTime: '14:00',
    eveningTime: '21:30',
  },
};
