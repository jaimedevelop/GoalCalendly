import React, { useEffect, useState } from 'react';
import { useStore } from '../store';
import { Timer, StopCircle } from 'lucide-react';

export function ActiveTimer() {
  const { activeTimer, stopTimer, goals } = useStore();
  const [elapsed, setElapsed] = useState(0);

  const activeGoal = goals.find((g) => g.id === activeTimer.goalId);

  useEffect(() => {
    if (!activeTimer.isRunning) return;

    const interval = setInterval(() => {
      if (activeTimer.startTime) {
        setElapsed(Date.now() - activeTimer.startTime);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [activeTimer.isRunning, activeTimer.startTime]);

  if (!activeTimer.isRunning || !activeGoal) return null;

  const hours = Math.floor(elapsed / (1000 * 60 * 60));
  const minutes = Math.floor((elapsed % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((elapsed % (1000 * 60)) / 1000);

  return (
    <div className="fixed bottom-4 right-4 bg-white rounded-lg shadow-lg p-4">
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2">
          <Timer className="w-5 h-5 text-blue-500 animate-pulse" />
          <span className="font-mono text-lg">
            {String(hours).padStart(2, '0')}:{String(minutes).padStart(2, '0')}:
            {String(seconds).padStart(2, '0')}
          </span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-600">{activeGoal.name}</span>
          <button
            onClick={() => stopTimer()}
            className="p-2 text-red-500 hover:bg-red-50 rounded-full"
          >
            <StopCircle className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}