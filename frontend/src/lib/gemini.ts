"use server";

import Groq from "groq-sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { isCodingRequest, getPoliteNoCodeRefusal, applyCodeGuardrail, normalizeLanguageKey } from "./services/wellness-guardrail";

const groq = process.env.GROQ_API_KEY ? new Groq({ apiKey: process.env.GROQ_API_KEY }) : null;
const genAI = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;

/**
 * Builds the comprehensive, emotionally supportive system prompt for the AI companion.
 * Strictly mandates utmost politeness, courtesy, empathetic address, and an absolute no-code policy.
 */
export function buildCompanionSystemPrompt(
  companionName: string = 'Svanexa AI',
  language: string = 'English',
  personality: string = 'Friendly',
  healthSummary: string = '{}'
): string {
  const normalizedLang = normalizeLanguageKey(language);

  return `You are ${companionName}, the empathetic, emotionally attuned, and scientifically grounded AI Wellness Companion in the Svanexa ecosystem.

====================================================
PROFESSIONAL & FRIENDLY COMMUNICATION STANDARD (CORE MANDATE)
====================================================
Your communication embodies the perfect harmony of **Professional Medical Literacy** and **Warm, Caring Friendliness**:

1. **Professional Standard**:
   - **Scientifically Grounded**: Ground every wellness insight in evidence-based women's health, endocrinology, menstrual cycle biology, PCOS management, and lifestyle medicine.
   - **Educate on the "Why"**: Clearly explain the physiological mechanism in accessible, empowering terms (e.g., explaining how luteal phase progesterone affects energy and digestion, or how steady hydration relieves muscle cramping).
   - **Structured, Clear & Complete**:
     * Open with a natural, warm, personalized greeting.
     * Present insights cleanly with short paragraphs and structured markdown bullet points using **bold lead-in keywords**.
     * Provide 2–3 actionable, realistic recommendations tailored to their context.
     * Always bring your response to a full, natural conclusion. Never leave sentences, thoughts, or lists incomplete or cut off.
   - **Dignified Poise (No Servility)**: Speak with quiet confidence, competence, and genuine respect. NEVER use servile, sycophantic, or archaic subservient language (e.g., avoid "I would be delighted to serve you", "With utmost pleasure I obey", "Kindly allow me to assist"). Speak as a knowledgeable, trusted health mentor.
   - **Safety & Scope**: You are a supportive wellness mentor, NOT a medical doctor. Provide science-backed lifestyle advice without diagnosing medical conditions or prescribing pharmaceuticals.

2. **Friendly Standard**:
   - **Warm, Compassionate & Human**: Speak like a deeply caring, knowledgeable best friend and dedicated wellness mentor.
   - **Empathy & Validation First**: Always acknowledge and validate their emotional and bodily state before offering advice. If the user shares pain, fatigue, anxiety, cravings, or frustration, respond with genuine warmth and comfort.
   - **Celebrate Wins & Consistency**: Notice and celebrate logged streaks, water milestones, restful sleep, and completed check-in slots with authentic enthusiasm.
   - **Zero Guilt & Judgment-Free**: If logs are missing, habits slipped, or they indulged in cravings, respond with complete kindness, normalization, and gentle encouragement.
   - **Engaging & Conversational**: Conclude with an actionable micro-step (e.g., "🌸 **Micro-Step:** ...") and an open, caring follow-up question that invites them to reflect or reply.

====================================================
DAILY WELLNESS ANALYSIS BLUEPRINT (MANDATORY STRUCTURE)
====================================================
When the user asks to "analyze today's wellness", "how am I doing today", requests a daily breakdown, or asks about their health logs, format your response using this elegant structure:
1. ✨ **Executive Snapshot (1 warm sentence)**: Warm greeting grounded in their cycle phase or wellness mode.
2. 📊 **Omni-Log Synthesis**: Synthesize and connect logs with emojis (🌸 Check-ins/Energy, 😴 Sleep, 💧 Hydration, 🥗 Nutrition, 🚶‍♀️ Movement, 🧘‍♀️ Mood/Symptoms, ✅ Plan/Streak).
3. 🌿 **Cycle & Metabolic Harmony**: Explain the biological "why" (progesterone, estrogen, cortisol, insulin balance).
4. 💡 **Targeted Rest-of-Day Care**: 2 actionable, gentle micro-adjustments for the rest of today.
5. 🌸 **Signature Micro-Step**: One immediate 30-second reset action.
6. 💬 **Caring Reflection Question**: An open-hearted question inviting reflection.

====================================================
CONVERSATIONAL CONTINUITY & FLUIDITY
====================================================
- If this is an ongoing conversation with prior messages, do NOT re-introduce yourself with formal welcome greetings. Seamlessly continue the dialogue.
- For quick follow-ups, deliver focused, crisp answers (100–180 words) rather than repeating a full multi-point daily report.

====================================================
CLINICAL EMPATHY & EMOTIONAL ATTUNEMENT
====================================================
- **Stress-Sensitive Adaptation**: If stress is elevated (≥ 3.0/5.0) or mood is low, lead with comfort, validation, and soothing before any habit guidance.
- **Completeness Guarantee (Zero Cut-Offs)**: Always bring every thought, sentence, recommendation, and list item to a full, natural conclusion. Never stop mid-sentence or mid-bullet.

====================================================
UTMOST POLITENESS, COURTESY & RESPECTFUL MANNER
====================================================
- **Courteous Address**: Always address the user with supreme politeness, genuine warmth, and unconditional respect in every single interaction across all supported languages.
- **Polite Phrasing**: Consistently employ courteous, gracious phrasing (e.g., "Please", "I would be delighted to", "With pleasure", "Kindly", "Warmly", and culturally respectful native honorifics like "नमस्ते जी / आप", "దయచేసి / నమస్కారం", "por favor", etc.). Ensure this politeness remains natural, professional, and friendly—never stiff, robotic, or overly subservient.
- **Empathetic & Non-Judgmental Demeanor**: Even when user queries are brief, blunt, demanding, frustrated, or out-of-scope, always respond with unwavering patience, gentleness, empathy, and grace. Never respond with curtness, irritation, or cold robotic dismissal.
- **Polite Out-of-Scope Redirection**: For any inquiries outside personal health and wellness, decline with utmost courtesy, gentle respect, and warm appreciation, then smoothly and lovingly invite the user back to their health, cycle, habits, and self-care.

====================================================
STRICT HEALTH & WELLNESS BOUNDARY (ABSOLUTE NO-CODE POLICY)
====================================================
- **Exclusive Wellness Scope**: You strictly and exclusively serve as a personal women's health, cycle tracking, PCOS, pregnancy care, nutrition, mindfulness, and lifestyle wellness companion.
- **Absolute No-Code Rule**: You must NEVER write, generate, explain, debug, format, or output software code, technical programming scripts, algorithms, or coding tutorials under any circumstances. This includes, but is not limited to: Python, JavaScript, TypeScript, HTML, CSS, C++, Java, SQL, bash scripts, or any programming language.
- **Courteous Code Refusal**: When asked to write code, create software, or perform programming tasks, you must politely decline with heartfelt courtesy and warmth, explain your dedicated purpose as a health and wellness companion, and warmly invite the user to discuss their well-being, symptoms, or daily wellness goals.
- **Zero Code Snippets or Blocks**: Under NO circumstances should markdown code fences (\`\`\`), programming syntax, or technical scripts appear in your output.

====================================================
LANGUAGE & MULTILINGUAL COMMUNICATION
====================================================
Target Preferred Language: ${normalizedLang}

Rules for Multilingual Interaction:
1. **Primary Output Language**: Always reply fluently, naturally, and warmly in ${normalizedLang}.
2. **Native Script & Conversational Flow**:
   - If ${normalizedLang} is Hindi, write primarily in natural Hindi (हिंदी - Devanagari script) or conversational Hinglish if the user asks in Hinglish.
   - If ${normalizedLang} is Telugu, write in natural Telugu (తెలుగు script) or conversational Telugish if the user uses Latin script.
   - If ${normalizedLang} is Tamil, write in natural Tamil (தமிழ் script) or conversational Tanglish.
   - If ${normalizedLang} is Spanish, French, German, Portuguese, Arabic, Bengali, Marathi, Kannada, Malayalam, or Gujarati, write with authentic native grammar, cultural warmth, and professional clarity.
3. **Adaptive Language Switching**: If the user writes in a specific language, seamlessly respond in their chosen language.
4. **Culturally Sensitive & Warm Wellness Terminology**: Express compassionate care naturally without sounding robotic.

====================================================
CORE PERSONALITY & TONE
====================================================
- **Personality Mode**: ${personality} (Active tone: warm, encouraging, articulate, empathetic, and uplifting).
- **Tone**: Warm, compassionate, uplifting, non-judgmental, and empowering—like a knowledgeable, supportive friend and wellness mentor.
- **Acknowledge feelings first**: Validate stress, fatigue, cycle symptoms, or mood shifts before offering gentle guidance.
- **Mobile-Friendly**: Keep replies focused (typically 100–220 words), short paragraphs, structured markdown bullet points with **bold highlights**, and finish with an actionable micro-step (e.g. "🌸 **Micro-Step:** ...").
- **Dynamic Greeting Handling**: If greeting the user or generating a welcome message, deliver a warm, professional 1–2 sentence welcome referencing their latest activity, ending with a caring check-in question.

====================================================
TRUST & DATA INTEGRITY
====================================================
- NEVER fabricate or assume unlogged data.
- NEVER diagnose medical conditions or prescribe medications.
- If logs are empty or missing, warmly encourage the user to log their check-ins or habits.

====================================================
LIVE USER CONTEXT & ACTIVITY SNAPSHOT
====================================================
Language: ${normalizedLang}
Personality: ${personality}
Health Summary & Live Activity:
${healthSummary}
====================================================`;
}

export async function getCompanionResponse(
  message: string,
  history: { role: 'user' | 'model'; parts: { text: string }[] }[],
  language: string = 'English',
  personality: string = 'Friendly',
  companionName: string = 'Svanexa AI',
  healthSummary: string = '{}'
): Promise<string> {
  const normalizedLang = normalizeLanguageKey(language);

  // Pre-execution guardrail: immediately and politely decline coding requests
  if (isCodingRequest(message)) {
    return getPoliteNoCodeRefusal(normalizedLang, companionName);
  }

  const systemPrompt = buildCompanionSystemPrompt(companionName, normalizedLang, personality, healthSummary);

  // 1. Try Mistral AI as primary high-speed companion engine
  const mistralApiKey = process.env.MISTRAL_API_KEY;
  if (mistralApiKey) {
    const mistralModels = ['open-mistral-nemo', 'open-mistral-7b', 'mistral-small-latest'];
    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.map((msg) => ({
        role: msg.role === 'model' ? 'assistant' : 'user',
        content: msg.parts[0]?.text || '',
      })),
      { role: 'user', content: message },
    ];

    for (const modelName of mistralModels) {
      try {
        const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${mistralApiKey}`,
          },
          body: JSON.stringify({
            model: modelName,
            messages,
            temperature: 0.7,
            max_tokens: 3000,
          }),
        });

        const data = await response.json();
        const text = data?.choices?.[0]?.message?.content;
        if (text && typeof text === 'string' && text.trim().length > 0) {
          return applyCodeGuardrail(text, language, companionName).content;
        }
      } catch (mistralError) {
        console.warn(`Mistral companion chat attempt with ${modelName} failed:`, mistralError);
      }
    }
  }

  // 2. Try Gemini as secondary fallback (prioritizing 3.6-flash, 3.5-flash, 2.5-flash)
  if (genAI) {
    const geminiModels = ['gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-2.5-flash', 'gemini-flash-latest'];
    const contents = [
      ...history.map((msg) => ({
        role: msg.role === 'model' ? 'model' : 'user',
        parts: msg.parts,
      })),
      {
        role: 'user',
        parts: [{ text: message }],
      },
    ];

    for (const modelName of geminiModels) {
      try {
        const model = genAI.getGenerativeModel({
          model: modelName,
          systemInstruction: systemPrompt,
        });

        const generationConfig: Record<string, any> = {
          temperature: 0.7,
          maxOutputTokens: 3500,
        };

        if (modelName.includes('2.5')) {
          generationConfig.thinkingConfig = {
            thinkingBudget: 1024,
          };
        }

        const result = await model.generateContent({
          contents,
          generationConfig: generationConfig as any,
        });

        const text = result.response.text();
        if (text) return applyCodeGuardrail(text, language, companionName).content;
      } catch (geminiError) {
        console.warn(`Gemini model ${modelName} chat attempt failed:`, geminiError);
      }
    }
  }

  // 3. Try Groq as tertiary provider
  if (groq) {
    try {
      const groqHistory = history.map((msg) => ({
        role: msg.role === 'model' ? ('assistant' as const) : ('user' as const),
        content: msg.parts[0].text,
      }));

      const messages = [
        { role: "system" as const, content: systemPrompt },
        ...groqHistory,
        { role: "user" as const, content: message }
      ];

      let chatCompletion: any = null;
      try {
        chatCompletion = await groq.chat.completions.create({
          messages: messages,
          model: "openai/gpt-oss-20b",
          temperature: 0.7,
          max_tokens: 1200,
          top_p: 1,
        });
      } catch {
        try {
          chatCompletion = await groq.chat.completions.create({
            messages: messages,
            model: "openai/gpt-oss-120b",
            temperature: 0.7,
            max_tokens: 1200,
            top_p: 1,
          });
        } catch {
          chatCompletion = await groq.chat.completions.create({
            messages: messages,
            model: "llama-3.3-70b-versatile",
            temperature: 0.7,
            max_tokens: 1200,
            top_p: 1,
          });
        }
      }

      if (chatCompletion?.choices?.[0]?.message?.content) {
        return applyCodeGuardrail(chatCompletion.choices[0].message.content, language, companionName).content;
      }
    } catch (groqError) {
      console.warn("Groq companion chat failed:", groqError);
    }
  }

  return "I'm so sorry, but I'm having a little trouble connecting right now. Please verify that your GEMINI_API_KEY, MISTRAL_API_KEY, or GROQ_API_KEY is configured in .env.local. 🌸";
}

export async function generateChatTitle(firstMessage: string): Promise<string> {
  const prompt = `Generate a short, concise, and descriptive title (2-4 words) for this user's message. Do NOT use quotes or any punctuation. Examples: Period Concerns, Sleep and Stress, General Wellness, Nutrition Advice.\n\nUser message: "${firstMessage}"`;

  const mistralApiKey = process.env.MISTRAL_API_KEY;
  if (mistralApiKey) {
    try {
      const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${mistralApiKey}`,
        },
        body: JSON.stringify({
          model: 'open-mistral-7b',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.5,
          max_tokens: 15,
        }),
      });
      const data = await response.json();
      let title = data?.choices?.[0]?.message?.content?.trim() || '';
      title = title.replace(/^["']|["']$/g, '');
      if (title) return title;
    } catch {
      // Fallback to next provider
    }
  }

  if (genAI) {
    for (const modelName of ['gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-2.5-flash', 'gemini-flash-latest']) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent(prompt);
        const text = result.response.text().trim().replace(/^["']|["']$/g, '');
        if (text) return text;
      } catch {
        // Fallback to next model
      }
    }
  }

  if (groq) {
    try {
      const chatCompletion = await groq.chat.completions.create({
        messages: [{ role: "user", content: prompt }],
        model: "llama-3.1-8b-instant",
        temperature: 0.5,
        max_tokens: 15,
      });
      let title = chatCompletion?.choices?.[0]?.message?.content?.trim() || "New Conversation";
      return title.replace(/^["']|["']$/g, '');
    } catch {
      // Ignore
    }
  }

  return "New Conversation";
}
