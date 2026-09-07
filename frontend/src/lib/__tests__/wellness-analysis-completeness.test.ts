import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AIService } from '../services/ai-service';

describe('Wellness Analysis Completeness & Anti-Truncation Suite', () => {
  let aiService: AIService;

  beforeEach(() => {
    aiService = new AIService();
    (aiService as any).gemini = {};
  });

  describe('Prompt Intent & High Token Budget Allocation', () => {
    it('allocates 4000 tokens for British/Commonwealth spelling "analyse the today wellness"', async () => {
      let capturedTokens = 0;
      vi.spyOn(aiService as any, 'queryGemini').mockImplementation(async (
        _sysPrompt: string,
        _history: any[],
        _msg: string,
        maxTokens: number
      ) => {
        capturedTokens = maxTokens;
        return { text: 'Complete analysis response. 🌸', modelName: 'gemini-2.5-flash' };
      });

      await aiService.generateCompanionResponse(
        'analyse the today wellness',
        [],
        '{}',
        'Luna',
        'Sarah',
        false,
        'English'
      );

      expect(capturedTokens).toBe(4000);
    });

    it('allocates 4000 tokens for US spelling "Analyze today\'s wellness"', async () => {
      let capturedTokens = 0;
      vi.spyOn(aiService as any, 'queryGemini').mockImplementation(async (
        _sysPrompt: string,
        _history: any[],
        _msg: string,
        maxTokens: number
      ) => {
        capturedTokens = maxTokens;
        return { text: 'Complete analysis response. 🌸', modelName: 'gemini-2.5-flash' };
      });

      await aiService.generateCompanionResponse(
        "Analyze today's wellness",
        [],
        '{}',
        'Luna',
        'Sarah',
        false,
        'English'
      );

      expect(capturedTokens).toBe(4000);
    });

    it('allocates 4000 tokens for Hindi localized prompt "आज का वेलनेस विश्लेषण"', async () => {
      let capturedTokens = 0;
      vi.spyOn(aiService as any, 'queryGemini').mockImplementation(async (
        _sysPrompt: string,
        _history: any[],
        _msg: string,
        maxTokens: number
      ) => {
        capturedTokens = maxTokens;
        return { text: 'नमस्ते सारा, आज का स्वास्थ्य विश्लेषण पूर्ण है। 🌸', modelName: 'gemini-2.5-flash' };
      });

      await aiService.generateCompanionResponse(
        'आज का वेलनेस विश्लेषण',
        [],
        '{}',
        'Luna',
        'Sarah',
        false,
        'Hindi'
      );

      expect(capturedTokens).toBe(4000);
    });

    it('allocates 4000 tokens for Telugu localized prompt "ఈరోజు వెల్నెస్ విశ్లేషణ"', async () => {
      let capturedTokens = 0;
      vi.spyOn(aiService as any, 'queryGemini').mockImplementation(async (
        _sysPrompt: string,
        _history: any[],
        _msg: string,
        maxTokens: number
      ) => {
        capturedTokens = maxTokens;
        return { text: 'నమస్కారం, మీ ఆరోగ్య విశ్లేషణ పూర్తయింది. 🌸', modelName: 'gemini-2.5-flash' };
      });

      await aiService.generateCompanionResponse(
        'ఈరోజు వెల్నెస్ విశ్లేషణ',
        [],
        '{}',
        'Luna',
        'Sarah',
        false,
        'Telugu'
      );

      expect(capturedTokens).toBe(4000);
    });

    it('allocates 1200 tokens for greetings with adequate thinking budget', async () => {
      let capturedTokens = 0;
      vi.spyOn(aiService as any, 'queryGemini').mockImplementation(async (
        _sysPrompt: string,
        _history: any[],
        _msg: string,
        maxTokens: number
      ) => {
        capturedTokens = maxTokens;
        return { text: 'Hello Sarah! Welcome back. 🌸', modelName: 'gemini-2.5-flash' };
      });

      await aiService.generateCompanionResponse(
        '[GENERATE_GREETING] Please greet me.',
        [],
        '{}',
        'Luna',
        'Sarah',
        false,
        'English'
      );

      expect(capturedTokens).toBe(1200);
    });
  });

  describe('Response Completeness & Auto-Repair Guard', () => {
    it('cleanly closes a dangling bullet point that was truncated mid-sentence', () => {
      const truncated = `Let's look at your progress:
* **Restful Sleep**: You logged 7.5 hours.
* **Calm Mood**: Despite the fatigue,`;

      const repaired = (aiService as any).ensureResponseCompleteness(truncated);

      expect(repaired).not.toMatch(/fatigue,\s*$/);
      expect(repaired).toContain('* **Calm Mood**: Despite the fatigue.');
      expect(repaired).toContain('🌸 How is your body feeling right now?');
    });

    it('preserves already complete sentences without appending redundant text', () => {
      const complete = `Hello Sarah! Your sleep was 8 hours.
🌸 **Micro-Step:** Drink a glass of water right now. How are you feeling?`;

      const result = (aiService as any).ensureResponseCompleteness(complete);

      expect(result).toBe(complete);
    });

    it('closes incomplete sentences that end abruptly without terminal punctuation', () => {
      const abruptlyEnded = `Your hydration was fantastic today, reaching 1800 ml so far`;

      const repaired = (aiService as any).ensureResponseCompleteness(abruptlyEnded);

      expect(repaired).toMatch(/so far\./);
      expect(repaired).toContain('🌸 How is your body feeling right now?');
    });
  });

  describe('System Prompt Completeness Instructions', () => {
    it('contains the strict completeness guarantee in the system prompt', () => {
      const prompt = aiService.buildSystemPrompt('Luna', 'Chakri', 'pcos', 'afternoon', 'Dashboard', 'English', {});

      expect(prompt).toContain('Completeness Guarantee (Zero Cut-Offs)');
      expect(prompt).toContain('Never stop mid-sentence, mid-bullet, or leave an uncompleted thought');
    });
  });

  describe('Multi-Provider Priority Cascade (Mistral -> Gemini -> Groq)', () => {
    it('uses Mistral AI as primary companion engine when configured', async () => {
      (aiService as any).gemini = {};
      (aiService as any).mistralApiKey = 'test-mistral-key';

      const mistralSpy = vi.spyOn(aiService as any, 'queryMistral').mockResolvedValue({
        text: 'Hello from primary Mistral AI companion! 🌸',
        modelName: 'open-mistral-nemo',
      });
      const geminiSpy = vi.spyOn(aiService as any, 'queryGemini');

      const res = await aiService.generateCompanionResponse(
        'how is my energy today?',
        [],
        '{}',
        'Luna',
        'Sarah',
        false,
        'English'
      );

      expect(mistralSpy).toHaveBeenCalled();
      expect(geminiSpy).not.toHaveBeenCalled();
      expect(res.response).toContain('Hello from primary Mistral AI companion!');
      expect(res.modelUsed).toBe('open-mistral-nemo');
    });

    it('falls back to Gemini when Mistral AI fails or is rate-limited', async () => {
      (aiService as any).gemini = {};
      (aiService as any).mistralApiKey = 'test-mistral-key';

      vi.spyOn(aiService as any, 'queryMistral').mockRejectedValue(new Error('Mistral rate-limited'));
      const geminiSpy = vi.spyOn(aiService as any, 'queryGemini').mockResolvedValue({
        text: 'Hello from secondary Gemini fallback! 🌸',
        modelName: 'gemini-3.6-flash',
      });

      const res = await aiService.generateCompanionResponse(
        'how is my energy today?',
        [],
        '{}',
        'Luna',
        'Sarah',
        false,
        'English'
      );

      expect(geminiSpy).toHaveBeenCalled();
      expect(res.response).toContain('Hello from secondary Gemini fallback!');
      expect(res.modelUsed).toBe('gemini-3.6-flash');
    });
  });
});
