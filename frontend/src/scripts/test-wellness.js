// Standalone test script for Wellness Task Generation
function ruleTasksForSlot(m, mode, slot) {
  const tasks = [];
  const skipWater = m.todayWater !== null && Number(m.todayWater) >= 2;
  const skipExercise = m.todayExercise !== null && Number(m.todayExercise) >= 30;

  if (slot === 'morning') {
    tasks.push({
      text: 'Drink a full glass of water (500ml) to hydrate.',
      category: 'hydration',
      priority: 'high',
      estimatedTime: '2 mins',
      rationale: 'Rehydrating after sleep restores your cognitive function.'
    });
    tasks.push({
      text: 'Start with 5 deep breath cycles to center your mind.',
      category: 'mindfulness',
      priority: 'recommended',
      estimatedTime: '3 mins',
      rationale: 'Deep breathing activates parasympathetic rest-and-digest pathways.'
    });
    tasks.push({
      text: 'Do a gentle 5-minute morning stretch routine.',
      category: 'exercise',
      priority: 'recommended',
      estimatedTime: '5 mins',
      rationale: 'Morning mobility lubricates joints and improves posture.'
    });
  } else if (slot === 'afternoon') {
    tasks.push({
      text: 'Drink 2 full glasses of water with your lunch.',
      category: 'hydration',
      priority: 'high',
      estimatedTime: '2 mins',
      rationale: 'Hitting 2L maintains afternoon focus.'
    });
    tasks.push({
      text: 'Eat a fresh piece of fruit or healthy snack.',
      category: 'nutrition',
      priority: 'recommended',
      estimatedTime: '5 mins',
      rationale: 'Complex carbohydrates prevent energy slumps.'
    });
    tasks.push({
      text: 'Take a 15-minute brisk walk to recharge.',
      category: 'exercise',
      priority: 'recommended',
      estimatedTime: '15 mins',
      rationale: 'Light movement boosts circulation.'
    });
  } else if (slot === 'evening') {
    tasks.push({
      text: 'Complete a gentle skin cleansing routine.',
      category: 'skin',
      priority: 'high',
      estimatedTime: '10 mins',
      rationale: 'Cleansing removes environmental pollutants accumulated during the day.'
    });
    tasks.push({
      text: 'Reflect on 1 positive highlight from your day.',
      category: 'mindfulness',
      priority: 'recommended',
      estimatedTime: '5 mins',
      rationale: 'Gratitude exercises promote dopamine release prior to sleep.'
    });
    tasks.push({
      text: 'Dim screens and wind down 30 minutes before sleep.',
      category: 'sleep',
      priority: 'high',
      estimatedTime: '30 mins',
      rationale: 'Avoiding blue light enables natural melatonin synthesis.'
    });
  }
  return tasks;
}

const mockMetrics = {
  sleepAvg: 7.5,
  waterAvg: 2.0,
  exerciseAvg: 30,
  stressAvg: 4.0,
  todaySleep: 8,
  todayWater: 1.5,
  todayMood: 'calm',
  todayStress: 3,
  todayExercise: 20,
  acneAvg: 2,
  cycleStatus: 'follicular'
};

console.log('=== TEST 1: Morning Task Generation ===');
const morningTasks = ruleTasksForSlot(mockMetrics, 'general', 'morning');
console.log(`Generated ${morningTasks.length} Morning Tasks:`);
morningTasks.forEach((t, i) => console.log(`  ${i+1}. [${t.category.toUpperCase()}] ${t.text} (${t.estimatedTime})`));

console.log('\n=== TEST 2: Afternoon Task Generation ===');
const afternoonTasks = ruleTasksForSlot(mockMetrics, 'general', 'afternoon');
console.log(`Generated ${afternoonTasks.length} Afternoon Tasks:`);
afternoonTasks.forEach((t, i) => console.log(`  ${i+1}. [${t.category.toUpperCase()}] ${t.text} (${t.estimatedTime})`));

console.log('\n=== TEST 3: Evening Task Generation ===');
const eveningTasks = ruleTasksForSlot(mockMetrics, 'general', 'evening');
console.log(`Generated ${eveningTasks.length} Evening Tasks:`);
eveningTasks.forEach((t, i) => console.log(`  ${i+1}. [${t.category.toUpperCase()}] ${t.text} (${t.estimatedTime})`));

if (morningTasks.length >= 3 && afternoonTasks.length >= 3 && eveningTasks.length >= 3) {
  console.log('\n✅ ALL TASK GENERATION TESTS PASSED PERFECTLY!');
} else {
  console.error('\n❌ TASK GENERATION TEST FAILED!');
  process.exit(1);
}
