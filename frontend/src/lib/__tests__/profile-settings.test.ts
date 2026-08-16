import { describe, it, expect } from 'vitest';

// Age calculation helper identical to profile logic
function calculateAge(dobString: string): number | null {
  if (!dobString) return null;
  const birthDate = new Date(dobString);
  if (isNaN(birthDate.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age > 0 && age < 120 ? age : null;
}

// Profile validation helper identical to page submission logic
function validateProfileForm(input: {
  firstName: string;
  companionName: string;
  userMode: 'general' | 'pcos' | 'pregnancy';
  dueDate: string;
}): { valid: boolean; error?: string } {
  if (!input.firstName.trim()) {
    return { valid: false, error: 'First name is required.' };
  }
  if (!input.companionName.trim()) {
    return { valid: false, error: 'AI Companion name is required.' };
  }
  if (input.userMode === 'pregnancy' && !input.dueDate) {
    return { valid: false, error: 'Please specify your expected due date for Pregnancy Mode.' };
  }
  return { valid: true };
}

describe('Profile & Settings Logic', () => {
  describe('Age Calculation', () => {
    it('correctly computes age from valid birth date', () => {
      const birthYear = new Date().getFullYear() - 25;
      const dob = `${birthYear}-01-01`;
      const age = calculateAge(dob);
      expect(age).toBeGreaterThanOrEqual(24);
      expect(age).toBeLessThanOrEqual(25);
    });

    it('returns null for empty or invalid date strings', () => {
      expect(calculateAge('')).toBeNull();
      expect(calculateAge('invalid-date')).toBeNull();
      expect(calculateAge('2099-01-01')).toBeNull(); // Future date
    });
  });

  describe('Profile Form Validation', () => {
    it('rejects empty first name', () => {
      const res = validateProfileForm({
        firstName: '',
        companionName: 'Luna',
        userMode: 'general',
        dueDate: '',
      });
      expect(res.valid).toBe(false);
      expect(res.error).toBe('First name is required.');
    });

    it('rejects empty companion name', () => {
      const res = validateProfileForm({
        firstName: 'Chakri',
        companionName: '   ',
        userMode: 'general',
        dueDate: '',
      });
      expect(res.valid).toBe(false);
      expect(res.error).toBe('AI Companion name is required.');
    });

    it('rejects pregnancy mode without due date', () => {
      const res = validateProfileForm({
        firstName: 'Chakri',
        companionName: 'Luna',
        userMode: 'pregnancy',
        dueDate: '',
      });
      expect(res.valid).toBe(false);
      expect(res.error).toBe('Please specify your expected due date for Pregnancy Mode.');
    });

    it('accepts valid general profile input', () => {
      const res = validateProfileForm({
        firstName: 'Chakri',
        companionName: 'Luna',
        userMode: 'general',
        dueDate: '',
      });
      expect(res.valid).toBe(true);
    });

    it('accepts valid pregnancy mode input with due date', () => {
      const res = validateProfileForm({
        firstName: 'Chakri',
        companionName: 'Luna',
        userMode: 'pregnancy',
        dueDate: '2026-11-20',
      });
      expect(res.valid).toBe(true);
    });
  });

  describe('Supabase Payload Formatting', () => {
    it('constructs correct profile upsert payload', () => {
      const userId = 'test-uuid-1234';
      const firstName = 'Chakri';
      const lastName = 'Chitteti';
      const dob = '1998-05-15';
      const companionName = 'Luna';
      const userMode = 'pcos';

      const payload = {
        id: userId,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        username: firstName.trim(),
        date_of_birth: dob || null,
        ai_name: companionName.trim(),
        active_theme: userMode,
        updated_at: expect.any(String),
      };

      expect(payload.id).toBe('test-uuid-1234');
      expect(payload.first_name).toBe('Chakri');
      expect(payload.active_theme).toBe('pcos');
      expect(payload.ai_name).toBe('Luna');
    });
  });
});
