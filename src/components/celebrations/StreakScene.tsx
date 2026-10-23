import { useState, type CSSProperties } from 'react';
import { RotateCcw } from 'lucide-react';

export function StreakScene({ days }: { days: 3 | 5 | 7 }) {
  const [run, setRun] = useState(0);
  const name = days === 3 ? 'celebration dance' : days === 5 ? 'rocket launch' : 'confetti burst';
  const replay = () => setRun(value => value + 1);
  return <div className="celebration-scene celebration-scene-streak">
    <button type="button" className="celebration-art-button" aria-label={`Replay ${name}`} onClick={replay} data-radix-toast-announce-exclude>
      <span key={`${days}:${run}`} className={`celebration-art streak-scene streak-scene-${days}`} aria-hidden="true">
        <span className="streak-orbit" /><span className="streak-spotlight" />
        {Array.from({ length: 18 }, (_, i) => <span key={i} className="streak-star" style={{ left: `${(i * 37 + 9) % 100}%`, top: `${(i * 23 + 7) % 85}%`, '--delay': `${i * 90}ms` } as CSSProperties} />)}
        {days === 3 ? <svg viewBox="0 0 220 200" className="streak-illustration" fill="none">
          <ellipse cx="110" cy="178" rx="50" ry="7" fill="#c4b5fd" />
          <g className="streak-dancer">
            <path d="m95 117-19 42-15 9m64-51 20 42 15 9" stroke="#7c3aed" strokeWidth="13" strokeLinecap="round" />
            <path d="M87 83q23-16 46 0l-5 40H92Z" fill="#8b5cf6" />
            <path className="streak-arm-left" d="M89 88 65 100 44 77" stroke="#f59e0b" strokeWidth="11" strokeLinecap="round" />
            <path className="streak-arm-right" d="m132 88 24 12 20-28" stroke="#f59e0b" strokeWidth="11" strokeLinecap="round" />
            <circle cx="110" cy="54" r="25" fill="#fcd34d" />
            <path d="M85 49q-3-33 26-26 26-2 25 27l-12-10-24 3Z" fill="#312e81" />
            <path d="M88 91l22 12 22-12" stroke="#c4b5fd" strokeWidth="4" />
            <circle cx="93" cy="62" r="5" fill="#fb7185" opacity=".6"/><circle cx="127" cy="62" r="5" fill="#fb7185" opacity=".6"/>
            <path d="M98 54h1m22 0h1m-21 10q9 10 18 0" stroke="#78350f" strokeWidth="3" strokeLinecap="round" />
          </g>
          <text x="24" y="48" fill="#7c3aed" fontSize="27">♪</text><text x="175" y="42" fill="#db2777" fontSize="30">♫</text>
        </svg> : days === 5 ? <svg viewBox="0 0 220 200" className="streak-illustration" fill="none">
          <circle cx="40" cy="35" r="3" fill="#a78bfa" /><circle cx="175" cy="67" r="4" fill="#a78bfa" />
          <g className="streak-rocket">
            <path className="streak-exhaust" d="m95 132 15 51 15-51" fill="#f97316" /><path d="m103 133 7 30 7-30" fill="#fde047" />
            <path d="M91 94 72 137l25-9m32-34 19 43-25-9" fill="#7c3aed" />
            <path d="M110 22q-32 30-20 106h40q12-76-20-106Z" fill="#f8fafc" stroke="#7c3aed" strokeWidth="4" />
            <path d="M110 22q-15 14-21 34h42q-6-20-21-34" fill="#a78bfa" />
            <circle cx="110" cy="83" r="16" fill="#0f172a" stroke="#c4b5fd" strokeWidth="4" />
            <circle cx="110" cy="83" r="11" fill="#38bdf8" />
            <path d="m103 79 7-5" stroke="white" strokeWidth="4" strokeLinecap="round" />
            <path d="M97 112h26M99 118h22" stroke="#94a3b8" strokeWidth="3" />
          </g>
        </svg> : <>
          {Array.from({ length: 90 }, (_, index) => <i key={index} className="streak-confetti" style={{
            '--x': `${((index * 73) % 401) - 200}px`, '--y': `${140 + (index * 47) % 140}px`,
            '--turn': `${index * 71}deg`, '--delay': `${index % 9 * 80}ms`,
            backgroundColor: ['#7c3aed', '#ec4899', '#f59e0b', '#10b981', '#38bdf8'][index % 5],
          } as CSSProperties} />)}
          <span className="streak-medal"><span className="streak-seven">7<span>DAY STREAK</span></span></span>
        </>}
        <span className="celebration-art-label">{days === 3 ? 'FINDING YOUR RHYTHM' : days === 5 ? 'YOU ARE TAKING OFF' : 'A WHOLE WEEK OF WINS'}</span>
      </span>
    </button>
    <button type="button" className="celebration-replay" onClick={replay} data-radix-toast-announce-exclude><RotateCcw size={14} aria-hidden="true" /> Replay animation</button>
  </div>;
}
