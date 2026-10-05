import { format, getWeek, getWeekYear, startOfWeek } from 'date-fns';
import { Goal, LEVELS } from '../types';

export function periodKey(goal: Goal, date: Date): string {
  const frequency = goal.settings.frequency;
  return `${frequency}:${format(frequency === 'weekly' ? startOfWeek(date) : date, frequency === 'monthly' ? 'yyyy-MM' : 'yyyy-MM-dd')}`;
}

export function currentProgress(goal: Goal, now = new Date()): number {
  const period = goal.progressPeriods?.[periodKey(goal, now)];
  if (period) return period.hours;
  if (goal.settings.frequency === 'weekly') {
    return goal.weeklyTrophies?.find(w => w.weekNumber === getWeek(now) && w.year === getWeekYear(now))?.weeklyTimeSpent ?? 0;
  }
  return 0;
}

/** Never copy the previous week's cached total into a new week on reload. */
export function normalizeProgress(goal: Goal, now = new Date()): Goal {
  const weeklyTrophies = (goal.weeklyTrophies || []).map(w => ({ ...w,
    trophies: goal.progressPeriods ? w.trophies
      : goal.settings.frequency === 'weekly' && goal.settings.target.type === 'hours'
        ? Number(goal.settings.target.value > 0 && w.weeklyTimeSpent + 1e-9 >= goal.settings.target.value)
        : Math.min(1, Math.max(0, w.trophies)),
  }));
  return { ...goal, weeklyTrophies,
    weeklyTimeSpent: weeklyTrophies.find(w => w.weekNumber === getWeek(now) && w.year === getWeekYear(now))?.weeklyTimeSpent ?? 0,
    trophies: weeklyTrophies.reduce((sum, w) => sum + w.trophies, 0),
  };
}

/** One trophy per achieved calendar period, shared by manual and timed sessions. */
export function practiceTimeUpdates(goal: Goal, date: Date, hours: number, now = new Date()): Partial<Goal> {
  if (!Number.isFinite(hours) || hours <= 0) return {};
  const normalized = normalizeProgress(goal, now);
  const weekNumber = getWeek(date);
  const year = getWeekYear(date);
  const previousWeek = normalized.weeklyTrophies.find(w => w.weekNumber === weekNumber && w.year === year);
  const weeklyHours = (previousWeek?.weeklyTimeSpent ?? 0) + hours;
  const key = periodKey(goal, date);
  const previousPeriod = goal.progressPeriods?.[key];
  const periodHours = (previousPeriod?.hours ?? (goal.settings.frequency === 'weekly' ? previousWeek?.weeklyTimeSpent ?? 0 : 0)) + hours;
  const alreadyEarned = previousPeriod?.earned ?? (goal.settings.frequency === 'weekly' && (previousWeek?.trophies ?? 0) > 0);
  const target = goal.settings.target;
  const earned = alreadyEarned || (target.type === 'hours' && Number.isFinite(target.value) && target.value > 0 && periodHours + 1e-9 >= target.value);
  const weeklyTrophies = [
    ...normalized.weeklyTrophies.filter(w => w.weekNumber !== weekNumber || w.year !== year),
    { weekNumber, year, weeklyTimeSpent: weeklyHours, trophies: (previousWeek?.trophies ?? 0) + (earned && !alreadyEarned ? 1 : 0) },
  ].sort((a, b) => a.year - b.year || a.weekNumber - b.weekNumber);
  const totalTimeSpent = goal.totalTimeSpent + hours;
  const day = format(date, 'yyyy-MM-dd');
  const previousDay = goal.activityDays?.[day];
  // Daily goals may already have dated history from before activityDays existed.
  const dailyPeriod = goal.progressPeriods?.[`daily:${day}`];
  let currentLevel = goal.currentLevel;
  LEVELS.forEach((level, i) => {
    if (totalTimeSpent >= level.requiredHours) currentLevel = Math.max(currentLevel, i + 1);
  });
  return {
    totalTimeSpent,
    activityDays: { ...goal.activityDays, [day]: {
      hours: Math.max(previousDay?.hours ?? 0, dailyPeriod?.hours ?? 0) + hours,
      trophies: Math.max(previousDay?.trophies ?? 0, Number(dailyPeriod?.earned ?? false)) + Number(earned && !alreadyEarned),
    } },
    weeklyTimeSpent: weeklyTrophies.find(w => w.weekNumber === getWeek(now) && w.year === getWeekYear(now))?.weeklyTimeSpent ?? 0,
    practiceDays: [...new Set([...(goal.practiceDays || []), format(date, 'yyyy-MM-dd')])].sort(),
    progressPeriods: { ...goal.progressPeriods, [key]: { hours: periodHours, earned } },
    weeklyTrophies,
    trophies: weeklyTrophies.reduce((sum, week) => sum + week.trophies, 0),
    currentLevel,
  };
}
