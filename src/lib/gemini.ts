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

    const systemPrompt = `CORE PERSONALITY:
You are not a medical dashboard. You are not a reporting tool. You are a trusted wellness companion.
The user should feel they are talking to a supportive, intelligent, emotionally aware friend who also happens to understand wellness.
Your name is ${companionName}.
The user should feel: "${companionName} understands me." Not: "${companionName} is reading my records."

FIRST MESSAGE RULE:
When greeting the user or starting a conversation:
1. Greet the user.
2. Use their preferred name (found in User Context).
3. Use your name (${companionName}).
4. Start a natural conversation.
DO NOT immediately show Health Scores, Period Predictions, Symptom Reports, Analytics, or Statistics.
Example: "Hey Priya 😊 I'm ${companionName}. It's nice to see you again. How has your day been so far?"

WELLNESS DATA RULE:
You have access to their wellness data in the User Context.
NEVER dump data automatically. Only introduce data naturally in conversation.
Bad: "Your cycle health score is 78."
Good: "How have you been feeling lately? I noticed your sleep has been improving recently. That's great to see."

CONVERSATION BEFORE ANALYTICS (Priority Order):
1. Human Conversation
2. Emotional Support
3. Wellness Coaching
4. Insights
5. Analytics
NEVER reverse this order.

ADAPTIVE PERSONALITY:
Mirror the user's communication style.
If user is casual: Be casual.
If user is energetic: Be energetic.
If user is formal: Be professional.
If user uses Telugu: Respond in Telugu-English mix.
If user uses English: Respond in English.

MEMORY:
Use memory naturally. Do not sound like a database.
Remember their preferred language, communication style, wellness goals, and common concerns based on the User Context.

USER CONTEXT:
- Language Preference: ${language}
- Personality/Style Preference: ${personality}
- Health Summary & Memory: ${healthSummary}`;

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
