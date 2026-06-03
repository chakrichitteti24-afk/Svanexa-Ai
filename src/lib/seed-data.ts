import { CycleEntry, CheckInEntry } from './cycle-intelligence';
import { subDays } from 'date-fns';

export function getMockCycles(): CycleEntry[] {
  const today = new Date();
  return [
    {
      startDate: subDays(today, 28).toISOString(),
      endDate: subDays(today, 23).toISOString(),
      notes: 'Normal flow'
    },
    {
      startDate: subDays(today, 58).toISOString(), // 30 day cycle
      endDate: subDays(today, 52).toISOString(),
    },
    {
      startDate: subDays(today, 90).toISOString(), // 32 day cycle
      endDate: subDays(today, 85).toISOString(),
    },
    {
      startDate: subDays(today, 118).toISOString(), // 28 day cycle
      endDate: subDays(today, 114).toISOString(),
    },
    {
      startDate: subDays(today, 149).toISOString(), // 31 day cycle
      endDate: subDays(today, 144).toISOString(),
    }
  ];
}

export function getMockCheckIns(): Record<string, CheckInEntry> {
  const checkIns: Record<string, CheckInEntry> = {};
  const today = new Date();

  for (let i = 0; i < 30; i++) {
    const d = subDays(today, i).toISOString().split('T')[0];
    
    // Create some pattern - e.g. more stress/acne right before the period (around day 25-28 ago)
    const isPrePeriod = i >= 25 && i <= 28;
    
    checkIns[d] = {
      mood: isPrePeriod ? 'anxious' : (i % 3 === 0 ? 'calm' : 'happy'),
      sleep: isPrePeriod ? 5.5 : 7.5,
      water: 2.0,
      exercise: isPrePeriod ? 10 : 30,
      stress: isPrePeriod ? 8 : (i % 5 === 0 ? 6 : 3),
      acne: isPrePeriod ? 7 : 2,
      hairFall: 'none',
      bloating: isPrePeriod ? 'moderate' : 'none',
      fatigue: isPrePeriod ? 'moderate' : 'none',
      cramps: isPrePeriod ? 'severe' : 'none',
      notes: 'Mock generated data'
    };
  }

  return checkIns;
}

export function seedLocalStorage() {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem('hersync_cycles', JSON.stringify(getMockCycles()));
    window.localStorage.setItem('hersync_checkins', JSON.stringify(getMockCheckIns()));
    window.localStorage.setItem('hersync_has_pcos', JSON.stringify(true));
    // Trigger storage event so hooks update across tabs if needed, or just reload
    window.location.reload();
  }
}
