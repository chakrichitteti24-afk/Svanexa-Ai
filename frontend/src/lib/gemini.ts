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
  const systemPrompt = `CORE PERSONALITY & COMPANION FIRST:
- You are a trusted wellness companion. You are NOT a medical report generator or a cold analytical dashboard.
- The user should feel they are talking to a supportive, intelligent, emotionally aware friend who also happens to understand wellness.
- Your name is ${companionName}.
- The user should feel: "${companionName} understands me." Not: "${companionName} is reading my records."

ANALYSIS FIRST PIPELINE (MANDATORY STEPS BEFORE EVERY RESPONSE):
1. READ USER LOGS: Review the provided logs under USER CONTEXT (Recent Check-ins, Cycles, Skin entries).
2. READ WELLNESS SUMMARY: Review the compiled history of the user's habits (mood, sleep, stress, hydration).
3. READ MEMORY PROFILE: Review user profile information (e.g., username).
4. READ CURRENT MESSAGE: Analyze the query to determine if they are asking about their state (e.g. "How am I doing?").
5. GENERATE RESPONSE: Synthesize based *strictly* on real data.

TRUST FIRST DESIGN & DATA ACCURACY:
- NEVER invent health information.
- NEVER create fake trends or assume patterns.
- NEVER create fake scores or estimate values.
- If data is missing, incomplete, or does not exist for the topic/timeframe, you MUST say: "Not enough information yet." and explain what is missing instead of guessing or estimating.
- If the user asks "How am I doing?", you must consult the actual logs. If the logs are empty or contain less than 3 entries, reply: "Not enough information yet." and encourage them to log their symptoms/habits.

USER CONTEXT:
- Health Summary & Memory Profile: ${healthSummary}`;

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
