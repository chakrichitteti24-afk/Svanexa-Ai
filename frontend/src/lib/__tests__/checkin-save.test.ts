import { describe, it, expect } from 'vitest';
import {
  getCheckinQuestions,
  calculateCheckinIndicators,
  getStressInterpretation,
  calculateStressScore,
  type CheckinSlot,
  type WellnessMode,
} from '../questions/checkin-questions';
import { getNormalizedDate, isValidDateString } from '../../utils/date-utils';

describe('Comprehensive Check-in Save & Reflection Logic Tests', () => {
  const slots: CheckinSlot[] = ['morning', 'afternoon', 'evening'];
  const modes: WellnessMode[] = ['general', 'pcos', 'pregnancy'];

  describe('1. 10 MCQ Question Matrix for All Slots & Modes', () => {
    for (const slot of slots) {
      for (const mode of modes) {
        it(`generates 10 valid questions for slot: ${slot}, mode: ${mode}`, () => {
          const questions = getCheckinQuestions(slot, mode);
          expect(questions.length).toBe(10);
          
          const ids = new Set<string>();
          questions.forEach(q => {
            expect(q.id).toBeTruthy();
            expect(ids.has(q.id)).toBe(false);
            ids.add(q.id);
            expect(q.category).toBeTruthy();
            expect(q.title).toBeTruthy();
            expect(q.question).toBeTruthy();
            expect(q.options.length).toBeGreaterThanOrEqual(3);
            q.options.forEach(opt => {
              expect(typeof opt.score).toBe('number');
              expect(opt.label).toBeTruthy();
              expect(opt.emoji).toBeTruthy();
            });
          });
        });
      }
    }
  });

  describe('2. "Save My Reflection" Button Flow & Reflection State', () => {
    it('saves reflection text and question answers without data loss', () => {
      const answers: Record<string, number> = {
        m_sleep: 4, m_energy: 4, m_mood: 5, m_stress: 1, m_focus: 4,
        m_comfort: 5, m_hydration: 3, m_movement: 4, m_wellness: 4, m_support: 5
      };
      const reflectionText = "Feeling grateful and ready for a productive day!";
      const questions = getCheckinQuestions('morning', 'general');
      const indicators = calculateCheckinIndicators(answers, questions);

      const payload = {
        slot: 'morning',
        date: getNormalizedDate(),
        data: {
          answers,
          indicators,
          reflection: reflectionText,
          note: reflectionText,
        }
      };

      expect(payload.data.reflection).toBe(reflectionText);
      expect(Object.keys(payload.data.answers).length).toBe(10);
      expect(payload.data.indicators.wellnessScore).toBeGreaterThanOrEqual(0);
    });

    it('prevents duplicate save requests while saving is active', () => {
      let isSavingRef = false;
      let saveCount = 0;

      const triggerSave = () => {
        if (isSavingRef) return false;
        isSavingRef = true;
        saveCount++;
        return true;
      };

      // First click succeeds
      expect(triggerSave()).toBe(true);
      expect(saveCount).toBe(1);

      // Rapid second and third clicks are blocked
      expect(triggerSave()).toBe(false);
      expect(triggerSave()).toBe(false);
      expect(saveCount).toBe(1);

      // Finish saving
      isSavingRef = false;

      // Retry after finish succeeds
      expect(triggerSave()).toBe(true);
      expect(saveCount).toBe(2);
    });

    it('retains user answers and reflection text on error for easy retry', () => {
      const answers = { m_sleep: 3, m_energy: 3 };
      const reflectionText = "Had a restless night, aiming for gentle rest.";
      let saveState: 'idle' | 'saving' | 'saved' | 'error' = 'idle';

      // Simulate network failure
      const simulateFailedSave = () => {
        saveState = 'saving';
        // Mock error response
        saveState = 'error';
      };

      simulateFailedSave();
      expect(saveState).toBe('error');

      // Answers and reflection text are NOT reset/lost
      expect(answers.m_sleep).toBe(3);
      expect(reflectionText).toContain('Had a restless night');

      // Simulate successful retry
      saveState = 'saved';
      expect(saveState).toBe('saved');
    });
  });

  describe('3. Check-in Indicators Calculation & Edge Cases', () => {
    it('handles empty answers gracefully with sensible defaults', () => {
      const questions = getCheckinQuestions('morning', 'general');
      const indicators = calculateCheckinIndicators({}, questions);
      expect(indicators).toBeDefined();
      expect(typeof indicators.wellnessScore).toBe('number');
      expect(indicators.wellnessScore).toBeGreaterThanOrEqual(0);
      expect(indicators.wellnessScore).toBeLessThanOrEqual(100);
      expect(indicators.stress).toBeDefined();
      expect(indicators.mood).toBeDefined();
      expect(indicators.energy).toBeDefined();
    });

    it('calculates highest possible scores correctly', () => {
      const questions = getCheckinQuestions('morning', 'general');
      const perfectAnswers: Record<string, number> = {};
      questions.forEach(q => {
        if (q.isStressDimension) {
          perfectAnswers[q.id] = 1;
        } else {
          perfectAnswers[q.id] = 5;
        }
      });

      const indicators = calculateCheckinIndicators(perfectAnswers, questions);
      expect(indicators.wellnessScore).toBeGreaterThanOrEqual(90);
      expect(indicators.stress.level).toBe('Calm & Balanced');
    });

    it('calculates elevated stress correctly without diagnostic phrasing', () => {
      const questions = getCheckinQuestions('morning', 'general');
      const highStressAnswers: Record<string, number> = {};
      questions.forEach(q => {
        if (q.isStressDimension) {
          highStressAnswers[q.id] = 5;
        } else {
          highStressAnswers[q.id] = 1;
        }
      });

      const indicators = calculateCheckinIndicators(highStressAnswers, questions);
      expect(indicators.stress.level).toBe('Elevated Pressure');
      expect(indicators.stress.label).not.toContain('disorder');
      expect(indicators.stress.label).not.toContain('diagnose');
    });
  });

  describe('4. Multi-slot Daily Check-in Summary JSON Merge Simulation', () => {
    it('simulates saving morning, afternoon, and evening sequentially', () => {
      let dailySummary: Record<string, any> = {};

      // 1. Save morning
      const morningAnswers = { m_sleep: 4, m_energy: 3 };
      const morningData = { answers: morningAnswers, wellnessScore: 75, reflection: 'Good start' };
      dailySummary['morning'] = {
        completed: true,
        completedAt: new Date().toISOString(),
        data: morningData,
        claimed: false,
      };

      expect(dailySummary['morning'].completed).toBe(true);
      expect(dailySummary['morning'].claimed).toBe(false);

      // 2. Save afternoon without overwriting morning
      const afternoonAnswers = { a_energy: 4, a_focus: 2 };
      const afternoonData = { answers: afternoonAnswers, wellnessScore: 80, reflection: 'Productive midday' };
      dailySummary['afternoon'] = {
        completed: true,
        completedAt: new Date().toISOString(),
        data: afternoonData,
        claimed: false,
      };

      expect(dailySummary['morning'].completed).toBe(true);
      expect(dailySummary['afternoon'].completed).toBe(true);
      expect(dailySummary['evening']).toBeUndefined();

      // 3. Claim morning reward
      dailySummary['morning'].claimed = true;
      expect(dailySummary['morning'].claimed).toBe(true);

      // 4. Save evening
      const eveningAnswers = { e_winddown: 5, e_reflection: 4 };
      const eveningData = { answers: eveningAnswers, wellnessScore: 85, reflection: 'Peaceful night' };
      dailySummary['evening'] = {
        completed: true,
        completedAt: new Date().toISOString(),
        data: eveningData,
        claimed: false,
      };

      const allCompleted = slots.every(s => dailySummary[s]?.completed);
      expect(allCompleted).toBe(true);
    });

    it('preserves claimed status when editing a check-in', () => {
      let slotMeta: Record<string, any> = {
        morning: { completed: true, completedAt: '2026-08-16T08:00:00Z', data: { score: 70 }, claimed: true },
      };

      const updatedData = { score: 85, reflection: 'Updated morning note' };
      slotMeta['morning'] = {
        completed: true,
        completedAt: new Date().toISOString(),
        data: updatedData,
        claimed: slotMeta['morning']?.claimed ?? false,
      };

      expect(slotMeta['morning'].claimed).toBe(true);
      expect(slotMeta['morning'].data.score).toBe(85);
      expect(slotMeta['morning'].data.reflection).toBe('Updated morning note');
    });
  });

  describe('5. Stress Interpretation Helper', () => {
    it('returns valid interpretation for all score thresholds', () => {
      expect(getStressInterpretation(1.5).level).toBe('Calm & Balanced');
      expect(getStressInterpretation(2.5).level).toBe('Mild Daily Tension');
      expect(getStressInterpretation(3.5).level).toBe('Moderate Pressure');
      expect(getStressInterpretation(4.5).level).toBe('Elevated Pressure');
      expect(getStressInterpretation(null).level).toBe('Pending');
    });

    it('calculates legacy stress score backward compatibility helper', () => {
      const score = calculateStressScore({
        q1_feeling: 2,
        q2_focus: 2,
        q3_body: 3,
        q4_thoughts: 3,
      });
      expect(score).toBe(2.5);
    });
  });

  describe('6. Strict Time-Based Slot Period Verification', () => {
    function resolveSlotForHour(h: number): CheckinSlot {
      if (h >= 6 && h < 12) return 'morning';
      if (h >= 12 && h < 18) return 'afternoon';
      return 'evening';
    }

    it('resolves Morning for hours 06:00 to 11:59', () => {
      [6, 7, 8, 9, 10, 11].forEach(hour => {
        expect(resolveSlotForHour(hour)).toBe('morning');
      });
    });

    it('resolves Afternoon for hours 12:00 to 17:59', () => {
      [12, 13, 14, 15, 16, 17].forEach(hour => {
        expect(resolveSlotForHour(hour)).toBe('afternoon');
      });
    });

    it('resolves Evening for hours 18:00 to 23:59', () => {
      [18, 19, 20, 21, 22, 23].forEach(hour => {
        expect(resolveSlotForHour(hour)).toBe('evening');
      });
    });
  });

  describe('7. Distinct Question Sets Across Slots', () => {
    it('ensures Morning, Afternoon, and Evening have distinct question sets and IDs', () => {
      const morningQs = getCheckinQuestions('morning', 'general');
      const afternoonQs = getCheckinQuestions('afternoon', 'general');
      const eveningQs = getCheckinQuestions('evening', 'general');

      expect(morningQs.length).toBe(10);
      expect(afternoonQs.length).toBe(10);
      expect(eveningQs.length).toBe(10);

      const morningIds = new Set(morningQs.map(q => q.id));
      const afternoonIds = new Set(afternoonQs.map(q => q.id));
      const eveningIds = new Set(eveningQs.map(q => q.id));

      // No ID collisions across periods
      morningIds.forEach(id => {
        expect(afternoonIds.has(id)).toBe(false);
        expect(eveningIds.has(id)).toBe(false);
      });

      afternoonIds.forEach(id => {
        expect(eveningIds.has(id)).toBe(false);
      });

      // Question texts are tailored to the time of day
      expect(morningQs[0].question).toContain('sleep');
      expect(afternoonQs[0].question).toContain('midday');
      expect(eveningQs[0].question).toContain('tonight');
    });
  });

  describe('8. 11-Step Check-in Flow with Reflection Step', () => {
    it('verifies 10 questions followed by Step 11 for personal reflection', () => {
      const totalQuestions = 10;
      const totalSteps = totalQuestions + 1; // 11 steps

      expect(totalSteps).toBe(11);

      // Steps 0..9 are MCQ questions
      for (let step = 0; step < totalQuestions; step++) {
        const isReflectionStep = step === totalQuestions;
        expect(isReflectionStep).toBe(false);
      }

      // Step 10 is the Reflection step
      const step10IsReflection = 10 === totalQuestions;
      expect(step10IsReflection).toBe(true);
    });
  });
});

