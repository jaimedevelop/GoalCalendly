import { useState } from 'react';
import { useStore, shouldShowAds } from '../store';
import { LEVELS } from '../types';
import { AdvertisingDisplay } from './AdvertisingDisplay';

export function NewGoalDialog({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const addGoal = useStore((state) => state.addGoal);
  const { entitlement, isEntitlementLoading, defaultSettings } = useStore();

  const showAds = shouldShowAds(entitlement, isEntitlementLoading);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const newGoal = {
      id: crypto.randomUUID(),
      name,
      note,
      targetHours: parseInt(LEVELS[0].hours.split('-')[0]),
      currentLevel: 1,
      startDate: new Date().toISOString(),
      totalTimeSpent: 0,
      weeklyTimeSpent: 0,
      weeklyGoal: defaultSettings.target.value,
      medals: [],
      trophies: 0,
      practiceDays: [],
      weeklyTrophies: [],
      settings: structuredClone(defaultSettings),
    };

    // The server enforces the active-goal limit; a rejection here means the
    // dialog stays open with the user's input preserved, not a silent failure.
    const ok = await addGoal(newGoal);
    setSubmitting(false);

    if (ok) {
      onClose();
    } else {
      setError(useStore.getState().lastGoalError ?? 'Could not create this goal. Please try again.');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999]">
      <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl">
        <h2 className="text-2xl font-bold mb-4">New Goal</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Goal Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              placeholder="e.g., Learn Python"
              required
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Note
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 h-24 resize-none"
              placeholder="Add initial notes about your goal..."
            />
          </div>
          
          {/* Advertising Suggestion for Free Users */}
          {showAds && (
            <div className="border-t pt-4">
              <AdvertisingDisplay
                displayMethod="suggestion"
                targetLocation="new-goal-dialog"
              />
            </div>
          )}

          {error && (
            <p className="text-sm text-red-600" role="alert">{error}</p>
          )}

          <div className="flex justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-500 rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Creating…' : 'Create Goal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}