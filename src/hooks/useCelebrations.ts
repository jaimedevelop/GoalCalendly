import { useEffect, useRef } from 'react';
import { useStore } from '../store';
import type { CelebrationEvent } from '../types/celebrations';
import { clearToasts, discardToast, getToast, toast } from './useToast';

/** Explicit action events only: loading or normalizing goal data never produces a popup. */
export function useCelebrations() {
  const events = useStore(state => state.celebrations);
  const userId = useStore(state => state.user?.uid);
  const generation = useStore(state => state.authGeneration);
  const seen = useRef(new Map<string, CelebrationEvent>());

  useEffect(() => {
    clearToasts();
    seen.current.clear();
  }, [generation]);

  useEffect(() => {
    const present = new Set(events.map(event => event.id));
    for (const id of seen.current.keys()) {
      if (!present.has(id)) {
        const toastId = `celebration:${id}`;
        // Leave a user-dismissed item mounted long enough for its exit animation.
        if (getToast(toastId)?.open) discardToast(toastId);
        seen.current.delete(id);
      }
    }
    for (const event of events) {
      if (!userId || event.userId !== userId || event.dismissed || event.suppressed || seen.current.get(event.id) === event) continue;
      seen.current.set(event.id, event);
      toast({
        id: `celebration:${event.id}`, celebration: event,
        variant: event.kind === 'error' ? 'error' : 'success',
        type: event.kind === 'error' ? 'foreground' : 'background',
        duration: event.saveState === 'saving' ? Infinity : event.source === 'preview' ? 12000
          : event.kind === 'trophy' ? 10000 : event.kind === 'timer' ? 8000 : 5000,
        onDismiss: () => useStore.getState().dismissCelebration(event.id),
      });
    }
  }, [events, userId, generation]);
}
