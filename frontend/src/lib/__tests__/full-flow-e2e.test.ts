import { describe, it, expect } from 'vitest';
import {
  getCheckinQuestions,
  calculateCheckinIndicators,
  type CheckinSlot,
  type WellnessMode,
} from '../questions/checkin-questions';
import { WellnessPlanService } from '../services/wellness-plan-service';

// Mock Supabase client to test WellnessPlanService and data flow end-to-end
function createMockSupabase() {
  const db: Record<string, any[]> = {
    daily_checkins: [],
    wellness_plans: [],
    wellness_streaks: [],
    checkin_slots: [],
    mood_logs: [],
    sleep_logs: [],
    water_logs: [],
    exercise_logs: [],
    profiles: [{ id: 'user-123', active_theme: 'general', username: 'TestUser' }],
    user_coin_balances: [{ user_id: 'user-123', balance: 0 }],
    user_coin_transactions: [],
  };

  const client: any = {
    from: (table: string) => {
      let currentData = [...(db[table] || [])];
      let filters: { col: string; val: any; op?: string }[] = [];
      let orderBy: { col: string; ascending: boolean } | null = null;
      let limitCount: number | null = null;

      const builder: any = {
        select: (cols = '*', opts?: any) => {
          return builder;
        },
        eq: (col: string, val: any) => {
          filters.push({ col, val, op: 'eq' });
          return builder;
        },
        match: (matchObj: Record<string, any>) => {
          Object.entries(matchObj).forEach(([k, v]) => {
            filters.push({ col: k, val: v, op: 'eq' });
          });
          return builder;
        },
        order: (col: string, { ascending = true } = {}) => {
          orderBy = { col, ascending };
          return builder;
        },
        limit: (n: number) => {
          limitCount = n;
          return builder;
        },
        maybeSingle: async () => {
          let rows = db[table] || [];
          for (const f of filters) {
            rows = rows.filter((r: any) => r[f.col] === f.val);
          }
          return { data: rows[0] || null, error: null };
        },
        insert: (payload: any) => {
          const toInsert = Array.isArray(payload) ? payload : [payload];
          const inserted = toInsert.map((item, idx) => ({
            id: item.id || `id-${Date.now()}-${idx}-${Math.random()}`,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            ...item,
          }));
          if (!db[table]) db[table] = [];
          db[table].push(...inserted);
          const result = {
            data: Array.isArray(payload) ? inserted : inserted[0],
            error: null,
            select: () => ({
              maybeSingle: async () => ({ data: inserted[0], error: null }),
              then: (resolve: any) => resolve({ data: inserted, error: null }),
            }),
          };
          return {
            ...result,
            then: (resolve: any) => resolve(result),
          };
        },
        update: (payload: any) => {
          return {
            eq: async (col: string, val: any) => {
              let count = 0;
              db[table] = (db[table] || []).map((r: any) => {
                if (r[col] === val) {
                  count++;
                  return { ...r, ...payload, updated_at: new Date().toISOString() };
                }
                return r;
              });
              return { data: null, error: null };
            },
            match: async (matchObj: Record<string, any>) => {
              db[table] = (db[table] || []).map((r: any) => {
                const matches = Object.entries(matchObj).every(([k, v]) => r[k] === v);
                if (matches) {
                  return { ...r, ...payload, updated_at: new Date().toISOString() };
                }
                return r;
              });
              return { data: null, error: null };
            }
          };
        },
        upsert: async (payload: any) => {
          const item = {
            id: payload.id || `id-${Date.now()}`,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            ...payload,
          };
          if (!db[table]) db[table] = [];
          const idx = db[table].findIndex((r: any) => r.user_id === payload.user_id);
          if (idx >= 0) {
            db[table][idx] = { ...db[table][idx], ...item };
          } else {
            db[table].push(item);
          }
          return { data: item, error: null };
        },
        then: (resolve: any) => {
          let rows = db[table] || [];
          for (const f of filters) {
            rows = rows.filter((r: any) => r[f.col] === f.val);
          }
          if (limitCount !== null) {
            rows = rows.slice(0, limitCount);
          }
          resolve({ data: rows, error: null, count: rows.length });
        }
      };

      return builder;
    },
    getDb: () => db,
  };

  return client;
}

describe('SVANEXA AI — End-to-End Daily Check-In & Wellness Plan Flow Test Matrix', () => {
  const userId = 'user-123';
  const todayStr = '2026-08-16';
  const tomorrowStr = '2026-08-17';

  it('Stage 1 (08:00 Morning): 10 MCQs, Reflection save, Indicators calculation, Morning Plan Generation & Task Toggle', async () => {
    const supabase = createMockSupabase();
    const service = new WellnessPlanService(supabase);

    // 1. Fetch 10 morning questions
    const morningQuestions = getCheckinQuestions('morning', 'general');
    expect(morningQuestions.length).toBe(10);

    // 2. Answer all 10 questions with positive / calm responses
    const morningAnswers: Record<string, number> = {};
    morningQuestions.forEach((q) => {
      if (q.isStressDimension) {
        morningAnswers[q.id] = 1; // 1 = calm & relaxed
      } else {
        morningAnswers[q.id] = 5; // 5 = high vitality & great sleep
      }
    });
    expect(Object.keys(morningAnswers).length).toBe(10);

    // 3. Compute indicators & add reflection note
    const indicators = calculateCheckinIndicators(morningAnswers, morningQuestions);
    expect(indicators.wellnessScore).toBeGreaterThanOrEqual(70);
    expect(indicators.mood.state).toBe('Positive');
    expect(indicators.energy.level).toBe('High');

    const reflectionText = 'Feeling rested and ready to accomplish today with clarity!';

    // 4. Save morning check-in into daily_checkins
    const summaryPayload = {
      morning: {
        completed: true,
        completedAt: '2026-08-16T08:05:00.000Z',
        data: {
          answers: morningAnswers,
          indicators,
          reflection: reflectionText,
          note: reflectionText,
        },
        claimed: false,
      }
    };

    await supabase.from('daily_checkins').insert({
      user_id: userId,
      date: todayStr,
      summary: JSON.stringify(summaryPayload),
    });

    // 5. Generate Morning Wellness Plan
    const result = await service.getDailyWellnessPlan(userId, todayStr, 'general', 'morning', true);
    expect(result.hasData).toBe(true);
    expect(result.plan).toBeDefined();
    expect(result.plan?.planDate).toBe(todayStr);

    const morningTasks = result.plan?.tasks || [];
    expect(morningTasks.length).toBeGreaterThanOrEqual(3);
    expect(morningTasks.every(t => t.timeSlot === 'morning')).toBe(true);
    expect(morningTasks.some(t => t.category === 'hydration')).toBe(true);

    // 6. Toggle a task to completed
    const firstTask = morningTasks[0];
    const toggleRes = await service.toggleTask(userId, result.plan!.id, firstTask.id, todayStr, 'completed');
    expect(toggleRes.success).toBe(true);
    expect(toggleRes.tasks.find(t => t.id === firstTask.id)?.completed).toBe(true);
    expect(toggleRes.wellnessScore).toBeGreaterThan(0);
  });

  it('Stage 2 (14:00 Afternoon): Afternoon Check-in with distinct questions & Afternoon Plan tasks', async () => {
    const supabase = createMockSupabase();
    const service = new WellnessPlanService(supabase);

    // Pre-populate morning completion
    const initialSummary = {
      morning: {
        completed: true,
        completedAt: '2026-08-16T08:05:00.000Z',
        data: { answers: { m_sleep: 4 }, indicators: { wellnessScore: 80 } },
        claimed: true,
      }
    };
    await supabase.from('daily_checkins').insert({
      user_id: userId,
      date: todayStr,
      summary: JSON.stringify(initialSummary),
    });

    // 1. Fetch afternoon questions (distinct from morning)
    const afternoonQuestions = getCheckinQuestions('afternoon', 'general');
    expect(afternoonQuestions.length).toBe(10);
    expect(afternoonQuestions[0].id).toBe('a_rest');

    // 2. Answer all 10 afternoon questions
    const afternoonAnswers: Record<string, number> = {};
    afternoonQuestions.forEach((q) => {
      afternoonAnswers[q.id] = 3;
    });

    const afternoonIndicators = calculateCheckinIndicators(afternoonAnswers, afternoonQuestions);
    const afternoonReflection = 'Midday break taken, staying hydrated.';

    // 3. Update daily_checkins summary
    const updatedSummary = {
      ...initialSummary,
      afternoon: {
        completed: true,
        completedAt: '2026-08-16T14:15:00.000Z',
        data: {
          answers: afternoonAnswers,
          indicators: afternoonIndicators,
          reflection: afternoonReflection,
        },
        claimed: false,
      }
    };
    await supabase.from('daily_checkins').update({ summary: JSON.stringify(updatedSummary) }).eq('user_id', userId);

    // 4. Generate Afternoon Plan
    const result = await service.getDailyWellnessPlan(userId, todayStr, 'general', 'afternoon', false);
    expect(result.hasData).toBe(true);
    const afternoonTasks = result.plan?.tasks.filter(t => t.timeSlot === 'afternoon') || [];
    expect(afternoonTasks.length).toBeGreaterThanOrEqual(3);
    expect(afternoonTasks.every(t => t.timeSlot === 'afternoon')).toBe(true);
  });

  it('Stage 3 (20:00 Evening): Evening Check-in & All 3 periods complete', async () => {
    const supabase = createMockSupabase();
    const service = new WellnessPlanService(supabase);

    const fullDaySummary = {
      morning: { completed: true, completedAt: '2026-08-16T08:00:00Z', claimed: true },
      afternoon: { completed: true, completedAt: '2026-08-16T14:00:00Z', claimed: true },
      evening: {
        completed: true,
        completedAt: '2026-08-16T20:30:00Z',
        data: {
          answers: { e_sleep: 5, e_energy: 4 },
          reflection: 'Grateful for a balanced and productive day.',
        },
        claimed: false,
      }
    };

    await supabase.from('daily_checkins').insert({
      user_id: userId,
      date: todayStr,
      summary: JSON.stringify(fullDaySummary),
    });

    // Generate full day plan
    const result = await service.getDailyWellnessPlan(userId, todayStr, 'general', 'evening', false);
    expect(result.hasData).toBe(true);

    const eveningTasks = result.plan?.tasks.filter(t => t.timeSlot === 'evening') || [];
    expect(eveningTasks.length).toBeGreaterThanOrEqual(3);
    expect(eveningTasks.some(t => t.category === 'sleep')).toBe(true);
  });

  it('Stage 4 (Next Day Transition): Tomorrow has a fresh check-in and does NOT show yesterday plan as today', async () => {
    const supabase = createMockSupabase();
    const service = new WellnessPlanService(supabase);

    // Populate yesterday's plan (2026-08-16)
    await supabase.from('wellness_plans').insert({
      user_id: userId,
      title: todayStr, // yesterday
      content: JSON.stringify([{ id: 'task-yesterday', text: 'Yesterday task', timeSlot: 'morning' }]),
    });

    // Query tomorrow (2026-08-17) when user hasn't checked in yet
    const tomorrowResult = await service.getDailyWellnessPlan(userId, tomorrowStr, 'general');
    
    // Must NOT return yesterday's plan!
    expect(tomorrowResult.hasData).toBe(false);
    expect(tomorrowResult.plan).toBeNull();
    expect(tomorrowResult.message).toContain('No Check-in logged today yet');
  });

  it('Stage 5 (Validation & Error Resilience): Blocks empty answers and ensures non-diagnostic guidance', () => {
    const questions = getCheckinQuestions('morning', 'general');
    
    // Calculates safe fallback even if empty answers object provided
    const indicators = calculateCheckinIndicators({}, questions);
    expect(indicators.wellnessScore).toBeGreaterThanOrEqual(0);
    expect(indicators.wellnessScore).toBeLessThanOrEqual(100);
    expect(indicators.stress.label).not.toMatch(/diagnos|illness|disease|medication/i);
  });
});
