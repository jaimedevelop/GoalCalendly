import type { CSSProperties } from 'react';

export function TrophyBurst() {
  return (
    <span className="trophy-burst pointer-events-none absolute inset-0 overflow-hidden rounded-2xl" aria-hidden="true">
      {Array.from({ length: 36 }, (_, index) => {
        const angle = (index / 18) * Math.PI * 2;
        return <span key={index} className="trophy-particle" style={{
          '--particle-x': `${Math.cos(angle) * (80 + index % 3 * 25)}px`,
          '--particle-y': `${Math.sin(angle) * (65 + index % 4 * 14)}px`,
          '--particle-turn': `${index * 47}deg`,
          backgroundColor: ['#d97706', '#fbbf24', '#34d399', '#93c5fd'][index % 4],
          animationDelay: `${650 + Math.floor(index / 18) * 850 + index % 4 * 50}ms`,
        } as CSSProperties} />;
      })}
    </span>
  );
}
