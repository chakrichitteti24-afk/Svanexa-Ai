import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AIService } from '../services/ai-service';

describe('AI Companion Activity Logs & Context Suite', () => {
  let aiService: AIService;

  beforeEach(() => {
    aiService = new AIService();
  });

  describe('Context Parsing Resilience', () => {
    it('correctly parses [USER CONTEXT]: tagged JSON string', async () => {
      const mockContext = {
        user: { name: 'Sarah', mode: 'pcos', companionName: 'Luna' },
        todayActivity: {
          water: '2000 ml',
          sleep: '8 hours',
          checkinSlotsCompleted: ['morning', 'afternoon'],
        },
        gamification: { streakDays: 5, coinBalance: 120 },
      };

      const rawString = `[USER CONTEXT]:\n${JSON.stringify(mockContext, null, 2)}`;
      const parsed = (aiService as any).parseContext(rawString);

      expect(parsed.user.name).toBe('Sarah');
      expect(parsed.user.mode).toBe('pcos');
      expect(parsed.todayActivity.water).toBe('2000 ml');
      expect(parsed.todayActivity.checkinSlotsCompleted).toContain('morning');
      expect(parsed.gamification.streakDays).toBe(5);
    });

    it('correctly parses [HEALTH SUMMARY]: legacy tagged format', async () => {
      const mockContext = {
        userMode: 'pregnancy',
        total_logs_count: 12,
        mood: [{ date: '2026-08-30', mood: 'calm' }],
      };

      const rawString = `[HEALTH SUMMARY]: ${JSON.stringify(mockContext)}`;
      const parsed = (aiService as any).parseContext(rawString);

      expect(parsed.userMode).toBe('pregnancy');
      expect(parsed.total_logs_count).toBe(12);
    });

    it('handles raw JSON objects directly without error', async () => {
      const mockObj = {
        user: { name: 'Emily' },
        todayActivity: { water: '1500 ml' },
      };

      const parsed = (aiService as any).parseContext(mockObj);
      expect(parsed.user.name).toBe('Emily');
      expect(parsed.todayActivity.water).toBe('1500 ml');
    });

    it('safely handles empty or corrupted strings gracefully', async () => {
      expect((aiService as any).parseContext('')).toEqual({});
      expect((aiService as any).parseContext(null)).toEqual({});
      expect((aiService as any).parseContext('corrupted {invalid json')).toEqual({});
    });
  });

  describe('Model Prompt & Activity Context Integration', () => {
    it('constructs rich system prompt containing omni-activity data, 10-dimension checkins, and averages', async () => {
      const fullContext = {
        user: { name: 'Maya', mode: 'pcos', companionName: 'Luna', currentPage: 'Cycle Tracker' },
        currentSlot: 'afternoon',
        todayActivity: {
          checkinSlotsCompleted: ['morning'],
          sleep: '7.5 hours',
          water: '1200 ml',
          exercise: '25 mins (yoga)',
          mood: 'optimistic',
        },
        checkInDetails: {
          has10DimensionData: true,
          energyLevel: 8,
          stressLevel: 3,
          focusLevel: 7,
          bodyComfort: 'mild pelvic cramps',
          supportChoices: ['light stretch', 'warm tea'],
          userNotes: 'Feeling productive after breakfast.',
        },
        multiDayAverages: {
          period: '7 Days',
          avgSleep: '7.8 hrs',
          avgHydration: '1850 ml',
          avgExercise: '32 mins/day',
        },
        wellnessPlan: {
          totalTasksCount: 3,
          completedTasksCount: 1,
          pendingTasksCount: 2,
          pendingTasks: [{ title: 'Drink spearmint tea', category: 'nutrition' }],
        },
        skinTracking: { acneLevel: 1, skinType: 'balanced' },
        cycleIntelligence: { phase: 'follicular', cycleDay: 8, daysUntilPeriod: 20 },
        gamification: { streakDays: 7, coinBalance: 250 },
      };

      const createMock = vi.fn().mockResolvedValue({
        choices: [{ message: { content: 'Maya, you are doing amazing with your 7-day streak! 🌸' } }],
      });

      (aiService as any).groq = {
        chat: { completions: { create: createMock } },
      };

      const res = await aiService.generateCompanionResponse(
        'How am I doing today?',
        [],
        `[USER CONTEXT]:\n${JSON.stringify(fullContext)}`,
        'Luna',
        'Maya',
        false,
        'English'
      );

      expect(res.response).toContain('Maya');
      expect(createMock).toHaveBeenCalled();

      const passedMessages = createMock.mock.calls[0][0].messages;
      const systemMsg = passedMessages.find((m: any) => m.role === 'system').content;

      expect(systemMsg).toContain('Luna');
      expect(systemMsg).toContain('Maya');
      expect(systemMsg).toContain('PCOS');
      expect(systemMsg).toContain('Cycle Tracker');
      expect(systemMsg).toContain('1200 ml');
      expect(systemMsg).toContain('spearmint tea');
      expect(systemMsg).toContain('follicular');
      expect(systemMsg).toContain('mild pelvic cramps');
      expect(systemMsg).toContain('1850 ml');
      expect(systemMsg).toContain('7');
    });

    it('enforces multilingual system prompt constraints for Hindi', async () => {
      const createMock = vi.fn().mockResolvedValue({
        choices: [{ message: { content: 'नमस्ते माया! आप आज बहुत अच्छा कर रही हैं।' } }],
      });

      (aiService as any).groq = {
        chat: { completions: { create: createMock } },
      };

      await aiService.generateCompanionResponse(
        'आज का स्वास्थ्य कैसा है?',
        [],
        JSON.stringify({ user: { name: 'Maya', mode: 'general' } }),
        'Luna',
        'Maya',
        false,
        'Hindi'
      );

      const passedMessages = createMock.mock.calls[0][0].messages;
      const systemMsg = passedMessages.find((m: any) => m.role === 'system').content;

      expect(systemMsg).toContain('Target Preferred Language: Hindi');
      expect(systemMsg).toContain('Devanagari script');
      expect(systemMsg).toContain('Hinglish');
    });

    it('enforces multilingual system prompt constraints for Telugu', async () => {
      const createMock = vi.fn().mockResolvedValue({
        choices: [{ message: { content: 'నమస్కారం! ఈరోజు మీ ఆరోగ్యం బాగుంది.' } }],
      });

      (aiService as any).groq = {
        chat: { completions: { create: createMock } },
      };

      await aiService.generateCompanionResponse(
        'ఈరోజు నా హెల్త్ ఎలా ఉంది?',
        [],
        JSON.stringify({ user: { name: 'Ananya', mode: 'pregnancy' } }),
        'Luna',
        'Ananya',
        false,
        'Telugu'
      );

      const passedMessages = createMock.mock.calls[0][0].messages;
      const systemMsg = passedMessages.find((m: any) => m.role === 'system').content;

      expect(systemMsg).toContain('Target Preferred Language: Telugu');
      expect(systemMsg).toContain('తెలుగు script');
    });

    it('enforces multilingual system prompt constraints for Spanish', async () => {
      const createMock = vi.fn().mockResolvedValue({
        choices: [{ message: { content: '¡Hola! Tu bienestar hoy va excelente.' } }],
      });

      (aiService as any).groq = {
        chat: { completions: { create: createMock } },
      };

      await aiService.generateCompanionResponse(
        '¿Cómo estoy hoy?',
        [],
        JSON.stringify({ user: { name: 'Sofia', mode: 'pcos' } }),
        'Luna',
        'Sofia',
        false,
        'Spanish'
      );

      const passedMessages = createMock.mock.calls[0][0].messages;
      const systemMsg = passedMessages.find((m: any) => m.role === 'system').content;

      expect(systemMsg).toContain('Target Preferred Language: Spanish');
      expect(systemMsg).toContain('Always reply fluently, naturally, and warmly in Spanish');
    });
  });
});

