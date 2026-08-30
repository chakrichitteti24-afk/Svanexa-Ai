import Groq from 'groq-sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export class AIService {
  private groq: Groq | null = null;
  private gemini: GoogleGenerativeAI | null = null;
  private primaryModel: string = 'openai/gpt-oss-20b';

  constructor() {
    if (process.env.GROQ_API_KEY) {
      this.groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    }
    if (process.env.GEMINI_API_KEY) {
      this.gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    }
  }

  /**
   * Robustly extracts a structured context object from various string formats
   * including [USER CONTEXT]: {...}, [HEALTH SUMMARY]: {...}, or raw JSON.
   */
  private parseContext(rawContext: string | object | null | undefined): Record<string, any> {
    if (!rawContext) return {};
    if (typeof rawContext === 'object') return rawContext as Record<string, any>;

    const str = String(rawContext).trim();

    // 1. Direct JSON parse
    try {
      if (str.startsWith('{') && str.endsWith('}')) {
        return JSON.parse(str);
      }
    } catch {}

    // 2. Tagged context format [USER CONTEXT]: {...} or [HEALTH SUMMARY]: {...}
    try {
      const match = str.match(/\[(?:USER CONTEXT|HEALTH SUMMARY|USER MEMORY)\]:\s*([\s\S]*)/i);
      if (match && match[1]) {
        const jsonPart = match[1].trim();
        return JSON.parse(jsonPart);
      }
    } catch {}

    // 3. Fallback regex to find first JSON object { ... }
    try {
      const firstBrace = str.indexOf('{');
      const lastBrace = str.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        return JSON.parse(str.substring(firstBrace, lastBrace + 1));
      }
    } catch {}

    return {};
  }

  async generateCompanionResponse(
    message: string,
    history: ChatMessage[],
    healthSummary: string | object,
    companionName: string = 'Luna',
    userName: string = 'there',
    forceGemini: boolean = false
  ): Promise<{ response: string; modelUsed: string; error?: string }> {
    const parsedContext = this.parseContext(healthSummary);

    const userObj = parsedContext.user || {};
    const effectiveUserName = userObj.name || userName || 'there';
    const effectiveCompanionName = userObj.companionName || companionName || 'Luna';
    const userMode = userObj.mode || parsedContext.userMode || 'general';
    const currentSlot = parsedContext.currentSlot || 'today';
    const currentPage = userObj.currentPage || parsedContext.currentPage || 'App';

    const msgLower = message.toLowerCase().trim();
    const isGreetingTrigger = message.includes('[GENERATE_GREETING]');

    let maxTokens = 450;
    if (isGreetingTrigger) {
      maxTokens = 120;
    } else if (msgLower.includes('report') || msgLower.includes('analyze') || msgLower.includes('summary')) {
      maxTokens = 600;
    }

    const systemPrompt = `You are ${effectiveCompanionName}, the empathetic, emotionally attuned AI Wellness Companion in the Svanexa ecosystem.
You are in a private conversation with ${effectiveUserName}.

====================================================
MOBILE-FIRST RESPONSE FORMATTING (STRICT)
====================================================
1. **Screen-Friendly & Concise**: Keep responses crisp (60–180 words for standard queries, max 250 for reports). Mobile screens are small; avoid walls of dense text.
2. **Breathable Spacing**: Use short 1–2 sentence paragraphs with clean line breaks.
3. **Structured Bullet Points**: Use neat markdown bullets with **bold highlights** for actionable tips, breakdowns, or log summaries.
4. **Actionable Micro-Moment**: Where helpful, end with one immediate, effortless micro-step (e.g., "🌸 **Micro-Step:** Take 3 slow belly breaths right now" or "💧 **Micro-Step:** Sip a glass of water").
5. **No Filler**: Never start with robot filler like "Certainly!", "As an AI...", "Here is what I found:". Jump straight into the warm, personalized reply.

====================================================
REAL-TIME ACTIVITY & OMNI-LOG ACCESS
====================================================
You have complete, live visibility into ${effectiveUserName}'s activities:
- **Daily Check-ins**: Morning, afternoon, and evening slot completion, energy, stress level, focus, and symptoms.
- **Hydration**: Live water intake in ml and 7-day average.
- **Sleep**: Last night's sleep hours, sleep quality, and weekly average.
- **Movement**: Workout duration, exercise type, and cumulative weekly minutes.
- **Skin**: Acne level, skin condition (breakout, clear, dry, oily), and notes.
- **Cycle & Hormone Phase**: Cycle day, active phase (Menstrual, Follicular, Ovulation, Luteal), next period countdown, or irregular cycle tracking.
- **Pregnancy (if active)**: Gestational week, trimester, and countdown.
- **Wellness Plan Tasks**: Pending and completed daily wellness tasks.
- **Streaks & Coins**: Active daily streak and coin balance.

When ${effectiveUserName} asks about their day, health, habits, or logs, directly and naturally cite these real numbers. Celebrate consistency and acknowledge their efforts!
If a habit hasn't been logged yet today, mention it warmly and gently invite them to log it.

====================================================
MEDICAL SAFETY & ATTITUDE
====================================================
- Warm, non-judgmental, empowering, and protective.
- You are a trusted wellness companion, NOT a medical doctor.
- NEVER diagnose medical conditions or prescribe medications/supplements.
- NEVER invent or guess unlogged data.

====================================================
ACTIVE MODE: ${userMode.toUpperCase()}
====================================================
${userMode === 'pregnancy' ? `Pregnancy Care Mode:
- Focus on gentle trimester wellness, hydration, restful sleep, stress relief, safe gentle movement, and nourishing nutrition.
- Warm, protective, and reassuring.`
: userMode === 'pcos' ? `PCOS / Hormone Harmony Mode:
- Focus on nervous system calming, blood sugar balance, gentle cycle alignment, anti-inflammatory habits, and daily micro-habits.
- Patient, encouraging, and empowering.`
: `General Vitality Mode:
- Focus on holistic energy, sleep quality, hydration balance, stress resilience, and daily habit consistency.`}

====================================================
LIVE USER CONTEXT & REAL-TIME SNAPSHOT
====================================================
Current Screen/View: ${currentPage}
Current Time Slot: ${currentSlot}
Live Activity Data:
${JSON.stringify(parsedContext, null, 2)}
====================================================`;

    // 1. If forceGemini is requested
    if (forceGemini) {
      try {
        const responseText = await this.queryGemini(systemPrompt, history, message, maxTokens);
        return { response: responseText, modelUsed: 'gemini-2.5-flash' };
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        return {
          response: "I'm having trouble analyzing your wellness data right now. Please try again soon. 🌸",
          modelUsed: 'gemini-2.5-flash',
          error: errorMsg
        };
      }
    }

    // 2. Primary: Groq Multi-Tier Fallback Chain (prioritizing openai/gpt-oss-20b)
    if (this.groq) {
      const groqMessages = [
        { role: 'system' as const, content: systemPrompt },
        ...history.map(m => ({
          role: m.role === 'assistant' ? ('assistant' as const) : ('user' as const),
          content: m.content
        })),
        { role: 'user' as const, content: message }
      ];

      const groqModels = [
        'openai/gpt-oss-20b',
        'openai/gpt-oss-120b',
        'llama-3.3-70b-versatile',
        'llama-3.1-8b-instant',
        'mixtral-8x7b-32768',
      ];

      for (const modelName of groqModels) {
        try {
          const responsePromise = this.groq.chat.completions.create({
            messages: groqMessages,
            model: modelName,
            temperature: 0.7,
            max_tokens: maxTokens,
          });

          const timeoutPromise = new Promise<null>((_, reject) =>
            setTimeout(() => reject(new Error(`Groq ${modelName} timeout`)), 7000)
          );

          const chatCompletion: any = await Promise.race([responsePromise, timeoutPromise]);
          const reply = chatCompletion?.choices?.[0]?.message?.content;
          if (reply && typeof reply === 'string' && reply.trim().length > 0) {
            return {
              response: reply.trim(),
              modelUsed: modelName,
            };
          }
        } catch (modelErr) {
          console.warn(`[AIService] Groq model ${modelName} failed, trying next fallback:`, modelErr);
        }
      }
    }

    // 3. Secondary Backup: Gemini
    if (this.gemini) {
      try {
        const responseText = await this.queryGemini(systemPrompt, history, message, maxTokens);
        return {
          response: responseText,
          modelUsed: 'gemini-2.5-flash',
        };
      } catch (geminiError) {
        console.error('[AIService] Gemini fallback failed:', geminiError);
        return {
          response: "I'm having a little trouble connecting right now. Please try again in a moment. 🌸",
          modelUsed: this.primaryModel,
          error: geminiError instanceof Error ? geminiError.message : String(geminiError)
        };
      }
    }

    return {
      response: "AI API keys not configured. Please set GROQ_API_KEY or GEMINI_API_KEY in backend environment.",
      modelUsed: this.primaryModel
    };
  }

  private async queryGemini(
    systemInstruction: string,
    history: ChatMessage[],
    message: string,
    maxTokens: number
  ): Promise<string> {
    if (!this.gemini) {
      throw new Error('Gemini API key is not configured.');
    }

    const geminiModels = ['gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-2.0-flash'];

    const contents = [
      ...history.map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      })),
      {
        role: 'user',
        parts: [{ text: message }]
      }
    ];

    for (const modelName of geminiModels) {
      try {
        const model = this.gemini.getGenerativeModel({
          model: modelName,
          systemInstruction: systemInstruction,
        });

        const result = await model.generateContent({
          contents: contents,
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: maxTokens,
          }
        });
        const response = await result.response;
        const text = response.text();
        if (text && text.trim().length > 0) {
          return text.trim();
        }
      } catch (err) {
        console.warn(`[AIService] Gemini model ${modelName} failed, trying next:`, err);
      }
    }

    throw new Error('All Gemini models failed');
  }
}

