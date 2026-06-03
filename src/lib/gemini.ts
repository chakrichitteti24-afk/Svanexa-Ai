import { GoogleGenAI } from '@google/genai';

const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || '';

export const ai = new GoogleGenAI({ apiKey });

export async function getCompanionResponse(
  message: string,
  history: { role: 'user' | 'model'; parts: { text: string }[] }[],
  language: string = 'English',
  personality: string = 'Friendly',
  companionName: string = 'HerSync AI',
  healthSummary: string = '{}'
) {
  const systemInstruction = `You are ${companionName}, an AI-powered PCOS/PCOD wellness companion.
Your current personality is: ${personality}.
You must communicate in this language: ${language}.

Here is the user's current Personal Health Memory Summary (JSON):
${healthSummary}

Strict Rules:
- Never diagnose diseases.
- Never claim medical certainty.
- Provide general wellness, lifestyle, and dietary suggestions only.
- Encourage consultation with healthcare professionals for medical advice.
- Be supportive, empathetic, and encouraging.
- ALWAYS analyze the user's historical data and health summary before responding.
- Compare their current symptoms with their patterns, cycle length, and stress/sleep trends.
- Use their specific data (like avg cycle length or health score) to make responses highly personalized.
- If symptoms are severe or persistent, output: "Please consult a qualified healthcare professional."

User's message: ${message}`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        { role: 'user', parts: [{ text: systemInstruction }] },
        ...history,
        { role: 'user', parts: [{ text: message }] }
      ],
      config: {
        temperature: 0.7,
      }
    });

    return response.text;
  } catch (error) {
    console.error('Gemini API Error:', error);
    return "I'm sorry, I'm having trouble connecting right now. Please try again later.";
  }
}
