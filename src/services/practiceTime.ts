import { addWeeks, endOfWeek, format, getWeek, getWeekYear, isValid, parseISO, startOfWeek } from 'date-fns';
import { Goal, LEVELS, WeeklyTrophy } from '../types';
import { activityHistory } from './activityHistory';

export function periodKey(goal: Goal, date: Date): string {
  const frequency = goal.settings.frequency;
  return `${frequency}:${format(frequency === 'weekly' ? startOfWeek(date) : date, frequency === 'monthly' ? 'yyyy-MM' : 'yyyy-MM-dd')}`;
}

export function currentProgress(goal: Goal, now = new Date()): number {
  const period = goal.progressPeriods?.[periodKey(goal, now)];
  if (goal.settings.frequency === 'weekly') {
    return Math.max(period?.hours ?? 0, normalizeProgress(goal, now).weeklyTimeSpent);
  }
  const stamp = format(now, goal.settings.frequency === 'daily' ? 'yyyy-MM-dd' : 'yyyy-MM');
  const datedHours = Object.entries(activityHistory(goal)).reduce((sum, [day, activity]) =>
    day.startsWith(stamp) ? sum + positive(activity.hours) : sum, 0);
  return Math.max(period?.hours ?? 0, datedHours);
}

const positive = (value: number) => Number.isFinite(value) ? Math.max(0, value) : 0;
const count = (value: number) => Math.floor(positive(value));
const weekId = (date: Date) => `${getWeekYear(date)}:${getWeek(date)}`;

/** Only old weekly-only records can stand in for a missing weekly period. */
export function hasEarnedPeriod(goal: Goal, key: string): boolean {
  const period = goal.progressPeriods?.[key];
  if (period) return period.earned;
  if (!key.startsWith('weekly:')) return false;
  const date = parseISO(key.slice(7));
  if (!isValid(date)) return false;
  const first = format(startOfWeek(date), 'yyyy-MM-dd');
  const last = format(endOfWeek(date), 'yyyy-MM-dd');
  const hasOtherTracking = Object.keys(goal.progressPeriods ?? {}).some(other => {
    if (other.startsWith('daily:')) return other.slice(6) >= first && other.slice(6) <= last;
    if (other.startsWith('monthly:')) return other.slice(8) >= first.slice(0, 7) && other.slice(8) <= last.slice(0, 7);
    return false;
  });
  return !hasOtherTracking && (goal.weeklyTrophies ?? []).some(w =>
    w.weekNumber === getWeek(date) && w.year === getWeekYear(date) && w.trophies > 0);
}

/** Reconcile overlapping history without re-awarding old time against today's target. */
export function normalizeProgress(goal: Goal, now = new Date()): Goal {
  const weeks = new Map<string, WeeklyTrophy>();
  const ensureWeek = (date: Date) => {
    const id = weekId(date);
    if (!weeks.has(id)) weeks.set(id, { weekNumber: getWeek(date), year: getWeekYear(date), trophies: 0, weeklyTimeSpent: 0 });
    return weeks.get(id)!;
  };
  for (const week of goal.weeklyTrophies ?? []) {
    const id = `${week.year}:${week.weekNumber}`;
    const previous = weeks.get(id);
    // Duplicate summary rows are snapshots, not separate sessions.
    weeks.set(id, { ...week, trophies: Math.max(count(week.trophies), previous?.trophies ?? 0),
      weeklyTimeSpent: Math.max(positive(week.weeklyTimeSpent), previous?.weeklyTimeSpent ?? 0) });
  }
  const dated = new Map<string, { hours: number; trophies: number }>();
  for (const [day, activity] of Object.entries(activityHistory(goal))) {
    const date = parseISO(day);
    if (!isValid(date)) continue;
    const id = weekId(date);
    const previous = dated.get(id) ?? { hours: 0, trophies: 0 };
    previous.hours += positive(activity.hours);
    previous.trophies += count(activity.trophies);
    dated.set(id, previous);
    const week = ensureWeek(date);
    week.weeklyTimeSpent = Math.max(week.weeklyTimeSpent, previous.hours);
    week.trophies = Math.max(week.trophies, previous.trophies);
  }
  const periodCounts = new Map<string, number>();
  const undatedMonths: string[] = [];
  for (const [key, period] of Object.entries(goal.progressPeriods ?? {})) {
    const [frequency, stamp] = key.split(':');
    if (!['daily', 'weekly', 'monthly'].includes(frequency)) continue;
    const date = parseISO(frequency === 'monthly' ? period.earnedOn ?? '' : stamp);
    if (frequency === 'monthly' && (!isValid(date) || format(date, 'yyyy-MM') !== stamp)) {
      if (period.earned) undatedMonths.push(stamp);
      continue;
    }
    if (!isValid(date)) continue;
    const week = ensureWeek(date);
    if (frequency === 'weekly') week.weeklyTimeSpent = Math.max(week.weeklyTimeSpent, positive(period.hours));
    if (period.earned) {
      const id = weekId(date);
      const awards = (periodCounts.get(id) ?? 0) + 1;
      periodCounts.set(id, awards);
      week.trophies = Math.max(week.trophies, awards);
    }
  }
  const weeklyTrophies = [...weeks.values()].sort((a, b) => a.year - b.year || a.weekNumber - b.weekNumber);
  // A monthly award may already be included in a weekly summary. Match it once,
  // but never invent its earning week when the original date was not saved.
  const unmatched = weeklyTrophies.map(week => ({
    start: startOfWeek(addWeeks(new Date(week.year, 0, 1), week.weekNumber - 1)),
    remaining: week.trophies - (periodCounts.get(`${week.year}:${week.weekNumber}`) ?? 0),
  }));
  let unassigned = 0;
  for (const month of undatedMonths.sort()) {
    const match = unmatched.find(week => week.remaining > 0 &&
      format(week.start, 'yyyy-MM') <= month && format(endOfWeek(week.start), 'yyyy-MM') >= month);
    if (match) match.remaining--;
    else unassigned++;
  }
  return { ...goal, weeklyTrophies,
    weeklyTimeSpent: weeklyTrophies.find(w => w.weekNumber === getWeek(now) && w.year === getWeekYear(now))?.weeklyTimeSpent ?? 0,
    trophies: Math.max(count(goal.trophies), weeklyTrophies.reduce((sum, w) => sum + w.trophies, unassigned)),
  };
}

/** One trophy per achieved calendar period, shared by manual and timed sessions. */
export function practiceTimeUpdates(goal: Goal, date: Date, hours: number, now = new Date()): Partial<Goal> {
  if (!isValid(date) || !Number.isFinite(hours) || hours <= 0) return {};
  const normalized = normalizeProgress(goal, now);
  const weekNumber = getWeek(date);
  const year = getWeekYear(date);
  const previousWeek = normalized.weeklyTrophies.find(w => w.weekNumber === weekNumber && w.year === year);
  const weeklyHours = (previousWeek?.weeklyTimeSpent ?? 0) + hours;
  const key = periodKey(goal, date);
  const previousPeriod = goal.progressPeriods?.[key];
  const periodHours = currentProgress(normalized, date) + hours;
  const alreadyEarned = hasEarnedPeriod(goal, key);
  const target = goal.settings.target;
  const earned = alreadyEarned || (target.type === 'hours' && Number.isFinite(target.value) && target.value > 0 && periodHours + 1e-9 >= target.value);
  const weeklyTrophies = [
    ...normalized.weeklyTrophies.filter(w => w.weekNumber !== weekNumber || w.year !== year),
    { weekNumber, year, weeklyTimeSpent: weeklyHours, trophies: (previousWeek?.trophies ?? 0) + (earned && !alreadyEarned ? 1 : 0) },
  ].sort((a, b) => a.year - b.year || a.weekNumber - b.weekNumber);
  const totalTimeSpent = goal.totalTimeSpent + hours;
  const day = format(date, 'yyyy-MM-dd');
  const activityDays = activityHistory(goal);
  const previousDay = activityDays[day];
  // Daily goals may already have dated history from before activityDays existed.
  const dailyPeriod = goal.progressPeriods?.[`daily:${day}`];
  let currentLevel = goal.currentLevel;
  LEVELS.forEach((level, i) => {
    if (totalTimeSpent >= level.requiredHours) currentLevel = Math.max(currentLevel, i + 1);
  });
  return {
    totalTimeSpent,
    activityDays: { ...activityDays, [day]: {
      hours: Math.max(previousDay?.hours ?? 0, dailyPeriod?.hours ?? 0) + hours,
      trophies: Math.max(previousDay?.trophies ?? 0, Number(dailyPeriod?.earned ?? false)) + Number(earned && !alreadyEarned),
    } },
    weeklyTimeSpent: weeklyTrophies.find(w => w.weekNumber === getWeek(now) && w.year === getWeekYear(now))?.weeklyTimeSpent ?? 0,
    practiceDays: [...new Set([...(goal.practiceDays || []), format(date, 'yyyy-MM-dd')])].sort(),
    progressPeriods: { ...goal.progressPeriods, [key]: { ...previousPeriod, hours: periodHours, earned,
      ...(earned && !alreadyEarned ? { earnedOn: day } : {}),
    } },
    weeklyTrophies,
    trophies: normalized.trophies + Number(earned && !alreadyEarned),
    currentLevel,
  };
}
