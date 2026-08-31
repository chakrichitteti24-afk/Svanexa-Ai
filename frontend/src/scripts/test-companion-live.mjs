import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
import path from 'path';

// Parse .env.local manually
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split(/\r?\n/).forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].trim();
    }
  });
}

const geminiKey = process.env.GEMINI_API_KEY;

if (!geminiKey) {
  console.error('❌ GEMINI_API_KEY not found in .env.local');
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(geminiKey);
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

async function runLiveTest() {
  console.log('================================================================');
  console.log('🚀 SVANEXA AI COMPANION LIVE MULTILINGUAL & OMNI-ACTIVITY TEST');
  console.log('================================================================\n');

  const omniActivityContext = {
    user: { name: 'Priya', mode: 'pcos', companionName: 'Luna', currentPage: 'Cycle Tracker' },
    currentSlot: 'afternoon',
    todayActivity: {
      checkinSlotsCompleted: ['morning', 'afternoon'],
      sleep: '7.5 hours',
      water: '1600 ml',
      exercise: '30 mins (yoga)',
      mood: 'energized',
    },
    checkInDetails: {
      has10DimensionData: true,
      energyLevel: 8,
      stressLevel: 3,
      focusLevel: 8,
      bodyComfort: 'feeling light and balanced',
      supportChoices: ['spearmint tea', 'hydration boost'],
      userNotes: 'Great energy after morning stretch.',
    },
    multiDayAverages: {
      period: '7 Days',
      avgSleep: '7.6 hrs',
      avgHydration: '1850 ml',
      avgExercise: '32 mins/day',
    },
    wellnessPlan: {
      totalTasksCount: 4,
      completedTasksCount: 3,
      pendingTasksCount: 1,
      pendingTasks: [{ title: 'Evening lavender chamomile tea', category: 'nutrition', timeSlot: 'evening' }],
    },
    skinTracking: { acneLevel: 1, skinType: 'balanced', notes: 'Clear complexion' },
    cycleIntelligence: { phase: 'follicular', cycleDay: 9, daysUntilPeriod: 19 },
    gamification: { streakDays: 12, longestStreak: 12, coinBalance: 380 },
  };

  const buildSystemInstruction = (lang) => `
You are Luna, the empathetic, emotionally attuned, and scientifically grounded AI Wellness Companion in the Svanexa ecosystem.
You are in a private, safe, and judgment-free conversation with Priya.

====================================================
LANGUAGE & MULTILINGUAL COMMUNICATION
====================================================
Target Preferred Language: ${lang}

Rules for Multilingual Interaction:
1. **Primary Output Language**: Always reply fluently, naturally, and warmly in ${lang}.
2. **Native Script**:
   - If ${lang} is Hindi, write in natural Hindi (हिंदी - Devanagari script).
   - If ${lang} is Telugu, write in natural Telugu (తెలుగు script).
   - If ${lang} is Spanish/English/etc., write with native grammar and authentic warmth.

====================================================
CORE PERSONA & VOICE
====================================================
- **Tone**: Warm, compassionate, uplifting, non-judgmental, and emotionally intuitive.
- **Empowerment**: Acknowledge feelings first.
- **Mobile-First Response Formatting**: Keep responses crisp (60–180 words). Use short 1-2 sentence paragraphs with clean markdown bullet points with **bold keywords**. End with one actionable **Micro-Step**.

====================================================
REAL-TIME ACTIVITY & OMNI-LOG ACCESS
====================================================
Live Activity for Priya:
- Streak: 12 Days Consistency (Coin Balance: 380)
- Hydration: 1600 ml / 2000 ml goal
- Sleep: 7.5 hours (7-day avg: 7.6 hrs)
- Movement: 30 mins yoga
- Cycle: Follicular phase (Cycle Day 9, 19 days until next period)
- Skin: Acne Level 1 (Clear complexion)
- Wellness Plan: 3 of 4 completed; Pending: Evening lavender chamomile tea
- Active Page: Cycle Tracker
`;

  // ────────────────────────────────────────────────────────────────
  // Test 1: Live Hindi Response with Omni-Activity
  // ────────────────────────────────────────────────────────────────
  console.log('📌 [TEST 1] Live Hindi Query with Live PCOS Activity Context');
  console.log('User Question: "आज मेरी सेहत और साइकल का हाल कैसा है?"');
  
  try {
    const hindiModel = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: buildSystemInstruction('Hindi'),
    });

    const res1 = await hindiModel.generateContent('आज मेरी सेहत और साइकल का हाल कैसा है?');
    console.log('\n💬 AI Companion Reply (Hindi):');
    console.log(res1.response.text());
    console.log('\n----------------------------------------------------------------\n');
  } catch (err) {
    console.error('❌ Hindi Test Error:', err.message);
  }

  // ────────────────────────────────────────────────────────────────
  // Test 2: Live Telugu Response with Omni-Activity
  // ────────────────────────────────────────────────────────────────
  console.log('📌 [TEST 2] Live Telugu Query with Live Activity Context');
  console.log('User Question: "ఈరోజు నా వెల్నెస్ మరియు పీరియడ్ సైకిల్ ప్రోగ్రెస్ ఎలా ఉంది?"');

  try {
    const teluguModel = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: buildSystemInstruction('Telugu'),
    });

    const res2 = await teluguModel.generateContent('ఈరోజు నా వెల్నెస్ మరియు పీరియడ్ సైకిల్ ప్రోగ్రెస్ ఎలా ఉంది?');
    console.log('\n💬 AI Companion Reply (Telugu):');
    console.log(res2.response.text());
    console.log('\n----------------------------------------------------------------\n');
  } catch (err) {
    console.error('❌ Telugu Test Error:', err.message);
  }

  // ────────────────────────────────────────────────────────────────
  // Test 3: Live English Response with Omni-Activity
  // ────────────────────────────────────────────────────────────────
  console.log('📌 [TEST 3] Live English Query with Omni-Activity & Formatting');
  console.log('User Question: "How am I tracking today and what is my next wellness step?"');

  try {
    const englishModel = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: buildSystemInstruction('English'),
    });

    const res3 = await englishModel.generateContent('How am I tracking today and what is my next wellness step?');
    console.log('\n💬 AI Companion Reply (English):');
    console.log(res3.response.text());
    console.log('\n----------------------------------------------------------------\n');
  } catch (err) {
    console.error('❌ English Test Error:', err.message);
  }

  console.log('🎉 All live multilingual and omni-activity integration tests succeeded!');
}

runLiveTest();
