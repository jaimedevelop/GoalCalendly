import { endOfWeek, format, isValid, parseISO, startOfWeek } from 'date-fns';
import type { Goal } from '../types';

/** Recover dated history only when a saved period has exactly one known practice day. */
export function activityHistory(goal: Goal): NonNullable<Goal['activityDays']> {
  const days = { ...goal.activityDays };
  for (const [key, period] of Object.entries(goal.progressPeriods ?? {})) {
    if (!key.startsWith('daily:')) continue;
    const day = key.slice(6);
    days[day] = {
      hours: Math.max(days[day]?.hours ?? 0, period.hours),
      trophies: Math.max(days[day]?.trophies ?? 0, Number(period.earned)),
    };
  }
  for (const [key, period] of Object.entries(goal.progressPeriods ?? {})) {
    if (!key.startsWith('weekly:')) continue;
    const first = key.slice(7);
    const date = parseISO(first);
    if (!isValid(date) || format(startOfWeek(date), 'yyyy-MM-dd') !== first) continue;
    const last = format(endOfWeek(date), 'yyyy-MM-dd');
    const candidates = new Set([
      ...(goal.practiceDays ?? []),
      ...Object.keys(days).filter(day => days[day].hours > 0),
    ].filter(day => day >= first && day <= last));
    if (candidates.size !== 1) continue;
    const [day] = candidates;
    days[day] = {
      hours: Math.max(days[day]?.hours ?? 0, period.hours),
      trophies: Math.max(days[day]?.trophies ?? 0, Number(period.earned && !period.earnedOn)),
    };
  }
  // New awards carry their actual practice date, including monthly awards.
  // Sum distinct periods, then reconcile with the overlapping daily summary.
  const awards: Record<string, number> = {};
  for (const [key, period] of Object.entries(goal.progressPeriods ?? {})) {
    if (!period.earned) continue;
    const day = key.startsWith('daily:') ? key.slice(6) : period.earnedOn;
    if (!day || !isValid(parseISO(day))) continue;
    awards[day] = (awards[day] ?? 0) + 1;
  }
  for (const [day, trophies] of Object.entries(awards)) {
    days[day] = { hours: days[day]?.hours ?? 0, trophies: Math.max(days[day]?.trophies ?? 0, trophies) };
  }
  return days;
}
