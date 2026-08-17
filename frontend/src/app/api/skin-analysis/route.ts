import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/utils/supabase/server';
import Groq from 'groq-sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { processSkinLogsData } from '@/lib/utils/skin-helpers';

// Helper to convert base64 image data to a generative part object for Gemini
function fileToGenerativePart(base64Str: string) {
  try {
    const matches = base64Str.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.*)$/);
    if (!matches || matches.length < 3) return null;
    return {
      inlineData: {
        data: matches[2],
        mimeType: matches[1]
      },
    };
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  try {
    const { supabase, user, error: authError } = await getAuthenticatedUser(req);

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }


    const userId = user.id;

    // Parse optional request payload for real-time analysis
    const payload = await req.json().catch(() => ({}));
    const { acne, oiliness, dryness, notes, photoBase64 } = payload;

    // Fetch user's profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    let avgAcne = '0.0';
    let avgOil = '0.0';
    let avgDry = '0.0';
    let notesSummary: string[] = [];
    let latestPhotoBase64 = '';

    if (acne !== undefined || oiliness !== undefined || dryness !== undefined || photoBase64) {
      // Real-time analysis of the current input state (no database query required!)
      avgAcne = String(acne ?? 5);
      avgOil = String(oiliness ?? 5);
      avgDry = String(dryness ?? 2);
      if (notes) notesSummary.push(notes);
      if (photoBase64) latestPhotoBase64 = photoBase64;
    } else {
      // Fetch user's recent skin logs from database
      const { data: skinLogs } = await supabase
        .from('skin_logs')
        .select('*')
        .eq('user_id', userId)
        .order('log_date', { ascending: false })
        .limit(7);

      if (!skinLogs || skinLogs.length === 0) {
        return NextResponse.json({ 
          success: false, 
          message: "No skin logs recorded yet. Please save at least one entry in the Skin Tracker or upload a photo to generate your AI analysis." 
        });
      }

      // Process skin logs to calculate averages and collect notes
      const processed = processSkinLogsData(skinLogs);
      avgAcne = processed.avgAcne;
      avgOil = processed.avgOil;
      avgDry = processed.avgDry;
      notesSummary = processed.notesSummary;
      latestPhotoBase64 = processed.latestPhotoBase64;
    }

    const wellnessMode = profile?.wellness_mode || 'General Wellness';

    // Build the AI instruction prompt for real-time diagnostic analysis
    const systemPrompt = `You are Luna, the Premium AI Skin & Wellness Expert inside Svanexa AI.
Analyze the user's current skin state (Acne Severity: ${avgAcne}/10, Oiliness: ${avgOil}/10, Dryness: ${avgDry}/10) and notes: "${notesSummary.join(', ')}".

CRITICAL ACCURACY & BLUR EVALUATION RULES:
1. **Photo Quality Check:** If the user has uploaded an image, you MUST first evaluate its clarity, focus, and quality. If the image is blurry, low-resolution, out-of-focus, dark, or not showing skin clearly, the Image Quality Check section in the template MUST say: "⚠️ **Visual Alert:** Image is blurry, out-of-focus, or dark. Please provide a clear closeup."
2. **Zero Fake Analysis:** Do NOT guess or hallucinate any visual features (e.g. do not say "I see active whiteheads or redness" if the photo is blurry or if no photo was uploaded). If the photo quality is poor or absent, explicitly state that you are basing your analysis strictly on the numeric sliders.
3. **Accuracy & Precision:** Focus on delivering highly accurate, scientifically grounded recommendations.

You MUST format your entire response using the following markdown template exactly. Do not alter the headings or structural lines. Fill in the content in the brackets:

# 🩺 Svanexa AI Skin Diagnostics Report

---

## 🌟 Present Skin State
- **Acne Severity:** [AI evaluation of Acne level ${avgAcne}/10]
- **Oiliness / Dryness balance:** [AI evaluation of sebum/moisture levels: Oil ${avgOil}/10, Dry ${avgDry}/10]
- **Image Quality Check:** [Verify photo quality here, e.g. "Clear closeup verified" or the blur warning text]
- **Diagnostic Insights:** [Detailed insights about the skin barrier based on user indicators and notes]

---

## 🛡️ Skincare Action Plan (How to Overcome)
### 🌅 Morning Routine adjustments
- [Step 1]
- [Step 2]
### 🌃 Night Routine adjustments
- [Step 1]
- [Step 2]
### 🧪 Recommended Active Ingredients
- [Active Ingredient 1] (Purpose)
- [Active Ingredient 2] (Purpose)

---

## 🥗 Nutritional & Dietary Therapy
### 🍏 Foods to Incorporate
- [Food/Ingredient 1] (Why it helps regulate sebum and balance hormones for ${wellnessMode})
- [Food/Ingredient 2] (Why it helps)
### 🚫 Foods to Limit or Avoid
- [Trigger Food 1] (Why it worsens acne/oil)
- [Trigger Food 2] (Why it worsens acne/oil)

---

*Disclaimer: This report is an AI-powered wellness guide. It does not constitute medical advice. Please consult a dermatologist for clinical concerns.*`;

    // ── DUAL PROVIDER EXECUTION (GEMINI (multimodal/text) <-> GROQ FALLBACK) ───────────────────
    let responseText = '';
    let modelUsed = 'gemini-2.5-flash';

    // 1. Try Gemini (handles both multimodal photo and text)
    if (process.env.GEMINI_API_KEY) {
      try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        let model: any;
        try {
          model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        } catch {
          model = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' });
        }

        const promptParts: any[] = [systemPrompt];
        if (latestPhotoBase64) {
          const imagePart = fileToGenerativePart(latestPhotoBase64);
          if (imagePart) {
            promptParts.push(imagePart);
          }
        }

        const result = await model.generateContent(promptParts);
        responseText = result.response.text();
        modelUsed = 'gemini-2.5-flash';
      } catch (geminiError) {
        console.error('Gemini skin analysis failed, trying alternate Gemini model or Groq:', geminiError);
        try {
          const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
          const model = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' });
          const result = await model.generateContent([systemPrompt]);
          responseText = result.response.text();
          modelUsed = 'gemini-3.6-flash';
        } catch (geminiError2) {
          console.error('Gemini 3.6 flash fallback failed:', geminiError2);
        }
      }
    }

    // 2. Try Groq (if Gemini failed or was unavailable)
    if (!responseText && process.env.GROQ_API_KEY) {
      try {
        const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
        let chatCompletion: any = null;
        try {
          chatCompletion = await groq.chat.completions.create({
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: 'Compile my skin logs analysis report please.' }
            ],
            model: 'openai/gpt-oss-120b',
            temperature: 0.7,
            max_tokens: 800,
          });
        } catch {
          chatCompletion = await groq.chat.completions.create({
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: 'Compile my skin logs analysis report please.' }
            ],
            model: 'qwen/qwen3.6-27b',
            temperature: 0.7,
            max_tokens: 800,
          });
        }

        responseText = chatCompletion?.choices?.[0]?.message?.content || '';
        modelUsed = 'groq' as any;
      } catch (groqError) {
        console.error('Groq skin analysis fallback failed:', groqError);
      }
    }

    if (!responseText) {
      return NextResponse.json({ 
        success: false, 
        error: "AI Services are temporarily unavailable. Please verify that GEMINI_API_KEY or GROQ_API_KEY is configured in your .env.local file." 
      });
    }

    return NextResponse.json({
      success: true,
      analysis: responseText,
      modelUsed,
      hasPhoto: !!latestPhotoBase64
    });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
