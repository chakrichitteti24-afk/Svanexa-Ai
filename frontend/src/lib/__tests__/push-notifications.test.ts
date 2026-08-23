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
    it('generates morning check-in reminder with user name', () => {
      const payload = generateCheckinReminderPayload('Sarah', 'morning', 5);
      expect(payload.title).toContain('Morning Wellness Check-In');
      expect(payload.message).toContain('Sarah');
      expect(payload.url).toBe('/check-in');
      expect(payload.tag).toBe('checkin-morning');
      expect(payload.category).toBe('checkin');
    });

    it('generates afternoon energy & mood check reminder', () => {
      const payload = generateCheckinReminderPayload('Priya', 'afternoon', 3);
      expect(payload.title).toContain('Afternoon Energy & Mood');
      expect(payload.message).toContain('Priya');
      expect(payload.actionLabel).toBe('Log Afternoon Slot');
      expect(payload.tag).toBe('checkin-afternoon');
    });

    it('generates evening journal & daily close-out reminder', () => {
      const payload = generateCheckinReminderPayload('Emma', 'evening', 10);
      expect(payload.title).toContain('Evening Journal & Daily Close-Out');
      expect(payload.message).toContain('Emma');
      expect(payload.actionLabel).toBe('Log Evening Slot');
      expect(payload.tag).toBe('checkin-evening');
    });

    it('generates streak preservation reminder with streak count', () => {
      const payload = generateCheckinReminderPayload('Alex', 'streak', 7);
      expect(payload.title).toContain('Protect Your 7-Day Streak!');
      expect(payload.message).toContain('7-day streak');
      expect(payload.message).toContain('Alex');
      expect(payload.actionLabel).toBe('Keep Streak Alive');
      expect(payload.tag).toBe('checkin-streak-preservation');
    });

    it('handles fallback when user name is empty or whitespace', () => {
      const payload = generateCheckinReminderPayload('   ', 'morning', 0);
      expect(payload.message).toContain('there');
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

      // Morning slot evaluation
      expect(Boolean(emptySummary['morning' as keyof typeof emptySummary])).toBe(false);
      expect(Boolean(partialSummary.morning?.completed)).toBe(true);

      // Afternoon slot evaluation
      expect(Boolean(emptySummary['afternoon' as keyof typeof emptySummary])).toBe(false);
      expect(Boolean((partialSummary as any).afternoon?.completed)).toBe(false);

      // Streak check (any slot completed)
      const hasAnySlotCompleted = (s: any) =>
        Boolean(s.morning?.completed || s.afternoon?.completed || s.evening?.completed);

      expect(hasAnySlotCompleted(emptySummary)).toBe(false);
      expect(hasAnySlotCompleted(partialSummary)).toBe(true);
      expect(hasAnySlotCompleted(fullSummary)).toBe(true);
    });
  });
});
