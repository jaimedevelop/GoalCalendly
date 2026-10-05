import { getWeek, getWeekYear } from 'date-fns';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { practiceTimeUpdates } from '../src/services/practiceTime';
import { DEFAULT_GOAL_SETTINGS, Goal } from '../src/types';

const now = new Date(2026, 9, 7, 12);
function goal(): Goal {
  return {
    id: 'practice', name: 'Practice', targetHours: 20, currentLevel: 1,
    startDate: '2026-01-01', totalTimeSpent: 19, weeklyTimeSpent: 3,
    weeklyGoal: 4, medals: [], trophies: 0, practiceDays: [],
    weeklyTrophies: [{ weekNumber: getWeek(now), year: getWeekYear(now), weeklyTimeSpent: 3, trophies: 0 }], settings: { ...DEFAULT_GOAL_SETTINGS, target: { type: 'hours', value: 4 } },
  };
}

test('manual time updates total, current week, level, trophies and practice day', () => {
  const updates = practiceTimeUpdates(goal(), now, 1.5, now);
  assert.equal(updates.totalTimeSpent, 20.5);
  assert.equal(updates.weeklyTimeSpent, 4.5);
  assert.equal(updates.currentLevel, 2);
  assert.equal(updates.trophies, 1);
  assert.deepEqual(updates.practiceDays, ['2026-10-07']);
});

test('backdated entries accumulate in their week without changing current week or duplicating days', () => {
  const date = new Date(2026, 8, 15, 12);
  const original = goal();
  const first = { ...original, ...practiceTimeUpdates(original, date, 2, now) };
  const second = practiceTimeUpdates(first, date, 2, now);
  assert.equal(second.totalTimeSpent, 23);
  assert.equal(second.weeklyTimeSpent, 3);
  assert.equal(second.weeklyTrophies?.[0].weeklyTimeSpent, 4);
  assert.equal(second.trophies, 1);
  assert.deepEqual(second.practiceDays, ['2026-09-15']);
  assert.deepEqual(original.practiceDays, []);
  assert.equal(original.weeklyTrophies.length, 1);
});

test('practice days stay chronological when entering older time', () => {
  const existing = { ...goal(), practiceDays: ['2026-10-07'] };
  const updates = practiceTimeUpdates(existing, new Date(2026, 9, 5), 0.5, now);
  assert.deepEqual(updates.practiceDays, ['2026-10-05', '2026-10-07']);
  assert.equal(updates.weeklyTimeSpent, 3.5);
});

import { normalizeProgress, currentProgress } from '../src/services/practiceTime';
import { reminderDue, reminderKey } from '../src/services/reminders';

function fresh(frequency: 'daily' | 'weekly' | 'monthly', value: number): Goal {
  return { ...goal(), totalTimeSpent: 0, weeklyTimeSpent: 0, weeklyTrophies: [], settings: { ...DEFAULT_GOAL_SETTINGS, frequency, target: { type: 'hours', value } } };
}
function add(g: Goal, hours: number, date = now): Goal {
  return { ...g, ...practiceTimeUpdates(g, date, hours, date) };
}
test('five weekly hours earns exactly one trophy, even after ten hours and reload', () => {
  let g = add(fresh('weekly', 5), 4.99);
  assert.equal(g.trophies, 0);
  g = add(g, 0.01);
  assert.equal(g.trophies, 1);
  g = add(g, 5);
  assert.equal(normalizeProgress(g, now).trophies, 1);
  const next = new Date(2026, 9, 14);
  assert.equal(currentProgress(g, next), 0);
  assert.equal(normalizeProgress(g, next).weeklyTimeSpent, 0);
  assert.equal(add(g, 5, next).trophies, 2);
});
test('daily target accumulates sessions and awards once each day', () => {
  let g = add(fresh('daily', 1), 0.5);
  assert.equal(g.trophies, 0);
  g = add(g, 0.5);
  g = add(g, 2);
  assert.equal(g.trophies, 1);
  const tomorrow = new Date(2026, 9, 8);
  assert.equal(currentProgress(g, tomorrow), 0);
  g = add(g, 1, tomorrow);
  assert.equal(g.trophies, 2);
  assert.equal(normalizeProgress(g, tomorrow).trophies, 2);
});
test('calendar week spans New Year without duplicate trophy or lost hours', () => {
  let g = add(fresh('weekly', 5), 3, new Date(2026, 11, 31));
  g = add(g, 2, new Date(2027, 0, 1));
  assert.equal(g.weeklyTrophies.length, 1);
  assert.equal(g.weeklyTimeSpent, 5);
  assert.equal(g.trophies, 1);
});
test('monthly target spans weeks and resets next month', () => {
  let g = add(fresh('monthly', 5), 3, new Date(2026, 9, 1));
  g = add(g, 2, new Date(2026, 9, 15));
  assert.equal(g.trophies, 1);
  assert.equal(currentProgress(g, new Date(2026, 10, 1)), 0);
});
test('invalid and non-hour targets cannot award time-based trophies', () => {
  for (const value of [0, -1, NaN]) assert.equal(add(fresh('weekly', value), 5).trophies, 0);
  const g = fresh('weekly', 1);
  g.settings.target.type = 'books';
  assert.equal(add(g, 5).trophies, 0);
});
test('reminders respect time, opt-in, completion, active timer and achieved target', () => {
  const g = fresh('daily', 1);
  const evening = new Date(2026, 9, 7, 18);
  assert.equal(reminderDue(g, evening, null), false);
  g.settings.reminders = true;
  assert.equal(reminderDue(g, now, null), false);
  assert.equal(reminderDue(g, evening, null), true);
  assert.equal(reminderDue(g, evening, g.id), false);
  assert.equal(reminderDue({ ...g, completed: true }, evening, null), false);
  assert.equal(reminderDue(add(g, 1), evening, null), false);
  g.settings.reminderTime = '19:30';
  assert.equal(reminderDue(g, evening, null), false);
  assert.notEqual(reminderKey('a', g, now), reminderKey('b', g, now));
  assert.notEqual(reminderKey('a', g, now), reminderKey('a', g, new Date(2026, 9, 8)));
});
