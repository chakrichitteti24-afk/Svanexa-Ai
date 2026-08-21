import { describe, it, expect, vi } from 'vitest';
import {
  interpretWeatherCode,
  getUvCategory,
  generateWellnessAdvice,
  GET as getWeatherRoute,
} from '../../app/api/weather/route';

describe('Live Weather & Wellness Intelligence Test Suite', () => {
  describe('1. WMO Weather Code Interpreter', () => {
    it('interprets clear sky for day and night', () => {
      const dayClear = interpretWeatherCode(0, true);
      expect(dayClear.condition).toBe('Clear Sky');
      expect(dayClear.emoji).toBe('☀️');

      const nightClear = interpretWeatherCode(0, false);
      expect(nightClear.condition).toBe('Clear Sky');
      expect(nightClear.emoji).toBe('🌙');
    });

    it('interprets cloudy and overcast codes', () => {
      expect(interpretWeatherCode(1).condition).toBe('Mainly Clear');
      expect(interpretWeatherCode(2).condition).toBe('Partly Cloudy');
      expect(interpretWeatherCode(3).condition).toBe('Overcast');
    });

    it('interprets rain, snow, and thunderstorms', () => {
      expect(interpretWeatherCode(61).condition).toBe('Rain');
      expect(interpretWeatherCode(71).condition).toBe('Snowfall');
      expect(interpretWeatherCode(95).condition).toBe('Thunderstorm');
    });

    it('gracefully handles unknown weather codes', () => {
      const fallback = interpretWeatherCode(999, true);
      expect(fallback.condition).toBe('Clear');
      expect(fallback.emoji).toBe('☀️');
    });
  });

  describe('2. UV Index Categorization & Skin Protection Rules', () => {
    it('categorizes Low UV (< 3)', () => {
      const res = getUvCategory(1.5);
      expect(res.level).toBe('Low');
      expect(res.advice).toContain('Minimal sun protection');
    });

    it('categorizes Moderate UV (3 - 5)', () => {
      const res = getUvCategory(4);
      expect(res.level).toBe('Moderate');
      expect(res.advice).toContain('SPF 30+');
    });

    it('categorizes High UV (6 - 7)', () => {
      const res = getUvCategory(7);
      expect(res.level).toBe('High');
      expect(res.advice).toContain('SPF 50+');
    });

    it('categorizes Very High UV (8 - 10)', () => {
      const res = getUvCategory(9);
      expect(res.level).toBe('Very High');
      expect(res.advice).toContain('Extra protection');
    });

    it('categorizes Extreme UV (11+)', () => {
      const res = getUvCategory(12);
      expect(res.level).toBe('Extreme');
      expect(res.advice).toContain('Extreme UV rays');
    });
  });

  describe('3. Wellness, Skin & Hydration Advice Generation', () => {
    it('suggests extra hydration on hot days (> 28°C)', () => {
      const advice = generateWellnessAdvice(30, 45, 5, 'Sunny');
      expect(advice.hydrationAdvice).toContain('+250ml to +500ml');
    });

    it('suggests warm teas on cold days (<= 10°C)', () => {
      const advice = generateWellnessAdvice(8, 60, 2, 'Overcast');
      expect(advice.hydrationAdvice).toContain('warm herbal teas');
    });

    it('recommends broad-spectrum SPF on high UV days', () => {
      const advice = generateWellnessAdvice(24, 50, 7, 'Clear Sky');
      expect(advice.skinAdvice).toContain('SPF 30+/50+');
    });

    it('recommends ceramide moisturizer on dry days (< 40% humidity)', () => {
      const advice = generateWellnessAdvice(22, 35, 4, 'Clear Sky');
      expect(advice.skinAdvice).toContain('ceramide moisturizer');
    });

    it('recommends breathable gel moisturizer on humid days (>= 75% humidity)', () => {
      const advice = generateWellnessAdvice(25, 80, 4, 'Partly Cloudy');
      expect(advice.skinAdvice).toContain('gel moisturizers');
    });

    it('recommends gentle outdoor walks during pleasant conditions (16°C - 26°C)', () => {
      const advice = generateWellnessAdvice(22, 50, 4, 'Clear Sky');
      expect(advice.outdoorAdvice).toContain('15-20 min');
    });

    it('recommends indoor movement on rainy/thunderstorm days', () => {
      const advice = generateWellnessAdvice(20, 90, 2, 'Rain Showers');
      expect(advice.outdoorAdvice).toContain('indoor stretching or yoga');
    });
  });

  describe('4. Weather API Route Validation', () => {
    it('returns 400 for non-numeric latitude or longitude parameters', async () => {
      const req = new Request('http://localhost:3000/api/weather?lat=abc&lon=def');
      const res = await getWeatherRoute(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Invalid');
    });
  });
});
