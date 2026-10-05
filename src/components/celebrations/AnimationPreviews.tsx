import { Timer, Trophy } from 'lucide-react';
import { useStore } from '../../store';
import { useState } from 'react';
import { useReducedMotion } from '../../hooks/useReducedMotion';

export function AnimationPreviews() {
  const isAdmin = useStore(state => state.user?.isTrustedAdmin);
  const preview = useStore(state => state.previewCelebration);
  const reducedMotion = useReducedMotion();
  const [fullMotion, setFullMotion] = useState(false);
  if (!isAdmin) return null;
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm" aria-labelledby="animation-previews-title">
      <h2 id="animation-previews-title" className="text-lg font-semibold text-gray-900">Animation previews</h2>
      <p className="mt-1 text-sm text-gray-600">Test the timer and trophy popups with sample data. Your goals and recorded time stay unchanged.</p>
      <div className="mt-5 flex flex-wrap gap-3">
        <button type="button" onClick={() => preview('timer', fullMotion)} aria-label="Preview timer animation"
          className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-5 py-3 font-medium text-blue-700 hover:bg-blue-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
          <Timer className="h-5 w-5" aria-hidden="true" /> Timer
        </button>
        <button type="button" onClick={() => preview('trophy', fullMotion)} aria-label="Preview trophy animation"
          className="inline-flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-5 py-3 font-medium text-amber-800 hover:bg-amber-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600">
          <Trophy className="h-5 w-5" aria-hidden="true" /> Trophy
        </button>
      </div>
      {reducedMotion && <div className="mt-4 rounded-lg bg-blue-50 p-3 text-sm text-blue-900">
        <p>Your device has reduced motion enabled. Previews are static unless you choose full motion.</p>
        <label className="mt-2 flex items-center gap-2 font-medium">
          <input type="checkbox" checked={fullMotion} onChange={e => setFullMotion(e.target.checked)} />
          Play full motion in previews
        </label>
      </div>}
      <p className="mt-4 text-xs text-gray-500">Click either icon to preview. Inside the popup, tap the timer or trophy, or choose Replay animation, to play it again.</p>
    </section>
  );
}
