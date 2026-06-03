export async function getCompanionResponse(
  message: string,
  history: { role: 'user' | 'model'; parts: { text: string }[] }[],
  language: string = 'English',
  personality: string = 'Friendly',
  companionName: string = 'HerSync AI',
  healthSummary: string = '{}'
) {
  const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || '';
  if (!apiKey) {
    return "API Key is missing. Please set NEXT_PUBLIC_GEMINI_API_KEY in your environment.";
  }

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
    const contents = [
      { role: 'user', parts: [{ text: systemInstruction }] },
      ...history.map(h => ({
        role: h.role === 'model' ? 'model' : 'user',
        parts: h.parts
      })),
      { role: 'user', parts: [{ text: message }] }
    ];

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents,
          generationConfig: {
            temperature: 0.7,
          }
        }),
      }
    );

    if (!response.ok) {
      const errData = await response.json();
      console.error('Gemini API Error details:', errData);
      throw new Error(`Gemini API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "I'm sorry, I couldn't generate a response.";
  } catch (error) {
    console.error('Gemini API Fetch Error:', error);
    return "I'm sorry, I'm having trouble connecting right now. Please try again later.";
  }
}
