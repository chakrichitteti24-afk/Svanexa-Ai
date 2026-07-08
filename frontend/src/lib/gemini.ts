"use server";

import Groq from "groq-sdk";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

export async function getCompanionResponse(
  message: string,
  history: { role: 'user' | 'model'; parts: { text: string }[] }[],
  language: string = 'English',
  personality: string = 'Friendly',
  companionName: string = 'HerSync AI',
  healthSummary: string = '{}'
): Promise<string> {
  try {
    // Convert history format to Groq's expected format
    const groqHistory = history.map((msg) => ({
      role: msg.role === 'model' ? ('assistant' as const) : ('user' as const),
      content: msg.parts[0].text,
    }));

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

    const messages = [
      { role: "system" as const, content: systemPrompt },
      ...groqHistory,
      { role: "user" as const, content: message }
    ];

    const chatCompletion = await groq.chat.completions.create({
      messages: messages,
      model: "llama-3.1-8b-instant",
      temperature: 0.7,
      max_tokens: 1024,
      top_p: 1,
    });

    return chatCompletion.choices[0]?.message?.content || "I'm having trouble thinking right now. Could you please try again? 🌸";
  } catch (error) {
    if (error instanceof Error && error.message.includes("does not exist")) {
        return `Oops! The model "llama-3.1-8b-instant" wasn't found on the Groq API. Please check your model name! 🌸`;
    }
    return `I'm so sorry, but I'm having a little trouble connecting to my brain right now! Please make sure your GROQ_API_KEY is set in the .env.local file. 🌸`;
  }
}

export async function generateChatTitle(firstMessage: string): Promise<string> {
  try {
    const chatCompletion = await groq.chat.completions.create({
      messages: [
        { role: "system", content: "You are a helpful assistant. Generate a short, concise, and descriptive title (2-4 words) for the user's message. Do NOT use quotes or any punctuation. Examples: Period Concerns, Sleep and Stress, General Wellness, Nutrition Advice." },
        { role: "user", content: firstMessage }
      ],
      model: "llama-3.1-8b-instant",
      temperature: 0.5,
      max_tokens: 15,
      top_p: 1,
    });
    
    let title = chatCompletion.choices[0]?.message?.content?.trim() || "New Conversation";
    // Remove quotes if the LLM adds them
    title = title.replace(/^["']|["']$/g, '');
    return title;
  } catch (error) {
    return "New Conversation";
  }
}
