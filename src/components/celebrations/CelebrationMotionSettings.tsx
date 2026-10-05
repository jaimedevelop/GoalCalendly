import { useStore } from '../../store';
import { useReducedMotion } from '../../hooks/useReducedMotion';

export function CelebrationMotionSettings() {
  const fullMotion = useStore(state => state.fullCelebrationMotion);
  const setFullMotion = useStore(state => state.setFullCelebrationMotion);
  const reducedMotion = useReducedMotion();
  return (
    <div className="space-y-2 rounded-lg bg-blue-50 p-3 text-sm text-blue-900">
      <label className="flex items-center gap-2 font-medium">
        <input type="checkbox" checked={fullMotion} onChange={event => setFullMotion(event.target.checked)} />
        Play full motion across the app
      </label>
      <p>Applies to timer and trophy celebrations on every page, including previews. Saved on this device. Turn off to follow your device’s motion setting.</p>
      {reducedMotion && !fullMotion && <p>Your device has reduced motion enabled, so celebrations currently appear without movement.</p>}
    </div>
  );
}
