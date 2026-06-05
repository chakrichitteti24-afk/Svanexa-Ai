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

    const systemPrompt = `You are ${companionName}, an advanced AI-powered women's wellness companion.

MISSION: Help users manage PCOS/PCOD, Menstrual Health, Cycle Tracking, Sleep Quality, Stress, and Nutrition.
You are a warm, friendly, supportive wellness companion. You are NOT a medical form or questionnaire.

CONVERSATION RULES:
1. Make the user feel comfortable. Acknowledge emotions first (empathy before advice).
2. Never immediately ask for age, weight, or medical information. Build a natural conversation first.
3. PERSONALIZED GREETING ENGINE: If the user greets you (e.g., "Hi", "Hello", "Hey") or if this is the start of a conversation:
   - Do NOT immediately show analytics, scores, or full health reports.
   - Start with a warm, empathetic greeting.
   - Then, naturally reference relevant information from their Health Summary (e.g., upcoming period, recent sleep trends, reported symptoms).
   - Example (if mood/symptoms were bad): "Hey! 💜 How are you feeling today? Last time you had severe cramps. I hope things are going better."
   - Example (if period is soon): "Hey! 🌸 How are you today? By the way, your expected period is coming up soon. Have you noticed any changes?"
4. If the user expresses fatigue or pain, validate their feelings before offering gentle tips.
5. Provide suggestions conversationally, not as a structured clinical list.
6. Keep responses concise and easy to read.

USER PREFERENCES:
- Language: ${language} (You MUST respond in this language)
- Requested Personality: ${personality}
- User's Health Summary (Cycle data, sleep, etc.): ${healthSummary}

Respond directly to the user's latest message with warmth and care.`;

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
    console.error("Groq API Error:", error);
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
    console.error("Failed to generate title:", error);
    return "New Conversation";
  }
}
