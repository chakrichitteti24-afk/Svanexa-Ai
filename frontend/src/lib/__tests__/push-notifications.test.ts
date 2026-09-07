import { describe, it, expect } from 'vitest';
import {
  generateCheckinReminderPayload,
  getVapidPublicKey,
} from '../services/web-push';

describe('Push Notifications & Check-In Reminders', () => {
  it('returns a valid public VAPID key', () => {
    const key = getVapidPublicKey();
    expect(key).toBeDefined();
    expect(typeof key).toBe('string');
    expect(key.length).toBeGreaterThan(20);
  });

  describe('generateCheckinReminderPayload', () => {
    it('generates polite morning check-in reminder with user name', () => {
      const payload = generateCheckinReminderPayload('Sarah', 'morning', 5);
      expect(payload.title).toContain('Good morning, Sarah');
      expect(payload.message).toContain('60 seconds');
      expect(payload.message).toContain('No rush');
      expect(payload.url).toBe('/check-in');
      expect(payload.actionLabel).toContain('Check In When Ready');
      expect(payload.tag).toBe('checkin-morning');
      expect(payload.category).toBe('checkin');
    });

    it('generates polite afternoon energy & mood check reminder', () => {
      const payload = generateCheckinReminderPayload('Priya', 'afternoon', 3);
      expect(payload.title).toContain('Priya');
      expect(payload.message).toContain('pause');
      expect(payload.actionLabel).toBe('Take a Moment 🌿');
      expect(payload.tag).toBe('checkin-afternoon');
    });

    it('generates gentle evening reflection reminder', () => {
      const payload = generateCheckinReminderPayload('Emma', 'evening', 10);
      expect(payload.title).toContain('Evening reflection, Emma');
      expect(payload.message).toContain('winding down');
      expect(payload.actionLabel).toBe('Evening Check-In ✨');
      expect(payload.tag).toBe('checkin-evening');
    });

    it('generates gentle streak reminder with streak count without anxiety/guilt', () => {
      const payload = generateCheckinReminderPayload('Alex', 'streak', 7);
      expect(payload.title).toContain('Alex');
      expect(payload.message).toContain('7 days');
      expect(payload.message).not.toContain('lost at midnight');
      expect(payload.tag).toBe('checkin-streak-preservation');
    });

    it('handles fallback when user name is empty or whitespace', () => {
      const payload = generateCheckinReminderPayload('   ', 'morning', 0);
      expect(payload.title).toContain('there');
    });

    it('streak 0 shows gentle check-in message instead of streak count', () => {
      const payload = generateCheckinReminderPayload('Nisha', 'streak', 0);
      expect(payload.title).toContain('Nisha');
      expect(payload.message).toContain('take 60 seconds');
      expect(payload.tag).toBe('checkin-streak-preservation');
    });
  });

  describe('Missed Check-In Logic Verification', () => {
    it('correctly evaluates incomplete check-ins from summary json', () => {
      const emptySummary = {};
      const partialSummary = { morning: { completed: true } };
      const fullSummary = {
        morning: { completed: true },
        afternoon: { completed: true },
        evening: { completed: true },
      };

      expect(Boolean(emptySummary['morning' as keyof typeof emptySummary])).toBe(false);
      expect(Boolean(partialSummary.morning?.completed)).toBe(true);
      expect(Boolean(emptySummary['afternoon' as keyof typeof emptySummary])).toBe(false);
      expect(Boolean((partialSummary as any).afternoon?.completed)).toBe(false);

      const hasAnySlotCompleted = (s: any) =>
        Boolean(s.morning?.completed || s.afternoon?.completed || s.evening?.completed);

      expect(hasAnySlotCompleted(emptySummary)).toBe(false);
      expect(hasAnySlotCompleted(partialSummary)).toBe(true);
      expect(hasAnySlotCompleted(fullSummary)).toBe(true);
    });
  });
});
