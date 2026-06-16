import Groq from 'groq-sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export class AIService {
  private groq: Groq | null = null;
  private gemini: GoogleGenerativeAI | null = null;

  constructor() {
    if (process.env.GROQ_API_KEY) {
      this.groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    }
    if (process.env.GEMINI_API_KEY) {
      this.gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    }
  }

  async generateCompanionResponse(
    message: string,
    history: ChatMessage[],
    healthSummary: string,
    companionName: string,
    userName: string,
    forceGemini: boolean = false
  ): Promise<{ response: string; modelUsed: 'llama-3.1-8b' | 'gemini-2.5-flash'; error?: string }> {
    const trimmedMsg = message.trim().toLowerCase();
    if (trimmedMsg === 'hi') {
      return { response: "Hey 😊\nHow are you doing today?", modelUsed: 'llama-3.1-8b' };
    }
    if (trimmedMsg === 'hello') {
      return { response: "Hi 💜\nHow's your day going?", modelUsed: 'llama-3.1-8b' };
    }
    if (trimmedMsg === 'hey') {
      return { response: "Hey!\nNice to hear from you 😊", modelUsed: 'llama-3.1-8b' };
    }

    let healthObj: any = null;
    let memoryObj: any = null;

    try {
      const healthMatch = healthSummary.match(/\[HEALTH SUMMARY\]:\s*(\{.*\})/);
      if (healthMatch) {
        healthObj = JSON.parse(healthMatch[1]);
      }
    } catch (e) {
      console.warn('[AIService] Failed to parse health summary JSON:', e);
    }

    try {
      const memoryMatch = healthSummary.match(/\[USER MEMORY\]:\s*(\{.*\})/);
      if (memoryMatch) {
        memoryObj = JSON.parse(memoryMatch[1]);
      }
    } catch (e) {
      console.warn('[AIService] Failed to parse user memory JSON:', e);
    }

    const msgLower = message.toLowerCase();
    
    const greetingKeywords = [
      'hi', 'hello', 'hey', 'good morning', 'good afternoon', 'good evening', 'yo', 'sup', 
      'what\'s up', 'howdy', 'how are you', 'how\'s it going', 'how are you doing', 
      'what are you doing', 'who are you', 'what is your name'
    ];
    
    const isGreeting = greetingKeywords.some(keyword => {
      return msgLower === keyword || msgLower.startsWith(keyword + ' ') || msgLower.startsWith(keyword + ',') || msgLower.startsWith(keyword + '!');
    }) || msgLower.trim().length <= 3;

    const isReportRequest = forceGemini || 
      msgLower.includes('report') || 
      msgLower.includes('analyze') || 
      msgLower.includes('analysis') || 
      msgLower.includes('how am i doing') || 
      msgLower.includes('my wellness') || 
      msgLower.includes('my health') || 
      msgLower.includes('my logs') || 
      msgLower.includes('my summary');

    let relevantCategories: string[] = [];
    let relevantDataText = '';

    if (isGreeting) {
      relevantCategories = ['NONE'];
      relevantDataText = 'NONE (Use conversation only. Do NOT mention or use any health/wellness data).';
    } else if (isReportRequest) {
      relevantCategories = ['ALL'];
      const filteredHealth = { ...healthObj };
      relevantDataText = JSON.stringify(filteredHealth);
    } else {
      const categories: string[] = [];

      const sleepKeywords = ['tired', 'exhausted', 'fatigue', 'sleepy', 'lethargic', 'energy', 'weary', 'low energy', 'sleep', 'insomnia', 'woke up', 'rest'];
      if (sleepKeywords.some(kw => msgLower.includes(kw))) {
        categories.push('Sleep', 'Stress', 'Period Status');
      }

      const skinKeywords = ['skin', 'acne', 'pimple', 'breakout', 'face', 'zits', 'rash', 'dry', 'oily', 'worse'];
      if (skinKeywords.some(kw => msgLower.includes(kw))) {
        categories.push('Skin Logs', 'Sleep', 'Stress', 'Period Phase');
      }

      const moodKeywords = ['mood', 'sad', 'anxious', 'depressed', 'angry', 'emotional', 'calm', 'crying', 'irritated', 'swings', 'stress', 'pressure', 'overwhelmed', 'tense', 'relax', 'nervous', 'scared'];
      if (moodKeywords.some(kw => msgLower.includes(kw))) {
        categories.push('Mood', 'Stress', 'Period Status');
      }

      const cycleKeywords = ['period', 'cycle', 'cramp', 'pcos', 'pcod', 'bleeding', 'flow', 'ovulating', 'fertility', 'fertile', 'ovulation', 'due', 'late', 'menstruation', 'pms', 'bloat', 'stomach', 'pain', 'nausea', 'headache', 'gradient', 'symptom'];
      if (cycleKeywords.some(kw => msgLower.includes(kw))) {
        categories.push('Cycle Information', 'Symptom History');
      }

      const uniqueCategories = Array.from(new Set(categories));
      
      if (uniqueCategories.length === 0) {
        relevantCategories = ['NONE'];
        relevantDataText = 'NONE (No specific health query. Keep it conversational. Do NOT mention wellness trends).';
      } else {
        relevantCategories = uniqueCategories;
        const filteredHealth: any = {};
        
        if (uniqueCategories.includes('Sleep')) {
          filteredHealth.sleep_avg = healthObj?.sleep_avg;
        }
        if (uniqueCategories.includes('Stress') || uniqueCategories.includes('Mood')) {
          filteredHealth.stress_trend = healthObj?.stress_trend;
          filteredHealth.mood_trend = healthObj?.mood_trend;
        }
        if (uniqueCategories.includes('Period Status') || uniqueCategories.includes('Period Phase') || uniqueCategories.includes('Cycle Information')) {
          filteredHealth.cycle_status = healthObj?.cycle_status;
        }
        if (uniqueCategories.includes('Symptom History') || uniqueCategories.includes('Skin Logs')) {
          filteredHealth.risk_flags = healthObj?.risk_flags;
        }
        
        filteredHealth.total_logs_count = healthObj?.total_logs_count;
        relevantDataText = JSON.stringify(filteredHealth);
      }
    }

    const systemPrompt = `CORE PERSONALITY & COMPANION FIRST:
- You are a warm, human, caring, intelligent, and emotionally aware wellness companion. Your name is ${companionName}.
- You are NOT a medical report generator, clinical reporting tool, dashboard, or monitoring device.
- Ensure the user feels understood, not monitored. Behave like a thoughtful friend.
- Priorities: Conversation first, Insight second, Analytics last.

FORBIDDEN BEHAVIOR (CRITICAL):
- Never use action descriptors in asterisks or parentheses (e.g., *smiles*, *sighs*).
- NEVER use these words/actions: laughs, smiles, giggles, hugs, waves, nods.
- NEVER roleplay actions.
- NEVER pretend to have a personal life or do things in the physical world (e.g., Never say "I was gardening", "I was thinking about flowers", "I went somewhere", "I did this today"). You are an AI wellness companion, not a human with a physical routine.

NO RANDOM TOPICS:
- Never introduce topics like gardening, movies, travel, books, food, or hobbies unless the user brings them up first.

HEALTH DISCUSSIONS (CRITICAL):
- When the user expresses a struggle (e.g., "My health is bad", "My period is late", "I'm tired", "I'm stressed"):
  1. First show genuine Empathy (warm, validating).
  2. Ask thoughtful Questions to understand.
  3. Offer supportive Guidance.
  - NEVER start with analytics, numbers, or records.

LANGUAGE ADAPTATION:
- If the user speaks Telugu, reply naturally in a Telugu-English mix.
- If the user speaks English, reply in English.
- Always mirror the user's conversational style.

RESPONSE STYLE & LENGTH:
- Default length: 2-6 lines.
- Avoid giant paragraphs or walls of text. Ensure high mobile readability by using short paragraphs.
- Empathy and conversation come first.

INVISIBLE CONTEXT RULE (CRITICAL):
- You have access to the user's wellness history/context.
- You MUST NEVER explicitly reveal or state that you are reading database records, logs, dashboards, or analytics.
- NEVER use phrases like: "I checked your logs", "I looked at your records", "Your database shows", "Your stored data says", "According to your logs", "Your stress log shows", "I noticed in your check-ins".
- Instead, weave the information naturally into the conversation to make the user feel understood.

DO NOT FORCE ANALYTICS:
- You should not mention wellness data or trends unless the user expresses a concern or asks about them.

RELEVANCE SCORING & CONTEXT INTEGRATION:
- The relevant wellness categories for this turn are: ${relevantCategories.join(', ')}.
- Active Wellness Data for this turn: ${relevantDataText}
- If the active wellness data is "NONE", you MUST NOT mention any wellness averages, trends, or cycle status. Focus purely on warm, conversational chit-chat as a friend.

TRUST FIRST DESIGN & DATA ACCURACY:
- NEVER invent health information, trends, scores, or estimates.
- If data is missing or incomplete for a topic they asked about, reply exactly: "Not enough information yet."
- Never predict a single exact date for cycle predictions. Always state a prediction window range with confidence and reason.
- PCOS Mode: When active, widen the forecast range, lower confidence, and address variability without implying medical certainty.

USER MEMORY PROFILE:
- Name: ${userName}
- Profile: ${memoryObj ? JSON.stringify(memoryObj) : 'No memory profile'}`;

    if (forceGemini) {
      console.log('[AIService] Forcing Gemini 2.5 Flash for deep analysis...');
      try {
        const responseText = await this.queryGemini(systemPrompt, history, message);
        return { response: responseText, modelUsed: 'gemini-2.5-flash' };
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        return { response: "I'm having trouble analyzing your wellness data right now. Please try again soon. 🌸", modelUsed: 'gemini-2.5-flash', error: errorMsg };
      }
    }

    if (this.groq) {
      try {
        console.log('[AIService] Attempting response with Llama 3.1 8B Instant (Primary)...');
        
        const groqMessages = [
          { role: 'system' as const, content: systemPrompt },
          ...history.map(m => ({
            role: m.role === 'assistant' ? ('assistant' as const) : ('user' as const),
            content: m.content
          })),
          { role: 'user' as const, content: message }
        ];

        const responsePromise = this.groq.chat.completions.create({
          messages: groqMessages,
          model: 'llama-3.1-8b-instant',
          temperature: 0.7,
          max_tokens: 1024,
        });

        const timeoutPromise = new Promise<null>((_, reject) =>
          setTimeout(() => reject(new Error('Llama 3.1 API Timeout')), 6000)
        );

        const chatCompletion = await Promise.race([responsePromise, timeoutPromise]);
        
        if (chatCompletion && chatCompletion.choices[0]?.message?.content) {
          return {
            response: chatCompletion.choices[0].message.content,
            modelUsed: 'llama-3.1-8b'
          };
        }
        throw new Error('Empty response from Llama 3.1');
      } catch (error) {
        console.warn('[AIService] Llama 3.1 failed or timed out. Falling back to Gemini 2.5 Flash...', error);
        
        if (this.gemini) {
          try {
            const responseText = await this.queryGemini(systemPrompt, history, message);
            return {
              response: responseText,
              modelUsed: 'gemini-2.5-flash'
            };
          } catch (geminiError) {
            console.error('[AIService] Failover to Gemini 2.5 Flash also failed:', geminiError);
            return {
              response: "I'm sorry, I'm having trouble communicating right now. Please try again later. 🌸",
              modelUsed: 'llama-3.1-8b',
              error: geminiError instanceof Error ? geminiError.message : String(geminiError)
            };
          }
        } else {
          return {
            response: "I'm sorry, my systems are experiencing issues and I cannot reach my backup models. 🌸",
            modelUsed: 'llama-3.1-8b',
            error: error instanceof Error ? error.message : String(error)
          };
        }
      }
    } else {
      if (this.gemini) {
        try {
          const responseText = await this.queryGemini(systemPrompt, history, message);
          return { response: responseText, modelUsed: 'gemini-2.5-flash' };
        } catch (err) {
          return { response: "Backend API keys are not fully configured.", modelUsed: 'gemini-2.5-flash', error: String(err) };
        }
      }
    }

    return { response: 'AI API keys not configured. Please set GROQ_API_KEY or GEMINI_API_KEY in backend environment', modelUsed: 'llama-3.1-8b' };
  }

  private async queryGemini(systemInstruction: string, history: ChatMessage[], message: string): Promise<string> {
    if (!this.gemini) {
      throw new Error('Gemini API key is not configured.');
    }

    const model = this.gemini.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: systemInstruction,
    });

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

    const result = await model.generateContent({
      contents: contents,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1024,
      }
    });

    const response = await result.response;
    return response.text();
  }
}
