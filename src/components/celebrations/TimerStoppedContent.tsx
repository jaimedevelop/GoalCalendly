import type { CelebrationEvent } from '../../types/celebrations';
import { formatSessionDuration } from '../../services/celebrations';
import { ToastDescription, ToastTitle } from '../ui/toast';
import { CelebrationScene } from './CelebrationScene';

export function TimerStoppedContent({ event }: { event: CelebrationEvent }) {
  const saving = event.saveState === 'saving';
  const description = event.saveState === 'empty' ? 'No time added'
    : `${formatSessionDuration(event.durationMs)} ${saving ? 'recorded locally. Saving…' : 'saved'}`;
  return (
    <div className="celebration-content w-full min-w-0 text-center">
      <CelebrationScene kind="timer" saved={event.saveState === 'saved'} />
      <div className="min-w-0 space-y-2 px-2 pb-2">
        <ToastTitle className="text-xl text-gray-900">Timer stopped</ToastTitle>
        <ToastDescription className="break-words text-gray-600">{event.goalName} · {description}</ToastDescription>
        {event.source === 'preview' && <span className="block text-xs font-medium text-blue-700">Animation preview</span>}
      </div>
    </div>
  );
}
