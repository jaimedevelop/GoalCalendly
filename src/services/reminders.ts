import { format } from 'date-fns';
import { Goal } from '../types';
import { currentProgress } from './practiceTime';

export function reminderKey(uid: string, goal: Goal, now: Date): string {
  return `goal-reminder:${uid}:${goal.id}:${format(now, 'yyyy-MM-dd')}`;
}

export function reminderDue(goal: Goal, now: Date, activeGoalId: string | null): boolean {
  if (!goal.settings.reminders || goal.completed || goal.id === activeGoalId) return false;
  const time = goal.settings.reminderTime || '18:00';
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time) || format(now, 'HH:mm') < time) return false;
  const target = goal.settings.target;
  return !(target.type === 'hours' && target.value > 0 && currentProgress(goal, now) + 1e-9 >= target.value);
}

export async function requestReminderPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false;
  return (Notification.permission === 'granted' ||
    (Notification.permission === 'default' && await Notification.requestPermission() === 'granted'));
}

export async function showReminderNotification(body: string): Promise<void> {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    const registration = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : undefined;
    if (registration) await registration.showNotification('Goal reminder', { body, tag: 'goal-reminder' });
    else new Notification('Goal reminder', { body, tag: 'goal-reminder' });
  } catch (error) {
    console.warn('Browser reminder unavailable; in-app reminder was shown.', error);
  }
}
