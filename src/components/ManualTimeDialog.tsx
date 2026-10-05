import { useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { format } from 'date-fns';
import { Goal } from '../types';
import { useStore } from '../store';

export function ManualTimeDialog({ goal, date, onClose }: { goal: Goal; date: Date; onClose: () => void }) {
  const [hours, setHours] = useState('0');
  const [minutes, setMinutes] = useState('30');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submitting = useRef(false);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (submitting.current) return;
    const h = Number(hours);
    const m = Number(minutes);
    const duration = h * 60 + m;
    if (!Number.isInteger(h) || !Number.isInteger(m) || h < 0 || m < 0 || m > 59 || duration <= 0 || duration > 1440) {
      setError('Enter a duration between 1 minute and 24 hours.');
      return;
    }
    submitting.current = true;
    setSaving(true);
    setError(null);
    try {
      const ok = await useStore.getState().addManualTime(goal.id, date, duration);
      if (ok) onClose();
      else setError(useStore.getState().lastGoalError ?? 'Could not save your time. Please try again.');
    } catch {
      setError('Could not save your time. Please try again.');
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  }

  return (
    <Dialog.Root open onOpenChange={open => { if (!open && !submitting.current) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-[9998]" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg p-6 w-[calc(100%-2rem)] max-w-md shadow-xl z-[9999]">
          <Dialog.Title className="text-xl font-semibold">Add time manually</Dialog.Title>
          <Dialog.Description className="text-sm text-gray-600 mt-2">
            {goal.name} · {format(date, 'MMMM d, yyyy')}. Add the time you spent working on this task.
          </Dialog.Description>
          <form onSubmit={save} className="mt-5 space-y-4">
            <fieldset disabled={saving} className="flex gap-4">
              <label className="flex-1 text-sm font-medium">Hours
                <input type="number" min="0" max="24" step="1" value={hours} onChange={e => setHours(e.target.value)} className="mt-1 w-full border rounded-md p-2" />
              </label>
              <label className="flex-1 text-sm font-medium">Minutes
                <input type="number" min="0" max="59" step="1" value={minutes} onChange={e => setMinutes(e.target.value)} className="mt-1 w-full border rounded-md p-2" />
              </label>
            </fieldset>
            <p className="text-xs text-gray-500">This adds to any time already recorded for this task.</p>
            {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" disabled={saving} onClick={onClose} className="px-4 py-2 bg-gray-100 rounded-md disabled:opacity-50">Cancel</button>
              <button type="submit" disabled={saving} className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50">{saving ? 'Saving…' : 'Save time'}</button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
