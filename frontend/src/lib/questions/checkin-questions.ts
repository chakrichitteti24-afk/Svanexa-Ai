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
export type CyclePhase = 'menstrual' | 'follicular' | 'ovulation' | 'luteal' | string;

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

export interface CheckinQuestionOptions {
  dateStr?: string;
  cyclePhase?: CyclePhase;
  rotation?: number; // Explicit override: 0, 1, or 2
}

/**
 * Deterministically calculates a 3-way rotation index (0, 1, 2) from a date string (YYYY-MM-DD).
 */
export function getRotationIndex(dateStr?: string): number {
  if (dateStr && dateStr.length >= 10) {
    const day = parseInt(dateStr.slice(8, 10), 10);
    if (!isNaN(day)) return (day % 3);
  }
  return new Date().getDate() % 3;
}

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
// ROTATING QUESTION VARIANTS (V1 and V2) FOR 7-DAY ENGAGEMENT & NOVELTY
// ─────────────────────────────────────────────────────────────────────────────

const MORNING_V1: CheckinQuestion[] = [
  {
    id: 'm_sleep',
    category: 'sleep',
    title: 'Night Rest Recovery',
    question: 'How restorative was your rest throughout the night?',
    options: [
      { score: 5, label: 'Deeply restorative, woke up energized', emoji: '😴' },
      { score: 4, label: 'Slept soundly with good rest', emoji: '😌' },
      { score: 3, label: 'Moderate sleep, woke up a couple times', emoji: '😐' },
      { score: 2, label: 'Restless with frequent tossing', emoji: '🥱' },
      { score: 1, label: 'Broken, unrefreshing sleep', emoji: '😫' },
    ],
  },
  {
    id: 'm_energy',
    category: 'energy',
    title: 'Morning Vitality',
    question: 'How does your natural morning vitality feel today?',
    options: [
      { score: 5, label: 'Bursting with clean vitality', emoji: '⚡' },
      { score: 4, label: 'Good, steady wakefulness', emoji: '✨' },
      { score: 3, label: 'Warming up gradually', emoji: '☕' },
      { score: 2, label: 'Heavy and slow to start', emoji: '🔋' },
      { score: 1, label: 'Completely drained of energy', emoji: '🪫' },
    ],
  },
  {
    id: 'm_mood',
    category: 'mood',
    title: 'Emotional Weather',
    question: 'What is your emotional weather as you begin today?',
    options: [
      { score: 5, label: 'Bright, grateful and sunny', emoji: '🌸' },
      { score: 4, label: 'Gentle, calm and centered', emoji: '🙂' },
      { score: 3, label: 'Even-keeled and neutral', emoji: '😐' },
      { score: 2, label: 'Somewhat cloudy or vulnerable', emoji: '🌧️' },
      { score: 1, label: 'Stormy, tense or deeply down', emoji: '💔' },
    ],
  },
  {
    id: 'm_stress',
    category: 'stress',
    title: 'Morning Cadence',
    question: 'How much mental ease do you feel starting off today?',
    isStressDimension: true,
    options: [
      { score: 1, label: 'Completely serene and unhurried', emoji: '🍃' },
      { score: 2, label: 'Comfortable, light momentum', emoji: '🌤️' },
      { score: 3, label: 'Standard routine pace', emoji: '👌' },
      { score: 4, label: 'Feeling pressed for time', emoji: '😰' },
      { score: 5, label: 'High pressure and racing thoughts', emoji: '🌪️' },
    ],
  },
  {
    id: 'm_focus',
    category: 'focus',
    title: 'Attention & Presence',
    question: 'How sharp and present is your attention this morning?',
    isStressDimension: true,
    options: [
      { score: 1, label: 'Laser-focused and alert', emoji: '🎯' },
      { score: 2, label: 'Clear and composed', emoji: '💡' },
      { score: 3, label: 'Decent, settling in now', emoji: '🧠' },
      { score: 4, label: 'A bit scattered or daydreaming', emoji: '🌫️' },
      { score: 5, label: 'Heavy morning brain fog', emoji: '🌀' },
    ],
  },
  {
    id: 'm_body',
    category: 'physical_comfort',
    title: 'Body Lightness',
    question: 'How light or relaxed is your physical body feeling?',
    isStressDimension: true,
    options: [
      { score: 1, label: 'Fluid, agile and comfortable', emoji: '🧘‍♀️' },
      { score: 2, label: 'Good, no notable aches', emoji: '😊' },
      { score: 3, label: 'Mild morning stiffness', emoji: '👍' },
      { score: 4, label: 'Tense shoulders or lower back', emoji: '😬' },
      { score: 5, label: 'Heavy aches or physical pain', emoji: '😣' },
    ],
  },
  {
    id: 'm_hydration',
    category: 'hydration',
    title: 'Hydration Intake',
    question: 'How are you hydrating as you begin the day?',
    options: [
      { score: 5, label: 'Chugged 500ml+ fresh water', emoji: '💧' },
      { score: 4, label: 'Drank a nice glass of water', emoji: '🥛' },
      { score: 3, label: 'Had warm herbal infusion/lemon water', emoji: '🍵' },
      { score: 2, label: 'Only coffee or tea so far', emoji: '☕' },
      { score: 1, label: 'Zero liquids yet', emoji: '🏜️' },
    ],
  },
  {
    id: 'm_activity',
    category: 'activity',
    title: 'Daily Movement Type',
    question: 'What kind of movement feels right for your body today?',
    options: [
      { score: 5, label: 'Full workout or brisk morning walk', emoji: '🏃‍♀️' },
      { score: 4, label: 'Mindful stretching or yoga flow', emoji: '🤸‍♀️' },
      { score: 3, label: 'General daytime steps and errands', emoji: '🚶‍♀️' },
      { score: 2, label: 'Mostly quiet or seated day', emoji: '🛋️' },
      { score: 1, label: 'Total physical rest needed', emoji: '🛌' },
    ],
  },
  {
    id: 'm_wellness',
    category: 'general_wellness',
    title: 'Daily Alignment',
    question: 'How aligned and centered do you feel for the hours ahead?',
    options: [
      { score: 5, label: 'Empowered, clear and aligned', emoji: '🌟' },
      { score: 4, label: 'Grounded and positive', emoji: '👍' },
      { score: 3, label: 'Ready to take things as they come', emoji: '⏳' },
      { score: 2, label: 'A bit unsettled or hesitant', emoji: '🤔' },
      { score: 1, label: 'Dreading the day\'s demands', emoji: '🌧️' },
    ],
  },
  {
    id: 'm_support',
    category: 'support',
    title: 'Nurturing Start',
    question: 'What would nurture your morning routine best right now?',
    options: [
      { score: 5, label: '3-minute calming breathwork pause', emoji: '🌿' },
      { score: 4, label: 'Warm, nutrient-rich breakfast', emoji: '🥣' },
      { score: 3, label: 'Gentle spinal mobility stretch', emoji: '🧘' },
      { score: 2, label: 'Uninterrupted peaceful quiet', emoji: '🕊️' },
      { score: 1, label: 'Clear, step-by-step guidance', emoji: '📋' },
    ],
  },
];

const MORNING_V2: CheckinQuestion[] = [
  {
    id: 'm_sleep',
    category: 'sleep',
    title: 'Waking Refreshment',
    question: 'How easily did you wake up and greet the morning?',
    options: [
      { score: 5, label: 'Woke naturally, feeling bright', emoji: '😴' },
      { score: 4, label: 'Woke up easily and rested', emoji: '😌' },
      { score: 3, label: 'Needed a few minutes to adjust', emoji: '😐' },
      { score: 2, label: 'Felt groggy and dragged out of bed', emoji: '🥱' },
      { score: 1, label: 'Struggled immensely to get up', emoji: '😫' },
    ],
  },
  {
    id: 'm_energy',
    category: 'energy',
    title: 'Internal Battery',
    question: 'How is your internal battery charged for today?',
    options: [
      { score: 5, label: '100% — fully charged & vibrant', emoji: '⚡' },
      { score: 4, label: '80% — ready for a full day', emoji: '✨' },
      { score: 3, label: '50% — steady, moderate pace', emoji: '☕' },
      { score: 2, label: '30% — running on low reserves', emoji: '🔋' },
      { score: 1, label: '10% — critically low / empty', emoji: '🪫' },
    ],
  },
  {
    id: 'm_mood',
    category: 'mood',
    title: 'Morning Mindset',
    question: 'How is your heart and mindset feeling right now?',
    options: [
      { score: 5, label: 'Uplifted, joyful and inspired', emoji: '🌸' },
      { score: 4, label: 'Peaceful, calm and kind', emoji: '🙂' },
      { score: 3, label: 'Balanced and open-minded', emoji: '😐' },
      { score: 2, label: 'A bit anxious or heavy-hearted', emoji: '🌧️' },
      { score: 1, label: 'Low spirits or overwhelmed', emoji: '💔' },
    ],
  },
  {
    id: 'm_stress',
    category: 'stress',
    title: 'Morning Pressure',
    question: 'What is your internal sense of urgency this morning?',
    isStressDimension: true,
    options: [
      { score: 1, label: 'Zero rush — perfectly at peace', emoji: '🍃' },
      { score: 2, label: 'Mild, organized forward motion', emoji: '🌤️' },
      { score: 3, label: 'Normal daily busyness', emoji: '👌' },
      { score: 4, label: 'Racing against the clock', emoji: '😰' },
      { score: 5, label: 'Overwhelmed with heavy pressure', emoji: '🌪️' },
    ],
  },
  {
    id: 'm_focus',
    category: 'focus',
    title: 'Thought Clarity',
    question: 'How readily can you organize your thoughts right now?',
    isStressDimension: true,
    options: [
      { score: 1, label: 'Effortlessly sharp and organized', emoji: '🎯' },
      { score: 2, label: 'Good, steady concentration', emoji: '💡' },
      { score: 3, label: 'Managing fine with one task at a time', emoji: '🧠' },
      { score: 4, label: 'A bit hazy and distracted', emoji: '🌫️' },
      { score: 5, label: 'Scattered thoughts / mental overload', emoji: '🌀' },
    ],
  },
  {
    id: 'm_body',
    category: 'physical_comfort',
    title: 'Muscles & Joints',
    question: 'How are your muscles and joints feeling this morning?',
    isStressDimension: true,
    options: [
      { score: 1, label: 'Supple, loose and tension-free', emoji: '🧘‍♀️' },
      { score: 2, label: 'Comfortable baseline', emoji: '😊' },
      { score: 3, label: 'Minor tightness or stiffness', emoji: '👍' },
      { score: 4, label: 'Noticeably sore or stiff', emoji: '😬' },
      { score: 5, label: 'Severe physical tension or pain', emoji: '😣' },
    ],
  },
  {
    id: 'm_hydration',
    category: 'hydration',
    title: 'Morning Fluids',
    question: 'Have you nourished your body with fluids upon waking?',
    options: [
      { score: 5, label: '500ml+ fresh water already finished', emoji: '💧' },
      { score: 4, label: 'A tall glass of water', emoji: '🥛' },
      { score: 3, label: 'Warm lemon or herbal water', emoji: '🍵' },
      { score: 2, label: 'Just tea or coffee so far', emoji: '☕' },
      { score: 1, label: 'Completely parched, need water now', emoji: '🏜️' },
    ],
  },
  {
    id: 'm_activity',
    category: 'activity',
    title: 'Movement Desire',
    question: 'How does your body want to move today?',
    options: [
      { score: 5, label: 'Ready for active exercise or brisk walk', emoji: '🏃‍♀️' },
      { score: 4, label: 'Gentle mobility, yoga or walking', emoji: '🤸‍♀️' },
      { score: 3, label: 'Everyday casual movement', emoji: '🚶‍♀️' },
      { score: 2, label: 'Low-movement day preferred', emoji: '🛋️' },
      { score: 1, label: 'Needs complete quiet and recovery', emoji: '🛌' },
    ],
  },
  {
    id: 'm_wellness',
    category: 'general_wellness',
    title: 'Confidence',
    question: 'How confident do you feel about navigating today?',
    options: [
      { score: 5, label: 'Confident, capable and enthusiastic', emoji: '🌟' },
      { score: 4, label: 'Grounded and steady', emoji: '👍' },
      { score: 3, label: 'Pacing myself step-by-step', emoji: '⏳' },
      { score: 2, label: 'Feeling slightly hesitant or behind', emoji: '🤔' },
      { score: 1, label: 'Overwhelmed by today\'s expectations', emoji: '🌧️' },
    ],
  },
  {
    id: 'm_support',
    category: 'support',
    title: 'Morning Boost',
    question: 'What single habit would give you the biggest boost right now?',
    options: [
      { score: 5, label: '3-minute nervous system reset', emoji: '🌿' },
      { score: 4, label: 'Hydrating water & clean nourishment', emoji: '🥣' },
      { score: 3, label: '5-minute shoulder & hip stretch', emoji: '🧘' },
      { score: 2, label: 'A quiet moment to just be', emoji: '🕊️' },
      { score: 1, label: 'A simple list of 1–2 priorities', emoji: '📋' },
    ],
  },
];

const AFTERNOON_V1: CheckinQuestion[] = [
  {
    id: 'a_rest',
    category: 'sleep',
    title: 'Midday Battery',
    question: 'How is your sustained focus and stamina as the afternoon unfolds?',
    options: [
      { score: 5, label: 'Sailing through with plenty in reserve', emoji: '☀️' },
      { score: 4, label: 'Good, steady workflow', emoji: '🙂' },
      { score: 3, label: 'Noticeable afternoon slump', emoji: '🥱' },
      { score: 2, label: 'Feeling heavy-eyed and fatigued', emoji: '🛋️' },
      { score: 1, label: 'Utterly drained of stamina', emoji: '🪫' },
    ],
  },
  {
    id: 'a_energy',
    category: 'energy',
    title: 'Afternoon Rhythm',
    question: 'What is your current energy pace this afternoon?',
    options: [
      { score: 5, label: 'Vibrant and fully engaged', emoji: '⚡' },
      { score: 4, label: 'Smooth and manageable', emoji: '✨' },
      { score: 3, label: 'Moderate, need small breaks', emoji: '👌' },
      { score: 2, label: 'Slowing down significantly', emoji: '🔋' },
      { score: 1, label: 'Running on fumes', emoji: '😫' },
    ],
  },
  {
    id: 'a_mood',
    category: 'mood',
    title: 'Midday Heart',
    question: 'How are you holding up emotionally this afternoon?',
    options: [
      { score: 5, label: 'Uplifted, smiling and accomplished', emoji: '🌸' },
      { score: 4, label: 'Content and at peace', emoji: '🙂' },
      { score: 3, label: 'Routine, handling responsibilities', emoji: '😐' },
      { score: 2, label: 'Feeling irritated or depleted', emoji: '🌧️' },
      { score: 1, label: 'Emotionally overwhelmed', emoji: '💔' },
    ],
  },
  {
    id: 'a_stress',
    category: 'stress',
    title: 'Workday Tension',
    question: 'How much stress or mental friction are you holding right now?',
    isStressDimension: true,
    options: [
      { score: 1, label: 'Zero friction — totally calm', emoji: '🍃' },
      { score: 2, label: 'Light, manageable tasks', emoji: '🌤️' },
      { score: 3, label: 'Moderate demands', emoji: '💭' },
      { score: 4, label: 'Tension rising in head/shoulders', emoji: '😰' },
      { score: 5, label: 'Severe pressure or anxiety', emoji: '⛈️' },
    ],
  },
  {
    id: 'a_focus',
    category: 'focus',
    title: 'Mental Flow',
    question: 'How easily can you keep your attention anchored right now?',
    isStressDimension: true,
    options: [
      { score: 1, label: 'Deep focus with zero effort', emoji: '🎯' },
      { score: 2, label: 'Good focus with brief pauses', emoji: '💡' },
      { score: 3, label: 'Occasionally checking out, but okay', emoji: '🧠' },
      { score: 4, label: 'Distracted and seeking breaks', emoji: '🌫️' },
      { score: 5, label: 'Complete brain freeze or fog', emoji: '🌀' },
    ],
  },
  {
    id: 'a_body',
    category: 'physical_comfort',
    title: 'Physical Ease',
    question: 'How does your back, neck, and physical frame feel?',
    isStressDimension: true,
    options: [
      { score: 1, label: 'Totally comfortable and relaxed', emoji: '🧘‍♀️' },
      { score: 2, label: 'Generally fine', emoji: '😊' },
      { score: 3, label: 'Mild postural fatigue', emoji: '👍' },
      { score: 4, label: 'Noticeable knotting or stiffness', emoji: '😬' },
      { score: 5, label: 'Painful stiffness or fatigue', emoji: '😣' },
    ],
  },
  {
    id: 'a_hydration',
    category: 'hydration',
    title: 'Water Tracking',
    question: 'How well are you keeping up with your daily water goal?',
    options: [
      { score: 5, label: 'Crushing it (1.5L+ consumed)', emoji: '💧' },
      { score: 4, label: 'Good progress (around 1L)', emoji: '🥛' },
      { score: 3, label: 'A couple glasses so far', emoji: '🍵' },
      { score: 2, label: 'Under-hydrated, need to catch up', emoji: '☕' },
      { score: 1, label: 'Almost nothing to drink today', emoji: '🏜️' },
    ],
  },
  {
    id: 'a_activity',
    category: 'activity',
    title: 'Step & Stretch Breaks',
    question: 'Have you stepped away to stretch your legs today?',
    options: [
      { score: 5, label: 'Yes, enjoyed a great brisk walk', emoji: '🚶‍♀️' },
      { score: 4, label: 'Stood, stretched and took steps', emoji: '🤸‍♀️' },
      { score: 3, label: 'A few quick steps around the room', emoji: '👍' },
      { score: 2, label: 'Barely moved from chair', emoji: '🪑' },
      { score: 1, label: 'Glued to screen all day', emoji: '🛋️' },
    ],
  },
  {
    id: 'a_wellness',
    category: 'general_wellness',
    title: 'Midday Fuel',
    question: 'How did your lunchtime nourishment treat your body?',
    options: [
      { score: 5, label: 'Wholesome, balanced and energizing', emoji: '🥗' },
      { score: 4, label: 'Satisfying and hearty', emoji: '🍲' },
      { score: 3, label: 'Standard quick lunch', emoji: '🥪' },
      { score: 2, label: 'Sugary or heavy, causing lethargy', emoji: '🍪' },
      { score: 1, label: 'Forgot or skipped lunch entirely', emoji: '😣' },
    ],
  },
  {
    id: 'a_support',
    category: 'support',
    title: 'Afternoon Pause',
    question: 'What micro-break would recharge you most right now?',
    options: [
      { score: 5, label: '5-minute eyes-closed breathing reset', emoji: '💧' },
      { score: 4, label: 'Neck roll and shoulder stretch', emoji: '🧘' },
      { score: 3, label: 'Fresh water & a crisp fruit snack', emoji: '🍎' },
      { score: 2, label: 'Step outside for 3 mins of natural air', emoji: '🌿' },
      { score: 1, label: 'Simplifying today\'s remaining to-do list', emoji: '🕊️' },
    ],
  },
];

const AFTERNOON_V2: CheckinQuestion[] = [
  {
    id: 'a_rest',
    category: 'sleep',
    title: 'Afternoon Resilience',
    question: 'How well are your reserves carrying you past midday?',
    options: [
      { score: 5, label: 'Resilient and clear-headed', emoji: '☀️' },
      { score: 4, label: 'Sustained and steady', emoji: '🙂' },
      { score: 3, label: 'Midday energy dip, taking it steady', emoji: '🥱' },
      { score: 2, label: 'Heavy eyelids, craving downtime', emoji: '🛋️' },
      { score: 1, label: 'Complete exhaustion', emoji: '🪫' },
    ],
  },
  {
    id: 'a_energy',
    category: 'energy',
    title: 'Current Power Level',
    question: 'What percentage of your energy do you feel you have right now?',
    options: [
      { score: 5, label: '90–100% — strong and energetic', emoji: '⚡' },
      { score: 4, label: '70–80% — good, dependable pace', emoji: '✨' },
      { score: 3, label: '50% — cruising moderately', emoji: '👌' },
      { score: 2, label: '20–30% — sluggish and dragging', emoji: '🔋' },
      { score: 1, label: 'Near 0% — completely wiped out', emoji: '😫' },
    ],
  },
  {
    id: 'a_mood',
    category: 'mood',
    title: 'Emotional Outlook',
    question: 'What tone has your inner voice taken this afternoon?',
    options: [
      { score: 5, label: 'Encouraging, bright and grateful', emoji: '🌸' },
      { score: 4, label: 'Calm, steady and grounded', emoji: '🙂' },
      { score: 3, label: 'Neutral, getting through tasks', emoji: '😐' },
      { score: 2, label: 'A bit self-critical or weary', emoji: '🌧️' },
      { score: 1, label: 'Discouraged, anxious or down', emoji: '💔' },
    ],
  },
  {
    id: 'a_stress',
    category: 'stress',
    title: 'Current Stress Level',
    question: 'How much stress is present in your mind right now?',
    isStressDimension: true,
    options: [
      { score: 1, label: 'Very serene, peaceful flow', emoji: '🍃' },
      { score: 2, label: 'Comfortable daily cadence', emoji: '🌤️' },
      { score: 3, label: 'Moderate workload pressure', emoji: '💭' },
      { score: 4, label: 'Notable stress creeping in', emoji: '😰' },
      { score: 5, label: 'Severe emotional overload', emoji: '⛈️' },
    ],
  },
  {
    id: 'a_focus',
    category: 'focus',
    title: 'Mental Precision',
    question: 'How easy is it to solve problems and stay sharp today?',
    isStressDimension: true,
    options: [
      { score: 1, label: 'Extremely sharp and agile', emoji: '🎯' },
      { score: 2, label: 'Clear and capable', emoji: '💡' },
      { score: 3, label: 'Slower, but getting things done', emoji: '🧠' },
      { score: 4, label: 'Struggling to hold one train of thought', emoji: '🌫️' },
      { score: 5, label: 'Complete mental fog', emoji: '🌀' },
    ],
  },
  {
    id: 'a_body',
    category: 'physical_comfort',
    title: 'Physical Tension',
    question: 'How relaxed does your physical body feel right now?',
    isStressDimension: true,
    options: [
      { score: 1, label: 'Totally relaxed and pain-free', emoji: '🧘‍♀️' },
      { score: 2, label: 'Mostly comfortable', emoji: '😊' },
      { score: 3, label: 'A bit stiff from holding position', emoji: '👍' },
      { score: 4, label: 'Sore back or tight neck', emoji: '😬' },
      { score: 5, label: 'Heavy physical strain or ache', emoji: '😣' },
    ],
  },
  {
    id: 'a_hydration',
    category: 'hydration',
    title: 'Hydration Routine',
    question: 'Have you refilled your water bottle or glass this afternoon?',
    options: [
      { score: 5, label: 'Yes, on my 3rd or 4th refill', emoji: '💧' },
      { score: 4, label: 'Had several glasses today', emoji: '🥛' },
      { score: 3, label: 'Had 1–2 glasses', emoji: '🍵' },
      { score: 2, label: 'Just sips here and there', emoji: '☕' },
      { score: 1, label: 'Haven\'t reached for water at all', emoji: '🏜️' },
    ],
  },
  {
    id: 'a_activity',
    category: 'activity',
    title: 'Midday Physical Break',
    question: 'How much have you moved your body since morning?',
    options: [
      { score: 5, label: 'Plenty of steps and good movement', emoji: '🚶‍♀️' },
      { score: 4, label: 'Took periodic standing & stretch breaks', emoji: '🤸‍♀️' },
      { score: 3, label: 'Light everyday movement', emoji: '👍' },
      { score: 2, label: 'Mostly seated in one spot', emoji: '🪑' },
      { score: 1, label: 'Zero physical movement', emoji: '🛋️' },
    ],
  },
  {
    id: 'a_wellness',
    category: 'general_wellness',
    title: 'Daily Pacing',
    question: 'How sustainable has your pace felt today?',
    options: [
      { score: 5, label: 'Very sustainable and balanced', emoji: '🥗' },
      { score: 4, label: 'Good, steady balance', emoji: '🍲' },
      { score: 3, label: 'A little busy, but manageable', emoji: '🥪' },
      { score: 2, label: 'Too hurried or draining', emoji: '🍪' },
      { score: 1, label: 'Chaotic and completely depleting', emoji: '😣' },
    ],
  },
  {
    id: 'a_support',
    category: 'support',
    title: 'Afternoon Support',
    question: 'What would help you finish the workday feeling centered?',
    options: [
      { score: 5, label: 'A quick hydration & breathing break', emoji: '💧' },
      { score: 4, label: 'Shoulder roll and wrist stretches', emoji: '🧘' },
      { score: 3, label: 'A protein or fiber-rich snack', emoji: '🍎' },
      { score: 2, label: 'A short 5-minute outdoor walk', emoji: '🌿' },
      { score: 1, label: 'Permission to leave extra tasks for tomorrow', emoji: '🕊️' },
    ],
  },
];

const EVENING_V1: CheckinQuestion[] = [
  {
    id: 'e_sleep',
    category: 'sleep',
    title: 'Sleep Wind-Down',
    question: 'How peaceful is your transition into sleep tonight?',
    options: [
      { score: 5, label: 'Drifting into deep peaceful drowsiness', emoji: '😴' },
      { score: 4, label: 'Ready to turn out lights comfortably', emoji: '🌙' },
      { score: 3, label: 'Winding down at a relaxed pace', emoji: '🥱' },
      { score: 2, label: 'Brain still spinning with thoughts', emoji: '💭' },
      { score: 1, label: 'Wired, agitated or struggling to unwind', emoji: '🌀' },
    ],
  },
  {
    id: 'e_energy',
    category: 'energy',
    title: 'Evening Battery',
    question: 'How does your physical stamina feel as night settles in?',
    options: [
      { score: 5, label: 'Pleasant, cozy and gently relaxed', emoji: '✨' },
      { score: 4, label: 'Calmly tired in a healthy way', emoji: '😌' },
      { score: 3, label: 'Ready to lounge and rest', emoji: '☕' },
      { score: 2, label: 'Heavy and fatigued', emoji: '🔋' },
      { score: 1, label: 'Burned out and completely depleted', emoji: '🪫' },
    ],
  },
  {
    id: 'e_mood',
    category: 'mood',
    title: 'Evening Gratitude',
    question: 'When you look back on today, what is your primary feeling?',
    options: [
      { score: 5, label: 'Deep gratitude and quiet joy', emoji: '🌸' },
      { score: 4, label: 'Peaceful and content', emoji: '🙂' },
      { score: 3, label: 'Neutral, ready for tomorrow', emoji: '😐' },
      { score: 2, label: 'A bit heavy or exhausted', emoji: '🌧️' },
      { score: 1, label: 'Deeply frustrated or sad', emoji: '💔' },
    ],
  },
  {
    id: 'e_stress',
    category: 'stress',
    title: 'Releasing the Day',
    question: 'Can you give yourself full permission to rest tonight?',
    isStressDimension: true,
    options: [
      { score: 1, label: 'Completely — today is done', emoji: '🍃' },
      { score: 2, label: 'Mostly relaxed and letting go', emoji: '🌤️' },
      { score: 3, label: 'A few lingering to-do lists', emoji: '💭' },
      { score: 4, label: 'Feeling guilty or anxious to rest', emoji: '🌪️' },
      { score: 5, label: 'Unable to turn off worry', emoji: '⛈️' },
    ],
  },
  {
    id: 'e_focus',
    category: 'focus',
    title: 'Night Mental Quiet',
    question: 'How quiet does your headspace feel right now?',
    isStressDimension: true,
    options: [
      { score: 1, label: 'Quiet, still and serene', emoji: '🎯' },
      { score: 2, label: 'Comfortably relaxed', emoji: '💡' },
      { score: 3, label: 'A bit of background mental chatter', emoji: '🧠' },
      { score: 4, label: 'Mentally overtired and buzzing', emoji: '🌫️' },
      { score: 5, label: 'Racing thoughts and restlessness', emoji: '🌀' },
    ],
  },
  {
    id: 'e_body',
    category: 'physical_comfort',
    title: 'Body Restoration',
    question: 'How comfortable does your physical body feel lying or sitting down?',
    isStressDimension: true,
    options: [
      { score: 1, label: 'Completely comfortable and heavy with rest', emoji: '🧘‍♀️' },
      { score: 2, label: 'Comfortable, ready for bed', emoji: '😊' },
      { score: 3, label: 'Slight fatigue in joints or muscles', emoji: '👍' },
      { score: 4, label: 'Tight shoulders or lower-back ache', emoji: '😬' },
      { score: 5, label: 'High physical discomfort or cramps', emoji: '😣' },
    ],
  },
  {
    id: 'e_hydration',
    category: 'hydration',
    title: 'Full Day Hydration',
    question: 'How satisfied are you with the liquids you gave your body today?',
    options: [
      { score: 5, label: 'Fully hydrated (2L+ drank)', emoji: '💧' },
      { score: 4, label: 'Drank good amounts throughout', emoji: '🥛' },
      { score: 3, label: 'Decent, had a few good glasses', emoji: '🍵' },
      { score: 2, label: 'Fell behind on water', emoji: '☕' },
      { score: 1, label: 'Hardly drank anything all day', emoji: '🏜️' },
    ],
  },
  {
    id: 'e_activity',
    category: 'activity',
    title: 'Movement Reflection',
    question: 'How do your legs and body feel about today\'s movement?',
    options: [
      { score: 5, label: 'Pleasantly tired from good exercise', emoji: '🏃‍♀️' },
      { score: 4, label: 'Satisfying amount of walking', emoji: '🚶‍♀️' },
      { score: 3, label: 'Light routine activity', emoji: '👍' },
      { score: 2, label: 'A little stiff from sitting too long', emoji: '🪑' },
      { score: 1, label: 'Inactive and feeling cramped', emoji: '🛋️' },
    ],
  },
  {
    id: 'e_wellness',
    category: 'general_wellness',
    title: 'Self-Compassion',
    question: 'How kind are you feeling toward yourself this evening?',
    options: [
      { score: 5, label: 'Full of pride and warmth for my effort', emoji: '🌟' },
      { score: 4, label: 'Happy with how I handled today', emoji: '👍' },
      { score: 3, label: 'Content, taking it in stride', emoji: '🌙' },
      { score: 2, label: 'A bit self-critical about tasks', emoji: '🤔' },
      { score: 1, label: 'Harsh on myself or disappointed', emoji: '🌧️' },
    ],
  },
  {
    id: 'e_support',
    category: 'support',
    title: 'Bedtime Nurture',
    question: 'What night ritual would feel most soothing before sleep?',
    options: [
      { score: 5, label: 'Warm chamomile tea and dim lights', emoji: '🕯️' },
      { score: 4, label: 'Guided sleep meditation or soothing rain sound', emoji: '🎧' },
      { score: 3, label: 'Gentle bed stretches or legs up the wall', emoji: '🛁' },
      { score: 2, label: 'A few minutes of offline fiction reading', emoji: '🍵' },
      { score: 1, label: 'Writing down worries and closing the notebook', emoji: '🕊️' },
    ],
  },
];

const EVENING_V2: CheckinQuestion[] = [
  {
    id: 'e_sleep',
    category: 'sleep',
    title: 'Night Rest Outlook',
    question: 'How expectant are you of a deep, restful sleep tonight?',
    options: [
      { score: 5, label: 'Very confident — body is primed for sleep', emoji: '😴' },
      { score: 4, label: 'Looking forward to cozy rest', emoji: '🌙' },
      { score: 3, label: 'Will likely sleep fine', emoji: '🥱' },
      { score: 2, label: 'Hoping sleep isn\'t too broken', emoji: '💭' },
      { score: 1, label: 'Dreading insomnia or restless night', emoji: '🌀' },
    ],
  },
  {
    id: 'e_energy',
    category: 'energy',
    title: 'End of Day Reserve',
    question: 'How is your energy tank right now at bedtime?',
    options: [
      { score: 5, label: 'Soft, gentle and comfortable', emoji: '✨' },
      { score: 4, label: 'Pleasantly ready to sleep', emoji: '😌' },
      { score: 3, label: 'Normal bedtime tiredness', emoji: '☕' },
      { score: 2, label: 'Crashing or physically drained', emoji: '🔋' },
      { score: 1, label: 'Totally burnt out and exhausted', emoji: '🪫' },
    ],
  },
  {
    id: 'e_mood',
    category: 'mood',
    title: 'Evening Peace',
    question: 'How peaceful is your heart as you prepare for rest?',
    options: [
      { score: 5, label: 'Very peaceful, fulfilled and grateful', emoji: '🌸' },
      { score: 4, label: 'Calm and steady', emoji: '🙂' },
      { score: 3, label: 'Neutral, day is done', emoji: '😐' },
      { score: 2, label: 'A little stressed or melancholy', emoji: '🌧️' },
      { score: 1, label: 'Deeply troubled or lonely', emoji: '💔' },
    ],
  },
  {
    id: 'e_stress',
    category: 'stress',
    title: 'Mind Disconnect',
    question: 'How easily can you disconnect from tomorrow\'s schedule right now?',
    isStressDimension: true,
    options: [
      { score: 1, label: 'Completely disconnected — tomorrow will wait', emoji: '🍃' },
      { score: 2, label: 'Mostly calm and compartmentalized', emoji: '🌤️' },
      { score: 3, label: 'A couple of thoughts about tomorrow', emoji: '💭' },
      { score: 4, label: 'Pre-planning tomorrow with some stress', emoji: '🌪️' },
      { score: 5, label: 'Severe anticipatory anxiety', emoji: '⛈️' },
    ],
  },
  {
    id: 'e_focus',
    category: 'focus',
    title: 'Mental Decompression',
    question: 'How quiet and clear is your mind this evening?',
    isStressDimension: true,
    options: [
      { score: 1, label: 'Blissfully quiet and decompressing', emoji: '🎯' },
      { score: 2, label: 'Relaxed and comfortable', emoji: '💡' },
      { score: 3, label: 'Mild lingering mental chatter', emoji: '🧠' },
      { score: 4, label: 'Fatigued but still buzzing', emoji: '🌫️' },
      { score: 5, label: 'Severe mental exhaustion', emoji: '🌀' },
    ],
  },
  {
    id: 'e_body',
    category: 'physical_comfort',
    title: 'Physical Relaxation',
    question: 'How easily are your muscles letting go of daily tension?',
    isStressDimension: true,
    options: [
      { score: 1, label: 'Effortlessly melting into pillows', emoji: '🧘‍♀️' },
      { score: 2, label: 'Comfortable and relaxed', emoji: '😊' },
      { score: 3, label: 'Minor physical tightness', emoji: '👍' },
      { score: 4, label: 'Noticeable tension in jaw/neck/back', emoji: '😬' },
      { score: 5, label: 'Cramping, aches or severe soreness', emoji: '😣' },
    ],
  },
  {
    id: 'e_hydration',
    category: 'hydration',
    title: 'Hydration Recap',
    question: 'How do you feel about your hydration throughout today?',
    options: [
      { score: 5, label: 'Well-hydrated, body feels refreshed', emoji: '💧' },
      { score: 4, label: 'Drank plenty of water', emoji: '🥛' },
      { score: 3, label: 'A moderate amount', emoji: '🍵' },
      { score: 2, label: 'Slightly dehydrated', emoji: '☕' },
      { score: 1, label: 'Parched all day long', emoji: '🏜️' },
    ],
  },
  {
    id: 'e_activity',
    category: 'activity',
    title: 'Daily Movement Recap',
    question: 'How does your body feel about the physical activity you got today?',
    options: [
      { score: 5, label: 'Great — hit my activity targets', emoji: '🏃‍♀️' },
      { score: 4, label: 'Good healthy steps', emoji: '🚶‍♀️' },
      { score: 3, label: 'Adequate daily walking', emoji: '👍' },
      { score: 2, label: 'Could have moved a little more', emoji: '🪑' },
      { score: 1, label: 'Stationary all day, feeling stiff', emoji: '🛋️' },
    ],
  },
  {
    id: 'e_wellness',
    category: 'general_wellness',
    title: 'Gratitude for Effort',
    question: 'Can you honor the effort you showed up with today?',
    options: [
      { score: 5, label: 'Yes, proud and deeply appreciative', emoji: '🌟' },
      { score: 4, label: 'Did my best and that is enough', emoji: '👍' },
      { score: 3, label: 'Glad I got through it', emoji: '🌙' },
      { score: 2, label: 'Wish I got more done', emoji: '🤔' },
      { score: 1, label: 'Hard on myself tonight', emoji: '🌧️' },
    ],
  },
  {
    id: 'e_support',
    category: 'support',
    title: 'Evening Healing',
    question: 'What would feel most healing for you tonight?',
    options: [
      { score: 5, label: 'A warm magnesium bath or cozy tea', emoji: '🕯️' },
      { score: 4, label: 'Calming music and screen-free bedroom', emoji: '🎧' },
      { score: 3, label: 'Gentle spinal stretches on the rug', emoji: '🛁' },
      { score: 2, label: 'A soothing book or breathing exercise', emoji: '🍵' },
      { score: 1, label: 'Letting go of today\'s unfinished business', emoji: '🕊️' },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// MODE & CYCLE CUSTOMIZATION HELPERS (PCOS / Pregnancy / Cycle Adaptations)
// ─────────────────────────────────────────────────────────────────────────────

function adaptQuestionsForMode(
  questions: CheckinQuestion[],
  mode: WellnessMode,
  cyclePhase?: CyclePhase
): CheckinQuestion[] {
  return questions.map(q => {
    // 1. Cycle Phase Adaptations (for general & PCOS modes)
    if (cyclePhase && mode !== 'pregnancy') {
      if (cyclePhase === 'menstrual') {
        if (q.category === 'physical_comfort') {
          return {
            ...q,
            title: 'Pelvic & Cramp Comfort',
            question: 'How are your pelvic ease and menstrual cramps feeling right now?',
            options: [
              { score: 1, label: 'Cramp-free and comfortably light', emoji: '🧘‍♀️' },
              { score: 2, label: 'Mostly comfortable with mild warmth', emoji: '😊' },
              { score: 3, label: 'Noticeable lower belly ache or dull cramps', emoji: '👍' },
              { score: 4, label: 'Sharp or heavy cramps, taking it slow', emoji: '😬' },
              { score: 5, label: 'Intense cramping or debilitating pain', emoji: '😣' },
            ],
          };
        }
        if (q.category === 'support') {
          return {
            ...q,
            title: 'Menstrual Cycle Care',
            question: 'What soothing support would help your cycle most right now?',
            options: [
              { score: 5, label: 'Heating pad & gentle pelvic warmth', emoji: '☕' },
              { score: 4, label: 'Nourishing warm herbal tea & hydration', emoji: '🍵' },
              { score: 3, label: 'Quiet restorative lying-down rest', emoji: '🛌' },
              { score: 2, label: 'Gentle reclining stretch & slow breathing', emoji: '🧘' },
              { score: 1, label: 'Releasing all pressure and expectations', emoji: '🕊️' },
            ],
          };
        }
      } else if (cyclePhase === 'luteal') {
        if (q.category === 'physical_comfort') {
          return {
            ...q,
            title: 'Luteal Body Comfort',
            question: 'Are you experiencing any premenstrual tenderness, bloating, or fatigue?',
            options: [
              { score: 1, label: 'Light and balanced, zero bloating', emoji: '🧘‍♀️' },
              { score: 2, label: 'Mild water retention, feeling okay', emoji: '😊' },
              { score: 3, label: 'Noticeable bloating or breast tenderness', emoji: '👍' },
              { score: 4, label: 'Heavy bloat and low physical energy', emoji: '😬' },
              { score: 5, label: 'Significant premenstrual discomfort', emoji: '😣' },
            ],
          };
        }
        if (q.category === 'mood') {
          return {
            ...q,
            title: 'Luteal Emotional Space',
            question: 'How is your emotional patience and sensitivity holding up today?',
            options: [
              { score: 5, label: 'Grounded, patient, and serene', emoji: '🌸' },
              { score: 4, label: 'Balanced and steady', emoji: '🙂' },
              { score: 3, label: 'Slightly irritable or easily overstimulated', emoji: '😐' },
              { score: 2, label: 'Vulnerable, anxious, or tearful', emoji: '🌧️' },
              { score: 1, label: 'Deeply overwhelmed with PMS mood swings', emoji: '💔' },
            ],
          };
        }
      } else if (cyclePhase === 'ovulation') {
        if (q.category === 'energy') {
          return {
            ...q,
            title: 'Mid-Cycle Vitality',
            question: 'How is your mid-cycle ovulation stamina and vitality today?',
            options: [
              { score: 5, label: 'Peak vitality, sharp and magnetic', emoji: '⚡' },
              { score: 4, label: 'High stamina and upbeat pace', emoji: '✨' },
              { score: 3, label: 'Steady and comfortable', emoji: '☕' },
              { score: 2, label: 'Mild mid-cycle twinge or dip', emoji: '🔋' },
              { score: 1, label: 'Unusually low energy', emoji: '🪫' },
            ],
          };
        }
      } else if (cyclePhase === 'follicular') {
        if (q.category === 'focus') {
          return {
            ...q,
            title: 'Follicular Mental Drive',
            question: 'How is your motivation and creative focus feeling today?',
            options: [
              { score: 1, label: 'Inspired, proactive, and razor sharp', emoji: '🎯' },
              { score: 2, label: 'Clear and motivated', emoji: '💡' },
              { score: 3, label: 'Steady and focused', emoji: '🧠' },
              { score: 4, label: 'A bit slow to start', emoji: '🌫️' },
              { score: 5, label: 'Mentally stalled or foggy', emoji: '🌀' },
            ],
          };
        }
      }
    }

    // 2. Mode-Specific Adaptations for PCOS
    if (mode === 'pcos') {
      if (q.category === 'physical_comfort' && (!cyclePhase || cyclePhase !== 'menstrual')) {
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
      if (q.category === 'support' && (!cyclePhase || cyclePhase !== 'menstrual')) {
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
    }

    // 3. Mode-Specific Adaptations for Pregnancy
    if (mode === 'pregnancy') {
      if (q.category === 'physical_comfort') {
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
      if (q.category === 'support') {
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
// PUBLIC API: GET 10 QUESTIONS PER SLOT (WITH ROTATION & CYCLE AWARENESS)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the exact 10 MCQ question set for a given slot and wellness mode.
 * Supports optional date-based rotation and menstrual cycle phase adaptations.
 * When called without options, it defaults to rotation index 0 for 100% backward compatibility.
 */
export function getCheckinQuestions(
  slot: CheckinSlot,
  mode: WellnessMode = 'general',
  options?: CheckinQuestionOptions
): CheckinQuestion[] {
  let rotationIndex = 0;
  if (options?.rotation !== undefined) {
    rotationIndex = options.rotation % 3;
  } else if (options?.dateStr) {
    rotationIndex = getRotationIndex(options.dateStr);
  }

  let base: CheckinQuestion[];
  if (slot === 'morning') {
    base = rotationIndex === 1 ? MORNING_V1 : rotationIndex === 2 ? MORNING_V2 : MORNING_BASE_QUESTIONS;
  } else if (slot === 'afternoon') {
    base = rotationIndex === 1 ? AFTERNOON_V1 : rotationIndex === 2 ? AFTERNOON_V2 : AFTERNOON_BASE_QUESTIONS;
  } else {
    base = rotationIndex === 1 ? EVENING_V1 : rotationIndex === 2 ? EVENING_V2 : EVENING_BASE_QUESTIONS;
  }

  return adaptQuestionsForMode(base, mode, options?.cyclePhase);
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
