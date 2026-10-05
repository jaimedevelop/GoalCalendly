import { useEffect, useState } from 'react';
import { useStore } from '../store';
import { Timer, StopCircle, Bell } from 'lucide-react';
import { timerNotificationService } from '../services/notifications';

function TimerRow({ goalName, startTime, onStop }: { goalName: string; startTime: number; onStop: () => void }) {
  const [elapsed, setElapsed] = useState(() => Date.now() - startTime);

  useEffect(() => {
    setElapsed(Date.now() - startTime);
    const interval = setInterval(() => setElapsed(Date.now() - startTime), 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  const rows = activeTimers.flatMap((t) => {
    const goal = goals.find((g) => g.id === t.goalId);
    return goal && t.startTime ? [{ goal, startTime: t.startTime }] : [];
  });

  return (
    <>
      {showNotificationPrompt && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-blue-500 text-white rounded-lg shadow-lg p-4 z-50">
          <div className="flex items-center space-x-4">
            <Bell className="w-5 h-5" />
            <span className="text-sm">Keep timer visible in status bar?</span>
            <button
              onClick={handleNotificationPermission}
              className="px-3 py-1 bg-white text-blue-500 rounded text-sm font-medium"
            >
              Allow
            </button>
            <button
              onClick={() => setShowNotificationPrompt(false)}
              className="px-3 py-1 bg-blue-600 text-white rounded text-sm"
            >
              No
            </button>
          </div>
        </div>
      )}
      
      <div className="fixed bottom-4 right-4 bg-white rounded-lg shadow-lg p-4 space-y-2 max-h-48 overflow-y-auto">
        {rows.map(({ goal, startTime }) => (
          <TimerRow key={goal.id} goalName={goal.name} startTime={startTime} onStop={() => stopTimer(goal.id)} />
        ))}
      </div>
    </>
  );
}
