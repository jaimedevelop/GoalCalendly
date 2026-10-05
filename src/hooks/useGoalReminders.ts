import { useEffect } from 'react';
import { useStore } from '../store';
import { toast } from './useToast';
import { reminderDue, reminderKey, showReminderNotification } from '../services/reminders';
import { normalizeProgress } from '../services/practiceTime';

export function useGoalReminders(uid?: string) {
  useEffect(() => {
    if (!uid) return;
    const delivered = new Set<string>();
    const check = () => {
      const state = useStore.getState();
      if (state.user?.uid !== uid) return;
      const now = new Date();
      // Refresh cached weekly totals even if the app stays open across midnight.
      const normalized = state.goals.map(goal => normalizeProgress(goal, now));
      if (normalized.some((goal, i) => goal.weeklyTimeSpent !== state.goals[i].weeklyTimeSpent)) state.setGoals(normalized);
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
