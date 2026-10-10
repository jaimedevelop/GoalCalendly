import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getWeek, getWeekYear } from 'date-fns';
import { DEFAULT_GOAL_SETTINGS, type Goal } from '../src/types';
import { newlyEarnedPeriods, containsSessionProgress, formatSessionDuration } from '../src/services/celebrations';
import { practiceTimeUpdates } from '../src/services/practiceTime';
import { reducer, clearToasts, toast, getToast } from '../src/hooks/useToast';
import type { CelebrationEvent } from '../src/types/celebrations';

function goal(frequency: 'daily' | 'weekly' | 'monthly' = 'weekly'): Goal {
  return { id: 'g', name: 'Practice', targetHours: 20, currentLevel: 1, startDate: '2026-01-01',
    totalTimeSpent: 0, weeklyTimeSpent: 0, weeklyGoal: 1, trophies: 0, practiceDays: [], medals: [], weeklyTrophies: [],
    settings: { ...DEFAULT_GOAL_SETTINGS, frequency, target: { type: 'hours', value: 1 } } };
}

test('legacy weekly awards do not become new celebrations when a period record is created', () => {
  const date = new Date(2026, 9, 5);
  const before = { ...goal(), totalTimeSpent: 1,
    weeklyTrophies: [{ weekNumber: getWeek(date), year: getWeekYear(date), trophies: 1, weeklyTimeSpent: 1 }] };
  const after = { ...before, ...practiceTimeUpdates(before, date, 1, date) };
  assert.deepEqual(newlyEarnedPeriods(before, after), []);
});

test('period identity handles daily, monthly, and weekly New Year boundaries', () => {
  for (const frequency of ['daily', 'weekly', 'monthly'] as const) {
    let before = goal(frequency);
    const date = new Date(2026, 11, 31);
    const after = { ...before, ...practiceTimeUpdates(before, date, 1, date) };
    assert.equal(newlyEarnedPeriods(before, after).length, 1);
    before = after;
    const next = new Date(2027, 0, 1);
    const following = { ...before, ...practiceTimeUpdates(before, next, 1, next) };
    assert.equal(newlyEarnedPeriods(before, following).length, frequency === 'weekly' ? 0 : 1);
  }
});

test('a daily trophy cannot suppress a newly earned weekly celebration after changing frequency', () => {
  const date = new Date(2026, 9, 7);
  const initial = goal('daily');
  const daily = { ...initial, ...practiceTimeUpdates(initial, date, 1, date) };
  const before = { ...daily, settings: { ...daily.settings, frequency: 'weekly' as const } };
  const after = { ...before, ...practiceTimeUpdates(before, date, 1, date) };
  assert.deepEqual(newlyEarnedPeriods(before, after), ['weekly:2026-10-04']);
  assert.equal(after.trophies, 2);
});

test('recovery refuses a stale snapshot, even when its trophy flag is present', () => {
  const before = goal();
  const date = new Date(2026, 9, 5);
  const session = { ...before, ...practiceTimeUpdates(before, date, 2, date) };
  assert.equal(containsSessionProgress(before, session), false);
  assert.equal(containsSessionProgress({ ...session, totalTimeSpent: 1 }, session), false);
  assert.equal(containsSessionProgress(session, session), true);
});

test('durations retain positive subminute time and format longer sessions', () => {
  assert.equal(formatSessionDuration(5), '1s');
  assert.equal(formatSessionDuration(25000), '25s');
  assert.equal(formatSessionDuration(59999), '59s');
  assert.equal(formatSessionDuration(25 * 60000), '25m');
  assert.equal(formatSessionDuration(95 * 60000), '1h 35m');
});

test('queue keeps FIFO order, interrupts with errors, and updates without duplicate items', () => {
  const trophy = { kind: 'trophy' } as CelebrationEvent;
  let state = { toasts: [] } as Parameters<typeof reducer>[0];
  state = reducer(state, { type: 'ADD_TOAST', toast: { id: 'timer', open: true } });
  state = reducer(state, { type: 'ADD_TOAST', toast: { id: 'trophy', open: true, celebration: trophy } });
  state = reducer(state, { type: 'ADD_TOAST', toast: { id: 'completion', open: true } });
  state = reducer(state, { type: 'ADD_TOAST', toast: { id: 'error', open: true, variant: 'error' } });
  assert.deepEqual(state.toasts.map(item => item.id), ['error', 'timer', 'trophy', 'completion']);
  state = reducer(state, { type: 'ADD_TOAST', toast: { id: 'error2', open: true, variant: 'error' } });
  assert.deepEqual(state.toasts.map(item => item.id), ['error', 'error2', 'timer', 'trophy', 'completion']);
  state = reducer(state, { type: 'REMOVE_TOAST', toastId: 'error2' });
  state = reducer(state, { type: 'REMOVE_TOAST', toastId: 'error' });
  state = reducer(state, { type: 'ADD_TOAST', toast: { id: 'timer', open: true, description: 'saved' } });
  assert.equal(state.toasts.length, 3);
  assert.equal(state.toasts[0].description, 'saved');
});

test('a waiting save failure moves ahead of success items without interrupting an earlier error', () => {
  let state = { toasts: [
    { id: 'error', variant: 'error', open: true }, { id: 'ordinary', open: true }, { id: 'pending', open: true },
  ] } as Parameters<typeof reducer>[0];
  state = reducer(state, { type: 'UPDATE_TOAST', id: 'pending', toast: { variant: 'error' } });
  assert.deepEqual(state.toasts.map(item => item.id), ['error', 'pending', 'ordinary']);
});

test('toast dismissal invokes cleanup once and queued errors preserve an existing trophy', () => {
  clearToasts();
  let dismissed = 0;
  const item = toast({ id: 'trophy', onDismiss: () => { dismissed++; } });
  toast({ id: 'error', variant: 'error' });
  assert.ok(getToast('trophy'));
  item.dismiss(); item.dismiss();
  assert.equal(dismissed, 1);
  clearToasts();
  assert.equal(getToast('trophy'), undefined);
});
