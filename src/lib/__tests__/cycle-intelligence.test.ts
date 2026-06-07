import { describe, it, expect } from 'vitest';
import { CycleIntelligenceEngine } from '../cycle-intelligence';
import { subDays, format } from 'date-fns';

describe('CycleIntelligenceEngine - Advanced Test Cases', () => {
  const today = new Date();

  describe('Edge Case: No Data', () => {
    it('handles empty cycle arrays gracefully without crashing', () => {
      const engine = new CycleIntelligenceEngine([], {}, false);
      const analytics = engine.analyzeCycles();
      
      expect(analytics.avgCycleLength).toBe(28);
      expect(analytics.avgPeriodDuration).toBe(5);
      expect(analytics.regularityStatus).toBe('Not Enough Data');
      expect(analytics.trend).toBe('Unknown');
      
      const prediction = engine.predictNextPeriod();
      expect(prediction).toBeNull();
    });
  });

  describe('Edge Case: Single Cycle Entry', () => {
    it('provides basic predictions with lower confidence when only 1 cycle is logged', () => {
      const singleCycle = [
        {
          startDate: subDays(today, 10).toISOString(),
          endDate: subDays(today, 5).toISOString(),
        }
      ];
      
      const engine = new CycleIntelligenceEngine(singleCycle, {}, false);
      const analytics = engine.analyzeCycles();
      
      expect(analytics.avgCycleLength).toBe(28); // Fallback length
      expect(analytics.regularityStatus).toBe('Not Enough Data');
      
      const prediction = engine.predictNextPeriod();
      expect(prediction).not.toBeNull();
      if (prediction) {
        expect(prediction.confidenceScore).toBeLessThan(70); // Penalty for low data count
        expect(prediction.confidenceLabel).toBe('Moderate');
      }
    });
  });

  describe('Cycle Trend Detection', () => {
    it('detects an increasing cycle length trend', () => {
      // Intervals: 36 days (newest gap), 33 days, 30 days. Increasing gap sizes.
      const increasingCycles = [
        { startDate: subDays(today, 10).toISOString(), endDate: subDays(today, 5).toISOString() },
        { startDate: subDays(today, 46).toISOString(), endDate: subDays(today, 41).toISOString() },
        { startDate: subDays(today, 79).toISOString(), endDate: subDays(today, 74).toISOString() },
        { startDate: subDays(today, 109).toISOString(), endDate: subDays(today, 104).toISOString() }
      ];

      const engine = new CycleIntelligenceEngine(increasingCycles, {}, false);
      const analytics = engine.analyzeCycles();
      expect(analytics.trend).toBe('Increasing');
    });

    it('detects a decreasing cycle length trend', () => {
      // Intervals: 25 days, 28 days, 31 days. Decreasing gap sizes (moving forward in time).
      const decreasingCycles = [
        { startDate: subDays(today, 10).toISOString(), endDate: subDays(today, 5).toISOString() },
        { startDate: subDays(today, 35).toISOString(), endDate: subDays(today, 30).toISOString() },
        { startDate: subDays(today, 63).toISOString(), endDate: subDays(today, 58).toISOString() },
        { startDate: subDays(today, 94).toISOString(), endDate: subDays(today, 89).toISOString() }
      ];

      const engine = new CycleIntelligenceEngine(decreasingCycles, {}, false);
      const analytics = engine.analyzeCycles();
      expect(analytics.trend).toBe('Decreasing');
    });
  });

  describe('Cycle Regularity Classification', () => {
    it('classifies cycle regularity as Highly Irregular if standard deviation exceeds threshold', () => {
      // Extreme variance in cycle gaps: 45 days, 21 days, 38 days
      const irregularCycles = [
        { startDate: subDays(today, 10).toISOString(), endDate: subDays(today, 5).toISOString() },
        { startDate: subDays(today, 55).toISOString(), endDate: subDays(today, 50).toISOString() },
        { startDate: subDays(today, 76).toISOString(), endDate: subDays(today, 71).toISOString() },
        { startDate: subDays(today, 114).toISOString(), endDate: subDays(today, 109).toISOString() }
      ];

      const engine = new CycleIntelligenceEngine(irregularCycles, {}, false);
      const analytics = engine.analyzeCycles();
      expect(analytics.regularityStatus).toBe('Highly Irregular');
    });
  });

  describe('Health Score Calculation & Insights', () => {
    it('penalizes health score for high stress, poor sleep, and low water intake', () => {
      const poorHabitsCheckIns: Record<string, any> = {};
      // Generate 10 days of check-ins with poor habits
      for (let i = 0; i < 10; i++) {
        const d = format(subDays(today, i), 'yyyy-MM-dd');
        poorHabitsCheckIns[d] = {
          mood: 'angry',
          sleep: 5, // Under 6.5 hours
          water: 1.0, // Under 1.5 L
          exercise: 0, // Under 15 mins
          stress: 9, // Above 7
          acne: 8,
          hairFall: 'high',
          bloating: 'moderate',
          fatigue: 'severe',
          cramps: 'severe',
        };
      }

      // Irregular cycles to trigger irregularity penalty (-20)
      const baseCycles = [
        { startDate: subDays(today, 10).toISOString(), endDate: subDays(today, 5).toISOString() },
        { startDate: subDays(today, 55).toISOString(), endDate: subDays(today, 50).toISOString() },
        { startDate: subDays(today, 76).toISOString(), endDate: subDays(today, 71).toISOString() },
        { startDate: subDays(today, 114).toISOString(), endDate: subDays(today, 109).toISOString() }
      ];

      const engine = new CycleIntelligenceEngine(baseCycles, poorHabitsCheckIns, false);
      const healthResult = engine.calculateHealthScore();

      expect(healthResult.score).toBeLessThan(60); // 100 - 20 (irregularity) - 40 (habits) = 40
      expect(healthResult.category).toBe('Needs Attention');
      expect(healthResult.insights.some(i => i.includes('Sleep'))).toBe(true);
      expect(healthResult.insights.some(i => i.includes('Stress'))).toBe(true);
      expect(healthResult.insights.some(i => i.includes('Water'))).toBe(true);
      expect(healthResult.insights.some(i => i.includes('cramps'))).toBe(true);
    });
  });
});
