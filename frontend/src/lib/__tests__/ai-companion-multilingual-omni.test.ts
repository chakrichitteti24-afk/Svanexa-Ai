import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AIService } from '../services/ai-service';
import { SUPPORTED_LANGUAGES, LOCALIZED_PROMPTS } from '../../components/chat/FloatingCompanion';

describe('AI Companion Multilingual & Omni-Activity Comprehensive Suite', () => {
  let aiService: AIService;

  beforeEach(() => {
    aiService = new AIService();
  });

  describe('Supported Languages & Localized Prompts Registry', () => {
    it('supports exactly 14 languages with valid metadata and prompt chips', () => {
      expect(SUPPORTED_LANGUAGES).toHaveLength(14);
      
      const expectedCodes = [
        'English', 'Hindi', 'Telugu', 'Tamil', 'Spanish', 
        'French', 'German', 'Kannada', 'Malayalam', 'Marathi', 
        'Bengali', 'Gujarati', 'Arabic', 'Portuguese'
      ];

      for (const code of expectedCodes) {
        const lang = SUPPORTED_LANGUAGES.find(l => l.code === code);
        expect(lang, `Language ${code} must exist in SUPPORTED_LANGUAGES`).toBeDefined();
        expect(lang?.native.length).toBeGreaterThan(0);
        expect(lang?.flag.length).toBeGreaterThan(0);

        const prompts = LOCALIZED_PROMPTS[code];
        expect(prompts, `Prompt chips for ${code} must exist`).toBeDefined();
        expect(prompts.length).toBeGreaterThanOrEqual(4);
      }
    });
  });

  describe('Omni-Activity Awareness Scenarios', () => {
    it('Scenario 1: PCOS User with 10-dimension check-in, 7-day trends, and pending tasks', async () => {
      const pcosContext = {
        user: { name: 'Priya', mode: 'pcos', companionName: 'Luna', currentPage: 'Cycle Tracker' },
        currentSlot: 'afternoon',
        todayActivity: {
          checkinSlotsCompleted: ['morning', 'afternoon'],
          sleep: '6.5 hours',
          water: '1400 ml',
          exercise: '20 mins (walking)',
          mood: 'tired',
        },
        checkInDetails: {
          has10DimensionData: true,
          energyLevel: 4,
          stressLevel: 7,
          focusLevel: 5,
          bodyComfort: 'lower abdomen bloating',
          supportChoices: ['chamomile tea', 'guided meditation'],
          userNotes: 'Heavy workday, craving sugar.',
        },
        multiDayAverages: {
          period: '7 Days',
          avgSleep: '6.8 hrs',
          avgHydration: '1600 ml',
          avgExercise: '25 mins/day',
        },
        wellnessPlan: {
          totalTasksCount: 4,
          completedTasksCount: 2,
          pendingTasksCount: 2,
          pendingTasks: [
            { title: 'Drink spearmint tea', category: 'nutrition', timeSlot: 'afternoon' },
            { title: '10 min bedtime stretch', category: 'movement', timeSlot: 'evening' }
          ],
        },
        skinTracking: { acneLevel: 2, skinType: 'combination', notes: 'Mild chin breakout' },
        cycleIntelligence: { phase: 'luteal', cycleDay: 22, daysUntilPeriod: 6 },
        gamification: { streakDays: 14, longestStreak: 14, coinBalance: 420 },
      };

      const createMock = vi.fn().mockResolvedValue({
        choices: [{ 
          message: { 
            content: 'Priya, I see you are in your luteal phase and dealing with some bloating. 🌸\n\n- **Hydration**: You have logged 1400 ml of your 2000 ml goal.\n- **Micro-Step:** Sip your spearmint tea to soothe your tummy.' 
          } 
        }],
      });

      (aiService as any).groq = {
        chat: { completions: { create: createMock } },
      };

      const result = await aiService.generateCompanionResponse(
        'How can I handle this afternoon craving and bloating?',
        [],
        `[USER CONTEXT]:\n${JSON.stringify(pcosContext, null, 2)}`,
        'Luna',
        'Priya',
        false,
        'English'
      );

      expect(result.response).toContain('Priya');
      expect(createMock).toHaveBeenCalledTimes(1);

      const systemPrompt = createMock.mock.calls[0][0].messages[0].content;

      // Verify all omni-activity fields are present in prompt
      expect(systemPrompt).toContain('Priya');
      expect(systemPrompt).toContain('Luna');
      expect(systemPrompt).toContain('ACTIVE WELLNESS MODE: PCOS');
      expect(systemPrompt).toContain('Cycle Tracker');
      expect(systemPrompt).toContain('1400 ml');
      expect(systemPrompt).toContain('lower abdomen bloating');
      expect(systemPrompt).toContain('chamomile tea');
      expect(systemPrompt).toContain('spearmint tea');
      expect(systemPrompt).toContain('luteal');
      expect(systemPrompt).toContain('14');
      expect(systemPrompt).toContain('420');
      expect(systemPrompt).toContain('Mild chin breakout');
    });

    it('Scenario 2: Pregnancy User with trimester milestone and countdown', async () => {
      const pregnancyContext = {
        user: { name: 'Deepika', mode: 'pregnancy', companionName: 'Luna', currentPage: 'Dashboard' },
        currentSlot: 'morning',
        todayActivity: {
          checkinSlotsCompleted: ['morning'],
          sleep: '8.0 hours',
          water: '800 ml',
          exercise: '15 mins (prenatal yoga)',
          mood: 'peaceful',
        },
        pregnancyIntelligence: {
          isActive: true,
          dueDate: '2026-12-15',
          currentWeek: 24,
          trimester: '2nd Trimester',
          daysRemaining: 106,
          milestone: 'Baby is developing taste buds and hearing voices.',
        },
        wellnessPlan: {
          totalTasksCount: 3,
          completedTasksCount: 1,
          pendingTasksCount: 2,
          pendingTasks: [{ title: 'Electrolyte coconut water', category: 'hydration' }],
        },
        gamification: { streakDays: 9, coinBalance: 280 },
      };

      const createMock = vi.fn().mockResolvedValue({
        choices: [{ 
          message: { 
            content: 'Congratulations on reaching Week 24, Deepika! 🤰\n\n- **Baby Milestone:** Your baby can now hear your soothing voice.\n- **Hydration:** Great start with 800 ml logged.\n\n🌸 **Micro-Step:** Enjoy your electrolyte coconut water.' 
          } 
        }],
      });

      (aiService as any).groq = {
        chat: { completions: { create: createMock } },
      };

      const result = await aiService.generateCompanionResponse(
        'Give me a morning update on my pregnancy and tasks.',
        [],
        `[USER CONTEXT]:\n${JSON.stringify(pregnancyContext, null, 2)}`,
        'Luna',
        'Deepika',
        false,
        'English'
      );

      expect(result.response).toContain('Deepika');
      const systemPrompt = createMock.mock.calls[0][0].messages[0].content;

      expect(systemPrompt).toContain('Deepika');
      expect(systemPrompt).toContain('ACTIVE WELLNESS MODE: PREGNANCY');
      expect(systemPrompt).toContain('24');
      expect(systemPrompt).toContain('2nd Trimester');
      expect(systemPrompt).toContain('Electrolyte coconut water');
      expect(systemPrompt).toContain('prenatal yoga');
    });

    it('Scenario 3: General Wellness User with skin tracking and hydration', async () => {
      const generalContext = {
        user: { name: 'Kavita', mode: 'general', companionName: 'Luna', currentPage: 'Skin Tracker' },
        currentSlot: 'evening',
        todayActivity: {
          checkinSlotsCompleted: ['morning', 'afternoon', 'evening'],
          sleep: '7.2 hours',
          water: '2100 ml',
          exercise: '45 mins (pilates)',
          mood: 'accomplished',
        },
        skinTracking: {
          acneLevel: 1,
          skinType: 'normal',
          notes: 'Skin glowing after hydration goal achieved.',
          breakouts: 'none',
        },
        gamification: { streakDays: 21, coinBalance: 650 },
      };

      const createMock = vi.fn().mockResolvedValue({
        choices: [{ 
          message: { 
            content: 'Incredible job hitting 21 days consistency, Kavita! ✨\n\n- **Skin & Water:** Exceeding 2100 ml has your skin looking clear.\n- **Micro-Step:** Complete your soothing evening skincare routine.' 
          } 
        }],
      });

      (aiService as any).groq = {
        chat: { completions: { create: createMock } },
      };

      const result = await aiService.generateCompanionResponse(
        'Review my day and skin progress.',
        [],
        `[USER CONTEXT]:\n${JSON.stringify(generalContext, null, 2)}`,
        'Luna',
        'Kavita',
        false,
        'English'
      );

      expect(result.response).toContain('Kavita');
      const systemPrompt = createMock.mock.calls[0][0].messages[0].content;

      expect(systemPrompt).toContain('Skin Tracker');
      expect(systemPrompt).toContain('2100 ml');
      expect(systemPrompt).toContain('pilates');
      expect(systemPrompt).toContain('21');
    });
  });

  describe('Multilingual Prompt Generation Across All Languages', () => {
    const testLanguages = [
      { lang: 'Hindi', keyword: 'Devanagari script' },
      { lang: 'Telugu', keyword: 'తెలుగు script' },
      { lang: 'Tamil', keyword: 'தமிழ் script' },
      { lang: 'Spanish', keyword: 'Target Preferred Language: Spanish' },
      { lang: 'French', keyword: 'Target Preferred Language: French' },
      { lang: 'German', keyword: 'Target Preferred Language: German' },
      { lang: 'Kannada', keyword: 'Target Preferred Language: Kannada' },
      { lang: 'Malayalam', keyword: 'Target Preferred Language: Malayalam' },
      { lang: 'Marathi', keyword: 'Target Preferred Language: Marathi' },
      { lang: 'Bengali', keyword: 'Target Preferred Language: Bengali' },
      { lang: 'Gujarati', keyword: 'Target Preferred Language: Gujarati' },
      { lang: 'Arabic', keyword: 'Target Preferred Language: Arabic' },
      { lang: 'Portuguese', keyword: 'Target Preferred Language: Portuguese' },
    ];

    for (const { lang, keyword } of testLanguages) {
      it(`configures system prompt correctly for ${lang}`, async () => {
        const createMock = vi.fn().mockResolvedValue({
          choices: [{ message: { content: `Response in ${lang}` } }],
        });

        (aiService as any).groq = {
          chat: { completions: { create: createMock } },
        };

        await aiService.generateCompanionResponse(
          'Hello',
          [],
          JSON.stringify({ user: { name: 'TestUser', mode: 'general' } }),
          'Luna',
          'TestUser',
          false,
          lang
        );

        const systemPrompt = createMock.mock.calls[0][0].messages[0].content;
        expect(systemPrompt).toContain(`Target Preferred Language: ${lang}`);
        expect(systemPrompt).toContain(keyword);
      });
    }
  });

  describe('Fallback Chain Resilience', () => {
    it('gracefully falls back across Groq models on rate limit (429)', async () => {
      const rateLimitError = new Error('Rate limit exceeded 429');
      const createMock = vi
        .fn()
        .mockRejectedValueOnce(rateLimitError) // primary model fails
        .mockResolvedValueOnce({
          choices: [{ message: { content: 'Fallback model response.' } }],
        });

      (aiService as any).groq = {
        chat: { completions: { create: createMock } },
      };

      const result = await aiService.generateCompanionResponse(
        'Hello',
        [],
        JSON.stringify({ user: { name: 'User' } }),
        'Luna',
        'User',
        false,
        'English'
      );

      expect(result.response).toBe('Fallback model response.');
      expect(createMock).toHaveBeenCalledTimes(2);
    });
  });
});
