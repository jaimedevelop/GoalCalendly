import type { CelebrationEvent } from '../../types/celebrations';
import { formatSessionDuration, periodDescription } from '../../services/celebrations';
import { ToastDescription, ToastTitle } from '../ui/toast';
import { CelebrationScene } from './CelebrationScene';

export function TrophyEarnedContent({ event }: { event: CelebrationEvent }) {
  const count = event.periodKeys.length;
  return (
    <div className="celebration-content w-full min-w-0 text-center">
      <CelebrationScene kind="trophy" />
      <div className="relative min-w-0 space-y-2 px-2 pb-2">
        <ToastTitle className="text-2xl text-amber-950">{count > 1 ? `${count} trophies earned!` : 'Trophy earned!'}</ToastTitle>
        <ToastDescription className="break-words text-amber-900">
          <span className="block font-medium">{event.goalName}</span>
          <span className="block">{periodDescription(event.periodKeys)} · {formatSessionDuration(event.durationMs)} saved</span>
        </ToastDescription>
        {event.source === 'preview' && <span className="block text-xs font-medium text-amber-800">Animation preview</span>}
      </div>
    </div>
  );
}
