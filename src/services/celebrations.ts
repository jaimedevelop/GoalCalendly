import type { Goal } from '../types';
import { hasEarnedPeriod } from './practiceTime';

/** Match the calculation's legacy weekly fallback instead of replaying a loaded award. */
export function newlyEarnedPeriods(before: Goal, after: Goal): string[] {
  return Object.entries(after.progressPeriods ?? {}).filter(([key, period]) => {
    return period.earned && !hasEarnedPeriod(before, key);
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
  if (keys.length > 1) return `${keys.length} goal periods completed`;
  const frequency = keys[0]?.split(':')[0];
  return `${frequency ? frequency[0].toUpperCase() + frequency.slice(1) : 'Goal'} target reached`;
}
