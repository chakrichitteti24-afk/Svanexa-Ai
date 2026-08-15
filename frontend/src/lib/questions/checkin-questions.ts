/**
 * SVANEXA AI — Daily Check-In Question Engine
 *
 * This is the single source of truth for all check-in questions.
 * Each slot (morning / afternoon / evening) has:
 *   - 4 stress-dimension questions (same model, time-of-day phrasing)
 *   - Optional slot-specific wellness questions
 *
 * Mode personalization is applied at the option / label level.
 */

export type WellnessMode = 'general' | 'pcos' | 'pregnancy';
export type CheckinSlot = 'morning' | 'afternoon' | 'evening';

export type QuestionOption = {
  score: number;
  label: string;
  emoji: string;
};

export type CheckinQuestion = {
  id: string;
  dimension: 'q1_feeling' | 'q2_focus' | 'q3_body' | 'q4_thoughts' | 'sleep' | 'hydration' | 'activity' | 'support';
  title: string;
  question: string;
  options: QuestionOption[];
  isStressDimension: boolean; // true → counted in stress indicator calc
};

// ─────────────────────────────────────────────────────────────────────────────
// MORNING STRESS QUESTIONS (same 4 dimensions, morning phrasing)
// ─────────────────────────────────────────────────────────────────────────────
const MORNING_STRESS_QUESTIONS: CheckinQuestion[] = [
  {
    id: 'q1_feeling',
    dimension: 'q1_feeling',
    title: 'Morning Mood',
    question: 'How are you feeling as you start the day?',
    isStressDimension: true,
    options: [
      { score: 1, label: 'Calm and refreshed', emoji: '😌' },
      { score: 2, label: 'Mostly relaxed', emoji: '🙂' },
      { score: 3, label: 'Neutral, just waking up', emoji: '😐' },
      { score: 4, label: 'A little tense', emoji: '😰' },
      { score: 5, label: 'Already overwhelmed', emoji: '😫' },
    ],
  },
  {
    id: 'q2_focus',
    dimension: 'q2_focus',
    title: 'Morning Focus',
    question: 'How easy is it to get focused this morning?',
    isStressDimension: true,
    options: [
      { score: 1, label: 'Very clear-headed', emoji: '🎯' },
      { score: 2, label: 'Pretty sharp', emoji: '✨' },
      { score: 3, label: 'Okay, warming up', emoji: '👌' },
      { score: 4, label: 'Foggy and scattered', emoji: '🧠' },
      { score: 5, label: 'Can\'t focus at all', emoji: '🌀' },
    ],
  },
  {
    id: 'q3_body',
    dimension: 'q3_body',
    title: 'Body Comfort',
    question: 'How does your body feel this morning?',
    isStressDimension: true,
    options: [
      { score: 1, label: 'Well-rested and loose', emoji: '🧘‍♀️' },
      { score: 2, label: 'Mostly comfortable', emoji: '😊' },
      { score: 3, label: 'A bit stiff, getting there', emoji: '👍' },
      { score: 4, label: 'Tense or achy', emoji: '😬' },
      { score: 5, label: 'Very tight or restless', emoji: '😣' },
    ],
  },
  {
    id: 'q4_thoughts',
    dimension: 'q4_thoughts',
    title: 'Mental Load',
    question: 'Are you waking up with thoughts or worries on your mind?',
    isStressDimension: true,
    options: [
      { score: 1, label: 'Mind is calm and clear', emoji: '🍃' },
      { score: 2, label: 'A few small things', emoji: '🌤️' },
      { score: 3, label: 'Some things on my mind', emoji: '💭' },
      { score: 4, label: 'Quite a few worries', emoji: '🌪️' },
      { score: 5, label: 'Racing thoughts', emoji: '⛈️' },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// AFTERNOON STRESS QUESTIONS (same 4 dimensions, midday phrasing)
// ─────────────────────────────────────────────────────────────────────────────
const AFTERNOON_STRESS_QUESTIONS: CheckinQuestion[] = [
  {
    id: 'q1_feeling',
    dimension: 'q1_feeling',
    title: 'Midday Mood',
    question: 'How are you feeling in the middle of the day?',
    isStressDimension: true,
    options: [
      { score: 1, label: 'Calm and balanced', emoji: '😌' },
      { score: 2, label: 'Mostly steady', emoji: '🙂' },
      { score: 3, label: 'Managing okay', emoji: '😐' },
      { score: 4, label: 'Feeling the pressure', emoji: '😰' },
      { score: 5, label: 'Overwhelmed by midday', emoji: '😫' },
    ],
  },
  {
    id: 'q2_focus',
    dimension: 'q2_focus',
    title: 'Afternoon Focus',
    question: 'How well have you been able to focus so far today?',
    isStressDimension: true,
    options: [
      { score: 1, label: 'Very focused all day', emoji: '🎯' },
      { score: 2, label: 'Mostly on track', emoji: '✨' },
      { score: 3, label: 'Some distractions', emoji: '👌' },
      { score: 4, label: 'Hard to concentrate', emoji: '🧠' },
      { score: 5, label: 'Completely scattered', emoji: '🌀' },
    ],
  },
  {
    id: 'q3_body',
    dimension: 'q3_body',
    title: 'Physical Energy',
    question: 'How is your body holding up through the day?',
    isStressDimension: true,
    options: [
      { score: 1, label: 'Energetic and comfortable', emoji: '🧘‍♀️' },
      { score: 2, label: 'Feeling fine', emoji: '😊' },
      { score: 3, label: 'A little tired', emoji: '👍' },
      { score: 4, label: 'Tense, stiff or sore', emoji: '😬' },
      { score: 5, label: 'Exhausted or very tense', emoji: '😣' },
    ],
  },
  {
    id: 'q4_thoughts',
    dimension: 'q4_thoughts',
    title: 'Mental Pressure',
    question: 'How much have your thoughts been weighing on you today?',
    isStressDimension: true,
    options: [
      { score: 1, label: 'Not at all — clear mind', emoji: '🍃' },
      { score: 2, label: 'Barely noticeable', emoji: '🌤️' },
      { score: 3, label: 'A moderate amount', emoji: '💭' },
      { score: 4, label: 'Quite a bit', emoji: '🌪️' },
      { score: 5, label: 'Overwhelmingly heavy', emoji: '⛈️' },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// EVENING STRESS QUESTIONS (same 4 dimensions, end-of-day phrasing)
// ─────────────────────────────────────────────────────────────────────────────
const EVENING_STRESS_QUESTIONS: CheckinQuestion[] = [
  {
    id: 'q1_feeling',
    dimension: 'q1_feeling',
    title: 'End-of-Day Mood',
    question: 'How are you feeling as the day winds down?',
    isStressDimension: true,
    options: [
      { score: 1, label: 'At peace and relaxed', emoji: '😌' },
      { score: 2, label: 'Quietly content', emoji: '🙂' },
      { score: 3, label: 'Somewhere in between', emoji: '😐' },
      { score: 4, label: 'Still carrying tension', emoji: '😰' },
      { score: 5, label: 'Drained and overwhelmed', emoji: '😫' },
    ],
  },
  {
    id: 'q2_focus',
    dimension: 'q2_focus',
    title: 'Ability to Unwind',
    question: 'How difficult was it to focus or switch off today?',
    isStressDimension: true,
    options: [
      { score: 1, label: 'Easy — I can fully switch off', emoji: '🎯' },
      { score: 2, label: 'Mostly fine', emoji: '✨' },
      { score: 3, label: 'Some lingering thoughts', emoji: '👌' },
      { score: 4, label: 'Hard to let go', emoji: '🧠' },
      { score: 5, label: 'Mind won\'t stop running', emoji: '🌀' },
    ],
  },
  {
    id: 'q3_body',
    dimension: 'q3_body',
    title: 'Physical Tension',
    question: 'How has your body felt throughout the day?',
    isStressDimension: true,
    options: [
      { score: 1, label: 'Relaxed and comfortable', emoji: '🧘‍♀️' },
      { score: 2, label: 'Mostly okay', emoji: '😊' },
      { score: 3, label: 'Some tightness here and there', emoji: '👍' },
      { score: 4, label: 'Noticeably tense or sore', emoji: '😬' },
      { score: 5, label: 'Very tense or painful', emoji: '😣' },
    ],
  },
  {
    id: 'q4_thoughts',
    dimension: 'q4_thoughts',
    title: 'Closing Thoughts',
    question: 'How much have your thoughts been bothering you this evening?',
    isStressDimension: true,
    options: [
      { score: 1, label: 'Not at all — feeling settled', emoji: '🍃' },
      { score: 2, label: 'Just a little', emoji: '🌤️' },
      { score: 3, label: 'Somewhat active', emoji: '💭' },
      { score: 4, label: 'Quite a lot', emoji: '🌪️' },
      { score: 5, label: 'Very unsettled', emoji: '⛈️' },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// SLOT-SPECIFIC BONUS WELLNESS QUESTIONS (sleep, hydration, activity, support)
// ─────────────────────────────────────────────────────────────────────────────

function getSupportQuestion(slot: CheckinSlot, mode: WellnessMode): CheckinQuestion {
  const labelMap: Record<WellnessMode, string> = {
    general: slot === 'morning'
      ? 'What would help you feel more balanced today?'
      : slot === 'afternoon'
      ? 'What kind of support would help you through the rest of the day?'
      : 'What would help you feel more settled tonight?',
    pcos: slot === 'morning'
      ? 'What kind of support would feel most helpful for you today?'
      : slot === 'afternoon'
      ? 'What would help you feel steadier for the rest of today?'
      : 'What kind of care would feel most supportive this evening?',
    pregnancy: slot === 'morning'
      ? 'What would help you feel more comfortable today?'
      : slot === 'afternoon'
      ? 'What would help you and your baby feel more comfortable right now?'
      : 'What would help you rest and feel more at ease tonight?',
  };

  return {
    id: 'support',
    dimension: 'support',
    title: 'Support Needed',
    question: labelMap[mode],
    isStressDimension: false,
    options: [
      { score: 0, label: 'Gentle movement or stretching', emoji: '🚶‍♀️' },
      { score: 0, label: 'A quiet rest or break', emoji: '🛋️' },
      { score: 0, label: 'More hydration', emoji: '💧' },
      { score: 0, label: 'Some nourishing food', emoji: '🥗' },
      { score: 0, label: 'Just breathing and being present', emoji: '🌿' },
    ],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the full ordered question set for a given slot and mode.
 * Questions 1-4 are always the 4 stress dimensions (time-of-day phrased).
 * Question 5 is a mode-personalized support question.
 */
export function getCheckinQuestions(slot: CheckinSlot, mode: WellnessMode = 'general'): CheckinQuestion[] {
  const stressQuestions =
    slot === 'morning'
      ? MORNING_STRESS_QUESTIONS
      : slot === 'afternoon'
      ? AFTERNOON_STRESS_QUESTIONS
      : EVENING_STRESS_QUESTIONS;

  const supportQuestion = getSupportQuestion(slot, mode);

  return [...stressQuestions, supportQuestion];
}

/**
 * Returns ONLY the 4 stress-dimension questions for a given slot.
 */
export function getStressQuestions(slot: CheckinSlot): CheckinQuestion[] {
  return getCheckinQuestions(slot, 'general').filter(q => q.isStressDimension);
}

/**
 * Calculates the stress wellness indicator from 4 scored answers.
 * Returns null if not all 4 are answered.
 */
export function calculateStressScore(answers: Record<string, number>): number | null {
  const q1 = answers.q1_feeling ? Number(answers.q1_feeling) : 0;
  const q2 = answers.q2_focus ? Number(answers.q2_focus) : 0;
  const q3 = answers.q3_body ? Number(answers.q3_body) : 0;
  const q4 = answers.q4_thoughts ? Number(answers.q4_thoughts) : 0;

  if (q1 === 0 || q2 === 0 || q3 === 0 || q4 === 0) return null;
  return Number(((q1 + q2 + q3 + q4) / 4).toFixed(2));
}

export type StressInterpretation = {
  level: string;
  label: string;
  badgeColor: string;
  bgStyle: string;
};

/**
 * Returns non-diagnostic wellness copy for a given stress score.
 * IMPORTANT: Never say "You have high stress." Use interpretive, supportive language.
 */
export function getStressInterpretation(score: number | null): StressInterpretation {
  if (score === null) {
    return {
      level: 'Pending',
      label: '',
      badgeColor: 'text-muted-foreground',
      bgStyle: 'bg-secondary/40',
    };
  }
  if (score <= 2.0) {
    return {
      level: 'Low stress indicator',
      label: 'Your responses suggest you are feeling relaxed and balanced right now.',
      badgeColor: 'text-emerald-500 border-emerald-500/30 bg-emerald-500/10',
      bgStyle: 'from-emerald-500/10 to-teal-500/5',
    };
  }
  if (score <= 3.0) {
    return {
      level: 'Mild stress indicator',
      label: 'Your responses suggest mild stress levels today — you are doing okay.',
      badgeColor: 'text-blue-500 border-blue-500/30 bg-blue-500/10',
      bgStyle: 'from-blue-500/10 to-cyan-500/5',
    };
  }
  if (score <= 4.0) {
    return {
      level: 'Moderate stress indicator',
      label: 'Your responses suggest you may be feeling more stressed today. Small moments of rest can help.',
      badgeColor: 'text-amber-500 border-amber-500/30 bg-amber-500/10',
      bgStyle: 'from-amber-500/10 to-orange-500/5',
    };
  }
  return {
    level: 'Higher stress indicator',
    label: 'Your responses suggest higher stress levels right now. Be gentle with yourself today.',
    badgeColor: 'text-rose-500 border-rose-500/30 bg-rose-500/10',
    bgStyle: 'from-rose-500/10 to-pink-500/5',
  };
}
