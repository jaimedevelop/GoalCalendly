import type { CSSProperties } from 'react';

export function TrophyBurst() {
  return (
    <div className="trophy-burst pointer-events-none absolute inset-0 overflow-hidden rounded-2xl" aria-hidden="true">
      {Array.from({ length: 16 }, (_, index) => {
        const angle = (index / 16) * Math.PI * 2;
        return <span key={index} className="trophy-particle" style={{
          '--particle-x': `${Math.cos(angle) * (70 + index % 3 * 22)}px`,
          '--particle-y': `${Math.sin(angle) * (45 + index % 4 * 12)}px`,
          '--particle-turn': `${index * 47}deg`,
          backgroundColor: ['#d97706', '#fbbf24', '#34d399', '#93c5fd'][index % 4],
          animationDelay: `${index % 4 * 35}ms`,
        } as CSSProperties} />;
      })}
    </div>
  );
}
