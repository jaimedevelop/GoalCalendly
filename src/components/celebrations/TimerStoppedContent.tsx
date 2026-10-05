import { Check, Timer } from 'lucide-react';
import type { CelebrationEvent } from '../../types/celebrations';
import { formatSessionDuration } from '../../services/celebrations';
import { ToastDescription, ToastTitle } from '../ui/toast';

export function TimerStoppedContent({ event }: { event: CelebrationEvent }) {
  const saving = event.saveState === 'saving';
  const description = event.saveState === 'empty' ? 'No time added'
    : `${formatSessionDuration(event.durationMs)} ${saving ? 'recorded locally. Saving…' : 'saved'}`;
  return (
    <div className="flex min-w-0 items-center gap-4">
      <div aria-hidden="true" className={`celebration-timer-icon flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${saving ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'}`}>
        {saving ? <Timer className="h-6 w-6" /> : <Check className="h-6 w-6" />}
      </div>
      <div className="min-w-0 space-y-1">
        <ToastTitle className="text-base text-gray-900">Timer stopped</ToastTitle>
        <ToastDescription className="break-words text-gray-600">{event.goalName} · {description}</ToastDescription>
        {event.source === 'preview' && <span className="block text-xs font-medium text-blue-700">Animation preview</span>}
      </div>
    </div>
  );
}
