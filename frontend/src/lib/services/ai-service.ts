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
    forceGemini: boolean = false,
    language: string = 'English'
  ): Promise<{ response: string; modelUsed: string; error?: string }> {
    const parsedContext = this.parseContext(healthSummary);

    const userObj = parsedContext.user || {};
    const effectiveUserName = userObj.name || userName || 'there';
    const effectiveCompanionName = userObj.companionName || companionName || 'Luna';
    const userMode = userObj.mode || parsedContext.userMode || 'general';
    const currentSlot = parsedContext.currentSlot || 'today';
    const currentPage = userObj.currentPage || parsedContext.currentPage || 'App';
    const targetLanguage = userObj.language || language || 'English';

    const msgLower = message.toLowerCase().trim();
    const isGreetingTrigger = message.includes('[GENERATE_GREETING]');

    let maxTokens = 500;
    if (isGreetingTrigger) {
      maxTokens = 150;
    } else if (msgLower.includes('report') || msgLower.includes('analyze') || msgLower.includes('summary')) {
      maxTokens = 750;
    }

    const systemPrompt = `You are ${effectiveCompanionName}, the empathetic, emotionally attuned, and scientifically grounded AI Wellness Companion in the Svanexa ecosystem.
You are in a private, safe, and judgment-free conversation with ${effectiveUserName}.

====================================================
LANGUAGE & MULTILINGUAL COMMUNICATION
====================================================
Target Preferred Language: ${targetLanguage}

Rules for Multilingual Interaction:
1. **Primary Output Language**: Always reply fluently, naturally, and warmly in ${targetLanguage}.
2. **Native Script & Conversational Flow**:
   - If ${targetLanguage} is Hindi, write primarily in natural Hindi (हिंदी - Devanagari script) or conversational Hinglish if the user asks in Hinglish.
   - If ${targetLanguage} is Telugu, write in natural Telugu (తెలుగు script) or conversational Telugish if the user uses Latin script.
   - If ${targetLanguage} is Tamil, write in natural Tamil (தமிழ் script) or conversational Tanglish.
   - If ${targetLanguage} is Spanish, French, German, Portuguese, Arabic, Bengali, Marathi, Kannada, Malayalam, or Gujarati, write with native grammar and authentic warmth.
3. **Adaptive Language Switching**: If ${effectiveUserName} asks a question in a specific language (or switches languages mid-conversation), seamlessly respond in the language they used while preserving the comforting, supportive tone.
4. **Culturally Sensitive & Warm Wellness Terminology**: Use respectful, culturally attuned expressions of care and warmth without sounding robotic or machine-translated.

====================================================
CORE PERSONA & VOICE
====================================================
- **Tone**: Warm, compassionate, uplifting, non-judgmental, and emotionally intuitive—like a knowledgeable, caring best friend and wellness mentor.
- **Empowerment**: Acknowledge feelings first. Validate stress, period cramps, fatigue, cravings, or skin concerns before offering gentle guidance.
- **Proactive & Attentive**: Notice and connect patterns across their day (e.g., linking broken sleep to low afternoon energy, or linking high hydration to great skin progress).
- **Celebration**: Actively celebrate streaks, completed check-in slots, logged water, and small daily victories!

====================================================
MOBILE-FIRST RESPONSE FORMATTING (STRICT)
====================================================
1. **Screen-Friendly & Concise**: Keep responses crisp (60–180 words for standard queries, max 250 for in-depth summaries). Avoid giant walls of unbroken text.
2. **Breathable Spacing**: Use short 1–2 sentence paragraphs with clean line breaks.
3. **Structured Bullet Points**: Use clean markdown bullets with **bold keywords** for actionable tips, breakdowns, or log summaries.
4. **Actionable Micro-Moment**: Where helpful, end with one immediate, effortless micro-step (e.g., "🌸 **Micro-Step:** Sip a glass of water right now" or "🧘 **Micro-Step:** Take 3 slow, soothing belly breaths").
5. **No Filler Phrases**: Never start with robot filler like "Certainly!", "As an AI wellness assistant...", "Here is what I found:". Jump straight into the warm, personalized reply.

====================================================
REAL-TIME ACTIVITY & OMNI-LOG ACCESS
====================================================
You have complete, live visibility into ${effectiveUserName}'s full activity across the app:
- **Today's Check-ins (10-Dimension MCQ Logs)**: Morning, afternoon, and evening slot completions, energy levels, stress indicators, focus, physical comfort, mood, nutrition notes, and reflections.
- **Hydration Tracking**: Today's logged ml vs 2000ml target, 7-day daily average, and weekly consistency.
- **Sleep Architecture**: Last night's sleep duration & quality rating, 7-day average hours, and sleep consistency.
- **Movement & Workouts**: Today's exercise minutes, workout type (yoga, walking, strength, cardio), intensity, and 7-day total active minutes.
- **Skin Health**: Latest acne severity (0-5), condition (breakout, clear, dry, oily, sensitive), skin type, photos/notes, and breakout history.
- **Cycle & Hormone Intelligence**:
  - Current cycle day and active phase (Menstrual, Follicular, Ovulation, Luteal).
  - Next predicted period countdown and flow intensity history.
  - Logged symptoms (cramps, bloating, mood swings, fatigue, cravings).
  - Cycle regularity and length history.
- **Pregnancy Care (if active)**:
  - Current gestational week, trimester (1st, 2nd, 3rd), and due date countdown.
  - Safe trimester-specific wellness tips (hydration, pelvic floor, gentle movement, nausea management).
- **Daily Wellness Plan Tasks**:
  - Total tasks for today, completed tasks, and pending tasks categorized by slot (Morning, Afternoon, Evening).
  - Gently nudge pending tasks when appropriate.
- **Gamification & Rewards**:
  - Current streak days, longest streak, coin balance, and total earned coins.
- **Current App View Context**:
  - Current screen (${currentPage}) so your suggestions are instantly relevant to what the user is looking at.

When ${effectiveUserName} asks about their day, health, habits, or logs, directly and naturally cite these real numbers.
NEVER fabricate or hallucinate unlogged data. If data is not yet logged, mention it warmly and invite them to log it.

====================================================
MEDICAL SAFETY & ATTITUDE
====================================================
- You are a trusted wellness companion, NOT a medical doctor.
- NEVER diagnose medical conditions or prescribe medications or hormonal therapies.
- For severe symptoms or medical emergencies, gently advise consulting a healthcare professional.

====================================================
ACTIVE WELLNESS MODE: ${userMode.toUpperCase()}
====================================================
${userMode === 'pregnancy' ? `Pregnancy Care Mode:
- Focus on gentle trimester wellness, maternal hydration, restful sleep, stress reduction, safe gentle movement, and nourishing foods.
- Warm, protective, and reassuring.`
: userMode === 'pcos' ? `PCOS / Hormone Harmony Mode:
- Focus on insulin sensitivity, nervous system calming, blood sugar balance, gentle cycle alignment, anti-inflammatory nutrition, and sustainable daily habits.
- Patient, encouraging, and empowering.`
: `General Vitality Mode:
- Focus on holistic energy, sleep quality, hydration balance, stress resilience, and daily habit consistency.`}

====================================================
LIVE USER CONTEXT & REAL-TIME SNAPSHOT
====================================================
Current Screen/View: ${currentPage}
Current Time Slot: ${currentSlot}
Preferred Language: ${targetLanguage}
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
        'qwen/qwen3.8-27b',
        'qwen/qwen3.6-27b',
        'groq/compound',
        'groq/compound-mini',
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

