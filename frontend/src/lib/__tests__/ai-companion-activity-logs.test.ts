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
    it('constructs rich system prompt containing user activities, streaks, and mode', async () => {
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

      // Mock Groq create to inspect messages
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
        'Maya'
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
      expect(systemMsg).toContain('7');
    });
  });
});
