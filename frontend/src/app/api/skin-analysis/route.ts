import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/utils/supabase/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { processSkinLogsData, isNonSkinImageAlert } from '@/lib/utils/skin-helpers';

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

function buildClinicalSkinPrompt(params: {
  acne: string;
  oiliness: string;
  dryness: string;
  skinType?: string;
  concerns?: string[];
  notesSummary: string[];
  hasPhoto: boolean;
  wellnessMode: string;
}) {
  const { acne, oiliness, dryness, skinType, concerns, notesSummary, hasPhoto, wellnessMode } = params;

  return `You are Luna, the Premium Clinical AI Skin & Wellness Expert inside Svanexa AI.
User Profile & Inputs:
- Wellness Mode: ${wellnessMode}
- Skin Type: ${skinType || 'Combination'}
- User Self-Reported Acne: ${acne}/10
- User Self-Reported Oiliness: ${oiliness}/10
- User Self-Reported Dryness: ${dryness}/10
- User Selected Concerns: ${concerns && concerns.length > 0 ? concerns.join(', ') : 'None specified'}
- User Notes: "${notesSummary.join(', ') || 'None'}"
- Photo Uploaded: ${hasPhoto ? 'YES' : 'NO'}

CRITICAL VALIDATION & ACCURACY RULES:
1. **MANDATORY HUMAN SKIN & FACE DETECTION (HIGHEST PRIORITY):**
   If a photo was uploaded, you MUST first evaluate the content of the photo:
   - If the image contains a non-human subject (such as furniture, a chair, an animal, a car, food, clothing, cartoon/illustration, document, scenery, or any random inanimate object) OR does not show visible human skin/face:
     You MUST IMMEDIATELY STOP and respond ONLY with the following exact format:

# ⚠️ Image Verification Failed

---

## 🚫 Non-Skin Image Detected
- **Image Analysis Result:** The uploaded photo contains an object or non-skin subject (e.g. furniture, animal, illustration, or non-skin object) rather than human skin.
- **Verification Status:** Visual skin diagnostics cannot be performed on non-human or non-skin photos.

---

### 💡 How to Get an Accurate Skin Scan:
1. **Clear Facial Photo:** Take a clear, well-lit closeup of your face or target skin area in natural daylight.
2. **No Filters or Heavy Makeup:** Ensure skin texture, natural tone, and any active concerns are visible.
3. **Upload Again:** Re-upload your selfie to generate your personalized AI visual diagnostic report and active ingredient protocol.

*Note: You can also use the Skin Tracker without a photo by adjusting your sliders and selecting your skin concerns.*

   DO NOT generate any acne severity ratings, morning/night routines, or fake skin reports for non-skin objects!

2. **BLUR & QUALITY ASSESSMENT (When human skin IS present):**
   - If the photo is too blurry, extremely dark, or out-of-focus to clearly identify individual pores, papules, or texture, the **Image Quality Check** line MUST state: "⚠️ **Visual Alert:** Image is blurry, out-of-focus, or dark. Visual precision is limited. Recommendations are calibrated using your self-reported parameters."

3. **ACCURATE INDEPENDENT VISUAL GRADING (When clear human skin IS present):**
   - DO NOT simply echo the user's numeric sliders. Grade the actual visible skin independently:
     - Count/Severity of visible lesions (Comedones, Papules, Pustules, Cysts).
     - Visible surface sebum / shine vs flaky dryness.
     - Visible erythema / redness and post-inflammatory pigmentation.
     - Note any discrepancy politely (e.g. "You reported acne at 8/10, though visual assessment shows mild-moderate comedonal breakouts around 4/10").

4. **WHEN NO PHOTO IS UPLOADED:**
   - Clearly state: "No photo uploaded. This report is calibrated strictly on your self-reported scores, skin type (${skinType || 'Combination'}), and symptoms."

If the image is genuine human skin (or if no photo was uploaded), format your complete response using the following structured template:

# 🩺 Svanexa AI Skin Diagnostics Report

---

## 🌟 Clinical Skin State Analysis
- **AI Visual Grading:** [AI's independent visual assessment score (0-10) and classification, OR "Self-Reported Assessment (No photo)"]
- **Acne & Blemish Profile:** [Detailed evaluation of active lesions, comedones, or clear state]
- **Sebum & Moisture Barrier:** [Oiliness (${oiliness}/10) & Dryness (${dryness}/10) balance assessment for ${skinType || 'Combination'} skin]
- **Image Quality Check:** [Verification badge: "✅ Clear closeup verified" OR "⚠️ Visual Alert: [reason]" OR "📝 Self-Reported Mode (No photo)"]
- **Diagnostic Insights:** [In-depth dermatological analysis connecting skin type, symptoms, notes, and ${wellnessMode} hormonal influences]

---

## 🛡️ Target Skincare Protocol
### 🌅 Morning Routine (Protect & Balance)
- **Step 1 (Cleanse):** [Specific cleanser type and instructions]
- **Step 2 (Treat):** [Targeted serum/active with benefits]
- **Step 3 (Moisturize & Protect):** [Non-comedogenic moisturizer + Broad Spectrum SPF 30/50 recommendations]

### 🌃 Night Routine (Repair & Restore)
- **Step 1 (Double Cleanse):** [Cleansing method for SPF/makeup/sebum removal]
- **Step 2 (Targeted Active):** [Active ingredient treatment (frequency, application instructions)]
- **Step 3 (Barrier Support):** [Ceramide / peptide / lipid barrier restorative moisturizer]

### 🧪 Recommended Active Ingredients & Rules
- **[Active Ingredient 1]** (Purpose, concentration guide, frequency)
- **[Active Ingredient 2]** (Purpose, concentration guide, frequency)
- ⚠️ **Ingredient Compatibility Alert:** [Explicit safety rules, e.g. Do not mix Retinol with AHA/BHA or Benzoyl Peroxide in the same routine]

---

## 🥗 Hormonal & Nutritional Therapy
### 🍏 Targeted Nutrition for ${wellnessMode}
- **[Key Food / Nutrient 1]** (Dermatological & hormonal mechanism of action)
- **[Key Food / Nutrient 2]** (Dermatological & hormonal mechanism of action)
### 🚫 Trigger Foods to Minimize
- **[Trigger 1]** (Why it exacerbates sebum/inflammation/insulin spikes)
- **[Trigger 2]** (Why it exacerbates sebum/inflammation/insulin spikes)

---

*Disclaimer: This report is an AI-powered wellness guide. It does not constitute medical advice. Please consult a board-certified dermatologist for clinical diagnoses.*`;
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
    const { acne, oiliness, dryness, skinType, concerns, notes, photoBase64 } = payload;

    // Fetch user's profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    let avgAcne = '5.0';
    let avgOil = '5.0';
    let avgDry = '2.0';
    let selectedSkinType = skinType || 'Combination';
    let selectedConcerns: string[] = Array.isArray(concerns) ? concerns : [];
    let notesSummary: string[] = [];
    let latestPhotoBase64 = '';

    if (acne !== undefined || oiliness !== undefined || dryness !== undefined || photoBase64) {
      // Real-time analysis of the current input state
      avgAcne = String(acne ?? 5);
      avgOil = String(oiliness ?? 5);
      avgDry = String(dryness ?? 2);
      if (skinType) selectedSkinType = skinType;
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
      selectedSkinType = processed.skinType;
      selectedConcerns = processed.concerns;
      notesSummary = processed.notesSummary;
      latestPhotoBase64 = processed.latestPhotoBase64;
    }

    const wellnessMode = profile?.wellness_mode || 'General Wellness';

    // Build the AI instruction prompt for clinical diagnostic analysis
    const systemPrompt = buildClinicalSkinPrompt({
      acne: avgAcne,
      oiliness: avgOil,
      dryness: avgDry,
      skinType: selectedSkinType,
      concerns: selectedConcerns,
      notesSummary,
      hasPhoto: !!latestPhotoBase64,
      wellnessMode
    });

    let responseText = '';
    let modelUsed = 'gemini-2.5-flash';

    if (process.env.GEMINI_API_KEY) {
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      
      const promptParts: any[] = [systemPrompt];
      if (latestPhotoBase64) {
        const imagePart = fileToGenerativePart(latestPhotoBase64);
        if (imagePart) {
          promptParts.push(imagePart);
        }
      }

      // Try primary Gemini 2.5 Flash
      try {
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        const result = await model.generateContent(promptParts);
        responseText = result.response.text();
        modelUsed = 'gemini-2.5-flash';
      } catch (geminiError) {
        console.warn('Gemini 2.5 Flash attempt failed, trying Gemini 3.6 Flash fallback:', geminiError);
        try {
          const fallbackModel = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' });
          const result = await fallbackModel.generateContent(promptParts);
          responseText = result.response.text();
          modelUsed = 'gemini-3.6-flash';
        } catch (geminiError2) {
          console.error('Gemini fallback failed:', geminiError2);
        }
      }
    }

    if (!responseText) {
      return NextResponse.json({ 
        success: false, 
        error: "AI Skin Diagnostic Services are temporarily unavailable. Please check that GEMINI_API_KEY is configured in your environment." 
      });
    }

    const isImageInvalid = isNonSkinImageAlert(responseText);

    return NextResponse.json({
      success: true,
      analysis: responseText,
      modelUsed,
      hasPhoto: !!latestPhotoBase64,
      isImageInvalid
    });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

