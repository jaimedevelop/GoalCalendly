import React, { useEffect, useState } from 'react';
import { useStore } from '../store';
import { Timer, StopCircle, Bell } from 'lucide-react';
import { timerNotificationService } from '../services/notifications';

export function ActiveTimer() {
  const { activeTimer, stopTimer, goals } = useStore();
  const [elapsed, setElapsed] = useState(0);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');
  const [showNotificationPrompt, setShowNotificationPrompt] = useState(false);

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

  useEffect(() => {
    // Check notification permission status
    if (timerNotificationService.isNotificationSupported()) {
      setNotificationPermission(timerNotificationService.getPermissionStatus());
    }

    // Listen for service worker messages
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data.type === 'STOP_TIMER') {
          stopTimer();
        }
      });
    }
  }, []);

  useEffect(() => {
    // Show notification prompt when timer starts
    if (activeTimer.isRunning && activeGoal && notificationPermission === 'default') {
      setShowNotificationPrompt(true);
    }

    // Handle notification when timer starts
    if (activeTimer.isRunning && activeGoal && activeTimer.startTime && notificationPermission === 'granted') {
      timerNotificationService.showTimerNotification(activeGoal.name, activeTimer.startTime);
    }

    // Clear notification when timer stops
    if (!activeTimer.isRunning) {
      timerNotificationService.clearNotification();
    }
  }, [activeTimer.isRunning, activeGoal, activeTimer.startTime, notificationPermission]);

  const handleNotificationPermission = async () => {
    const permission = await timerNotificationService.requestPermission();
    setNotificationPermission(permission);
    setShowNotificationPrompt(false);

    if (permission === 'granted' && activeTimer.isRunning && activeGoal) {
      timerNotificationService.showTimerNotification(activeGoal.name, activeTimer.startTime);
    }
  };

  if (!activeTimer.isRunning || !activeGoal) return null;

  const hours = Math.floor(elapsed / (1000 * 60 * 60));
  const minutes = Math.floor((elapsed % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((elapsed % (1000 * 60)) / 1000);

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
    </>
  );
}