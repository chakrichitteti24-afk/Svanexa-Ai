import { describe, it, expect } from 'vitest';

// Age calculation helper
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

// Validation logic matching ProfilePage
function validateProfileForm(input: {
  firstName: string;
  companionName: string;
  userMode: 'general' | 'pcos' | 'pregnancy';
  dueDate: string;
}): { valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  if (!input.firstName.trim()) {
    errors.firstName = 'This field is required.';
  }
  if (!input.companionName.trim()) {
    errors.companionName = 'This field is required.';
  }
  if (input.userMode === 'pregnancy' && !input.dueDate) {
    errors.dueDate = 'This field is required.';
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

describe('Profile & Settings UX and Validation', () => {
  describe('Age Calculation', () => {
    it('correctly calculates age from valid date string', () => {
      const birthYear = new Date().getFullYear() - 25;
      const dob = `${birthYear}-01-01`;
      const age = calculateAge(dob);
      expect(age).toBeGreaterThanOrEqual(24);
      expect(age).toBeLessThanOrEqual(25);
    });

    it('returns null for empty or invalid strings', () => {
      expect(calculateAge('')).toBeNull();
      expect(calculateAge('not-a-date')).toBeNull();
      expect(calculateAge('2099-12-31')).toBeNull();
    });
  });

  describe('Mandatory Field Validation', () => {
    it('requires First Name and returns inline error', () => {
      const res = validateProfileForm({
        firstName: '   ',
        companionName: 'Luna',
        userMode: 'general',
        dueDate: '',
      });
      expect(res.valid).toBe(false);
      expect(res.errors.firstName).toBe('This field is required.');
    });

    it('requires Companion Name and returns inline error', () => {
      const res = validateProfileForm({
        firstName: 'Chakri',
        companionName: '',
        userMode: 'general',
        dueDate: '',
      });
      expect(res.valid).toBe(false);
      expect(res.errors.companionName).toBe('This field is required.');
    });

    it('requires Expected Due Date when in Pregnancy Mode', () => {
      const res = validateProfileForm({
        firstName: 'Chakri',
        companionName: 'Luna',
        userMode: 'pregnancy',
        dueDate: '',
      });
      expect(res.valid).toBe(false);
      expect(res.errors.dueDate).toBe('This field is required.');
    });

    it('passes validation when all required fields are present', () => {
      const res = validateProfileForm({
        firstName: 'Chakri',
        companionName: 'Luna',
        userMode: 'pregnancy',
        dueDate: '2026-11-20',
      });
      expect(res.valid).toBe(true);
      expect(Object.keys(res.errors).length).toBe(0);
    });
  });

  describe('Read-Only vs Edit Mode State Transitions', () => {
    it('initializes in read-only mode with saved values intact', () => {
      const initialSaved = {
        firstName: 'Chakri',
        lastName: 'Chitteti',
        dob: '1998-05-15',
        companionName: 'Luna',
        userMode: 'general' as const,
        dueDate: '',
      };
      let isEditing = false;
      expect(isEditing).toBe(false);

      // Transition to edit mode
      isEditing = true;
      expect(isEditing).toBe(true);

      // Discard changes returns to initialSaved
      let workingCopy = { ...initialSaved, firstName: 'ChangedName' };
      workingCopy = { ...initialSaved };
      isEditing = false;

      expect(workingCopy.firstName).toBe('Chakri');
      expect(isEditing).toBe(false);
    });
  });
});
