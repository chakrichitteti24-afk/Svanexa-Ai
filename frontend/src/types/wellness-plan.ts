export type TaskCategory =
  | 'sleep'
  | 'stress'
  | 'mood'
  | 'cycle'
  | 'symptoms'
  | 'skin'
  | 'hydration'
  | 'exercise'
  | 'nutrition'
  | 'mindfulness'
  | 'pregnancy';

export type TaskTimeSlot = 'morning' | 'afternoon' | 'evening';
export type TaskPriority = 'high' | 'recommended' | 'optional';
export type TaskStatus = 'pending' | 'completed' | 'skipped';

export interface WellnessTask {
  id: string;
  text: string;
  category: TaskCategory;
  timeSlot: TaskTimeSlot;
  priority: TaskPriority;
  status: TaskStatus;
  estimatedTime?: string;
  rationale?: string;
  completed: boolean;
  completedAt: string | null;
}

export interface SlotGoalAndInsight {
  goal: string;
  insight: string;
}

export interface WellnessPlan {
  id: string;
  userId: string;
  planDate: string;
  tasks: WellnessTask[];
  slotGoals?: Record<TaskTimeSlot, string>;
  slotInsights?: Record<TaskTimeSlot, string>;
  wellnessScore: number;       // 0-100, computed from real data only
  aiInsight: string;           // AI Coach message (data-driven)
  wellnessMode: string;        // 'general' | 'pcos' | 'pregnancy'
  createdAt: string;
  updatedAt: string;
}

export interface PremiumStreak {
  userId: string;
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: string | null;
  weeklyConsistency: number;  // % of last 7 days with completed plans
  createdAt: string;
  updatedAt: string;
}

export interface WellnessPlanState {
  hasData: boolean;
  plan: WellnessPlan | null;
  streak: PremiumStreak | null;
  message?: string;
  logsCount?: number;
}
