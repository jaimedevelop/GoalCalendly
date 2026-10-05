import { Trophy } from 'lucide-react';
import type { CelebrationEvent } from '../../types/celebrations';
import { formatSessionDuration, periodDescription } from '../../services/celebrations';
import { ToastDescription, ToastTitle } from '../ui/toast';
import { TrophyBurst } from './TrophyBurst';

export function TrophyEarnedContent({ event }: { event: CelebrationEvent }) {
  const count = event.periodKeys.length;
  return (
    <div className="relative flex w-full min-w-0 items-center gap-4 py-1">
      <TrophyBurst />
      <div aria-hidden="true" className="celebration-trophy-icon relative flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-600">
        <Trophy className="h-9 w-9" strokeWidth={1.7} />
      </div>
      <div className="relative min-w-0 space-y-1">
        <ToastTitle className="text-lg text-amber-950">{count > 1 ? `${count} trophies earned!` : 'Trophy earned!'}</ToastTitle>
        <ToastDescription className="break-words text-amber-900">
          <span className="block font-medium">{event.goalName}</span>
          <span className="block">{periodDescription(event.periodKeys)} · {formatSessionDuration(event.durationMs)} saved</span>
        </ToastDescription>
        {event.source === 'preview' && <span className="block text-xs font-medium text-amber-800">Animation preview</span>}
      </div>
    </div>
  );
}
