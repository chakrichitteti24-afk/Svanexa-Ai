import { describe, it, expect } from 'vitest';
import {
  getUserLocalTime,
  isNotificationAllowed,
  determineUserSlot,
} from '../services/notification-engine';
import { DEFAULT_NOTIFICATION_PREFERENCES, NotificationPreferences } from '@/types/notifications';

describe('NotificationEngine Core Service', () => {
  describe('getUserLocalTime', () => {
    it('returns formatted local time for Asia/Kolkata', () => {
      // 2026-09-07 12:00:00 UTC = 17:30 IST (+5:30)
      const testUtcDate = new Date(Date.UTC(2026, 8, 7, 12, 0, 0));
      const local = getUserLocalTime('Asia/Kolkata', testUtcDate);

      expect(local.hour).toBe(17);
      expect(local.minute).toBe(30);
      expect(local.dateStr).toBe('2026-09-07');
      expect(local.formatted).toBe('17:30');
    });

    it('returns formatted local time for America/New_York', () => {
      // 2026-09-07 12:00:00 UTC = 08:00 EDT (-4:00 during daylight saving)
      const testUtcDate = new Date(Date.UTC(2026, 8, 7, 12, 0, 0));
      const local = getUserLocalTime('America/New_York', testUtcDate);

      expect(local.hour).toBe(8);
      expect(local.minute).toBe(0);
      expect(local.dateStr).toBe('2026-09-07');
      expect(local.formatted).toBe('08:00');
    });

    it('handles invalid timezone gracefully without throwing', () => {
      const testDate = new Date();
      const local = getUserLocalTime('Invalid/NonExistent_Zone', testDate);
      expect(local).toBeDefined();
      expect(typeof local.hour).toBe('number');
      expect(typeof local.dateStr).toBe('string');
    });
  });

  describe('isNotificationAllowed', () => {
    it('returns false if master switch is OFF', () => {
      const prefs: NotificationPreferences = {
        ...DEFAULT_NOTIFICATION_PREFERENCES,
        enabled: false,
      };

      expect(isNotificationAllowed(prefs, 'checkin', 'morning')).toBe(false);
      expect(isNotificationAllowed(prefs, 'hydration')).toBe(false);
      expect(isNotificationAllowed(prefs, 'cycle')).toBe(false);
      expect(isNotificationAllowed(prefs, 'supplements')).toBe(false);
      expect(isNotificationAllowed(prefs, 'system')).toBe(false);
    });

    it('respects slot-specific check-in preferences', () => {
      const prefs: NotificationPreferences = {
        ...DEFAULT_NOTIFICATION_PREFERENCES,
        enabled: true,
        morningCheckin: true,
        afternoonCheckin: false,
        eveningCheckin: true,
      };

      expect(isNotificationAllowed(prefs, 'checkin', 'morning')).toBe(true);
      expect(isNotificationAllowed(prefs, 'checkin', 'afternoon')).toBe(false);
      expect(isNotificationAllowed(prefs, 'checkin', 'evening')).toBe(true);
      expect(isNotificationAllowed(prefs, 'checkin', 'streak')).toBe(true);
    });

    it('respects hydration preferences', () => {
      const prefsAllowed: NotificationPreferences = {
        ...DEFAULT_NOTIFICATION_PREFERENCES,
        hydrationAlerts: true,
      };
      const prefsBlocked: NotificationPreferences = {
        ...DEFAULT_NOTIFICATION_PREFERENCES,
        hydrationAlerts: false,
      };

      expect(isNotificationAllowed(prefsAllowed, 'hydration')).toBe(true);
      expect(isNotificationAllowed(prefsBlocked, 'hydration')).toBe(false);
    });

    it('respects cycle tracker preferences', () => {
      const prefsAllowed: NotificationPreferences = {
        ...DEFAULT_NOTIFICATION_PREFERENCES,
        cycleTracker: true,
      };
      const prefsBlocked: NotificationPreferences = {
        ...DEFAULT_NOTIFICATION_PREFERENCES,
        cycleTracker: false,
      };

      expect(isNotificationAllowed(prefsAllowed, 'cycle')).toBe(true);
      expect(isNotificationAllowed(prefsBlocked, 'cycle')).toBe(false);
    });

    it('respects supplements and wellness plan preferences', () => {
      const prefs: NotificationPreferences = {
        ...DEFAULT_NOTIFICATION_PREFERENCES,
        supplementAlerts: false,
        wellnessPlan: false,
      };

      expect(isNotificationAllowed(prefs, 'supplements')).toBe(false);
    });

    it('respects rewards preferences', () => {
      const prefs: NotificationPreferences = {
        ...DEFAULT_NOTIFICATION_PREFERENCES,
        coinsRewards: false,
      };

      expect(isNotificationAllowed(prefs, 'rewards')).toBe(false);
    });

    it('returns true when prefs are undefined', () => {
      expect(isNotificationAllowed(undefined, 'checkin')).toBe(true);
      expect(isNotificationAllowed(undefined, 'hydration')).toBe(true);
    });
  });

  describe('determineUserSlot', () => {
    const customSchedule = {
      morningTime: '07:00',
      afternoonTime: '13:00',
      eveningTime: '20:00',
    };

    it('correctly maps morning hour', () => {
      expect(determineUserSlot(8, customSchedule)).toBe('morning');
      expect(determineUserSlot(12, customSchedule)).toBe('morning');
    });

    it('correctly maps afternoon hour', () => {
      expect(determineUserSlot(14, customSchedule)).toBe('afternoon');
      expect(determineUserSlot(19, customSchedule)).toBe('afternoon');
    });

    it('correctly maps evening hour', () => {
      expect(determineUserSlot(20, customSchedule)).toBe('evening');
      expect(determineUserSlot(22, customSchedule)).toBe('evening');
      expect(determineUserSlot(23, customSchedule)).toBe('evening');
    });
  });
});
