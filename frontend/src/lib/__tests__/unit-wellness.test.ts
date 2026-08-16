import { describe, it, expect } from 'vitest';
import { getNormalizedDate, isValidDateString } from '../../utils/date-utils';
import { getCheckinQuestions, calculateCheckinIndicators } from '../questions/checkin-questions';

describe('Svanexa Date Utilities', () => {
  it('validates correct YYYY-MM-DD date strings', () => {
    expect(isValidDateString('2026-08-16')).toBe(true);
  });

  it('rejects invalid date string formats', () => {
    expect(isValidDateString('2026-8-16')).toBe(false);
    expect(isValidDateString('invalid')).toBe(false);
    expect(isValidDateString(null as any)).toBe(false);
  });

  it('returns valid YYYY-MM-DD for getNormalizedDate', () => {
    const todayStr = getNormalizedDate();
    expect(/^\d{4}-\d{2}-\d{2}$/.test(todayStr)).toBe(true);
  });
});

describe('Check-in 10 MCQ Generation', () => {
  it('generates exactly 10 questions for Morning check-in', () => {
    const morningQuestions = getCheckinQuestions('morning', 'general');
    expect(morningQuestions.length).toBe(10);
    morningQuestions.forEach((q) => {
      expect(q.options.length).toBeGreaterThanOrEqual(2);
      expect(q.title).toBeTruthy();
      expect(q.question).toBeTruthy();
    });
  });

  it('generates exactly 10 questions for Afternoon PCOS check-in', () => {
    const afternoonQuestions = getCheckinQuestions('afternoon', 'pcos');
    expect(afternoonQuestions.length).toBe(10);
  });

  it('generates exactly 10 questions for Evening Pregnancy check-in', () => {
    const eveningQuestions = getCheckinQuestions('evening', 'pregnancy');
    expect(eveningQuestions.length).toBe(10);
  });
});

describe('10-Dimension Indicator Calculation', () => {
  it('calculates score and mood/stress states accurately', () => {
    const mockAnswers = {
      m_sleep: 4,
      m_energy: 3,
      m_mood: 4,
      m_stress: 2,
      m_focus: 3,
      m_comfort: 4,
      m_hydration: 3,
      m_movement: 3,
      m_intention: 4,
      m_support: 1,
    };

    const questions = getCheckinQuestions('morning', 'general');
    const indicators = calculateCheckinIndicators(mockAnswers, questions);
    expect(typeof indicators.wellnessScore).toBe('number');
    expect(indicators.wellnessScore).toBeGreaterThanOrEqual(0);
    expect(indicators.wellnessScore).toBeLessThanOrEqual(100);
    expect(indicators.stress.level).toBe('Mild Daily Tension');
    expect(indicators.mood.state).toBe('Positive');
    expect(indicators.energy.level).toBe('Moderate');
  });
});
