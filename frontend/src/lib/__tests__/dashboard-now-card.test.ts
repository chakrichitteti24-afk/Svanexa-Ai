import { describe, it, expect } from 'vitest';

describe('Dashboard Dynamic Now Card Logic', () => {
  const getActiveTimeSlot = (hour: number): 'morning' | 'afternoon' | 'evening' => {
    if (hour >= 6 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 18) return 'afternoon';
    return 'evening';
  };

  it('correctly maps time of day to slot', () => {
    expect(getActiveTimeSlot(7)).toBe('morning');
    expect(getActiveTimeSlot(11)).toBe('morning');
    expect(getActiveTimeSlot(12)).toBe('afternoon');
    expect(getActiveTimeSlot(17)).toBe('afternoon');
    expect(getActiveTimeSlot(18)).toBe('evening');
    expect(getActiveTimeSlot(23)).toBe('evening');
    expect(getActiveTimeSlot(2)).toBe('evening'); // Early night
  });

  it('calculates water addition accurately', () => {
    const currentWater = 1.25;
    const addLiters = 0.25;
    const newWater = Number((currentWater + addLiters).toFixed(2));
    expect(newWater).toBe(1.5);
  });

  it('prioritizes active slot pending tasks over general tasks', () => {
    const tasks = [
      { id: '1', text: 'Evening tea', timeSlot: 'evening', completed: false, status: 'pending' },
      { id: '2', text: 'Morning walk', timeSlot: 'morning', completed: false, status: 'pending' },
    ];

    const activeSlot = 'morning';
    const slotPending = tasks.filter(t => t.timeSlot === activeSlot && !t.completed && t.status !== 'completed');
    const topTask = slotPending.length > 0 ? slotPending[0] : tasks[0];

    expect(topTask.id).toBe('2');
    expect(topTask.text).toBe('Morning walk');
  });
});
