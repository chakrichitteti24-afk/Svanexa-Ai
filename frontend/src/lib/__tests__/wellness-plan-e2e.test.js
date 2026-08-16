const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envConfig = fs.readFileSync(path.join(__dirname, '../../../.env.local'), 'utf8');
envConfig.split('\n').forEach((line) => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    process.env[match[1]] = value;
  }
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function runE2ETests() {
  console.log('====================================');
  console.log('SVANEXA AI — WELLNESS PLAN & CHECKIN AUDIT TEST SUITE');
  console.log('====================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName) {
    if (condition) {
      console.log(`✓ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`✗ FAIL: ${testName}`);
      failed++;
    }
  }

  // 1. Get or create test user
  const { data: profiles, error: pErr } = await supabase.from('profiles').select('id, active_theme').limit(1);
  if (pErr || !profiles || profiles.length === 0) {
    console.log('Skipping authenticated DB tests (no profile in DB yet).');
    return;
  }

  const userId = profiles[0].id;
  const todayStr = '2026-08-16';
  const yesterdayStr = '2026-08-15';

  console.log(`Testing with user_id: ${userId}`);

  // Test 1: Yesterday vs Today Separation
  console.log('\n--- TEST 1: Date Separation (Yesterday vs Today) ---');
  // Insert yesterday's plan
  const yesterdayTasks = [
    {
      id: `task-${yesterdayStr}-morning-hydration-test1`,
      userId,
      planDate: yesterdayStr,
      timeSlot: 'morning',
      text: "Drink 500ml water yesterday",
      category: 'hydration',
      status: 'completed',
      completed: true,
      completedAt: `${yesterdayStr}T08:00:00.000Z`
    }
  ];

  await supabase.from('wellness_plans').upsert({
    user_id: userId,
    title: yesterdayStr,
    content: JSON.stringify(yesterdayTasks),
    is_active: true
  }, { onConflict: 'user_id,title' });

  // Query today's plan
  const { data: todayPlan } = await supabase
    .from('wellness_plans')
    .select('*')
    .eq('user_id', userId)
    .eq('title', todayStr)
    .maybeSingle();

  // Query yesterday's plan
  const { data: yestPlan } = await supabase
    .from('wellness_plans')
    .select('*')
    .eq('user_id', userId)
    .eq('title', yesterdayStr)
    .maybeSingle();

  assert(yestPlan !== null, 'Yesterday plan exists separately in DB');
  assert(
    !todayPlan || todayPlan.title === todayStr,
    "Today's plan query strictly matches today's date and does not return yesterday's plan"
  );

  // Test 2: Check-in Slots Idempotency & Summary Structure
  console.log('\n--- TEST 2: Daily Check-in Save & Slot Meta ---');
  const mockSlotData = {
    answers: { m_sleep: 4, m_energy: 4, m_mood: 4, m_stress: 2 },
    indicators: {
      stress: { score: 2.0, level: 'Calm & Balanced', label: 'Relaxed' },
      mood: { state: 'Positive', label: 'Uplifting' },
      energy: { level: 'High', label: 'Energized' },
      wellnessScore: 85,
      sleepRating: 4,
      hydrationRating: 4,
    }
  };

  const summary = {
    morning: { completed: true, completedAt: new Date().toISOString(), data: mockSlotData, claimed: false }
  };

  const { error: checkinErr } = await supabase.from('daily_checkins').upsert({
    user_id: userId,
    date: todayStr,
    summary: JSON.stringify(summary)
  }, { onConflict: 'user_id,date' });

  assert(!checkinErr, 'Daily check-in saved successfully without error');

  // Test 3: Today's Wellness Plan Creation
  console.log('\n--- TEST 3: Wellness Plan Task Generation ---');
  const todayTasks = [
    {
      id: `task-${todayStr}-morning-hydration-test2`,
      userId,
      planDate: todayStr,
      timeSlot: 'morning',
      text: "Drink 500ml warm water upon waking",
      category: 'hydration',
      priority: 'high',
      status: 'pending',
      estimatedTime: '2 mins',
      rationale: 'Tailored to your morning check-in.',
      completed: false,
      completedAt: null
    },
    {
      id: `task-${todayStr}-morning-mindfulness-test3`,
      userId,
      planDate: todayStr,
      timeSlot: 'morning',
      text: "Take 5 deep breath cycles",
      category: 'mindfulness',
      priority: 'recommended',
      status: 'pending',
      estimatedTime: '3 mins',
      rationale: 'Oxygenates brain for morning energy.',
      completed: false,
      completedAt: null
    }
  ];

  await supabase.from('wellness_plans').upsert({
    user_id: userId,
    title: todayStr,
    content: JSON.stringify(todayTasks),
    is_active: true
  }, { onConflict: 'user_id,title' });

  const { data: savedPlan } = await supabase
    .from('wellness_plans')
    .select('*')
    .eq('user_id', userId)
    .eq('title', todayStr)
    .single();

  const parsedSavedTasks = JSON.parse(savedPlan.content);
  assert(parsedSavedTasks.length === 2, "Today's tasks correctly saved and retrieved");
  assert(parsedSavedTasks[0].timeSlot === 'morning', "Tasks have correct morning timeSlot");
  assert(parsedSavedTasks[0].planDate === todayStr, "Tasks are mapped to today's date");

  // Test 4: Task Completion & Persistence
  console.log('\n--- TEST 4: Task Toggle & Persistence ---');
  parsedSavedTasks[0].completed = true;
  parsedSavedTasks[0].status = 'completed';
  parsedSavedTasks[0].completedAt = new Date().toISOString();

  await supabase
    .from('wellness_plans')
    .update({ content: JSON.stringify(parsedSavedTasks) })
    .eq('id', savedPlan.id);

  const { data: refetchedPlan } = await supabase
    .from('wellness_plans')
    .select('*')
    .eq('id', savedPlan.id)
    .single();

  const refetchedTasks = JSON.parse(refetchedPlan.content);
  assert(refetchedTasks[0].completed === true, 'Task completed state persisted in Supabase');
  assert(refetchedTasks[0].status === 'completed', 'Task status is completed');
  assert(refetchedTasks[0].completedAt !== null, 'Task completion timestamp recorded');

  // Test 5: Streak table accessibility
  console.log('\n--- TEST 5: Wellness Streaks Table ---');
  const { data: streakRow, error: streakErr } = await supabase
    .from('wellness_streaks')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  assert(!streakErr, 'wellness_streaks table queried successfully without error');

  // Test 6: Skin logs table log_date column
  console.log('\n--- TEST 6: Skin Logs log_date Query ---');
  const { data: skinData, error: skinErr } = await supabase
    .from('skin_logs')
    .select('id, user_id, log_date')
    .eq('user_id', userId)
    .order('log_date', { ascending: false })
    .limit(3);

  assert(!skinErr, 'skin_logs queried with log_date successfully without error');

  console.log(`\n====================================`);
  console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log(`====================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runE2ETests();
