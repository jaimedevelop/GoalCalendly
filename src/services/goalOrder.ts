import type { Goal } from '../types';

/** Running sessions first, newest first; then most recently worked-on goals. */
export function sortActiveGoals(goals: Goal[], activeTimers: { goalId: string }[]): Goal[] {
  const runningOrder = new Map(activeTimers.map((timer, index) => [timer.goalId, index]));
  return goals.filter(goal => !goal.completed).sort((a, b) => {
    const aIndex = runningOrder.get(a.id);
    const bIndex = runningOrder.get(b.id);
    if (aIndex !== undefined && bIndex !== undefined) return aIndex - bIndex;
    if (aIndex !== undefined) return -1;
    if (bIndex !== undefined) return 1;
    return (b.lastTimerStartedAt ?? 0) - (a.lastTimerStartedAt ?? 0);
  });
}
