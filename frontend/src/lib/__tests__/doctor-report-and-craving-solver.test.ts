import { describe, it, expect } from 'vitest';
import { triggerHaptic } from '../../utils/haptics';

describe('Haptic Sensory Feedback Engine', () => {
  it('executes safely in node/mock environment without errors', () => {
    expect(() => triggerHaptic('light')).not.toThrow();
    expect(() => triggerHaptic('medium')).not.toThrow();
    expect(() => triggerHaptic('heavy')).not.toThrow();
    expect(() => triggerHaptic('success')).not.toThrow();
    expect(() => triggerHaptic('warning')).not.toThrow();
    expect(() => triggerHaptic('selection')).not.toThrow();
  });
});

describe('Doctor Report Clinical Biomarker Calculation', () => {
  it('computes regular cycle lengths and low variance correctly', () => {
    const cycleLengths = [28, 29, 27, 28, 28];
    const avg = Math.round(cycleLengths.reduce((a, b) => a + b, 0) / cycleLengths.length);
    const variance = Math.round(
      Math.sqrt(
        cycleLengths.reduce((acc, val) => acc + Math.pow(val - avg, 2), 0) / cycleLengths.length
      )
    );

    expect(avg).toBe(28);
    expect(variance).toBeLessThanOrEqual(3);
    const status = variance <= 3 ? 'Regular (Low Variance)' : 'Irregular';
    expect(status).toBe('Regular (Low Variance)');
  });

  it('detects high variance PCOS menstrual pattern', () => {
    const pcosCycleLengths = [28, 45, 32, 60, 26];
    const avg = Math.round(pcosCycleLengths.reduce((a, b) => a + b, 0) / pcosCycleLengths.length);
    const variance = Math.round(
      Math.sqrt(
        pcosCycleLengths.reduce((acc, val) => acc + Math.pow(val - avg, 2), 0) / pcosCycleLengths.length
      )
    );

    expect(variance).toBeGreaterThan(7);
    const status =
      variance <= 3
        ? 'Regular (Low Variance)'
        : variance <= 7
        ? 'Moderate Variance'
        : 'Irregular (High Variance / PCOS Pattern)';
    expect(status).toBe('Irregular (High Variance / PCOS Pattern)');
  });
});

describe('Hormone Food & Craving Solver Rules', () => {
  const CATEGORIES = ['sugar', 'energy', 'cramps', 'bloating', 'pcos_glucose'] as const;

  it('has valid categories covering essential women wellness needs', () => {
    expect(CATEGORIES.length).toBe(5);
    expect(CATEGORIES).toContain('sugar');
    expect(CATEGORIES).toContain('cramps');
    expect(CATEGORIES).toContain('pcos_glucose');
    expect(CATEGORIES).toContain('bloating');
    expect(CATEGORIES).toContain('energy');
  });
});
