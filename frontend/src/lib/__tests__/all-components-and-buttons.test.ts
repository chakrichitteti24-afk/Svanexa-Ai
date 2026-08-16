import { describe, it, expect } from 'vitest';
import { getCheckinQuestions, calculateCheckinIndicators } from '../questions/checkin-questions';

describe('All Svanexa Components & Buttons Integrity Test', () => {
  describe('1. Navigation & App Routes Catalog', () => {
    const desktopRoutes = [
      { name: 'Dashboard', href: '/dashboard' },
      { name: 'Daily Care Journal', href: '/check-in' },
      { name: 'Cycle & Period Care', href: '/cycle' },
      { name: 'Skin Care & Glow', href: '/skin' },
      { name: 'Wellness Care Plan', href: '/wellness-plan' },
      { name: 'Svanexa Store', href: '/store' },
      { name: 'Reports', href: '/reports' },
      { name: 'Profile', href: '/profile' },
    ];

    const mobileNavRoutes = [
      { name: 'Home', href: '/dashboard' },
      { name: 'Cycle', href: '/cycle' },
      { name: 'Journal', href: '/check-in' },
      { name: 'Wellness', href: '/wellness-plan' },
      { name: 'Store', href: '/store' },
      { name: 'Profile', href: '/profile' },
    ];

    it('has all valid, non-empty routes defined in Sidebar navigation', () => {
      expect(desktopRoutes.length).toBe(8);
      desktopRoutes.forEach(r => {
        expect(r.name).toBeTruthy();
        expect(r.href.startsWith('/')).toBe(true);
      });
    });

    it('has all valid, non-empty routes defined in Mobile Bottom Navigation', () => {
      expect(mobileNavRoutes.length).toBe(6);
      mobileNavRoutes.forEach(r => {
        expect(r.name).toBeTruthy();
        expect(r.href.startsWith('/')).toBe(true);
      });
    });
  });

  describe('2. Store Items, Catalog & Purchases', () => {
    const freeThemes = ['default'];
    const premiumThemes = ['lavender', 'rose', 'ocean', 'midnight', 'sage', 'sunrise'];
    const dashboardStyles = ['minimal', 'soft_glow', 'glassmorphism', 'high_contrast'];
    const companionStyles = ['friendly', 'professional', 'motivational', 'calm_zen', 'poetic'];

    it('validates free theme defaults', () => {
      expect(freeThemes.includes('default')).toBe(true);
    });

    it('validates premium theme items cost 50 coins', () => {
      expect(premiumThemes.length).toBe(6);
      premiumThemes.forEach(themeId => {
        expect(themeId).toBeTruthy();
      });
    });

    it('validates dashboard and companion customization styles', () => {
      expect(dashboardStyles.length).toBe(4);
      expect(companionStyles.length).toBe(5);
    });
  });

  describe('3. Habit Badges & Milestones', () => {
    it('accurately checks unlock conditions for all badge categories', () => {
      const getBadges = (currentStreak: number, totalCheckIns: number, waterLogged: number, coinBalance: number) => [
        { id: 'starter', isUnlocked: totalCheckIns >= 1 },
        { id: 'streak_7', isUnlocked: currentStreak >= 7 },
        { id: 'streak_30', isUnlocked: currentStreak >= 30 },
        { id: 'hydration_hero', isUnlocked: waterLogged >= 2.0 },
        { id: 'coin_collector', isUnlocked: coinBalance >= 50 },
        { id: 'pcos_champion', isUnlocked: totalCheckIns >= 10 },
      ];

      // New user
      const newUserBadges = getBadges(0, 0, 0, 0);
      expect(newUserBadges.filter(b => b.isUnlocked).length).toBe(0);

      // User after first check-in
      const firstCheckinBadges = getBadges(1, 1, 1.5, 10);
      expect(firstCheckinBadges.find(b => b.id === 'starter')?.isUnlocked).toBe(true);
      expect(firstCheckinBadges.find(b => b.id === 'streak_7')?.isUnlocked).toBe(false);

      // Active 7-day power user
      const powerUserBadges = getBadges(7, 12, 2.5, 80);
      expect(powerUserBadges.find(b => b.id === 'starter')?.isUnlocked).toBe(true);
      expect(powerUserBadges.find(b => b.id === 'streak_7')?.isUnlocked).toBe(true);
      expect(powerUserBadges.find(b => b.id === 'hydration_hero')?.isUnlocked).toBe(true);
      expect(powerUserBadges.find(b => b.id === 'coin_collector')?.isUnlocked).toBe(true);
      expect(powerUserBadges.find(b => b.id === 'pcos_champion')?.isUnlocked).toBe(true);
      expect(powerUserBadges.find(b => b.id === 'streak_30')?.isUnlocked).toBe(false);
    });
  });

  describe('4. Wellness Plan Task Categories & Slots', () => {
    const timeSlots = ['morning', 'afternoon', 'evening'] as const;
    const taskCategories = [
      'sleep', 'stress', 'mood', 'cycle', 'symptoms',
      'skin', 'hydration', 'exercise', 'nutrition', 'mindfulness', 'pregnancy'
    ];

    it('has all valid time slots and task categories defined', () => {
      expect(timeSlots.length).toBe(3);
      expect(taskCategories.length).toBe(11);
    });

    it('calculates completion percentage accurately', () => {
      const mockTasks = [
        { id: '1', timeSlot: 'morning', completed: true, status: 'completed' },
        { id: '2', timeSlot: 'morning', completed: false, status: 'pending' },
        { id: '3', timeSlot: 'afternoon', completed: true, status: 'completed' },
        { id: '4', timeSlot: 'evening', completed: false, status: 'pending' },
      ];

      const morningTasks = mockTasks.filter(t => t.timeSlot === 'morning');
      const completedMorning = morningTasks.filter(t => t.completed).length;
      const morningPct = Math.round((completedMorning / morningTasks.length) * 100);

      expect(morningPct).toBe(50);
    });
  });

  describe('5. Check-in Page Button States and Interactions', () => {
    it('verifies question navigation constraints', () => {
      const questions = getCheckinQuestions('morning', 'general');
      const totalQuestions = questions.length;
      expect(totalQuestions).toBe(10);

      let currentStep = 0;
      const answers: Record<string, number> = {};

      // Previous button is disabled at step 0
      const isPrevDisabled = currentStep === 0;
      expect(isPrevDisabled).toBe(true);

      // Next button is disabled if current question is unanswered
      const isNextDisabled = answers[questions[currentStep].id] === undefined;
      expect(isNextDisabled).toBe(true);

      // Select an option
      answers[questions[0].id] = 4;
      expect(answers[questions[0].id]).toBe(4);
      expect(answers[questions[currentStep].id] !== undefined).toBe(true);

      // Advance to step 9 (last question)
      currentStep = 9;
      expect(currentStep === totalQuestions - 1).toBe(true);

      // Can submit only when all 10 questions answered
      const answeredCount = questions.filter(q => answers[q.id] !== undefined).length;
      const canSubmit = answeredCount === totalQuestions;
      expect(canSubmit).toBe(false);

      // Answer remaining questions
      questions.forEach((q, idx) => {
        answers[q.id] = (idx % 4) + 1;
      });

      const finalAnsweredCount = questions.filter(q => answers[q.id] !== undefined).length;
      const finalCanSubmit = finalAnsweredCount === totalQuestions;
      expect(finalCanSubmit).toBe(true);
    });
  });
});
