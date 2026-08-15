/**
 * SVANEXA AI — Smart 10-Question MCQ Daily Check-In Question Engine
 *
 * Single source of truth for structured 10-question MCQ assessments.
 * Each slot (Morning, Afternoon, Evening) contains exactly 10 multiple-choice questions
 * capturing 10 distinct wellness dimensions:
 *   1. sleep
 *   2. energy
 *   3. mood
 *   4. stress (inferred, non-diagnostic)
 *   5. focus
 *   6. physical_comfort
 *   7. hydration
 *   8. activity
 *   9. general_wellness
 *  10. support
 */

export type WellnessMode = 'general' | 'pcos' | 'pregnancy';
export type CheckinSlot = 'morning' | 'afternoon' | 'evening';

export type CheckinCategory =
  | 'sleep'
  | 'energy'
  | 'mood'
  | 'stress'
  | 'focus'
  | 'physical_comfort'
  | 'hydration'
  | 'activity'
  | 'general_wellness'
  | 'support';

export type QuestionOption = {
  score: number;      // Normalized internal score (typically 1–5 or 1–4)
  label: string;
  emoji: string;
  value?: string;     // Semantic string value if needed
};

export type CheckinQuestion = {
  id: string;
  category: CheckinCategory;
  title: string;
  question: string;
  options: QuestionOption[];
  isStressDimension?: boolean;
};

// ─────────────────────────────────────────────────────────────────────────────
// 1. MORNING — 10 STRUCTURED MCQs
// ─────────────────────────────────────────────────────────────────────────────
const MORNING_BASE_QUESTIONS: CheckinQuestion[] = [
  {
    id: 'm_sleep',
    category: 'sleep',
    title: 'Sleep & Rest',
    question: 'How did your sleep feel last night?',
    options: [
      { score: 5, label: 'Deep and deeply refreshing', emoji: '😴' },
      { score: 4, label: 'Good, woke up rested', emoji: '😌' },
      { score: 3, label: 'Fair, woke up a few times', emoji: '😐' },
      { score: 2, label: 'A bit light or restless', emoji: '🥱' },
      { score: 1, label: 'Poor, broken or very short', emoji: '😫' },
    ],
  },
  {
    id: 'm_energy',
    category: 'energy',
    title: 'Morning Energy',
    question: 'How is your energy level as you start the day?',
    options: [
      { score: 5, label: 'High vitality, ready to go', emoji: '⚡' },
      { score: 4, label: 'Steady and good', emoji: '✨' },
      { score: 3, label: 'Moderate, still waking up', emoji: '☕' },
      { score: 2, label: 'Low and sluggish', emoji: '🔋' },
      { score: 1, label: 'Completely drained', emoji: '🪫' },
    ],
  },
  {
    id: 'm_mood',
    category: 'mood',
    title: 'Emotional Tone',
    question: 'How does your emotional headspace feel this morning?',
    options: [
      { score: 5, label: 'Joyful and optimistic', emoji: '🌸' },
      { score: 4, label: 'Calm and steady', emoji: '🙂' },
      { score: 3, label: 'Neutral, taking it as it comes', emoji: '😐' },
      { score: 2, label: 'A bit uneasy or down', emoji: '🌧️' },
      { score: 1, label: 'Heavy or very low', emoji: '💔' },
    ],
  },
  {
    id: 'm_stress',
    category: 'stress',
    title: 'Morning Ease',
    question: 'How relaxed does your morning feel?',
    isStressDimension: true,
    options: [
      { score: 1, label: 'Peaceful and unhurried', emoji: '🍃' },
      { score: 2, label: 'Mostly calm with minor tasks', emoji: '🌤️' },
      { score: 3, label: 'Manageable morning pace', emoji: '👌' },
      { score: 4, label: 'A little rushed or tense', emoji: '😰' },
      { score: 5, label: 'Already overwhelmed with pressure', emoji: '🌪️' },
    ],
  },
  {
    id: 'm_focus',
    category: 'focus',
    title: 'Mental Clarity',
    question: 'How easy is it to gather your focus right now?',
    isStressDimension: true,
    options: [
      { score: 1, label: 'Very clear-headed and sharp', emoji: '🎯' },
      { score: 2, label: 'Pretty clear', emoji: '💡' },
      { score: 3, label: 'Okay, warming up gradually', emoji: '🧠' },
      { score: 4, label: 'A bit scattered or foggy', emoji: '🌫️' },
      { score: 5, label: 'Hard to concentrate on anything', emoji: '🌀' },
    ],
  },
  {
    id: 'm_body',
    category: 'physical_comfort',
    title: 'Body Comfort',
    question: 'How does your body feel this morning?',
    isStressDimension: true,
    options: [
      { score: 1, label: 'Loose, light and comfortable', emoji: '🧘‍♀️' },
      { score: 2, label: 'Mostly comfortable', emoji: '😊' },
      { score: 3, label: 'Slight stiffness or tension', emoji: '👍' },
      { score: 4, label: 'Noticeably achy or sore', emoji: '😬' },
      { score: 5, label: 'Significant discomfort or tight pain', emoji: '😣' },
    ],
  },
  {
    id: 'm_hydration',
    category: 'hydration',
    title: 'Morning Hydration',
    question: 'Have you had some water upon waking?',
    options: [
      { score: 5, label: 'Full glass (500ml) or more', emoji: '💧' },
      { score: 4, label: 'Sipped a little water', emoji: '🥛' },
      { score: 3, label: 'Had warm tea / herbal drink', emoji: '🍵' },
      { score: 2, label: 'Just coffee so far', emoji: '☕' },
      { score: 1, label: 'Haven\'t had any fluids yet', emoji: '🏜️' },
    ],
  },
  {
    id: 'm_activity',
    category: 'activity',
    title: 'Movement Intention',
    question: 'What movement or activity are you planning today?',
    options: [
      { score: 5, label: 'Planned workout or brisk walk', emoji: '🏃‍♀️' },
      { score: 4, label: 'Gentle stretching or yoga', emoji: '🤸‍♀️' },
      { score: 3, label: 'Normal daily walking & steps', emoji: '🚶‍♀️' },
      { score: 2, label: 'Mostly quiet or seated day', emoji: '🛋️' },
      { score: 1, label: 'Complete rest day needed', emoji: '🛌' },
    ],
  },
  {
    id: 'm_wellness',
    category: 'general_wellness',
    title: 'Day Readiness',
    question: 'Overall, how ready do you feel to embrace today?',
    options: [
      { score: 5, label: 'Excited and confident', emoji: '🌟' },
      { score: 4, label: 'Grounded and prepared', emoji: '👍' },
      { score: 3, label: 'Taking it one step at a time', emoji: '⏳' },
      { score: 2, label: 'Feeling a bit unsure or hesitant', emoji: '🤔' },
      { score: 1, label: 'Dreading the day ahead', emoji: '🌧️' },
    ],
  },
  {
    id: 'm_support',
    category: 'support',
    title: 'Morning Support',
    question: 'What would help you feel most supported this morning?',
    options: [
      { score: 5, label: 'Gentle breathing or grounding pause', emoji: '🌿' },
      { score: 4, label: 'Hydration and nourishing breakfast', emoji: '🥣' },
      { score: 3, label: 'Light morning stretch routine', emoji: '🧘' },
      { score: 2, label: 'A quiet, unhurried start', emoji: '🕊️' },
      { score: 1, label: 'Clear, bite-sized wellness plan', emoji: '📋' },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// 2. AFTERNOON — 10 STRUCTURED MCQs
// ─────────────────────────────────────────────────────────────────────────────
const AFTERNOON_BASE_QUESTIONS: CheckinQuestion[] = [
  {
    id: 'a_rest',
    category: 'sleep',
    title: 'Midday Rest',
    question: 'How is your stamina holding up through the midday?',
    options: [
      { score: 5, label: 'Fully recharged and going strong', emoji: '☀️' },
      { score: 4, label: 'Steady rhythm, feeling fine', emoji: '🙂' },
      { score: 3, label: 'Mild post-lunch dip', emoji: '🥱' },
      { score: 2, label: 'Craving a short nap or break', emoji: '🛋️' },
      { score: 1, label: 'Completely exhausted and dragging', emoji: '🪫' },
    ],
  },
  {
    id: 'a_energy',
    category: 'energy',
    title: 'Afternoon Energy',
    question: 'How is your energy right now in the afternoon?',
    options: [
      { score: 5, label: 'High, productive and steady', emoji: '⚡' },
      { score: 4, label: 'Good and manageable', emoji: '✨' },
      { score: 3, label: 'Moderate, pacing myself', emoji: '👌' },
      { score: 2, label: 'Dipping noticeably', emoji: '🔋' },
      { score: 1, label: 'Running on empty', emoji: '😫' },
    ],
  },
  {
    id: 'a_mood',
    category: 'mood',
    title: 'Midday Mood',
    question: 'How has the day been feeling for you overall so far?',
    options: [
      { score: 5, label: 'Rewarding and uplifted', emoji: '🌸' },
      { score: 4, label: 'Smooth and pleasant', emoji: '🙂' },
      { score: 3, label: 'Average, doing what needs to be done', emoji: '😐' },
      { score: 2, label: 'Somewhat draining or tense', emoji: '🌧️' },
      { score: 1, label: 'Frustrating or emotionally heavy', emoji: '💔' },
    ],
  },
  {
    id: 'a_stress',
    category: 'stress',
    title: 'Mental Pressure',
    question: 'How much pressure or rush are you feeling right now?',
    isStressDimension: true,
    options: [
      { score: 1, label: 'Very little — calm and in control', emoji: '🍃' },
      { score: 2, label: 'Normal, easily manageable pace', emoji: '🌤️' },
      { score: 3, label: 'A moderate amount of pressure', emoji: '💭' },
      { score: 4, label: 'Feeling the tension build up', emoji: '😰' },
      { score: 5, label: 'Overwhelmed and very stressed', emoji: '⛈️' },
    ],
  },
  {
    id: 'a_focus',
    category: 'focus',
    title: 'Midday Focus',
    question: 'How easy has it been to maintain concentration today?',
    isStressDimension: true,
    options: [
      { score: 1, label: 'Sharp, in the flow all day', emoji: '🎯' },
      { score: 2, label: 'Mostly focused with minor breaks', emoji: '💡' },
      { score: 3, label: 'A few distractions, but managing', emoji: '🧠' },
      { score: 4, label: 'Hard to stay on track', emoji: '🌫️' },
      { score: 5, label: 'Completely scattered or brain-fogged', emoji: '🌀' },
    ],
  },
  {
    id: 'a_body',
    category: 'physical_comfort',
    title: 'Physical Comfort',
    question: 'How is your posture and body feeling this afternoon?',
    isStressDimension: true,
    options: [
      { score: 1, label: 'Comfortable and feeling loose', emoji: '🧘‍♀️' },
      { score: 2, label: 'Mostly fine, no major aches', emoji: '😊' },
      { score: 3, label: 'A little stiff from sitting/standing', emoji: '👍' },
      { score: 4, label: 'Tense shoulders, neck, or back', emoji: '😬' },
      { score: 5, label: 'Very sore, heavy, or uncomfortable', emoji: '😣' },
    ],
  },
  {
    id: 'a_hydration',
    category: 'hydration',
    title: 'Hydration Check',
    question: 'How is your water intake going today?',
    options: [
      { score: 5, label: 'On track (1.5L+ already drank)', emoji: '💧' },
      { score: 4, label: 'Had about 3–4 glasses so far', emoji: '🥛' },
      { score: 3, label: 'Had about 1–2 glasses', emoji: '🍵' },
      { score: 2, label: 'Sipped only a tiny bit', emoji: '☕' },
      { score: 1, label: 'Barely had any water today', emoji: '🏜️' },
    ],
  },
  {
    id: 'a_activity',
    category: 'activity',
    title: 'Midday Movement',
    question: 'Have you taken movement or standing breaks today?',
    options: [
      { score: 5, label: 'Took a great walk or movement break', emoji: '🚶‍♀️' },
      { score: 4, label: 'Stood up, stretched and moved around', emoji: '🤸‍♀️' },
      { score: 3, label: 'A couple of short steps', emoji: '👍' },
      { score: 2, label: 'Mostly seated with almost no movement', emoji: '🪑' },
      { score: 1, label: 'Stuck in one place all day', emoji: '🛋️' },
    ],
  },
  {
    id: 'a_wellness',
    category: 'general_wellness',
    title: 'Nourishment & Routine',
    question: 'How has your nourishment and meal routine felt today?',
    options: [
      { score: 5, label: 'Balanced, nourishing and timely', emoji: '🥗' },
      { score: 4, label: 'Ate well, feeling satisfied', emoji: '🍲' },
      { score: 3, label: 'Grabbed a quick lunch', emoji: '🥪' },
      { score: 2, label: 'Delayed meals or sugary snacks', emoji: '🍪' },
      { score: 1, label: 'Skipped meals / feel under-fueled', emoji: '😣' },
    ],
  },
  {
    id: 'a_support',
    category: 'support',
    title: 'Afternoon Reset',
    question: 'What would help you finish the second half of your day well?',
    options: [
      { score: 5, label: 'A 5-minute mental reset & hydration', emoji: '💧' },
      { score: 4, label: 'Light shoulder & back stretching', emoji: '🧘' },
      { score: 3, label: 'A nourishing healthy snack', emoji: '🍎' },
      { score: 2, label: 'A short walk outside for fresh air', emoji: '🌿' },
      { score: 1, label: 'Pacing down expectations for today', emoji: '🕊️' },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// 3. EVENING — 10 STRUCTURED MCQs
// ─────────────────────────────────────────────────────────────────────────────
const EVENING_BASE_QUESTIONS: CheckinQuestion[] = [
  {
    id: 'e_sleep',
    category: 'sleep',
    title: 'Sleep Readiness',
    question: 'How ready does your body and mind feel for sleep tonight?',
    options: [
      { score: 5, label: 'Comfortably sleepy and relaxed', emoji: '😴' },
      { score: 4, label: 'Ready to wind down peacefully', emoji: '🌙' },
      { score: 3, label: 'Still somewhat alert, getting there', emoji: '🥱' },
      { score: 2, label: 'Tired in body but mind is active', emoji: '💭' },
      { score: 1, label: 'Restless, wired, or anxious to sleep', emoji: '🌀' },
    ],
  },
  {
    id: 'e_energy',
    category: 'energy',
    title: 'Evening Energy',
    question: 'How much energy do you have remaining at the close of the day?',
    options: [
      { score: 5, label: 'Gentle, comfortable evening energy', emoji: '✨' },
      { score: 4, label: 'Content and ready to relax', emoji: '😌' },
      { score: 3, label: 'A bit tired, but good', emoji: '☕' },
      { score: 2, label: 'Drained and heavy', emoji: '🔋' },
      { score: 1, label: 'Totally depleted and exhausted', emoji: '🪫' },
    ],
  },
  {
    id: 'e_mood',
    category: 'mood',
    title: 'Day Reflection',
    question: 'Looking back, how was your overall emotional mood today?',
    options: [
      { score: 5, label: 'Content, grateful and fulfilled', emoji: '🌸' },
      { score: 4, label: 'Mostly peaceful and pleasant', emoji: '🙂' },
      { score: 3, label: 'Mixed — some highs and lows', emoji: '😐' },
      { score: 2, label: 'Frustrating or emotionally taxing', emoji: '🌧️' },
      { score: 1, label: 'Very difficult or discouraging', emoji: '💔' },
    ],
  },
  {
    id: 'e_stress',
    category: 'stress',
    title: 'Letting Go',
    question: 'How easily can you set aside today’s responsibilities tonight?',
    isStressDimension: true,
    options: [
      { score: 1, label: 'Effortlessly — fully switching off', emoji: '🍃' },
      { score: 2, label: 'Pretty easily, feeling at peace', emoji: '🌤️' },
      { score: 3, label: 'A few lingering thoughts', emoji: '💭' },
      { score: 4, label: 'Hard to stop replaying the day', emoji: '🌪️' },
      { score: 5, label: 'Mind is spinning with worry', emoji: '⛈️' },
    ],
  },
  {
    id: 'e_focus',
    category: 'focus',
    title: 'Mental Wind-Down',
    question: 'How does your mental clarity feel as the day closes?',
    isStressDimension: true,
    options: [
      { score: 1, label: 'Calm, quiet and unburdened', emoji: '🎯' },
      { score: 2, label: 'Normal, healthy end-of-day tired', emoji: '💡' },
      { score: 3, label: 'A little mentally strained', emoji: '🧠' },
      { score: 4, label: 'Quite fatigued and foggy', emoji: '🌫️' },
      { score: 5, label: 'Severe mental overload', emoji: '🌀' },
    ],
  },
  {
    id: 'e_body',
    category: 'physical_comfort',
    title: 'Physical Tension',
    question: 'How has your physical comfort held up throughout the day?',
    isStressDimension: true,
    options: [
      { score: 1, label: 'Completely relaxed and pain-free', emoji: '🧘‍♀️' },
      { score: 2, label: 'Comfortable, ready for rest', emoji: '😊' },
      { score: 3, label: 'Minor physical fatigue or tightness', emoji: '👍' },
      { score: 4, label: 'Noticeable tension in back/neck/legs', emoji: '😬' },
      { score: 5, label: 'Aching, cramping or intense tension', emoji: '😣' },
    ],
  },
  {
    id: 'e_hydration',
    category: 'hydration',
    title: 'Daily Hydration Total',
    question: 'Did you manage to stay well-hydrated throughout today?',
    options: [
      { score: 5, label: 'Hit my hydration goal (2L+)', emoji: '💧' },
      { score: 4, label: 'Drank a solid amount of water', emoji: '🥛' },
      { score: 3, label: 'Fell a little short of my goal', emoji: '🍵' },
      { score: 2, label: 'Drank only small amounts', emoji: '☕' },
      { score: 1, label: 'Hardly drank any water today', emoji: '🏜️' },
    ],
  },
  {
    id: 'e_activity',
    category: 'activity',
    title: 'Daily Movement Satisfaction',
    question: 'How satisfied are you with your activity and movement today?',
    options: [
      { score: 5, label: 'Very satisfied — active and moving', emoji: '🏃‍♀️' },
      { score: 4, label: 'Good — got sufficient daily steps', emoji: '🚶‍♀️' },
      { score: 3, label: 'Moderate — light everyday activity', emoji: '👍' },
      { score: 2, label: 'Less than I had hoped', emoji: '🪑' },
      { score: 1, label: 'Completely sedentary today', emoji: '🛋️' },
    ],
  },
  {
    id: 'e_wellness',
    category: 'general_wellness',
    title: 'Daily Accomplishment',
    question: 'How do you feel about what you navigated today?',
    options: [
      { score: 5, label: 'Proud, accomplished and grateful', emoji: '🌟' },
      { score: 4, label: 'Good, did the best I could', emoji: '👍' },
      { score: 3, label: 'Glad the day is done', emoji: '🌙' },
      { score: 2, label: 'Felt a bit behind on everything', emoji: '🤔' },
      { score: 1, label: 'Difficult day, ready to reset', emoji: '🌧️' },
    ],
  },
  {
    id: 'e_support',
    category: 'support',
    title: 'Nighttime Care',
    question: 'What would feel most nurturing for your evening routine tonight?',
    options: [
      { score: 5, label: 'Screen-free wind down & dim lights', emoji: '🕯️' },
      { score: 4, label: 'Calming sleep meditation or music', emoji: '🎧' },
      { score: 3, label: 'Warm bath or gentle restorative stretch', emoji: '🛁' },
      { score: 2, label: 'A warm herbal tea & quiet reading', emoji: '🍵' },
      { score: 1, label: 'Releasing all worries until tomorrow', emoji: '🕊️' },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// MODE CUSTOMIZATION HELPERS (PCOS / Pregnancy Adaptations)
// ─────────────────────────────────────────────────────────────────────────────

function adaptQuestionsForMode(
  questions: CheckinQuestion[],
  mode: WellnessMode
): CheckinQuestion[] {
  if (mode === 'general') return questions;

  return questions.map(q => {
    // Mode-specific adaptations for Body Comfort (category: physical_comfort)
    if (q.category === 'physical_comfort') {
      if (mode === 'pcos') {
        return {
          ...q,
          title: 'Body & Cycle Comfort',
          question: q.question.replace('your body', 'your body and pelvic comfort'),
          options: [
            { score: 1, label: 'Balanced, loose and comfortable', emoji: '🧘‍♀️' },
            { score: 2, label: 'Mostly comfortable', emoji: '😊' },
            { score: 3, label: 'Mild bloating or light fatigue', emoji: '👍' },
            { score: 4, label: 'Noticeable cramps, bloating, or ache', emoji: '😬' },
            { score: 5, label: 'Heavy pelvic cramps or high discomfort', emoji: '😣' },
          ],
        };
      }
      if (mode === 'pregnancy') {
        return {
          ...q,
          title: 'Maternal Comfort',
          question: 'How comfortable does your body feel right now?',
          options: [
            { score: 1, label: 'Restful, light and comfortable', emoji: '🤰' },
            { score: 2, label: 'Mostly comfortable and steady', emoji: '😊' },
            { score: 3, label: 'Mild back fatigue or heaviness', emoji: '👍' },
            { score: 4, label: 'Achy back, nausea, or swelling', emoji: '😬' },
            { score: 5, label: 'Significant physical discomfort or fatigue', emoji: '😣' },
          ],
        };
      }
    }

    // Mode-specific adaptations for Support (category: support)
    if (q.category === 'support') {
      if (mode === 'pcos') {
        return {
          ...q,
          title: 'PCOS Lifestyle Care',
          question: 'What kind of support would feel most helpful for your routine today?',
          options: [
            { score: 5, label: 'Gentle insulin-friendly nutrition reminder', emoji: '🥗' },
            { score: 4, label: 'Soothing cortisol-lowering breathing pause', emoji: '🌿' },
            { score: 3, label: 'Low-impact walking or yoga mobility', emoji: '🧘' },
            { score: 2, label: 'Extra hydration & pelvic comfort rest', emoji: '💧' },
            { score: 1, label: 'Kind, guilt-free rest reminder', emoji: '🕊️' },
          ],
        };
      }
      if (mode === 'pregnancy') {
        return {
          ...q,
          title: 'Maternal Support',
          question: 'What kind of care would feel most comforting for you and baby today?',
          options: [
            { score: 5, label: 'Gentle hydration & wholesome snack prompt', emoji: '🥣' },
            { score: 4, label: 'Comfortable side-resting & posture relief', emoji: '🛋️' },
            { score: 3, label: 'Soothing maternal breathing & calm music', emoji: '🎧' },
            { score: 2, label: 'Gentle foot elevation & relaxing pause', emoji: '🧘' },
            { score: 1, label: 'Warm words of reassurance and calm', emoji: '🕊️' },
          ],
        };
      }
    }

    return q;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API: GET 10 QUESTIONS PER SLOT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the exact 10 MCQ question set for a given slot and wellness mode.
 */
export function getCheckinQuestions(
  slot: CheckinSlot,
  mode: WellnessMode = 'general'
): CheckinQuestion[] {
  let base: CheckinQuestion[];
  if (slot === 'morning') base = MORNING_BASE_QUESTIONS;
  else if (slot === 'afternoon') base = AFTERNOON_BASE_QUESTIONS;
  else base = EVENING_BASE_QUESTIONS;

  return adaptQuestionsForMode(base, mode);
}

// ─────────────────────────────────────────────────────────────────────────────
// NON-DIAGNOSTIC WELLNESS INDICATORS CALCULATION
// ─────────────────────────────────────────────────────────────────────────────

export type StressInterpretation = {
  score: number;
  level: string;
  label: string;
  badgeColor: string;
  bgStyle: string;
};

export type MoodIndicator = {
  state: 'Positive' | 'Neutral' | 'Low';
  label: string;
  color: string;
};

export type EnergyIndicator = {
  level: 'High' | 'Moderate' | 'Low';
  label: string;
  color: string;
};

export type CheckinIndicators = {
  stress: StressInterpretation;
  mood: MoodIndicator;
  energy: EnergyIndicator;
  wellnessScore: number; // 0 to 100
  sleepRating: number;   // 1 to 5
  hydrationRating: number; // 1 to 5
  supportChoice: string | null;
};

/**
 * Calculates non-diagnostic indicators from 10 answered questions.
 */
export function calculateCheckinIndicators(
  answers: Record<string, number | string>,
  questions: CheckinQuestion[]
): CheckinIndicators {
  // Map category to score
  const categoryScores: Record<CheckinCategory, number> = {
    sleep: 3,
    energy: 3,
    mood: 3,
    stress: 2,
    focus: 2,
    physical_comfort: 2,
    hydration: 3,
    activity: 3,
    general_wellness: 3,
    support: 3,
  };

  let supportChoice: string | null = null;

  for (const q of questions) {
    const rawVal = answers[q.id];
    if (rawVal !== undefined && rawVal !== null) {
      const numVal = Number(rawVal);
      if (!isNaN(numVal)) {
        categoryScores[q.category] = numVal;
      }
      if (q.category === 'support') {
        const matchingOpt = q.options.find(o => o.score === numVal);
        supportChoice = matchingOpt ? matchingOpt.label : null;
      }
    }
  }

  // 1. Stress Indicator (Inferred from stress + focus + physical_comfort + mood)
  // For stress questions: 1 is calm, 5 is overwhelmed.
  // For mood: 1 is low (adds tension), 5 is positive (lowers tension).
  const stressRaw = categoryScores.stress;
  const focusRaw = categoryScores.focus;
  const bodyRaw = categoryScores.physical_comfort;
  const moodInverted = 6 - categoryScores.mood; // 5 mood -> 1 stress, 1 mood -> 5 stress

  const stressScore = Number(((stressRaw + focusRaw + bodyRaw + moodInverted) / 4).toFixed(1));
  const stress = getStressInterpretation(stressScore);

  // 2. Mood Indicator
  let moodState: 'Positive' | 'Neutral' | 'Low' = 'Neutral';
  let moodLabel = 'Your emotional state feels balanced and steady today.';
  let moodColor = 'text-blue-500 bg-blue-500/10 border-blue-500/30';

  if (categoryScores.mood >= 4) {
    moodState = 'Positive';
    moodLabel = 'Your responses suggest an uplifting, positive emotional tone.';
    moodColor = 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30';
  } else if (categoryScores.mood <= 2) {
    moodState = 'Low';
    moodLabel = 'Your responses suggest you may be carrying extra emotional weight today.';
    moodColor = 'text-rose-500 bg-rose-500/10 border-rose-500/30';
  }

  const mood: MoodIndicator = {
    state: moodState,
    label: moodLabel,
    color: moodColor,
  };

  // 3. Energy Indicator
  let energyLevel: 'High' | 'Moderate' | 'Low' = 'Moderate';
  let energyLabel = 'You have a steady, sustainable pace for today.';
  let energyColor = 'text-amber-500 bg-amber-500/10 border-amber-500/30';

  if (categoryScores.energy >= 4) {
    energyLevel = 'High';
    energyLabel = 'You are feeling energized and ready.';
    energyColor = 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30';
  } else if (categoryScores.energy <= 2) {
    energyLevel = 'Low';
    energyLabel = 'Your energy is lower — a restorative pace will serve you best.';
    energyColor = 'text-orange-500 bg-orange-500/10 border-orange-500/30';
  }

  const energy: EnergyIndicator = {
    level: energyLevel,
    label: energyLabel,
    color: energyColor,
  };

  // 4. Overall Wellness Score (0–100 composite)
  // Positive dimensions (1..5): sleep, energy, mood, hydration, activity, general_wellness
  // Inverted dimensions (1 calm..5 tense): stress, focus, physical_comfort
  const posTotal =
    categoryScores.sleep +
    categoryScores.energy +
    categoryScores.mood +
    categoryScores.hydration +
    categoryScores.activity +
    categoryScores.general_wellness; // max 30

  const invTotal =
    (6 - categoryScores.stress) +
    (6 - categoryScores.focus) +
    (6 - categoryScores.physical_comfort); // max 15

  const totalPoints = posTotal + invTotal; // max 45, min 9
  const wellnessScore = Math.round(Math.min(100, Math.max(10, ((totalPoints - 9) / 36) * 100)));

  return {
    stress,
    mood,
    energy,
    wellnessScore,
    sleepRating: categoryScores.sleep,
    hydrationRating: categoryScores.hydration,
    supportChoice,
  };
}

/**
 * Returns non-diagnostic, supportive copy for a calculated stress score.
 * NEVER makes a medical claim or uses alarming words.
 */
export function getStressInterpretation(score: number | null): StressInterpretation {
  if (score === null) {
    return {
      score: 0,
      level: 'Pending',
      label: '',
      badgeColor: 'text-muted-foreground',
      bgStyle: 'bg-secondary/40',
    };
  }

  if (score <= 2.0) {
    return {
      score,
      level: 'Calm & Balanced',
      label: 'Your responses suggest you are feeling relaxed and grounded right now.',
      badgeColor: 'text-emerald-500 border-emerald-500/30 bg-emerald-500/10',
      bgStyle: 'from-emerald-500/10 to-teal-500/5',
    };
  }
  if (score <= 3.0) {
    return {
      score,
      level: 'Mild Daily Tension',
      label: 'Your responses suggest mild daily pace — you are navigating things well.',
      badgeColor: 'text-blue-500 border-blue-500/30 bg-blue-500/10',
      bgStyle: 'from-blue-500/10 to-cyan-500/5',
    };
  }
  if (score <= 4.0) {
    return {
      score,
      level: 'Moderate Pressure',
      label: 'Your responses indicate you may benefit from a calmer pace and a short breathing pause today.',
      badgeColor: 'text-amber-500 border-amber-500/30 bg-amber-500/10',
      bgStyle: 'from-amber-500/10 to-orange-500/5',
    };
  }
  return {
    score,
    level: 'Elevated Pressure',
    label: 'Your responses suggest higher tension today. Be gentle with yourself and prioritize quiet rest.',
    badgeColor: 'text-rose-500 border-rose-500/30 bg-rose-500/10',
    bgStyle: 'from-rose-500/10 to-pink-500/5',
  };
}

// Backward compatibility helper
export function calculateStressScore(answers: Record<string, number>): number | null {
  const q1 = answers.q1_feeling || answers.m_stress || answers.a_stress || answers.e_stress || 0;
  const q2 = answers.q2_focus || answers.m_focus || answers.a_focus || answers.e_focus || 0;
  const q3 = answers.q3_body || answers.m_body || answers.a_body || answers.e_body || 0;
  const q4 = answers.q4_thoughts || answers.m_mood || answers.a_mood || answers.e_mood || 0;

  if (q1 === 0 || q2 === 0 || q3 === 0 || q4 === 0) return null;
  return Number(((Number(q1) + Number(q2) + Number(q3) + Number(q4)) / 4).toFixed(2));
}
