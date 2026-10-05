import React, { useState } from 'react';
import { Timer, Trophy, Settings, Pencil, Trash2, CalendarIcon } from 'lucide-react';
import { Goal } from '../types';
import { useStore } from '../store';
import { formatDistanceToNow, format, getWeek, getWeekYear, subWeeks } from 'date-fns';
import { Calendar } from './Calendar';
import { currentProgress } from '../services/practiceTime';
import { ManualTimeDialog } from './ManualTimeDialog';
import { SettingsDialog } from './SettingsDialog';
import { useToast } from '../hooks/useToast';
import { reopenGoal } from '../services/goals.js';

interface GoalCardProps {
  goal: Goal;
  viewType?: 'top' | 'double' | 'all';
}

export function GoalCard({ goal, viewType = 'top' }: GoalCardProps) {
  const { startTimer, activeTimer, updateGoal, deleteGoal, completeGoalById, setGoals, goals } = useStore();
  const [showSettings, setShowSettings] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(goal.name);
  const progress = currentProgress(goal);
  const target = goal.settings.target;
  const isActive = activeTimer.goalId === goal.id;
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [manualDate, setManualDate] = useState<Date | null>(null);
  const { toast } = useToast();

  const handleNoteChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    updateGoal(goal.id, { note: e.target.value });
  };

  const handleCompletedChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const isCompleted = e.target.checked;

    if (isCompleted) {
      const ok = await completeGoalById(goal.id);
      if (ok) {
        toast({
          title: "Goal Completed!",
          description: `Congratulations on completing "${goal.name}"! You can find it in the Completed Goals section.`,
          variant: "success",
          duration: 5000
        });
      } else {
        toast({
          title: "Could not complete goal",
          description: useStore.getState().lastGoalError ?? 'Please try again.',
          variant: "destructive",
        });
      }
      return;
    }

    // Un-checking reopens the goal, which counts against the active-goal
    // limit server-side, so it goes through reopenGoal rather than a plain update.
    const result = await reopenGoal(goal.id);
    if (result.ok) {
      setGoals(goals.map((g) => (g.id === goal.id ? { ...g, completed: false, completedDate: undefined } : g)));
    } else {
      toast({
        title: "Could not reopen goal",
        description: result.error?.message ?? 'You may be at your active goal limit.',
        variant: "destructive",
      });
    }
  };

  const handleNameEdit = () => {
    if (isEditing && editedName.trim()) {
      updateGoal(goal.id, { name: editedName.trim() });
    }
    setIsEditing(!isEditing);
  };

  const handleNameKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && editedName.trim()) {
      handleNameEdit();
    }
  };

  const handleDelete = () => {
    if (window.confirm(`Are you sure you want to delete the goal "${goal.name}"? This action cannot be undone.`)) {
      deleteGoal(goal.id);
    }
  };

  const renderCompactCalendar = () => {
    const practiceCount = goal.practiceDays?.length || 0;
    const lastPracticeDay = goal.practiceDays?.length 
      ? format(new Date(goal.practiceDays[goal.practiceDays.length - 1]), 'MMM d')
      : 'Never';

    return (
      <div className="flex items-center justify-between text-sm text-gray-600 mt-2">
        <div className="flex items-center space-x-2">
          <CalendarIcon className="w-4 h-4" />
          <span>{practiceCount} practice days</span>
        </div>
        <span>Last: {lastPracticeDay}</span>
      </div>
    );
  };

  const renderWeeklyTrophies = () => {
    if (viewType !== 'top') return null;

    const currentDate = new Date();
    const weeks = [subWeeks(currentDate, 2), subWeeks(currentDate, 1), currentDate];

    return (
      <div className="mt-4 border rounded-lg p-4 bg-gray-50">
        <div className="flex justify-between items-center">
          {weeks.map((date) => {
            const weekNum = getWeek(date);
            const currentYear = getWeekYear(date);
            const weekTrophy = goal.weeklyTrophies?.find(
              w => w.weekNumber === weekNum && w.year === currentYear
            );
            
            return (
              <div key={weekNum} className="flex flex-col items-center space-y-1">
                <div className="text-sm font-medium text-gray-600">W{weekNum}</div>
                <div className="flex items-center space-x-1">
                  <Trophy className="w-4 h-4 text-yellow-500" />
                  <span className="font-medium">{weekTrophy?.trophies || 0}</span>
                </div>
                <div className="text-xs text-gray-500">
                  {weekTrophy?.weeklyTimeSpent?.toFixed(1) || 0}h
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center space-x-2">
          {isEditing ? (
            <input
              type="text"
              value={editedName}
              onChange={(e) => setEditedName(e.target.value)}
              onBlur={handleNameEdit}
              onKeyPress={handleNameKeyPress}
              className="text-xl font-semibold border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
          ) : (
            <h3 className="text-xl font-semibold">{goal.name}</h3>
          )}
          <button
            onClick={handleNameEdit}
            className="p-1 text-gray-500 hover:text-gray-700 rounded-full hover:bg-gray-100"
            title={isEditing ? "Save" : "Edit goal name"}
          >
            <Pencil className="w-4 h-4" />
          </button>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Trophy className="w-5 h-5 text-yellow-500" />
            <span>{goal.trophies}</span>
          </div>
          <button
            onClick={handleDelete}
            className="p-2 text-red-500 hover:text-red-700 rounded-full hover:bg-red-50"
            title="Delete goal"
          >
            <Trash2 className="w-5 h-5" />
          </button>
          <button
            onClick={() => setShowSettings(true)}
            className="p-2 text-gray-600 hover:text-gray-900 rounded-full hover:bg-gray-100"
            title="Settings"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className={viewType === 'all' ? '' : 'grid grid-cols-1 md:grid-cols-2 gap-6'}>
        {viewType !== 'all' ? (
          <Calendar
            practiceDays={goal.practiceDays || []}
            currentMonth={currentMonth}
            onMonthChange={setCurrentMonth}
            onDayClick={setManualDate}
          />
        ) : (
          renderCompactCalendar()
        )}

        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Level {goal.currentLevel}</span>
              <span>Started {formatDistanceToNow(new Date(goal.startDate))} ago</span>
            </div>

            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 transition-all"
                style={{
                  width: `${Math.min(
                    (target.type === 'hours' && target.value > 0 ? progress / target.value : 0) * 100,
                    100
                  )}%`,
                }}
              />
            </div>

            <div className="flex justify-between text-sm">
              <span>{progress.toFixed(1)} hours ({goal.settings.frequency})</span>
              <span>Goal: {target.value} {target.type}</span>
            </div>
          </div>

          {viewType !== 'all' && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Note:
              </label>
              <textarea
                value={goal.note || ''}
                onChange={handleNoteChange}
                className="w-full h-24 p-2 border rounded-md resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Add a note about your progress..."
              />
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id={`completed-${goal.id}`}
                checked={goal.completed || false}
                onChange={handleCompletedChange}
                className="h-4 w-4 text-blue-500 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor={`completed-${goal.id}`} className="text-sm font-medium text-gray-700">
                Completed
              </label>
            </div>

            <button
              onClick={() => !isActive && startTimer(goal.id)}
              className={`flex items-center space-x-1 px-3 py-1.5 rounded-md ${
                isActive
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-blue-500 text-white hover:bg-blue-600'
              }`}
              disabled={isActive}
            >
              <Timer className="w-4 h-4" />
              <span>Timer</span>
            </button>
          </div>

          {renderWeeklyTrophies()}
        </div>
      </div>

      {manualDate && <ManualTimeDialog goal={goal} date={manualDate} onClose={() => setManualDate(null)} />}
      {showSettings && (
        <SettingsDialog
          goal={goal}
          onClose={() => setShowSettings(false)}
          onUpdate={(settings) => updateGoal(goal.id, { settings })}
        />
      )}
    </div>
  );
}
