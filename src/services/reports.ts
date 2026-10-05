import { addDays, endOfDay, endOfMonth, endOfWeek, format, getWeek, getWeekYear, parseISO, startOfDay, startOfMonth, startOfWeek } from 'date-fns';
import type { Goal } from '../types';

export type ReportFrequency = 'daily' | 'weekly' | 'monthly';

export function reportRange(frequency: ReportFrequency, date: Date) {
  const start = frequency === 'monthly' ? startOfMonth(date) : frequency === 'weekly' ? startOfWeek(date) : startOfDay(date);
  const end = frequency === 'monthly' ? endOfMonth(date) : frequency === 'weekly' ? endOfWeek(date) : endOfDay(date);
  return { start, end };
}

export function buildReport(goals: Goal[], frequency: ReportFrequency, date: Date) {
  const { start, end } = reportRange(frequency, date);
  const first = format(start, 'yyyy-MM-dd');
  const last = format(end, 'yyyy-MM-dd');
  const inRange = (day: string) => day >= first && day <= last;
  const practiceDays = new Set<string>();
  const rows = goals.map(goal => {
    const days = { ...goal.activityDays };
    // Merge legacy daily totals without counting the same hours twice.
    Object.entries(goal.progressPeriods ?? {}).forEach(([key, period]) => {
      if (!key.startsWith('daily:')) return;
      const day = key.slice(6);
      days[day] = { hours: Math.max(days[day]?.hours ?? 0, period.hours), trophies: Math.max(days[day]?.trophies ?? 0, Number(period.earned)) };
    });
    let hours = 0;
    let trophies = 0;
    Object.entries(days).forEach(([day, activity]) => {
      if (inRange(day)) { hours += activity.hours; trophies += activity.trophies; }
    });
    let incomplete = false;
    const month = goal.progressPeriods?.[`monthly:${format(start, 'yyyy-MM')}`];
    if (frequency === 'weekly') {
      const week = goal.weeklyTrophies?.find(w => w.weekNumber === getWeek(start) && w.year === getWeekYear(start));
      const period = goal.progressPeriods?.[`weekly:${first}`];
      hours = Math.max(hours, week?.weeklyTimeSpent ?? 0, period?.hours ?? 0);
      trophies = Math.max(trophies, week?.trophies ?? 0, Number(period?.earned ?? false));
    } else {
      // Weekly-only historical records cannot be split accurately across days/months.
      const checkedWeeks = new Set<string>();
      for (let cursor = start; cursor <= end; cursor = addDays(cursor, 1)) {
        const weekStart = startOfWeek(cursor);
        const key = format(weekStart, 'yyyy-MM-dd');
        if (checkedWeeks.has(key)) continue;
        checkedWeeks.add(key);
        const week = goal.weeklyTrophies?.find(w => w.weekNumber === getWeek(cursor) && w.year === getWeekYear(cursor));
        const period = goal.progressPeriods?.[`weekly:${key}`];
        const weeklyHours = Math.max(week?.weeklyTimeSpent ?? 0, period?.hours ?? 0);
        const weeklyTrophies = Math.max(week?.trophies ?? 0, Number(period?.earned ?? false));
        let datedHours = 0;
        let datedTrophies = 0;
        for (let day = weekStart; day <= endOfWeek(cursor); day = addDays(day, 1)) {
          const activity = days[format(day, 'yyyy-MM-dd')];
          datedHours += activity?.hours ?? 0;
          datedTrophies += activity?.trophies ?? 0;
        }
        if (frequency === 'monthly' && weekStart >= start && endOfWeek(cursor) <= end) {
          // A whole week belongs to this month, so its saved total is safe to use.
          hours += Math.max(0, weeklyHours - datedHours);
          trophies += Math.max(0, weeklyTrophies - datedTrophies);
        } else if (weeklyHours > datedHours + 1e-9 || weeklyTrophies > datedTrophies) incomplete = true;
      }
    }
    if (frequency === 'monthly' && month) {
      hours = Math.max(hours, month.hours);
      trophies = Math.max(trophies, Number(month.earned));
    }
    const goalDays = new Set((goal.practiceDays ?? []).filter(inRange));
    Object.entries(days).forEach(([day, activity]) => { if (inRange(day) && activity.hours > 0) goalDays.add(day); });
    goalDays.forEach(day => practiceDays.add(day));
    const completed = !!goal.completed && !!goal.completedDate && parseISO(goal.completedDate) >= start && parseISO(goal.completedDate) <= end;
    return { goal, hours, trophies, practiceDays: goalDays.size, completed, incomplete };
  });
  return {
    start, end, rows,
    hours: rows.reduce((sum, row) => sum + row.hours, 0),
    trophies: rows.reduce((sum, row) => sum + row.trophies, 0),
    practiceDays: practiceDays.size,
    completed: rows.filter(row => row.completed).length,
    activeGoals: rows.filter(row => row.hours > 0 || row.practiceDays > 0).length,
    incomplete: rows.some(row => row.incomplete),
  };
}
