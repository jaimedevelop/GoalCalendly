import { useEffect } from 'react';
import { useStore } from '../store';
import { toast } from './useToast';
import { reminderDue, reminderKey, showReminderNotification } from '../services/reminders';
import { normalizeProgress } from '../services/practiceTime';
import { format } from 'date-fns';

export function useGoalReminders(uid?: string) {
  useEffect(() => {
    if (!uid) return;
    const delivered = new Set<string>();
    let lastDay: string | undefined;
    const check = () => {
      const state = useStore.getState();
      if (state.user?.uid !== uid) return;
      const now = new Date();
      const day = format(now, 'yyyy-MM-dd');
      const changedDay = lastDay !== undefined && lastDay !== day;
      lastDay = day;
      // Refresh date-dependent labels and daily/monthly progress at midnight,
      // even when the cached weekly hours have not changed.
      const normalized = state.goals.map(goal => normalizeProgress(goal, now));
      if (changedDay || normalized.some((goal, i) => goal.weeklyTimeSpent !== state.goals[i].weeklyTimeSpent ||
          goal.trophies !== state.goals[i].trophies)) state.setGoals(normalized);
      const due = state.goals.filter(goal => {
        if (state.activeTimers.some(t => t.goalId === goal.id) || !reminderDue(goal, now, null)) return false;
        const key = reminderKey(uid, goal, now);
        if (delivered.has(key)) return false;
        try { if (localStorage.getItem(key)) return false; } catch { /* Session fallback. */ }
        return true;
      });
      if (!due.length) return;
      const description = `Time to work on: ${due.map(goal => goal.name).join(', ')}.`;
      toast({ title: 'Goal reminder', description, duration: 15000 });
      if (due.some(goal => goal.settings.notifications)) {
        void showReminderNotification(`Time to work on: ${due.filter(goal => goal.settings.notifications).map(goal => goal.name).join(', ')}.`);
      }
      due.forEach(goal => {
        const key = reminderKey(uid, goal, now);
        delivered.add(key);
        try { localStorage.setItem(key, '1'); } catch { /* Session fallback. */ }
      });
    };
    check();
    const interval = window.setInterval(check, 30000);
    window.addEventListener('focus', check);
    return () => { clearInterval(interval); window.removeEventListener('focus', check); };
  }, [uid]);
}
