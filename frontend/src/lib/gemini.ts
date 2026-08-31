"use server";

import Groq from "groq-sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";

const groq = process.env.GROQ_API_KEY ? new Groq({ apiKey: process.env.GROQ_API_KEY }) : null;
const genAI = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;

export async function getCompanionResponse(
  message: string,
  history: { role: 'user' | 'model'; parts: { text: string }[] }[],
  language: string = 'English',
  personality: string = 'Friendly',
  companionName: string = 'Svanexa AI',
  healthSummary: string = '{}'
): Promise<string> {
  const systemPrompt = `You are ${companionName}, the empathetic, emotionally attuned, and scientifically grounded AI Wellness Companion in the Svanexa ecosystem.

====================================================
LANGUAGE & MULTILINGUAL COMMUNICATION
====================================================
Target Preferred Language: ${language}

Rules for Multilingual Interaction:
1. **Primary Output Language**: Always reply fluently, naturally, and warmly in ${language}.
2. **Native Script & Conversational Flow**:
   - If ${language} is Hindi, write primarily in natural Hindi (हिंदी - Devanagari script) or conversational Hinglish if the user asks in Hinglish.
   - If ${language} is Telugu, write in natural Telugu (తెలుగు script) or conversational Telugish if the user uses Latin script.
   - If ${language} is Tamil, write in natural Tamil (தமிழ் script) or conversational Tanglish.
   - If ${language} is Spanish, French, German, Portuguese, Arabic, Bengali, Marathi, Kannada, Malayalam, or Gujarati, write with authentic native grammar and warmth.
3. **Adaptive Language Switching**: If the user writes in a specific language, seamlessly respond in their chosen language.
4. **Culturally Sensitive & Warm Wellness Terminology**: Express compassionate care naturally without sounding robotic.

====================================================
CORE PERSONALITY & TONE
====================================================
- Warm, non-judgmental, empowering, and protective—like a knowledgeable, supportive friend and wellness mentor.
- Acknowledge feelings first: validate stress, fatigue, cycle symptoms, or mood shifts before offering gentle guidance.
- Mobile-Friendly: Keep replies crisp (60–180 words), short paragraphs, structured markdown bullet points with **bold highlights**, and finish with an actionable micro-step (e.g. "🌸 **Micro-Step:** ...").

====================================================
TRUST & DATA INTEGRITY
====================================================
- NEVER fabricate or assume unlogged data.
- NEVER diagnose medical conditions or prescribe medications.
- If logs are empty or missing, warmly encourage the user to log their check-ins or habits.

====================================================
LIVE USER CONTEXT & ACTIVITY SNAPSHOT
====================================================
Language: ${language}
Personality: ${personality}
Health Summary & Live Activity:
${healthSummary}
====================================================`;

  // 1. Try Gemini first (Gemini 2.5 Flash)
  if (genAI) {
    try {
      let model = genAI.getGenerativeModel({
        model: "gemini-2.5-flash",
        systemInstruction: systemPrompt,
      });

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

      const result = await model.generateContent({
        contents,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1024,
        },
      });

      const text = result.response.text();
      if (text) return text;
    } catch (geminiError) {
      console.warn("Gemini 2.5 flash chat attempt failed, trying fallback:", geminiError);
      try {
        const fallbackModel = genAI.getGenerativeModel({
          model: "gemini-3.6-flash",
          systemInstruction: systemPrompt,
        });
        const result = await fallbackModel.generateContent({
          contents: [
            ...history.map((msg) => ({
              role: msg.role === 'model' ? 'model' : 'user',
              parts: msg.parts,
            })),
            { role: 'user', parts: [{ text: message }] },
          ],
          generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
        });
        const text = result.response.text();
        if (text) return text;
      } catch (geminiError2) {
        console.warn("Gemini 3.6 flash fallback failed:", geminiError2);
      }
    }
  }

  // 2. Try Groq as secondary provider
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
          max_tokens: 1024,
          top_p: 1,
        });
      } catch {
        try {
          chatCompletion = await groq.chat.completions.create({
            messages: messages,
            model: "openai/gpt-oss-120b",
            temperature: 0.7,
            max_tokens: 1024,
            top_p: 1,
          });
        } catch {
          chatCompletion = await groq.chat.completions.create({
            messages: messages,
            model: "llama-3.3-70b-versatile",
            temperature: 0.7,
            max_tokens: 1024,
            top_p: 1,
          });
        }
      }

      if (chatCompletion?.choices?.[0]?.message?.content) {
        return chatCompletion.choices[0].message.content;
      }
    } catch (groqError) {
      console.warn("Groq companion chat failed:", groqError);
    }
  }

  return "I'm so sorry, but I'm having a little trouble connecting right now. Please verify that your GEMINI_API_KEY or GROQ_API_KEY is configured in .env.local. 🌸";
}

export async function generateChatTitle(firstMessage: string): Promise<string> {
  const prompt = `Generate a short, concise, and descriptive title (2-4 words) for this user's message. Do NOT use quotes or any punctuation. Examples: Period Concerns, Sleep and Stress, General Wellness, Nutrition Advice.\n\nUser message: "${firstMessage}"`;

  if (genAI) {
    try {
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
      const result = await model.generateContent(prompt);
      const text = result.response.text().trim().replace(/^["']|["']$/g, '');
      if (text) return text;
    } catch {
      // Fallback
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
