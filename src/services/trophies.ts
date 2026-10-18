import type { Goal } from '../types';

export function weeklyTrophyCount(goal: Goal, hours: number): number {
  const target = goal.settings.target;
  return target.type === 'hours' && Number.isFinite(target.value) && target.value > 0 && Number.isFinite(hours)
    ? Math.max(0, Math.floor((hours + 1e-9) / target.value)) : 0;
}
