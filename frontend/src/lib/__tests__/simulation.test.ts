import { describe, it, expect } from 'vitest';
import {
  getCheckinQuestions,
  calculateCheckinIndicators,
  getStressInterpretation,
  getRotationIndex,
  type CheckinSlot,
  type CyclePhase,
  type WellnessMode,
} from '../questions/checkin-questions';
import { WellnessPlanService } from '../services/wellness-plan-service';

describe('Live Simulation & Verification Tests', () => {
  it('Simulates 7 consecutive days of question rotation and verifies diversity', () => {
    const dates = [
      '2026-09-07', // Day 1
      '2026-09-08', // Day 2
      '2026-09-09', // Day 3
      '2026-09-10', // Day 4 (rotates back to V0)
      '2026-09-11', // Day 5 (V1)
      '2026-09-12', // Day 6 (V2)
      '2026-09-13', // Day 7 (V0)
    ];

    const slots: CheckinSlot[] = ['morning', 'afternoon', 'evening'];

    console.log('\n--- 7-DAY ROTATION SIMULATION ---');
    for (const slot of slots) {
      console.log(`\nSlot: [${slot.toUpperCase()}]`);
      const dailyQuestions: string[][] = [];

      dates.forEach((d, idx) => {
        const questions = getCheckinQuestions(slot, 'general', { dateStr: d });
        expect(questions.length).toBe(10);
        dailyQuestions.push(questions.map(q => q.question));
        console.log(`  Date ${d} (Day ${idx + 1}, Rot ${getRotationIndex(d)}): "${questions[0].question}"`);
      });

      // Day 1 vs Day 2 must be different
      expect(dailyQuestions[0][0]).not.toBe(dailyQuestions[1][0]);
      // Day 2 vs Day 3 must be different
      expect(dailyQuestions[1][0]).not.toBe(dailyQuestions[2][0]);
      // Day 1 and Day 4 (offset 3) match cycle
      expect(dailyQuestions[0][0]).toBe(dailyQuestions[3][0]);
    }
  });

  it('Simulates all 4 menstrual cycle phases and verifies custom tailored questions', () => {
    const phases: CyclePhase[] = ['menstrual', 'follicular', 'ovulation', 'luteal'];

    console.log('\n--- MENSTRUAL CYCLE PHASE ADAPTATION SIMULATION ---');
    for (const phase of phases) {
      const questions = getCheckinQuestions('morning', 'general', { cyclePhase: phase });
      expect(questions.length).toBe(10);

      if (phase === 'menstrual') {
        const bodyQ = questions.find(q => q.id === 'm_body');
        const supportQ = questions.find(q => q.id === 'm_support');
        console.log(`  [MENSTRUAL] Body: "${bodyQ?.title}" -> ${bodyQ?.question}`);
        console.log(`  [MENSTRUAL] Support: "${supportQ?.title}" -> ${supportQ?.question}`);
        expect(bodyQ?.title).toBe('Pelvic & Cramp Comfort');
        expect(supportQ?.question.toLowerCase()).toContain('cycle');
      } else if (phase === 'follicular') {
        const focusQ = questions.find(q => q.id === 'm_focus');
        console.log(`  [FOLLICULAR] Focus: "${focusQ?.title}" -> ${focusQ?.question}`);
        expect(focusQ?.title).toBe('Follicular Mental Drive');
      } else if (phase === 'ovulation') {
        const energyQ = questions.find(q => q.id === 'm_energy');
        console.log(`  [OVULATION] Energy: "${energyQ?.title}" -> ${energyQ?.question}`);
        expect(energyQ?.title).toBe('Mid-Cycle Vitality');
      } else if (phase === 'luteal') {
        const bodyQ = questions.find(q => q.id === 'm_body');
        const moodQ = questions.find(q => q.id === 'm_mood');
        console.log(`  [LUTEAL] Body: "${bodyQ?.title}" -> ${bodyQ?.question}`);
        console.log(`  [LUTEAL] Mood: "${moodQ?.title}" -> ${moodQ?.question}`);
        expect(bodyQ?.title).toBe('Luteal Body Comfort');
        expect(moodQ?.title).toBe('Luteal Emotional Space');
      }
    }
  });

  it('Simulates PCOS and Pregnancy Health Modes', () => {
    console.log('\n--- HEALTH MODES SIMULATION ---');
    const pcosQs = getCheckinQuestions('morning', 'pcos');
    const pcosBody = pcosQs.find(q => q.id === 'm_body');
    const pcosSupport = pcosQs.find(q => q.id === 'm_support');
    console.log(`  [PCOS] Body: "${pcosBody?.title}" -> ${pcosBody?.question}`);
    console.log(`  [PCOS] Support option: "${pcosSupport?.options[0].label}"`);
    expect(pcosBody?.title).toBe('Body & Cycle Comfort');
    expect(pcosSupport?.options[0].label.toLowerCase()).toContain('insulin');

    const pregQs = getCheckinQuestions('morning', 'pregnancy');
    const pregBody = pregQs.find(q => q.id === 'm_body');
    const pregSupport = pregQs.find(q => q.id === 'm_support');
    console.log(`  [PREGNANCY] Body: "${pregBody?.title}" -> ${pregBody?.question}`);
    console.log(`  [PREGNANCY] Support: "${pregSupport?.title}" -> ${pregSupport?.question}`);
    expect(pregBody?.title).toBe('Maternal Comfort');
    expect(pregSupport?.title).toBe('Maternal Support');
  });

  it('Simulates indicators and scoring calculation across diverse response profiles', () => {
    console.log('\n--- WELLNESS SCORING & INDICATORS SIMULATION ---');
    const morningQs = getCheckinQuestions('morning', 'general', { rotation: 1 });

    // Profile A: High Vitality & Low Stress
    const answersA = {
      m_sleep: 5, m_energy: 5, m_mood: 5,
      m_stress: 1, m_focus: 1, m_body: 1,
      m_hydration: 5, m_activity: 5, m_wellness: 5, m_support: 5,
    };
    const indA = calculateCheckinIndicators(answersA, morningQs);
    console.log(`  Profile A (Optimal): Score=${indA.wellnessScore}/100, Stress=${indA.stress.score} (${indA.stress.level}), Mood=${indA.mood.state}`);
    expect(indA.wellnessScore).toBe(100);
    expect(indA.stress.score).toBe(1);
    expect(indA.stress.level).toBe('Calm & Balanced');

    // Profile B: High Stress & Fatigue
    const answersB = {
      m_sleep: 1, m_energy: 1, m_mood: 1,
      m_stress: 5, m_focus: 5, m_body: 5,
      m_hydration: 1, m_activity: 1, m_wellness: 1, m_support: 1,
    };
    const indB = calculateCheckinIndicators(answersB, morningQs);
    console.log(`  Profile B (Fatigued): Score=${indB.wellnessScore}/100, Stress=${indB.stress.score} (${indB.stress.level}), Mood=${indB.mood.state}`);
    expect(indB.wellnessScore).toBe(10);
    expect(indB.stress.score).toBe(5);
    expect(indB.stress.level).toBe('Elevated Pressure');
  });

  it('Simulates repeated task swapping and verifies no duplicate tasks appear', async () => {
    console.log('\n--- TASK SWAPPING (REROLL) SIMULATION ---');
    const service = new WellnessPlanService(null as any);
    const morningPool = service.getAllRuleTasksForSlot('morning', 'general');
    console.log(`  Total Morning Science-Backed Tasks Available: ${morningPool.length}`);
    expect(morningPool.length).toBeGreaterThanOrEqual(8);

    // Initial plan with 3 morning tasks
    let currentTasks = [
      {
        id: 't-1',
        text: morningPool[0].text,
        category: morningPool[0].category,
        timeSlot: 'morning',
        priority: 'high',
        status: 'pending',
        completed: false,
        completedAt: null,
      },
      {
        id: 't-2',
        text: morningPool[1].text,
        category: morningPool[1].category,
        timeSlot: 'morning',
        priority: 'recommended',
        status: 'pending',
        completed: false,
        completedAt: null,
      },
      {
        id: 't-3',
        text: morningPool[2].text,
        category: morningPool[2].category,
        timeSlot: 'morning',
        priority: 'recommended',
        status: 'pending',
        completed: false,
        completedAt: null,
      },
    ];

    console.log('  Initial Active Plan Tasks:');
    currentTasks.forEach(t => console.log(`    - [${t.category}] ${t.text}`));

    // Mock database wrapper that holds our plan in memory
    const mockPlanData = {
      id: 'plan-sim-001',
      user_id: 'user-sim-1',
      title: '2026-09-07',
      wellness_mode: 'general',
      created_at: new Date().toISOString(),
      content: JSON.stringify(currentTasks),
    };

    const createBuilder = () => {
      const b: any = {
        eq: () => b,
        order: () => b,
        maybeSingle: async () => ({ data: mockPlanData, error: null }),
        limit: async () => ({ data: [mockPlanData], error: null }),
      };
      return b;
    };

    const mockDb = {
      from: () => ({
        select: () => createBuilder(),
        update: (payload: any) => {
          mockPlanData.content = payload.content;
          currentTasks = JSON.parse(payload.content);
          return { eq: async () => ({ data: null, error: null }) };
        },
      }),
    };

    const testService = new WellnessPlanService(mockDb as any);

    // Swap task 1 three consecutive times
    for (let swapRound = 1; swapRound <= 3; swapRound++) {
      const oldText = currentTasks[0].text;
      const res = await testService.swapTask('user-sim-1', 'plan-sim-001', currentTasks[0].id, '2026-09-07', 'general');

      expect(res.success).toBe(true);
      expect(res.task.text).not.toBe(oldText);

      // Verify no duplicates in the entire plan
      const uniqueTexts = new Set(res.tasks.map((t: any) => t.text.toLowerCase()));
      expect(uniqueTexts.size).toBe(res.tasks.length);

      console.log(`  Swap Round ${swapRound}:`);
      console.log(`    Swapped out: "${oldText.substring(0, 50)}..."`);
      console.log(`    Replaced by: "${res.task.text.substring(0, 50)}..."`);
    }

    console.log('  Final Plan Tasks after 3 Swaps:');
    currentTasks.forEach(t => console.log(`    - [${t.category}] ${t.text}`));
  });
});
