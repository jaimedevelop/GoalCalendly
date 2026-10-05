import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getWeek, getWeekYear } from 'date-fns';
import { buildReport } from '../src/services/reports';
import { practiceTimeUpdates } from '../src/services/practiceTime';
import { DEFAULT_GOAL_SETTINGS, type Goal } from '../src/types';

const day = new Date(2026, 9, 7, 12);

test('October 4 weekly-only entries recover AI and house work hours in daily reports', () => {
  const date = new Date(2026, 9, 4, 12);
  const goals = [2, 4].map((hours, i) => ({
    ...goal(), id: String(i), name: i ? 'House work' : 'Development Ai',
    totalTimeSpent: hours + 10, practiceDays: ['2025-10-04', '2026-10-04'],
    progressPeriods: { 'weekly:2026-10-04': { hours, earned: false } },
    weeklyTrophies: [{ weekNumber: getWeek(date), year: getWeekYear(date), weeklyTimeSpent: hours, trophies: 0 }],
  }));
  const before = JSON.stringify(goals);
  const report = buildReport(goals, 'daily', date);
  assert.deepEqual(report.rows.map(row => row.hours), [2, 4]);
  assert.equal(report.hours, 6);
  assert.equal(report.incomplete, false);
  assert.equal(buildReport(goals, 'weekly', date).hours, 6);
  assert.equal(buildReport(goals, 'monthly', date).hours, 6);
  assert.equal(JSON.stringify(goals), before);

  const tomorrow = new Date(2026, 9, 5, 12);
  const updated = goals.map(g => ({ ...g, ...practiceTimeUpdates(g, tomorrow, 1, tomorrow) }));
  assert.equal(buildReport(updated, 'daily', date).hours, 6);
  assert.equal(buildReport(updated, 'daily', tomorrow).hours, 2);
  assert.equal(buildReport(updated, 'weekly', date).hours, 8);
});

test('weekly periods spanning multiple practice days are never assigned to one day', () => {
  const g = { ...goal(), practiceDays: ['2026-10-04', '2026-10-05'],
    progressPeriods: { 'weekly:2026-10-04': { hours: 6, earned: true } } };
  const report = buildReport([g], 'daily', new Date(2026, 9, 4));
  assert.equal(report.hours, 0);
  assert.equal(report.incomplete, true);
});
function goal(): Goal {
  return { id: 'a', name: 'Reading', targetHours: 20, currentLevel: 1, startDate: '2026-01-01', totalTimeSpent: 0, weeklyTimeSpent: 0, weeklyGoal: 2, trophies: 0, medals: [], practiceDays: [], weeklyTrophies: [], settings: { ...DEFAULT_GOAL_SETTINGS, target: { type: 'hours', value: 2 } } };
}
function add(g: Goal, hours: number, date = day) { return { ...g, ...practiceTimeUpdates(g, date, hours, day) }; }

test('saved activity produces daily, weekly and monthly totals without double counting', () => {
  const g = add(add(goal(), 1), 2, new Date(2026, 9, 8));
  const loaded = JSON.parse(JSON.stringify(g));
  const daily = buildReport([loaded], 'daily', day);
  assert.equal(daily.hours, 1);
  assert.equal(daily.trophies, 0);
  assert.equal(daily.practiceDays, 1);
  for (const frequency of ['weekly', 'monthly'] as const) {
    const report = buildReport([loaded], frequency, day);
    assert.equal(report.hours, 3);
    assert.equal(report.trophies, 1);
    assert.equal(report.practiceDays, 2);
    assert.equal(report.incomplete, false);
  }
});

test('legacy weekly-only hours remain in weekly reports and are not invented in daily reports', () => {
  const g = { ...goal(), weeklyTrophies: [{ weekNumber: getWeek(day), year: getWeekYear(day), weeklyTimeSpent: 7, trophies: 1 }] };
  assert.equal(buildReport([g], 'weekly', day).hours, 7);
  const daily = buildReport([g], 'daily', day);
  assert.equal(daily.hours, 0);
  assert.equal(daily.incomplete, true);
});

test('daily history survives tracking upgrades and later sessions without duplicate trophies', () => {
  const g = { ...goal(), totalTimeSpent: 3, settings: { ...DEFAULT_GOAL_SETTINGS, frequency: 'daily' as const, target: { type: 'hours' as const, value: 2 } }, progressPeriods: { 'daily:2026-10-07': { hours: 3, earned: true } }, weeklyTrophies: [{ weekNumber: getWeek(day), year: getWeekYear(day), weeklyTimeSpent: 3, trophies: 1 }] };
  const updated = add(g, 1);
  const report = buildReport([updated], 'daily', day);
  assert.equal(report.hours, 4);
  assert.equal(report.trophies, 1);
  assert.equal(report.incomplete, false);
});

test('monthly reports include whole legacy weeks but do not assign boundary weeks to a month', () => {
  const boundary = new Date(2026, 8, 30);
  const g = { ...goal(), weeklyTrophies: [
    { weekNumber: getWeek(day), year: getWeekYear(day), weeklyTimeSpent: 7, trophies: 1 },
    { weekNumber: getWeek(boundary), year: getWeekYear(boundary), weeklyTimeSpent: 5, trophies: 1 },
  ] };
  const report = buildReport([g], 'monthly', day);
  assert.equal(report.hours, 7);
  assert.equal(report.trophies, 1);
  assert.equal(report.incomplete, true);
});

test('monthly periods and lifetime hours are not counted twice', () => {
  const g = { ...goal(), totalTimeSpent: 50, progressPeriods: { 'monthly:2026-10': { hours: 5, earned: true } }, activityDays: { '2026-10-07': { hours: 2, trophies: 1 } } };
  const report = buildReport([g], 'monthly', day);
  assert.equal(report.hours, 5);
  assert.equal(report.trophies, 1);
});

test('practice days are unique across goals and completions respect the selected range', () => {
  const a = { ...add(goal(), 1), completed: true, completedDate: '2026-10-07T12:00:00' };
  const b = { ...add(goal(), 1), id: 'b', completed: true, completedDate: '2026-09-07T12:00:00' };
  const report = buildReport([a, b], 'daily', day);
  assert.equal(report.practiceDays, 1);
  assert.equal(report.completed, 1);
  assert.equal(report.activeGoals, 2);
  assert.equal(buildReport([a, b], 'monthly', new Date(2026, 10, 1)).hours, 0);
});

test('weeks crossing New Year keep saved totals in the correct calendar week', () => {
  const g = add(add(goal(), 1, new Date(2026, 11, 31)), 1, new Date(2027, 0, 1));
  const report = buildReport([g], 'weekly', new Date(2027, 0, 1));
  assert.equal(report.hours, 2);
  assert.equal(report.trophies, 1);
  assert.equal(buildReport([g], 'monthly', new Date(2027, 0, 1)).hours, 1);
});
