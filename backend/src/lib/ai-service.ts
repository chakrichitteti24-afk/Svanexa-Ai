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
    }

    try {
      const memoryMatch = healthSummary.match(/\[USER MEMORY\]:\s*(\{.*\})/);
      if (memoryMatch) {
        memoryObj = JSON.parse(memoryMatch[1]);
      }
    } catch (e) {
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
        // With the new memory model, we pass everything if it exists.
        // We will pass the full parsed healthObj instead of filtering it aggressively, 
        // to support the 'Smart Memory' and 'Proactive Friend' requests.
        relevantDataText = JSON.stringify(healthObj);
      }
    }

    let maxTokens = 150;
    if (isGreeting) {
      maxTokens = 80;
    } else if (isReportRequest) {
      maxTokens = 350;
    } else if (relevantCategories.length > 0 && relevantCategories[0] !== 'NONE') {
      maxTokens = 250;
    }

    const userMode = healthObj?.userMode || 'general';

    let personality = 'Friendly, Positive, Motivating';
    if (userMode === 'pcos') {
      personality = 'Supportive, Patient, Encouraging. Focus more on hormone balance and healthy habits.';
    } else if (userMode === 'pregnancy') {
      personality = 'Gentle, Calm, Warm, Reassuring, Protective.';
    }

    const systemPrompt = `You are ${companionName}, the AI Wellness Companion inside HerSync.

Your role is to behave like a trusted family wellness companion.

You are operating in ${userMode.toUpperCase()} mode.
Your personality should be: ${personality}

You are NOT a licensed doctor.

====================================================
PERSONALITY
====================================================
Speak only in English.
Use warm, natural and professional language.
Be encouraging.
Be empathetic.
Never sound robotic.
Never roleplay.
Never pretend to have emotions.
Never use actions like:
smiles
laughs
hugs
waves
Never use emojis excessively.

====================================================
PRIMARY RESPONSIBILITIES
====================================================
====================================================
SMART MEMORY & PROACTIVE FRIEND
====================================================
Before responding, ALWAYS load and analyze the User Context provided below.
You must remember trends from this data (e.g., "I noticed you've been sleeping less over the last three nights.").
Do NOT wait for users to ask everything. Naturally mention observations.
Never ask for information that already exists in the data.
Behave like a trusted friend who genuinely cares. Never sound robotic, never overreact, never judge.

====================================================
RECOMMENDATIONS
====================================================
Recommendations must ONLY come from actual user data.
Recommend:
* Better sleep habits, Drinking water, Walking, Stretching, Yoga, Meditation, Fruits, Vegetables, Protein-rich meals, Relaxation, Journaling, Healthy routines
NEVER recommend medications, supplements, or prescribe treatment. If asked about medication, advise consulting a professional.

====================================================
PATTERN DETECTION
====================================================
Continuously detect:
Sleep trends, Mood changes, Stress changes, Hydration consistency, Exercise consistency, Cycle changes, Pregnancy progress, Skin changes.
Generate insights ONLY when supported by real data.
If data is insufficient, clearly state that more information is needed.

====================================================
GOOD INTERACTION & FORMATTING
====================================================
Sound natural. Example: "You've been consistently sleeping around seven hours this week. That's a positive trend worth maintaining."
Never force recommendations. Never repeat the same advice continuously.
Use Markdown formatting beautifully (bold, bullet points, headers, code blocks) to make your responses easy to read.
For long responses, use headers and lists to organize the information.

====================================================
REPORT & CHECK-IN AWARENESS
====================================================
Understand everything shown inside Reports (if provided). Explain reports in simple English.
Use the daily check-ins immediately as context.

====================================================
HEALTH GUIDANCE & MODES
====================================================
You are operating in ${userMode.toUpperCase()} mode.
${userMode === 'pregnancy' ? `
PREGNANCY AWARENESS:
* Use pregnancy timeline and expected due date.
* Focus on mother wellness, hydration, sleep, walking, nutrition reminders.
* NEVER diagnose pregnancy complications.
* NEVER recommend medicines.
` : userMode === 'pcos' ? `
PCOS/PCOD AWARENESS:
* Focus on lifestyle management, stress reduction, and healthy habits.
* Understand cycle history, irregularities, symptoms, and previous trends.
* Focus more on hormone balance and healthy habits.
* NEVER recommend medicines.
` : `
GENERAL AWARENESS:
* Understand current cycle phase, history, irregularities, symptoms, and previous trends.
* Focus on daily wellness and routine optimization.
`}

====================================================
ZERO HALLUCINATIONS & CONCISENESS
====================================================
Never invent observations. Never create fake memories, reports, percentages, charts, or statistics.
Every recommendation must be traceable to actual stored data.
If uncertain, admit uncertainty. Always prioritize user safety over giving an answer.
Keep your response extremely concise, natural, and useful. Do not use filler text or repetitive sentences. Stop generating once the user's request is fully addressed.

====================================================
USER CONTEXT (REAL DATA)
====================================================
User Name: ${userName}
Profile: ${memoryObj ? JSON.stringify(memoryObj) : 'No memory profile'}
Relevant Wellness Categories for this turn: ${relevantCategories.join(', ')}
Active Wellness Data for this turn: ${relevantDataText}`;

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

        const responsePromise = this.groq.chat.completions.create({
          messages: groqMessages,
          model: 'llama-3.1-8b-instant',
          temperature: 0.7,
          max_tokens: maxTokens,
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
          const responseText = await this.queryGemini(systemPrompt, history, message, maxTokens);
          return { response: responseText, modelUsed: 'gemini-2.5-flash' };
        } catch (err) {
          return { response: "Backend API keys are not fully configured.", modelUsed: 'gemini-2.5-flash', error: String(err) };
        }
      }
    }

    return { response: 'AI API keys not configured. Please set GROQ_API_KEY or GEMINI_API_KEY in backend environment', modelUsed: 'llama-3.1-8b' };
  }

  private async queryGemini(systemInstruction: string, history: ChatMessage[], message: string, maxTokens: number): Promise<string> {
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
        maxOutputTokens: maxTokens,
      }
    });

    const response = await result.response;
    return response.text();
  }
}
