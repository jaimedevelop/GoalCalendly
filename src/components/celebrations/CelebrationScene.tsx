import { useId, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { TrophyBurst } from './TrophyBurst';

/** Replay remounts only the artwork; the toast, focus, and saved data stay intact. */
export function CelebrationScene({ kind, saved = true }: { kind: 'timer' | 'trophy'; saved?: boolean }) {
  const [run, setRun] = useState(0);
  const gradient = useId().replace(/:/g, '');
  const replay = () => setRun(value => value + 1);
  return (
    <div className={`celebration-scene celebration-scene-${kind}`} data-saved={saved}>
      <button type="button" className="celebration-art-button" aria-label={`Replay ${kind} celebration`}
        disabled={!saved} onClick={replay} data-radix-toast-announce-exclude>
        <span key={run} className="celebration-art" data-run={run} aria-hidden="true">
          <span className="celebration-halo" />
          {kind === 'timer' ? <>
            <span className="timer-ripple timer-ripple-one" /><span className="timer-ripple timer-ripple-two" />
            <svg viewBox="0 0 200 200" className="timer-artwork" fill="none">
              <circle cx="100" cy="104" r="77" className="timer-track" />
              <circle cx="100" cy="104" r="77" pathLength="100" className="timer-progress" />
              <path d="M88 13h24M100 13v14M150 38l10-10" stroke="currentColor" strokeWidth="8" strokeLinecap="round" />
              <circle cx="100" cy="104" r="61" className="timer-face" />
              {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map(angle =>
                <path key={angle} d="M100 51v5" transform={`rotate(${angle} 100 104)`} className="timer-tick" />)}
              <g className="timer-hands">
                <path d="M100 104V65" className="timer-hand" />
                <path d="M100 104l-24 16" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
                <circle cx="100" cy="104" r="6" fill="currentColor" />
              </g>
              {saved && <path d="m76 104 17 18 34-37" pathLength="100" className="timer-check" />}
            </svg>
            {saved && <span className="celebration-art-label">TIME WELL SPENT</span>}
          </> : <>
            <span className="trophy-rays" />
            <TrophyBurst />
            <svg viewBox="0 0 200 200" className="trophy-artwork" fill="none">
              <defs>
                <linearGradient id={gradient} x1="50" y1="35" x2="145" y2="145" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#fff4b3" /><stop offset=".4" stopColor="#fbbf24" /><stop offset="1" stopColor="#d97706" />
                </linearGradient>
              </defs>
              <ellipse cx="100" cy="178" rx="47" ry="7" fill="#b45309" opacity=".13" />
              <g className="trophy-cup">
                <path d="M58 51H34v23c0 23 13 36 35 37M142 51h24v23c0 23-13 36-35 37" stroke="#d97706" strokeWidth="10" strokeLinejoin="round" />
                <path d="M57 37h86v39c0 32-18 53-43 53S57 108 57 76V37Z" fill={`url(#${gradient})`} stroke="#d97706" strokeWidth="3" />
                <path d="M69 48v27c0 18 5 30 14 37" stroke="#fffbeb" strokeWidth="6" strokeLinecap="round" opacity=".7" />
                <path d="M91 127h18v27H91z" fill="#d97706" />
                <path d="M74 153h52l9 15H65l9-15Z" fill={`url(#${gradient})`} stroke="#b45309" strokeWidth="3" />
                <rect x="62" y="167" width="76" height="10" rx="4" fill="#92400e" />
                <path d="m100 57 6 13 14 2-10 10 2 14-12-7-12 7 2-14-10-10 14-2 6-13Z" fill="#fffbeb" />
                <path className="trophy-glint" d="m137 34 3 10 10 3-10 3-3 10-3-10-10-3 10-3 3-10Z" fill="white" />
              </g>
            </svg>
            <span className="celebration-art-label">YOU DID IT!</span>
          </>}
        </span>
      </button>
      {saved && <button type="button" className="celebration-replay" onClick={replay} data-radix-toast-announce-exclude>
        <RotateCcw size={14} aria-hidden="true" /> Replay animation
      </button>}
    </div>
  );
}
