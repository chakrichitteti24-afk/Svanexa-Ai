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

  async generateCompanionResponse(
    message: string,
    history: ChatMessage[],
    healthSummary: string,
    companionName: string,
    userName: string,
    forceGemini: boolean = false
  ): Promise<{ response: string; modelUsed: string; error?: string }> {
    const trimmedMsg = message.trim().toLowerCase();
    if (trimmedMsg === 'hi') {
      return { response: "Hey 😊\nHow are you doing today?", modelUsed: this.primaryModel };
    }
    if (trimmedMsg === 'hello') {
      return { response: "Hi 💜\nHow's your day going?", modelUsed: this.primaryModel };
    }
    if (trimmedMsg === 'hey') {
      return { response: "Hey!\nNice to hear from you 😊", modelUsed: this.primaryModel };
    }

    let healthObj: any = null;
    let memoryObj: any = null;

    try {
      const healthMatch = healthSummary.match(/\[HEALTH SUMMARY\]:\s*(\{.*\})/);
      if (healthMatch) {
        healthObj = JSON.parse(healthMatch[1]);
      }
    } catch {}

    try {
      const memoryMatch = healthSummary.match(/\[USER MEMORY\]:\s*(\{.*\})/);
      if (memoryMatch) {
        memoryObj = JSON.parse(memoryMatch[1]);
      }
    } catch {}

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
        relevantDataText = JSON.stringify(healthObj);
      }
    }

    let maxTokens = 150;
    if (isGreeting) {
      maxTokens = 80;
    } else if (isReportRequest) {
      maxTokens = 380;
    } else if (relevantCategories.length > 0 && relevantCategories[0] !== 'NONE') {
      maxTokens = 200;
    }

    const userMode = healthObj?.userMode || 'general';

    const systemPrompt = `You are ${companionName}, the AI Wellness Companion inside Svanexa.
You are talking with ${userName}.

====================================================
CORE PERSONALITY
====================================================
You are a trusted wellness companion — warm, clear, concise, supportive, and non-judgmental.
You are NOT a licensed doctor. You do NOT diagnose.
You do NOT prescribe medicines, supplements, or treatments.
You speak only in English.
You do NOT use roleplay actions (no "smiles", "hugs", "waves").
You do NOT use excessive emojis (one per response maximum).
You never fear-monger or catastrophize.
You never repeat generic advice the user did not ask for.

====================================================
RESPONSE RULES — STRICT
====================================================
1. Answer the user's actual question FIRST.
2. Maximum response length: ${maxTokens} tokens.
3. Format: 2–5 short sentences OR 3–5 concise bullet points.
4. Do NOT repeat the user's question back to them.
5. Do NOT start with filler phrases like "Of course!", "Absolutely!", "Great question!".
6. Do NOT add unnecessary medical disclaimers unless the user asks about treatment.
7. Stop once the user's request is fully addressed.

====================================================
CONTEXT PRIORITY (apply in this order)
====================================================
Priority 1: Current user message (answer this first)
Priority 2: Current conversation history (use to maintain continuity)
Priority 3: Today's check-in data (stress score, mood, focus, body, sleep)
Priority 4: Today's wellness plan (pending and completed tasks)
Priority 5: Historical context (cycle phase, pregnancy due date, recent trends)

Only mention context that is relevant to the user's question.
Do NOT dump all health data into every response.

====================================================
STRESS INDICATOR LANGUAGE
====================================================
If referencing stress, use language like:
- "Your responses suggest you may be feeling more stressed today."
- "Your check-in suggests you are feeling relatively balanced."
NEVER say: "You have high stress." or "You are stressed."

====================================================
MODE AWARENESS: ${userMode.toUpperCase()}
====================================================
${userMode === 'pregnancy' ? `You are speaking with someone who is pregnant.
- Focus on gentle wellness: hydration, rest, gentle movement, nutrition.
- Language: warm, protective, reassuring.
- NEVER diagnose pregnancy complications or recommend medicines.` 
: userMode === 'pcos' ? `You are speaking with someone managing PCOS/PCOD.
- Focus on lifestyle: stress relief, cycle care, gentle exercise, balanced nutrition.
- Language: supportive, patient, encouraging.
- NEVER recommend medicines or diagnose hormonal conditions.`
: `General wellness mode.
- Focus on daily habits: sleep, hydration, movement, mood, stress balance.
- Language: practical, warm, and motivating.`}

====================================================
ACTIVE USER CONTEXT
====================================================
Relevant categories for this response: ${relevantCategories.join(', ')}
User Data: ${relevantDataText}`;

    if (forceGemini) {
      try {
        const responseText = await this.queryGemini(systemPrompt, history, message, maxTokens);
        return { response: responseText, modelUsed: 'gemini-2.5-flash' };
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        return { response: "I'm having trouble analyzing your wellness data right now. Please try again soon. 🌸", modelUsed: 'gemini-2.5-flash', error: errorMsg };
      }
    }

    if (this.groq) {
      try {
        const groqMessages = [
          { role: 'system' as const, content: systemPrompt },
          ...history.map(m => ({
            role: m.role === 'assistant' ? ('assistant' as const) : ('user' as const),
            content: m.content
          })),
          { role: 'user' as const, content: message }
        ];

        let chatCompletion: any = null;

        // Try primary model openai/gpt-oss-120b, with fallback to qwen/qwen3.6-27b
        try {
          const responsePromise = this.groq.chat.completions.create({
            messages: groqMessages,
            model: 'openai/gpt-oss-120b',
            temperature: 0.7,
            max_tokens: maxTokens,
          });

          const timeoutPromise = new Promise<null>((_, reject) =>
            setTimeout(() => reject(new Error('Groq Primary Model Timeout')), 6000)
          );

          chatCompletion = await Promise.race([responsePromise, timeoutPromise]);
        } catch {
          // Fallback to qwen/qwen3.6-27b
          const fallbackPromise = this.groq.chat.completions.create({
            messages: groqMessages,
            model: 'qwen/qwen3.6-27b',
            temperature: 0.7,
            max_tokens: maxTokens,
          });
          chatCompletion = await fallbackPromise;
        }
        
        if (chatCompletion && chatCompletion.choices[0]?.message?.content) {
          return {
            response: chatCompletion.choices[0].message.content,
            modelUsed: this.primaryModel
          };
        }
        throw new Error('Empty response from Groq');
      } catch (error) {
        if (this.gemini) {
          try {
            const responseText = await this.queryGemini(systemPrompt, history, message, maxTokens);
            return {
              response: responseText,
              modelUsed: 'gemini-2.5-flash'
            };
          } catch (geminiError) {
            return {
              response: "I'm sorry, I'm having trouble communicating right now. Please try again later. 🌸",
              modelUsed: this.primaryModel,
              error: geminiError instanceof Error ? geminiError.message : String(geminiError)
            };
          }
        } else {
          return {
            response: "I'm sorry, my systems are experiencing issues and I cannot reach my backup models. 🌸",
            modelUsed: this.primaryModel,
            error: error instanceof Error ? error.message : String(error)
          };
        }
      }
    } else {
      if (this.gemini) {
        try {
          const responseText = await this.queryGemini(systemPrompt, history, message, maxTokens);
          return { response: responseText, modelUsed: 'gemini-2.5-flash' };
        } catch (err) {
          return { response: "Backend API keys are not fully configured.", modelUsed: 'gemini-2.5-flash', error: String(err) };
        }
      }
    }

    return { response: 'AI API keys not configured. Please set GROQ_API_KEY or GEMINI_API_KEY in backend environment', modelUsed: this.primaryModel };
  }

  private async queryGemini(systemInstruction: string, history: ChatMessage[], message: string, maxTokens: number): Promise<string> {
    if (!this.gemini) {
      throw new Error('Gemini API key is not configured.');
    }

    let model: any;
    try {
      model = this.gemini.getGenerativeModel({
        model: 'gemini-2.5-flash',
        systemInstruction: systemInstruction,
      });
    } catch {
      model = this.gemini.getGenerativeModel({
        model: 'gemini-3.6-flash',
        systemInstruction: systemInstruction,
      });
    }

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

    try {
      const result = await model.generateContent({
        contents: contents,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: maxTokens,
        }
      });
      const response = await result.response;
      return response.text();
    } catch (e) {
      // Fallback model
      const fallbackModel = this.gemini.getGenerativeModel({
        model: 'gemini-3.6-flash',
        systemInstruction: systemInstruction,
      });
      const result = await fallbackModel.generateContent({
        contents: contents,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: maxTokens,
        }
      });
      const response = await result.response;
      return response.text();
    }
  }
}
