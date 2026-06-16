export interface WellnessTask {
  id: string;
  text: string;
  category: 'sleep' | 'stress' | 'mood' | 'cycle' | 'symptoms' | 'skin' | 'hydration' | 'exercise';
  completed: boolean;
  completedAt: string | null;
}

export interface WellnessPlan {
  id: string;
  userId: string;
  planDate: string;
  tasks: WellnessTask[];
  createdAt: string;
  updatedAt: string;
}

export interface PremiumStreak {
  userId: string;
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WellnessPlanState {
  hasData: boolean;
  plan: WellnessPlan | null;
  streak: PremiumStreak | null;
  message?: string;
}
