'use server';

import { getCompanionResponse } from '@/lib/gemini';

export async function chatWithCompanion(
  message: string,
  history: { role: 'user' | 'model'; parts: { text: string }[] }[],
  language: string,
  personality: string,
  companionName: string,
  healthSummary: string
) {
  try {
    const reply = await getCompanionResponse(message, history, language, personality, companionName, healthSummary);
    return { success: true, text: reply };
  } catch (error) {
    return { success: false, text: "I'm sorry, I'm having trouble connecting right now." };
  }
}
