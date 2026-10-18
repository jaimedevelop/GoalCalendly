import { getWeek, getWeekYear } from 'date-fns';
import type { Goal } from '../types';
import { normalizeProgress } from './practiceTime';
import { weeklyTrophyCount } from './trophies';

/** Match the calculation's legacy weekly fallback instead of replaying a loaded award. */
export function newlyEarnedPeriods(before: Goal, after: Goal): string[] {
  const normalized = normalizeProgress(before);
  if (before.settings.frequency === 'weekly' && before.settings.target.type === 'hours') {
    return Object.entries(after.progressPeriods ?? {}).flatMap(([key, period]) => {
      if (!key.startsWith('weekly:')) return [];
      const date = new Date(`${key.slice(7)}T12:00:00`);
      const previousHours = before.progressPeriods?.[key]?.hours ?? normalized.weeklyTrophies.find(week =>
        week.weekNumber === getWeek(date) && week.year === getWeekYear(date))?.weeklyTimeSpent ?? 0;
      return Array.from({ length: Math.max(0, weeklyTrophyCount(after, period.hours) - weeklyTrophyCount(before, previousHours)) }, () => key);
    });
  }
  return Object.entries(after.progressPeriods ?? {}).filter(([key, period]) => {
    if (!period.earned) return false;
    const previous = before.progressPeriods?.[key];
    if (previous) return !previous.earned;
    if (!key.startsWith('weekly:')) return true;
    const date = new Date(`${key.slice(7)}T12:00:00`);
    return !normalized.weeklyTrophies.some(week =>
      week.weekNumber === getWeek(date) && week.year === getWeekYear(date) && week.trophies > 0);
  }).map(([key]) => key);
}

/** Recovery requires a confirmed progress snapshot containing the failed session. */
export function containsSessionProgress(saved: Goal, session: Goal): boolean {
  return saved.id === session.id && saved.totalTimeSpent + 1e-9 >= session.totalTimeSpent &&
    Object.entries(session.progressPeriods ?? {}).every(([key, period]) => {
      const confirmed = saved.progressPeriods?.[key];
      return !!confirmed && confirmed.hours + 1e-9 >= period.hours && (!period.earned || confirmed.earned);
    });
}

export function formatSessionDuration(durationMs: number): string {
  if (durationMs < 60000) return `${Math.max(1, Math.floor(durationMs / 1000))}s`;
  const minutes = Math.floor(durationMs / 60000);
  return minutes < 60 ? `${minutes}m` : `${Math.floor(minutes / 60)}h${minutes % 60 ? ` ${minutes % 60}m` : ''}`;
}

export function periodDescription(keys: string[]): string {
  if (keys.length > 1) return `${keys.length} target multiples completed`;
  const frequency = keys[0]?.split(':')[0];
  return `${frequency ? frequency[0].toUpperCase() + frequency.slice(1) : 'Goal'} target reached`;
}
