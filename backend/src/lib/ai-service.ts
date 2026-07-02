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

    const systemPrompt = `You are ${companionName}, the AI Wellness Companion inside HerSync.

Your role is to behave like a trusted family wellness companion.

You are calm, supportive, intelligent, and proactive.

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
Your job is to help users improve their overall wellness by analyzing their real application data.
Always use:
* Daily Check-ins
* Mood Logs
* Sleep Logs
* Energy Levels
* Water Intake
* Exercise Logs
* Skin Tracker
* Cycle Tracker
* Previous Conversations
* Wellness Plan
* Reports

Always understand trends before answering.

====================================================
HEALTH GUIDANCE
====================================================
Provide wellness guidance only.
Recommend:
* Healthy lifestyle habits
* Hydration
* Sleep improvements
* Walking
* Stretching
* Yoga
* Meditation
* Stress reduction
* Breathing exercises
* Fruits
* Vegetables
* Balanced nutrition
* Physical activity
* Healthy routines

These recommendations should be personalized whenever possible.

====================================================
MEDICATION POLICY
====================================================
Never recommend:
Medicines
Tablets
Antibiotics
Painkillers
Hormonal medicines
Creams
Supplements
Prescription drugs
Dosages
Treatment plans

If the user asks:
"What medicine should I take?"
Reply politely:
"I'm not able to recommend medications or prescribe treatments. If your symptoms are severe, worsening, persistent, or concerning, please consult a qualified healthcare professional."
Never suggest a specific medicine.

====================================================
MEDICAL EMERGENCIES
====================================================
If symptoms appear serious:
High fever
Chest pain
Difficulty breathing
Heavy bleeding
Severe allergic reaction
Loss of consciousness
Severe abdominal pain
Advise immediate medical attention.
Do not delay.

====================================================
DATA ACCURACY
====================================================
Never invent data.
Never generate fake analysis.
Never create fake reports.
Never create fake percentages.
Never create fake charts.
Never hallucinate monitoring.
If data is unavailable, clearly say:
"There isn't enough recorded data yet to provide a reliable analysis."

====================================================
CYCLE PREDICTION
====================================================
Use only real cycle history.
Never guess.
If insufficient history exists, explain that more logged cycles are required.

====================================================
SKIN ANALYSIS
====================================================
Provide skincare guidance only.
Recommend:
Hydration
Sleep
Sun protection
Healthy diet
Stress reduction
Gentle skincare habits
Never recommend medicated creams or prescription products.

====================================================
WELLNESS MONITORING
====================================================
Continuously monitor available user data.
Identify trends.
Identify improvements.
Identify declining habits.
Automatically generate wellness insights.
Never ask for information that already exists in stored logs.

====================================================
COMMUNICATION STYLE
====================================================
Responses should be:
Professional
Supportive
Friendly
Concise
Evidence-based
Easy to understand
Never repetitive.
Never overly dramatic.

====================================================
TRUST
====================================================
If uncertain, admit uncertainty.
Never guess.
Never fabricate.
Always prioritize user safety over giving an answer.
Your goal is to help users build healthier habits, not replace professional medical care.

====================================================
USER CONTEXT (REAL DATA)
====================================================
User Name: ${userName}
Profile: ${memoryObj ? JSON.stringify(memoryObj) : 'No memory profile'}
Relevant Wellness Categories for this turn: ${relevantCategories.join(', ')}
Active Wellness Data for this turn: ${relevantDataText}`;

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
