import { getNormalizedDate, isValidDateString } from '../../utils/date-utils';
import { getCheckinQuestions, calculateCheckinIndicators } from '../questions/checkin-questions';

function runUnitTests() {
  console.log('====================================');
  console.log('SVANEXA AI — UNIT TEST SUITE (TSX)');
  console.log('====================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, name: string) {
    if (condition) {
      console.log(`✓ PASS: ${name}`);
      passed++;
    } else {
      console.error(`✗ FAIL: ${name}`);
      failed++;
    }
  }

  // 1. Date normalization test
  console.log('--- TEST 1: Date Utils ---');
  assert(isValidDateString('2026-08-16') === true, '2026-08-16 is valid YYYY-MM-DD');
  assert(isValidDateString('2026-8-16') === false, 'Invalid format rejected');
  assert(isValidDateString('invalid') === false, 'Non-date string rejected');
  assert(isValidDateString(null as any) === false, 'Null rejected');

  const todayStr = getNormalizedDate();
  assert(/^\d{4}-\d{2}-\d{2}$/.test(todayStr), `getNormalizedDate returns YYYY-MM-DD: ${todayStr}`);

  // 2. Check-in Questions MCQ structure
  console.log('\n--- TEST 2: 10 MCQ Question Generation ---');
  const morningQuestions = getCheckinQuestions('morning', 'general');
  assert(morningQuestions.length === 10, `Morning has exactly 10 questions (got ${morningQuestions.length})`);
  morningQuestions.forEach((q, idx) => {
    assert(q.options && q.options.length >= 2, `Question ${idx + 1} (${q.id}) has valid options`);
    assert(!!q.title && !!q.question, `Question ${idx + 1} has title and question text`);
  });

  const afternoonQuestions = getCheckinQuestions('afternoon', 'pcos');
  assert(afternoonQuestions.length === 10, `Afternoon PCOS has exactly 10 questions (got ${afternoonQuestions.length})`);

  const eveningQuestions = getCheckinQuestions('evening', 'pregnancy');
  assert(eveningQuestions.length === 10, `Evening Pregnancy has exactly 10 questions (got ${eveningQuestions.length})`);

  // 3. Indicator Calculation
  console.log('\n--- TEST 3: 10-Dimension Indicator Calculation ---');
  const mockAnswers = {
    m_sleep: 4,
    m_energy: 3,
    m_mood: 4,
    m_stress: 2,
    m_focus: 3,
    m_comfort: 4,
    m_hydration: 3,
    m_movement: 3,
    m_intention: 4,
    m_support: 1,
  };

  const indicators = calculateCheckinIndicators(mockAnswers, morningQuestions);
  assert(typeof indicators.wellnessScore === 'number', `wellnessScore is number (${indicators.wellnessScore})`);
  assert(indicators.wellnessScore >= 0 && indicators.wellnessScore <= 100, 'wellnessScore is within 0-100');
  assert(indicators.stress && typeof indicators.stress.level === 'string', `stress level inferred: ${indicators.stress.level}`);
  assert(indicators.mood && typeof indicators.mood.state === 'string', `mood tone inferred: ${indicators.mood.state}`);
  assert(indicators.energy && typeof indicators.energy.level === 'string', `energy level inferred: ${indicators.energy.level}`);

  console.log(`\n====================================`);
  console.log(`UNIT TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log(`====================================\n`);

  if (failed > 0) process.exit(1);
}

runUnitTests();
